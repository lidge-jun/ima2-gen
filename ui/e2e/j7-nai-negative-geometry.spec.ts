import { test, expect, type Locator, type Page } from "@playwright/test";
import { seedBrowser, startApp } from "./fixtures/appServer";

// Playwright runs from ui/; keep rendered evidence with the owning devlog unit.
const ARTIFACTS = "../devlog/_artifacts/260905_nai_negative_geometry";

async function openCreate(page: Page, baseUrl: string) {
  await seedBrowser(page, {
    provider: "oauth",
    dismissOnboarding: true,
    imageModel: "nai-diffusion-5-full",
    // The fixture's typed provider only accepts minimax/oauth; overrides win.
    generationDefaults: { provider: "nai" },
  });
  await page.goto(baseUrl);
  await page
    .locator("nav[aria-label='Main navigation']")
    .getByRole("button", { name: "Create", exact: true })
    .click();
}

function geometry(composer: Locator) {
  return composer.evaluate((root) => {
    const required = (selector: string): Element => {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing composer element: ${selector}`);
      return element;
    };
    const positive = required(".composer__textarea").getBoundingClientRect();
    const negative = required(".negative-prompt__textarea");
    const pane = required(".negative-prompt--classic").getBoundingClientRect();
    const dual = required(".composer__prompt-panes--dual").getBoundingClientRect();
    const toolbar = required(".composer__toolbar").getBoundingClientRect();
    const insidePane = (selector: string): boolean => {
      const rect = required(selector).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0
        && rect.left >= pane.left && rect.right <= pane.right
        && rect.top >= pane.top && rect.bottom <= pane.bottom;
    };
    const tools = Array.from(root.querySelectorAll(".composer__toolbar > *"));
    return {
      positiveHeightAtLeast72: positive.height >= 72,
      negativeHeightAtLeast72: negative.getBoundingClientRect().height >= 72,
      negativeMaxHeight: getComputedStyle(negative).maxHeight,
      paneInsideDual: pane.bottom <= dual.bottom + 1,
      paneAboveToolbar: pane.bottom <= toolbar.top + 1,
      paneInsideComposer: pane.bottom <= root.getBoundingClientRect().bottom + 1,
      // The bottom dock scrolls its pane grid, so the grid box (not the pane)
      // is what must stay inside the composer and above the toolbar.
      dualInsideComposer: dual.bottom <= root.getBoundingClientRect().bottom + 1,
      dualAboveToolbar: dual.bottom <= toolbar.top + 1,
      labelInsidePane: insidePane(".negative-prompt__label"),
      hintInsidePane: insidePane(".negative-prompt__hint"),
      toolbarHitTestable: tools.length > 0 && tools.every((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return rect.width > 0 && rect.height > 0 && hit !== null
          && (hit === element || element.contains(hit));
      }),
    };
  });
}

test.describe("J7-S1 sidebar negative prompt geometry", () => {
  test.use({ viewport: { width: 1157, height: 826 } });

  test("both prompt panes fit without covering toolbar controls", async ({ page }) => {
    const app = await startApp("minimax", { provider: "oauth" });
    try {
      await openCreate(page, app.baseUrl);
      const composer = page.locator(".sidebar__scroll > .composer--sidebar");
      await expect(composer).toBeVisible();
      await expect.poll(() => geometry(composer)).toMatchObject({
        positiveHeightAtLeast72: true,
        negativeHeightAtLeast72: true,
        paneInsideDual: true,
        paneAboveToolbar: true,
        toolbarHitTestable: true,
        labelInsidePane: true,
        hintInsidePane: true,
      });
      await page.screenshot({ path: `${ARTIFACTS}/j7-s1-sidebar.png` });
    } finally {
      await app.close();
    }
  });
});

test.describe("J7-S2 bottom negative prompt geometry", () => {
  // prompt-studio selects ClassicWorkspace only above the 800px mobile breakpoint.
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("the bottom composer caps negative input and keeps its toolbar reachable", async ({ page }) => {
    const app = await startApp("minimax", { provider: "oauth" });
    try {
      await page.addInitScript(() => {
        localStorage.setItem("ima2.workspaceProfile", "prompt-studio");
      });
      await openCreate(page, app.baseUrl);
      const composer = page.locator(".composer--bottom");
      await expect(composer).toBeVisible();
      await expect.poll(() => geometry(composer)).toMatchObject({
        negativeMaxHeight: "148px",
        negativeHeightAtLeast72: true,
        dualInsideComposer: true,
        dualAboveToolbar: true,
        toolbarHitTestable: true,
      });
      const negative = composer.locator(".negative-prompt__textarea");
      await negative.scrollIntoViewIfNeeded();
      await expect(negative).toBeInViewport();
      await page.screenshot({ path: `${ARTIFACTS}/j7-s2-bottom.png` });
    } finally {
      await app.close();
    }
  });
});

test.describe("J7-S3 mobile sheet negative prompt geometry", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("negative input remains usable and the submit control can be scrolled into view", async ({ page }) => {
    const app = await startApp("minimax", { provider: "oauth" });
    try {
      await openCreate(page, app.baseUrl);
      await page.locator("button.mobile-app-bar__generate").click();
      const sheet = page.locator("#mobile-generate-sheet");
      await expect(sheet).toHaveAttribute("aria-hidden", "false");
      const negative = sheet.locator(".negative-prompt__textarea");
      await expect(negative).toBeVisible();
      await expect.poll(() => negative.evaluate((element) =>
        element.getBoundingClientRect().height,
      )).toBeGreaterThanOrEqual(72);
      const submit = sheet.locator(".compose-sheet__actions .generate-btn");
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeVisible();
      await expect(submit).toBeInViewport();
      await page.screenshot({ path: `${ARTIFACTS}/j7-s3-mobile.png` });
    } finally {
      await app.close();
    }
  });
});
