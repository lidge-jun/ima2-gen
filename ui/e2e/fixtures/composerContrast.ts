import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { paneSelectors, reveal, type ComposerSurface } from "./composerGeometry";

// Paint solid computed backgrounds from the input through every ancestor. This
// includes Home's 88% input / 86% shell and group opacity, not just theme tokens.
function computedContrast(input: Locator, boundarySelector: string) {
  return input.evaluate((element, selector) => {
    const boundary = selector === "textarea" ? element : element.closest(selector);
    if (!boundary) throw new Error("WP08 missing identifying input boundary");
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("WP08 CSS color resolver unavailable");
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data, (value) => value / 255);
    };
    const over = (front: number[], back: number[]) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0, 3).map((v, i) => alpha ? (v * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0), alpha];
    };
    const layers: Array<{ className: string; background: string; image: string; opacity: string; backdrop: string }> = [];
    const paint = (node: Element | null, ink = [0, 0, 0, 0]) => {
      for (let parent = node; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        layers.push({ className: parent.className, background: style.backgroundColor, image: style.backgroundImage,
          opacity: style.opacity, backdrop: style.backdropFilter });
        ink = over(ink, rgba(style.backgroundColor)); ink[3] *= Number(style.opacity);
      }
      return over(ink, [1, 1, 1, 1]); // Opaque browser canvas behind the root.
    };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    const pseudo = getComputedStyle(element, "::placeholder"), borderStyle = getComputedStyle(boundary);
    const placeholder = rgba(pseudo.color); placeholder[3] *= Number(pseudo.opacity);
    const inner = paint(element), outer = paint(boundary.parentElement), boundaryInner = paint(boundary);
    const foreground = paint(element, placeholder), border = paint(boundary, rgba(borderStyle.borderTopColor));
    return { placeholder: { color: pseudo.color, opacity: pseudo.opacity, foreground, background: inner, ratio: ratio(foreground, inner) },
      boundary: { color: borderStyle.borderTopColor, width: borderStyle.borderTopWidth, style: borderStyle.borderTopStyle,
        foreground: border, inner: boundaryInner, outer, innerRatio: ratio(border, boundaryInner), outerRatio: ratio(border, outer) }, layers,
      flatBackgroundAssumption: "Empty fixture; solid ancestor backgrounds, no image/gradient behind sampled input. Home blur is over the flat fixture; PNG requires visual review." };
  }, boundarySelector);
}

export function assertPlaceholderContrast(metrics: Awaited<ReturnType<typeof computedContrast>>) {
  expect(metrics.layers.filter((layer) => layer.image !== "none"), "Gradient/image requires pixel sampling; do not infer contrast").toEqual([]);
  expect(metrics.placeholder.ratio).toBeGreaterThanOrEqual(4.5);
}

export function assertBoundaryContrast(metrics: Awaited<ReturnType<typeof computedContrast>>) {
  expect(parseFloat(metrics.boundary.width)).toBeGreaterThan(0);
  expect(metrics.boundary.style).not.toBe("none");
  expect(metrics.boundary.innerRatio).toBeGreaterThanOrEqual(3);
  expect(metrics.boundary.outerRatio).toBeGreaterThanOrEqual(3);
}

async function flatPixels(input: Locator, boundarySelector: string, path?: string) {
  const points = await input.evaluate((element, selector) => {
    const boundary = selector === "textarea" ? element : element.closest(selector)!;
    const inputBox = element.getBoundingClientRect(), box = boundary.getBoundingClientRect();
    const y = Math.floor(inputBox.bottom - 12);
    return { input: { x: Math.floor(inputBox.left + inputBox.width / 2), y },
      boundaryInner: { x: Math.floor(box.left + 4), y }, outer: { x: Math.floor(box.left - 3), y } };
  }, boundarySelector);
  const png = await input.page().screenshot({ ...(path ? { path } : {}), scale: "css" });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples = Object.fromEntries(Object.entries(points).map(([name, { x, y }]) => {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) throw new Error("WP08 contrast sample outside viewport");
    const offset = (y * info.width + x) * info.channels;
    return [name, Array.from(data.subarray(offset, offset + 4), (value) => value / 255)];
  }));
  return { path: path ?? null, points, samples, tolerance: 3 / 255 };
}

export async function inspectContrast(root: Locator, surface: ComposerSurface, info?: TestInfo, name = "contrast") {
  const observations = [];
  for (const [index, selectors] of paneSelectors(surface).entries()) {
    const input = root.locator(selectors.input);
    await input.fill(""); await input.blur(); await expect(input).toBeEnabled();
    await reveal(input);
    // Wait for the actual finite border transition, not a guessed sleep budget.
    await input.evaluate(async (element) => {
      await Promise.all(element.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})));
    });
    const boundary = surface === "home" ? "textarea" : selectors.pane;
    const metrics = await computedContrast(input, boundary);
    const pixels = await flatPixels(input, boundary, info?.outputPath(`wp08-${name}-input-${index}.png`));
    observations.push({ input: selectors.input, metrics, pixels });
  }
  return observations;
}

export function assertContrasts(observations: Awaited<ReturnType<typeof inspectContrast>>) {
  for (const { metrics, pixels } of observations) {
    for (const [name, expected] of Object.entries({ input: metrics.placeholder.background,
      boundaryInner: metrics.boundary.inner, outer: metrics.boundary.outer })) {
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(pixels.samples[name][channel] - expected[channel]),
          `Non-flat ${name} sample: inspect the PNG before making a contrast claim`).toBeLessThanOrEqual(pixels.tolerance);
      }
    }
    assertPlaceholderContrast(metrics); assertBoundaryContrast(metrics);
  }
}

export async function contrastMutations(page: Page, root: Locator, surface: ComposerSurface) {
  const prefix = surface === "home" ? ".home-prompt" : ".composer";
  const boundaries = surface === "home" ? `${prefix} textarea`
    : `${prefix} .composer__prompt-pane, ${prefix} .negative-prompt`;
  const observations = [];
  for (const [name, content] of [
    ["placeholder-opacity", `${prefix} textarea::placeholder { opacity:0.7!important; }`],
    ["old-boundary", `${boundaries} { border-color:var(--border)!important; }`],
  ]) {
    const style = await page.evaluateHandle((css) => {
      const element = document.createElement("style");
      element.textContent = css;
      document.head.appendChild(element);
      return element;
    }, content);
    try {
      const mutated = await inspectContrast(root, surface);
      for (const { metrics } of mutated) {
        const predicate = name === "placeholder-opacity" ? assertPlaceholderContrast : assertBoundaryContrast;
        expect(() => predicate(metrics)).toThrow();
      }
      observations.push({ name, mutated, rejected: true });
    } finally { await style.evaluate((element) => element.remove()); }
    assertContrasts(await inspectContrast(root, surface));
  }
  return observations;
}
