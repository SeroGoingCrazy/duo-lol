"""API, lookup cache and 找搭子 against the synthetic FakeRiotClient (no network)."""
import os
import tempfile
import time

import pytest

DB = os.path.join(tempfile.mkdtemp(), "api.sqlite")
os.environ["DUO_DB"] = DB
os.environ["DUO_FAKE_RIOT"] = "1"
os.environ.setdefault("RIOT_API_KEY", "test")

import api  # noqa: E402
import collect  # noqa: E402
import db  # noqa: E402
import fake_riot  # noqa: E402
import recommend  # noqa: E402
import score_scale  # noqa: E402
import service  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

fake_riot.FETCH_DELAY = 0
api.DB_PATH = DB


@pytest.fixture(scope="module")
def client():
    collect.RiotClient = fake_riot.FakeRiotClient

    class Args:
        db = DB; tiers = ["GOLD", "PLATINUM"]; players_per_tier = 8
        matches_per_player = 20; seed = 1; season_start = "2026-01-08"
    collect.run(Args)
    return TestClient(api.app)


def lookup(client, riot_id):
    started = client.post("/api/lookups", json={"riot_id": riot_id}).json()
    job = started["job_id"]
    if job is None:   # already cached
        return {"status": "done", "player": started["player"]}
    for _ in range(200):
        status = client.get(f"/api/lookups/{job}").json()
        if status["status"] != "running":
            return status
        time.sleep(0.02)
    raise AssertionError("lookup did not finish")


def test_lookup_then_cached(client):
    assert client.get("/api/players/Alpha%23NA1").status_code == 404
    status = lookup(client, "Alpha#NA1")
    assert status["status"] == "done" and status["done"] == status["total"] == 40
    t0 = time.monotonic()
    cached = client.get("/api/players/alpha%23na1")
    assert cached.status_code == 200 and time.monotonic() - t0 < 10   # PRD §5.2
    assert cached.json()["games"] == 40


def test_cache_key_ignores_case_and_spacing(client):
    lookup(client, "Alpha#NA1")
    assert client.get("/api/players/ALPHA%20%23%20na1").status_code == 200


def test_duplicate_lookup_joins_running_job(client):
    fake_riot.FETCH_DELAY = 0.01
    try:
        first = client.post("/api/lookups", json={"riot_id": "Delta#NA1"}).json()["job_id"]
        second = client.post("/api/lookups", json={"riot_id": "delta #NA1"}).json()["job_id"]
        assert first == second
    finally:
        fake_riot.FETCH_DELAY = 0
    lookup(client, "Delta#NA1")


def test_unknown_player_and_bad_id(client):
    assert lookup(client, "Nobody#NA1")["status"] == "error"
    assert client.post("/api/lookups", json={"riot_id": "no-tag"}).status_code == 400


def test_pair_result_has_prd_fields(client):
    lookup(client, "Alpha#NA1"); lookup(client, "Bravo#NA1")
    out = client.post("/api/pair", json={"a": "Alpha#NA1", "b": "Bravo#NA1"}).json()
    assert 0 < out["win_rate"] < 1
    assert out["roles"]["a"] != out["roles"]["b"]
    assert 1 <= len(out["top_pairs"]) <= 3
    assert len(out["reasons"]) >= 3


def test_pair_needs_lookup_first(client):
    assert client.post("/api/pair", json={"a": "Ghost#NA1", "b": "Alpha#NA1"}).status_code == 409


def test_insufficient_data_falls_back_to_self_report(client):
    lookup(client, "Newbie#NA1"); lookup(client, "Alpha#NA1")
    r = client.post("/api/pair", json={"a": "Newbie#NA1", "b": "Alpha#NA1"})
    assert r.status_code == 422 and r.json()["detail"]["insufficient_data"] == "Newbie#NA1"
    picks = [{"champion": "Ahri", "position": "MIDDLE"}, {"champion": "Garen", "position": "TOP"}]
    r = client.post("/api/pair", json={"a": "Newbie#NA1", "b": "Alpha#NA1",
                                       "a_self_report": {"picks": picks}})
    assert r.status_code == 200
    assert any("自选英雄" in n for n in r.json()["notes"])
    r = client.post("/api/pair", json={"a": "Newbie#NA1", "b": "Alpha#NA1",
                                       "a_self_report": {"tier": "gold", "picks": picks}})
    assert r.status_code == 200   # the fake Newbie is ranked, so its own tier wins
    too_many_roles = picks + [{"champion": "Jinx", "position": "BOTTOM"}]
    r = client.post("/api/pair", json={"a": "Newbie#NA1", "b": "Alpha#NA1",
                                       "a_self_report": {"picks": too_many_roles}})
    assert r.status_code == 400


def test_recommendations_top5_duo_eligible(client):
    lookup(client, "Alpha#NA1")
    out = client.get("/api/recommendations/Alpha%23NA1").json()
    me = (out["me"]["tier"], out["me"]["division"], out["me"]["league_points"])
    with db.connect(DB) as conn:
        ranks = {riot_id: rank for _, riot_id, rank, _ in recommend.candidate_pool(conn)}
    assert 0 < len(out["partners"]) <= 5
    rates = [p["win_rate"] for p in out["partners"]]
    assert rates == sorted(rates, reverse=True)
    for p in out["partners"]:
        assert recommend.can_duo(me, ranks[p["riot_id"]])
        assert p["riot_id"] != out["me"]["riot_id"]
        assert set(p) == {"riot_id", "tier", "division", "win_rate", "win_rate_delta", "score", "roles",
                          "top_pairs", "reasons"}
        assert 1 <= len(p["top_pairs"]) <= 3


def test_cached_lookup_answers_without_a_job(client):
    lookup(client, "Alpha#NA1")
    out = client.post("/api/lookups", json={"riot_id": "alpha#na1"}).json()
    assert out["job_id"] is None and out["player"]["games"] == 40


def test_same_player_twice_is_rejected(client):
    lookup(client, "Alpha#NA1")
    r = client.post("/api/pair", json={"a": "Alpha#NA1", "b": "ALPHA #na1"})
    assert r.status_code == 400 and "同一个玩家" in r.json()["detail"]


def test_find_partners_with_self_report(client):
    lookup(client, "NewTwo#NA1")   # a fake Gold player, so the Gold/Platinum pool can duo
    assert client.post("/api/recommendations", json={"riot_id": "NewTwo#NA1"}).status_code == 422
    picks = [{"champion": "Ahri", "position": "MIDDLE"}]
    out = client.post("/api/recommendations", json={"riot_id": "NewTwo#NA1", "self_report": {"picks": picks}}).json()
    assert out["partners"] and any("自选英雄" in n for n in out["notes"])


def test_score_follows_fitted_normal(client):
    with db.connect(DB) as conn:
        scale = score_scale.fit(conn)
    assert scale and scale["pairs"] >= 2 and scale["std"] > 0
    assert score_scale.duo_score(scale["mean"], scale) == 50
    assert score_scale.duo_score(scale["mean"] + scale["std"], scale) == 84
    assert score_scale.duo_score(0.9, scale) <= 100 and score_scale.duo_score(0.1, scale) >= 0
    assert score_scale.duo_score(0.5, None) is None
    api.scale = scale
    try:
        lookup(client, "Alpha#NA1"); lookup(client, "Bravo#NA1")
        out = client.post("/api/pair", json={"a": "Alpha#NA1", "b": "Bravo#NA1"}).json()
        assert out["score"] == score_scale.duo_score(out["win_rate"], scale)
    finally:
        api.scale = None


@pytest.mark.parametrize("a, b, ok", [
    (("IRON", "IV", 0), ("SILVER", "I", 0), True),
    (("BRONZE", "I", 0), ("GOLD", "IV", 0), False),
    (("SILVER", "II", 0), ("GOLD", "I", 0), True),
    (("SILVER", "I", 0), ("PLATINUM", "IV", 0), False),
    (("GOLD", "IV", 0), ("PLATINUM", "I", 0), True),
    (("PLATINUM", "IV", 0), ("EMERALD", "I", 0), True),
    (("EMERALD", "I", 0), ("DIAMOND", "III", 0), True),
    (("EMERALD", "IV", 0), ("DIAMOND", "III", 0), False),   # Diamond III only takes Emerald II+
    (("EMERALD", "II", 0), ("DIAMOND", "III", 0), True),
    (("EMERALD", "II", 0), ("DIAMOND", "II", 0), False),    # Emerald's range stops at Diamond III
    (("DIAMOND", "IV", 0), ("DIAMOND", "II", 0), True),
    (("DIAMOND", "II", 0), ("DIAMOND", "I", 0), False),     # Diamond II's range stops at Diamond II
    (("DIAMOND", "I", 0), ("DIAMOND", "III", 0), False),    # Diamond III's row stops at Diamond II
    (("DIAMOND", "I", 0), ("MASTER", "I", None), False),    # unknown LP never qualifies
    (("DIAMOND", "I", 0), ("MASTER", "I", 150), True),
    (("DIAMOND", "I", 0), ("MASTER", "I", 250), False),
    (("DIAMOND", "II", 0), ("MASTER", "I", 50), False),
    (("MASTER", "I", 100), ("MASTER", "I", 450), True),
    (("MASTER", "I", 100), ("MASTER", "I", 600), False),
    (("GRANDMASTER", "I", 600), ("MASTER", "I", 500), False),
    (("CHALLENGER", "I", 1200), ("CHALLENGER", "I", 1100), False),
])
def test_can_duo_follows_riot_table(a, b, ok):
    assert recommend.can_duo(a, b) is ok
    assert recommend.can_duo(b, a) is ok


def test_opt_in_pool_is_empty_until_players_opt_in(client):
    with db.connect(DB) as conn:
        assert recommend.candidate_pool(conn, require_opt_in=True) == []


def test_normalize_tier():
    assert service.normalize_tier(" gold ") == "GOLD"
    with pytest.raises(ValueError):
        service.normalize_tier("UNRANKED")


def test_parse_riot_id():
    assert service.parse_riot_id(" Faker#KR1 ") == ("Faker", "KR1")
    assert service.parse_riot_id("a#b#NA1") == ("a#b", "NA1")
    with pytest.raises(ValueError):
        service.parse_riot_id("Faker")
