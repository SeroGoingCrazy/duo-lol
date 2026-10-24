import { expect, test, type Page } from "@playwright/test";

const partners = [
  { riot_id: "First#NA1", score: 86, win_rate: 0.536, roles: { a: "MIDDLE", b: "JUNGLE" } },
  { riot_id: "Second#NA1", score: 42, win_rate: 0.49, roles: { a: "MIDDLE", b: "TOP" } },
  { riot_id: "Third#NA1", score: 30, win_rate: 0.48, roles: { a: "MIDDLE", b: "BOTTOM" } },
].map((p) => ({
  ...p, tier: "GOLD", division: "II", win_rate_delta: 0.016,
  games: 42, champions: [
    { champion: "Lux", position: "UTILITY", games: 22, wins: 13 },
    { champion: "LeeSin", position: "JUNGLE", games: 12, wins: 7 },
    { champion: "Lux", position: "MIDDLE", games: 8, wins: 4 },
  ],
  top_pairs: [{ champion_a: "Ahri", champion_b: "LeeSin", win_rate: 0.54, pair_games: 1234 }],
  reasons: ["MIDDLE 与 JUNGLE 位置互补", "Ahri 与 LeeSin 有足够对局数据", "推荐英雄组合表现较好"],
}));

async function openDeck(page: Page) {
  await page.route("**/api/lookups", (r) => r.fulfill({ json: { player: { riot_id: "Demo#NA1", insufficient_data: false } } }));
  await page.route("**/api/champions", (r) => r.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/champions/names.json", (r) => r.fulfill({ json: {
    Ahri: { id: "Ahri", name: "九尾妖狐", title: "阿狸", english: "Ahri" },
    LeeSin: { id: "LeeSin", name: "盲僧", title: "李青", english: "Lee Sin" },
    Lux: { id: "Lux", name: "光辉女郎", title: "拉克丝", english: "Lux" },
  } }));
  await page.route("**/api/recommendations", (r) => r.fulfill({ json: { partners, notes: [] } }));
  await page.goto("/find?me=Demo%23NA1");
  await expect(page.getByTestId("swipe-card")).toBeVisible();
}

test("details controls, pass, undo, mutual and persistence", async ({ page }) => {
  await openDeck(page);
  const card = page.getByTestId("swipe-card");
  await expect(card).not.toContainText("First#NA1");
  await expect(card.getByTestId("avatar")).toBeVisible();
  await expect(card.getByTestId("card-games")).toContainText("42 场单双排");
  await expect(card.getByTestId("card-champions")).toContainText("光辉女郎30 场");
  await expect(card.getByTestId("card-champions")).not.toContainText("九尾妖狐"); // suggested combo is not played history
  await expect(card.getByTestId("likes-you-badge")).toHaveText("模拟喜欢");
  await card.getByRole("button", { name: "看英雄组合" }).click();
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
  await expect(page.getByTestId("match-dialog")).toContainText("模拟互选");
  await expect(page.getByTestId("match-dialog")).toContainText("对方没有向你表达喜欢");
  await expect(page.getByTestId("match-riot-id")).toHaveCount(0);
  await expect(page.getByTestId("match-dialog").getByRole("button", { name: "复制" })).toHaveCount(0);
  await page.getByRole("button", { name: "继续滑" }).click();
  await page.reload();
  await expect(page.getByTestId("mutual-list")).toContainText("演示候选");
  await expect(page.getByTestId("mutual-list")).not.toContainText("First#NA1");
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
  await expect(page.getByTestId("deck-remaining")).toHaveText("还剩 2 张卡片");
});

for (const [colorScheme, width, height] of [["light", 390, 844], ["dark", 390, 844], ["light", 375, 667]] as const) {
  test(`mobile layout and reduced motion: ${colorScheme} ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await openDeck(page);
    const card = page.getByTestId("swipe-card");
    const cardBox = (await card.boundingBox())!;
    const sidebarBox = (await page.getByTestId("deck-sidebar").boundingBox())!;
    expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(cardBox.y);
    const sidebar = page.getByTestId("deck-sidebar");
    await expect(sidebar.getByRole("tabpanel")).toBeHidden();
    await sidebar.getByRole("button", { name: /模拟喜欢/ }).click();
    await expect(sidebar.getByTestId("likes-list")).toBeVisible();
    await sidebar.getByRole("button", { name: /模拟喜欢/ }).click();
    await expect(sidebar.getByRole("tabpanel")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.getByTestId("demo-simulation-notice")).toBeInViewport({ ratio: 1 });
    await expect(card.getByRole("button", { name: "看英雄组合" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "喜欢", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "跳过", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(card).toBeInViewport({ ratio: 1 });
    if (height >= 844) {
      expect(await card.getByTestId("card-content").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    } else {
      // On shorter screens, supplemental champion history scrolls inside the card;
      // the card and all action buttons still fit without scrolling the page.
      await card.getByTestId("card-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect(card.getByTestId("card-games")).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    await page.screenshot({ path: `test-results/swipe-mobile-${colorScheme}-${width}x${height}.png`, fullPage: true });
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
  const y = box.y + 80; // drag the header, away from the calculation disclosure
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDeck(page);
  const cardBox = (await page.getByTestId("swipe-card").boundingBox())!;
  const sidebarBox = (await page.getByTestId("deck-sidebar").boundingBox())!;
  expect(cardBox.width).toBeLessThanOrEqual(500);
  expect(sidebarBox.x).toBeGreaterThan(cardBox.x + cardBox.width);
  await expect(page.getByTestId("swipe-card")).toBeInViewport({ ratio: 1 });
  for (const name of ["撤销上一次跳过", "跳过", "喜欢"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await page.screenshot({ path: "test-results/swipe-desktop.png", fullPage: true });
});

test("large decks hide the counter until fewer than five cards remain", async ({ page }) => {
  await openDeck(page);
  await page.route("**/api/recommendations", (route) => route.fulfill({ json: {
    partners: Array.from({ length: 6 }, (_, i) => ({ ...partners[1], riot_id: `Pool${i}#NA1` })), notes: [],
  } }));
  await page.reload();
  await expect(page.getByTestId("swipe-card")).toBeVisible();
  await expect(page.getByTestId("deck-remaining")).toHaveCount(0);
  await page.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(page.getByRole("button", { name: "撤销上一次跳过" })).toBeEnabled();
  await expect(page.getByTestId("deck-remaining")).toHaveCount(0);
  await page.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(page.getByTestId("deck-remaining")).toHaveText("还剩 4 张卡片");
});

for (const close of ["button", "Escape"] as const) {
  test(`match dialog dismisses with ${close} and restores keyboard focus`, async ({ page }) => {
    await openDeck(page);
    const like = page.getByRole("button", { name: "喜欢", exact: true });
    await like.click();
    const dialog = page.getByTestId("match-dialog");
    await expect(dialog).toBeVisible();
    const closeButton = dialog.getByRole("button", { name: "关闭", exact: true });
    await closeButton.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "继续滑" })).toBeFocused();
    if (close === "button") await closeButton.click();
    else await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(like).toBeFocused();
    await expect(page.getByTestId("swipe-card").getByTestId("score")).toHaveText("42分");
  });
}
