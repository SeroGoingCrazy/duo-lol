"""Sync what the site needs from the collector's SQLite file into the site's database (Neon).

    uv run python data/sync_site.py lol_duo.sqlite                 # into DATABASE_URL from .env
    uv run python data/sync_site.py lol_duo.sqlite --to postgresql://...

The collector keeps every match locally; the whole file would not fit Neon's free tier. The site only
needs three things from it:
  全服统计   champion_stats and pair_stats, summed here; the API reads them through AggregateSource
  推荐池     seed players with a tier and Riot ID, and their own rows for their latest MAX_GAMES games
             (players / matches / participants), so 英雄熟练度 works for them
Everything else in the site's database (looked-up players, their matches, the score scale) is left
alone. Rerunning replaces the sums and adds only pool rows the site does not have yet.
"""
import argparse
import os
import sqlite3
import sys
from collections import Counter
from pathlib import Path

import db
import player_profile

PLAYER_COLS = ("puuid", "riot_id", "tier", "division", "league_points", "wins", "losses", "sampled_at")
MATCH_COLS = ("match_id", "seed_tier", "game_version", "game_creation", "game_duration")
PART_COLS = ("match_id", "puuid", "team_id", "win", "position", "champion_id", "champion_name",
             "kills", "deaths", "assists", "gold", "damage", "cs", "vision")


def champion_stats(lite):
    """[(champion, position, seed tier, wins, games)], the numbers OwnDataSource.champion counts."""
    return lite.execute(
        """SELECT p.champion_name, p.position, m.seed_tier, SUM(p.win), COUNT(*)
           FROM participants p JOIN matches m ON m.match_id = p.match_id
           WHERE m.seed_tier IS NOT NULL AND p.position IS NOT NULL AND p.position <> ''
           GROUP BY p.champion_name, p.position, m.seed_tier""").fetchall()


def pair_stats(lite):
    """[(champ_a, pos_a, champ_b, pos_b, wins, games)] with (champ_a, pos_a) < (champ_b, pos_b), the
    numbers OwnDataSource.champion_pair counts, over every stored match."""
    wins, games = Counter(), Counter()
    team, key = [], None
    rows = lite.execute("""SELECT match_id, team_id, champion_name, position, win FROM participants
                           WHERE position IS NOT NULL AND position <> '' ORDER BY match_id, team_id""")
    for mid, tid, champ, pos, win in [*rows, (None, None, None, None, None)]:
        if (mid, tid) != key:
            for i, a in enumerate(team):
                for b in team[i + 1:]:
                    pair = (*a[0], *b[0]) if a[0] < b[0] else (*b[0], *a[0])
                    games[pair] += 1
                    wins[pair] += a[1]
            team, key = [], (mid, tid)
        team.append(((champ, pos), win))
    return [(*k, wins[k], n) for k, n in games.items()]


def pool_rows(lite):
    """(players, matches, participants) rows for the 推荐池: seeds with a tier and Riot ID, latest games only."""
    players = lite.execute(f"SELECT {', '.join(PLAYER_COLS)} FROM players "
                           "WHERE tier IS NOT NULL AND riot_id IS NOT NULL").fetchall()
    recent = f"""SELECT match_id, puuid FROM (
                   SELECT p.match_id, p.puuid,
                          ROW_NUMBER() OVER (PARTITION BY p.puuid ORDER BY m.game_creation DESC) AS n
                   FROM participants p JOIN matches m ON m.match_id = p.match_id
                   JOIN players pl ON pl.puuid = p.puuid
                   WHERE pl.tier IS NOT NULL AND pl.riot_id IS NOT NULL) WHERE n <= {player_profile.MAX_GAMES}"""
    parts = lite.execute(f"""SELECT {', '.join('p.' + c for c in PART_COLS)} FROM participants p
                             JOIN ({recent}) r ON r.match_id = p.match_id AND r.puuid = p.puuid""").fetchall()
    matches = lite.execute(f"""SELECT {', '.join(MATCH_COLS)} FROM matches WHERE match_id IN
                               (SELECT DISTINCT match_id FROM ({recent}))""").fetchall()
    return players, matches, parts


def _insert(conn, table, cols, rows, conflict="ON CONFLICT DO NOTHING"):
    if not rows:
        return
    if db.is_postgres(conn) and not conflict:
        with conn.raw.cursor().copy(f"COPY {table} ({', '.join(cols)}) FROM STDIN") as out:
            for row in rows:
                out.write_row(row)
        return
    marks = ",".join("?" * len(cols))
    conn.executemany(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({marks}) {conflict}", rows)


def sync(src, dst, log=print):
    """Copy the sums and the 推荐池 from SQLite file src into the database dst; returns row counts."""
    lite = sqlite3.connect(Path(src).resolve().as_uri() + "?mode=ro", uri=True)
    lite.execute("BEGIN")   # one consistent snapshot while the collector keeps writing
    champs, pairs = champion_stats(lite), pair_stats(lite)
    players, matches, parts = pool_rows(lite)
    lite.close()

    conn = db.connect(dst)
    try:
        conn.execute("DELETE FROM champion_stats")
        conn.execute("DELETE FROM pair_stats")
        _insert(conn, "champion_stats", ("champion_name", "position", "tier", "wins", "games"), champs, conflict="")
        _insert(conn, "pair_stats", ("champ_a", "pos_a", "champ_b", "pos_b", "wins", "games"), pairs, conflict="")
        updates = ", ".join(f"{c}=excluded.{c}" for c in PLAYER_COLS[1:])   # recommend_opt_in stays the site's
        _insert(conn, "players", PLAYER_COLS, players, conflict=f"ON CONFLICT(puuid) DO UPDATE SET {updates}")
        have_matches = {r[0] for r in conn.execute("SELECT match_id FROM matches")}
        have_parts = set(conn.execute("SELECT match_id, puuid FROM participants").fetchall())
        new_matches = [m for m in matches if m[0] not in have_matches]
        new_parts = [p for p in parts if (p[0], p[1]) not in have_parts]
        _insert(conn, "matches", MATCH_COLS, new_matches)
        _insert(conn, "participants", PART_COLS, new_parts)
        conn.commit()
    finally:
        conn.close()
    counts = {"champion_stats": len(champs), "pair_stats": len(pairs), "pool players": len(players),
              "new matches": len(new_matches), "new participants": len(new_parts)}
    log(", ".join(f"{k}: {v}" for k, v in counts.items()))
    return counts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("sqlite", help="the collector's SQLite file")
    ap.add_argument("--to", help="site database (default: DATABASE_URL from .env)")
    args = ap.parse_args()
    db.default_target()   # loads .env
    dst = args.to or os.environ.get("DATABASE_URL")
    if not dst:
        sys.exit("Set DATABASE_URL in .env to the Neon connection string, or pass --to")
    if not os.path.exists(args.sqlite):
        sys.exit(f"{args.sqlite} not found")
    sync(args.sqlite, dst)
