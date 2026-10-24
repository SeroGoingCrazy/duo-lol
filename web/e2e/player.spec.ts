import { expect, test } from "@playwright/test";
import { member } from "./members";

// 玩家资料页 and sharing a 查组合 result.

test("share link copies the result's address, and a player's name opens their 玩家资料页", async ({ page, context }) => {
  const events: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/analytics") events.push(request.postDataJSON());
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1&unrelated=NeverShare#duo-check");
  await expect(page.getByTestId("pair-result")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "复制分享链接" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?a=Alpha%23NA1&b=Bravo%23NA1$/);
  await page.getByRole("button", { name: "邀请 TA 一起来" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("注册并加入推荐池");
  const invitation = await page.evaluate(() => navigator.clipboard.readText());
  expect(invitation).toContain("注册并加入推荐池");
  const link = new URL(invitation.split("\n")[1]);
  expect([...link.searchParams]).toEqual([["a", "Alpha#NA1"], ["b", "Bravo#NA1"]]);
  expect(link.pathname).toBe("/");
  expect(link.hash).toBe("");
  expect(invitation).not.toContain("NeverShare");
  await expect.poll(() => events.some((event) => event.event === "pair_invite_clicked" && event.mode === "public")).toBe(true);

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
  await expect(page.getByRole("link", { name: "找更多像 TA 的搭子" })).toHaveAttribute("href", "/login");
  await page.getByRole("link", { name: "找更多像 TA 的搭子" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => events.some((event) => event.event === "pair_find_more_clicked" && event.mode === "public")).toBe(true);
  expect(events.every((event) => Object.keys(event).sort().join() === "event,mode,session")).toBe(true);
});

test("a logged-in member can find more partners directly from a pair result", async ({ browser }) => {
  const page = await member(browser, "pair-result-member");
  try {
    await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
    await expect(page.getByTestId("pair-result")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("link", { name: "找更多像 TA 的搭子" })).toHaveAttribute("href", "/find");
    await page.getByRole("link", { name: "找更多像 TA 的搭子" }).click();
    await expect(page).toHaveURL(/\/find$/);
  } finally { await page.context().close(); }
});

test("a player page looks up someone new, and a bad address is not found", async ({ page }) => {
  await page.goto("/player/Charlie-NA1");
  await expect(page.getByTestId("recent-games").locator("li").first()).toBeVisible({ timeout: 45_000 });
  await page.goto("/player/Nobody-NA1");
  await expect(page.getByRole("alert").filter({ hasText: "找不到" })).toBeVisible({ timeout: 45_000 });
  expect((await page.goto("/player/no_tag"))?.status()).toBe(404);
});
