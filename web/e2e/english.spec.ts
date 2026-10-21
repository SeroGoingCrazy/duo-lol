import { expect, test } from "@playwright/test";

// English for NA players: picked from the browser language, switchable in the nav, remembered in a cookie.
test.use({ locale: "en-US" });

test("an English browser gets English, and the switch goes back to 中文", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Duo check" })).toBeVisible();
  await page.getByLabel("Player A").fill("Alpha#NA1");
  await page.getByLabel("Player B").fill("Bravo#NA1");
  await page.getByRole("button", { name: "Predict" }).click();
  const result = page.getByTestId("pair-result");
  await expect(result).toContainText("Predicted win rate", { timeout: 60_000 });
  await expect(result).toContainText(/(above|below) your solo average/);
  await expect(page.getByTestId("roles")).toContainText(/Top|Jungle|Mid|Bot|Support/);
  await expect(page.getByTestId("footer")).toContainText("not a skill, rank or MMR rating");

  await page.getByTestId("lang-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("link", { name: "查组合" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "查组合" })).toBeVisible();
});

test("English demo deck: card text and the model's reasons", async ({ page }) => {
  await page.goto("/find?me=Alpha%23NA1");
  const card = page.getByTestId("swipe-card");
  await expect(card).toContainText("Duo score", { timeout: 60_000 });
  await card.getByRole("button", { name: "Reason" }).click();
  const reasons = page.getByTestId("reasons");
  await expect(reasons).toContainText("Roles:");
  await expect(reasons).not.toContainText("位置组合");
  await expect(page.getByRole("button", { name: "Like", exact: true })).toBeVisible();
});
