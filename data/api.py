"""HTTP API for the demo site (web/ proxies /api/* here).

    uv run uvicorn api:app --app-dir data --port 8000

Env: DUO_DB (SQLite path, default lol_duo.sqlite), DUO_GAP_TABLE (段位差 JSON from
evaluate.py, default data/rank_gap.json), RIOT_API_KEY via .env.
New players are fetched in a background job whose progress the site polls (PRD §5.2).
"""
import os
import threading
import time
import uuid
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import db
import predict
import recommend
import service
from stats_source import CachedSource, OwnDataSource

DB_PATH = os.environ.get("DUO_DB", "lol_duo.sqlite")
GAP_TABLE = predict.load_gap_table(os.environ.get("DUO_GAP_TABLE", str(Path(__file__).parent / "rank_gap.json")))
MAX_PICKS, MAX_PICK_ROLES = 5, 2   # PRD §2.3: up to 5 自选英雄 in up to 2 positions
JOB_KEEP_SECONDS = 600              # finished lookup jobs are forgotten after this long

app = FastAPI(title="duo-lol")
jobs = {}
jobs_lock = threading.Lock()
_client = None
_client_lock = threading.Lock()


def connect():
    """Fresh connection per request; SQLite connections are not shared across threads."""
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


def prune_jobs(now):
    for job_id in [j for j, job in jobs.items() if job.get("finished_at", now) < now - JOB_KEEP_SECONDS]:
        del jobs[job_id]


def player_summary(p):
    prof = p["profile"]
    return {"riot_id": p["riot_id"], "tier": p["tier"], "division": p["division"], "unranked": p["unranked"],
            "games": prof["games"], "insufficient_data": prof["insufficient_data"],
            "champions": prof["champions"][:10]}


@app.get("/api/players/{riot_id}")
def get_player(riot_id: str):
    """Cached player, or 404 so the site starts a lookup job."""
    with connect() as conn:
        hit = service.cached_player(conn, riot_id)
    if not hit:
        raise HTTPException(404, "not cached")
    return player_summary(hit)


class LookupRequest(BaseModel):
    riot_id: str


@app.post("/api/lookups")
def start_lookup(req: LookupRequest):
    try:
        service.parse_riot_id(req.riot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
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
            result = {"status": "error", "error": f"查询失败：{type(e).__name__}"}
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


def scored_profile(conn, riot_id, self_report):
    """(player, profile used for scoring, note about how it was scored or None)."""
    player = service.cached_player(conn, riot_id)
    if not player:
        raise HTTPException(409, f"{riot_id} 还没有查询过")
    if not player["profile"]["insufficient_data"]:
        note = f"{player['riot_id']} 本赛季未定级，按 {service.UNRANKED_TIER} 估算" if player["unranked"] else None
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
    note = f"{player['riot_id']} 数据不足，按自选英雄在 {tier} 的全服胜率估算"
    return player, predict.self_reported_profile(tier, [(p.champion, p.position) for p in picks]), note


@app.post("/api/pair")
def pair(req: PairRequest):
    with connect() as conn:
        pa, prof_a, note_a = scored_profile(conn, req.a, req.a_self_report)
        pb, prof_b, note_b = scored_profile(conn, req.b, req.b_self_report)
        out = predict.predict_pair(CachedSource(OwnDataSource(conn)), prof_a, prof_b, GAP_TABLE)
    if not out:
        raise HTTPException(422, "两人没有可分配的位置组合")
    notes = [n for n in (note_a, note_b) if n]
    return {"a": player_summary(pa), "b": player_summary(pb), **out, "notes": notes}


@app.get("/api/recommendations/{riot_id}")
def recommendations(riot_id: str):
    with connect() as conn:
        me = service.cached_player(conn, riot_id)
        if not me:
            raise HTTPException(409, f"{riot_id} 还没有查询过")
        if me["profile"]["insufficient_data"]:
            raise HTTPException(422, {"insufficient_data": riot_id})
        found = recommend.recommend(conn, CachedSource(OwnDataSource(conn)), me, GAP_TABLE)
    return {"me": player_summary(me), "partners": [
        {"riot_id": r["riot_id"], "tier": r["tier"], "win_rate": r["win_rate"],
         "win_rate_delta": r["win_rate_delta"], "roles": r["roles"], "reasons": r["reasons"]}
        for r in found
    ]}


@app.get("/api/champions")
def champions():
    """Champion names seen in Solo/Duo data, for the 自选英雄 picker."""
    with connect() as conn:
        rows = conn.execute("SELECT DISTINCT champion_name FROM participants ORDER BY champion_name")
        return [r[0] for r in rows]
