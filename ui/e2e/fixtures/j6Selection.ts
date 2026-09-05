import { expect, type Browser, type BrowserContext, type Page, type Route, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { assertJ6Isolation, startApp } from "./appServer";
import type { ComfyLaneModels, LaneCatalog } from "../../src/lib/api-comfy";

export const MODEL_TRIGGER = "#sidebar-generation-model:visible";
export const PROVIDER_TRIGGER = "#sidebar-generation-provider:visible";
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
  dispose(): Promise<void>;
};
export type J6Seed = {
  provider?: string; imageModel?: string; videoModel?: string | false;
  generationDefaults?: Record<string, unknown>;
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
  const session = { id: "wp02-session", title: "Selection fixture", createdAt: 1, updatedAt: 1,
    graphVersion: 0, nodeCount: 0, nodes: [], edges: [] };
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
    capture.unexpected.push(`${method} unexpected-mutation`);
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
  // The entire context contains only synthetic fixtures; no signed-in data is loaded.
  await page.screenshot({ path: info.outputPath(`wp02-${name}.png`) });
}

export async function preflightJ6(info: TestInfo): Promise<void> {
  try {
    const isolation = assertJ6Isolation();
    await writeFile(info.outputPath("wp02-preflight.json"), JSON.stringify({ passed: true, isolation }));
  } catch (error) {
    await writeFile(info.outputPath("wp02-preflight.json"), JSON.stringify({ passed: false,
      reason: error instanceof Error ? error.message : "Isolation preflight failed" }));
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
          requests, unexpected: capture?.unexpected ?? [], stubCalls: app.stub.calls.length,
          teardown, completionClaimed: false }, null, 2));
      }
    }
    expect(capture?.unexpected ?? []).toEqual([]);
    expect(app.stub.calls).toEqual([]);
    expect(teardown).toEqual({ contextClosed: true, childExitedAndStubClosed: true });
  }
}
