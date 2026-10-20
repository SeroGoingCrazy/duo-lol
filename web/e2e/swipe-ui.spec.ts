import { expect, test, type Page } from "@playwright/test";

const partners = [
  { riot_id: "First#NA1", score: 86, win_rate: 0.536, roles: { a: "MIDDLE", b: "JUNGLE" } },
  { riot_id: "Second#NA1", score: 42, win_rate: 0.49, roles: { a: "MIDDLE", b: "TOP" } },
  { riot_id: "Third#NA1", score: 30, win_rate: 0.48, roles: { a: "MIDDLE", b: "BOTTOM" } },
].map((p) => ({
  ...p, tier: "GOLD", division: "II", win_rate_delta: 0.016,
  top_pairs: [{ champion_a: "Ahri", champion_b: "LeeSin", win_rate: 0.54, pair_games: 1234 }],
  reasons: ["MIDDLE 与 JUNGLE 位置互补", "Ahri 与 LeeSin 有足够对局数据", "推荐英雄组合表现较好"],
}));

async function openDeck(page: Page) {
  await page.route("**/api/lookups", (r) => r.fulfill({ json: { player: { riot_id: "Demo#NA1", insufficient_data: false } } }));
  await page.route("**/api/champions", (r) => r.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/champions/names.json", (r) => r.fulfill({ json: {
    Ahri: { id: "Ahri", name: "九尾妖狐", title: "阿狸", english: "Ahri" },
    LeeSin: { id: "LeeSin", name: "盲僧", title: "李青", english: "Lee Sin" },
  } }));
  await page.route("**/api/recommendations", (r) => r.fulfill({ json: { partners, notes: [] } }));
  await page.goto("/find?me=Demo%23NA1");
  await expect(page.getByTestId("swipe-card")).toBeVisible();
}

test("details controls, pass, undo, mutual and persistence", async ({ page }) => {
  await openDeck(page);
  const card = page.getByTestId("swipe-card");
  await expect(card).not.toContainText("First#NA1");
  await card.getByRole("button", { name: "查看全部" }).click();
  await expect(card.getByTestId("top-pairs")).toBeVisible();
  await card.getByRole("button", { name: "理由", exact: true }).click();
  await expect(card.getByTestId("reasons").locator("li")).toHaveCount(3);
  // Arrow keys belong to focused controls; they must not throw out the card.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("match-dialog")).toHaveCount(0);
  await expect(card.getByTestId("reasons")).toBeVisible();
  await page.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(card.getByTestId("score")).toHaveText("42分");
  await page.getByRole("button", { name: "撤销上一次跳过" }).click();
  await expect(card.getByTestId("score")).toHaveText("86分");
  await page.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(page.getByTestId("match-riot-id")).toHaveText("First#NA1");
  await page.getByRole("button", { name: "继续滑" }).click();
  await page.reload();
  await expect(page.getByTestId("mutual-list")).toContainText("First#NA1");
  await expect(card.getByTestId("score")).toHaveText("42分");
});

test("short drag springs back, vertical reading does not swipe, deliberate swipe commits once", async ({ page }) => {
  await openDeck(page);
  const card = page.getByTestId("swipe-card");
  const box = (await card.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 230;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 24, y, { steps: 4 });
  await page.mouse.up();
  await expect(card.getByTestId("score")).toHaveText("86分");
  await expect(card.getByRole("button", { name: "搭配评分", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y + 170, { steps: 10 });
  await page.mouse.up();
  await expect(card.getByTestId("score")).toHaveText("86分");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.4, y, { steps: 10 });
  await page.mouse.up();
  await expect(card.getByTestId("score")).toHaveText("42分");
  await expect(page.getByText("剩余 2 / 3")).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`mobile layout and reduced motion: ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await openDeck(page);
    const card = page.getByTestId("swipe-card");
    const cardBox = (await card.boundingBox())!;
    const sidebarBox = (await page.getByTestId("deck-sidebar").boundingBox())!;
    expect(cardBox.y).toBeLessThan(sidebarBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await expect(card.getByRole("button", { name: "查看全部" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "喜欢", exact: true })).toBeInViewport();
    expect(await card.getByTestId("card-content").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/swipe-mobile-${colorScheme}.png`, fullPage: true });
    await page.getByRole("button", { name: "跳过", exact: true }).click();
    await expect(card.getByTestId("score")).toHaveText("42分");
  });
}

test("touch swipe and touch cancellation preserve the deck", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openDeck(page);
  const card = page.getByTestId("swipe-card");
  const box = (await card.boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = box.x + box.width * 0.65;
  const y = box.y + 220;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 60, y }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(card.getByTestId("score")).toHaveText("86分");
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 6; step++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 25, y }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(card.getByTestId("score")).toHaveText("42分");
  await context.close();
});

test("desktop card has a readable width and a secondary sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDeck(page);
  const cardBox = (await page.getByTestId("swipe-card").boundingBox())!;
  const sidebarBox = (await page.getByTestId("deck-sidebar").boundingBox())!;
  expect(cardBox.width).toBeLessThanOrEqual(500);
  expect(sidebarBox.x).toBeGreaterThan(cardBox.x + cardBox.width);
  await page.screenshot({ path: "test-results/swipe-desktop.png", fullPage: true });
});
