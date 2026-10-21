"""Player profile for a query (PRD §2-3): up to 100 most recent Solo/Duo games this season,
cached in the same database. Under 20 games = 数据不足 (insufficient data)."""
import calendar
import time

import db

MAX_GAMES = 100
MIN_GAMES = 20
SEASON_START = "2026-01-08"   # UTC date the current ranked season began; verify each season


def season_start_time(season_start=SEASON_START):
    return calendar.timegm(time.strptime(season_start, "%Y-%m-%d"))


def season_match_ids(client, puuid, limit=MAX_GAMES, season_start=SEASON_START):
    return client.season_match_ids(puuid, season_start_time(season_start), limit=limit)


def fetch_profile(conn, client, puuid, season_start=SEASON_START, on_progress=None):
    ids = season_match_ids(client, puuid, season_start=season_start)
    store_matches(conn, client, ids, on_progress)
    return proficiency(conn, puuid, ids)


def store_matches(conn, client, match_ids, on_progress=None):
    """Fetch and store the matches not cached yet; on_progress(done, total) after each."""
    for i, mid in enumerate(match_ids, 1):
        if not db.has_match(conn, mid):
            match = client.match(mid)
            if match:
                db.save_match(conn, match, seed_tier=None)
                conn.commit()   # short write transactions so parallel lookups don't block
        if on_progress:
            on_progress(i, len(match_ids))


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


def recent_games(conn, puuid, match_ids, limit=20):
    """The player's latest games among match_ids, newest first, for the 玩家资料页."""
    if not match_ids:
        return []
    marks = ",".join("?" * len(match_ids))
    rows = conn.execute(
        f"""SELECT m.match_id, m.game_creation, m.game_duration, p.champion_name, p.position, p.win,
                   p.kills, p.deaths, p.assists, p.cs
            FROM participants p JOIN matches m ON m.match_id = p.match_id
            WHERE p.puuid=? AND p.match_id IN ({marks})
            ORDER BY m.game_creation DESC LIMIT ?""",
        (puuid, *match_ids, limit),
    ).fetchall()
    keys = ["match_id", "game_creation", "game_duration", "champion", "position", "win", "kills", "deaths", "assists", "cs"]
    return [dict(zip(keys, r), win=bool(r[5])) for r in rows]
