"""SQLite → Postgres copy (to_postgres.py); needs DUO_TEST_DATABASE_URL."""
import os
import sqlite3
import tempfile

import pytest

import db
import key_epoch
import to_postgres
from test_collector import fake_match


def sqlite_db():
    path = os.path.join(tempfile.mkdtemp(), "src.sqlite")
    conn = sqlite3.connect(path)
    conn.executescript(db.SCHEMA)
    for mid in ("NA1_3", "NA1_1", "NA1_2"):   # stored out of id order on purpose
        db.save_match(conn, fake_match(mid), "GOLD")
    conn.execute("INSERT INTO key_epoch (probes, matches_before, started_at) VALUES ('[]', 2, 5)")
    conn.execute("INSERT INTO seed_progress VALUES ('p0', 40)")
    conn.commit()
    conn.close()
    return path


def test_copy_keeps_rows_and_order(pg_url):
    counts = to_postgres.copy(sqlite_db(), pg_url, log=lambda *_: None)
    assert counts["matches"] == 3 and counts["participants"] == 30 and counts["seed_progress"] == 1
    pg = db.connect(pg_url)
    assert [r[0] for r in pg.execute("SELECT match_id FROM matches ORDER BY seq")] == ["NA1_3", "NA1_1", "NA1_2"]
    # re-keying resumes on the same matches the SQLite rowids named
    assert [r[0] for r in pg.execute("SELECT match_id FROM matches WHERE seq <= 2 ORDER BY seq")] == ["NA1_3", "NA1_1"]
    # new rows continue after the copied ones
    db.save_match(pg, fake_match("NA1_9"), "GOLD")
    assert pg.execute("SELECT seq FROM matches WHERE match_id='NA1_9'").fetchone() == (4,)
    pg.execute("INSERT INTO key_epoch (probes, matches_before, started_at) VALUES ('[]', 0, 6)")
    assert pg.execute("SELECT MAX(id) FROM key_epoch").fetchone() == (2,)
    assert key_epoch.check(pg, None)[0] == 2
    pg.commit()


def test_copy_refuses_to_overwrite(pg_url):
    to_postgres.copy(sqlite_db(), pg_url, log=lambda *_: None)
    with pytest.raises(SystemExit):
        to_postgres.copy(sqlite_db(), pg_url, log=lambda *_: None)
