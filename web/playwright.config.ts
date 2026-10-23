import { defineConfig } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// End-to-end run against a synthetic database and the fake Riot client (data/fake_riot.py):
// no Riot key or network needed. Covers PRD §5 acceptance criteria 2 and 3.
// DUO_E2E_DB=postgresql://... runs the Python side on Postgres instead; the database must be empty
// (fake_riot.py refuses otherwise), so create a new one for each run.
const RUN_DIR = mkdtempSync(path.join(tmpdir(), "duo-lol-e2e-"));
const DB = process.env.DUO_E2E_DB ?? path.join(RUN_DIR, "matches.sqlite");
const APP_DB = path.join(RUN_DIR, "app");   // each run gets its own PGlite database
const chromium = "/opt/pw-browsers/chromium";
const INTERNAL = "e2e-internal";   // DUO_INTERNAL_SECRET on both servers, as in production

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/*-ui.spec.ts",
  workers: 1,   // the specs share one app database, and 牌堆 counts depend on who else is in the 推荐池
  timeout: 60_000,
  use: {
    locale: "zh-CN",   // the specs read the Chinese text; english.spec.ts switches to en-US
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.PW_CHANNEL || undefined,
    // lets tests call the Python API directly (fake icon changes); the site adds its own header server-side
    extraHTTPHeaders: { "x-duo-internal": INTERNAL },
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: [
    {
      command: "node web/scripts/start-e2e-api.mjs",
      env: { DUO_DB: DB, DUO_FAKE_RIOT: "1", DUO_INTERNAL_SECRET: INTERNAL, DATABASE_URL: "" },
      cwd: "..",
      url: "http://127.0.0.1:8100/api/champions",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npx next start -p 3100",
      env: { DATABASE_URL: "", DUO_API_URL: "http://127.0.0.1:8100", DUO_NEXT_DIST_DIR: ".next-e2e", APP_DB_DIR: APP_DB, AUTH_SECRET: "e2e-only-secret", AUTH_DEV_LOGIN: "1", ADMIN_ACCOUNTS: "dev:admin", DUO_INTERNAL_SECRET: INTERNAL },
      url: "http://127.0.0.1:3100",
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
