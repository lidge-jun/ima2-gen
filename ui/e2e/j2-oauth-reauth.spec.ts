import { test, expect } from "@playwright/test";
import { seedBrowser, startApp } from "./fixtures/appServer";

test("J2 auth failure exposes a reachable reauth action", async ({ page }) => {
  const app = await startApp("oauth-expired");
  try {
    await seedBrowser(page, { provider: "oauth", dismissOnboarding: true });
    await page.goto(app.baseUrl);
    await page.locator("nav[aria-label='Main navigation']").getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".composer__textarea").fill("expired session");
    await page.getByRole("button", { name: "Generate" }).click();
    const cta = page.getByRole("button", { name: /Reload|새로고침|Sign in again|다시 로그인/i });
    await expect(cta).toBeVisible({ timeout: 15_000 });
    const hrefBefore = page.url();
    await cta.click();
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain(new URL(hrefBefore).host);
    // The reauth CTA opens the settings workspace on its providers section.
    // Settings is a full-surface workspace, so the composer is unmounted while
    // it is open; asserting on Generate here only passed while a layout bug let
    // the composer stay in a second, offscreen grid row.
    await expect(page.getByRole("main", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Providers" })).toBeVisible();
    // Closing settings must return to the canvas with the composer usable.
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();
  } finally {
    await app.close();
  }
});
