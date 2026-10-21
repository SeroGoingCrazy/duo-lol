"""换 Key 后的 PUUID 迁移. Riot encrypts PUUIDs per API key: on 2026-10-20 a new key returned a
different PUUID for every stored player, so stored rows stopped matching what the API returns.

check() resolves a few known Riot IDs (usually one request) and compares their PUUIDs with the
ones stored under the current epoch. A mismatch starts a new epoch; migrate() then fetches every
older match once, moves its participants to the new PUUIDs (db.rekey_participants) and carries
seed rows, seed progress and ladder tiers over to them. Both are resumable.
"""
import json
import time

import db

PROBES = 3


def _resolve(client, riot_id):
    name, _, tag = riot_id.rpartition("#")
    acc = client.account_by_riot_id(name, tag) if name and tag else None
    return acc["puuid"] if acc else None


def _stored_probes(conn, latest):
    """[(riot_id, puuid)] as stored under the current epoch: its probes, else the newest seeds."""
    if latest and json.loads(latest[2]):
        return json.loads(latest[2])
    return conn.execute("""SELECT riot_id, puuid FROM players WHERE riot_id IS NOT NULL AND sampled_at IS NOT NULL
                           ORDER BY sampled_at DESC LIMIT 20""").fetchall()


def check(conn, client, log=print):
    """Current epoch row (id, matches_before, probes, done); starts a new one if the key changed."""
    latest = conn.execute("SELECT id, matches_before, probes, done FROM key_epoch ORDER BY id DESC LIMIT 1").fetchone()
    same, fresh = None, []
    for riot_id, puuid in _stored_probes(conn, latest):
        now = _resolve(client, riot_id)
        if now is None:
            continue   # renamed or gone; try the next one
        if same is None:
            same = now == puuid
        fresh.append([riot_id, now])
        if len(fresh) >= PROBES or same:
            break
    if same is None:
        same = True    # nothing to compare against yet (empty database)
    if latest and same:
        return latest
    before = 0 if same else conn.execute(f"SELECT COALESCE(MAX({db.match_order(conn)}), 0) FROM matches").fetchone()[0]
    conn.execute("INSERT INTO key_epoch (probes, matches_before, started_at, done) VALUES (?,?,?,?)",
                 (json.dumps(fresh), before, int(time.time()), int(before == 0)))
    conn.commit()
    if before:
        log(f"[key] this API key sees new PUUIDs; {before} stored matches will be re-keyed")
    return conn.execute("SELECT id, matches_before, probes, done FROM key_epoch ORDER BY id DESC LIMIT 1").fetchone()


def migrate(conn, client, epoch, log=print):
    """Re-key every match stored before the epoch; one request per match, resumes where it stopped."""
    epoch_id, before, _, done = epoch
    if done:
        return
    seq = db.match_order(conn)
    todo = [r[0] for r in conn.execute(
        f"""SELECT match_id FROM matches m WHERE {seq} <= ?
              AND NOT EXISTS (SELECT 1 FROM rekeyed r WHERE r.match_id = m.match_id AND r.epoch = ?)
            ORDER BY {seq}""", (before, epoch_id))]
    log(f"[key] re-keying {len(todo)} matches")
    for i, mid in enumerate(todo, 1):
        old = dict(conn.execute("SELECT champion_name, puuid FROM participants WHERE match_id=?", (mid,)))
        match = client.match(mid)
        if match:
            db.rekey_participants(conn, match)
            for p in match["info"]["participants"]:
                if old.get(p["championName"]) not in (None, p["puuid"]):
                    move_player(conn, old[p["championName"]], p["puuid"])
        conn.execute("INSERT INTO rekeyed VALUES (?,?) ON CONFLICT(match_id) DO UPDATE SET epoch=excluded.epoch",
                     (mid, epoch_id))
        if i % 20 == 0 or i == len(todo):
            conn.commit()
        if i % 500 == 0:
            log(f"[key] re-keyed {i}/{len(todo)}")
    # Ladder rows nobody in our matches carries over can't be mapped; the next --ladder crawl refetches them.
    conn.execute("""DELETE FROM ladder WHERE fetched_at < (SELECT started_at FROM key_epoch WHERE id=?)
                      AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.puuid = ladder.puuid)""", (epoch_id,))
    conn.execute("UPDATE ladder_progress SET done=0, last_page=0")
    conn.execute("UPDATE key_epoch SET done=1 WHERE id=?", (epoch_id,))
    conn.commit()
    log("[key] re-keying done")


def move_player(conn, old, new):
    """Carry one player's rows from their old PUUID to the new one."""
    conn.execute(
        """INSERT INTO players (puuid, riot_id, tier, division, league_points, wins, losses, sampled_at, recommend_opt_in)
           SELECT ?, riot_id, tier, division, league_points, wins, losses, sampled_at, recommend_opt_in
             FROM players WHERE puuid=? AND true
           ON CONFLICT(puuid) DO UPDATE SET
             tier=COALESCE(excluded.tier, players.tier), division=COALESCE(excluded.division, players.division),
             league_points=COALESCE(excluded.league_points, players.league_points),
             wins=COALESCE(excluded.wins, players.wins), losses=COALESCE(excluded.losses, players.losses),
             sampled_at=COALESCE(excluded.sampled_at, players.sampled_at),
             recommend_opt_in=CASE WHEN excluded.recommend_opt_in = 1 THEN 1 ELSE players.recommend_opt_in END""",
        (new, old))
    conn.execute("DELETE FROM players WHERE puuid=?", (old,))
    for table in ("seed_progress", "ladder"):   # the old PUUID's row replaces any under the new one
        conn.execute(f"DELETE FROM {table} WHERE puuid=? AND EXISTS (SELECT 1 FROM {table} WHERE puuid=?)", (new, old))
        conn.execute(f"UPDATE {table} SET puuid=? WHERE puuid=?", (new, old))
    conn.execute("DELETE FROM player_cache WHERE puuid=?", (old,))   # the next lookup refetches it
