import { expect, test, type Page } from "@playwright/test";
import type { Deck, DeckCard, LookupUpdate, Player } from "../lib/api";
import { NO_FILTER } from "../lib/profile";
import { member, setOptIn } from "./members";

const player: Player = {
  riot_id: "Recovery#NA1", tier: "GOLD", division: "II", league_points: 50,
  unranked: false, games: 40, wins: 22, insufficient_data: false,
  champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
};
const card: DeckCard = {
  id: "candidate", tier: "GOLD", division: "II", score: 72, win_rate: 0.53,
  win_rate_delta: 0.01, roles: { a: "MIDDLE", b: "JUNGLE" }, top_pairs: [], reasons: [],
  games: 40, champions: [{ champion: "LeeSin", position: "JUNGLE", games: 40, wins: 22 }],
};
const empty: Deck = {
  cards: [], likes_you: [], mutual: [], likes_remaining: 100, can_undo: false,
  retry_after: null, filter: NO_FILTER, looking_until: null, empty_reason: "no_candidates",
};

async function captureEvents(page: Page) {
  const events: { event: string; mode: string }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  return events;
}

test("member lookup recovers in place, shows real progress, and an empty deck offers a prefilled friend check", async ({ browser }) => {
  const page = await member(browser, "recovery", player.riot_id);
  const events = await captureEvents(page);
  let lookupCalls = 0, deckCalls = 0;
  let update: LookupUpdate = { status: "running", stage: "matches", done: 7, total: 40, preview: player };
  await page.route("**/api/lookups", async (route) => {
    lookupCalls++;
    if (lookupCalls === 1) return route.fulfill({ status: 503, json: { detail: "读取资料失败" } });
    await route.fulfill({ json: lookupCalls === 2 ? { job_id: "recovery" } : { player } });
  });
  await page.route("**/api/lookups/recovery", (route) => route.fulfill({ json: update }));
  await page.route("**/api/deck", async (route) => {
    deckCalls++;
    await route.fulfill(deckCalls === 1
      ? { status: 409, json: { detail: "还在读取你的对局，请稍后再试", code: "not_cached" } }
      : { json: empty });
  });
  try {
    await page.goto("/find");
    await expect(page.getByRole("alert").filter({ hasText: "读取资料失败" })).toContainText("已保留你的信息");
    await expect(page.getByTestId("deck-empty")).toHaveCount(0);
    expect(events.some((e) => e.event === "deck_loaded")).toBe(false);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByTestId("member-loading")).toContainText("你的资料还在加载");
    await expect(page.getByTestId("lookup-match-count")).toHaveText("已处理 7 / 40 场对局");
    await expect(page.getByTestId("deck-empty")).toHaveCount(0);
    update = { ...update, status: "done", stage: "done", player };
    await expect(page.getByTestId("member-waiting")).toBeVisible();
    await page.getByRole("button", { name: "查看加载进度" }).click();
    await expect(page.getByTestId("deck-empty")).toContainText("暂时没有可推荐的搭子");
    await expect.poll(() => events.filter((e) => e.mode === "member").map((e) => e.event)).toContain("deck_empty");
    expect(events.some((e) => e.event === "first_card_viewed")).toBe(false);
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId("deck-empty").getByRole("link", { name: "和朋友查组合" })).toBeInViewport();
    await page.screenshot({ path: "test-results/member-empty-mobile.png", fullPage: true });
    await page.getByTestId("deck-empty").getByRole("link", { name: "和朋友查组合" }).click();
    await expect(page.getByLabel("玩家 A")).toHaveValue(player.riot_id);
    await expect(page.getByLabel("玩家 B")).toBeFocused();
    await expect(page.getByTestId("home-hero")).toHaveCount(0);
  } finally { await setOptIn(page, false); await page.context().close(); }
});

test("clearing filters can retry without losing the intended filters; only a rendered card advances the funnel", async ({ browser }) => {
  const page = await member(browser, "filter-recovery", "FilterRecovery#NA1");
  const events = await captureEvents(page);
  const filtered = { ...empty, empty_reason: "filtered", filter: { positions: ["TOP"], languages: ["ko"], voice: true, looking_now: true } };
  const writes: unknown[] = [];
  let fail = true;
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player } }));
  await page.route("**/api/deck", (route) => route.fulfill({ json: filtered }));
  await page.route("**/api/deck/filter", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill(fail ? { status: 503, json: { detail: "保存失败" } }
      : { json: { ...empty, cards: [card], empty_reason: null } });
  });
  await page.route("**/api/swipes", (route) => route.fulfill({ json: { mutual_like: false, match: null, likes_remaining: 100 } }));
  try {
    await page.goto("/find");
    await expect(page.getByTestId("deck-empty")).toContainText("当前筛选下没有搭子");
    await page.screenshot({ path: "test-results/member-filtered-desktop.png", fullPage: true });
    await expect.poll(() => events.filter((e) => e.event === "deck_empty").length).toBe(1);
    expect(events.some((e) => e.event === "first_card_viewed")).toBe(false);
    await page.getByRole("button", { name: "一键清除筛选" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "保存失败" })).toBeVisible();
    await expect(page.getByTestId("deck-filters").getByRole("checkbox", { checked: true })).toHaveCount(0);
    expect(writes).toEqual([NO_FILTER]);
    fail = false;
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByTestId("swipe-card")).toBeVisible();
    expect(writes).toEqual([NO_FILTER, NO_FILTER]);
    await page.getByTestId("swipe-card").scrollIntoViewIfNeeded();
    await expect.poll(() => events.some((e) => e.event === "first_card_viewed" && e.mode === "member")).toBe(true);
    await page.getByRole("button", { name: "跳过", exact: true }).click();
    await expect(page.getByTestId("deck-empty")).toBeVisible();
    expect(events.filter((e) => e.event === "deck_empty")).toHaveLength(1); // consuming cards is not an empty response
  } finally { await setOptIn(page, false); await page.context().close(); }
});


test("a delayed filter retry stays serialized with a newer filter edit", async ({ browser }) => {
  const riotId = "FilterSerial#NA1";
  const page = await member(browser, "filter-serial", riotId);
  const a = { ...NO_FILTER, voice: true };
  const b = { ...a, languages: ["ko"] };
  const writes: Deck["filter"][] = [];
  let persisted = NO_FILTER;
  let retryStarted = false;
  let releaseRetry!: () => void;
  const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve; });
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player: { ...player, riot_id: riotId } } }));
  await page.route("**/api/deck", (route) => route.fulfill({ json: { ...empty, filter: persisted } }));
  await page.route("**/api/deck/filter", async (route) => {
    const intended: Deck["filter"] = route.request().postDataJSON();
    writes.push(intended);
    if (writes.length === 1) return route.fulfill({ status: 503, json: { detail: "保存失败" } });
    if (writes.length === 2) {
      retryStarted = true;
      await retryGate;
    }
    // Persistence happens after the delay: an overlapping old retry would overwrite the newer edit.
    persisted = intended;
    await route.fulfill({ json: { ...empty, filter: intended, cards: [card], empty_reason: null } });
  });
  try {
    await page.goto("/find");
    await expect(page.getByTestId("deck-empty")).toBeVisible();
    const filters = page.getByTestId("deck-filters");
    await filters.getByRole("button", { name: "筛选", exact: true }).click();
    await filters.getByText("开麦", { exact: true }).click();
    await expect(page.getByTestId("looking-toggle")).toBeDisabled();
    await expect(page.getByRole("alert").filter({ hasText: "保存失败" })).toBeVisible();
    await expect(page.getByTestId("looking-toggle")).toBeDisabled();
    expect(writes).toEqual([a]);

    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect.poll(() => retryStarted).toBe(true);
    await expect(page.getByTestId("looking-toggle")).toBeDisabled();
    await filters.getByText("한국어", { exact: true }).click();
    await expect(filters.getByRole("checkbox", { name: "한국어", exact: true })).toBeChecked();
    // Let the 400 ms debounce expire while A is held. B must wait for A, not start alongside it.
    await page.waitForTimeout(650);
    expect(writes).toEqual([a, a]);
    releaseRetry();

    await expect(page.getByTestId("swipe-card")).toBeVisible();
    await expect.poll(() => writes).toEqual([a, a, b]);
    await expect(page.getByTestId("looking-toggle")).toBeEnabled();
    expect(persisted).toEqual(b);
    await expect(filters.getByRole("checkbox", { name: "开麦", exact: true })).toBeChecked();
    await expect(filters.getByRole("checkbox", { name: "한국어", exact: true })).toBeChecked();
    await page.reload();
    await expect(page.getByTestId("deck-empty")).toBeVisible();
    await expect(filters.getByRole("checkbox", { name: "开麦", exact: true })).toBeChecked();
    await expect(filters.getByRole("checkbox", { name: "한국어", exact: true })).toBeChecked();
  } finally {
    releaseRetry();
    await setOptIn(page, false);
    await page.context().close();
  }
});
