import { type Locator, type Page, type TestInfo } from "@playwright/test";
import { test, expect } from "./fixtures/appServer";
import { preflightJ6, PROVIDER_TRIGGER, selectOption, withJ6, type J6Seed } from "./fixtures/j6Selection";
import { assertComposerGeometry, assertGeometryMutations, composerEvidence, composerGeometry, inspectPanes,
  observeContainerBoundary, paneSelectors, reveal, scrollGrid, trialControls, type ComposerSurface } from "./fixtures/composerGeometry";
import { assertContrasts, contrastMutations, inspectContrast } from "./fixtures/composerContrast";

type Scenario = { name: string; surface: ComposerSurface; viewport: { width: number; height: number }; locale?: "ko" | "zh-Hans" | "zh-Hant" };
const CASES: Scenario[] = [
  { name: "j7-s1-sidebar", surface: "sidebar", viewport: { width: 1157, height: 826 } },
  { name: "j7-s2-bottom", surface: "bottom", viewport: { width: 1440, height: 1000 } },
  { name: "j7-s3-mobile", surface: "mobile", viewport: { width: 390, height: 844 } },
  { name: "sidebar-1024", surface: "sidebar", viewport: { width: 1024, height: 800 } },
  { name: "sheet-768-ko", surface: "mobile", viewport: { width: 768, height: 1024 }, locale: "ko" },
  { name: "sheet-320-ko", surface: "mobile", viewport: { width: 320, height: 740 }, locale: "ko" },
  { name: "home-1440", surface: "home", viewport: { width: 1440, height: 1000 } },
  { name: "home-390-ko", surface: "home", viewport: { width: 390, height: 844 }, locale: "ko" },
  { name: "wp09-sidebar-short", surface: "sidebar", viewport: { width: 1024, height: 600 } },
  { name: "wp09-bottom-short", surface: "bottom", viewport: { width: 1440, height: 600 } },
  { name: "wp09-mobile-short", surface: "mobile", viewport: { width: 320, height: 568 } },
  { name: "wp09-home-tablet", surface: "home", viewport: { width: 768, height: 900 } },
  { name: "wp09-sidebar-zh-Hans", surface: "sidebar", viewport: { width: 1024, height: 800 }, locale: "zh-Hans" },
  { name: "wp09-mobile-zh-Hant", surface: "mobile", viewport: { width: 390, height: 844 }, locale: "zh-Hant" },
  { name: "wp09-home-zh-Hans", surface: "home", viewport: { width: 390, height: 844 }, locale: "zh-Hans" },
  { name: "wp09-home-zh-Hant", surface: "home", viewport: { width: 768, height: 900 }, locale: "zh-Hant" },
];

async function openComposer(page: Page, origin: string, scenario: Scenario) {
  await page.goto(origin);
  await expect(page.locator(".app")).toHaveAttribute("data-ui-mode", scenario.surface === "home" ? "home" : "classic");
  if (scenario.surface === "mobile") {
    await page.locator("button.mobile-app-bar__generate").click();
    const sheet = page.locator("#mobile-generate-sheet");
    await expect(sheet).toHaveAttribute("aria-hidden", "false");
    await expect(sheet).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(sheet.locator("#mobile-sheet-tab-prompt")).toHaveAttribute("aria-selected", "true");
  }
  const selector = { sidebar: ".sidebar__scroll > .composer--sidebar", bottom: ".composer--bottom",
    mobile: "#mobile-generate-sheet .composer:visible", home: ".home-prompt" }[scenario.surface];
  const root = page.locator(selector);
  await expect(root).toBeVisible();
  await expect(root.locator(".negative-prompt__textarea")).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  if (scenario.viewport.width <= 800) {
    const alpha = await page.locator(".nav-rail--mobile").evaluate((element) => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(element).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] / 255;
    });
    expect(alpha, "Fixed navigation must not bleed underlying roster text").toBe(1);
  }
  return root;
}

async function observeGeometry(page: Page, info: TestInfo, root: Locator, scenario: Scenario, long: boolean) {
  const suffix = `${scenario.name}-${long ? "long" : "short"}`;
  const panes = await inspectPanes(root, scenario.surface, long, scenario.name.startsWith("wp09-"));
  const gridScroll = await scrollGrid(root, scenario.surface);
  const geometry = await composerGeometry(root, scenario.surface);
  // Capture independent metrics before asserting so a failed floor remains reviewable.
  await composerEvidence(page, info, suffix, { geometry, panes, gridScroll });
  assertComposerGeometry(geometry, scenario.surface);
  return geometry;
}

async function providerRoundTrip(page: Page, root: Locator, scenario: Scenario) {
  const home = scenario.surface === "home", selectors = paneSelectors(scenario.surface);
  const positive = root.locator(selectors[0].input), negative = root.locator(selectors[1].input);
  const prompt = "Preserve positive draft / 포지티브 초안", undesired = "low quality, @literal / 제외할 요소";
  await positive.fill(prompt); await negative.fill(undesired);
  await expect(page.locator(".element-mention-menu")).toHaveCount(0);
  const wrapper = root.locator(home ? ".home-prompt__panes" : ".composer__prompt-panes");
  const trigger = home ? ".home-prompt__provider button" : PROVIDER_TRIGGER;
  const selectProvider = async (label: string) => {
    if (!home) { await selectOption(page, trigger, label); return; }
    await page.locator(trigger).click();
    // Home's option also contains the translated readiness sublabel.
    await page.getByRole("option").filter({ has: page.getByText(label, { exact: true }) }).click();
  };
  await selectProvider("MiniMax");
  await expect(negative).toHaveCount(0); await expect(positive).toHaveValue(prompt);
  await expect(wrapper).toHaveCSS("display", "contents");
  await expect(root.locator(selectors[0].pane)).toHaveCSS("display", "contents");
  const single = await positive.evaluate((element) => ({ height: element.getBoundingClientRect().height,
    minHeight: getComputedStyle(element).minHeight, padding: getComputedStyle(element.parentElement!).padding }));
  if (home) {
    const floor = scenario.viewport.width <= 480 ? 144 : 168;
    expect(single.height).toBeGreaterThanOrEqual(floor); expect(single.minHeight).toBe(`${floor}px`);
  }
  else expect(single.minHeight).toBe("0px");
  await selectProvider("NovelAI");
  await expect(wrapper).toHaveCSS("display", "grid");
  await expect(positive).toHaveValue(prompt); await expect(negative).toHaveValue(undesired);
  return { single, positiveDraft: await positive.inputValue(), negativeDraft: await negative.inputValue() };
}

async function finishControls(page: Page, root: Locator, scenario: Scenario) {
  await root.locator(paneSelectors(scenario.surface)[0].input).fill("Save enabled / 저장할 프롬프트");
  const controls = await trialControls(root, scenario.surface);
  if (scenario.surface === "mobile") {
    const submit = page.locator("#mobile-generate-sheet .compose-sheet__actions .generate-btn");
    const metrics = await reveal(submit, true);
    await expect(submit).toBeEnabled(); await submit.click({ trial: true });
    return { controls, submit: metrics };
  }
  return { controls };
}

async function exerciseScenario(page: Page, info: TestInfo, origin: string, scenario: Scenario, theme: "dark" | "light") {
  const root = await openComposer(page, origin, scenario);
  try {
    expect(await page.evaluate(() => document.documentElement.dataset.theme ?? "dark")).toBe(theme);
    await observeGeometry(page, info, root, scenario, false);
    const contrast = await inspectContrast(root, scenario.surface, info, `${scenario.name}-${theme}`);
    await composerEvidence(page, info, `${scenario.name}-${theme}-contrast`, contrast);
    assertContrasts(contrast);
    if (scenario.name === "home-1440" && theme === "dark") await observeContainerBoundary(page, info, root);
    if (scenario.name === "j7-s1-sidebar" || scenario.name === "home-1440") {
      const mutations = await contrastMutations(page, root, scenario.surface);
      await composerEvidence(page, info, `${scenario.name}-${theme}-contrast-mutations`, mutations);
    }
    if (scenario.name === "j7-s1-sidebar" && theme === "dark") {
      const mutations = await assertGeometryMutations(page, root);
      await composerEvidence(page, info, `${scenario.name}-geometry-mutations`, mutations);
    }
    if (scenario.surface === "sidebar" || scenario.surface === "home") {
      const drafts = await providerRoundTrip(page, root, scenario);
      await composerEvidence(page, info, `${scenario.name}-provider-toggle`, drafts);
    }
    await observeGeometry(page, info, root, scenario, true);
    const controls = await finishControls(page, root, scenario);
    await composerEvidence(page, info, `${scenario.name}-${theme}-controls`, controls);
    if (scenario.surface === "home") {
      const metrics = await composerGeometry(root, "home");
      expect(metrics.columns).toBe(scenario.viewport.width === 1440 ? 2 : 1);
    }
  } finally {
    // Retain a PNG on failure without replacing the actual failing assertion.
    await page.screenshot({ path: info.outputPath(`wp08-${scenario.name}-${theme}-final.png`) }).catch(() => {});
    if (scenario.surface === "mobile") {
      await page.locator("#mobile-generate-sheet .compose-sheet__handle").click();
      await expect(page.locator("#mobile-generate-sheet")).toBeHidden();
      await expect(page.locator("button.mobile-app-bar__generate")).toBeFocused();
    }
  }
}

test.describe("WP08 J7 non-generating composer geometry", () => {
  test.beforeEach(async ({}, info) => { await preflightJ6(info, "wp08"); });
  // Bounded coverage, not a Cartesian viewport/provider matrix. Both themes at
  // each host, with the original 1157 sidebar and the five required widths.
  for (const scenario of CASES) for (const theme of ["dark", "light"] as const) {
    test(`${scenario.name} ${theme}: floors, labels, scrolling, contrast and controls`, async ({ browser }, info) => {
      const seed: J6Seed = { provider: "nai", imageModel: "nai-diffusion-5-full", viewport: scenario.viewport,
        profile: scenario.surface === "bottom" ? "prompt-studio" : "default", uiMode: scenario.surface === "home" ? "home" : "classic",
        theme, locale: scenario.locale, evidencePrefix: "wp08", nonGenerating: true, expectedSubmissions: 0 };
      await withJ6(browser, info, seed, async (page, _capture, origin) => exerciseScenario(page, info, origin, scenario, theme));
    });
  }
});
