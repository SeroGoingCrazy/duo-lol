import { expect, test, type Browser, type Page } from "@playwright/test";

// 滑卡 between real 会员 (PRD-v2 §3.2-3.4, §11): 喜欢我的人, 互选 reveals the Riot ID, 撤销, 举报 and 管理.
// Alice, Dave and Ivan are all 铂金 in data/fake_riot.py, so they can duo with each other.
const API = "http://127.0.0.1:8100";

async function member(browser: Browser, name: string, riotId?: string, optIn = true): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("测试账号名").fill(name);
  await page.getByRole("button", { name: "以测试账号登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
  if (!riotId) return page;
  await page.getByLabel("你的 Riot ID").fill(riotId);
  await page.getByRole("button", { name: "下一步" }).click();
  const icon = Number((await page.getByTestId("challenge-icon").innerText()).replace("#", ""));
  await page.request.post(`${API}/api/fake/icon`, { data: { riot_id: riotId, icon } });
  await page.getByRole("button", { name: "验证" }).click();
  await expect(page.getByTestId("bound-riot-id")).toHaveText(riotId);
  if (optIn) await setOptIn(page, true);
  await cached(page, riotId);
  return page;
}

/** Binding starts fetching the 会员's games; only cached players can be scored into a 牌堆. */
async function cached(page: Page, riotId: string) {
  await expect.poll(async () => {
    const r = await page.request.post(`${API}/api/lookups`, { data: { riot_id: riotId } });
    return (await r.json()).player?.riot_id ?? null;
  }, { timeout: 30_000 }).toBe(riotId);
}

async function setOptIn(page: Page, on: boolean) {
  await page.goto("/account");
  const prefs = page.getByTestId("prefs");
  await prefs.getByLabel(/同意被推荐/).setChecked(on);
  await prefs.getByRole("button", { name: "保存" }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
}

const remaining = (page: Page) => page.getByText(/剩余 \d+ \/ \d+/);

test("会员 滑卡: 喜欢 back makes a 互选, only then the Riot ID shows", async ({ browser }) => {
  test.setTimeout(180_000);
  const alice = await member(browser, "alice", "Alice#NA1");
  const dave = await member(browser, "dave", "Dave#NA1");

  await alice.goto("/find");
  await expect(alice.getByTestId("deck-owner")).toContainText("Alice#NA1");
  await expect(remaining(alice)).toHaveText("剩余 1 / 1", { timeout: 30_000 });
  await expect(alice.getByTestId("deck")).not.toContainText("Dave#NA1");   // hidden before 互选
  await alice.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(alice.getByTestId("deck-empty")).toBeVisible();
  await expect(alice.getByTestId("match-dialog")).toHaveCount(0);

  // Dave sees Alice under 喜欢我的人, opens her card and likes it: 互选
  await dave.goto("/find");
  await expect(remaining(dave)).toHaveText("剩余 1 / 1", { timeout: 30_000 });
  await dave.getByRole("tab", { name: /喜欢我的人/ }).click();
  await expect(dave.getByTestId("likes-list")).not.toContainText("Alice#NA1");
  await dave.getByTestId("likes-list").getByRole("button").first().click();
  await dave.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(dave.getByTestId("match-riot-id")).toHaveText("Alice#NA1");
  await dave.getByRole("button", { name: "继续滑" }).click();

  // both see it after a reload
  await alice.reload();
  await expect(alice.getByTestId("mutual-list")).toContainText("Dave#NA1", { timeout: 30_000 });
  await dave.reload();
  await expect(dave.getByTestId("mutual-list")).toContainText("Alice#NA1", { timeout: 30_000 });

  // 取消互选 removes it for both
  await dave.getByTestId("mutual-list").getByRole("button", { name: "取消互选" }).click();
  await expect(dave.getByTestId("mutual-list")).toHaveCount(0);
  await alice.reload();
  await expect(remaining(alice)).toBeVisible({ timeout: 30_000 });
  await expect(alice.getByTestId("mutual-list")).toHaveCount(0);
});

test("会员 滑卡: 撤销, 关闭同意被推荐, 举报 and the admin queue", async ({ browser }) => {
  test.setTimeout(180_000);
  const ivan = await member(browser, "ivan", "Ivan#NA1");
  const victor = await member(browser, "victor", "Victor#NA1");
  const unbound = await member(browser, "nobind");

  // not bound yet: the demo with a pointer to 我的账号
  await unbound.goto("/find");
  await expect(unbound.getByTestId("demo-notice")).toContainText("绑定 Riot 账号");

  await ivan.goto("/find");
  await expect(remaining(ivan)).toBeVisible({ timeout: 30_000 });
  const total = Number((await remaining(ivan).innerText()).match(/\/ (\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(1);
  await ivan.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(remaining(ivan)).toHaveText(`剩余 ${total - 1} / ${total}`);
  await ivan.getByRole("button", { name: "撤销上一次跳过" }).click();
  await expect(remaining(ivan)).toHaveText(`剩余 ${total} / ${total}`);

  // Victor stops 同意被推荐: gone from Ivan's new 牌堆
  await setOptIn(victor, false);
  await ivan.reload();
  await expect(remaining(ivan)).toHaveText(`剩余 ${total - 1} / ${total - 1}`, { timeout: 30_000 });
  await victor.goto("/find");
  await expect(victor.getByTestId("demo-notice")).toContainText("同意被推荐");

  // 举报 the top card: it leaves Ivan's 牌堆 and lands in the admin queue
  await ivan.getByRole("button", { name: "举报" }).click();
  await ivan.getByTestId("report-dialog").getByLabel("骚扰或辱骂").check();
  await ivan.getByRole("button", { name: "提交举报" }).click();
  await expect(remaining(ivan)).toHaveText(`剩余 ${total - 2} / ${total - 1}`);
  await ivan.reload();
  await expect(remaining(ivan).or(ivan.getByTestId("deck-empty")).first()).toBeVisible({ timeout: 30_000 });

  const notAdmin = await member(browser, "plain");
  const res = await notAdmin.goto("/admin");
  expect(res?.status()).toBe(404);

  const admin = await member(browser, "admin");
  await expect(admin.getByRole("link", { name: "管理" })).toBeVisible();
  await admin.goto("/admin");
  const queue = admin.getByTestId("report-queue");
  await expect(queue).toContainText("Ivan#NA1：骚扰或辱骂");
  await queue.getByRole("button", { name: "暂停推荐" }).first().click();
  await expect(admin.getByTestId("suspended")).toContainText("#NA1");
  await admin.getByTestId("suspended").getByRole("button", { name: "恢复" }).first().click();
  await expect(admin.getByTestId("suspended")).toContainText("没有被暂停的会员");
});
