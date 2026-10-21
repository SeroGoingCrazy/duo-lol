"""Held-out check of the 预测胜率 model (PRD §5.1) and fit of the 段位差 table.

    uv run python data/evaluate.py --db lol_duo.sqlite --out data/rank_gap.json

Matches are split by a hash of match_id into train (80%), a fit slice (10%) and an eval
slice (10%). 全服统计 and 英雄熟练度 come only from train; the 段位差 table is fitted on the
fit slice; metrics are reported on the eval slice, so no number is scored on data it saw.
Every 组合 (two teammates) is scored with the champions they actually played. The model
must beat the coin-flip baseline (log loss 0.693) to pass.

A player's tier comes from their seed entry, else from the 天梯快照 (collect.py --ladder);
players in neither fall back to the match's seed tier (gap 0).
"""
import argparse
import hashlib
import json
import math
from collections import defaultdict
from itertools import combinations

from elo import elo_to_winrate, shrink, winrate_to_elo
from predict import TIER_ORDER, champion_score, synergy
import db

FIT_SLICE = range(0, 10)     # hash buckets (of 100) used to fit the 段位差 table
EVAL_SLICE = range(10, 20)   # hash buckets used for the reported metrics
# A tier gap needs this many train 组合 before its correction is used; below it the term stays 0.
MIN_GAP_PAIRS = 200


def bucket(match_id):
    return int(hashlib.sha1(match_id.encode()).hexdigest(), 16) % 100


class CountsSource:
    """In-memory StatsSource over train rows; same interface as stats_source.OwnDataSource."""

    def __init__(self):
        self.champs = defaultdict(lambda: [0, 0])
        self.pairs = defaultdict(lambda: [0, 0])

    def add_team(self, tier, team):
        for p in team:
            c = self.champs[(p["champion"], p["position"], tier)]
            c[0] += p["win"]; c[1] += 1
        for a, b in combinations(team, 2):
            for x, y in ((a, b), (b, a)):
                c = self.pairs[(x["champion"], x["position"], y["champion"], y["position"])]
                c[0] += x["win"]; c[1] += 1

    def champion(self, champion, position, tier):
        return tuple(self.champs.get((champion, position, tier), (0, 0)))

    def champion_pair(self, ca, pa, cb, pb):
        return tuple(self.pairs.get((ca, pa, cb, pb), (0, 0)))


def load_teams(conn):
    """{(match_id, team_id): (seed_tier, [participant dicts])}, Solo/Duo only."""
    teams = defaultdict(list)
    tiers = {}
    rows = conn.execute(
        """SELECT p.match_id, p.team_id, m.seed_tier, p.puuid, p.champion_name, p.position, p.win
           FROM participants p JOIN matches m ON m.match_id = p.match_id
           WHERE m.seed_tier IS NOT NULL AND p.position IS NOT NULL AND p.position <> ''"""
    )
    for mid, team, tier, puuid, champ, pos, win in rows:
        teams[(mid, team)].append({"puuid": puuid, "champion": champ, "position": pos, "win": win})
        tiers[(mid, team)] = tier
    return {k: (tiers[k], v) for k, v in teams.items()}


def player_tiers(conn):
    tiers = dict(conn.execute("SELECT puuid, tier FROM ladder"))
    tiers.update(conn.execute("SELECT puuid, tier FROM players WHERE tier IS NOT NULL"))
    return tiers


def pair_elo(source, record, tier_of, a, b, team_tier, gap_table):
    """Elo for one 组合 with the champions they played; mirrors predict.evaluate_assignment."""
    ta, tb = tier_of.get(a["puuid"], team_tier), tier_of.get(b["puuid"], team_tier)
    ca = {"champion": a["champion"], "position": a["position"], **record(a)}
    cb = {"champion": b["champion"], "position": b["position"], **record(b)}
    # 全服统计 are counted per seed tier, so champions are looked up at the team's seed tier;
    # the players' own tiers only set the 段位差.
    syn, _ = synergy(source, team_tier, ca, team_tier, cb)
    gap = abs(TIER_ORDER.index(ta) - TIER_ORDER.index(tb))
    return (champion_score(source, team_tier, ca) + champion_score(source, team_tier, cb) + syn
            + gap_table.get(gap, 0.0)), gap


def run(conn, gap_table=None):
    teams = load_teams(conn)
    tier_of = player_tiers(conn)
    source, history = CountsSource(), defaultdict(lambda: [0, 0])
    fit, held_out = [], []
    for (mid, _), (tier, team) in teams.items():
        b = bucket(mid)
        if b in FIT_SLICE:
            fit.append((tier, team))
            continue
        if b in EVAL_SLICE:
            held_out.append((tier, team))
            continue
        source.add_team(tier, team)
        for p in team:
            h = history[(p["puuid"], p["champion"], p["position"])]
            h[0] += p["win"]; h[1] += 1

    def record(p):
        wins, games = history.get((p["puuid"], p["champion"], p["position"]), (0, 0))
        return {"wins": wins, "games": games}

    def pairs(slice_, table):
        for tier, team in slice_:
            for a, b in combinations(team, 2):
                elo, gap = pair_elo(source, record, tier_of, a, b, tier, table)
                yield elo_to_winrate(elo), a["win"], gap

    if gap_table is None:
        residuals = defaultdict(lambda: [0.0, 0])   # gap -> [sum(win - p), count]
        for p, y, gap in pairs(fit, {}):
            r = residuals[gap]; r[0] += y - p; r[1] += 1
        gap_table = fit_gap_table(residuals)
    else:
        residuals = {}

    loss = brier = correct = n = 0
    for p, y, _ in pairs(held_out, gap_table):
        loss -= math.log(p if y else 1 - p)
        brier += (p - y) ** 2
        correct += (p > 0.5) == bool(y)
        n += 1
    if n == 0:
        return {"pairs": 0, "gap_table": gap_table}
    return {
        "pairs": n,
        "log_loss": loss / n, "baseline_log_loss": math.log(2),
        "brier": brier / n, "baseline_brier": 0.25,
        "accuracy": correct / n,
        "gap_fit_samples": {g: c for g, (_, c) in sorted(residuals.items())},
        "gap_table": gap_table,
    }


def fit_gap_table(residuals):
    """段位差 correction per tier gap: mean win-rate residual at that gap, as Elo around 50%."""
    table = {}
    for gap, (total, count) in residuals.items():
        if gap > 0 and count >= MIN_GAP_PAIRS:
            table[gap] = winrate_to_elo(0.5 + total / count)
    return table


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=db.default_target(), help="SQLite path or Postgres URL (default: DUO_DB, DATABASE_URL)")
    ap.add_argument("--out", help="write the fitted 段位差 table here as JSON")
    args = ap.parse_args()
    conn = db.connect(args.db)
    result = run(conn)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    table = result["gap_table"]
    if not table:
        print(f"段位差 not fitted: no tier gap has {MIN_GAP_PAIRS}+ 组合 in the fit slice")
    if args.out:
        with open(args.out, "w") as f:
            json.dump({str(k): v for k, v in table.items()}, f, indent=2)
