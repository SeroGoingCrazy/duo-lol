import { expect, test, type Page } from "@playwright/test";

// 滑卡 between real 会员 (PRD-v2 §3.2-3.4, §11): 喜欢我的人, 互选 reveals the Riot ID, 撤销, 举报 and 管理.
// Alice, Dave and Ivan are all 铂金 in data/fake_riot.py, so they can duo with each other.
import { member, setOptIn } from "./members";

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

  // the demo shows Riot IDs on its cards, so it never deals 会员
  const demo = await (await unbound.request.post("/api/recommendations", { data: { riot_id: "Ivan#NA1", limit: 200 } })).json();
  expect(demo.partners.length).toBeGreaterThan(0);
  for (const p of demo.partners) expect(["Alice#NA1", "Dave#NA1", "Victor#NA1"]).not.toContain(p.riot_id);

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
