import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { preflightJ6, withJ6, requestObject, type J6Capture } from "./fixtures/j6Selection";
import { startTrackingStream, type TrackingStream } from "./fixtures/jobTrackingStream";
import { trackingVideoBytes, trackingVideoMime, trackingVideoFilename } from "./fixtures/jobTrackingMedia";

const warnings = {
  en: "Job tracking expired; upstream completion is unknown. Inspect history before retrying.",
  ko: "작업 추적 시간이 만료되어 제공자 측 완료 여부를 알 수 없습니다. 다시 시도하기 전에 기록을 확인하세요.",
  "zh-Hans": "任务跟踪已超时，无法确认服务提供方是否已完成。重试前请先检查历史记录。",
  "zh-Hant": "工作追蹤已逾時，無法確認服務提供方是否已完成。重試前請先檢查歷史紀錄。",
} as const;
const poison = "WP07_SECRET_PROMPT_TOKEN";
const expiry = { code: "UNKNOWN", rawCode: "JOB_TRACKING_TIMEOUT", errorClass: "AUTH_EXPIRED", error: poison };
// Same synthetic PNG used by the existing owned upstream fixture.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
type NativeObservation = { kind: string; at: number; data?: boolean; closeFrom?: string };
declare global { interface Window { __wp07Native: NativeObservation[] } }
type Scenario = {
  stream: TrackingStream; sequence: string[]; acceptance: Record<string, unknown>[];
  pending: Array<Record<string, unknown>>; history: Array<Record<string, unknown>>;
  terminal: Array<Record<string, unknown>>; session: Record<string, unknown>;
  outcome: "tracking" | "ordinary" | "cancel" | "success" | "held";
  errors: string[];
  graphSaves: Array<{ path: string; body: Record<string, unknown> }>;
};

async function observeNative(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    const descriptor = Object.getOwnPropertyDescriptor(Native.prototype, "onerror")!;
    window.__wp07Native = [];
    window.EventSource = new Proxy(Native, { construct(target, args) {
      const source = Reflect.construct(target, args) as EventSource;
      let errorContext = "none";
      const close = source.close.bind(source);
      source.close = () => { window.__wp07Native.push({ kind: "close", at: performance.now(), closeFrom: errorContext }); close(); };
      Object.defineProperty(source, "onerror", { configurable: true,
        get: () => descriptor.get?.call(source),
        set: (handler: ((event: Event) => void) | null) => descriptor.set?.call(source, handler && ((event: Event) => {
          errorContext = event instanceof MessageEvent && typeof event.data === "string" ? "application" : "transport";
          try { handler.call(source, event); } finally { errorContext = "none"; }
        })),
      });
      source.addEventListener("open", () => window.__wp07Native.push({ kind: "open", at: performance.now() }));
      source.addEventListener("error", (event) => window.__wp07Native.push({ kind: "error", at: performance.now(), data: event instanceof MessageEvent }));
      return source;
    } });
  });
}

async function seedOnce(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem("wp07-seeded")) return;
    sessionStorage.setItem("wp07-seeded", "1");
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, entries);
}

function historyItem(filename: string, mediaType = "video"): Record<string, unknown> {
  return { filename, url: `/generated/${filename}`, image: `/generated/${filename}`, mediaType,
    prompt: "Synthetic motion", createdAt: 100, provider: "grok", model: "grok-imagine-video-1.5",
    format: mediaType === "video" ? "mp4" : "png", quality: null, size: null, usage: null, webSearchCalls: 0 };
}

function terminalFrame(request: Record<string, unknown>, outcome: Scenario["outcome"]) {
  const requestId = request.requestId;
  if (outcome === "success") return { requestId, filename: "wp07-result.mp4", url: "/generated/wp07-result.mp4", mediaType: "video" };
  if (outcome === "tracking") return { ...expiry, requestId, envelope: { version: 1, terminal: true,
    jobId: requestId, requestId, sequence: 1, phase: "timed_out", error: { code: "JOB_TRACKING_TIMEOUT", message: poison, status: 504 } } };
  return { requestId, code: outcome === "cancel" ? "GENERATION_CANCELED" : "INVALID_REQUEST", error: "Ordinary fixture failure" };
}

async function submit(page: Page, capture: J6Capture, scenario: Scenario,
  route: import("@playwright/test").Route, path: string): Promise<void> {
  const body = requestObject(route.request().postDataJSON());
  expect(typeof body.requestId).toBe("string"); expect(body.requestId).not.toBe("");
  const native = await page.evaluate(() => window.__wp07Native);
  expect(native.some((event) => event.kind === "open")).toBe(true);
  scenario.sequence.push("OPEN-observed-before-POST", path);
  capture.requests.push({ path, body }); scenario.pending.push(body);
  let accepted: Record<string, unknown> = { requestId: body.requestId };
  if (path === "/api/video/extend") {
    expect(typeof body.sourceVideoId).toBe("string"); expect(body.sourceVideoId).not.toBe("");
    accepted = { ...accepted, sourceVideoId: body.sourceVideoId, workflow: "last-frame-i2v" };
  } else expect(body.async).toBe(true);
  scenario.acceptance.push(accepted);
  await route.fulfill({ status: 202, json: accepted }); scenario.sequence.push("202-fulfilled");
  if (scenario.outcome === "held") return;
  const outcome = scenario.outcome;
  scenario.stream.emit(outcome === "success" ? "done" : "error", terminalFrame(body, outcome), capture.requests.length);
  scenario.sequence.push(`terminal-${outcome}`);
}

async function installScenario(page: Page, capture: J6Capture, origin: string): Promise<Scenario> {
  const stream = await startTrackingStream(origin);
  const scenario: Scenario = { stream, sequence: [], acceptance: [], pending: [], history: [], terminal: [], outcome: "tracking", errors: [], graphSaves: [],
    session: { id: "wp02-session", title: "Owned WP07 graph", createdAt: 1, updatedAt: 1, graphVersion: 1, nodes: [], edges: [] } };
  try {
    page.on("pageerror", (error) => scenario.errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") scenario.errors.push(message.text()); });
    await observeNative(page);
    await page.context().route("**/*", async (route) => {
      try {
        const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
        if (url.origin !== origin) return await route.fallback();
        if (req.method() === "GET" && path === "/api/events") return await stream.routeEvents(route);
        if (req.method() === "POST" && ["/api/generate", "/api/video/generate", "/api/video/extend"].includes(path)) {
          expect(url.search).toBe(""); return await submit(page, capture, scenario, route, path);
        }
        if (req.method() === "GET" && [trackingVideoFilename, "wp07-other.mp4", "wp07-result.mp4", "wp07-anchor.png"].some((name) => path === `/generated/${name}`)) {
          return await route.fulfill({ contentType: path.endsWith(".png") ? "image/png" : trackingVideoMime, body: path.endsWith(".png") ? png : trackingVideoBytes });
        }
        if (req.method() === "GET" && path === "/api/inflight") return await route.fulfill({ json: { jobs: [], terminalJobs: scenario.terminal } });
        if (req.method() === "GET" && path === "/api/assets/folders") return await route.fulfill({ json: { folders: [] } });
        if (req.method() === "GET" && path === "/api/history") return await route.fulfill({ json: url.searchParams.has("groupBy")
          ? { sessions: [], loose: scenario.history, total: scenario.history.length, nextCursor: null }
          : { items: scenario.history, total: scenario.history.length, nextCursor: null } });
        if (req.method() === "GET" && path === "/api/sessions/wp02-session") return await route.fulfill({ json: { session: scenario.session } });
        if (req.method() === "PUT" && path === "/api/sessions/wp02-session/graph") {
          const graph = requestObject(req.postDataJSON());
          scenario.graphSaves.push({ path, body: graph });
          expect(url.search).toBe(""); expect(Array.isArray(graph.nodes)).toBe(true); expect(Array.isArray(graph.edges)).toBe(true);
          scenario.session = { ...scenario.session, nodes: graph.nodes, edges: graph.edges, graphVersion: Number(scenario.session.graphVersion) + 1 };
          return await route.fulfill({ json: { graphVersion: scenario.session.graphVersion } });
        }
        await route.fallback();
      } catch (error) { capture.unexpected.push(`WP07 route: ${error instanceof Error ? error.message : String(error)}`); await route.abort().catch(() => {}); }
    });
    return scenario;
  } catch (error) { await stream.close(); throw error; }
}

async function open(page: Page, origin: string, scenario: Scenario, hash = "#create") {
  await page.goto(origin + hash); await scenario.stream.ready();
  await expect.poll(() => page.evaluate(() => window.__wp07Native.filter((e) => e.kind === "open").length)).toBeGreaterThan(0);
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: info.outputPath(`wp07-${name}.png`) });
  const rendered = await page.evaluate(() => ({
    warnings: Array.from(document.querySelectorAll(".toast__message, .assetgen-error__text > span, .image-node__status"), (e) => e.textContent),
    actions: Array.from(document.querySelectorAll<HTMLButtonElement>(".result-actions button"), (e) => ({ label: e.textContent, disabled: e.disabled, title: e.title })),
    videos: Array.from(document.querySelectorAll("video"), (v) => ({ src: v.getAttribute("src"), width: v.videoWidth, height: v.videoHeight, duration: v.duration, error: v.error?.code ?? null })),
  }));
  await writeFile(info.outputPath(`wp07-${name}-render.json`), JSON.stringify(rendered, null, 2));
}
async function assertNativeError(page: Page) {
  const observed = await page.evaluate(() => window.__wp07Native);
  expect(observed.some((event) => event.kind === "error" && event.data)).toBe(true);
  expect(observed.filter((event) => event.kind === "close" && event.closeFrom === "application")).toEqual([]);
}
async function finish(page: Page, scenario: Scenario, info: TestInfo, name: string, capture: J6Capture) {
  const observed = page.isClosed() ? [] : await page.evaluate(() => window.__wp07Native ?? []);
  const cleanup = { pagesClosed: false, streamClosed: false };
  try { for (const owned of page.context().pages()) await owned.close(); cleanup.pagesClosed = true; }
  finally {
    try { await scenario.stream.close(); cleanup.streamClosed = true; }
    finally { await writeFile(info.outputPath(`wp07-${name}.json`), JSON.stringify({ sequence: scenario.sequence,
      acceptance: scenario.acceptance, native: observed, connections: scenario.stream.connections,
      violations: scenario.stream.violations, requests: capture.requests, graphSaves: scenario.graphSaves,
      unexpected: capture.unexpected, errors: scenario.errors, cleanup }, null, 2)); }
  }
  expect(scenario.stream.violations).toEqual([]);
  expect(scenario.errors).toEqual([]);
  expect(scenario.stream.connections.every((connection) => connection.closed)).toBe(true);
}

test.beforeEach(async ({}, info) => { await preflightJ6(info); });
for (const [locale, warning] of Object.entries(warnings)) {
  test(`live native tracking warning and inline AssetGen ${locale}`, async ({ browser }, info) => {
    await withJ6(browser, info, { provider: "api", expectedSubmissions: 1 }, async (page, capture, origin) => {
      const scenario = await installScenario(page, capture, origin);
      try {
        await seedOnce(page, { "ima2.locale": locale }); await open(page, origin, scenario, "#asset-gen");
        await page.locator("#assetgen-prompt").fill("Owned synthetic asset");
        await page.locator(".assetgen-generate").click();
        await expect(page.locator(".assetgen-error[role=alert] .assetgen-error__text > span").first()).toHaveText(warning);
        await expect(page.locator(".toast")).toContainText(warning);
        await expect(page.locator("body")).not.toContainText(poison);
        await expect(page.locator(".assetgen-tile")).toHaveCount(0);
        await assertNativeError(page); await screenshot(page, info, `asset-${locale}`);
        expect(capture.requests).toHaveLength(1);
      } finally { await finish(page, scenario, info, `asset-${locale}`, capture); }
    });
  });
  test(`aged reload tracking warning once ${locale}`, async ({ browser }, info) => {
    await withJ6(browser, info, { expectedSubmissions: 0 }, async (page, capture, origin) => {
      const scenario = await installScenario(page, capture, origin);
      try {
        const aged = { id: "wp07-aged", prompt: "owned", startedAt: Date.now() - 300_000 };
        scenario.terminal = [{ requestId: aged.id, kind: "classic", status: "error", startedAt: aged.startedAt,
          finishedAt: Date.now(), durationMs: 300_000, phase: "queued", phaseAt: aged.startedAt,
          errorCode: "JOB_TRACKING_TIMEOUT", httpStatus: 504, meta: { message: poison } }];
        await seedOnce(page, { "ima2.locale": locale, "ima2.inFlight": JSON.stringify([aged]) });
        await open(page, origin, scenario);
        await expect(page.locator(".toast")).toContainText(warning);
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ima2.inFlight") ?? "[]"))).toEqual([]);
        await screenshot(page, info, `reload-${locale}`);
        await page.reload(); await scenario.stream.ready();
        await expect.poll(() => page.evaluate(() => window.__wp07Native.filter((event) => event.kind === "open").length)).toBeGreaterThan(0);
        await expect(page.locator(".composer__textarea:visible")).toBeVisible();
        await expect(page.locator(".toast")).toHaveCount(0);
        expect(capture.requests).toHaveLength(0);
      } finally { await finish(page, scenario, info, `reload-${locale}`, capture); }
    });
  });
}

test("video node tracking failure has no Retry", async ({ browser }, info) => {
  await withJ6(browser, info, { provider: "grok", videoModel: "grok-imagine-video-1.5", expectedSubmissions: 1 }, async (page, capture, origin) => {
    const scenario = await installScenario(page, capture, origin);
    scenario.session.nodes = [{ id: "wp07-node", x: 0, y: 0, data: { prompt: "Owned synthetic video", status: "empty", imageUrl: null } }];
    try {
      await open(page, origin, scenario, "#node");
      await page.locator(".image-node__generate").click();
      await expect(page.locator(".image-node__status")).toContainText(warnings.en);
      await expect(page.locator(".image-node__retry")).toHaveCount(0);
      await expect(page.locator(".image-node__status")).toHaveAttribute("title", /JOB_TRACKING_TIMEOUT/);
      await assertNativeError(page); await screenshot(page, info, "video-node");
    } finally { await finish(page, scenario, info, "video-node", capture); }
  });
});

async function playable(page: Page) {
  const video = page.locator("video:visible").first();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, error: v.error?.code ?? null })))
    .toEqual({ width: 64, height: 64, duration: 0.5, error: null });
}

test("extension tracking disables same-source Retry and preserves pending source serialization", async ({ browser }, info) => {
  await withJ6(browser, info, { expectedSubmissions: 3 }, async (page, capture, origin) => {
    const scenario = await installScenario(page, capture, origin);
    scenario.history = [historyItem(trackingVideoFilename), historyItem("wp07-other.mp4")];
    try {
      await seedOnce(page, { "ima2.selectedFilename": trackingVideoFilename }); await open(page, origin, scenario);
      await playable(page);
      const button = page.locator(".result-actions").getByRole("button", { name: "Extend video", exact: true });
      await button.click(); await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("title", warnings.en);
      await expect(page.locator(".result-actions").getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
      await expect(page.locator(".toast")).not.toContainText("Video ready");
      await assertNativeError(page); await screenshot(page, info, "extension-tracking");
      await page.locator(".history-thumb--video").nth(1).click(); await expect(button).toBeEnabled();
      expect(capture.requests).toHaveLength(1); scenario.outcome = "ordinary";
      await button.click();
      const retry = page.locator(".result-actions").getByRole("button", { name: "Retry", exact: true });
      await expect(retry).toBeEnabled(); await screenshot(page, info, "extension-ordinary");
      scenario.outcome = "held"; await retry.click();
      await expect.poll(() => capture.requests.length).toBe(3);
      await page.locator(".history-thumb--video").nth(0).click();
      await expect(page.locator(".result-actions button[aria-busy=true]")).toBeDisabled();
      scenario.stream.emit("error", terminalFrame(scenario.pending[2], "tracking"), 3);
      await expect(button).toBeEnabled(); expect(capture.requests).toHaveLength(3);
      await screenshot(page, info, "extension-source-change");
    } finally { await finish(page, scenario, info, "extension", capture); }
  });
});

for (const outcome of ["tracking", "ordinary", "cancel", "success"] as const) {
  test(`animation rendered outcome ${outcome}`, async ({ browser }, info) => {
    await withJ6(browser, info, { expectedSubmissions: 1 }, async (page, capture, origin) => {
      const scenario = await installScenario(page, capture, origin);
      scenario.history = [historyItem("wp07-anchor.png", "image")]; scenario.outcome = outcome;
      try {
        await seedOnce(page, { "ima2.selectedFilename": "wp07-anchor.png" }); await open(page, origin, scenario);
        const animate = page.locator(".result-actions").getByRole("button", { name: "Animate", exact: true });
        await animate.click(); await expect.poll(() => capture.requests.length).toBe(1);
        if (outcome === "success") {
          await expect(page.locator(".toast")).toContainText("Video ready. Check your history."); await playable(page);
        } else {
          await expect(animate).toBeEnabled();
          await expect(page.locator(".toast")).not.toContainText("Video ready");
          if (outcome === "tracking") await expect(page.locator(".toast")).toContainText(warnings.en);
          if (outcome === "ordinary") await expect(page.locator(".toast")).toContainText("Ordinary fixture failure");
          if (outcome === "cancel") await expect(page.locator(".toast")).toHaveCount(0);
        }
        await screenshot(page, info, `animation-${outcome}`);
      } finally { await finish(page, scenario, info, `animation-${outcome}`, capture); }
    });
  });
}
