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

/** The summoner icon id shown as the 头像 in the nav. */
const iconOf = async (page: Page) =>
  Number((await page.getByTestId("nav-avatar").locator("img").getAttribute("src"))?.match(/profileicon\/(\d+)\.png/)?.[1]);

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
  await expect.poll(() => iconOf(page)).toBe(12);
  await card.getByRole("button", { name: "用我游戏里的头像" }).click();
  await expect.poll(() => iconOf(page)).toBe(7);

  // 偏好: at most two positions, 同意被推荐 starts off
  const prefs = page.getByTestId("prefs");
  await expect(prefs.getByLabel(/同意被推荐/)).not.toBeChecked();
  await prefs.getByText("打野").click();
  await prefs.getByText("辅助").click();
  await expect(prefs.getByRole("checkbox", { name: "上单" })).toBeDisabled();
  await prefs.getByLabel(/同意被推荐/).check();
  await prefs.getByRole("button", { name: "保存", exact: true }).click();
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
  await expect(second.getByTestId("bound-riot-id")).toHaveText(/^owner#na1$/i);
});

test("account page needs login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("new members explicitly opt in before continuing to real members", async ({ page }) => {
  await login(page, "onboarding");
  const steps = page.getByTestId("onboarding");
  await expect(steps.getByText("三步开始找搭子")).toBeVisible();
  await expect(steps.locator('[aria-current="step"]')).toContainText("绑定 Riot 账号");
  await bind(page, "Onboarding#NA1");
  await expect(page.getByTestId("bound-riot-id")).toHaveText("Onboarding#NA1");
  await expect(steps.locator('[aria-current="step"]')).toContainText("偏好与推荐");
  await page.getByRole("link", { name: "下一步：偏好与推荐" }).click();

  const prefs = page.getByTestId("prefs");
  const consent = prefs.getByLabel(/同意被推荐/);
  const start = prefs.getByRole("button", { name: "保存并开始找搭子" });
  await expect(consent).not.toBeChecked();
  await expect(start).toBeDisabled();
  // Consent and the next step precede optional profile fields, so neither is buried in the form.
  expect(await prefs.locator("input").first().getAttribute("name")).toBe("recommend_opt_in");
  await consent.check();
  await start.click();
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByTestId("deck-owner")).toContainText("Onboarding#NA1");
  await expect(page.getByTestId("demo-notice")).toHaveCount(0);

  await page.goto("/account");
  await expect(steps.getByText("准备好了，去认识真实会员")).toBeVisible();
  await expect(consent).toBeChecked();
  await consent.uncheck();
  await prefs.getByRole("button", { name: "保存", exact: true }).click();
  await expect(prefs.getByText("已保存")).toBeVisible();
  await page.goto("/find");
  await expect(page.getByTestId("demo-notice").getByRole("link", { name: "完成偏好与推荐" }))
    .toHaveAttribute("href", "/account#recommendation");
});
