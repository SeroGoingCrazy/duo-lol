import { expect, test } from "@playwright/test";

test("home explains the product and routes to the free check and explicit demo", async ({ page }) => {
  const events: Record<string, unknown>[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/champions", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  const hero = page.getByTestId("home-hero");
  await expect(hero).toContainText("真正合得来");
  await expect(hero).toContainText("均为模拟");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/home-mobile-390x844.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/home-desktop-1440.png", fullPage: true });
  await hero.getByRole("link", { name: "和朋友查组合" }).click();
  await expect(page.getByLabel("玩家 A")).toBeInViewport();
  await expect.poll(() => events.map((e) => e.event)).toContain("home_viewed");
  expect(events.map((e) => e.event)).not.toContain("pair_started");
  expect(events.every((e) => Object.keys(e).sort().join() === "event,mode,session")).toBe(true);
  await hero.getByRole("link", { name: "开始找搭子" }).click();
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByTestId("demo-notice")).toBeVisible();
  await expect.poll(() => events.some((e) => e.event === "find_viewed" && e.mode === "demo")).toBe(true);
});

test("analytics rejects arbitrary properties and honors Do Not Track", async ({ request, baseURL }) => {
  const payload = { event: "home_viewed", mode: "public", session: crypto.randomUUID() };
  const post = (data: unknown, headers?: Record<string, string>) => request.post("/api/analytics", { data, headers });
  expect((await post({ ...payload, riot_id: "NeverStored#NA1" })).status()).toBe(400);
  expect((await post({ ...payload, event: "arbitrary" })).status()).toBe(400);
  expect((await post({ ...payload, session: "player-id" })).status()).toBe(400);
  expect((await post(payload, { origin: "https://other.invalid" })).status()).toBe(403);
  expect((await post(payload, { dnt: "1" })).status()).toBe(204);
  expect((await post(payload, { origin: baseURL! })).status()).toBe(204);
  // Duplicate milestones are idempotent.
  expect((await post(payload, { origin: baseURL! })).status()).toBe(204);
});

test("English home and focused login retain clear paths", async ({ page }) => {
  await page.route("**/api/champions", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByTestId("home-hero")).toContainText("Demo likes and matches are simulated");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Log in");
  await expect(page.getByTestId("home-hero")).toHaveCount(0);
});
