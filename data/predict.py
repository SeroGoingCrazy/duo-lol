"""预测胜率 for a 组合 (PRD §3): DraftGap-style sum of Elo terms (ADR-0001).

Every term becomes one reason on the result page:
  英雄分    player's 英雄熟练度 on a champion, shrunk toward that champion's 全服 win rate
  组合加成  英雄组合 actual win rate minus what the two champions' own win rates predict
  段位差    correction for the tier gap between the two players (fitted from training data)

Profiles are the dicts player_profile.proficiency() returns, plus "tier".
"""
import json
from itertools import product

from elo import elo_to_winrate, shrink, winrate_to_elo

# A player's own games on a champion count against this many games at the champion's 全服 win rate.
# Champion and 英雄组合 global samples count against this many games at 50% / at the expected value.
# Picked from evaluate.py on the first real crawl (18,747 NA Solo/Duo games, 2026-10-19): at 20/200/200
# the model scored worse than a coin flip (log loss 0.6944 vs 0.6931) because a player's record on a
# champion and pair results were mostly noise; at 1000 each it is 0.6928. Re-check when data grows.
PLAYER_PRIOR_GAMES = 1000
CHAMPION_PRIOR_GAMES = 1000
SYNERGY_PRIOR_GAMES = 1000

ROLES_PER_PLAYER = 2      # PRD §3: each player's 2 most-played positions
CHAMPS_PER_ROLE = 3       # PRD §3: 3 most-played champions in the assigned position
TOP_PAIRS = 3             # PRD §2: show the best 3 英雄组合
TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND",
              "MASTER", "GRANDMASTER", "CHALLENGER"]


def champion_winrate(source, champion, position, tier):
    wins, games = source.champion(champion, position, tier)
    return shrink(wins, games, 0.5, CHAMPION_PRIOR_GAMES)


def champion_score(source, tier, champ):
    """英雄分 as Elo: player's record on the champion, shrunk toward its 全服 win rate."""
    base = champion_winrate(source, champ["champion"], champ["position"], tier)
    wr = shrink(champ["wins"], champ["games"], base, PLAYER_PRIOR_GAMES)
    return winrate_to_elo(wr)


def synergy(source, tier_a, ca, tier_b, cb):
    """组合加成 as Elo: pair result vs. the champions' own win rates added together."""
    wa = champion_winrate(source, ca["champion"], ca["position"], tier_a)
    wb = champion_winrate(source, cb["champion"], cb["position"], tier_b)
    expected = elo_to_winrate(winrate_to_elo(wa) + winrate_to_elo(wb))
    wins, games = source.champion_pair(ca["champion"], ca["position"], cb["champion"], cb["position"])
    actual = shrink(wins, games, expected, SYNERGY_PRIOR_GAMES)
    return winrate_to_elo(actual) - winrate_to_elo(expected), games


def rank_gap(tier_a, tier_b, gap_table):
    """段位差 as Elo, looked up by tier distance. gap_table comes from training data; {} = not fitted yet."""
    gap = abs(TIER_ORDER.index(tier_a) - TIER_ORDER.index(tier_b))
    return gap, gap_table.get(gap, 0.0)


def load_gap_table(path):
    """段位差 table written by evaluate.py --out; a missing file means not fitted yet."""
    try:
        with open(path) as f:
            return {int(k): v for k, v in json.load(f).items()}
    except FileNotFoundError:
        return {}


def top_roles(profile):
    games = {}
    for c in profile["champions"]:
        games[c["position"]] = games.get(c["position"], 0) + c["games"]
    return sorted(games, key=games.get, reverse=True)[:ROLES_PER_PLAYER]


def champs_in_role(profile, role):
    pool = [c for c in profile["champions"] if c["position"] == role]
    return sorted(pool, key=lambda c: c["games"], reverse=True)[:CHAMPS_PER_ROLE]


def usage_weights(champs):
    total = sum(c["games"] for c in champs)
    if total == 0:  # 自选英雄: no games yet, weigh them equally
        return [1 / len(champs)] * len(champs)
    return [c["games"] / total for c in champs]


def solo_baseline(source, profile):
    """单排基线: usage-weighted 英雄分 in the player's main position, as a win rate."""
    role = top_roles(profile)[0]
    champs = champs_in_role(profile, role)
    elo = sum(w * champion_score(source, profile["tier"], c) for w, c in zip(usage_weights(champs), champs))
    return elo_to_winrate(elo)


def evaluate_assignment(source, a, b, role_a, role_b, gap_table):
    ca_list, cb_list = champs_in_role(a, role_a), champs_in_role(b, role_b)
    if not ca_list or not cb_list:
        return None
    gap, gap_elo = rank_gap(a["tier"], b["tier"], gap_table)
    combos, weighted_elo = [], 0.0
    for (wa, ca), (wb, cb) in product(zip(usage_weights(ca_list), ca_list), zip(usage_weights(cb_list), cb_list)):
        sa = champion_score(source, a["tier"], ca)
        sb = champion_score(source, b["tier"], cb)
        syn, pair_games = synergy(source, a["tier"], ca, b["tier"], cb)
        total = sa + sb + syn + gap_elo
        weighted_elo += wa * wb * total
        combos.append({
            "champion_a": ca["champion"], "champion_b": cb["champion"],
            "win_rate": elo_to_winrate(total),
            "terms": {"champion_a": sa, "champion_b": sb, "synergy": syn, "rank_gap": gap_elo},
            "pair_games": pair_games,
        })
    combos.sort(key=lambda c: c["win_rate"], reverse=True)
    return {"role_a": role_a, "role_b": role_b, "win_rate": elo_to_winrate(weighted_elo),
            "combos": combos, "tier_gap": gap, "rank_gap_elo": gap_elo,
            "rank_gap_fitted": bool(gap_table)}


def predict_pair(source, a, b, gap_table=None):
    """Return 预测胜率, 胜率差, best position split, top 英雄组合 and reasons."""
    gap_table = gap_table or {}
    options = [
        evaluate_assignment(source, a, b, ra, rb, gap_table)
        for ra, rb in product(top_roles(a), top_roles(b)) if ra != rb
    ]
    options = [o for o in options if o]
    if not options:
        return None
    best = max(options, key=lambda o: o["win_rate"])
    baseline = (solo_baseline(source, a) + solo_baseline(source, b)) / 2
    return {
        "win_rate": best["win_rate"],
        "win_rate_delta": best["win_rate"] - baseline,
        "solo_baselines": {"a": solo_baseline(source, a), "b": solo_baseline(source, b)},
        "roles": {"a": best["role_a"], "b": best["role_b"]},
        "top_pairs": best["combos"][:TOP_PAIRS],
        "reasons": reasons(best, len(options)),
    }


def points(elo):
    """Signed whole points for a reason line; never '-0'."""
    return f"{round(elo) + 0:+d}"


def reasons(best, n_options):
    top = best["combos"][0]
    t = top["terms"]
    out = [
        f"位置组合：{best['role_a']} + {best['role_b']} 是 {n_options} 种可行分配里预测胜率最高的",
        f"熟练度：{top['champion_a']} 贡献 {points(t['champion_a'])} 分，{top['champion_b']} 贡献 {points(t['champion_b'])} 分",
        f"组合加成：{top['champion_a']} + {top['champion_b']} {points(t['synergy'])} 分（全服 {top['pair_games']} 局样本）",
    ]
    if best["tier_gap"] == 0:
        out.append("段位差：两人同段位")
    elif not best["rank_gap_fitted"]:
        out.append(f"段位差：相差 {best['tier_gap']} 个大段，修正项尚未用数据拟合，暂不计入")
    else:
        out.append(f"段位差：相差 {best['tier_gap']} 个大段，修正 {points(best['rank_gap_elo'])} 分")
    return out


def self_reported_profile(tier, picks):
    """数据不足 fallback (PRD §2.3): picks = [(champion, position)], up to 5 champions / 2 positions."""
    return {"tier": tier, "games": 0, "insufficient_data": True,
            "champions": [{"champion": c, "position": p, "games": 0, "wins": 0} for c, p in picks]}
