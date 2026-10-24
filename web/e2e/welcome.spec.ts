import { expect, test, type Page } from "@playwright/test";
import { member, setOptIn } from "./members";

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("测试账号名").fill(name);
  await page.getByRole("button", { name: "以测试账号登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("welcome sends logged-out visitors to login and unbound members to binding", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "welcome-unbound");
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/account#binding$/);
  await expect(page.getByRole("button", { name: "绑定", exact: true })).toBeVisible();
});

test("binding opens two-step onboarding with explicit consent and finishes at the real deck", async ({ page }) => {
  const events: { event: string; mode: string }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await login(page, "welcome-roles");
  await page.getByLabel("你的 Riot ID").fill("WelcomeRoles#NA1");
  await page.getByRole("button", { name: "绑定", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect.poll(() => events.filter((event) => event.event === "riot_bound").length).toBe(1);
  const wizard = page.getByTestId("welcome-onboarding");
  await expect(wizard.locator('[aria-current="step"]')).toHaveText(/选择想打的位置/);
  await wizard.getByText("打野", { exact: true }).click();
  await wizard.getByText("辅助", { exact: true }).click();
  await expect(wizard.getByRole("checkbox", { name: "上单", exact: true })).toBeDisabled();
  await wizard.getByRole("button", { name: "下一步：加入推荐池" }).click();
  await expect(wizard.locator('[aria-current="step"]')).toHaveText(/加入推荐池/);
  await expect(wizard.getByText("Riot ID 和联系方式只在互选后展示。")).toBeVisible();
  const consent = wizard.getByLabel(/同意被推荐/);
  const finish = wizard.getByRole("button", { name: "保存并开始找搭子" });
  await expect(consent).not.toBeChecked();
  await expect(finish).toBeDisabled();
  await wizard.getByRole("button", { name: "上一步" }).click();
  await expect(wizard.getByRole("checkbox", { name: "打野", exact: true })).toBeChecked();
  await wizard.getByRole("button", { name: "下一步：加入推荐池" }).click();
  await consent.check();
  await finish.click();
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByTestId("deck-owner")).toContainText("WelcomeRoles#NA1");
  await expect(page.getByTestId("demo-notice")).toHaveCount(0);
  await expect.poll(() => events.filter((event) => event.event === "recommendation_enabled").length).toBe(1);
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/find$/);
  await page.goto("/account");
  const prefs = page.getByTestId("prefs");
  await expect(prefs.getByRole("checkbox", { name: "打野", exact: true })).toBeChecked();
  await expect(prefs.getByRole("checkbox", { name: "辅助", exact: true })).toBeChecked();
  await expect(prefs.getByLabel(/同意被推荐/)).toBeChecked();
  await setOptIn(page, false);
  await page.goto("/find");
  await expect(page.getByTestId("demo-notice").getByRole("link", { name: "完成偏好与推荐" }))
    .toHaveAttribute("href", "/account#recommendation");
});

test("welcome can decline the pool without losing roles or existing optional settings", async ({ browser }) => {
  const page = await member(browser, "welcome-later", "WelcomeLater#NA1", false);
  try {
    const prefs = page.getByTestId("prefs");
    await prefs.getByLabel(/简介/).fill("晚上一起打");
    await prefs.getByText("English", { exact: true }).click();
    await prefs.getByLabel(/互选后给对方看我的 Discord 名/).check();
    await prefs.getByRole("button", { name: "保存", exact: true }).click();
    await expect(prefs.getByText("已保存")).toBeVisible();
    await page.goto("/welcome");
    await page.getByText("上单", { exact: true }).click();
    await page.getByRole("button", { name: "下一步：加入推荐池" }).click();
    await page.getByRole("button", { name: "暂时不加入，体验演示" }).click();
    await expect(page).toHaveURL(/\/find$/);
    await expect(page.getByTestId("demo-notice")).toBeVisible();
    await page.goto("/account");
    await expect(prefs.getByLabel(/同意被推荐/)).not.toBeChecked();
    await expect(prefs.getByRole("checkbox", { name: "上单", exact: true })).toBeChecked();
    await expect(prefs.getByLabel(/简介/)).toHaveValue("晚上一起打");
    await expect(prefs.getByRole("checkbox", { name: "English", exact: true })).toBeChecked();
    await expect(prefs.getByLabel(/互选后给对方看我的 Discord 名/)).toBeChecked();
  } finally { await page.context().close(); }
});

test("welcome reuses server role validation before enabling recommendations", async ({ browser }) => {
  const page = await member(browser, "welcome-validation", "WelcomeValidation#NA1", false);
  try {
    await page.goto("/welcome");
    await page.getByText("打野", { exact: true }).click();
    await page.getByText("辅助", { exact: true }).click();
    await page.getByRole("button", { name: "下一步：加入推荐池" }).click();
    await page.getByLabel(/同意被推荐/).check();
    // A submitted form can bypass disabled chips, so the shared server action must enforce the limit.
    await page.getByTestId("welcome-onboarding").locator("form").evaluate((form) => {
      const extra = document.createElement("input");
      extra.type = "hidden";
      extra.name = "positions";
      extra.value = "TOP";
      form.append(extra);
    });
    await page.getByRole("button", { name: "保存并开始找搭子" }).click();
    await expect(page.getByTestId("welcome-onboarding").getByRole("alert")).toHaveText("想打的位置最多选 2 个");
    await expect(page).toHaveURL(/\/welcome$/);
    await page.goto("/account");
    await expect(page.getByTestId("prefs").getByLabel(/同意被推荐/)).not.toBeChecked();
  } finally { await page.context().close(); }
});
