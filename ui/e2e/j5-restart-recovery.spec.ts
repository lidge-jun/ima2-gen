import { expect, seedBrowser, startApp, test } from "./fixtures/appServer";

test("J5 same isolated home restores the gallery after restart", async ({ page }) => {
  const first = await startApp("minimax");
  const home = first.home;
  try {
    await seedBrowser(page, { dismissOnboarding: true });
    await page.goto(first.baseUrl);
    await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".composer:visible .composer__textarea").fill("a red cube");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".gallery__tile, .result-img, img[alt=result]").first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await page.goto("about:blank");
    await first.close();
  }
  const second = await startApp("minimax", { home });
  try {
    await seedBrowser(page, { dismissOnboarding: true });
    await page.goto(second.baseUrl);
    await expect(page.locator("img[src*=generated], .gallery__tile, .result-img").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("a red cube")).toBeVisible();
  } finally {
    await page.close();
    await second.close();
  }
});
