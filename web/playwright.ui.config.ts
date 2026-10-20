import { defineConfig } from "@playwright/test";

// Deterministic UI checks use API fixtures and need no Riot key or Python service.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*-ui.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3100",
    env: { DUO_NEXT_DIST_DIR: ".next-ui", APP_DB_DIR: ".next-ui/app-db", AUTH_SECRET: "ui-tests-only-secret" },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
  },
});
