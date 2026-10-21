"""Training-data crawl (PRD §4): sample players per tier (Silver..Diamond), pull each one's
most recent Solo/Duo games this season, store every participant. Incremental and resumable:
stored matches are never fetched again, seeds already done at this game count are skipped,
and the ladder crawl remembers its last page.

    uv run python data/collect.py --ladder                     # 天梯快照 first, then matches
    uv run python data/collect.py --players-per-tier 400 --matches-per-player 40
    uv run python data/collect.py --status                     # progress, no API calls
    uv run python data/collect.py --tiers GOLD --players-per-tier 5   # smoke run

--ladder pages through every NA Solo/Duo league entry (~205 players per request), so teammates
of the seeds get a tier and the 段位差 term can be fitted. Seeds beyond those already stored are
then drawn from the ladder without extra requests.

RIOT_API_KEY is read from the repo-root .env (copy .env.example), or the file DUO_ENV names. If
Riot rejects it (dev keys expire after 24h) the run stops; regenerate the key, update .env and
rerun the same command. A key that sees different PUUIDs is detected at start and the stored
data is re-keyed first (key_epoch.py).

Per-player profiles at query time use player_profile.py (up to 100 games this season).
"""
import argparse
import random
import sys
import time

import requests

import db
import key_epoch
import player_profile
from riot import APEX_TIERS, KeyRejected, RateLimiter, RiotClient

TIERS = ["SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"]
LADDER_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"]
DIVISIONS = ["I", "II", "III", "IV"]
ENTRY_KEYS = ("puuid", "tier", "rank", "leaguePoints", "wins", "losses")
ENTRY_COLS = "puuid, tier, division, league_points, wins, losses"
# Leave part of the dev key's 20/1s and 100/120s to the demo site's lookups sharing the key.
COLLECT_LIMITS = ((18, 1.0), (90, 120.0))


def make_client():
    return RiotClient(limiter=RateLimiter(COLLECT_LIMITS))


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def sample_players(client, tier, n, rng):
    """Spread the sample over all four divisions and a few random pages."""
    picked = []
    per_div = max(1, n // len(DIVISIONS))
    for div in DIVISIONS:
        entries = client.league_entries(tier, div, page=rng.randint(1, 5)) or client.league_entries(tier, div, 1)
        rng.shuffle(entries)
        picked += [e for e in entries if e.get("puuid")][:per_div]
    return picked[:n]


def crawl_ladder(conn, client):
    """Store every Solo/Duo entry, page by page; resumes after the last stored page."""
    for tier in APEX_TIERS:
        if not _progress(conn, tier, "I")[1]:
            entries = client.apex_entries(tier)
            db.save_ladder(conn, entries, int(time.time()))
            _set_progress(conn, tier, "I", 1, done=True)
            log(f"[ladder] {tier}: {len(entries)} players")
    for tier in LADDER_TIERS:
        for div in DIVISIONS:
            page, done = _progress(conn, tier, div)
            while not done:
                page += 1
                entries = client.league_entries(tier, div, page)
                db.save_ladder(conn, entries, int(time.time()))
                done = not entries
                _set_progress(conn, tier, div, page, done)
                if page % 50 == 0 or done:
                    log(f"[ladder] {tier} {div}: page {page}{' (done)' if done else ''}")


def _progress(conn, tier, div):
    row = conn.execute("SELECT last_page, done FROM ladder_progress WHERE tier=? AND division=?", (tier, div)).fetchone()
    return row or (0, 0)


def _set_progress(conn, tier, div, page, done):
    conn.execute("""INSERT INTO ladder_progress VALUES (?,?,?,?)
                    ON CONFLICT(tier, division) DO UPDATE SET last_page=excluded.last_page, done=excluded.done""",
                 (tier, div, page, int(done)))
    conn.commit()


def seeds_for_tier(conn, client, tier, n, rng):
    """Seeds already stored for this tier first, topped up to n from the ladder (or the API)."""
    rows = conn.execute(f"SELECT {ENTRY_COLS} FROM players WHERE sampled_at IS NOT NULL AND tier=? "
                        "ORDER BY sampled_at, puuid", (tier,)).fetchall()
    seeds = [dict(zip(ENTRY_KEYS, r)) for r in rows][:n]
    need = n - len(seeds)
    if need <= 0:
        return seeds
    taken = {s["puuid"] for s in seeds}
    new = []
    for div in DIVISIONS:
        pool = conn.execute(
            f"""SELECT {ENTRY_COLS} FROM ladder WHERE tier=? AND division=? AND puuid NOT IN
                  (SELECT puuid FROM players WHERE sampled_at IS NOT NULL) ORDER BY puuid""",
            (tier, div)).fetchall()
        new += [dict(zip(ENTRY_KEYS, r)) for r in rng.sample(pool, min(-(-need // len(DIVISIONS)), len(pool)))]
    if not new:   # no ladder snapshot yet
        new = [e for e in sample_players(client, tier, need, rng) if e["puuid"] not in taken]
    return seeds + new[:need]


def collect_seed(conn, client, entry, tier, args, start_time):
    """Store one seed's recent games; returns how many matches were new."""
    done = conn.execute("SELECT matches_per_player FROM seed_progress WHERE puuid=?", (entry["puuid"],)).fetchone()
    if done and done[0] >= args.matches_per_player:
        return 0
    db.save_player(conn, entry, int(time.time()))
    new = 0
    try:
        ids = client.season_match_ids(entry["puuid"], start_time, limit=args.matches_per_player)
    except requests.HTTPError as e:   # e.g. 400 for a PUUID this key cannot decrypt
        log(f"skipped seed: {e}")
        return 0
    for mid in ids:
        if db.has_match(conn, mid):
            continue
        match = client.match(mid)
        if match and db.save_match(conn, match, tier):
            new += 1
    conn.execute("""INSERT INTO seed_progress VALUES (?,?)
                    ON CONFLICT(puuid) DO UPDATE SET matches_per_player=excluded.matches_per_player""",
                 (entry["puuid"], args.matches_per_player))
    conn.commit()
    return new


def run(args):
    rng = random.Random(args.seed)
    client = make_client()
    conn = db.connect(args.db)
    key_epoch.migrate(conn, client, key_epoch.check(conn, client, log), log)
    if getattr(args, "ladder", False):
        crawl_ladder(conn, client)
    start_time = player_profile.season_start_time(args.season_start)
    seeds = {tier: seeds_for_tier(conn, client, tier, args.players_per_tier, rng) for tier in args.tiers}
    log("seeds per tier: " + ", ".join(f"{t} {len(s)}" for t, s in seeds.items()))
    # Round-robin over tiers so every tier grows together if the run stops early.
    new, rounds = 0, max(map(len, seeds.values()), default=0)
    for i in range(rounds):
        for tier in args.tiers:
            if i < len(seeds[tier]):
                new += collect_seed(conn, client, seeds[tier][i], tier, args, start_time)
        if (i + 1) % 10 == 0:
            log(f"seed {i + 1}/{rounds} of each tier, +{new} matches this run")
    log(f"+{new} matches this run")
    status(conn)


def status(conn):
    q = lambda sql: conn.execute(sql).fetchall()
    print("matches per seed tier:", dict(q("SELECT seed_tier, COUNT(*) FROM matches WHERE seed_tier IS NOT NULL GROUP BY seed_tier")))
    print("seeds done per tier:", dict(q("SELECT p.tier, COUNT(*) FROM seed_progress JOIN players p USING (puuid) GROUP BY p.tier")))
    divs, pages = q("SELECT SUM(done), SUM(last_page) FROM ladder_progress")[0]
    print(f"ladder: {q('SELECT COUNT(*) FROM ladder')[0][0]} players, {divs or 0}/{len(LADDER_TIERS) * 4 + len(APEX_TIERS)} "
          f"divisions done, {pages or 0} pages fetched")
    known, total = q("""SELECT COUNT(l.puuid), COUNT(*) FROM (SELECT DISTINCT p.puuid FROM participants p
                          JOIN matches m USING (match_id) WHERE m.seed_tier IS NOT NULL) d
                        LEFT JOIN ladder l USING (puuid)""")[0]
    print(f"participants with a ladder tier: {known}/{total}")
    for eid, before, done in q("SELECT id, matches_before, done FROM key_epoch WHERE done=0"):
        n = q(f"SELECT COUNT(*) FROM rekeyed WHERE epoch={eid}")[0][0]
        print(f"re-keying after a key change: {n}/{before} matches")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=db.default_target(), help="SQLite path or Postgres URL (default: DUO_DB, DATABASE_URL)")
    ap.add_argument("--tiers", nargs="+", default=TIERS)
    ap.add_argument("--players-per-tier", type=int, default=200)
    ap.add_argument("--matches-per-player", type=int, default=20)
    ap.add_argument("--ladder", action="store_true", help="crawl the NA Solo/Duo ladder before collecting matches")
    ap.add_argument("--status", action="store_true", help="print progress and exit (no API calls)")
    ap.add_argument("--season-start", default=player_profile.SEASON_START, help="UTC date the current ranked season began")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    if args.status:
        status(db.connect(args.db))
        sys.exit()
    try:
        run(args)
    except KeyRejected as e:
        log(f"stopped: {e}. Progress is saved; rerun the same command after updating the key.")
        sys.exit(2)
