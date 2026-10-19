"""Player profile for a query (PRD §2-3): up to 100 most recent Solo/Duo games this season,
cached in the same database. Under 20 games = 数据不足 (insufficient data)."""
import calendar
import time

import db
from riot import RiotClient

MAX_GAMES = 100
MIN_GAMES = 20


def fetch_profile(conn, client, puuid, season_start="2026-01-08", on_progress=None):
    start_time = calendar.timegm(time.strptime(season_start, "%Y-%m-%d"))
    ids = client.season_match_ids(puuid, start_time, limit=MAX_GAMES)
    for i, mid in enumerate(ids, 1):
        if not db.has_match(conn, mid):
            match = client.match(mid)
            if match:
                db.save_match(conn, match, seed_tier=None)
        if on_progress:
            on_progress(i, len(ids))
    conn.commit()
    return proficiency(conn, puuid, ids)


def proficiency(conn, puuid, match_ids):
    """英雄熟练度: games and wins per (champion, position) over the given matches."""
    if not match_ids:
        return {"games": 0, "insufficient_data": True, "champions": []}
    marks = ",".join("?" * len(match_ids))
    rows = conn.execute(
        f"""SELECT champion_name, position, COUNT(*) AS games, SUM(win) AS wins
            FROM participants WHERE puuid=? AND match_id IN ({marks})
            GROUP BY champion_name, position ORDER BY games DESC""",
        (puuid, *match_ids),
    ).fetchall()
    games = sum(r[2] for r in rows)
    return {
        "games": games,
        "insufficient_data": games < MIN_GAMES,
        "champions": [{"champion": c, "position": pos, "games": g, "wins": w} for c, pos, g, w in rows],
    }
