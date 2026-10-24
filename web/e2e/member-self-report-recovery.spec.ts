import { expect, test } from "@playwright/test";
import { member, setOptIn } from "./members";

test("member self-report save failure retains picks, supports editing, and retries the saved request", async ({ browser }) => {
  const page = await member(browser, "report-recovery", "ReportRecovery#NA1");
  const player = { riot_id: "ReportRecovery#NA1", tier: "GOLD", division: "II", league_points: 50,
    unranked: false, games: 4, wins: 2, insufficient_data: true, champions: [] };
  let saved = false;
  const writes: unknown[] = [];
  await page.route("**/api/lookups", (route) => route.fulfill({ json: { player } }));
  await page.route("**/api/champions", (route) => route.fulfill({ json: ["Ahri", "LeeSin"] }));
  await page.route("**/api/champion-positions", (route) => route.fulfill({ json: {} }));
  await page.route("**/champions/names.json", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/deck", (route) => route.fulfill(saved ? { json: {
    cards: [], likes_you: [], mutual: [], likes_remaining: 100, can_undo: false, retry_after: null,
    filter: { positions: [], languages: [], voice: false, looking_now: false }, looking_until: null, empty_reason: "no_candidates",
  } } : { status: 422, json: { detail: "数据不足，请先选几个常玩英雄", code: "insufficient_data" } }));
  await page.route("**/api/self-report", async (route) => {
    writes.push(route.request().postDataJSON());
    saved = writes.length >= 3;
    await route.fulfill(saved ? { json: { ok: true } } : { status: 503, json: { detail: "自选英雄保存失败" } });
  });
  try {
    await page.goto("/find");
    await page.getByRole("combobox", { name: "英雄 1", exact: true }).click();
    await page.getByRole("option", { name: "Ahri", exact: true }).click();
    await page.getByRole("combobox", { name: "位置 1", exact: true }).click();
    await page.getByRole("option", { name: "中单", exact: true }).click();
    await page.getByRole("button", { name: "用这些英雄估算", exact: true }).click();
    await expect(page.locator('[role="alert"].error')).toContainText("自选英雄保存失败");
    await expect(page.getByRole("combobox", { name: "英雄 1", exact: true })).toContainText("Ahri");
    await expect(page.getByRole("combobox", { name: "英雄 1", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "修改自选英雄", exact: true }).click();
    await page.getByRole("combobox", { name: "英雄 1", exact: true }).click();
    await page.getByRole("option", { name: "LeeSin", exact: true }).click();
    await page.getByRole("button", { name: "用这些英雄估算", exact: true }).click();
    await expect(page.locator('[role="alert"].error')).toContainText("自选英雄保存失败");
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByTestId("deck-empty")).toContainText("暂时没有可推荐的搭子");
    expect(writes).toEqual([
      { picks: [{ champion: "Ahri", position: "MIDDLE" }] },
      { picks: [{ champion: "LeeSin", position: "MIDDLE" }] },
      { picks: [{ champion: "LeeSin", position: "MIDDLE" }] },
    ]);
  } finally { await setOptIn(page, false); await page.context().close(); }
});
