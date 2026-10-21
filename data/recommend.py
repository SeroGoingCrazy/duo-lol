"""找搭子 (PRD §2.2): the 5 players in the 推荐池 with the highest 预测胜率 with you.

推荐池 in the prototype = every player we hold enough games for (PRD CONTEXT); at launch it
narrows to players with recommend_opt_in = 1 (PRD §7), via require_opt_in.
Only Riot IDs and reasons are returned, never contact details.
"""
import json

import player_profile
import predict
from predict import TIER_ORDER
from service import UNRANKED_TIER, riot_id_key

TOP_N = 5
DIVISIONS = ["IV", "III", "II", "I"]


def rank_step(tier, division="IV"):
    """Iron IV = 0 ... Diamond I = 27, one step per division; Master and above are None."""
    if tier not in TIER_ORDER[:TIER_ORDER.index("MASTER")]:
        return None
    return TIER_ORDER.index(tier) * 4 + DIVISIONS.index(division or "IV")


# PRD §8 default: only recommend players you could actually duo with. Riot's Solo/Duo table
# ("Ranked Tiers, Divisions, and Queues", support.riotgames.com, checked 2026-10-19):
# who each rank may queue with, as an inclusive range of rank steps.
DUO_RANGES = {
    "IRON": (rank_step("IRON"), rank_step("SILVER", "I")),
    "BRONZE": (rank_step("IRON"), rank_step("SILVER", "I")),
    "SILVER": (rank_step("IRON"), rank_step("GOLD", "I")),
    "GOLD": (rank_step("SILVER"), rank_step("PLATINUM", "I")),
    "PLATINUM": (rank_step("GOLD"), rank_step("EMERALD", "I")),
    "EMERALD": (rank_step("PLATINUM"), rank_step("DIAMOND", "III")),
}
DIAMOND_LOW_RANGE = (rank_step("EMERALD", "II"), rank_step("DIAMOND", "II"))   # Diamond IV-II
DIAMOND_I_RANGE = (rank_step("DIAMOND", "III"), rank_step("DIAMOND", "I"))     # plus Master < 200 LP
MASTER_DUO_LP_CAP = 200     # Master can duo Diamond I only below this LP
MASTER_LP_WINDOW = 400      # Master pairs must be within this many LP


def _allows(a, b):
    """Does a's rank let a queue with b? a, b = (tier, division, league_points)."""
    tier, div, lp = a
    if tier in ("GRANDMASTER", "CHALLENGER"):
        return False
    b_step = rank_step(b[0], b[1])
    if tier == "MASTER":
        if lp is None:   # Master rules depend on LP; unknown LP never qualifies
            return False
        if b[0] == "MASTER":
            return b[2] is not None and abs(lp - b[2]) <= MASTER_LP_WINDOW
        return lp < MASTER_DUO_LP_CAP and b_step == rank_step("DIAMOND", "I")
    if tier == "DIAMOND":
        if div == "I":
            if b[0] == "MASTER":
                return b[2] is not None and b[2] < MASTER_DUO_LP_CAP
            low, high = DIAMOND_I_RANGE
        else:
            low, high = DIAMOND_LOW_RANGE
    else:
        low, high = DUO_RANGES[tier]
    return b_step is not None and low <= b_step <= high


def can_duo(a, b):
    """Both players' rows must allow each other. Riot's rows are not symmetric (Emerald lists
    Diamond III, but Diamond III's row starts at Emerald II; Diamond I lists Diamond III-II, but
    their row stops at Diamond II), so we only recommend pairs that neither row forbids."""
    return _allows(a, b) and _allows(b, a)


def candidate_pool(conn, require_opt_in=False, include_unranked=False):
    """[(puuid, riot_id, (tier, division, league_points), match_ids)] for ranked players; with
    include_unranked, looked-up players without a tier too (tier None), for 会员 牌堆."""
    pool = {}
    opt = "AND pl.recommend_opt_in = 1" if require_opt_in else ""
    rows = conn.execute(
        f"""SELECT puuid, riot_id, tier, division, league_points, match_id FROM (
              SELECT pl.puuid, pl.riot_id, pl.tier, pl.division, pl.league_points, p.match_id,
                     ROW_NUMBER() OVER (PARTITION BY pl.puuid ORDER BY m.game_creation DESC) AS n
              FROM players pl
              JOIN participants p ON p.puuid = pl.puuid
              JOIN matches m ON m.match_id = p.match_id
              WHERE pl.tier IS NOT NULL AND pl.riot_id IS NOT NULL {opt})
            WHERE n <= ?""",
        (player_profile.MAX_GAMES,),
    )
    for puuid, riot_id, tier, division, lp, match_id in rows:
        pool.setdefault(puuid, (puuid, riot_id, (tier, division, lp), []))[3].append(match_id)
    if not require_opt_in:
        for puuid, riot_id, tier, division, lp, ids in conn.execute(
            "SELECT puuid, riot_id, tier, division, league_points, match_ids FROM player_cache"
            + ("" if include_unranked else " WHERE tier IS NOT NULL")
        ):
            pool[puuid] = (puuid, riot_id, (tier, division, lp), json.loads(ids))
    return list(pool.values())


def recommend(conn, source, me, gap_table=None, require_opt_in=False, top_n=TOP_N, only=None, reports=None,
              exclude=frozenset()):
    """me = service.lookup_player(...) result. Returns the best partners, highest first.

    only: restrict the pool to these players, [(puuid, Riot ID key)] for the site's 会员 who pass its own
    filters; a puuid this database doesn't hold falls back to the Riot ID, since a new API key re-encrypts puuids. reports: {puuid: profile} from
    自选英雄, used for those players when they are 数据不足. exclude: puuids / Riot ID keys to leave out.
    Unranked candidates are scored and matched like an unranked `me`: their 自选英雄 tier, else UNRANKED_TIER."""
    # Unranked players are scored as UNRANKED_TIER (PRD decision) and matched at its bottom division.
    my_rank = (me["tier"], me["division"], me["league_points"]) if me["tier"] else (me["profile"]["tier"], "IV", 0)
    results = []
    pool = candidate_pool(conn, require_opt_in, include_unranked=only is not None)
    if only is not None:
        # a candidate is matched by puuid; by Riot ID only when its puuid is unknown here (an old API key)
        known = {row[0] for row in pool}
        by_puuid = {pu for pu, _ in only if pu in known}
        by_key = {k for pu, k in only if pu not in known}
    for puuid, riot_id, rank, ids in pool:
        key = riot_id_key(riot_id)
        if puuid in exclude or key in exclude:
            continue
        if only is not None and puuid not in by_puuid and key not in by_key:
            continue
        reported = (reports or {}).get(puuid) or (reports or {}).get(key)
        if rank[0] is None:
            rank = ((reported or {}).get("tier") or UNRANKED_TIER, "IV", 0)
        tier = rank[0]
        if puuid == me["puuid"] or not can_duo(my_rank, rank):
            continue
        profile = player_profile.proficiency(conn, puuid, ids)
        if profile["insufficient_data"]:
            if not reported:
                continue
            profile = dict(reported)
        profile["tier"] = tier
        out = predict.predict_pair(source, me["profile"], profile, gap_table)
        if out:
            results.append({"puuid": puuid, "riot_id": riot_id, "tier": tier, "division": rank[1], **out})
    results.sort(key=lambda r: r["win_rate"], reverse=True)
    return results[:top_n]
