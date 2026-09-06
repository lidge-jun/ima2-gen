import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { j6EvidenceIdentity, type J6Capture } from "./j6Selection";

export async function openComfyPanel(page: Page, origin: string) {
  await page.goto(origin);
  await expect(page.locator(".app")).toHaveAttribute("data-ui-mode", "classic");
  await expect(page.locator("#sidebar-generation-provider:visible")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 800) {
    await page.locator(".mobile-app-bar__icon-button").last().click();
    await expect(page.locator("#mobile-generate-sheet")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    return page.locator("#mobile-generate-sheet .compose-sheet__panel--controls .right-panel-settings");
  }
  await page.locator(".right-panel:visible [aria-controls='right-panel-tab-settings']").click();
  return page.locator(".right-panel:visible .right-panel-settings");
}

export async function readable(target: Locator, trial = false) {
  await target.page().evaluate(async () => { await document.fonts.ready; });
  await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect(target).toBeInViewport();
  const metrics = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(element);
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { text: element.textContent, id: element.id, width: box.width, height: box.height,
      hit: hit !== null && element.contains(hit), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      rects: Array.from(range.getClientRects(), (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
      box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, viewport: { width: innerWidth, height: innerHeight } };
  });
  expect(metrics.hit).toBe(true); expect(metrics.width).toBeGreaterThan(0);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  for (const rect of metrics.rects) {
    expect(rect.left).toBeGreaterThanOrEqual(Math.max(0, metrics.box.left) - 1);
    expect(rect.right).toBeLessThanOrEqual(Math.min(metrics.viewport.width, metrics.box.right) + 1);
    expect(rect.top).toBeGreaterThanOrEqual(Math.max(0, metrics.box.top) - 1);
    expect(rect.bottom).toBeLessThanOrEqual(Math.min(metrics.viewport.height, metrics.box.bottom) + 1);
  }
  if (trial && await target.isEnabled()) await target.click({ trial: true });
  return metrics;
}

export async function displayEvidence(page: Page, info: TestInfo, name: string, capture: J6Capture, panel: Locator, observations: unknown = {}) {
  await page.evaluate(async () => { await document.fonts.ready; });
  const dom = await panel.evaluate((element) => ({ text: element.textContent,
    controls: Array.from(element.querySelectorAll<HTMLElement>("button,input,textarea,[role=combobox]"), (node) => ({
      id: node.id, text: node.textContent, name: node.getAttribute("aria-label"), describedBy: node.getAttribute("aria-describedby"),
    })) }));
  await writeFile(info.outputPath(`wp08c-${name}.json`), JSON.stringify({ ...j6EvidenceIdentity(), viewport: page.viewportSize(),
    dom, observations, catalog: capture.catalog, catalogReads: capture.catalogReads, catalogCancelled: capture.catalogCancelled,
    catalogPending: capture.catalogPending, requests: capture.requests, denied: capture.deniedGeneration, unexpected: capture.unexpected }, null, 2));
  await page.screenshot({ path: info.outputPath(`wp08c-${name}.png`) });
  expect(capture.requests).toEqual([]); expect(capture.deniedGeneration).toEqual([]); expect(capture.unexpected).toEqual([]);
}
