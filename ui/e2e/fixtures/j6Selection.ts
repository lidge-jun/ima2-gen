import { expect, type Browser, type BrowserContext, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { assertJ6Isolation, j6RunnerPathDiagnostics, startApp } from "./appServer";
import type { ComfyLaneModels, LaneCatalog } from "../../src/lib/api-comfy";

export const MODEL_TRIGGER = "#sidebar-generation-model:visible";
export const PROVIDER_TRIGGER = "#sidebar-generation-provider:visible";
export const WP02_VIEWPORTS = [
  { width: 1440, height: 1000 }, { width: 1024, height: 800 }, { width: 768, height: 1024 },
  { width: 390, height: 844 }, { width: 320, height: 740 },
];
export const J6_WORKFLOWS: ComfyLaneModels = {
  image: [{ id: "wf-first", label: "First image", executable: true },
    { id: "wf-selected", label: "Selected image", executable: true }],
  video: [{ id: "wf-video-first", label: "First video", executable: true },
    { id: "wf-video-selected", label: "Selected video", executable: true }],
};
export type J6CatalogState = { mode: "ready" | "empty" | "offline" | "error" };
export type J6Capture = {
  requests: Array<{ path: string; body: unknown }>;
  unexpected: string[];
  catalog: J6CatalogState;
  submissionFailure?: "grok-api-key-missing" | "oauth-unavailable" | "invalid-request";
  dispose(): Promise<void>;
};
export type J6Seed = {
  provider?: string; imageModel?: string; videoModel?: string | false;
  generationDefaults?: Record<string, unknown>;
  expectedSubmissions?: number; // Harness-only assertion, never persisted into the app.
};

function modelCatalog(state: J6CatalogState): { ok: true; lanes: LaneCatalog } {
  const lane = (image: string[], video: string[] = []) => ({ status: "ready" as const,
    models: { image: image.map((id) => ({ id, label: id })), video: video.map((id) => ({ id, label: id })) } });
  const models = state.mode === "empty" ? { image: [], video: [] } : {
    image: J6_WORKFLOWS.image.map((row) => ({ ...row, executable: state.mode !== "offline" })),
    video: J6_WORKFLOWS.video.map((row) => ({ ...row, executable: state.mode !== "offline" })),
  };
  return { ok: true, lanes: {
    oauth: lane(["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"]),
    api: lane(["gpt-5.6-luna", "gpt-5.6-sol"]),
    grok: lane(["grok-imagine-image-2.0", "grok-imagine-image-quality"], ["grok-imagine-video-1.5"]),
    "grok-api": lane(["grok-imagine-image-2.0", "grok-imagine-image-quality"], ["grok-imagine-video-1.5"]),
    "gemini-api": lane(["nano-banana-pro", "nano-banana-2"]),
    comfy: { status: state.mode === "offline" ? "disconnected" : "ready", models },
  } };
}

function readFixtures(catalog: J6CatalogState): Record<string, unknown> {
  // An already-saved empty session: version0 invokes the existing beforeunload
  // initialization PUT. Selection reloads do not exercise graph creation.
  const session = { id: "wp02-session", title: "Selection fixture", createdAt: 1, updatedAt: 1,
    graphVersion: 1, nodeCount: 0, nodes: [], edges: [] };
  return {
    "/api/models": modelCatalog(catalog),
    "/api/capabilities": { limits: { maxRefCount: 5 }, defaults: {} },
    "/api/oauth/status": { status: "ready", models: ["gpt-5.6-luna"] },
    "/api/grok/status": { status: "ready", models: ["grok-imagine-image-2.0"] },
    "/api/agy/status": { installed: false },
    "/api/keys/status": Object.fromEntries(["openai", "xai", "gemini", "vertex", "atlascloud", "minimax", "nai"]
      .map((id) => [id, { configured: true, valid: true, source: "fixture", maskedKey: null }])),
    "/api/providers": { apiKey: true, oauth: true, apiKeyDisabled: false, apiKeySource: "fixture" },
    "/api/billing": { oauth: true, apiKeyValid: true, apiKeySource: "fixture" },
    "/api/mcp/providers": { providers: [] },
    "/api/inflight": { jobs: [], terminalJobs: [] },
    "/api/assets": { assets: [], nextCursor: null, total: 0 },
    "/api/sessions": { sessions: [session] },
    "/api/sessions/wp02-session": { session },
    "/api/config/grok-planner": { model: "grok-4.3", options: ["grok-4.3"] },
    "/api/prompt-builder/config": { backend: "auto", model: "gpt-5.6-luna",
      options: { backends: ["auto"], models: { auto: ["gpt-5.6-luna"] }, autoOrder: [] },
      locked: { backend: true, model: true } },
  };
}

export function requestObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected JSON request object");
  return body as Record<string, unknown>;
}

async function captureSubmission(route: Route, capture: J6Capture, path: string): Promise<void> {
  try {
    const body: unknown = route.request().postDataJSON();
    const record = requestObject(body);
    if (record.async !== true || typeof record.requestId !== "string" || !record.requestId) {
      throw new Error("Missing async correlation");
    }
    capture.requests.push({ path, body });
    const refusal = path === "/api/generate" && capture.submissionFailure ? {
      "grok-api-key-missing": { provider: "grok-api", status: 401, code: "GROK_API_KEY_MISSING",
        error: "Grok API key is required for grok-api image generation" },
      "oauth-unavailable": { provider: "oauth", status: 503, code: "OAUTH_UNAVAILABLE",
        error: "OAuth proxy unavailable" },
      "invalid-request": { provider: "api", status: 400, code: "INVALID_REQUEST",
        error: "Invalid size for image generation" },
    }[capture.submissionFailure] : undefined;
    if (refusal && record.provider === refusal.provider) {
      // Actual pre-admission flat shape: no synthetic rawCode/errorClass fields.
      await route.fulfill({ status: refusal.status, json: {
        error: refusal.error, code: refusal.code, requestId: record.requestId,
      } });
      return;
    }
    // Submission proof only. No provider, fake completion, response fetch or fallback.
    await route.fulfill({ status: 202, json: { requestId: record.requestId } });
  } catch {
    capture.unexpected.push("invalid fixture submission");
    await route.abort("blockedbyclient");
  }
}

async function serveJ6(route: Route, origin: string, capture: J6Capture): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (url.origin !== origin || url.username || url.password) {
    capture.unexpected.push(`${method} non-fixture-origin`);
    await route.abort("blockedbyclient");
  } else if (method === "POST" && !url.search && ["/api/generate", "/api/video/generate"].includes(url.pathname)) {
    await captureSubmission(route, capture, url.pathname);
  } else if (method !== "GET") {
    capture.unexpected.push(`${method} ${url.pathname} unexpected-mutation`);
    await route.abort("blockedbyclient");
  } else if (url.pathname === "/api/events") {
    // 204 prevents EventSource reconnect loops; these tests assert capture, not completion.
    await route.fulfill({ status: 204, body: "" });
  } else if (url.pathname === "/api/history") {
    await route.fulfill({ json: url.searchParams.has("groupBy")
      ? { sessions: [], loose: [], total: 0, nextCursor: null }
      : { items: [], total: 0, nextCursor: null } });
  } else if (url.pathname === "/api/models" && capture.catalog.mode === "error") {
    await route.fulfill({ status: 503, json: { error: "Fixture catalog unavailable" } });
  } else if (Object.hasOwn(readFixtures(capture.catalog), url.pathname)) {
    await route.fulfill({ json: readFixtures(capture.catalog)[url.pathname] });
  } else if (url.pathname.startsWith("/api/")) {
    capture.unexpected.push("GET unexpected-api");
    await route.abort("blockedbyclient");
  } else {
    await route.continue(); // Only same-origin static application resources.
  }
}

export async function installJ6SelectionCapture(context: BrowserContext, fixtureOrigin: string): Promise<J6Capture> {
  const url = new URL(fixtureOrigin);
  if (url.origin !== fixtureOrigin || url.hostname !== "127.0.0.1" || url.protocol !== "http:"
    || !url.port || url.port === "3333" || context.pages().length || context.serviceWorkers().length) {
    throw new Error("J6 BLOCKED: capture requires an unused context and ephemeral loopback origin");
  }
  const capture: J6Capture = { requests: [], unexpected: [], catalog: { mode: "ready" },
    dispose: () => context.unroute("**/*", handler) };
  const handler = async (route: Route) => {
    try { await serveJ6(route, fixtureOrigin, capture); }
    catch { capture.unexpected.push("route-handler-failed"); await route.abort("failed").catch(() => {}); }
  };
  try {
    await context.route("**/*", handler);
    return capture;
  } catch (error) { await capture.dispose(); throw error; }
}

function seedEntries(seed: J6Seed): Array<{ name: string; value: string }> {
  return Object.entries({
    "ima2.locale": "en", "ima2.onboardingDismissed": "1", "ima2.uiMode": "classic",
    "ima2.workspaceProfile": "default", "ima2.activeSessionId": "wp02-session",
    "ima2.imageModel": seed.imageModel ?? "gpt-5.6-luna",
    "ima2.videoDefaults": JSON.stringify({ model: seed.videoModel ?? false }),
    "ima2.generationDefaults": JSON.stringify({ provider: seed.provider ?? "oauth", multimode: false,
      ...seed.generationDefaults }),
  }).map(([name, value]) => ({ name, value }));
}

export async function openCreate(page: Page, origin: string): Promise<void> {
  await page.goto(origin);
  await page.locator("nav[aria-label='Main navigation']").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(MODEL_TRIGGER)).toBeVisible();
}

export async function selectOption(page: Page, trigger: string, label: string): Promise<void> {
  await page.locator(trigger).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

export async function selectionScreenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  await expect(page.locator(MODEL_TRIGGER)).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  // The entire context contains only synthetic fixtures; no signed-in data is loaded.
  await page.screenshot({ path: info.outputPath(`wp02-${name}.png`) });
}

function labelGeometry(control: Locator, labelSelector: string) {
  return control.evaluate((element, selector) => {
    const label = element.querySelector<HTMLElement>(selector);
    if (!label) throw new Error("WP02 missing visible selection label");
    const box = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top,
      bottom: rect.bottom, width: rect.width, height: rect.height });
    const range = document.createRange();
    range.selectNodeContents(label);
    const rect = element.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const clientBox = { left: labelRect.left + label.clientLeft, top: labelRect.top + label.clientTop,
      right: labelRect.left + label.clientLeft + label.clientWidth,
      bottom: labelRect.top + label.clientTop + label.clientHeight };
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { text: label.textContent, control: box(rect), label: box(labelRect), clientBox,
      clientWidth: label.clientWidth, scrollWidth: label.scrollWidth,
      clientHeight: label.clientHeight, scrollHeight: label.scrollHeight,
      controlClientWidth: element.clientWidth, controlScrollWidth: element.scrollWidth,
      textRects: Array.from(range.getClientRects(), box),
      hitTestable: hit !== null && element.contains(hit),
      siblings: Array.from(element.querySelectorAll(".ctl-select__caret, .ctl-select__value-sub"),
        (sibling) => box(sibling.getBoundingClientRect())) };
  }, labelSelector);
}

function assertReadableLabel(metrics: Awaited<ReturnType<typeof labelGeometry>>, expected: string) {
  expect(metrics.text).toBe(expected);
  expect(metrics.hitTestable).toBe(true);
  expect(metrics.control.width).toBeGreaterThan(0);
  expect(metrics.control.height).toBeGreaterThan(0);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.controlScrollWidth).toBeLessThanOrEqual(metrics.controlClientWidth + 1);
  expect(metrics.textRects.length).toBeGreaterThan(0);
  for (const rect of metrics.textRects) {
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    for (const bounds of [metrics.control, metrics.label, metrics.clientBox]) {
      expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
      expect(rect.top).toBeGreaterThanOrEqual(bounds.top - 1);
      expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
    }
    for (const sibling of metrics.siblings) {
      expect(rect.right <= sibling.left + 1 || rect.left >= sibling.right - 1
        || rect.bottom <= sibling.top + 1 || rect.top >= sibling.bottom - 1).toBe(true);
    }
  }
}

export async function readableSelection(page: Page, info: TestInfo, name: string,
  expected: { provider: string; model: string }): Promise<void> {
  const controls = [page.locator(PROVIDER_TRIGGER), page.locator(MODEL_TRIGGER)];
  for (const [index, label] of [expected.provider, expected.model].entries()) {
    await expect(controls[index].locator(".ctl-select__value")).toHaveText(label);
  }
  await page.evaluate(async () => { await document.fonts.ready; });
  const labels = await Promise.all(controls.map((control) => labelGeometry(control, ".ctl-select__value")));
  const pageBounds = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    headerButtons: Array.from(document.querySelectorAll<HTMLElement>(".mobile-app-bar button"))
      .filter((button) => button.getClientRects().length > 0).map((button) => {
        const { left, right, top, bottom, height } = button.getBoundingClientRect();
        return { left, right, top, bottom, height };
      }) }));
  await writeFile(info.outputPath(`wp02-${name}-metrics.json`), JSON.stringify({ expected, labels, pageBounds }, null, 2));
  await selectionScreenshot(page, info, name);
  labels.forEach((label, index) => assertReadableLabel(label, [expected.provider, expected.model][index]));
  expect(pageBounds.scrollWidth).toBeLessThanOrEqual(pageBounds.clientWidth + 1);
  expect(labels[0].control.right).toBeLessThanOrEqual(labels[1].control.left + 1);
  for (const { control } of labels) {
    expect(control.left).toBeGreaterThanOrEqual(-1);
    expect(control.right).toBeLessThanOrEqual(pageBounds.width + 1);
    expect(control.top).toBeGreaterThanOrEqual(-1);
    expect(control.bottom).toBeLessThanOrEqual(pageBounds.height + 1);
    if (pageBounds.width <= 800) expect(control.height).toBeGreaterThanOrEqual(44);
  }
  for (const [index, button] of pageBounds.headerButtons.entries()) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    for (const other of pageBounds.headerButtons.slice(index + 1)) {
      expect(button.right <= other.left + 1 || button.left >= other.right - 1
        || button.bottom <= other.top + 1 || button.top >= other.bottom - 1).toBe(true);
    }
  }
}

async function selectedMenu(page: Page, info: TestInfo, name: string, expected: string): Promise<void> {
  const trigger = page.locator(MODEL_TRIGGER);
  await trigger.click();
  try {
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const selected = page.getByRole("option", { selected: true });
    await expect(selected.locator(".ctl-select__item-label")).toHaveText(expected);
    await expect(selected).toBeInViewport();
    await page.evaluate(async () => { await document.fonts.ready; });
    const metrics = await labelGeometry(selected, ".ctl-select__item-label");
    await writeFile(info.outputPath(`wp02-${name}-menu-metrics.json`), JSON.stringify({ expected, metrics }, null, 2));
    await selectionScreenshot(page, info, `${name}-menu`);
    assertReadableLabel(metrics, expected);
  } finally {
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
}

export async function composerMode(page: Page, info: TestInfo, name: string, sequence: boolean): Promise<void> {
  const mobile = (page.viewportSize()?.width ?? 0) <= 800;
  const opener = page.locator("button.mobile-app-bar__generate");
  const sheet = page.locator("#mobile-generate-sheet");
  if (mobile) {
    await expect(opener).toHaveAccessibleName("Open prompt sheet to generate an image");
    await opener.click();
    await expect(sheet).toHaveAttribute("aria-hidden", "false");
    await expect(sheet).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(sheet.getByRole("tab", { name: "Prompt", exact: true })).toHaveAttribute("aria-selected", "true");
  }
  try {
    const composer = mobile ? sheet.locator(".composer:visible") : page.locator(".composer:visible");
    await expect(composer).toBeVisible();
    await expect(composer.locator(".composer__textarea")).toBeVisible();
    const metrics = await composer.evaluate((element) => ({
      sequence: element.classList.contains("composer--multimode"), ariaLabel: element.getAttribute("aria-label"),
      badge: element.querySelector(".composer__mode-badge")?.textContent ?? null,
      placeholder: element.querySelector("textarea")?.getAttribute("placeholder") }));
    await writeFile(info.outputPath(`wp02-${name}-composer-metrics.json`), JSON.stringify({ mobile, expectedSequence: sequence, metrics }, null, 2));
    await selectionScreenshot(page, info, `${name}-composer`);
    expect(metrics).toEqual(sequence ? {
      sequence: true, ariaLabel: "Sequence prompt composer, up to 4 separate stages", badge: "Sequence · up to 4",
      placeholder: "Describe the sequence. Use Count with Sequence off for same-prompt batches.",
    } : { sequence: false, ariaLabel: "Prompt", badge: null,
      placeholder: "Describe the image you want. Drag & drop or paste to attach reference images..." });
    await expect(composer.locator(".composer__mode-badge")).toHaveCount(sequence ? 1 : 0);
    if (sequence) await expect(composer.locator(".composer__mode-badge")).toBeVisible();
  } finally {
    if (mobile) {
      await sheet.locator(".compose-sheet__handle").click();
      await expect(sheet).toHaveAttribute("aria-hidden", "true");
      await expect(sheet).toBeHidden();
      await expect(opener).toBeFocused();
    }
  }
}

async function settleSelectionViewport(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  const app = page.locator(".app");
  if (viewport.width <= 800) {
    await expect(app).toHaveAttribute("data-mobile", "1");
    await expect(page.locator(".mobile-app-bar")).toBeVisible();
  } else {
    await expect(app).not.toHaveAttribute("data-mobile", "1");
    await expect(page.locator(".mobile-app-bar")).toHaveCount(0);
  }
  await expect(page.locator(PROVIDER_TRIGGER)).toBeVisible();
  await expect(page.locator(MODEL_TRIGGER)).toBeVisible();
}

export async function selectionViewports(page: Page, info: TestInfo, name: string,
  expected: { provider: string; model: string; sequence?: boolean }): Promise<void> {
  const original = page.viewportSize();
  try {
    for (const viewport of WP02_VIEWPORTS) {
      await settleSelectionViewport(page, viewport);
      const frame = `${name}-${viewport.width}`;
      await readableSelection(page, info, frame, expected);
      await selectedMenu(page, info, frame, expected.model);
      if (expected.sequence !== undefined) await composerMode(page, info, frame, expected.sequence);
    }
  } finally { if (original) await settleSelectionViewport(page, original); }
}

export async function preflightJ6(info: TestInfo): Promise<void> {
  try {
    const isolation = assertJ6Isolation();
    await writeFile(info.outputPath("wp02-preflight.json"), JSON.stringify({ passed: true, isolation }));
  } catch (error) {
    await writeFile(info.outputPath("wp02-preflight.json"), JSON.stringify({ passed: false,
      reason: error instanceof Error ? error.message : "Isolation preflight failed",
      runnerPathDiagnostics: j6RunnerPathDiagnostics() }));
    throw error;
  }
}

export async function withJ6(browser: Browser, info: TestInfo, seed: J6Seed,
  run: (page: Page, capture: J6Capture, origin: string) => Promise<void>): Promise<void> {
  const app = await startApp("minimax", { j6: true, provider: "oauth" });
  let context: BrowserContext | undefined;
  let capture: J6Capture | undefined;
  const teardown = { contextClosed: false, childExitedAndStubClosed: false };
  try {
    // storageState seeds ONCE, not an init script that would overwrite a true reload.
    context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 },
      storageState: { cookies: [], origins: [{ origin: app.baseUrl, localStorage: seedEntries(seed) }] } });
    capture = await installJ6SelectionCapture(context, app.baseUrl);
    const guardedCapture = capture;
    await context.routeWebSocket(/.*/, async (socket) => {
      guardedCapture.unexpected.push("unexpected-websocket");
      await socket.close(); // Never connectToServer; the owned context removes this guard on close.
    });
    await run(await context.newPage(), capture, app.baseUrl);
  } finally {
    try {
      if (context) {
        // Keep guards active while unloading every page; unexpected beacons still fail.
        try { for (const page of context.pages()) await page.close(); }
        finally {
          try { if (capture) await capture.dispose(); }
          finally { await context.close(); teardown.contextClosed = true; }
        }
      }
    } finally {
      try { await app.close(); teardown.childExitedAndStubClosed = true; }
      finally {
        const requests = capture?.requests.map(({ path, body }) => {
          const payload = requestObject(body);
          return { path, provider: payload.provider, model: payload.model, requestId: payload.requestId, async: payload.async };
        }) ?? [];
        await writeFile(info.outputPath("wp02-evidence.json"), JSON.stringify({ isolation: app.isolation,
          configPath: app.home, origin: app.baseUrl, routeScope: "context/all-pages; exact-origin; deny mutations/external; SW blocked",
          requests, expectedSubmissions: seed.expectedSubmissions,
          unexpected: capture?.unexpected ?? [], stubCalls: app.stub.calls.length,
          teardown, completionClaimed: false }, null, 2));
      }
    }
    expect(capture?.unexpected ?? []).toEqual([]);
    expect(app.stub.calls).toEqual([]);
    expect(teardown).toEqual({ contextClosed: true, childExitedAndStubClosed: true });
    if (seed.expectedSubmissions !== undefined) expect(capture?.requests ?? []).toHaveLength(seed.expectedSubmissions);
  }
}
