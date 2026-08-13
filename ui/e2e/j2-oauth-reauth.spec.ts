import { test, expect } from "@playwright/test";
import { seedBrowser, startApp } from "./fixtures/appServer";

test("J2 auth failure exposes a reachable reauth action", async ({ page }) => {
  const app = await startApp("oauth-expired");
  try {
    await seedBrowser(page, { provider: "oauth", dismissOnboarding: true });
    await page.goto(app.baseUrl);
    await page.getByRole("button", { name: "Create" }).click();
    await page.locator(".composer__textarea").fill("expired session");
    await page.getByRole("button", { name: "Generate" }).click();
    const cta = page.getByRole("button", { name: /Reload|새로고침|Sign in again|다시 로그인/i });
    await expect(cta).toBeVisible({ timeout: 15_000 });
    const hrefBefore = page.url();
    await cta.click();
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain(new URL(hrefBefore).host);
    await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();
  } finally {
    await app.close();
  }
});
