import { expect, test } from "./fixtures/appServer";
import { openCreate, selectOption, withJ6, PROVIDER_TRIGGER, MODEL_TRIGGER, j6EvidenceIdentity, type J6Seed } from "./fixtures/j6Selection";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const seed: J6Seed = { provider: "nai", imageModel: "nai-diffusion-5-full", nonGenerating: true,
  viewport: { width: 1280, height: 900 }, catalog: { mode: "ready", mcp: true }, evidencePrefix: "wp09-j8",
  generationDefaults: { promptMode: "direct", multimode: false } };
const POSITIVE = "WP09 distinct positive draft / 초안";
const NEGATIVE = "@not-a-mention, WP09 negative draft";
const desktop = ".sidebar__scroll > .composer--sidebar";
const sheet = "#mobile-generate-sheet";

async function drafts(root: Locator, home = false) {
  const positive = root.locator(home ? "#home-prompt-input" : ".composer__textarea");
  const negative = root.locator(".negative-prompt__textarea");
  await expect(positive).toHaveValue(POSITIVE); await expect(negative).toHaveValue(NEGATIVE);
}
async function fillDrafts(root: Locator, home = false) {
  await root.locator(home ? "#home-prompt-input" : ".composer__textarea").fill(POSITIVE);
  await root.locator(".negative-prompt__textarea").fill(NEGATIVE);
}
async function capture(page: Page, info: TestInfo, name: string, metrics: unknown = {}) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: info.outputPath(`wp09-${name}.png`) });
  await writeFile(info.outputPath(`wp09-${name}.json`), JSON.stringify({ ...j6EvidenceIdentity(), metrics }, null, 2));
}
async function openSheet(page: Page) {
  await page.locator("button.mobile-app-bar__generate").click();
  await expect(page.locator(sheet)).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(sheet)).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
}

test("T1 Home to Create to Home preserves both NovelAI drafts", async ({ browser }, info) => {
  await withJ6(browser, info, { ...seed, uiMode: "home" }, async (page, observation, origin) => {
    await page.goto(origin); await fillDrafts(page.locator(".home-prompt"), true);
    await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
    await drafts(page.locator(desktop)); await expect(page.locator(".composer:visible")).toHaveCount(1);
    await capture(page, info, "t1-create");
    await page.locator(".nav-rail").getByRole("button", { name: "Home", exact: true }).click();
    await drafts(page.locator(".home-prompt"), true);
    await capture(page, info, "t1-home"); expect(observation.requests).toEqual([]);
  });
});

test("T2 provider round trip and real reload preserve exact NovelAI selection and drafts", async ({ browser }, info) => {
  await withJ6(browser, info, seed, async (page, observation, origin) => {
    await openCreate(page, origin); const root = page.locator(desktop); await fillDrafts(root);
    await selectOption(page, PROVIDER_TRIGGER, "MiniMax");
    await expect(root.locator(".negative-prompt__textarea")).toHaveCount(0);
    await expect(root.locator(".composer__textarea")).toHaveValue(POSITIVE);
    await expect(page.locator(MODEL_TRIGGER)).toContainText("minimax");
    await selectOption(page, PROVIDER_TRIGGER, "NovelAI"); await drafts(root);
    await page.reload(); await drafts(root);
    await expect(page.locator(MODEL_TRIGGER)).toContainText("nai v5");
    const persisted = await page.evaluate(() => ({
      defaults: JSON.parse(localStorage.getItem("ima2.generationDefaults") ?? "{}"), model: localStorage.getItem("ima2.imageModel"),
    }));
    expect(persisted.defaults.provider).toBe("nai"); expect(persisted.model).toBe("nai-diffusion-5-full");
    await expect(page.locator(".element-mention-menu")).toHaveCount(0);
    await capture(page, info, "t2-reload", { provider: persisted.defaults.provider, model: persisted.model });
    expect(observation.requests).toEqual([]);
  });
});

test("T3 prompt-studio draft survives mobile sheet remount and breakpoint round trip", async ({ browser }, info) => {
  await withJ6(browser, info, { ...seed, profile: "prompt-studio" }, async (page, observation, origin) => {
    await openCreate(page, origin); await fillDrafts(page.locator(".composer--bottom"));
    for (const width of [800, 801, 390, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      if (width <= 800) {
        await openSheet(page); await drafts(page.locator(`${sheet} .composer`));
        await page.locator(`${sheet} .composer__textarea`).focus();
      } else {
        await expect(page.locator(sheet)).toHaveCount(0); await drafts(page.locator(".composer--bottom"));
        await page.locator(".composer--bottom .composer__textarea").focus();
        await expect(page.locator(".composer--bottom .composer__textarea")).toBeFocused();
      }
      await capture(page, info, `t3-width-${width}`);
    }
    expect(await page.evaluate(() => localStorage.getItem("ima2.workspaceProfile"))).toBe("prompt-studio");
    expect(observation.requests).toEqual([]);
  });
});

test("T4 mobile tabs navigate with arrows and restore the real opener on Escape", async ({ browser }, info) => {
  await withJ6(browser, info, { ...seed, viewport: { width: 390, height: 844 } }, async (page, observation, origin) => {
    await openCreate(page, origin); await openSheet(page); await fillDrafts(page.locator(`${sheet} .composer`));
    await page.locator("#mobile-sheet-tab-prompt").focus();
    for (const [key, name] of [["ArrowRight", "controls"], ["End", "library"], ["ArrowLeft", "controls"], ["Home", "prompt"]]) {
      await page.keyboard.press(key!);
      const tab = page.locator(`#mobile-sheet-tab-${name}`), panel = page.locator(`#mobile-sheet-panel-${name}`);
      await expect(tab).toBeFocused(); await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(tab).toHaveAttribute("aria-controls", `mobile-sheet-panel-${name}`);
      await expect(panel).toBeVisible(); await expect(panel).toHaveAttribute("aria-labelledby", `mobile-sheet-tab-${name}`);
    }
    await drafts(page.locator(`${sheet} .composer`)); await page.keyboard.press("Escape");
    await expect(page.locator(sheet)).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(sheet)).toHaveAttribute("inert", "");
    await expect(page.locator("button.mobile-app-bar__generate")).toBeFocused();
    await openSheet(page); await drafts(page.locator(`${sheet} .composer`));
    await capture(page, info, "t4-reopened"); expect(observation.requests).toEqual([]);
  });
});

test("MCP popup observes the selected image model without showing core GPT facts", async ({ browser }, info) => {
  await withJ6(browser, info, { ...seed, provider: "oauth", imageModel: "gpt-5.6-luna" }, async (page, observation, origin) => {
    await openCreate(page, origin); await selectOption(page, PROVIDER_TRIGGER, "Runway");
    await selectOption(page, MODEL_TRIGGER, "MCP image");
    await page.locator(".generate-row__readiness:visible").click();
    const popup = page.locator(".provider-readiness"), details = popup.locator("[data-mcp-readiness]");
    await expect(details).toHaveAttribute("data-mcp-readiness", "ready");
    await expect(details).toContainText("runway · MCP"); await expect(details).toContainText("MCP image");
    await expect(popup).not.toContainText("GPT OAuth"); await expect(popup).not.toContainText("Reasoning");
    await capture(page, info, "mcp-image-ready");
    await popup.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(details).toHaveAttribute("data-mcp-readiness", "ready");
    await popup.getByRole("button", { name: "Close", exact: true }).click();
    await selectOption(page, PROVIDER_TRIGGER, "GPT");
    await page.locator(".generate-row__readiness:visible").click();
    await expect(popup.locator("[data-mcp-readiness]")).toHaveCount(0); await expect(popup).toContainText("GPT OAuth");
    await popup.getByRole("button", { name: "Close", exact: true }).click();
    expect(observation.requests).toEqual([]);
  });
});
