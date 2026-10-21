import { expect, test, type Page } from "@playwright/test";

// 登录与绑定 (PRD-v2 §3.1, M2) with the 测试登录 stand-in for Discord and the fake Riot client.
const API = "http://127.0.0.1:8100";

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("测试账号名").fill(name);
  await page.getByRole("button", { name: "以测试账号登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function startBinding(page: Page, riotId: string) {
  await page.getByLabel("你的 Riot ID").fill(riotId);
  await page.getByRole("button", { name: "下一步" }).click();
}

test("登录: bind a Riot ID by wearing the asked icon, set 偏好, then 注销", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "登录" }).click();
  await login(page, "binder");
  await expect(page.getByRole("link", { name: "binder" })).toBeVisible();
  await expect(page.getByTestId("prefs")).toContainText("绑定 Riot 账号后");

  await startBinding(page, "Binder#NA1");
  const icon = Number((await page.getByTestId("challenge-icon").innerText()).replace("#", ""));

  // still wearing the old icon: told what to change
  await page.getByRole("button", { name: "验证" }).click();
  await expect(page.getByTestId("bind-riot").getByRole("alert")).toContainText(`需要换成 #${icon}`);

  // "changes it in the client", then 验证 passes
  await page.request.post(`${API}/api/fake/icon`, { data: { riot_id: "Binder#NA1", icon } });
  await page.getByRole("button", { name: "验证" }).click();
  await expect(page.getByTestId("bound-riot-id")).toHaveText("Binder#NA1");

  // 偏好: at most two positions, 同意被推荐 starts off
  const prefs = page.getByTestId("prefs");
  await expect(prefs.getByLabel(/同意被推荐/)).not.toBeChecked();
  await prefs.getByText("打野").click();
  await prefs.getByText("辅助").click();
  await expect(prefs.getByRole("checkbox", { name: "上单" })).toBeDisabled();
  await prefs.getByLabel(/同意被推荐/).check();
  await prefs.getByRole("button", { name: "保存" }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
  await page.reload();
  await expect(prefs.getByLabel(/同意被推荐/)).toBeChecked();
  await expect(prefs.getByRole("checkbox", { name: "打野" })).toBeChecked();

  // 注销 logs out and removes the 会员: logging in again starts unbound
  await page.getByRole("button", { name: "注销账号" }).click();
  await page.getByRole("button", { name: "确认注销" }).click();
  await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
  await login(page, "binder");
  await expect(page.getByRole("button", { name: "下一步" })).toBeVisible();
});

test("登录: one Riot account binds to one 会员", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  await login(first, "owner");
  await startBinding(first, "Owner#NA1");
  const icon = Number((await first.getByTestId("challenge-icon").innerText()).replace("#", ""));
  await first.request.post(`${API}/api/fake/icon`, { data: { riot_id: "Owner#NA1", icon } });
  await first.getByRole("button", { name: "验证" }).click();
  await expect(first.getByTestId("bound-riot-id")).toHaveText("Owner#NA1");

  const second = await (await browser.newContext()).newPage();
  await login(second, "impostor");
  await startBinding(second, "owner#na1");
  await expect(second.getByTestId("bind-riot").getByRole("alert")).toContainText("已经绑定了别的会员");
});

test("account page needs login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});
