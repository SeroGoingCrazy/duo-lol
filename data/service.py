"""Player lookup with caching (PRD §2, §4): Riot ID -> tier + 英雄熟练度 profile.

A cached player answers instantly; a new one costs up to ~100 match fetches, which the
dev key's 100 req/2 min limit turns into roughly two minutes, reported through on_progress.
"""
import calendar
import json
import time

import player_profile

CACHE_SECONDS = 6 * 3600      # re-fetch a player's games after this long
SEASON_START = "2026-01-08"   # same default as collect.py; verify each season
# Unranked players have no tier for the 全服 win-rate prior; they are scored as this tier
# and the result says so.
UNRANKED_TIER = "SILVER"


class PlayerNotFound(Exception):
    pass


def parse_riot_id(riot_id):
    name, sep, tag = riot_id.strip().rpartition("#")
    if not sep or not name or not tag:
        raise ValueError("Riot ID 格式应为 名字#标签，例如 Faker#KR1")
    return name.strip(), tag.strip()


def cached_player(conn, riot_id, max_age=CACHE_SECONDS):
    row = conn.execute(
        """SELECT puuid, riot_id, tier, division, match_ids, fetched_at FROM player_cache
           WHERE riot_id_key=? ORDER BY fetched_at DESC LIMIT 1""",
        (riot_id.strip().lower(),),
    ).fetchone()
    if not row or time.time() - row[5] > max_age:
        return None
    return build_player(conn, *row[:5])


def build_player(conn, puuid, riot_id, tier, division, match_ids_json):
    match_ids = json.loads(match_ids_json)
    profile = player_profile.proficiency(conn, puuid, match_ids)
    profile["tier"] = tier or UNRANKED_TIER
    return {"puuid": puuid, "riot_id": riot_id, "tier": tier, "division": division,
            "unranked": tier is None, "profile": profile}


def lookup_player(conn, client, riot_id, on_progress=None):
    """Cached player, or fetch account, Solo/Duo rank and up to 100 games this season."""
    hit = cached_player(conn, riot_id)
    if hit:
        return hit
    name, tag = parse_riot_id(riot_id)
    account = client.account_by_riot_id(name, tag)
    if not account:
        raise PlayerNotFound(f"找不到美服玩家 {riot_id}")
    puuid = account["puuid"]
    canonical = f'{account["gameName"]}#{account["tagLine"]}'
    entry = client.solo_entry(puuid)
    start = calendar.timegm(time.strptime(SEASON_START, "%Y-%m-%d"))
    ids = client.season_match_ids(puuid, start, limit=player_profile.MAX_GAMES)
    player_profile.store_matches(conn, client, ids, on_progress)
    tier, division = (entry["tier"], entry["rank"]) if entry else (None, None)
    conn.execute(
        """INSERT INTO player_cache VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(puuid) DO UPDATE SET riot_id=excluded.riot_id, riot_id_key=excluded.riot_id_key,
             tier=excluded.tier, division=excluded.division, match_ids=excluded.match_ids,
             fetched_at=excluded.fetched_at""",
        (puuid, canonical, canonical.lower(), tier, division, json.dumps(ids), int(time.time())),
    )
    conn.commit()
    return build_player(conn, puuid, canonical, tier, division, json.dumps(ids))
