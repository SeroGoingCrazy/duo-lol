"""Deterministic stand-in for the Riot API, for tests and the offline end-to-end run only.

Every number it produces is synthetic. It is used when DUO_FAKE_RIOT=1 and never otherwise.
Riot IDs starting with "Nobody" do not exist; ones starting with "New" have under 20 games.
"""
import hashlib
import os
import random
import time

POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
CHAMPIONS = {
    "TOP": ["Garen", "Darius", "Camille", "Ornn"],
    "JUNGLE": ["LeeSin", "Vi", "Viego", "Amumu"],
    "MIDDLE": ["Ahri", "Syndra", "Yasuo", "Orianna"],
    "BOTTOM": ["Xayah", "Jinx", "Ezreal", "Kaisa"],
    "UTILITY": ["Rakan", "Thresh", "Lulu", "Nautilus"],
}
TIERS = ["SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"]
FETCH_DELAY = float(os.environ.get("DUO_FAKE_DELAY", "0.05"))   # makes the progress bar visible


def _rng(*parts):
    return random.Random(int(hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest(), 16))


def _puuid(name, tag):
    return "fake-" + hashlib.sha1(f"{name.lower()}#{tag.lower()}".encode()).hexdigest()[:16]


class FakeRiotClient:
    def __init__(self):
        self.names = {}

    def _player(self, puuid):
        rng = _rng("player", puuid)
        roles = rng.sample(POSITIONS, 2)
        return {"tier": rng.choice(TIERS), "roles": roles, "skill": rng.uniform(-0.08, 0.08),
                "pool": {r: rng.sample(CHAMPIONS[r], 2) for r in roles}}

    def account_by_riot_id(self, name, tag):
        if name.lower().startswith("nobody"):
            return None
        puuid = _puuid(name, tag)
        self.names[puuid] = (name, tag)
        return {"puuid": puuid, "gameName": name, "tagLine": tag}

    def solo_entry(self, puuid):
        return {"queueType": "RANKED_SOLO_5x5", "tier": self._player(puuid)["tier"], "rank": "II",
                "leaguePoints": 50, "wins": 30, "losses": 28, "puuid": puuid}

    def league_entries(self, tier, division, page=1):
        out = []
        for k in range(6):
            name, tag = f"{tier.title()}{division}P{page}N{k}", "NA1"
            puuid = _puuid(name, tag)
            self.names[puuid] = (name, tag)
            out.append({"puuid": puuid, "tier": self._player(puuid)["tier"], "rank": division,
                        "leaguePoints": 10, "wins": 20, "losses": 20})
        return out

    def season_match_ids(self, puuid, start_time, limit=100):
        name = self.names.get(puuid, ("", ""))[0]
        n = 8 if name.lower().startswith("new") else 40
        return [f"FAKE_{puuid}_{i}" for i in range(min(n, limit))]

    def match(self, match_id):
        time.sleep(FETCH_DELAY)
        _, puuid, idx = match_id.rsplit("_", 2)
        me = self._player(puuid)
        rng = _rng("match", match_id)
        my_role = me["roles"][0] if rng.random() < 0.7 else me["roles"][1]
        my_champ = rng.choice(me["pool"][my_role])
        win = rng.random() < 0.5 + me["skill"]
        name, tag = self.names.get(puuid, ("Someone", "NA1"))
        parts = []
        for team in (100, 200):
            for pos in POSITIONS:
                mine = team == 100 and pos == my_role
                parts.append({
                    "puuid": puuid if mine else f"fake-filler-{rng.randrange(300)}",
                    "riotIdGameName": name if mine else f"Filler{rng.randrange(300)}",
                    "riotIdTagline": tag if mine else "NA1",
                    "teamId": team, "win": win if team == 100 else not win,
                    "teamPosition": pos, "championId": 0,
                    "championName": my_champ if mine else rng.choice(CHAMPIONS[pos]),
                    "kills": 5, "deaths": 5, "assists": 5, "goldEarned": 10000,
                    "totalDamageDealtToChampions": 15000, "totalMinionsKilled": 150,
                    "neutralMinionsKilled": 0, "visionScore": 20,
                })
        return {"metadata": {"matchId": match_id},
                "info": {"queueId": 420, "gameVersion": "15.20", "gameCreation": 1_760_000_000_000 + int(idx),
                         "gameDuration": 1800, "participants": parts}}


def seed(db_path, tiers=("SILVER", "GOLD", "PLATINUM"), players_per_tier=8):
    """Build a synthetic 推荐池 database for the end-to-end run: uv run python data/fake_riot.py PATH"""
    import collect

    class Args:
        db = db_path; matches_per_player = 20; seed = 1; season_start = "2026-01-08"
    Args.tiers, Args.players_per_tier = list(tiers), players_per_tier
    collect.RiotClient = FakeRiotClient
    collect.run(Args)


if __name__ == "__main__":
    import sys
    FETCH_DELAY = 0
    seed(sys.argv[1])
