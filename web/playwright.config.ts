import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// End-to-end run against a synthetic database and the fake Riot client (data/fake_riot.py):
// no Riot key or network needed. Covers PRD §5 acceptance criteria 2 and 3.
const DB = "/tmp/duo-lol-e2e.sqlite";
const SCALE = "/tmp/duo-lol-e2e-scale.json";
const APP_DB = "/tmp/duo-lol-e2e-app";   // PGlite directory for the app schema (lib/db)
const chromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/*-ui.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: [
    {
      command: `rm -f ${DB} ${SCALE} && uv run python data/fake_riot.py ${DB} && uv run python data/score_scale.py --db ${DB} --out ${SCALE} && DUO_DB=${DB} DUO_SCORE_SCALE=${SCALE} DUO_FAKE_RIOT=1 uv run uvicorn api:app --app-dir data --port 8100`,
      cwd: "..",
      url: "http://127.0.0.1:8100/api/champions",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `rm -rf ${APP_DB} && npm run build && npx next start -p 3100`,
      env: { DUO_API_URL: "http://127.0.0.1:8100", DUO_NEXT_DIST_DIR: ".next-e2e", APP_DB_DIR: APP_DB, AUTH_SECRET: "e2e-only-secret", AUTH_DEV_LOGIN: "1" },
      url: "http://127.0.0.1:3100",
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
