"""Offline checks for the Elo model with a hand-made stats source."""
import os
import tempfile

import db
import predict
from elo import elo_to_winrate, shrink, winrate_to_elo
from stats_source import OwnDataSource
from test_collector import fake_match


class FakeSource:
    def __init__(self, champs=None, pairs=None):
        self.champs = champs or {}
        self.pairs = pairs or {}

    def champion(self, champion, position, tier):
        return self.champs.get((champion, position), (0, 0))

    def champion_pair(self, ca, pa, cb, pb):
        return self.pairs.get((ca, pa, cb, pb), (0, 0))


def profile(tier, rows):
    return {"tier": tier, "games": sum(r[2] for r in rows), "insufficient_data": False,
            "champions": [{"champion": c, "position": p, "games": g, "wins": w} for c, p, g, w in rows]}


def test_elo_roundtrip():
    assert abs(winrate_to_elo(0.5)) < 1e-9
    for p in (0.3, 0.52, 0.8):
        assert abs(elo_to_winrate(winrate_to_elo(p)) - p) < 1e-9
    assert shrink(0, 0, 0.5, 10) == 0.5
    assert abs(shrink(10, 10, 0.5, 10) - 0.75) < 1e-9


def test_neutral_pair_is_fifty_percent():
    a = profile("GOLD", [("Ahri", "MIDDLE", 30, 15)])
    b = profile("GOLD", [("LeeSin", "JUNGLE", 30, 15)])
    out = predict.predict_pair(FakeSource(), a, b)
    assert abs(out["win_rate"] - 0.5) < 1e-9
    assert abs(out["win_rate_delta"]) < 1e-9
    assert out["roles"] == {"a": "MIDDLE", "b": "JUNGLE"}
    assert len(out["reasons"]) >= 3


def test_synergy_and_proficiency_raise_win_rate():
    a = profile("GOLD", [("Xayah", "BOTTOM", 40, 26)])
    b = profile("GOLD", [("Rakan", "UTILITY", 40, 22)])
    plain = predict.predict_pair(FakeSource(), a, b)
    synergy = FakeSource(pairs={("Xayah", "BOTTOM", "Rakan", "UTILITY"): (600, 1000)})
    boosted = predict.predict_pair(synergy, a, b)
    assert plain["win_rate"] > 0.5                     # both players win more than average
    assert boosted["win_rate"] > plain["win_rate"]     # 60% pair record adds 组合加成
    assert boosted["top_pairs"][0]["terms"]["synergy"] > 0


def test_role_conflict_picks_other_role():
    a = profile("GOLD", [("Ahri", "MIDDLE", 30, 20), ("Garen", "TOP", 10, 5)])
    b = profile("GOLD", [("Syndra", "MIDDLE", 30, 12), ("Vi", "JUNGLE", 5, 3)])
    out = predict.predict_pair(FakeSource(), a, b)
    assert out["roles"]["a"] != out["roles"]["b"]
    assert out["roles"] == {"a": "MIDDLE", "b": "JUNGLE"}   # A's strong mid beats B's weak mid


def test_rank_gap_table_applies():
    a = profile("SILVER", [("Ahri", "MIDDLE", 30, 15)])
    b = profile("DIAMOND", [("LeeSin", "JUNGLE", 30, 15)])
    out = predict.predict_pair(FakeSource(), a, b, gap_table={4: -30.0})
    assert out["win_rate"] < 0.5
    assert any("相差 4 个大段，对预测胜率的影响约 -4.3 个百分点" in r for r in out["reasons"])
    unfitted = predict.predict_pair(FakeSource(), a, b)
    assert abs(unfitted["win_rate"] - 0.5) < 1e-9
    assert "段位差：相差 4 个大段" in unfitted["reasons"]
    assert all("拟合" not in r for r in unfitted["reasons"])


def test_self_reported_profile_uses_global_rates():
    src = FakeSource(champs={("Ahri", "MIDDLE"): (5500, 10000)})
    a = predict.self_reported_profile("GOLD", [("Ahri", "MIDDLE")])
    b = predict.self_reported_profile("GOLD", [("LeeSin", "JUNGLE")])
    out = predict.predict_pair(src, a, b)
    assert 0.5 < out["win_rate"] < 0.56


def test_own_data_source_counts():
    conn = db.connect(os.path.join(tempfile.mkdtemp(), "s.sqlite"))
    db.save_match(conn, fake_match("NA1_1"), "GOLD")
    src = OwnDataSource(conn)
    assert src.champion("Champ0", "TOP", "GOLD") == (1, 1)
    assert src.champion("Champ5", "TOP", "GOLD") == (0, 1)
    assert src.champion_pair("Champ0", "TOP", "Champ1", "JUNGLE") == (1, 1)
    assert src.champion_pair("Champ0", "TOP", "Champ5", "TOP") == (0, 0)  # different teams


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("all passed")


def test_contribution_points_uses_elo_probability_difference():
    # Elo 400 means 10:1 odds: removing it from a neutral total goes from
    # 50% to 1/11, a +40.9 percentage-point effect. At a total of 800 the
    # same term changes 100/101 to 10/11, only +8.1 percentage points.
    assert predict.contribution_points(0, 400) == "+40.9"
    assert predict.contribution_points(800, 400) == "+8.1"
    assert predict.contribution_points(0, -400) == "-40.9"
    assert predict.contribution_points(0, -0.01) == "+0.0"


def test_reasons_use_percentage_points_and_hide_unsampled_champion_pairs():
    a = profile("GOLD", [("Xayah", "BOTTOM", 40, 26)])
    b = profile("GOLD", [("Rakan", "UTILITY", 40, 22)])
    plain = predict.predict_pair(FakeSource(), a, b)
    assert all(isinstance(reason, str) for reason in plain["reasons"])
    assert any("熟练度：" in reason and "个百分点" in reason for reason in plain["reasons"])
    assert not any(reason.startswith("组合加成：") for reason in plain["reasons"])
    sampled = predict.predict_pair(FakeSource(pairs={
        ("Xayah", "BOTTOM", "Rakan", "UTILITY"): (600, 1000),
    }), a, b)
    assert any("组合加成：" in reason and "个百分点" in reason and "1000 局样本" in reason
               for reason in sampled["reasons"])
