import { expect, test, type Page } from "@playwright/test";
import type { Deck, DeckCard } from "../lib/api";
import { member, setOptIn } from "./members";

const readDeck = async (page: Page): Promise<Deck> => {
  const response = await page.request.get("/api/deck");
  expect(response.ok()).toBeTruthy();
  return response.json();
};
const count = async (page: Page): Promise<number> => (await (await page.request.get("/api/notifications")).json()).looking_now;
const looking = async (page: Page, on: boolean) => {
  expect((await page.request.post("/api/looking", { data: { on } })).ok()).toBeTruthy();
};
const visible = async (page: Page) => {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

test("现在想打 groups keep prediction order, explain it, refresh nav counts, and use current mutual status", async ({ browser, page: guest }) => {
  test.setTimeout(300_000);
  // These synthetic players are Gold / Platinum, so all can duo; fixed IDs are unique to this spec.
  const pages: Page[] = [];
  try {
    const me = await member(browser, "looking-b", "LookingB#NA1"); pages.push(me);
    await me.getByTestId("prefs").getByLabel(/简介/).fill("LookingB");
    await me.getByTestId("prefs").getByRole("button", { name: "保存", exact: true }).click();
    await expect(me.getByTestId("prefs").getByText("已保存")).toBeVisible();
    const byBio = new Map<string, Page>();
    for (const name of ["LookingC", "LookingG", "LookingI"]) {
      const p = await member(browser, name.toLowerCase(), `${name}#NA1`); pages.push(p);
      const prefs = p.getByTestId("prefs");
      await prefs.getByLabel(/简介/).fill(name);
      await prefs.getByRole("button", { name: "保存", exact: true }).click();
      await expect(prefs.getByText("已保存")).toBeVisible();
      byBio.set(name, p);
    }
    const initialCount = await count(me);
    const baseline = (await readDeck(me)).cards;
    const own = baseline.filter((c) => byBio.has(c.profile?.bio ?? ""));
    expect(own).toHaveLength(3);
    const active = own.slice(1); // lower prediction cards must move above the best one
    const activeIds = new Set(active.map((c) => c.id));
    const pageFor = (c: DeckCard) => byBio.get(c.profile!.bio)!;
    for (const c of active) await looking(pageFor(c), true);

    // Someone else's status alone does not change my existing order or add the mutual reason.
    const off = await readDeck(me);
    expect(off.cards.map((c) => c.id)).toEqual(baseline.map((c) => c.id));
    expect(off.cards.every((c) => !c.reasons.includes("你们现在都想打"))).toBe(true);
    await me.goto("/find");
    await expect(me.getByTestId("looking-now-count")).toHaveText(`现在有 ${initialCount + 2} 人想打`);
    let releaseLooking!: () => void;
    const lookingGate = new Promise<void>((resolve) => { releaseLooking = resolve; });
    await me.route("**/api/looking", async (route) => { await lookingGate; await route.continue(); });
    await expect(me.getByTestId("swipe-card")).toBeVisible();
    const refreshed = me.waitForResponse((r) => r.url().endsWith("/api/deck"));
    await me.getByTestId("looking-toggle").click();
    try {
      await expect(me.getByTestId("looking-toggle")).toBeDisabled();
      await expect(me.getByTestId("deck-filters").getByRole("button", { name: "筛选", exact: true })).toBeDisabled();
      await expect(me.getByTestId("swipe-card")).toHaveCount(0);
    } finally { releaseLooking(); }
    const grouped: Deck = await (await refreshed).json();
    await me.unroute("**/api/looking");
    const expected = [...baseline.filter((c) => activeIds.has(c.id)), ...baseline.filter((c) => !activeIds.has(c.id))];
    expect(grouped.cards.map((c) => c.id)).toEqual(expected.map((c) => c.id));
    expect(grouped.cards.filter((c) => activeIds.has(c.id)).every((c) => c.reasons.includes("你们现在都想打"))).toBe(true);
    expect(grouped.cards.filter((c) => !activeIds.has(c.id)).every((c) => !c.reasons.includes("你们现在都想打"))).toBe(true);
    await expect(me.getByTestId("card-profile")).toContainText(active[0].profile!.bio);
    await me.getByTestId("swipe-card").getByRole("button", { name: "理由", exact: true }).click();
    await expect(me.getByTestId("reasons")).toContainText("你们现在都想打");
    expect(await count(me)).toBe(initialCount + 2); // excludes my own active status
    await expect(me.getByTestId("looking-now-count")).toHaveAttribute("href", "/find");

    // Availability remains visible to bound members who have not opted in; it is never shown to guests/unbound members.
    await setOptIn(me, false);
    expect(await count(me)).toBe(initialCount + 2);
    await visible(me);
    await expect(me.getByTestId("looking-now-count")).toHaveText(`现在有 ${initialCount + 2} 人想打`);
    await guest.goto("/");
    expect(await count(guest)).toBe(0);
    await expect(guest.getByTestId("looking-now-count")).toHaveCount(0);
    const unbound = await member(browser, "looking-unbound");
    expect(await count(unbound)).toBe(0);
    await expect(unbound.getByTestId("looking-now-count")).toHaveCount(0);
    await unbound.context().close();
    await setOptIn(me, true);

    // Existing likes-you filter bypass survives the new grouping, even when the liker isn't looking now.
    const ordinary = own[0];
    // Find my id from an active member's own deck without relying on Riot ID disclosure.
    const meDeck = await readDeck(pageFor(active[0]));
    const myId = meDeck.cards.find((c) => c.profile?.bio === "LookingB")!.id;
    expect((await pageFor(ordinary).request.post("/api/swipes", { data: { to: myId, action: "like" } })).ok()).toBeTruthy();
    const filtered = await me.request.post("/api/deck/filter", { data: { positions: [], languages: [], voice: false, looking_now: true } });
    const onlyLooking: Deck = await filtered.json();
    expect(onlyLooking.cards.map((c) => c.id)).toContain(ordinary.id);
    expect(onlyLooking.likes_you).toContain(ordinary.id);

    // A real mutual dialog uses a current server check, then a second mutual proves a stale card cannot claim availability.
    expect((await pageFor(active[0]).request.post("/api/swipes", { data: { to: myId, action: "like" } })).ok()).toBeTruthy();
    await me.goto("/find");
    await expect(me.getByTestId("card-profile")).toContainText(active[0].profile!.bio);
    let releaseSwipe!: () => void;
    let swipeStarted = false;
    const swipeGate = new Promise<void>((resolve) => { releaseSwipe = resolve; });
    await me.route("**/api/swipes", async (route) => { swipeStarted = true; await swipeGate; await route.continue(); });
    await me.getByRole("button", { name: "喜欢", exact: true }).click();
    try {
      await expect.poll(() => swipeStarted).toBe(true);
      await expect(me.getByTestId("looking-toggle")).toBeDisabled();
    } finally { releaseSwipe(); }
    await expect(me.getByTestId("match-looking-now")).toHaveText("TA 现在也想打");
    await me.unroute("**/api/swipes");
    await me.getByRole("button", { name: "继续滑", exact: true }).click();
    expect((await pageFor(active[1]).request.post("/api/swipes", { data: { to: myId, action: "like" } })).ok()).toBeTruthy();
    await expect(me.getByTestId("card-profile")).toContainText(active[1].profile!.bio);
    await looking(pageFor(active[1]), false);
    const staleSwipe = me.waitForResponse((r) => r.url().endsWith("/api/swipes") && r.request().method() === "POST");
    await me.getByRole("button", { name: "喜欢", exact: true }).click();
    expect((await (await staleSwipe).json()).match.both_looking_now).toBe(false);
    await expect(me.getByTestId("match-dialog")).toBeVisible();
    await expect(me.getByTestId("match-looking-now")).toHaveCount(0);
    await me.getByRole("button", { name: "继续滑", exact: true }).click();

    // Returning to the tab refreshes the existing nav poll immediately; opt-out and blocks also remove availability.
    const notification = me.waitForResponse((r) => r.url().endsWith("/api/notifications"));
    await visible(me);
    expect((await (await notification).json()).looking_now).toBe(initialCount + 1);
    await expect(me.getByTestId("looking-now-count")).toHaveText(`现在有 ${initialCount + 1} 人想打`);
    await setOptIn(pageFor(active[0]), false);
    expect(await count(me)).toBe(initialCount);
    await setOptIn(pageFor(active[0]), true);
    expect((await me.request.post("/api/blocks", { data: { to: active[0].id } })).ok()).toBeTruthy();
    expect(await count(me)).toBe(initialCount);
    await visible(me);
    if (initialCount === 0) await expect(me.getByTestId("looking-now-count")).toHaveCount(0);
  } finally {
    for (const p of pages) { await setOptIn(p, false); await p.context().close(); }
  }
});
