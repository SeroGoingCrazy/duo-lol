import { expect, test } from "@playwright/test";

test("navigate from the deck to 查组合, predict, reload and return", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const player = (riot_id: string) => ({
    riot_id, tier: "GOLD", division: "II", league_points: 50,
    unranked: false, games: 40, insufficient_data: false,
    champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
  });
  await page.route("**/api/champions", (r) => r.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/champions/names.json", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/lookups", (r) => r.fulfill({ json: { player: player(r.request().postDataJSON().riot_id) } }));
  await page.route("**/api/pair", (r) => r.fulfill({ json: {
    a: player("Alpha#NA1"), b: player("Bravo#NA1"), score: 84, score_by_roles: true,
    win_rate: 0.536, win_rate_delta: 0.016, solo_baselines: { a: 0.52, b: 0.52 },
    roles: { a: "MIDDLE", b: "JUNGLE" }, notes: [],
    top_pairs: [{ champion_a: "Ahri", champion_b: "LeeSin", win_rate: 0.54, pair_games: 1000 }],
  } }));

  await page.goto("/find");
  await page.getByRole("link", { name: "查组合", exact: true }).click();
  await page.getByLabel("玩家 A").fill("Alpha#NA1");
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "预测", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  await expect(page.getByTestId("score")).toHaveText("84分");
  await expect(page.getByText("在中单 + 打野组合里排前 16%")).toBeVisible();
  await expect(page.getByTestId("win-rate")).toBeHidden();
  await expect(page.getByTestId("win-rate-delta")).toBeHidden();
  await page.getByTestId("score-calculation").locator("summary").click();
  await expect(page.getByTestId("win-rate")).toHaveText("53.6%");
  await expect(page.getByTestId("win-rate-delta")).toHaveText("比你们单排平均高 1.6 个百分点");
  await expect(page.getByTestId("player-card")).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  // Returning home clears the previous check and restores the landing page.
  await page.getByRole("link", { name: "匹配搭子", exact: true }).click();
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await expect(page.getByLabel("玩家 A")).toHaveValue("");
  await expect(page.getByTestId("pair-result")).toHaveCount(0);
  await page.getByRole("link", { name: "找搭子", exact: true }).click();
  await expect(page.getByLabel("你的 Riot ID")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

for (const scoreByRoles of [true, false]) {
  test(`100th percentile avoids claiming to beat every pair, role comparison ${scoreByRoles}`, async ({ page }) => {
    const player = (riot_id: string) => ({ riot_id, tier: "GOLD", games: 40, champions: [] });
    await page.route("**/api/champions", (route) => route.fulfill({ json: [] }));
    await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/lookups", (route) => route.fulfill({ json: { player: player(route.request().postDataJSON().riot_id) } }));
    await page.route("**/api/pair", (route) => route.fulfill({ json: {
      a: player("Alpha#NA1"), b: player("Bravo#NA1"), score: 100, score_by_roles: scoreByRoles,
      win_rate: 0.6, win_rate_delta: 0.05, solo_baselines: { a: 0.55, b: 0.55 },
      roles: { a: "TOP", b: "JUNGLE" }, notes: [], top_pairs: [],
    } }));
    await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
    const result = page.getByTestId("pair-result");
    await expect(result).toContainText(scoreByRoles ? "超过几乎所有上单 + 打野组合" : "超过几乎所有可双排组合");
    await expect(result).not.toContainText("100%");
    await page.getByTestId("lang-switch").getByRole("button", { name: "English" }).click();
    await expect(result).toContainText(scoreByRoles ? "Better than nearly all Top + Jungle pairs" : "Better than nearly all pairs who can queue together");
    await expect(result).not.toContainText("100%");
    await expect(result.getByTestId("win-rate")).toBeHidden();
  });
}

test("pair invitation keeps only the entered IDs, translates copy, and waits for login state", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const player = (riot_id: string) => ({ riot_id, tier: "GOLD", games: 40, champions: [] });
  await page.route("**/api/champions", (route) => route.fulfill({ json: [] }));
  await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player: player(route.request().postDataJSON().riot_id) } }));
  await page.route("**/api/pair", (route) => route.fulfill({ json: {
    a: player("Alpha#NA1"), b: player("Bravo#NA1"), score: 84, score_by_roles: true,
    win_rate: 0.54, win_rate_delta: 0.02, solo_baselines: { a: 0.52, b: 0.52 },
    roles: { a: "MIDDLE", b: "JUNGLE" }, notes: [], top_pairs: [],
  } }));
  let releaseSession!: () => void;
  const sessionReady = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route("**/api/auth/session", async (route) => {
    await sessionReady;
    await route.fulfill({ json: { user: { id: "private-member", name: "PrivateMember#NA1" } } });
  });
  await page.goto("/?a=alpha%23na1&b=bravo%23na1&member=PrivateMember%23NA1#duo-check");
  try {
    await expect(page.getByTestId("pair-result")).toBeVisible();
    await expect(page.getByRole("button", { name: "找更多像 TA 的搭子" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "找更多像 TA 的搭子" })).toHaveCount(0);
  } finally { releaseSession(); }
  await expect(page.getByRole("link", { name: "找更多像 TA 的搭子" })).toHaveAttribute("href", "/find");
  await page.getByTestId("lang-switch").getByRole("button", { name: "English" }).click();
  await expect(page.getByTestId("pair-result")).toContainText("invite them to sign up and join the recommendation pool");
  // Same-page anchor navigation can clear the query while the result stays mounted.
  await page.evaluate(() => window.history.replaceState(null, "", "/#duo-check"));
  await page.getByRole("button", { name: "Invite them to join" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Sign up and join the recommendation pool");
  const invitation = await page.evaluate(() => navigator.clipboard.readText());
  expect(invitation).toContain("Sign up and join the recommendation pool");
  const url = new URL(invitation.split("\n")[1]);
  expect([...url.searchParams]).toEqual([["a", "alpha#na1"], ["b", "bravo#na1"]]);
  expect(url.hash).toBe("");
  expect(invitation).not.toContain("PrivateMember");
  await expect(page.getByRole("link", { name: "Find more partners like them" })).toHaveAttribute("href", "/find");
});
