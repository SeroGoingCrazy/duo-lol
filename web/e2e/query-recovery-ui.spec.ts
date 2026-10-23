import { expect, test, type Page } from "@playwright/test";
import type { PairResult, Player } from "../lib/api";

const player = (riot_id: string, insufficient_data = false): Player => ({
  riot_id, tier: "GOLD", division: "II", league_points: 50,
  unranked: false, games: insufficient_data ? 4 : 40, wins: 22, insufficient_data,
  champions: [{ champion: "Ahri", position: "MIDDLE", games: 40, wins: 22 }],
});
const pair: PairResult = {
  a: player("Alpha#NA1"), b: player("Bravo#NA1"), score: 84, score_by_roles: true,
  win_rate: 0.536, win_rate_delta: 0.016, solo_baselines: { a: 0.52, b: 0.52 },
  roles: { a: "MIDDLE", b: "JUNGLE" }, notes: [],
  top_pairs: [{ champion_a: "Ahri", champion_b: "LeeSin", win_rate: 0.54, pair_games: 1000 }],
};

async function submitPick(page: Page) {
  await page.getByRole("combobox", { name: "英雄 1", exact: true }).click();
  await page.getByRole("option", { name: "Ahri", exact: true }).click();
  await page.getByRole("combobox", { name: "位置 1", exact: true }).click();
  await page.getByRole("option", { name: "中单", exact: true }).click();
  await page.getByRole("button", { name: "用这些英雄估算", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/champions", (r) => r.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/api/champion-positions", (r) => r.fulfill({ json: {} }));
  await page.route("**/champions/names.json", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/analytics", (r) => r.fulfill({ json: { ok: true } }));
});

test("single member ID prefills A and focuses the friend field without querying", async ({ page }) => {
  const lookups: string[] = [];
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    return r.fulfill({ json: { player: player(id) } });
  });
  await page.route("**/api/pair", (r) => r.fulfill({ json: pair }));
  await page.goto("/?a=Alpha%23NA1#duo-check");
  await expect(page.getByLabel("玩家 A")).toHaveValue("Alpha#NA1");
  await expect(page.getByLabel("玩家 B")).toBeFocused();
  await expect(page.getByTestId("home-hero")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "预测", exact: true })).toBeDisabled();
  expect(lookups).toEqual([]);
  await page.getByLabel("玩家 B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "预测", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  expect(lookups).toEqual(["Alpha#NA1", "Bravo#NA1"]);
});

test("pair lookup retry resumes B and retains A and both entered IDs", async ({ page }) => {
  const lookups: string[] = [];
  let failed = false;
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    if (id === "Bravo#NA1" && !failed) {
      failed = true;
      return r.fulfill({ status: 503, json: { detail: "查询暂时失败" } });
    }
    return r.fulfill({ json: { player: player(id) } });
  });
  await page.route("**/api/pair", (r) => r.fulfill({ json: pair }));
  await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
  await expect(page.locator('[role="alert"].error')).toContainText("查询暂时失败");
  await expect(page.getByTestId("loaded-player-previews")).toContainText("Alpha#NA1");
  await expect(page.getByLabel("玩家 A")).toHaveValue("Alpha#NA1");
  await expect(page.getByLabel("玩家 B")).toHaveValue("Bravo#NA1");
  await expect(page.getByTestId("progress")).toHaveCount(0);
  await page.getByRole("button", { name: "重试查询", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  await expect(page.locator('[role="alert"].error')).toHaveCount(0);
  expect(lookups).toEqual(["Alpha#NA1", "Bravo#NA1", "Bravo#NA1"]);
});

test("pair scoring retry keeps the chosen champions and never reloads players", async ({ page }) => {
  const lookups: string[] = [];
  const requests: unknown[] = [];
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    return r.fulfill({ json: { player: player(id, id === "Alpha#NA1") } });
  });
  await page.route("**/api/pair", (r) => {
    requests.push(r.request().postDataJSON());
    return requests.length === 1
      ? r.fulfill({ status: 503, json: { detail: "评分暂时失败" } })
      : r.fulfill({ json: pair });
  });
  await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
  await submitPick(page);
  await expect(page.locator('[role="alert"].error')).toContainText("评分暂时失败");
  await expect(page.getByTestId("loaded-player-previews").getByTestId("player-card")).toHaveCount(2);
  await expect(page.getByLabel("玩家 A")).toHaveValue("Alpha#NA1");
  await expect(page.getByLabel("玩家 B")).toHaveValue("Bravo#NA1");
  await page.getByRole("button", { name: "重试评分", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toBeVisible();
  await expect(page.locator('[role="alert"].error')).toHaveCount(0);
  expect(lookups).toEqual(["Alpha#NA1", "Bravo#NA1"]);
  expect(requests).toEqual(Array(2).fill({
    a: "Alpha#NA1", b: "Bravo#NA1",
    a_self_report: { picks: [{ champion: "Ahri", position: "MIDDLE" }] }, b_self_report: null,
  }));
  await page.getByRole("button", { name: "修改自选英雄", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "英雄 1", exact: true })).toContainText("Ahri");
  await expect(page.getByRole("combobox", { name: "位置 1", exact: true })).toContainText("中单");
});

test("demo recommendation retry preserves ID and self-report and skips player lookup", async ({ page }) => {
  const lookups: string[] = [];
  const requests: unknown[] = [];
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    return r.fulfill({ json: { player: player(id, true) } });
  });
  await page.route("**/api/recommendations", (r) => {
    requests.push(r.request().postDataJSON());
    return requests.length <= 2
      ? r.fulfill({ status: 503, json: { detail: "推荐暂时失败" } })
      : r.fulfill({ json: { me: player("Alpha#NA1", true), partners: [], notes: [] } });
  });
  await page.goto("/find?me=Alpha%23NA1");
  await submitPick(page);
  await expect(page.locator('[role="alert"].error')).toContainText("推荐暂时失败");
  await expect(page.getByLabel("你的 Riot ID")).toHaveValue("Alpha#NA1");
  await page.getByRole("button", { name: "重试推荐", exact: true }).click();
  await expect(page.locator('[role="alert"].error')).toContainText("推荐暂时失败");
  await page.getByRole("button", { name: "修改自选英雄", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "英雄 1", exact: true })).toContainText("Ahri");
  await expect(page.getByRole("combobox", { name: "位置 1", exact: true })).toContainText("中单");
  await page.getByRole("button", { name: "用这些英雄估算", exact: true }).click();
  await expect(page.getByText("推荐池里暂时没有能和你一起排的玩家。", { exact: true })).toBeVisible();
  await expect(page.locator('[role="alert"].error')).toHaveCount(0);
  expect(lookups).toEqual(["Alpha#NA1"]);
  expect(requests).toEqual(Array(3).fill({
    riot_id: "Alpha#NA1", self_report: { picks: [{ champion: "Ahri", position: "MIDDLE" }] }, limit: 200,
  }));
});

test("demo player lookup can be retried with the entered ID", async ({ page }) => {
  const lookups: string[] = [];
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    return lookups.length === 1
      ? r.fulfill({ status: 503, json: { detail: "查询暂时失败" } })
      : r.fulfill({ json: { player: player(id) } });
  });
  await page.route("**/api/recommendations", (r) => r.fulfill({ json: { me: player("Alpha#NA1"), partners: [], notes: [] } }));
  await page.goto("/find?me=Alpha%23NA1");
  await expect(page.locator('[role="alert"].error')).toContainText("查询暂时失败");
  await expect(page.getByLabel("你的 Riot ID")).toHaveValue("Alpha#NA1");
  await page.getByRole("button", { name: "重试查询", exact: true }).click();
  await expect(page.getByText("推荐池里暂时没有能和你一起排的玩家。", { exact: true })).toBeVisible();
  await expect(page.locator('[role="alert"].error')).toHaveCount(0);
  expect(lookups).toEqual(["Alpha#NA1", "Alpha#NA1"]);
});


test("editing a failed pair request clears its retry and queries the new player", async ({ page }) => {
  const lookups: string[] = [];
  await page.route("**/api/lookups", (r) => {
    const id = r.request().postDataJSON().riot_id;
    lookups.push(id);
    return id === "Bravo#NA1"
      ? r.fulfill({ status: 503, json: { detail: "查询暂时失败" } })
      : r.fulfill({ json: { player: player(id) } });
  });
  await page.route("**/api/pair", (r) => r.fulfill({ json: { ...pair, b: player(r.request().postDataJSON().b) } }));
  await page.goto("/?a=Alpha%23NA1&b=Bravo%23NA1");
  await expect(page.getByRole("button", { name: "重试查询", exact: true })).toBeVisible();
  await page.getByLabel("玩家 B").fill("Charlie#NA1");
  await expect(page.locator('[role="alert"].error')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重试查询", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "预测", exact: true }).click();
  await expect(page.getByTestId("pair-result")).toContainText("Charlie#NA1");
  expect(lookups).toEqual(["Alpha#NA1", "Bravo#NA1", "Alpha#NA1", "Charlie#NA1"]);
});

test("late demo recommendations cannot replace a new ID's deck", async ({ page }) => {
  let releaseOld!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  let oldStarted = false;
  const requests: string[] = [];
  await page.route("**/api/lookups", (r) => r.fulfill({ json: { player: player(r.request().postDataJSON().riot_id) } }));
  await page.route("**/api/recommendations", async (r) => {
    const id = r.request().postDataJSON().riot_id;
    requests.push(id);
    if (id === "Alpha#NA1") { oldStarted = true; await oldResponse; }
    return r.fulfill({ json: { me: player(id), partners: [], notes: [] } });
  });
  await page.goto("/find?me=Alpha%23NA1");
  await expect.poll(() => oldStarted).toBe(true);
  await page.getByLabel("你的 Riot ID").fill("Charlie#NA1");
  await page.getByRole("button", { name: "开始滑卡", exact: true }).click();
  await expect(page.locator("summary")).toContainText("Charlie#NA1");
  const oldReceived = page.waitForResponse((response) => response.url().endsWith("/api/recommendations") && response.request().postDataJSON().riot_id === "Alpha#NA1");
  releaseOld();
  await (await oldReceived).finished();
  // Allow the completed response's React update to commit before checking it was ignored.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator("summary")).toContainText("Charlie#NA1");
  expect(requests).toEqual(["Alpha#NA1", "Charlie#NA1"]);
});
