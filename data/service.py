"""Player lookup with caching (PRD §2, §4): Riot ID -> tier + 英雄熟练度 profile.

A cached player answers instantly; a new one costs up to ~100 match fetches, which the
dev key's 100 req/2 min limit turns into roughly two minutes, reported through on_progress.
"""
import json
import time

import player_profile
from predict import TIER_ORDER

CACHE_SECONDS = 6 * 3600      # re-fetch a player's games after this long
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


def riot_id_key(riot_id):
    """Case- and spacing-insensitive key, so 'Alpha #NA1' finds the cached 'alpha#na1'."""
    try:
        name, tag = parse_riot_id(riot_id)
    except ValueError:
        return riot_id.strip().lower()
    return f"{name}#{tag}".lower()


def normalize_tier(tier):
    tier = (tier or "").strip().upper()
    if tier not in TIER_ORDER:
        raise ValueError(f"未知段位 {tier or '（空）'}")
    return tier


def cached_player(conn, riot_id, max_age=CACHE_SECONDS):
    row = conn.execute(
        """SELECT puuid, riot_id, tier, division, league_points, match_ids, fetched_at FROM player_cache
           WHERE riot_id_key=? ORDER BY fetched_at DESC LIMIT 1""",
        (riot_id_key(riot_id),),
    ).fetchone()
    if not row or time.time() - row[6] > max_age:
        return None
    return build_player(conn, *row[:6])


def build_player(conn, puuid, riot_id, tier, division, league_points, match_ids_json):
    match_ids = json.loads(match_ids_json)
    profile = player_profile.proficiency(conn, puuid, match_ids)
    profile["tier"] = tier or UNRANKED_TIER
    return {"puuid": puuid, "riot_id": riot_id, "tier": tier, "division": division,
            "league_points": league_points, "unranked": tier is None, "profile": profile}


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
    ids = player_profile.season_match_ids(client, puuid)
    player_profile.store_matches(conn, client, ids, on_progress, puuid=puuid)
    tier, division, lp = (entry["tier"], entry["rank"], entry["leaguePoints"]) if entry else (None, None, None)
    conn.execute(
        """INSERT INTO player_cache
             (puuid, riot_id, riot_id_key, tier, division, league_points, match_ids, fetched_at)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(puuid) DO UPDATE SET riot_id=excluded.riot_id, riot_id_key=excluded.riot_id_key,
             tier=excluded.tier, division=excluded.division, league_points=excluded.league_points,
             match_ids=excluded.match_ids, fetched_at=excluded.fetched_at""",
        (puuid, canonical, riot_id_key(canonical), tier, division, lp, json.dumps(ids), int(time.time())),
    )
    conn.commit()
    return build_player(conn, puuid, canonical, tier, division, lp, json.dumps(ids))
