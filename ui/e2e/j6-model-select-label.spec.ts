import { test, expect } from "@playwright/test";
import { seedBrowser, startApp } from "./fixtures/appServer";

/**
 * J6 — the model select must always name the model it will actually send.
 *
 * Reported as: provider reads "GPT", reasoning reads "off", and the model
 * control between them is blank. `Select` matches its selected value against
 * the option rows it rendered and falls back to an empty label when nothing
 * matches, so a value belonging to another lane erases the label instead of
 * showing something wrong — which is why it looked like a rendering glitch
 * rather than bad state.
 */

const MODEL_TRIGGER = "#sidebar-generation-model";
const PROVIDER_TRIGGER = "#sidebar-generation-provider";
// Render evidence belongs with its devlog unit, which is where this repo keeps
// screenshots (`devlog/_artifacts/<unit>/`). Playwright runs from `ui/`.
const ARTIFACTS = "../devlog/_artifacts/260904_model_select_empty_label";

async function openCreate(page: import("@playwright/test").Page, baseUrl: string) {
  await page.goto(baseUrl);
  await page
    .locator("nav[aria-label='Main navigation']")
    .getByRole("button", { name: "Create", exact: true })
    .click();
}

test("J6-S1 a comfy workflow left in storage does not blank the GPT model label", async ({ page }) => {
  const app = await startApp("minimax", { provider: "oauth" });
  try {
    // Exactly the persisted shape the bug leaves behind: the user is on GPT
    // with luna, and a comfy video workflow from an earlier session is still
    // stored because leaving the comfy lane never cleared it.
    await seedBrowser(page, {
      provider: "oauth",
      dismissOnboarding: true,
      imageModel: "gpt-5.6-luna",
      generationDefaults: { comfyVideoWorkflow: "wf-anim-1", comfyWorkflow: "wf-still-1" },
    });
    await openCreate(page, app.baseUrl);

    await expect(page.locator(PROVIDER_TRIGGER)).toContainText("GPT");
    const model = page.locator(`${MODEL_TRIGGER} .ctl-select__value`);
    await expect(model).toBeVisible();
    // The assertion that would have caught the report: not merely "some text",
    // but the short label of the model that is actually selected.
    await expect(model).toHaveText("5.6l");
    await page.screenshot({ path: `${ARTIFACTS}/j6-s1-gpt-label.png` });
  } finally {
    await app.close();
  }
});

test("J6-S2 leaving the comfy lane clears its selections and converges the model", async ({ page }) => {
  const app = await startApp("minimax", { provider: "oauth" });
  try {
    // Start inside comfy holding a workflow id as the model, which is legal
    // there (the server reads a comfy "model" as the workflow to run) and
    // meaningless everywhere else.
    await seedBrowser(page, {
      provider: "oauth",
      dismissOnboarding: true,
      imageModel: "gpt-5.6-luna",
      generationDefaults: { provider: "comfy", comfyVideoWorkflow: "wf-anim-1", comfyWorkflow: "wf-still-1" },
    });
    await openCreate(page, app.baseUrl);

    // Drive the real control so setProviderImpl actually runs: hydration
    // projects stored values straight into initial state and never calls it,
    // so a seed-and-render check would exercise none of the state fix.
    await page.locator(PROVIDER_TRIGGER).click();
    await page.getByRole("option", { name: "GPT", exact: true }).click();

    await expect(page.locator(PROVIDER_TRIGGER)).toContainText("GPT");
    await expect(page.locator(`${MODEL_TRIGGER} .ctl-select__value`)).toHaveText("5.6l");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ima2.generationDefaults") ?? "{}"),
    );
    expect(stored.comfyVideoWorkflow).toBeNull();
    expect(stored.comfyWorkflow).toBeNull();
    await page.screenshot({ path: `${ARTIFACTS}/j6-s2-after-lane-exit.png` });
  } finally {
    await app.close();
  }
});
