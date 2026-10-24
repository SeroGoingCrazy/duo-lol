// Helpers for specs that log in as test 会员 and bind fake Riot accounts (data/fake_riot.py).
import { expect, type Browser, type Page } from "@playwright/test";

export const API = "http://127.0.0.1:8100";

export async function member(browser: Browser, name: string, riotId?: string, optIn = true): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("测试账号名").fill(name);
  await page.getByRole("button", { name: "以测试账号登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
  if (!riotId) return page;
  await page.getByLabel("你的 Riot ID").fill(riotId);
  await page.getByRole("button", { name: "绑定", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByTestId("bound-riot-id")).toHaveText(riotId);
  if (optIn) {
    await page.getByRole("button", { name: "下一步：加入推荐池" }).click();
    await page.getByLabel(/同意被推荐/).check();
    await page.getByRole("button", { name: "保存并开始找搭子" }).click();
    await expect(page).toHaveURL(/\/find$/);
  }
  await page.goto("/account");
  await cached(page, riotId);
  return page;
}

/** Binding starts fetching the 会员's games; only cached players can be scored into a 牌堆. */
export async function cached(page: Page, riotId: string) {
  await expect.poll(async () => {
    const r = await page.request.post(`${API}/api/lookups`, { data: { riot_id: riotId } });
    return (await r.json()).player?.riot_id ?? null;
  }, { timeout: 30_000 }).toBe(riotId);
}

export async function setOptIn(page: Page, on: boolean) {
  await page.goto("/account");
  const prefs = page.getByTestId("prefs");
  await prefs.getByLabel(/同意被推荐/).setChecked(on);
  await prefs.getByRole("button", { name: "保存", exact: true }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
}

