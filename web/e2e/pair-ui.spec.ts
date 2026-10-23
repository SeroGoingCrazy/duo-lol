import { expect, test } from "@playwright/test";

test("navigate from the deck to 查组合, predict, reload and return", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const player = (riot_id: string) => ({
    riot_id, tier: "GOLD", division: "II", league_points: 50,
    unranked: false, games: 40, insufficient_data: false,
    champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
  });
  await page.route("**/api/champions", (r) => r.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/champions/names.json", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/lookups", (r) => r.fulfill({ json: { player: player(r.request().postDataJSON().riot_id) } }));
  await page.route("**/api/pair", (r) => r.fulfill({ json: {
    a: player("Alpha#NA1"), b: player("Bravo#NA1"), score: 84, score_by_roles: true,
    win_rate: 0.536, win_rate_delta: 0.016, solo_baselines: { a: 0.52, b: 0.52 },
    roles: { a: "MIDDLE", b: "JUNGLE" }, notes: [],
    top_pairs: [{ champion_a: "Ahri", champion_b: "LeeSin", win_rate: 0.54, pair_games: 1000 }],
  } }));

  await page.goto("/find");
  await page.getByRole("link", { name: "查组合", exact: true }).click();
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "预测", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  await expect(page.getByTestId("score")).toHaveText("84分");
  await expect(page.getByText("比 84% 的中单+打野组合更好")).toBeVisible();
  await expect(page.getByTestId("win-rate")).toHaveText("53.6%");
  await expect(page.getByTestId("player-card")).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  // Returning home clears the previous check and restores the landing page.
  await page.getByRole("link", { name: "匹配搭子", exact: true }).click();
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await expect(page.getByLabel("玩家 A")).toHaveValue("");
  await expect(page.getByTestId("pair-result")).toHaveCount(0);
  await page.getByRole("link", { name: "找搭子", exact: true }).click();
  await expect(page.getByLabel("你的 Riot ID")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
