"""One-time copy of the collector's SQLite database into Postgres (Neon), for the switch to Postgres.

    uv run python data/to_postgres.py lol_duo.sqlite              # into DATABASE_URL from .env
    uv run python data/to_postgres.py lol_duo.sqlite --to postgresql://...

Stop the scheduled collection first, so nothing writes the SQLite file meanwhile. Refuses to run if
the Postgres tables already hold data. Matches keep the order they were stored in (SQLite's rowid
becomes seq), so an unfinished re-key after a key change (key_epoch.py) resumes where it stopped.
"""
import argparse
import os
import sqlite3
import sys
from pathlib import Path

import db

def copy(src, dst, log=print):
    """Copy every table from the SQLite file src into the Postgres URL dst; returns {table: rows}."""
    lite = sqlite3.connect(Path(src).resolve().as_uri() + "?mode=ro", uri=True)
    pg = db.connect(dst)
    try:
        full = [t for t in db.TABLES if pg.execute(f"SELECT 1 FROM {t} LIMIT 1").fetchone()]
        if full:
            raise SystemExit(f"Postgres already has data in {', '.join(full)}; not copying over it")
        counts = {}
        for table in db.TABLES:
            cols = [r[1] for r in lite.execute(f"PRAGMA table_info({table})")]
            if not cols:   # made before this table existed
                continue
            select = cols + (["rowid"] if table == "matches" else [])
            insert = cols + (["seq"] if table == "matches" else [])
            n = 0
            with pg.raw.cursor().copy(f"COPY {table} ({', '.join(insert)}) FROM STDIN") as out:
                for row in lite.execute(f"SELECT {', '.join(select)} FROM {table}"):
                    out.write_row(row)
                    n += 1
            counts[table] = n
            log(f"{table}: {n} rows")
        # Rows came with their own seq / id; new ones continue after them.
        for table, col in (("matches", "seq"), ("key_epoch", "id")):
            pg.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), COALESCE(MAX({col}), 0) + 1, false)"
                       f" FROM {table}")
        pg.commit()
        return counts
    finally:
        lite.close()
        pg.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("sqlite", help="the collector's SQLite file")
    ap.add_argument("--to", help="Postgres URL (default: DATABASE_URL from .env)")
    args = ap.parse_args()
    db.default_target()   # loads .env
    dst = args.to or os.environ.get("DATABASE_URL")
    if not dst or not db.is_url(dst):
        sys.exit("Set DATABASE_URL in .env to the Neon connection string, or pass --to")
    if not os.path.exists(args.sqlite):
        sys.exit(f"{args.sqlite} not found")
    copy(args.sqlite, dst)
    print("done; the collector and API now use Postgres when DATABASE_URL is set")
