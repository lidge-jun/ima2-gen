import { assertStubOnlyCalls, expect, seedBrowser, startApp, test } from "./fixtures/appServer";

// Direct mode still includes the server's existing exact-size request constraint.
const sizeHint = " IMPORTANT: the output image MUST be square, 1024x1024 pixels. Do not produce a portrait or landscape image.";

test("J3 provider errors do not collapse to unknown", async ({ page }) => {
  const app = await startApp("minimax-billing");
  try {
    await seedBrowser(page, { dismissOnboarding: true, generationDefaults: { promptMode: "direct", multimode: false } });
    await page.goto(app.baseUrl);
    await page.locator("nav[aria-label='Main navigation']").getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".composer__textarea").fill("billing failure");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText(/Billing required|잔액이 부족합니다/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("An unexpected error occurred")).toHaveCount(0);
    expect(app.stub.calls.some((call) => call.includes("/image_generation"))).toBeTruthy();
    expect(app.stub.generationRequests.at(-1)).toEqual(expect.objectContaining({
      path: "/v1/image_generation",
      body: expect.objectContaining({ prompt: "billing failure" + sizeHint }),
    }));
    app.stub.setMode("minimax");
    await page.locator(".composer:visible .composer__textarea").fill("after billing recovery");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".gallery__tile, .result-img, img[alt=result]").first()).toBeVisible({ timeout: 20_000 });
    expect(app.stub.generationRequests).toHaveLength(2);
    expect(app.stub.generationRequests.map(({ body }) => (body as { prompt: string }).prompt))
      .toEqual(["billing failure" + sizeHint, "after billing recovery" + sizeHint]);
    await expect(page.getByRole("button", { name: "Generate" })).toBeEnabled();
    assertStubOnlyCalls(app.stub);
  } finally {
    await page.close();
    await app.close();
  }
});
