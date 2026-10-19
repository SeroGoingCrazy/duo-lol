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
    job = client.post("/api/lookups", json={"riot_id": riot_id}).json()["job_id"]
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
    me_tier = out["me"]["tier"]
    assert 0 < len(out["partners"]) <= 5
    rates = [p["win_rate"] for p in out["partners"]]
    assert rates == sorted(rates, reverse=True)
    for p in out["partners"]:
        assert recommend.can_duo(me_tier, p["tier"])
        assert p["riot_id"] != out["me"]["riot_id"]
        assert set(p) == {"riot_id", "tier", "win_rate", "win_rate_delta", "roles", "reasons"}


def test_can_duo_rule():
    assert recommend.can_duo("GOLD", "PLATINUM")
    assert not recommend.can_duo("SILVER", "PLATINUM")
    assert not recommend.can_duo("DIAMOND", "MASTER")
    assert recommend.can_duo("MASTER", "GRANDMASTER")


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
