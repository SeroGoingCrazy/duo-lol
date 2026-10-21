"""With DUO_TEST_DATABASE_URL set, every test runs on Postgres instead of SQLite: each SQLite path a test
opens becomes its own empty Postgres schema. CI runs the suite both ways.

    DUO_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres uv run pytest
"""
import itertools
import os
from urllib.parse import quote

import pytest

import db

PG = os.environ.get("DUO_TEST_DATABASE_URL")
_ids = itertools.count()


def fresh_schema_url():
    """URL of a new, empty schema in the test Postgres."""
    import psycopg
    name = f"t{os.getpid()}_{next(_ids)}"
    with psycopg.connect(PG, autocommit=True) as admin:
        admin.execute(f"DROP SCHEMA IF EXISTS {name} CASCADE")
        admin.execute(f"CREATE SCHEMA {name}")
    sep = "&" if "?" in PG else "?"
    return f"{PG}{sep}options={quote(f'-csearch_path={name}')}"


@pytest.fixture
def pg_url():
    if not PG:
        pytest.skip("set DUO_TEST_DATABASE_URL to run Postgres-only tests")
    return fresh_schema_url()


if PG:
    _schemas = {}

    def _connect(target):
        if db.is_url(target):
            return db.PgConnection(target)
        if target not in _schemas:
            _schemas[target] = fresh_schema_url()
        return db.PgConnection(_schemas[target])

    db.connect = _connect
