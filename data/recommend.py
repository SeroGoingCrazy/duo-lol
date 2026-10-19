"""找搭子 (PRD §2.2): the 5 players in the 推荐池 with the highest 预测胜率 with you.

推荐池 in the prototype = every player we hold enough games for (PRD CONTEXT); at launch it
narrows to players with recommend_opt_in = 1 (PRD §7), via require_opt_in.
Only Riot IDs and reasons are returned, never contact details.
"""
import json

import player_profile
import predict
from predict import TIER_ORDER

TOP_N = 5
# PRD §8 default: only recommend tiers you could actually duo with. Approximation of Riot's
# Solo/Duo rule (one tier apart; Master and above cannot duo across that line); verify each season.
MAX_DUO_TIER_GAP = 1
APEX_TIERS = {"MASTER", "GRANDMASTER", "CHALLENGER"}


def can_duo(tier_a, tier_b):
    if (tier_a in APEX_TIERS) != (tier_b in APEX_TIERS):
        return False
    return abs(TIER_ORDER.index(tier_a) - TIER_ORDER.index(tier_b)) <= MAX_DUO_TIER_GAP


def candidate_pool(conn, require_opt_in=False):
    """[(puuid, riot_id, tier, match_ids)] for ranked players with a known Riot ID."""
    pool = {}
    opt = "AND pl.recommend_opt_in = 1" if require_opt_in else ""
    rows = conn.execute(
        f"""SELECT puuid, riot_id, tier, match_id FROM (
              SELECT pl.puuid, pl.riot_id, pl.tier, p.match_id,
                     ROW_NUMBER() OVER (PARTITION BY pl.puuid ORDER BY m.game_creation DESC) AS n
              FROM players pl
              JOIN participants p ON p.puuid = pl.puuid
              JOIN matches m ON m.match_id = p.match_id
              WHERE pl.tier IS NOT NULL AND pl.riot_id IS NOT NULL {opt})
            WHERE n <= ?""",
        (player_profile.MAX_GAMES,),
    )
    for puuid, riot_id, tier, match_id in rows:
        pool.setdefault(puuid, (puuid, riot_id, tier, []))[3].append(match_id)
    if not require_opt_in:
        for puuid, riot_id, tier, ids in conn.execute(
            "SELECT puuid, riot_id, tier, match_ids FROM player_cache WHERE tier IS NOT NULL"
        ):
            pool[puuid] = (puuid, riot_id, tier, json.loads(ids))
    return list(pool.values())


def recommend(conn, source, me, gap_table=None, require_opt_in=False, top_n=TOP_N):
    """me = service.lookup_player(...) result. Returns the best partners, highest first."""
    my_tier = me["profile"]["tier"]
    results = []
    for puuid, riot_id, tier, ids in candidate_pool(conn, require_opt_in):
        if puuid == me["puuid"] or not can_duo(my_tier, tier):
            continue
        profile = player_profile.proficiency(conn, puuid, ids)
        if profile["insufficient_data"]:
            continue
        profile["tier"] = tier
        out = predict.predict_pair(source, me["profile"], profile, gap_table)
        if out:
            results.append({"riot_id": riot_id, "tier": tier, **out})
    results.sort(key=lambda r: r["win_rate"], reverse=True)
    return results[:top_n]
