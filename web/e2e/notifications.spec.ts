import { expect, test, type Page } from "@playwright/test";
import { member, setOptIn } from "./members";

// 互选通知 in the nav and 一起打的战绩 on the 互选 list. In data/fake_riot.py DuoA (白银) and DuoB (黄金)
// played 10 Solo/Duo games on the same team and won 7.

const badge = (page: Page) => page.getByTestId("unseen-badge");

test("a 喜欢 and a 互选 show in the nav until 找搭子 is opened, and the 互选 shows games played together", async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await member(browser, "duoa", "DuoA#NA1");
  const b = await member(browser, "duob", "DuoB#NA1");

  await a.goto("/find");
  await expect(a.getByText(/剩余 \d+ \/ \d+/)).toHaveText("剩余 1 / 1", { timeout: 30_000 });
  await a.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(a.getByTestId("deck-empty")).toBeVisible();

  // B is told about the 喜欢 on any page, and likes back from 喜欢我的人
  await b.goto("/account");
  await expect(badge(b)).toHaveText("1");
  await b.getByRole("link", { name: /找搭子/ }).click();
  await expect(badge(b)).toHaveCount(0);
  await b.getByRole("tab", { name: /喜欢我的人/ }).click({ timeout: 30_000 });
  await b.getByTestId("likes-list").getByRole("button").first().click();
  await b.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(b.getByTestId("match-riot-id")).toHaveText("DuoA#NA1");
  await b.getByRole("button", { name: "继续滑" }).click();
  await b.getByRole("tab", { name: /互选/ }).click();
  await expect(b.getByTestId("duo-record")).toHaveText("本赛季一起打了 10 局，赢 7 局");   // without a reload
  // B made this 互选 themselves, so it isn't news to B
  const bChecked = b.waitForResponse((r) => r.url().endsWith("/api/notifications"));
  await b.goto("/account");
  expect(await (await bChecked).json()).toEqual({ unseen: 0 });

  // A was away: the 互选 waits in the nav, and opening 找搭子 clears it
  await a.goto("/account");
  await expect(badge(a)).toHaveText("1");
  await a.goto("/find");
  await expect(a.getByTestId("mutual-list")).toContainText("DuoB#NA1", { timeout: 30_000 });
  await expect(a.getByTestId("duo-record")).toHaveText("本赛季一起打了 10 局，赢 7 局");
  const checked = a.waitForResponse((r) => r.url().endsWith("/api/notifications"));
  await a.goto("/account");
  expect(await (await checked).json()).toEqual({ unseen: 0 });
  await expect(badge(a)).toHaveCount(0);

  for (const p of [a, b]) await setOptIn(p, false);
});
