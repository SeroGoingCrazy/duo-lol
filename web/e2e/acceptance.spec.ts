import { expect, test, type Page } from "@playwright/test";

// Data Dragon is not reachable from CI; serve a two-language stub so Chinese names can be checked.
async function stubDataDragon(page: Page) {
  await page.route("https://ddragon.leagueoflegends.com/api/versions.json", (r) => r.fulfill({ json: ["15.20.1"] }));
  await page.route("https://ddragon.leagueoflegends.com/cdn/*/data/*/champion.json", (r) => {
    const zh = r.request().url().includes("zh_CN");
    const champs: Record<string, [string, string, string]> = {
      Ahri: ["九尾妖狐", "阿狸", "Ahri"], LeeSin: ["盲僧", "李青", "Lee Sin"], Garen: ["德玛西亚之力", "盖伦", "Garen"],
    };
    const data = Object.fromEntries(Object.entries(champs).map(([id, [name, title, en]]) =>
      [id, zh ? { id, name, title } : { id, name: en, title: "" }]));
    return r.fulfill({ json: { data } });
  });
  await page.route("https://ddragon.leagueoflegends.com/cdn/*/img/**", (r) => r.abort());
}

async function pickChampion(page: Page, row: number, search: string, name: string) {
  await page.getByRole("combobox", { name: `英雄 ${row}`, exact: true }).click();
  await page.getByRole("combobox", { name: `英雄 ${row} 搜索` }).fill(search);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

async function pickPosition(page: Page, row: number, label: string) {
  await page.getByLabel(`位置 ${row}`).click();
  await page.getByRole("option", { name: label }).click();
}

test.beforeEach(async ({ page }) => { await stubDataDragon(page); });

// PRD §5.2: a new player shows a progress bar; a cached player answers within 10 seconds.
test("查组合: first lookup shows progress, cached lookup is fast", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.getByTestId("progress")).toBeVisible();
  await expect(page.getByTestId("win-rate")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("win-rate")).toHaveText(/\d+\.\d%/);
  await expect(page.getByTestId("score")).toHaveText(/^\d{1,3}分$/);
  await expect(page.getByTestId("win-rate-delta")).toContainText("个百分点");
  // 建议位置 is a position icon above each player's champion column
  await expect(page.getByTestId("roles").locator("[data-position]")).toHaveCount(2);
  const pairs = page.getByTestId("top-pairs").locator("tbody tr");
  expect(await pairs.count()).toBeGreaterThanOrEqual(1);
  expect(await pairs.count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("reasons")).toHaveCount(0);
  await expect(page.getByTestId("player-card")).toHaveCount(2);

  // the URL carries both IDs, so reloading (or sharing the link) shows the result again
  await expect(page).toHaveURL(/a=Alpha%23NA1&b=Bravo%23NA1/);
  const start = Date.now();
  await page.reload();
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

  // nothing picked: each row says what's missing instead of a silently disabled button
  await page.getByRole("button", { name: "用这些英雄估算" }).click();
  await expect(page.getByTestId("self-report")).toContainText("第 1 行：请选择英雄");

  await pickChampion(page, 1, "阿狸", "九尾妖狐");
  await page.getByRole("button", { name: "用这些英雄估算" }).click();
  await expect(page.getByTestId("self-report")).toContainText("第 1 行：请选择位置");
  await pickPosition(page, 1, "中单");
  await page.getByRole("button", { name: "用这些英雄估算" }).click();
  await expect(page.getByTestId("win-rate")).toBeVisible();
  await expect(page.getByTestId("notes")).toContainText("自选英雄");

  // the picks can be changed afterwards
  await page.getByRole("button", { name: "修改自选英雄" }).click();
  await expect(page.getByRole("combobox", { name: "英雄 1", exact: true })).toContainText("九尾妖狐");
});

test("查组合: the same player twice is caught before submitting", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("alpha #na1");
  await expect(page.getByText("两个 Riot ID 是同一个人")).toBeVisible();
  await expect(page.getByRole("button", { name: "预测" })).toBeDisabled();
});

test("Riot ID without a tag explains the format", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Alpha");
  await expect(page.getByText("格式是 名字#标签")).toBeVisible();
});

// PRD §5.3: the 5 partners with the highest predicted win rate, Riot ID only.
test("找搭子: top 5 partners", async ({ page }) => {
  await page.goto("/find");
  await page.getByLabel("你的 Riot ID").fill("Charlie#NA1");
  await page.getByRole("button", { name: "找搭子" }).click();
  const items = page.getByTestId("partners").locator(":scope > li");
  await expect(items.first()).toBeVisible({ timeout: 45_000 });
  expect(await items.count()).toBeLessThanOrEqual(5);
  const rates = await items.locator(".win-rate").allInnerTexts();
  const nums = rates.map((r) => parseFloat(r));
  expect(nums).toEqual([...nums].sort((x, y) => y - x));
  await expect(items.first().locator("[data-champion]")).toHaveCount(2);
  await expect(items.first().getByRole("button", { name: /复制/ })).toBeVisible();
});

test("找搭子: insufficient data asks for self-reported champions", async ({ page }) => {
  await page.goto("/find");
  await page.getByLabel("你的 Riot ID").fill("NewTwo#NA1");
  await page.getByRole("button", { name: "找搭子" }).click();
  await expect(page.getByTestId("self-report")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
  await pickChampion(page, 1, "garen", "德玛西亚之力");
  await pickPosition(page, 1, "上单");
  await page.getByRole("button", { name: "用这些英雄估算" }).click();
  await expect(page.getByTestId("partners").locator(":scope > li").first()).toBeVisible({ timeout: 45_000 });
});

test("unknown Riot ID shows an error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家 A").fill("Nobody#NA1");
  await page.getByLabel("玩家 B").fill("Alpha#NA1");
  await page.getByRole("button", { name: "预测" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("找不到");
});
