"""搭配评分 (0-100): where a 预测胜率 falls among the 预测胜率 of real 组合.

    uv run python data/score_scale.py --db lol_duo.sqlite --out data/score_scale.json

预测胜率 cluster tightly around 50%, so 50.4% vs 50.0% is easy to misread as "nothing".
The score is the percentile of a 预测胜率 under a normal distribution fitted to the 预测胜率
the site itself would show for pairs of players in the 推荐池 who are allowed to duo:
score = 100 × Φ((win_rate − mean) / std). A score of 50 is a typical 组合, 84 is one std better.
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
from stats_source import CachedSource, OwnDataSource

SAMPLE_PAIRS = 300   # how many duo-eligible pool pairs to predict; more only tightens the estimate


def load_scale(path):
    """{"mean", "std", ...} written by this script; None if missing or unusable."""
    try:
        with open(path) as f:
            scale = json.load(f)
    except (FileNotFoundError, ValueError):
        return None
    return scale if scale.get("std", 0) > 0 else None


def duo_score(win_rate, scale):
    """搭配评分: 0-100 percentile of win_rate under the fitted normal distribution; None if no scale."""
    if not scale:
        return None
    z = (win_rate - scale["mean"]) / scale["std"]
    return round(100 * 0.5 * (1 + math.erf(z / math.sqrt(2))))


def fit(conn, gap_table=None, sample_pairs=SAMPLE_PAIRS, seed=0):
    source = CachedSource(OwnDataSource(conn))
    players = []
    for puuid, riot_id, rank, ids in recommend.candidate_pool(conn):
        profile = player_profile.proficiency(conn, puuid, ids)
        if not profile["insufficient_data"]:
            profile["tier"] = rank[0]
            players.append((rank, profile))
    eligible = [(a, b) for a, b in combinations(range(len(players)), 2)
                if recommend.can_duo(players[a][0], players[b][0])]
    random.Random(seed).shuffle(eligible)
    rates = []
    for a, b in eligible[:sample_pairs]:
        out = predict.predict_pair(source, players[a][1], players[b][1], gap_table)
        if out:
            rates.append(out["win_rate"])
    if len(rates) < 2:
        return None
    return {"mean": statistics.fmean(rates), "std": statistics.stdev(rates), "pairs": len(rates),
            "fitted_at": int(time.time())}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="lol_duo.sqlite")
    ap.add_argument("--out", default="data/score_scale.json")
    ap.add_argument("--gap-table", default="data/rank_gap.json")
    ap.add_argument("--pairs", type=int, default=SAMPLE_PAIRS)
    args = ap.parse_args()
    scale = fit(db.connect(args.db), predict.load_gap_table(args.gap_table), args.pairs)
    if not scale:
        raise SystemExit("not enough duo-eligible players in the 推荐池 to fit the score")
    print(json.dumps(scale, indent=2))
    with open(args.out, "w") as f:
        json.dump(scale, f, indent=2)
