"""SQLite storage. One row per match and per participant; pairs (同队任意两人, ADR-0002)
and champion proficiency (本赛季单双排用某英雄的局数和胜率) are derived from participants."""
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    puuid TEXT PRIMARY KEY,
    riot_id TEXT,              -- gameName#tagLine, filled from match data
    tier TEXT, division TEXT, league_points INTEGER,
    wins INTEGER, losses INTEGER,
    sampled_at INTEGER,
    recommend_opt_in INTEGER NOT NULL DEFAULT 0  -- PRD §7: only opted-in players join the pool at launch
);
CREATE TABLE IF NOT EXISTS matches (
    match_id TEXT PRIMARY KEY,
    seed_tier TEXT,            -- stratum the match was sampled from
    game_version TEXT,
    game_creation INTEGER, game_duration INTEGER
);
CREATE TABLE IF NOT EXISTS participants (
    match_id TEXT, puuid TEXT, team_id INTEGER, win INTEGER,
    position TEXT, champion_id INTEGER, champion_name TEXT,
    kills INTEGER, deaths INTEGER, assists INTEGER,
    gold INTEGER, damage INTEGER, cs INTEGER, vision INTEGER,
    PRIMARY KEY (match_id, puuid)
);
CREATE INDEX IF NOT EXISTS idx_part_puuid ON participants(puuid);
"""


def connect(path):
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def has_match(conn, match_id):
    return conn.execute("SELECT 1 FROM matches WHERE match_id=?", (match_id,)).fetchone() is not None


def save_player(conn, entry, now):
    conn.execute(
        """INSERT INTO players (puuid, tier, division, league_points, wins, losses, sampled_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(puuid) DO UPDATE SET tier=excluded.tier, division=excluded.division,
             league_points=excluded.league_points, wins=excluded.wins, losses=excluded.losses,
             sampled_at=excluded.sampled_at""",
        (entry["puuid"], entry["tier"], entry["rank"], entry["leaguePoints"],
         entry["wins"], entry["losses"], now),
    )


def save_match(conn, match, seed_tier):
    info = match["info"]
    if info.get("queueId") != 420:
        return False
    conn.execute(
        "INSERT OR IGNORE INTO matches VALUES (?,?,?,?,?)",
        (match["metadata"]["matchId"], seed_tier, info.get("gameVersion"),
         info.get("gameCreation"), info.get("gameDuration")),
    )
    for p in info["participants"]:
        conn.execute(
            "INSERT OR IGNORE INTO participants VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (match["metadata"]["matchId"], p["puuid"], p["teamId"], int(p["win"]),
             p.get("teamPosition") or p.get("individualPosition"), p["championId"], p["championName"],
             p["kills"], p["deaths"], p["assists"], p["goldEarned"],
             p["totalDamageDealtToChampions"],
             p["totalMinionsKilled"] + p.get("neutralMinionsKilled", 0), p["visionScore"]),
        )
        if p.get("riotIdGameName"):
            conn.execute(
                "INSERT INTO players (puuid, riot_id) VALUES (?, ?) ON CONFLICT(puuid) DO UPDATE SET riot_id=excluded.riot_id",
                (p["puuid"], f'{p["riotIdGameName"]}#{p.get("riotIdTagline", "")}'),
            )
    return True


PARTY_HINTS = ("party", "premade", "group", "duo")


def party_fields(match):
    """Participant keys that might expose premade info (ADR-0002 assumes none exist)."""
    keys = set()
    for p in match["info"]["participants"]:
        keys |= {k for k in p if any(h in k.lower() for h in PARTY_HINTS)}
    return sorted(keys)
