# The Python API (data/api.py) for Fly.io or Railway; see docs/deploy.md.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev
COPY data/ data/
# The database is DATABASE_URL (Neon), set as a secret; the volume keeps the fitted score scale.
ENV DUO_SCORE_SCALE=/data/score_scale.json PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "api:app", "--app-dir", "data", "--host", "0.0.0.0", "--port", "8000"]
