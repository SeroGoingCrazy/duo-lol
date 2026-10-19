import { expect, test } from "@playwright/test";

// PRD §5.2: a new player shows a progress bar; a cached player answers within 10 seconds.
test("查组合: first lookup shows progress, cached lookup is fast", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.getByTestId("progress")).toBeVisible();
  await expect(page.getByTestId("win-rate")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("win-rate")).toHaveText(/\d+\.\d%/);
  await expect(page.getByTestId("win-rate-delta")).toContainText("比你们各自单排");
  await expect(page.getByTestId("roles")).toContainText("打");
  const pairs = page.getByTestId("top-pairs").locator("tbody tr");
  expect(await pairs.count()).toBeGreaterThanOrEqual(1);
  expect(await pairs.count()).toBeLessThanOrEqual(3);
  expect(await page.getByTestId("reasons").locator("li").count()).toBeGreaterThanOrEqual(3);

  await page.reload();
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  const start = Date.now();
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.getByTestId("win-rate")).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - start).toBeLessThan(10_000);
});

// PRD §2.3: under 20 games, ask for 自选英雄 instead of showing a prediction.
test("查组合: insufficient data falls back to self-reported champions", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Newbie#NA1");
  await page.getByLabel("玩家 B").fill("Alpha#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.getByTestId("self-report")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("win-rate")).toHaveCount(0);
  await page.getByLabel("英雄 1").fill("Ahri");
  await page.getByRole("button", { name: "用这些英雄估算" }).click();
  await expect(page.getByTestId("win-rate")).toBeVisible();
  await expect(page.getByTestId("pair-result")).toContainText("自选英雄");
});

// PRD §5.3: the 5 partners with the highest predicted win rate, Riot ID and reasons only.
test("找搭子: top 5 partners", async ({ page }) => {
  await page.goto("/find");
  await page.getByLabel("你的 Riot ID").fill("Charlie#NA1");
  await page.getByRole("button", { name: "找搭子" }).click();
  const items = page.getByTestId("partners").locator(":scope > li");
  await expect(items.first()).toBeVisible({ timeout: 45_000 });
  expect(await items.count()).toBeLessThanOrEqual(5);
  const rates = await items.locator("b", { hasText: "%" }).allInnerTexts();
  const nums = rates.map((r) => parseFloat(r));
  expect(nums).toEqual([...nums].sort((x, y) => y - x));
});

test("unknown Riot ID shows an error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Nobody#NA1");
  await page.getByLabel("玩家 B").fill("Alpha#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("找不到");
});
