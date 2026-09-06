import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { j6EvidenceIdentity } from "./j6Selection";

export type ComposerSurface = "sidebar" | "bottom" | "mobile" | "home";
export const LONG_PROMPT = Array.from({ length: 120 }, (_, i) => `${i + 1}. 긴 프롬프트와 풍경 묘사 — detailed landscape, soft light`).join("\n");

export function paneSelectors(surface: ComposerSurface) {
  const home = surface === "home";
  return [
    { pane: home ? ".home-prompt__pane" : ".composer__prompt-pane", input: home ? "#home-prompt-input" : ".composer__textarea",
      label: home ? ".home-prompt__label" : ".composer__prompt-pane-label", hint: home ? ".home-prompt__hint" : ".composer__prompt-hint" },
    { pane: ".negative-prompt", input: ".negative-prompt__textarea", label: ".negative-prompt__label", hint: ".negative-prompt__hint" },
  ];
}

export function composerGeometry(root: Locator, surface: ComposerSurface) {
  return root.evaluate((element, kind) => {
    const box = (node: Element) => {
      const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const required = (selector: string) => {
      const node = element.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`WP08 missing ${selector}`);
      return node;
    };
    const grid = required(kind === "home" ? ".home-prompt__panes--dual" : ".composer__prompt-panes--dual");
    const style = getComputedStyle(element);
    const toolbar = element.querySelector(".composer__toolbar, .home-prompt__footer");
    const header = element.querySelector(".composer__header");
    const dock = element.closest(".classic-workspace__dock");
    return { root: box(element), grid: box(grid), toolbar: toolbar ? box(toolbar) : null,
      header: header ? box(header) : null, dock: dock ? box(dock) : null, viewport: { width: innerWidth, height: innerHeight },
      containerWidth: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      overflowY: getComputedStyle(grid).overflowY, gridClientHeight: grid.clientHeight, gridScrollHeight: grid.scrollHeight,
      inputs: Array.from(grid.querySelectorAll("textarea"), (input) => ({ ...box(input),
        maxHeight: getComputedStyle(input).maxHeight, minHeight: getComputedStyle(input).minHeight,
        clientHeight: input.clientHeight, scrollHeight: input.scrollHeight, scrollTop: input.scrollTop })),
      page: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth } };
  }, surface);
}

function assertPaneFloors(metrics: Awaited<ReturnType<typeof composerGeometry>>, surface: ComposerSurface) {
  const floor = surface === "sidebar" ? 72 : surface === "bottom" ? 86 : surface === "mobile" ? 160
    : metrics.viewport.width <= 480 ? 144 : 168;
  expect(metrics.inputs).toHaveLength(2);
  for (const input of metrics.inputs) {
    expect(input.height).toBeGreaterThanOrEqual(floor);
    if (surface === "bottom") {
      expect(input.maxHeight).toBe("148px");
      expect(input.height).toBeLessThanOrEqual(148);
    }
  }
}

function assertGridScroll(metrics: Awaited<ReturnType<typeof composerGeometry>>) {
  expect(metrics.overflowY).toMatch(/^(auto|scroll)$/);
}

export function assertComposerGeometry(metrics: Awaited<ReturnType<typeof composerGeometry>>, surface: ComposerSurface) {
  assertPaneFloors(metrics, surface);
  expect(metrics.columns).toBe(metrics.containerWidth <= 719 ? 1 : 2);
  expect(metrics.page.scrollWidth).toBeLessThanOrEqual(metrics.page.clientWidth + 1);
  if (surface === "sidebar" || surface === "bottom") {
    assertGridScroll(metrics);
    expect(metrics.toolbar).not.toBeNull();
    expect(metrics.grid.bottom).toBeLessThanOrEqual(metrics.toolbar!.top + 1);
    expect(metrics.grid.bottom).toBeLessThanOrEqual(metrics.root.bottom + 1);
    if (metrics.header) expect(metrics.grid.top).toBeGreaterThanOrEqual(metrics.header.bottom - 1);
  }
  if (surface === "bottom") {
    expect(metrics.dock).not.toBeNull();
    expect(metrics.dock!.height).toBeLessThanOrEqual(Math.min(metrics.viewport.height * 0.52, 420) + 1);
  }
}

function revealedMetrics(target: Locator) {
  return target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, box.left + parent.clientLeft); right = Math.min(right, box.left + parent.clientLeft + parent.clientWidth);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, box.top + parent.clientTop); bottom = Math.min(bottom, box.top + parent.clientTop + parent.clientHeight);
      }
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const range = document.createRange(); range.selectNodeContents(element);
    const textRects = Array.from(range.getClientRects(), (box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
    return { text: element.textContent,
      inputValue: element instanceof HTMLTextAreaElement ? element.value : null,
      placeholder: element instanceof HTMLTextAreaElement ? element.placeholder : null,
      hit: hit !== null && element.contains(hit), left, right, top, bottom, textRects,
      width: rect.width, height: rect.height, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  });
}

export async function reveal(target: Locator, text = false) {
  await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect(target).toBeInViewport();
  await expect.poll(async () => (await revealedMetrics(target)).hit).toBe(true);
  const metrics = await revealedMetrics(target);
  expect(metrics.width).toBeGreaterThan(0); expect(metrics.height).toBeGreaterThan(0);
  if (text) {
    expect(metrics.textRects.length).toBeGreaterThan(0);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    for (const rect of metrics.textRects) {
      expect(rect.left).toBeGreaterThanOrEqual(metrics.left - 1); expect(rect.right).toBeLessThanOrEqual(metrics.right + 1);
      expect(rect.top).toBeGreaterThanOrEqual(metrics.top - 1); expect(rect.bottom).toBeLessThanOrEqual(metrics.bottom + 1);
    }
  }
  return metrics;
}

export async function inspectPanes(root: Locator, surface: ComposerSurface, long = false, unbrokenToken = false) {
  const observations = [];
  for (const selectors of paneSelectors(surface)) {
    const input = root.locator(selectors.input), pane = root.locator(selectors.pane);
    const label = pane.locator(selectors.label), hint = pane.locator(selectors.hint);
    await expect(label).toHaveAttribute("for", (await input.getAttribute("id"))!);
    await expect(input).toHaveAttribute("aria-describedby", (await hint.getAttribute("id"))!);
    if (long) await input.fill(LONG_PROMPT + (unbrokenToken ? "\n" + "x".repeat(512) : ""));
    const labelView = await reveal(label, true);
    const inputView = await reveal(input);
    const scrolling = await input.evaluate((element: HTMLTextAreaElement) => {
      element.scrollTop = 0; const before = element.scrollTop;
      element.scrollTop = element.scrollHeight;
      return { before, after: element.scrollTop, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
    });
    if (long) {
      expect(scrolling.scrollHeight).toBeGreaterThan(scrolling.clientHeight);
      expect(scrolling.after).toBeGreaterThan(scrolling.before);
    }
    const hintView = await reveal(hint, true);
    const containment = await pane.evaluate((element, selectors) => {
      const paneBox = element.getBoundingClientRect();
      return [selectors.label, selectors.hint].map((selector) => {
        const box = element.querySelector(selector)!.getBoundingClientRect();
        return box.left >= paneBox.left - 1 && box.right <= paneBox.right + 1
          && box.top >= paneBox.top - 1 && box.bottom <= paneBox.bottom + 1;
      });
    }, selectors);
    expect(containment).toEqual([true, true]);
    observations.push({ selectors, labelView, inputView, scrolling, hintView, containment });
  }
  return observations;
}

export async function trialControls(root: Locator, surface: ComposerSurface) {
  const buttons = root.locator(surface === "home" ? ".home-prompt__footer button" : ".composer__toolbar button");
  expect(await buttons.count()).toBeGreaterThan(0);
  const observations = [];
  for (const button of await buttons.all()) {
    if (!await button.isVisible()) continue;
    const metrics = await reveal(button, Boolean((await button.textContent())?.trim()));
    const enabled = await button.isEnabled();
    if (enabled) await button.click({ trial: true }); // Never execute Generate or any toolbar action.
    observations.push({ text: await button.textContent(), enabled, metrics });
  }
  if (surface !== "home") await expect(root.locator(".composer__tool--full")).toBeEnabled();
  return observations;
}

export async function composerEvidence(page: Page, info: TestInfo, name: string, metrics: unknown) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await writeFile(info.outputPath(`wp08-${name}.json`), JSON.stringify({ ...j6EvidenceIdentity(),
    viewport: page.viewportSize(), metrics }, null, 2));
  await page.screenshot({ path: info.outputPath(`wp08-${name}.png`) });
}

export async function scrollGrid(root: Locator, surface: ComposerSurface) {
  const selector = surface === "home" ? ".home-prompt__panes--dual" : ".composer__prompt-panes--dual";
  const metrics = await root.locator(selector).evaluate((element) => {
    element.scrollTop = 0; const before = element.scrollTop;
    element.scrollTop = element.scrollHeight;
    const after = element.scrollTop; element.scrollTop = 0;
    return { before, after, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  if ((surface === "sidebar" || surface === "bottom") && metrics.scrollHeight > metrics.clientHeight) {
    expect(metrics.after).toBeGreaterThan(metrics.before);
  }
  return metrics;
}

export async function assertGeometryMutations(page: Page, root: Locator) {
  const before = await composerGeometry(root, "sidebar");
  assertComposerGeometry(before, "sidebar");
  const observations = [];
  for (const [name, content] of [
    ["floor72", ".composer--sidebar .composer__prompt-panes--dual textarea { min-height:1px!important; height:1px!important; max-height:1px!important; flex:none!important; }"],
    ["grid-scroll", ".composer--sidebar .composer__prompt-panes--dual { overflow-y:hidden!important; }"],
  ]) {
    const style = await page.evaluateHandle((css) => {
      const element = document.createElement("style");
      element.textContent = css;
      document.head.appendChild(element);
      return element;
    }, content);
    try {
      const mutated = await composerGeometry(root, "sidebar");
      const predicate = name === "floor72" ? () => assertPaneFloors(mutated, "sidebar") : () => assertGridScroll(mutated);
      expect(predicate).toThrow();
      observations.push({ name, mutated, rejected: true });
    } finally { await style.evaluate((element) => element.remove()); }
    assertComposerGeometry(await composerGeometry(root, "sidebar"), "sidebar");
  }
  return observations;
}

export async function observeContainerBoundary(page: Page, info: TestInfo, root: Locator) {
  const originalStyle = await root.getAttribute("style");
  try {
    for (const width of [719, 720]) {
      await root.evaluate((element: HTMLElement, contentWidth) => {
        const style = getComputedStyle(element);
        const edges = [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
          .reduce((sum, value) => sum + parseFloat(value), 0);
        element.style.boxSizing = "border-box"; element.style.width = `${contentWidth + edges}px`;
      }, width);
      await expect.poll(async () => (await composerGeometry(root, "home")).containerWidth).toBe(width);
      const geometry = await composerGeometry(root, "home");
      await composerEvidence(page, info, `home-container-${width}`, geometry);
      expect(geometry.columns).toBe(width === 719 ? 1 : 2);
      assertComposerGeometry(geometry, "home");
    }
  } finally {
    await root.evaluate((element, style) => {
      if (style === null) element.removeAttribute("style"); else element.setAttribute("style", style);
    }, originalStyle);
  }
}
