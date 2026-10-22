# The Python API (data/api.py) for Fly.io or Railway; see docs/deploy.md.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev
COPY data/ data/
# The database is DATABASE_URL (Neon), set as a secret; it also holds the fitted score scale.
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
# Without the secret the API would quietly start on an empty SQLite file, so refuse to start.
CMD ["sh", "-c", "test -n \"$DATABASE_URL\" || { echo 'set the DATABASE_URL secret (docs/deploy.md)'; exit 1; }; exec uv run --no-dev uvicorn api:app --app-dir data --host 0.0.0.0 --port 8000"]
