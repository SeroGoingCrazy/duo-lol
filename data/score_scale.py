"""搭配评分 (0-100): where a 预测胜率 falls among the 预测胜率 of real 组合.

    uv run python data/score_scale.py --db lol_duo.sqlite

The fit is saved in the database (score_scale table), so the API, on any machine, picks it up.

预测胜率 cluster tightly around 50%, so 50.4% vs 50.0% is easy to misread as "nothing".
The score is the percentile of a 预测胜率 under a normal distribution fitted to the 预测胜率
the site itself would show for pairs of players in the 推荐池 who are allowed to duo:
score = 100 × Φ((win_rate − mean) / std). A score of 50 is a typical 组合, 84 is one std better.
A 组合 is only compared with 组合 in the same two positions (打野+中单 with 打野+中单, ADR-0010):
each position pair gets its own mean and std, and one with too few sampled 组合 falls back to all of them.
The mean and std come only from data; re-run this after the data or the model changes.
"""
import argparse
import json
import math
import random
import statistics
import time
from itertools import combinations

import db
import player_profile
import predict
import recommend
import stats_source

POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
ROLE_PAIRS = len(list(combinations(POSITIONS, 2)))   # 10 ways to put two players in two different positions

SAMPLE_PAIRS = 300        # sampled 组合 wanted per position pair; more only tightens the estimate
MAX_SAMPLE_PAIRS = 3000   # stop predicting after this many 组合 even if a rare position pair is still short
# A position pair needs this many sampled 组合 before its own std is used: below it the std is off by
# more than about 13% (1/√(2n)), and the score falls back to the distribution over all position pairs.
MIN_ROLE_PAIRS = 30


def roles_key(roles):
    """Position pair key, order-free: {"a": "MIDDLE", "b": "JUNGLE"} -> "JUNGLE+MIDDLE"."""
    return "+".join(sorted((roles["a"], roles["b"])))


def usable(scale):
    """The scale, or None if it cannot score. One from before ADR-0010 has no per-position-pair fit:
    treat it as missing so it is refitted."""
    ok = isinstance(scale, dict) and isinstance(scale.get("std"), (int, float)) and scale["std"] > 0
    return scale if ok and "by_roles" in scale and "fitted_at" in scale else None


def load_scale(conn):
    """{"mean", "std", ...} last saved with save_scale; None if there is none or it is unusable."""
    row = conn.execute("SELECT scale FROM score_scale WHERE id=1").fetchone()
    try:
        return usable(json.loads(row[0])) if row else None
    except ValueError:
        return None


def save_scale(conn, scale):
    with conn:
        conn.execute("""INSERT INTO score_scale (id, scale, fitted_at) VALUES (1, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET scale=excluded.scale, fitted_at=excluded.fitted_at""",
                     (json.dumps(scale), scale["fitted_at"]))


def compared_with(scale, roles):
    """(distribution, whether it is the position pair's own) a 组合 in these positions is scored against."""
    own = (scale.get("by_roles") or {}).get(roles_key(roles)) if roles else None
    if own and own["pairs"] >= MIN_ROLE_PAIRS and own["std"] > 0:
        return own, True
    return scale, False


def duo_score(win_rate, scale, roles=None):
    """搭配评分: 0-100 percentile of win_rate among 组合 in the same positions; None if no scale."""
    if not scale:
        return None
    dist, _ = compared_with(scale, roles)
    z = (win_rate - dist["mean"]) / dist["std"]
    return round(100 * 0.5 * (1 + math.erf(z / math.sqrt(2))))


def summarize(rates):
    return {"mean": statistics.fmean(rates), "std": statistics.stdev(rates), "pairs": len(rates)}


def fit(conn, gap_table=None, sample_pairs=SAMPLE_PAIRS, seed=0, max_pairs=MAX_SAMPLE_PAIRS):
    source = stats_source.default_source(conn)
    players = []
    for puuid, riot_id, rank, ids in recommend.candidate_pool(conn):
        profile = player_profile.proficiency(conn, puuid, ids)
        if not profile["insufficient_data"]:
            profile["tier"] = rank[0]
            players.append((rank, profile))
    eligible = [(a, b) for a, b in combinations(range(len(players)), 2)
                if recommend.can_duo(players[a][0], players[b][0])]
    random.Random(seed).shuffle(eligible)
    rates, by_roles = [], {}
    for a, b in eligible[:max_pairs]:
        out = predict.predict_pair(source, players[a][1], players[b][1], gap_table)
        if not out:
            continue
        rates.append(out["win_rate"])
        by_roles.setdefault(roles_key(out["roles"]), []).append(out["win_rate"])
        if len(rates) >= sample_pairs and len(by_roles) == ROLE_PAIRS and min(map(len, by_roles.values())) >= sample_pairs:
            break
    if len(rates) < 2:
        return None
    return {**summarize(rates), "fitted_at": int(time.time()),
            "by_roles": {k: summarize(v) for k, v in sorted(by_roles.items()) if len(v) >= 2}}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=db.default_target(), help="SQLite path or Postgres URL (default: DUO_DB, DATABASE_URL)")
    ap.add_argument("--out", help="also write the scale to this JSON file")
    ap.add_argument("--gap-table", default="data/rank_gap.json")
    ap.add_argument("--pairs", type=int, default=SAMPLE_PAIRS, help="sampled 组合 wanted per position pair")
    args = ap.parse_args()
    conn = db.connect(args.db)
    scale = fit(conn, predict.load_gap_table(args.gap_table), args.pairs)
    if not scale:
        raise SystemExit("not enough duo-eligible players in the 推荐池 to fit the score")
    save_scale(conn, scale)
    print(json.dumps(scale, indent=2))
    if args.out:
        with open(args.out, "w") as f:
            json.dump(scale, f, indent=2)
