import { expect, test } from "@playwright/test";
import type { LookupUpdate, Player } from "../lib/api";

test("cold lookup shows real stages and player preview before match history finishes", async ({ page }) => {
  const player: Player = {
    riot_id: "Preview#NA1", tier: "GOLD", division: "II", league_points: 50,
    unranked: false, games: 40, wins: 22, insufficient_data: false,
    champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
  };
  let update: LookupUpdate = { status: "running", stage: "account", done: 0, total: 0 };
  await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { job_id: "preview-job" } }));
  await page.route("**/api/lookups/preview-job", (route) => route.fulfill({ json: update }));
  await page.route("**/api/players/**/matches", (route) => route.fulfill({ json: { riot_id: player.riot_id, games: [] } }));

  await page.goto("/player/Preview-NA1");
  await expect(page.getByText("正在查找美服玩家…", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  await expect(page.getByTestId("lookup-player-preview")).toHaveCount(0);

  update = { ...update, stage: "rank", preview: { riot_id: player.riot_id } };
  await expect(page.getByTestId("lookup-player-preview")).toContainText("Preview#NA1");
  // A missing rank is still loading, never presented as an unranked player.
  await expect(page.getByTestId("lookup-player-preview")).not.toContainText("未定级");

  update = { ...update, stage: "matches", done: 7, total: 40, preview: {
    riot_id: player.riot_id, tier: player.tier, division: player.division,
    league_points: player.league_points, unranked: false,
  } };
  await expect(page.getByTestId("lookup-player-preview")).toContainText("黄金 II");
  await expect(page.getByTestId("lookup-match-count")).toHaveText("已处理 7 / 40 场对局");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "40");
  await expect(page.getByTestId("player-summary")).toHaveCount(0);

  update = { ...update, stage: "analysis", done: 40 };
  await expect(page.getByText("正在整理英雄熟练度…", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  update = { ...update, status: "done", stage: "done", player };
  await expect(page.getByTestId("player-summary")).toContainText("本赛季 40 场");
  await expect(page.getByTestId("progress")).toHaveCount(0);
});

test("failed lookup keeps the failure visible instead of an endless progress bar", async ({ page }) => {
  await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { job_id: "failed-job" } }));
  await page.route("**/api/lookups/failed-job", (route) => route.fulfill({ json: {
    status: "error", stage: "account", done: 0, total: 0, error: "找不到美服玩家 Nobody#NA1",
  } }));
  await page.goto("/player/Nobody-NA1");
  await expect(page.getByRole("alert").filter({ hasText: "找不到美服玩家 Nobody#NA1" })).toBeVisible();
  await expect(page.getByTestId("progress")).toHaveCount(0);
});
