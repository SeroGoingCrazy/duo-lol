"""Offline check of parsing and storage with a fake Riot API (no network, no key)."""
import os
import tempfile

os.environ.setdefault("RIOT_API_KEY", "test")

import collect
import db
from riot import RateLimiter


def fake_match(mid, queue=420):
    parts = []
    for i in range(10):
        parts.append({
            "puuid": f"p{i}", "teamId": 100 if i < 5 else 200, "win": i < 5,
            "teamPosition": ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][i % 5],
            "championId": i + 1, "championName": f"Champ{i}", "kills": 1, "deaths": 2, "assists": 3,
            "goldEarned": 10000, "totalDamageDealtToChampions": 20000, "totalMinionsKilled": 150,
            "neutralMinionsKilled": 10, "visionScore": 20,
            "riotIdGameName": f"Name{i}", "riotIdTagline": "NA1",
        })
    return {"metadata": {"matchId": mid}, "info": {"queueId": queue, "gameVersion": "15.20",
            "gameCreation": 0, "gameDuration": 1800, "participants": parts}}


class FakeClient:
    def __init__(self):
        self.calls = 0

    def league_entries(self, tier, div, page=1):
        return [{"puuid": f"{tier}-{div}-{k}", "tier": tier, "rank": div, "leaguePoints": 10,
                 "wins": 10, "losses": 9} for k in range(3)]

    def season_match_ids(self, puuid, start_time, limit=100):
        assert start_time > 0
        return ["NA1_1", "NA1_2", "NA1_ARAM"]

    def match(self, mid):
        self.calls += 1
        return fake_match(mid, queue=450 if mid.endswith("ARAM") else 420)


def test_end_to_end(monkeypatch=None):
    path = os.path.join(tempfile.mkdtemp(), "t.sqlite")
    fake = FakeClient()
    collect.RiotClient = lambda: fake

    class A:
        db = path; tiers = ["GOLD", "DIAMOND"]; players_per_tier = 4
        matches_per_player = 3; seed = 1
        season_start = "2026-01-08"
    collect.run(A)
    conn = db.connect(path)
    assert conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 2      # ARAM dropped, dupes skipped
    assert conn.execute("SELECT COUNT(*) FROM participants").fetchone()[0] == 20
    assert conn.execute("SELECT COUNT(*) FROM players").fetchone()[0] == 8 + 10   # seeds + teammates
    assert conn.execute("SELECT riot_id FROM players WHERE puuid='p3'").fetchone()[0] == "Name3#NA1"
    assert conn.execute("SELECT SUM(recommend_opt_in) FROM players").fetchone()[0] == 0
    pairs = conn.execute("""SELECT COUNT(*) FROM participants a JOIN participants b
        ON a.match_id=b.match_id AND a.team_id=b.team_id AND a.puuid<b.puuid""").fetchone()[0]
    assert pairs == 2 * 2 * 10   # 10 teammate pairs per team
    print("ok")


def test_profile_insufficient_data():
    import player_profile as prof
    path = os.path.join(tempfile.mkdtemp(), "p.sqlite")
    conn = db.connect(path)
    fake = FakeClient()
    ids = [f"NA1_{k}" for k in range(25)]
    fake.season_match_ids = lambda puuid, start_time, limit=100: ids[:limit]
    out = prof.fetch_profile(conn, fake, "p0")
    assert out["games"] == 25 and not out["insufficient_data"]
    assert out["champions"][0] == {"champion": "Champ0", "position": "TOP", "games": 25, "wins": 25}
    assert prof.proficiency(conn, "p0", ids[:19])["insufficient_data"]


def test_party_fields():
    m = fake_match("x")
    assert db.party_fields(m) == []
    m["info"]["participants"][0]["partyId"] = 7
    assert db.party_fields(m) == ["partyId"]


def test_rate_limiter_blocks():
    import time
    rl = RateLimiter(limits=((3, 0.3),))
    t0 = time.monotonic()
    for _ in range(4):
        rl.wait()
    assert time.monotonic() - t0 >= 0.25


if __name__ == "__main__":
    test_end_to_end()
    test_profile_insufficient_data()
    test_party_fields()
    test_rate_limiter_blocks()
    print("all passed")
