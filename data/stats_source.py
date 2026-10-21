"""全服统计 behind one interface so OP.GG and our own Riot data are interchangeable (ADR-0003).

The model only ever calls a StatsSource; it never knows where the numbers came from.
"""
from typing import Protocol

import db


class StatsSource(Protocol):
    def champion(self, champion, position, tier):
        """(wins, games) for a champion in a position at a tier, Solo/Duo only."""

    def champion_pair(self, champ_a, pos_a, champ_b, pos_b):
        """(wins, games) for a 英雄组合 on the same team, all tiers (PRD §3)."""


class OwnDataSource:
    """全服统计 computed from the matches the collector stored."""

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
        # In SQLite the unary + keeps the planner from also using idx_part_champ for b; b is found by
        # match_id instead, which turns a ~5 s scan into ~15 ms on the collected data. Postgres has
        # no + for text and plans this join well on its own.
        plus = "" if db.is_postgres(self.conn) else "+"
        row = self.conn.execute(
            f"""SELECT COALESCE(SUM(a.win), 0), COUNT(*)
                FROM participants a JOIN participants b
                  ON a.match_id=b.match_id AND a.team_id=b.team_id AND a.puuid<>b.puuid
                WHERE a.champion_name=? AND a.position=? AND {plus}b.champion_name=? AND {plus}b.position=?""",
            (champ_a, pos_a, champ_b, pos_b),
        ).fetchone()
        return row[0], row[1]


class CachedSource:
    """Memoizes any StatsSource; one result page or 推荐池 scan repeats the same lookups."""

    def __init__(self, inner):
        self.inner = inner
        self.memo = {}

    def champion(self, champion, position, tier):
        key = ("c", champion, position, tier)
        if key not in self.memo:
            self.memo[key] = self.inner.champion(champion, position, tier)
        return self.memo[key]

    def champion_pair(self, champ_a, pos_a, champ_b, pos_b):
        key = ("p", champ_a, pos_a, champ_b, pos_b)
        if key not in self.memo:
            self.memo[key] = self.inner.champion_pair(champ_a, pos_a, champ_b, pos_b)
        return self.memo[key]
