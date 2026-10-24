import { expect, test, type Page } from "@playwright/test";
import type { Deck, Player } from "../lib/api";
import { NO_FILTER } from "../lib/profile";
import { member, setOptIn } from "./members";

const endpoint = "/api/deck/pool-count";
async function count(page: Page) {
  const response = await page.request.get(endpoint);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["count", "opted_in"]); // No member or contact identities.
  return body.count as number;
}
async function roles(page: Page, names: string[]) {
  await page.goto("/account");
  const prefs = page.getByTestId("prefs");
  for (const name of ["上单", "打野", "中单", "下路", "辅助"]) {
    const choice = prefs.getByRole("checkbox", { name, exact: true });
    if (await choice.isChecked()) await prefs.getByText(name, { exact: true }).click();
  }
  for (const name of names) await prefs.getByText(name, { exact: true }).click();
  await prefs.getByRole("button", { name: "保存", exact: true }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
}
async function id(page: Page) {
  return (await (await page.request.get("/api/auth/session")).json()).user.id as string;
}
async function lookingCount(page: Page) {
  return (await (await page.request.get("/api/notifications")).json()).looking_now as number;
}

test("empty-deck pool count respects roles, consent, binding, blocks both ways, and suspension", async ({ browser, request }) => {
  test.setTimeout(240_000);
  expect((await request.get(endpoint)).status()).toBe(401);
  const pages: Page[] = [];
  let admin: Page | undefined;
  try {
    const me = await member(browser, "pool-count-me", "PoolCountMe#NA1"); pages.push(me);
    await roles(me, ["中单"]);
    const baseline = await count(me);
    await roles(me, ["中单", "打野"]);
    const flexibleBaseline = await count(me);
    await setOptIn(me, false);
    expect(await count(me)).toBe(flexibleBaseline); // The requester is excluded, even with flexible roles.
    expect((await (await me.request.get(endpoint)).json()).opted_in).toBe(false);
    await setOptIn(me, true);
    await roles(me, ["中单"]);
    const same = await member(browser, "pool-count-same", "PoolCountSame#NA1"); pages.push(same);
    await roles(same, ["中单"]);
    expect(await count(me)).toBe(baseline);
    const other = await member(browser, "pool-count-other", "PoolCountOther#NA1"); pages.push(other);
    await roles(other, ["打野"]);
    expect(await count(me)).toBe(baseline + 1);
    const any = await member(browser, "pool-count-any", "PoolCountAny#NA1"); pages.push(any);
    // No chosen role means any role, matching the existing 牌堆筛选 semantics.
    expect(await count(me)).toBe(baseline + 2);
    await roles(me, ["中单", "打野"]);
    expect(await count(me)).toBe(flexibleBaseline + 3);
    await roles(me, ["中单"]);

    await setOptIn(other, false);
    expect(await count(me)).toBe(baseline + 1);
    await setOptIn(other, true);
    expect(await count(me)).toBe(baseline + 2);
    expect((await me.request.post("/api/blocks", { data: { to: await id(other) } })).ok()).toBeTruthy();
    expect(await count(me)).toBe(baseline + 1);
    expect((await any.request.post("/api/blocks", { data: { to: await id(me) } })).ok()).toBeTruthy();
    expect(await count(me)).toBe(baseline);

    await roles(same, ["打野"]);
    expect(await count(me)).toBe(baseline + 1);
    const lookingBaseline = await lookingCount(me);
    expect((await same.request.post("/api/looking", { data: { on: true } })).ok()).toBeTruthy();
    expect(await lookingCount(me)).toBe(lookingBaseline + 1);
    // The reporter blocks the target, but me does not; only the suspension should hide them from me.
    expect((await other.request.post("/api/reports", { data: { to: await id(same), reason: "骚扰或辱骂", detail: "" } })).ok()).toBeTruthy();
    admin = await member(browser, "admin");
    await admin.goto("/admin");
    await admin.getByTestId("report-queue").locator("li").filter({ has: admin.getByText("PoolCountSame#NA1", { exact: true }) })
      .getByRole("button", { name: "暂停推荐" }).click();
    await expect(admin.getByTestId("suspended")).toContainText("PoolCountSame#NA1");
    expect(await count(me)).toBe(baseline);
    expect(await lookingCount(me)).toBe(lookingBaseline);
    expect((await same.request.get(endpoint)).status()).toBe(403);
    await admin.getByTestId("suspended").locator("li").filter({ hasText: "PoolCountSame#NA1" })
      .getByRole("button", { name: "恢复" }).click();
    await expect(admin.getByTestId("suspended")).not.toContainText("PoolCountSame#NA1");
    expect(await count(me)).toBe(baseline + 1);
    expect(await lookingCount(me)).toBe(lookingBaseline + 1);
    await same.goto("/account");
    await same.getByRole("button", { name: "换一个 Riot ID" }).click();
    await expect(same.getByRole("button", { name: "绑定", exact: true })).toBeVisible();
    expect(await count(me)).toBe(baseline);
    expect(await lookingCount(me)).toBe(lookingBaseline);
    expect((await same.request.get(endpoint)).status()).toBe(403);
    pages.splice(pages.indexOf(same), 1);
    await same.context().close();
  } finally {
    for (const page of pages) { await setOptIn(page, false); await page.context().close(); }
    await admin?.context().close();
  }
});

test("empty member and opted-out demo decks show only the count, with an honest zero and a safe site invite", async ({ browser }) => {
  const page = await member(browser, "pool-prompt", "PoolPrompt#NA1");
  const player: Player = {
    riot_id: "PoolPrompt#NA1", tier: "GOLD", division: "II", league_points: 50,
    unranked: false, games: 40, wins: 22, insufficient_data: false,
    champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
  };
  const empty: Deck = {
    cards: [], likes_you: [], mutual: [], likes_remaining: 100, can_undo: false,
    retry_after: null, filter: NO_FILTER, looking_until: null, empty_reason: "no_candidates",
  };
  let exhausted = false, optedIn = true, poolCount = 3, countCalls = 0;
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player } }));
  await page.route("**/api/deck", (route) => route.fulfill({ json: exhausted ? empty : {
    ...empty, cards: [{ id: "anonymous-member", tier: "GOLD", division: "II", score: 60,
      win_rate: 0.53, win_rate_delta: 0.01, roles: { a: "MIDDLE", b: "JUNGLE" }, top_pairs: [], reasons: [] }],
  } }));
  await page.route("**/api/deck/pool-count", (route) => {
    countCalls++;
    return route.fulfill({ json: { count: poolCount, opted_in: optedIn } });
  });
  await page.route("**/api/recommendations", (route) => route.fulfill({ json: { me: player, partners: [{
    riot_id: "DemoOnly#NA1", tier: "GOLD", division: "II", score: 60,
    win_rate: 0.53, win_rate_delta: 0.01, roles: { a: "MIDDLE", b: "JUNGLE" }, top_pairs: [], reasons: [],
  }], notes: [] } }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => { (window as unknown as { copiedInvite: string }).copiedInvite = value; },
    } });
  });
  try {
    await page.goto("/find");
    await expect(page.getByTestId("swipe-card")).toBeVisible();
    await expect(page.getByTestId("empty-pool-prompt")).toHaveCount(0);
    expect(countCalls).toBe(0);
    exhausted = true;
    await page.reload();
    const prompt = page.getByTestId("empty-pool-prompt");
    await expect(prompt).toHaveText("推荐池里有 3 人想打和你互补的位置");
    await expect(prompt.getByRole("link")).toHaveCount(0);

    for (const [width, height] of [[375, 667], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const card = page.getByTestId("deck-empty");
      await card.scrollIntoViewIfNeeded();
      const bounds = await card.boundingBox();
      const child = await prompt.boundingBox();
      expect(child!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(child!.y + child!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
    }

    await setOptIn(page, false); optedIn = false;
    await page.goto(`/find?me=${encodeURIComponent(player.riot_id)}`);
    await expect(page.getByTestId("swipe-card")).toBeVisible();
    await expect(prompt).toHaveCount(0);
    await page.getByRole("button", { name: "跳过", exact: true }).click();
    await expect(prompt).toContainText("推荐池里有 3 人想打和你互补的位置");
    await expect(prompt).toContainText("与演示卡片无关");
    await expect(prompt).toContainText("开启“同意被推荐”");
    await expect(prompt.getByRole("link", { name: "开启同意被推荐" })).toHaveAttribute("href", "/account#recommendation");
    poolCount = 0;
    await page.reload();
    await expect(prompt).toContainText("暂时没有想打和你互补位置的会员");
    await expect(prompt).not.toContainText("有 0 人");
    await prompt.getByRole("button", { name: "复制网站链接邀请朋友" }).click();
    expect(await page.evaluate(() => (window as unknown as { copiedInvite: string }).copiedInvite)).toBe("http://127.0.0.1:3100/");
    await expect(page.getByRole("link", { name: "去查组合" })).toHaveAttribute("href", "/");
    const bounds = await page.getByTestId("deck-empty").boundingBox();
    const child = await prompt.boundingBox();
    expect(child!.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(child!.y + child!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
    await page.screenshot({ path: "test-results/empty-pool-opted-out-mobile.png", fullPage: true });
  } finally { await setOptIn(page, false); await page.context().close(); }
});
