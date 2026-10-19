"""全服统计 behind one interface so OP.GG and our own Riot data are interchangeable (ADR-0003).

The model only ever calls a StatsSource; it never knows where the numbers came from.
"""
from typing import Protocol


class StatsSource(Protocol):
    def champion(self, champion, position, tier):
        """(wins, games) for a champion in a position at a tier, Solo/Duo only."""

    def champion_pair(self, champ_a, pos_a, champ_b, pos_b):
        """(wins, games) for a 英雄组合 on the same team, all tiers (PRD §3)."""


class OwnDataSource:
    """全服统计 computed from the matches the collector stored (SQLite)."""

    def __init__(self, conn):
        self.conn = conn

    def champion(self, champion, position, tier):
        row = self.conn.execute(
            """SELECT COALESCE(SUM(p.win), 0), COUNT(*)
               FROM participants p JOIN matches m ON m.match_id = p.match_id
               WHERE p.champion_name=? AND p.position=? AND m.seed_tier=?""",
            (champion, position, tier),
        ).fetchone()
        return row[0], row[1]

    def champion_pair(self, champ_a, pos_a, champ_b, pos_b):
        row = self.conn.execute(
            """SELECT COALESCE(SUM(a.win), 0), COUNT(*)
               FROM participants a JOIN participants b
                 ON a.match_id=b.match_id AND a.team_id=b.team_id AND a.puuid<>b.puuid
               WHERE a.champion_name=? AND a.position=? AND b.champion_name=? AND b.position=?""",
            (champ_a, pos_a, champ_b, pos_b),
        ).fetchone()
        return row[0], row[1]
