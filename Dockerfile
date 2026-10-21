# The Python API (data/api.py) for Fly.io or Railway; see docs/deploy.md.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev
COPY data/ data/
ENV DUO_DB=/data/lol_duo.sqlite DUO_SCORE_SCALE=/data/score_scale.json PYTHONUNBUFFERED=1
EXPOSE 8000
# A database uploaded as /data/incoming.sqlite replaces the live one at the next start (docs/deploy.md);
# its WAL files and the fitted score scale go with it, so the scale is refitted on the new data.
CMD ["sh", "-c", "if [ -f /data/incoming.sqlite ]; then rm -f \"$DUO_DB-wal\" \"$DUO_DB-shm\" \"$DUO_SCORE_SCALE\" && mv /data/incoming.sqlite \"$DUO_DB\"; fi; exec uv run --no-dev uvicorn api:app --app-dir data --host 0.0.0.0 --port 8000"]
