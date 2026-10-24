import { expect, test, type Page } from "@playwright/test";

// The site is in 中文 until the nav's 中文 / English switch picks English; the choice is remembered in a cookie.
test.use({ locale: "en-US" });

async function toEnglish(page: Page) {
  await page.getByTestId("lang-switch").getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test("中文 by default even in an English browser; the switch picks English and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("link", { name: "查组合", exact: true })).toBeVisible();
  await toEnglish(page);
  await expect(page.getByRole("link", { name: "Duo check", exact: true })).toBeVisible();
  await page.getByLabel("Player A").fill("Alpha#NA1");
  await page.getByLabel("Player B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "Predict" }).click();
  const result = page.getByTestId("pair-result");
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toContainText(/Top \d+%|Better than nearly all/);
  await expect(result.getByTestId("win-rate")).toBeHidden();
  await result.getByTestId("score-calculation").locator("summary").click();
  await expect(result.getByTestId("win-rate")).toBeVisible();
  await expect(result).toContainText(/(above|below) your solo average/);
  await expect(page.getByTestId("roles")).toContainText(/Top|Jungle|Mid|Bot|Support/);
  await expect(page.getByTestId("footer")).toContainText("not a skill, rank or MMR rating");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");   // remembered

  await page.getByTestId("lang-switch").getByRole("button", { name: "中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("link", { name: "查组合", exact: true })).toBeVisible();
});

test("English demo deck: card text and the model's reasons", async ({ page }) => {
  await page.goto("/");
  await toEnglish(page);
  await page.goto("/find?me=Alpha%23NA1");
  const card = page.getByTestId("swipe-card");
  await expect(card).toContainText("Duo score", { timeout: 60_000 });
  await card.getByRole("button", { name: "Reason" }).click();
  const reasons = page.getByTestId("reasons");
  await expect(reasons).toContainText("Roles:");
  await expect(reasons).toContainText("percentage points");
  await expect(reasons).not.toContainText("个百分点");
  await expect(reasons).not.toContainText("位置组合");
  await expect(page.getByRole("button", { name: "Like", exact: true })).toBeVisible();
});
