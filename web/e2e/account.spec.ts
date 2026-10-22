import { expect, test, type Page } from "@playwright/test";

// 登录与绑定 (PRD-v2 §3.1, M2) with the 测试登录 stand-in for Discord and the fake Riot client.
const API = "http://127.0.0.1:8100";

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("测试账号名").fill(name);
  await page.getByRole("button", { name: "以测试账号登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function bind(page: Page, riotId: string) {
  await page.getByLabel("你的 Riot ID").fill(riotId);
  await page.getByRole("button", { name: "绑定", exact: true }).click();
}

const iconOf = async (page: Page, testId = "avatar") =>
  Number((await page.getByTestId(testId).first().getAttribute("src"))?.match(/profileicon\/(\d+)\.png/)?.[1]);

test("登录: bind a Riot ID (未验证, ADR-0011), pick a 头像, set 偏好, then 注销", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "登录" }).click();
  await login(page, "binder");
  await expect(page.getByRole("link", { name: "binder" })).toBeVisible();
  await expect(page.getByTestId("prefs")).toContainText("绑定 Riot 账号后");

  // binding takes effect at once, marked 未验证, and the 头像 becomes the in-game icon
  await page.request.post(`${API}/api/fake/icon`, { data: { riot_id: "Binder#NA1", icon: 7 } });
  await bind(page, "Binder#NA1");
  await expect(page.getByTestId("bound-riot-id")).toHaveText("Binder#NA1");
  await expect(page.getByTestId("riot-unverified")).toHaveText("未验证");
  await expect.poll(() => iconOf(page)).toBe(7);

  // pick another Riot icon by searching its id, then go back to the in-game one
  const card = page.getByTestId("avatar-card");
  await card.getByRole("button", { name: "从 Riot 头像里选" }).click();
  await card.getByLabel("搜索头像").fill("12");
  await card.getByRole("radiogroup").getByRole("radio").first().click();
  await card.getByRole("button", { name: "用这个头像" }).click();
  await expect(card.getByText("头像已更新")).toBeVisible();
  await expect.poll(() => iconOf(page, "nav-avatar")).toBe(12);
  await card.getByRole("button", { name: "用我游戏里的头像" }).click();
  await expect.poll(() => iconOf(page, "nav-avatar")).toBe(7);

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
  await expect(page.getByRole("button", { name: "绑定", exact: true })).toBeVisible();
});

test("登录: one Riot account binds to one 会员 until they unbind it", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  await login(first, "owner");
  await bind(first, "Owner#NA1");
  await expect(first.getByTestId("bound-riot-id")).toHaveText("Owner#NA1");

  const second = await (await browser.newContext()).newPage();
  await login(second, "impostor");
  await bind(second, "owner#na1");
  await expect(second.getByTestId("bind-riot").getByRole("alert")).toContainText("已经被别的会员绑定");

  // 换一个 Riot ID frees it
  await first.getByRole("button", { name: "换一个 Riot ID" }).click();
  await expect(first.getByRole("button", { name: "绑定", exact: true })).toBeVisible();
  await bind(second, "owner#na1");
  await expect(second.getByTestId("bound-riot-id")).toHaveText("Owner#NA1");
});

test("account page needs login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});
