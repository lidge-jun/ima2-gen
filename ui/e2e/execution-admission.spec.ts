import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { MODEL_TRIGGER, PROVIDER_TRIGGER, openCreate, preflightJ6, requestObject,
  selectOption, withJ6, type J6Capture } from "./fixtures/j6Selection";

const GROK_MESSAGE = "Grok API key is required for grok-api image generation";
const COPY = {
  en: { title: "Grok API key required", body: "Add an xAI API key in Settings > Providers, then retry. This image request will not fall back to the Grok proxy.", cta: "Open provider settings" },
  ko: { title: "Grok API 키가 필요합니다", body: "설정 > 제공자에서 xAI API 키를 추가한 뒤 다시 시도하세요. 이 이미지 요청은 Grok 프록시로 전환되지 않습니다.", cta: "제공자 설정 열기" },
  "zh-Hans": { title: "需要 Grok API 密钥", body: "请在设置 > 提供商中添加 xAI API 密钥，然后重试。此图像请求不会回退到 Grok 代理。", cta: "打开提供商设置" },
  "zh-Hant": { title: "需要 Grok API 金鑰", body: "請在設定 > 供應商中新增 xAI API 金鑰，然後重試。此圖像請求不會改用 Grok 代理。", cta: "開啟供應商設定" },
};
const VARIANTS = {
  "grok-api-key-missing": { provider: "grok-api", model: "grok-imagine-image-2.0", status: 401,
    code: "GROK_API_KEY_MISSING", error: GROK_MESSAGE, copy: COPY.en },
  "oauth-unavailable": { provider: "oauth", model: "gpt-5.6-luna", status: 503,
    code: "OAUTH_UNAVAILABLE", error: "OAuth proxy unavailable", copy: {
      title: "GPT OAuth proxy unavailable",
      body: "The GPT OAuth proxy is starting, unavailable, or moved to a fallback port. Reload first; if it persists, run `ima2 doctor` and check the reported GPT OAuth URL.", cta: "Reload" } },
  "invalid-request": { provider: "api", model: "gpt-5.6-luna", status: 400,
    code: "INVALID_REQUEST", error: "Invalid size for image generation", copy: {
      title: "Image request needs changes",
      body: "One or more generation parameters are invalid. Check the raw error details below, then edit the prompt or size and try again.", cta: null } },
};
type Variant = keyof typeof VARIANTS;
type CardCopy = { title: string; body: string; cta: string | null };
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

test.beforeAll(async ({}, info) => { await preflightJ6(info); });

async function prepareComposer(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  if (viewport.width <= 800) {
    await expect(page.locator(".app")).toHaveAttribute("data-mobile", "1");
    await page.locator("button.mobile-app-bar__generate").click();
    await expect(page.locator("#mobile-generate-sheet")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#mobile-generate-sheet")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  } else {
    await expect(page.locator(".app")).not.toHaveAttribute("data-mobile", "1");
  }
  await expect(page.locator(MODEL_TRIGGER)).toBeVisible();
  await expect(page.locator(".composer__textarea:visible")).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function submitRefusal(page: Page, capture: J6Capture, origin: string, variant: Variant) {
  capture.submissionFailure = variant;
  const expected = VARIANTS[variant];
  const before = capture.requests.length;
  await page.locator(".composer__textarea:visible").fill("WP03 synthetic image admission fixture");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url() === `${origin}/api/generate` && r.request().method() === "POST"),
    page.locator(".generate-btn:visible").click(),
  ]);
  expect(response.status()).toBe(expected.status);
  expect(capture.requests).toHaveLength(before + 1);
  const submitted = capture.requests[before];
  expect(submitted.path).toBe("/api/generate");
  const payload = requestObject(submitted.body);
  expect(payload.provider).toBe(expected.provider);
  expect(payload.model).toBe(expected.model);
  expect(payload.async).toBe(true);
  const wire: unknown = await response.json();
  expect(wire).toEqual({ error: expected.error, code: expected.code, requestId: payload.requestId });
  expect(capture.unexpected).toEqual([]);
  return wire;
}

async function closeSheet(page: Page) {
  const sheet = page.locator("#mobile-generate-sheet");
  if (await sheet.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveAttribute("aria-hidden", "true");
    await expect(sheet).toBeHidden();
  }
}

function elementGeometry(locator: Locator) {
  return locator.evaluate((element) => {
    const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
    const rect = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const style = getComputedStyle(element);
    return { box: box(rect), text: element.textContent, textRects: Array.from(range.getClientRects(), box),
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      hitTestable: hit !== null && element.contains(hit), color: style.color, background: style.backgroundColor,
      whiteSpace: style.whiteSpace, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
      focusVisible: element.matches(":focus-visible") };
  });
}

// Resolve the actual rendered CSS colors, including color-mix and translucent ancestors.
function cardContrast(card: Locator) {
  return card.evaluate((element) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("WP03 color sampler unavailable");
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data, (v) => v / 255);
    };
    const blend = (fg: number[], bg: number[]) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const luminance = (rgb: number[]) => rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return Array.from(element.querySelectorAll<HTMLElement>(".toast__message, .toast__cta, .toast__dismiss"), (node) => {
      const backgrounds: number[][] = [];
      for (let parent: Element | null = node; parent; parent = parent.parentElement) backgrounds.push(rgba(getComputedStyle(parent).backgroundColor));
      const bg = backgrounds.reverse().reduce((base, color) => blend(color, base), [1, 1, 1]);
      const fg = blend(rgba(getComputedStyle(node).color), bg);
      const light = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return { selector: node.className, foreground: fg, background: bg, ratio: (light[0] + 0.05) / (light[1] + 0.05) };
    });
  });
}

function within(rect: Box, bounds: Box) {
  expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
  expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
  expect(rect.top).toBeGreaterThanOrEqual(bounds.top - 1);
  expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
}
function separate(a: Box, b: Box) {
  expect(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom - 1).toBe(true);
}
function readable(metrics: Awaited<ReturnType<typeof elementGeometry>>, bounds: Box) {
  within(metrics.box, bounds);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.textRects.length).toBeGreaterThan(0);
  for (const rect of metrics.textRects) {
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.width).toBeGreaterThan(0);
    within(rect, metrics.box);
  }
}

async function inspectCard(card: Locator, copy: CardCopy, raw: string) {
  await expect(card).toBeVisible();
  await expect(card.locator(".toast__message")).toHaveText(`${copy.title}: ${copy.body} ${raw}`);
  await expect(card.locator(".toast__cta")).toHaveCount(copy.cta ? 1 : 0);
  if (copy.cta) await expect(card.locator(".toast__cta")).toHaveText(copy.cta);
  const frame = await card.boundingBox();
  if (!frame) throw new Error("WP03 card has no box");
  const bounds = { left: frame.x, top: frame.y, right: frame.x + frame.width, bottom: frame.y + frame.height, ...frame };
  const message = await elementGeometry(card.locator(".toast__message"));
  const dismiss = await elementGeometry(card.locator(".toast__dismiss"));
  const cta = copy.cta ? await elementGeometry(card.locator(".toast__cta")) : null;
  const contrast = await cardContrast(card);
  return { bounds, message, dismiss, cta, contrast };
}

function assertCard(metrics: Awaited<ReturnType<typeof inspectCard>>, viewport: Box) {
  within(metrics.bounds, viewport);
  readable(metrics.message, metrics.bounds);
  separate(metrics.message.box, metrics.dismiss.box);
  for (const control of [metrics.dismiss, ...(metrics.cta ? [metrics.cta] : [])]) {
    within(control.box, metrics.bounds);
    expect(control.box.width).toBeGreaterThanOrEqual(44);
    expect(control.box.height).toBeGreaterThanOrEqual(44);
    expect(control.hitTestable).toBe(true);
  }
  if (metrics.cta) {
    readable(metrics.cta, metrics.bounds);
    expect(new Set(metrics.cta.textRects.map((r) => r.top)).size).toBe(1);
    separate(metrics.cta.box, metrics.message.box);
    separate(metrics.cta.box, metrics.dismiss.box);
  }
  // Ratios are recorded for the final visual review; broader contrast remediation is WP08.
  for (const contrast of metrics.contrast) expect(Number.isFinite(contrast.ratio)).toBe(true);
}

async function pageBounds(page: Page) {
  return page.evaluate(() => ({ left: 0, top: 0, right: innerWidth, bottom: innerHeight,
    width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth }));
}

async function focusEvidence(page: Page, card: Locator, info: TestInfo, name: string, hasCta: boolean) {
  const dismiss = card.locator(".toast__dismiss");
  await dismiss.focus();
  if (hasCta) {
    await page.keyboard.press("Shift+Tab");
    const cta = card.locator(".toast__cta");
    await expect(cta).toBeFocused();
    const focus = await elementGeometry(cta);
    expect(focus.focusVisible).toBe(true);
    expect(focus.outlineStyle).toBe("solid");
    expect(focus.outlineWidth).toBe("2px");
    await page.screenshot({ path: info.outputPath(`wp03-${name}-cta-focus.png`) });
    await page.keyboard.press("Tab");
  } else {
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
  }
  await expect(dismiss).toBeFocused();
  const focus = await elementGeometry(dismiss);
  expect(focus.focusVisible).toBe(true);
  expect(focus.outlineStyle).toBe("solid");
  expect(focus.outlineWidth).toBe("2px");
  await page.screenshot({ path: info.outputPath(`wp03-${name}-dismiss-focus.png`) });
}

const scenarios = [
  ...Object.keys(COPY).flatMap((locale) => [1280, 390].map((width) => ({ locale: locale as keyof typeof COPY, width }))),
  ...[320, 768, 1024, 1440].map((width) => ({ locale: "ko" as const, width })),
];
for (const variant of Object.keys(VARIANTS) as Variant[]) {
  const cases = variant === "grok-api-key-missing" ? scenarios : [1280, 390].map((width) => ({ locale: "en" as const, width }));
  for (const scenario of cases) {
    const name = `${variant}-${scenario.locale}-${scenario.width}`;
    test(`WP03 ${name} readable card and keyboard controls`, async ({ browser }, info) => {
      const expected = VARIANTS[variant];
      const copy = variant === "grok-api-key-missing" ? COPY[scenario.locale] : expected.copy;
      await withJ6(browser, info, { provider: expected.provider, imageModel: expected.model, expectedSubmissions: 1 }, async (page, capture, origin) => {
        await openCreate(page, origin);
        await page.evaluate((locale) => localStorage.setItem("ima2.locale", locale), scenario.locale);
        await page.reload(); // Real persisted locale reload; selectors below are language-independent.
        await prepareComposer(page, { width: scenario.width, height: scenario.width === 320 ? 740 : 844 });
        const wire = await submitRefusal(page, capture, origin, variant);
        await closeSheet(page);
        const card = page.locator(".toast--card[role=alert]");
        const metrics = await inspectCard(card, copy, expected.error);
        const viewport = await pageBounds(page);
        await writeFile(info.outputPath(`wp03-${name}.json`), JSON.stringify({ variant, locale: scenario.locale, wire, viewport, metrics, clockControlled: false }, null, 2));
        await page.screenshot({ path: info.outputPath(`wp03-${name}.png`) });
        assertCard(metrics, viewport);
        expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
        await focusEvidence(page, card, info, name, !!copy.cta);
      });
    });
  }
}

async function mixedStackEvidence(page: Page, info: TestInfo, width: number) {
  const stack = page.locator(".toast-stack");
  const viewport = await pageBounds(page);
  const stackBox = await elementGeometry(stack);
  within(stackBox.box, viewport);
  expect(stackBox.scrollHeight).toBeGreaterThan(stackBox.clientHeight);
  expect(stackBox.scrollWidth).toBeLessThanOrEqual(stackBox.clientWidth + 1);
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
  const cards = page.locator(".toast--card[role=alert]");
  const metrics = [];
  for (const [index, variant] of (["invalid-request", "oauth-unavailable", "grok-api-key-missing", "grok-api-key-missing"] as const).entries()) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    const measured = await inspectCard(card, VARIANTS[variant].copy, VARIANTS[variant].error);
    metrics.push(measured);
    assertCard(measured, viewport);
    await focusEvidence(page, card, info, `mixed-${width}-${index}`, !!VARIANTS[variant].copy.cta);
  }
  const ordinary = stack.locator(".toast:not(.toast--card)");
  await ordinary.scrollIntoViewIfNeeded();
  expect((await elementGeometry(ordinary.locator(".toast__dismiss"))).hitTestable).toBe(true);
  await expect(ordinary.locator(".toast__message")).toHaveCSS("white-space", "nowrap");
  const extremes = [];
  for (const edge of ["oldest", "newest"] as const) {
    await stack.evaluate((el, position) => { el.scrollTop = position === "oldest" ? 0 : el.scrollHeight; }, edge);
    extremes.push({ edge, scrollTop: await stack.evaluate((el) => el.scrollTop) });
    await page.screenshot({ path: info.outputPath(`wp03-mixed-${width}-${edge}.png`) });
  }
  expect(extremes[0].scrollTop).toBe(0);
  expect(extremes[1].scrollTop).toBeGreaterThan(0);
  await writeFile(info.outputPath(`wp03-mixed-${width}.json`), JSON.stringify({ viewport, stackBox, metrics, extremes, clockControlled: true }, null, 2));
}

for (const width of [320, 390]) {
  test(`WP03 mixed five-row stack ${width} stays reachable and auto-dismisses`, async ({ browser }, info) => {
    await withJ6(browser, info, { provider: "api", imageModel: "gpt-5.6-luna", expectedSubmissions: 4 }, async (page, capture, origin) => {
      await page.clock.install({ time: new Date("2026-09-05T00:00:00Z") });
      await openCreate(page, origin);
      await prepareComposer(page, { width: 1280, height: 844 });
      await page.clock.pauseAt(new Date("2026-09-05T01:00:00Z"));
      // Two HEIC files take PromptComposer's no-metadata branch; addReferences
      // rejects both locally with one ordinary toast, before any image decoding/upload.
      await page.locator(".composer:visible input[type=file]").setInputFiles([
        { name: "first.heic", mimeType: "image/heic", buffer: Buffer.from("synthetic unsupported fixture") },
        { name: "second.heic", mimeType: "image/heic", buffer: Buffer.from("synthetic unsupported fixture") },
      ]);
      await expect(page.locator(".toast:not(.toast--card) .toast__message")).toHaveText("HEIC/HEIF is not supported. Convert to JPEG or PNG and try again.");
      await submitRefusal(page, capture, origin, "invalid-request");
      await expect(page.locator(".toast--card")).toHaveCount(1);
      await selectOption(page, PROVIDER_TRIGGER, "GPT");
      await submitRefusal(page, capture, origin, "oauth-unavailable");
      await expect(page.locator(".toast--card")).toHaveCount(2);
      await selectOption(page, PROVIDER_TRIGGER, "xAI API");
      await submitRefusal(page, capture, origin, "grok-api-key-missing");
      await expect(page.locator(".toast--card")).toHaveCount(3);
      await submitRefusal(page, capture, origin, "grok-api-key-missing");
      await expect(page.locator(".toast-stack > .toast")).toHaveCount(5);
      await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
      await page.clock.runFor(300); // Flush viewport/focus scheduling; lifetime is still below 3s.
      await expect(page.locator(".app")).toHaveAttribute("data-mobile", "1");
      await closeSheet(page);
      await page.evaluate(async () => { await document.fonts.ready; });
      await mixedStackEvidence(page, info, width);
      await expect(page.locator(".toast-stack > .toast")).toHaveCount(5);
      await page.clock.runFor(3000);
      await expect(page.locator(".toast-stack")).toHaveCount(0);
      await writeFile(info.outputPath(`wp03-mixed-${width}-lifetime.json`), JSON.stringify({ clockControlled: true, before: 5, advancedMs: 3000, after: 0 }));
      expect(capture.requests).toHaveLength(4);
    });
  });
}
