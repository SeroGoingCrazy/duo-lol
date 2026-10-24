import { expect, test, type Page } from "@playwright/test";

const partners = [86, 42].map((score, i) => ({
  riot_id: `Candidate${i}#NA1`, score, win_rate: 0.53, win_rate_delta: 0.02,
  tier: "GOLD", division: "II", games: 40, roles: { a: "MIDDLE", b: "JUNGLE" },
  champions: [], top_pairs: [], reasons: [],
}));

type Milestone = { event: string; mode: string; session: string };

async function mockDeck(page: Page, cards = partners, ready = Promise.resolve()) {
  const events: Milestone[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player: { riot_id: "Demo#NA1", insufficient_data: false } } }));
  await page.route("**/api/champions", (route) => route.fulfill({ json: [] }));
  await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/recommendations", async (route) => {
    await ready;
    await route.fulfill({ json: { partners: cards, notes: [] } });
  });
  return events;
}

// Let layout and IntersectionObserver callbacks run before asserting an event is absent.
async function settleLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function setVisibility(page: Page, value: DocumentVisibilityState) {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

test("a successfully empty deck is loaded and empty, without a card impression", async ({ page }) => {
  const events = await mockDeck(page, []);
  await page.goto("/find?me=Demo%23NA1");
  await expect.poll(() => events.some((event) => event.event === "deck_empty" && event.mode === "demo")).toBe(true);
  expect(events.some((event) => event.event === "deck_loaded" && event.mode === "demo")).toBe(true);
  await expect(page.getByTestId("swipe-card")).toHaveCount(0);
  await settleLayout(page);
  expect(events.some((event) => event.event === "first_card_viewed")).toBe(false);
});

test("loading cards outside the viewport is not an impression until the card scrolls into view", async ({ page }) => {
  let releaseDeck!: () => void;
  const ready = new Promise<void>((resolve) => { releaseDeck = resolve; });
  const events = await mockDeck(page, partners, ready);
  await page.goto("/find?me=Demo%23NA1");
  await page.addStyleTag({ content: ".swipe-stage { margin-top: 1200px; }" });
  releaseDeck();
  const card = page.getByTestId("swipe-card");
  await expect(card).toBeAttached();
  await expect(card).not.toBeInViewport();
  await expect.poll(() => events.some((event) => event.event === "deck_loaded")).toBe(true);
  await settleLayout(page);
  expect(events.some((event) => event.event === "first_card_viewed")).toBe(false);
  expect(events.some((event) => event.event === "deck_empty")).toBe(false);

  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => events.filter((event) => event.event === "first_card_viewed").length).toBe(1);
  expect(events.find((event) => event.event === "first_card_viewed")?.mode).toBe("demo");
  expect(events.every((event) => Object.keys(event).sort().join() === "event,mode,session")).toBe(true);
});

test("a background tab waits for visibility and sends one impression as cards change", async ({ page }) => {
  // Headless tabs do not reliably enter the background; control only the visibility signal.
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  });
  const events = await mockDeck(page);
  await page.goto("/find?me=Demo%23NA1");
  const card = page.getByTestId("swipe-card");
  await expect(card).toBeInViewport();
  await expect.poll(() => events.some((event) => event.event === "deck_loaded")).toBe(true);
  await settleLayout(page);
  expect(events.some((event) => event.event === "first_card_viewed")).toBe(false);

  await setVisibility(page, "visible");
  await expect.poll(() => events.filter((event) => event.event === "first_card_viewed").length).toBe(1);
  await page.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(card.getByTestId("score")).toHaveText("42分");
  await setVisibility(page, "hidden");
  await setVisibility(page, "visible");
  await settleLayout(page);
  expect(events.filter((event) => event.event === "first_card_viewed")).toHaveLength(1);
});
