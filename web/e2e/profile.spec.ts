import { expect, test, type Page } from "@playwright/test";
import { member, setOptIn } from "./members";

// 简介, 现在想打 and 牌堆 filters. Rosa, Jade and Uma can all duo with each other in data/fake_riot.py
// (铂金, 铂金, 黄金). Other specs' 会员 may be in the pool too, but they set no language and aren't looking now.

async function savePrefs(page: Page, { bio, languages = [], voice }: { bio: string; languages?: string[]; voice?: string }) {
  await page.goto("/account");
  const prefs = page.getByTestId("prefs");
  await prefs.getByLabel(/简介/).fill(bio);
  for (const l of languages) await prefs.getByText(l, { exact: true }).click();
  if (voice) await prefs.getByText(voice, { exact: true }).click();
  await prefs.getByRole("button", { name: "保存" }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
}

const cardsLeft = (page: Page) => page.getByText(/剩余 \d+ \/ \d+/);

test("简介 and tags show on the card, contact details are refused, filters and 现在想打 narrow the deck", async ({ browser }) => {
  test.setTimeout(240_000);
  const rosa = await member(browser, "rosa", "Rosa#NA1");
  const jade = await member(browser, "jade", "Jade#NA1");
  const uma = await member(browser, "uma", "Uma#NA1");

  // a 简介 can't carry a way to reach someone before 互选
  await jade.goto("/account");
  await jade.getByTestId("prefs").getByLabel(/简介/).fill("add me on discord: jade123");
  await jade.getByTestId("prefs").getByRole("button", { name: "保存" }).click();
  await expect(jade.getByTestId("prefs")).toContainText("简介里不能写联系方式");
  await savePrefs(jade, { bio: "主玩辅助，晚上打", languages: ["한국어"], voice: "开麦" });
  await savePrefs(uma, { bio: "Chill jungler", languages: ["English"] });

  // Uma says she's looking now
  await uma.goto("/find");
  await expect(cardsLeft(uma)).toBeVisible({ timeout: 30_000 });
  await uma.getByTestId("looking-toggle").click();
  await expect(uma.getByTestId("looking-toggle")).toHaveAttribute("aria-pressed", "true");

  await rosa.goto("/find");
  await expect(cardsLeft(rosa)).toBeVisible({ timeout: 30_000 });
  const filters = rosa.getByTestId("deck-filters");
  await filters.getByRole("button", { name: "筛选" }).click();

  // language filter: only Jade speaks Korean; her card shows her 简介 and tags
  await filters.getByText("한국어", { exact: true }).click();
  await expect(rosa.getByTestId("card-profile")).toContainText("主玩辅助，晚上打", { timeout: 30_000 });
  await expect(cardsLeft(rosa)).toHaveText("剩余 1 / 1");
  await expect(rosa.getByTestId("card-profile")).toContainText("한국어 · 开麦");

  // 现在想打 instead: only Uma
  await filters.getByText("한국어", { exact: true }).click();
  await filters.getByText("现在想打", { exact: true }).click();
  await expect(rosa.getByTestId("card-profile")).toContainText("Chill jungler", { timeout: 30_000 });
  await expect(cardsLeft(rosa)).toHaveText("剩余 1 / 1");
  await expect(rosa.getByTestId("looking-badge")).toBeVisible();

  // filters are saved: still on after a reload, and nobody left once both are on
  await rosa.reload();
  await expect(filters.getByText("已开启")).toBeVisible({ timeout: 30_000 });
  await filters.getByText("한국어", { exact: true }).click();
  await expect(rosa.getByTestId("deck-empty")).toContainText("放宽", { timeout: 30_000 });

  // leave the pool as we found it for the other specs
  for (const p of [rosa, jade, uma]) await setOptIn(p, false);
});
