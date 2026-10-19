"""Held-out evaluation on synthetic matches where one champion is truly stronger."""
import os
import random
import tempfile

import db
import evaluate
from test_collector import fake_match

POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]


def synthetic_db(n_matches=600, seed=3):
    rng = random.Random(seed)
    conn = db.connect(os.path.join(tempfile.mkdtemp(), "e.sqlite"))
    for k in range(n_matches):
        m = fake_match(f"NA1_{k}")
        strong_blue = rng.random() < 0.5
        blue_wins = rng.random() < (0.7 if strong_blue else 0.3)
        for i, p in enumerate(m["info"]["participants"]):
            blue = i < 5
            p["puuid"] = f"p{rng.randrange(400)}"
            p["teamPosition"] = POSITIONS[i % 5]
            strong = (blue == strong_blue) and i % 5 == 2
            p["championName"] = "Strong" if strong else f"Filler{rng.randrange(5)}"
            p["win"] = blue_wins if blue else not blue_wins
        db.save_match(conn, m, "GOLD")
    conn.commit()
    return conn


def test_model_beats_coin_flip_on_held_out_matches():
    out = evaluate.run(synthetic_db())
    assert out["pairs"] > 0
    assert out["log_loss"] < out["baseline_log_loss"]
    assert out["accuracy"] > 0.5   # only 4 of 10 组合 per team include the strong champion


def test_gap_table_needs_enough_samples():
    assert evaluate.fit_gap_table({0: [5.0, 1000], 1: [10.0, 50]}) == {}
    table = evaluate.fit_gap_table({2: [-20.0, 400]})
    assert list(table) == [2] and table[2] < 0


def test_split_is_stable():
    assert evaluate.bucket("NA1_123") == evaluate.bucket("NA1_123")


def test_gap_table_roundtrip():
    import json
    import predict
    path = os.path.join(tempfile.mkdtemp(), "gap.json")
    assert predict.load_gap_table(path) == {}
    with open(path, "w") as f:
        json.dump({"2": -12.5}, f)
    assert predict.load_gap_table(path) == {2: -12.5}
