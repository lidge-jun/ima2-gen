import { test, expect } from "@playwright/test";
import { assertStubOnlyCalls, seedBrowser, startApp } from "./fixtures/appServer";

test("J1 first run can skip onboarding, save a MiniMax key, and generate into the gallery", async ({ page }) => {
  const app = await startApp("minimax");
  try {
    await seedBrowser(page, { dismissOnboarding: false, provider: "minimax" });
    await page.goto(app.baseUrl);
    const skip = page.getByRole("button", { name: /I.ll set it up myself|직접 설정/i });
    if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skip.click();
    }
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "API Keys" }).click();
    await page.getByPlaceholder("Paste your MiniMax API key").fill("e2e-minimax-key");
    await page.getByRole("button", { name: "Save" }).first().click();
    await page.getByRole("button", { name: "Create" }).click();
    await page.locator(".composer__textarea").fill("a red cube");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".gallery__tile, .result-img, img[alt=result]").first()).toBeVisible({ timeout: 20_000 });
    expect(app.stub.calls.some((call) => call.includes("/image_generation"))).toBeTruthy();
    assertStubOnlyCalls(app.stub);
  } finally {
    await app.close();
  }
});
