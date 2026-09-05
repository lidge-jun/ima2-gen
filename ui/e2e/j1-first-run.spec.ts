import { assertStubOnlyCalls, expect, seedBrowser, startApp, test } from "./fixtures/appServer";

test("J1 first run can save a MiniMax key and generate into the gallery", async ({ page }) => {
  const app = await startApp("minimax", { withoutMinimaxKey: true });
  try {
    // This isolated journey owns key entry, not onboarding-popup behavior.
    await seedBrowser(page, { dismissOnboarding: true, provider: "minimax" });
    await page.goto(app.baseUrl);
    await page.getByRole("button", { name: "Settings" }).click();
    // The keys panel is an accordion whose trigger wraps an h4, so match the
    // heading inside it rather than assuming a flat button label.
    await page.locator("button.settings-accordion__trigger").filter({ hasText: "API Keys" }).click();
    // Each key card has its own Save button, disabled until its own field
    // changes, so scope by the card heading. The placeholder disappears once
    // the key is stored, which makes it unusable as a stable anchor.
    const minimaxCard = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "MiniMax", exact: true }) })
      .last();
    await minimaxCard.getByPlaceholder("Paste your MiniMax API key").fill("e2e-minimax-key");
    await minimaxCard.getByRole("button", { name: "Save", exact: true }).click();
    await expect(minimaxCard.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.locator("nav[aria-label='Main navigation']").getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".composer__textarea").fill("a red cube");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".gallery__tile, .result-img, img[alt=result]").first()).toBeVisible({ timeout: 20_000 });
    expect(app.stub.calls.some((call) => call.includes("/image_generation"))).toBeTruthy();
    assertStubOnlyCalls(app.stub);
  } finally {
    await page.close();
    await app.close();
  }
});
