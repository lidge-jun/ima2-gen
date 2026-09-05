import sharp from "sharp";
import { expect, seedBrowser, startApp, test } from "./fixtures/appServer";

// Before WP09's full fixture isolation, execute this only on clean CI runners.
// This journey attaches synthetic local bytes but never submits a generation.
test.use({ viewport: { width: 1157, height: 826 } });

test("WP01 reference controls follow the selected provider surface", async ({ page }, testInfo) => {
  const app = await startApp("minimax", { provider: "oauth" });
  let generationPosts = 0;
  try {
    await seedBrowser(page, {
      provider: "oauth", dismissOnboarding: true, imageModel: "nai-diffusion-5-full",
      generationDefaults: { provider: "nai" },
    });
    await page.route("**/api/generate", async (route) => {
      if (route.request().method() === "POST") generationPosts++;
      await route.fulfill({ status: 400, contentType: "application/json",
        body: JSON.stringify({ error: { code: "FIXTURE_NO_GENERATION", message: "No generation in this scenario" } }) });
    });
    await page.goto(app.baseUrl);
    await page.locator("nav[aria-label='Main navigation']")
      .getByRole("button", { name: "Create", exact: true }).click();
    const composer = page.locator(".sidebar__scroll > .composer--sidebar");
    const add = composer.locator(".composer__tray-slot--add");
    const attach = composer.locator(".composer__toolbar")
      .getByRole("button", { name: "Attach reference images", exact: true });
    await expect(composer.locator(".negative-prompt__textarea")).toBeVisible();
    await expect(add).toBeDisabled();
    await expect(attach).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("wp01-nai.png") });

    await page.locator("#sidebar-generation-provider").click();
    await page.getByRole("option").filter({
      has: page.locator(".ctl-select__item-label").filter({ hasText: /^GPT$/ }),
    }).click();
    await expect(composer.locator(".negative-prompt__textarea")).toHaveCount(0);
    await expect(add).toBeEnabled();
    await expect(attach).toBeEnabled();
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#336699" },
    }).png().toBuffer();
    await composer.locator("input[type='file']").setInputFiles({
      name: "surface-fixture.png", mimeType: "image/png", buffer: bytes,
    });
    await expect(composer.locator(".composer__tray [role='listitem']")).toHaveCount(1);
    await expect(composer.locator(".composer__textarea")).toHaveValue(/@Image_1/);
    await page.screenshot({ path: testInfo.outputPath("wp01-oauth.png") });
    expect(generationPosts).toBe(0);
    expect(app.stub.calls.filter((call) => /images\/generations|responses/.test(call))).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
