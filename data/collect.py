"""Training-data crawl (PRD §4): sample ~200 players per tier (Silver..Diamond), pull each
one's 20 most recent Solo/Duo games this season, store every participant. Resumable:
already-stored matches are skipped.

    uv run python data/collect.py
    uv run python data/collect.py --tiers GOLD --players-per-tier 5   # smoke run

RIOT_API_KEY is read from the repo-root .env (copy .env.example).

Per-player profiles at query time use player_profile.py (up to 100 games this season).
"""
import argparse
import calendar
import random
import time

import db
from riot import RiotClient

TIERS = ["SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"]
DIVISIONS = ["I", "II", "III", "IV"]


def sample_players(client, tier, n, rng):
    """Spread the sample over all four divisions and a few random pages."""
    picked = []
    per_div = max(1, n // len(DIVISIONS))
    for div in DIVISIONS:
        entries = client.league_entries(tier, div, page=rng.randint(1, 5)) or client.league_entries(tier, div, 1)
        rng.shuffle(entries)
        picked += [e for e in entries if e.get("puuid")][:per_div]
    return picked[:n]


def run(args):
    rng = random.Random(args.seed)
    client = RiotClient()
    conn = db.connect(args.db)
    party_checked = False
    start_time = calendar.timegm(time.strptime(args.season_start, "%Y-%m-%d"))
    for tier in args.tiers:
        players = sample_players(client, tier, args.players_per_tier, rng)
        print(f"[{tier}] {len(players)} players sampled")
        new = 0
        for entry in players:
            now = int(time.time())
            db.save_player(conn, entry, now)
            for mid in client.season_match_ids(entry["puuid"], start_time, limit=args.matches_per_player):
                if db.has_match(conn, mid):
                    continue
                match = client.match(mid)
                if match and db.save_match(conn, match, tier):
                    new += 1
                    if not party_checked:
                        party_checked = True
                        print("party/premade fields in Match-V5:", db.party_fields(match) or "none")
            conn.commit()
        print(f"[{tier}] +{new} matches")
    total = conn.execute("SELECT seed_tier, COUNT(*) FROM matches GROUP BY seed_tier").fetchall()
    print("matches per tier:", dict(total))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="lol_duo.sqlite")
    ap.add_argument("--tiers", nargs="+", default=TIERS)
    ap.add_argument("--players-per-tier", type=int, default=200)
    ap.add_argument("--matches-per-player", type=int, default=20)
    ap.add_argument("--season-start", default="2026-01-08", help="UTC date the current ranked season began; verify before a real run")
    ap.add_argument("--seed", type=int, default=42)
    run(ap.parse_args())
