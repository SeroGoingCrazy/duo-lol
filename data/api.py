"""HTTP API for the demo site (web/ proxies /api/* here).

    uv run uvicorn api:app --app-dir data --port 8000

Env: DUO_INTERNAL_SECRET (required on every request when set; the site sends it), DUO_DB (SQLite path or Postgres URL; else DATABASE_URL, else lol_duo.sqlite), DUO_GAP_TABLE (段位差 JSON from
evaluate.py, default data/rank_gap.json), DUO_SCORE_SCALE (搭配评分 scale from score_scale.py,
default data/score_scale.json; fitted in the background at startup if missing), RIOT_API_KEY via .env.
New players are fetched in a background job whose progress the site polls (PRD §5.2).
"""
import json
import os
import threading
import time
import uuid
from contextlib import closing
from pathlib import Path

import hmac

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import db
import player_profile
import predict
import recommend
import score_scale
import service
from stats_source import CachedSource, OwnDataSource

DB_PATH = db.default_target()
GAP_TABLE = predict.load_gap_table(os.environ.get("DUO_GAP_TABLE", str(Path(__file__).parent / "rank_gap.json")))
SCORE_SCALE_PATH = os.environ.get("DUO_SCORE_SCALE", str(Path(__file__).parent / "score_scale.json"))
MAX_PICKS, MAX_PICK_ROLES = 5, 2   # PRD §2.3: up to 5 自选英雄 in up to 2 positions
MAX_DECK = 200     # 牌堆 size cap for one request
MAX_CANDIDATES = 5000   # 会员 the site may send for one 牌堆
MAX_EXCLUDE = 200_000   # puuids + Riot IDs of every bound 会员, hidden from the public demo
JOB_KEEP_SECONDS = 600
# The 自选英雄 picker lists a champion under a position once this share of its Solo/Duo games are there,
# so Zed shows under 中单 but not under the odd support game. It only filters a list, never a prediction.
MIN_POSITION_SHARE = 0.1
TIER_NAMES = {"IRON": "黑铁", "BRONZE": "青铜", "SILVER": "白银", "GOLD": "黄金", "PLATINUM": "铂金",
              "EMERALD": "翡翠", "DIAMOND": "钻石", "MASTER": "大师", "GRANDMASTER": "宗师", "CHALLENGER": "王者"}              # finished lookup jobs are forgotten after this long

app = FastAPI(title="duo-lol")
# Set in production (docs/deploy.md): then only the website, which sends it as X-Duo-Internal, can call this API.
INTERNAL_SECRET = os.environ.get("DUO_INTERNAL_SECRET", "")


@app.middleware("http")
async def require_internal_secret(request: Request, call_next):
    if INTERNAL_SECRET and not hmac.compare_digest(
            request.headers.get("x-duo-internal", "").encode(), INTERNAL_SECRET.encode()):
        return JSONResponse({"detail": "forbidden"}, status_code=403)
    return await call_next(request)
scale = score_scale.load_scale(SCORE_SCALE_PATH)
jobs = {}
jobs_lock = threading.Lock()
_client = None
_client_lock = threading.Lock()


def connect():
    """Fresh connection per request; connections are not shared across threads."""
    return closing(db.connect(DB_PATH))


def riot_client():
    """One client for the whole process, so every lookup shares a single Riot rate limit."""
    global _client
    with _client_lock:
        if _client is None:
            if os.environ.get("DUO_FAKE_RIOT"):   # end-to-end tests only; see fake_riot.py
                import fake_riot
                _client = fake_riot.FakeRiotClient()
            else:
                from riot import RiotClient
                _client = RiotClient()
        return _client


@app.on_event("startup")
def fit_score_scale_if_missing():
    """Without a saved scale, fit one from the database in the background; scores are None until then."""
    if scale:
        return

    def run():
        global scale
        conn = db.connect(DB_PATH)
        try:
            fitted = score_scale.fit(conn, GAP_TABLE)
        finally:
            conn.close()
        if fitted:
            scale = fitted
            try:
                with open(SCORE_SCALE_PATH, "w") as f:
                    json.dump(fitted, f, indent=2)
            except OSError:
                pass   # read-only checkout: keep it in memory only

    threading.Thread(target=run, daemon=True).start()


def friendly_error(e):
    """Lookup failure as a sentence for the page; never includes the key or a URL."""
    status = getattr(getattr(e, "response", None), "status_code", None)
    if status in (401, 403):
        return "Riot API Key 已失效，请在 .env 里换一个新的 Key 后重启服务"
    if status == 429 or isinstance(e, RuntimeError) and str(e).startswith("Gave up"):
        return "Riot 接口太忙了，请过一两分钟再试"
    if isinstance(e, RuntimeError) and "RIOT_API_KEY" in str(e):
        return "服务还没配置 Riot API Key"
    if isinstance(e, (OSError, ConnectionError)) or type(e).__module__.startswith("requests"):
        return "连不上 Riot 服务器，请稍后再试"
    return "查询失败，请稍后再试"


def prune_jobs(now):
    for job_id in [j for j, job in jobs.items() if job.get("finished_at", now) < now - JOB_KEEP_SECONDS]:
        del jobs[job_id]


def player_summary(p):
    prof = p["profile"]
    return {"riot_id": p["riot_id"], "tier": p["tier"], "division": p["division"],
            "league_points": p["league_points"], "unranked": p["unranked"],
            "games": prof["games"], "wins": sum(c["wins"] for c in prof["champions"]),
            "insufficient_data": prof["insufficient_data"],
            "champions": prof["champions"][:10]}


@app.get("/api/players/{riot_id}")
def get_player(riot_id: str):
    """Cached player, or 404 so the site starts a lookup job."""
    with connect() as conn:
        hit = service.cached_player(conn, riot_id)
    if not hit:
        raise HTTPException(404, "not cached")
    return player_summary(hit)


RECENT_GAMES = 20


@app.get("/api/players/{riot_id}/matches")
def player_matches(riot_id: str):
    """玩家资料页: a cached player's latest Solo/Duo games this season; 404 until it has been looked up."""
    with connect() as conn:
        row = service.cached_row(conn, riot_id)
        if not row:
            raise HTTPException(404, f"{riot_id} 还没有查询过")
        puuid, name, *_, match_ids = row
        games = player_profile.recent_games(conn, puuid, json.loads(match_ids), RECENT_GAMES)
    return {"riot_id": name, "games": games}


class DuoRecordPair(BaseModel):
    a: str
    b: str


class DuoRecordsRequest(BaseModel):
    pairs: list[DuoRecordPair] = Field(max_length=500)


@app.post("/api/duo-records")
def duo_records(req: DuoRecordsRequest):
    """一起打的战绩 for 互选 pairs, from the games already cached for both (server-only: not on the site's proxy).
    Any cache from this season counts, however old; a pair where either player has none gets null."""
    this_season = time.time() - player_profile.season_start_time()
    out, rows = [], {}
    with connect() as conn:
        def row(riot_id):
            key = service.riot_id_key(riot_id)
            if key not in rows:   # the same 会员 is usually in every pair
                rows[key] = service.cached_row(conn, riot_id, max_age=this_season)
            return rows[key]
        for p in req.pairs:
            ra, rb = row(p.a), row(p.b)
            out.append(None if not ra or not rb else player_profile.duo_games(
                conn, ra[0], json.loads(ra[5]), rb[0], json.loads(rb[5])))
    return {"records": out}


class LookupRequest(BaseModel):
    riot_id: str


@app.post("/api/lookups")
def start_lookup(req: LookupRequest):
    try:
        service.parse_riot_id(req.riot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with connect() as conn:
        hit = service.cached_player(conn, req.riot_id)
    if hit:   # cached: no job, the page shows it at once
        return {"job_id": None, "player": player_summary(hit)}
    key = service.riot_id_key(req.riot_id)
    with jobs_lock:
        prune_jobs(time.time())
        running = next((j for j, job in jobs.items() if job["key"] == key and job["status"] == "running"), None)
        if running:   # a second tab or double submit joins the lookup already in flight
            return {"job_id": running}
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"status": "running", "done": 0, "total": 0, "riot_id": req.riot_id, "key": key}

    def progress(done, total):
        with jobs_lock:
            jobs[job_id].update(done=done, total=total)

    def run():
        conn = db.connect(DB_PATH)
        try:
            player = service.lookup_player(conn, riot_client(), req.riot_id, progress)
            result = {"status": "done", "player": player_summary(player)}
        except service.PlayerNotFound as e:
            result = {"status": "error", "error": str(e)}
        except Exception as e:  # surfaced to the page; the key itself never appears in messages
            result = {"status": "error", "error": friendly_error(e)}
        finally:
            conn.close()
        with jobs_lock:
            jobs[job_id].update(result, finished_at=time.time())

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/lookups/{job_id}")
def lookup_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "unknown job")
    return job


@app.get("/api/riot-accounts/{riot_id}")
def riot_account(riot_id: str):
    """Who a Riot ID is and the icon they wear right now, read fresh from Riot for 头像验证 (ADR-0005).
    The site compares profile_icon_id with the icon it asked for; nothing is cached or stored here."""
    try:
        name, tag = service.parse_riot_id(riot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    client = riot_client()
    try:
        account = client.account_by_riot_id(name, tag)
        icon = client.profile_icon(account["puuid"]) if account else None
    except Exception as e:
        raise HTTPException(502, friendly_error(e))
    if not account or icon is None:
        raise HTTPException(404, f"找不到 {riot_id}，请检查名字和 # 后面的标签")
    return {"puuid": account["puuid"], "riot_id": f"{account['gameName']}#{account['tagLine']}",
            "profile_icon_id": icon}


if os.environ.get("DUO_FAKE_RIOT"):
    class FakeIcon(BaseModel):
        riot_id: str
        icon: int

    @app.post("/api/fake/icon")
    def fake_set_icon(req: FakeIcon):
        """End-to-end tests only: stands in for the player changing their icon in the client."""
        riot_client().set_icon(*service.parse_riot_id(req.riot_id), req.icon)
        return {"ok": True}


class Pick(BaseModel):
    champion: str
    position: str


class SelfReport(BaseModel):
    tier: str = service.UNRANKED_TIER
    picks: list[Pick] = Field(default_factory=list)


class PairRequest(BaseModel):
    a: str
    b: str
    a_self_report: SelfReport | None = None
    b_self_report: SelfReport | None = None


def score_fields(out):
    """搭配评分 among 组合 in the same two positions; score_by_roles is False while that position pair
    has too few sampled 组合 and the score falls back to all of them (score_scale.py)."""
    return {"score": score_scale.duo_score(out["win_rate"], scale, out["roles"]),
            "score_by_roles": bool(scale) and score_scale.compared_with(scale, out["roles"])[1]}


def top_pair_summary(p):
    return {k: p[k] for k in ("champion_a", "champion_b", "win_rate", "pair_games")}


def scored_profile(conn, riot_id, self_report):
    """(player, profile used for scoring, note about how it was scored or None)."""
    player = service.cached_player(conn, riot_id)
    if not player:
        raise HTTPException(409, f"{riot_id} 还没有查询过")
    if not player["profile"]["insufficient_data"]:
        note = f"{player['riot_id']} 本赛季未定级，按{TIER_NAMES[service.UNRANKED_TIER]}估算" if player["unranked"] else None
        return player, player["profile"], note
    if not self_report or not self_report.picks:
        raise HTTPException(422, {"insufficient_data": riot_id})
    picks = self_report.picks[:MAX_PICKS]
    if len({p.position for p in picks}) > MAX_PICK_ROLES:
        raise HTTPException(400, "自选英雄最多覆盖 2 个位置")
    try:
        tier = player["tier"] or service.normalize_tier(self_report.tier)
    except ValueError as e:
        raise HTTPException(400, str(e))
    note = f"{player['riot_id']} 数据不足，按自选英雄在{TIER_NAMES.get(tier, tier)}的全服胜率估算"
    return player, predict.self_reported_profile(tier, [(p.champion, p.position) for p in picks]), note


@app.post("/api/pair")
def pair(req: PairRequest):
    with connect() as conn:
        pa, prof_a, note_a = scored_profile(conn, req.a, req.a_self_report)
        pb, prof_b, note_b = scored_profile(conn, req.b, req.b_self_report)
        if pa["puuid"] == pb["puuid"]:
            raise HTTPException(400, "两个 Riot ID 是同一个玩家，请填两个不同的人")
        out = predict.predict_pair(CachedSource(OwnDataSource(conn)), prof_a, prof_b, GAP_TABLE)
    if not out:
        raise HTTPException(422, "两人没有可分配的位置组合")
    notes = [n for n in (note_a, note_b) if n]
    return {"a": player_summary(pa), "b": player_summary(pb), **out,
            "top_pairs": [top_pair_summary(p) for p in out["top_pairs"]],
            **score_fields(out), "notes": notes}


class Candidate(BaseModel):
    """A 会员 the site allows in this 牌堆 (PRD-v2 §3.2 filters are applied by the site)."""
    puuid: str
    riot_id: str
    self_report: SelfReport | None = None


class RecommendRequest(BaseModel):
    riot_id: str
    self_report: SelfReport | None = None
    limit: int = Field(recommend.TOP_N, ge=1, le=MAX_DECK)   # the 牌堆 asks for the whole ranked pool
    candidates: list[Candidate] | None = Field(None, max_length=MAX_CANDIDATES)   # None = the whole 推荐池
    # puuids / Riot IDs never to return: the site hides its 会员 from the public demo, whose cards show Riot IDs
    exclude: list[str] = Field(default_factory=list, max_length=MAX_EXCLUDE)


def candidate_reports(candidates):
    """{puuid and Riot ID key: 自选英雄 profile} for candidates that sent one."""
    out = {}
    for c in candidates or []:
        if c.self_report and c.self_report.picks:
            picks = c.self_report.picks[:MAX_PICKS]
            if len({p.position for p in picks}) > MAX_PICK_ROLES:
                continue
            try:
                tier = service.normalize_tier(c.self_report.tier)
            except ValueError:
                tier = service.UNRANKED_TIER
            prof = predict.self_reported_profile(tier, [(p.champion, p.position) for p in picks])
            out[c.puuid] = out[service.riot_id_key(c.riot_id)] = prof
    return out


def partner_list(conn, me, profile, limit=recommend.TOP_N, candidates=None, exclude=()):
    only = None if candidates is None else [(c.puuid, service.riot_id_key(c.riot_id)) for c in candidates]
    found = recommend.recommend(conn, CachedSource(OwnDataSource(conn)), {**me, "profile": profile}, GAP_TABLE,
                                top_n=limit, only=only, reports=candidate_reports(candidates),
                                exclude={service.riot_id_key(x) if "#" in x else x for x in exclude})
    return [
        {"puuid": r["puuid"], "riot_id": r["riot_id"], "tier": r["tier"], "division": r["division"], "win_rate": r["win_rate"],
         "win_rate_delta": r["win_rate_delta"], **score_fields(r),
         "roles": r["roles"], "top_pairs": [top_pair_summary(p) for p in r["top_pairs"]],
         "reasons": r["reasons"]}
        for r in found
    ]


@app.post("/api/recommendations")
def recommend_for(req: RecommendRequest):
    """找搭子; a 数据不足 player sends 自选英雄 the same way as for /api/pair."""
    with connect() as conn:
        me, profile, note = scored_profile(conn, req.riot_id, req.self_report)
        return {"me": player_summary(me), "partners": partner_list(conn, me, profile, req.limit, req.candidates, req.exclude),
                "notes": [note] if note else []}


@app.get("/api/champions")
def champions():
    """Champion names seen in Solo/Duo data, for the 自选英雄 picker."""
    with connect() as conn:
        rows = conn.execute("SELECT DISTINCT champion_name FROM participants ORDER BY champion_name")
        return [r[0] for r in rows]


@app.get("/api/champion-positions")
def champion_positions():
    """{champion: positions it is commonly played in, most played first}, for the picker's position tabs."""
    with connect() as conn:
        rows = conn.execute(
            """SELECT champion_name, position, COUNT(*) FROM participants
               WHERE position IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY')
               GROUP BY champion_name, position ORDER BY champion_name, COUNT(*) DESC""").fetchall()
    games, out = {}, {}
    for champ, _, n in rows:
        games[champ] = games.get(champ, 0) + n
    for champ, pos, n in rows:
        listed = out.setdefault(champ, [])
        if not listed or n >= MIN_POSITION_SHARE * games[champ]:
            listed.append(pos)
    return out
