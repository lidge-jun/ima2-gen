import { expect, seedBrowser, startApp, test } from "./fixtures/appServer";

test("J4 node workspace can start a blank graph", async ({ page }) => {
  const app = await startApp("minimax");
  try {
    await seedBrowser(page, { dismissOnboarding: true });
    await page.goto(app.baseUrl);
    await page.getByRole("button", { name: "Node graph" }).click();
    await page.getByRole("button", { name: /Start with a blank canvas|Start blank/i }).click();
    await expect(page.getByRole("button", { name: /Add image/i })).toBeEnabled({ timeout: 10_000 });
  } finally {
    await page.close();
    await app.close();
  }
});
