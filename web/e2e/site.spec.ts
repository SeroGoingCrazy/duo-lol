import { expect, test } from "@playwright/test";

// What a public deployment and a Riot key application need (docs/deploy.md §4).
test("footer carries Riot's notice and links to the privacy policy and terms", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByTestId("footer");
  await expect(footer).toContainText("isn't endorsed by Riot Games");
  await expect(footer).toContainText("不是个人实力或隐藏分评分");
  await footer.getByRole("link", { name: "隐私政策" }).click();
  await expect(page.getByRole("heading", { name: "隐私政策" })).toBeVisible();
  await expect(page.getByText("互选前，任何人都看不到你的 Riot ID")).toBeVisible();
  await page.getByTestId("footer").getByRole("link", { name: "服务条款" }).click();
  await expect(page.getByRole("heading", { name: "服务条款" })).toBeVisible();
});

test("riot.txt is served only when configured", async ({ request }) => {
  expect((await request.get("/riot.txt")).status()).toBe(404);
});

test("the browser reaches only the public Python endpoints", async ({ request }) => {
  expect((await request.get("/api/champions")).status()).toBe(200);
  expect((await request.get("/api/riot-accounts/Alpha%23NA1")).status()).toBe(404);
  expect((await request.post("/api/fake/icon", { data: { riot_id: "Alpha#NA1", icon: 1 } })).status()).toBe(404);
  // without the secret the Python API itself refuses
  expect((await request.get("http://127.0.0.1:8100/api/champions", { headers: { "x-duo-internal": "" } })).status()).toBe(403);
  // Next's own routes still win over the proxy
  expect((await request.get("/api/auth/providers")).status()).toBe(200);
});
