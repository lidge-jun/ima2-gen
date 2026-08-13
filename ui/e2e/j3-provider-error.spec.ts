import { test, expect } from "@playwright/test";
import { assertStubOnlyCalls, seedBrowser, startApp } from "./fixtures/appServer";

test("J3 provider errors do not collapse to unknown", async ({ page }) => {
  const app = await startApp("minimax-billing");
  try {
    await seedBrowser(page, { dismissOnboarding: true });
    await page.goto(app.baseUrl);
    await page.getByRole("button", { name: "Create" }).click();
    await page.locator(".composer__textarea").fill("billing failure");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText(/Billing required|잔액이 부족합니다/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("An unexpected error occurred")).toHaveCount(0);
    expect(app.stub.calls.some((call) => call.includes("/image_generation"))).toBeTruthy();
    assertStubOnlyCalls(app.stub);
  } finally {
    await app.close();
  }
});
