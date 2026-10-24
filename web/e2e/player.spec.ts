import { expect, test } from "@playwright/test";

// 玩家资料页 and sharing a 查组合 result.

test("share link copies the result's address, and a player's name opens their 玩家资料页", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
  await expect(page.getByTestId("pair-result")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "复制分享链接" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?a=Alpha%23NA1&b=Bravo%23NA1$/);

  await page.getByTestId("player-link").filter({ hasText: "Bravo#NA1" }).click();
  await expect(page).toHaveURL(/\/player\/Bravo-NA1$/);
  await expect(page).toHaveTitle(/Bravo#NA1/);
  await expect(page.getByTestId("player-title")).toHaveText("Bravo#NA1");
  await expect(page.getByTestId("player-summary")).toContainText("本赛季");
  await expect(page.getByTestId("recent-games").locator("li")).toHaveCount(20);

  // 和 TA 查组合 goes back to 查组合 with both IDs filled in
  await page.getByLabel("你的 Riot ID").fill("Alpha#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page).toHaveURL(/\/\?a=Alpha%23NA1&b=Bravo%23NA1$/);
  await expect(page.getByTestId("pair-result")).toBeVisible({ timeout: 45_000 });
});

test("a player page looks up someone new, and a bad address is not found", async ({ page }) => {
  await page.goto("/player/Charlie-NA1");
  await expect(page.getByTestId("recent-games").locator("li").first()).toBeVisible({ timeout: 45_000 });
  await page.goto("/player/Nobody-NA1");
  await expect(page.getByRole("alert").filter({ hasText: "找不到" })).toBeVisible({ timeout: 45_000 });
  expect((await page.goto("/player/no_tag"))?.status()).toBe(404);
});
