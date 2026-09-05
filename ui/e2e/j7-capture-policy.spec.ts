import { test, expect, type BrowserContext, type Route } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installJ6SelectionCapture, j6EvidenceIdentity, preflightJ6, type J6Capture } from "./fixtures/j6Selection";

test.beforeAll(async ({}, info) => { await preflightJ6(info, "wp08-policy"); });

const ORIGIN = "http://127.0.0.1:49152"; // Synthetic route identity only; nothing listens here.
const ATTEMPTS = [
  { path: "/api/generate", body: JSON.stringify({ async: true, requestId: "wp08-image", prompt: "fixture" }) },
  { path: "/api/video/generate", body: JSON.stringify({ async: true, requestId: "wp08-video", prompt: "fixture" }) },
  { path: "/api/generate", body: "{malformed-json" },
];

async function installOuterRoute(context: BrowserContext, unexpected: string[]) {
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    try {
      if (request.method() === "GET" && request.url() === `${ORIGIN}/`) {
        await route.fulfill({ contentType: "text/html", body: "<!doctype html><html><head></head><body></body></html>" });
      } else if (request.method() === "POST" && ATTEMPTS.some(({ path }) => request.url() === `${ORIGIN}${path}`)) {
        await route.fallback(); // ONLY these exact POST paths can reach the installed J6 capture.
      } else {
        unexpected.push(`${request.method()} unexpected-outer-route`);
        await route.abort("blockedbyclient");
      }
    } catch (error) {
      unexpected.push("outer-route-failed");
      await route.abort("failed").catch(() => {});
      throw error;
    }
  });
  await context.routeWebSocket(/.*/, async (socket) => {
    unexpected.push("unexpected-websocket");
    await socket.close();
  });
}

test("WP08 capture rejects image, video and malformed generation before parsing or admission", async ({ browser }, info) => {
  await preflightJ6(info, "wp08-policy");
  const context = await browser.newContext({ serviceWorkers: "block" });
  let capture: J6Capture | undefined;
  const unexpected: string[] = [];
  const outcomes: Array<{ path: string; status: number | null; rejected: boolean }> = [];
  const networkOutcomes: Array<{ path: string; outcome: string }> = [];
  const teardown = { pagesClosed: false, contextClosed: false, appStarted: false };
  try {
    capture = await installJ6SelectionCapture(context, ORIGIN, { nonGenerating: true });
    await installOuterRoute(context, unexpected); // Registered LAST: outer layer runs first.
    context.on("requestfailed", (request) => networkOutcomes.push({ path: new URL(request.url()).pathname, outcome: "failed" }));
    context.on("response", (response) => networkOutcomes.push({ path: new URL(response.url()).pathname, outcome: String(response.status()) }));
    const page = await context.newPage();
    await page.goto(ORIGIN);
    for (const attempt of ATTEMPTS) {
      outcomes.push(await page.evaluate(async ({ path, body }) => {
        try {
          const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
          return { path, status: response.status, rejected: false };
        } catch { return { path, status: null, rejected: true }; }
      }, attempt));
    }
  } finally {
    try { for (const page of context.pages()) await page.close(); teardown.pagesClosed = true; }
    finally {
      await context.close(); teardown.contextClosed = true;
      await writeFile(info.outputPath("wp08-policy.json"), JSON.stringify({ ...j6EvidenceIdentity(), origin: ORIGIN,
        intendedDeniedGeneration: capture?.deniedGeneration ?? [], acceptedRequests: capture?.requests ?? [],
        unexpected: [...unexpected, ...(capture?.unexpected ?? [])], continued: capture?.continued ?? [],
        outcomes, networkOutcomes, teardown, isolationBoundary: "browser routing; no app/server child; no OS sandbox" }, null, 2));
    }
  }
  expect(outcomes).toEqual(ATTEMPTS.map(({ path }) => ({ path, status: null, rejected: true })));
  expect(capture?.deniedGeneration).toEqual(ATTEMPTS.map(({ path }) => ({ method: "POST", path })));
  expect(capture?.requests).toEqual([]);
  expect([...(capture?.unexpected ?? []), ...unexpected]).toEqual([]);
  expect(capture?.continued).toEqual([]);
  expect(networkOutcomes.filter(({ outcome }) => outcome !== "failed")).toEqual([{ path: "/", outcome: "200" }]);
  expect(networkOutcomes.filter(({ outcome }) => outcome === "failed")).toHaveLength(3);
  expect(teardown).toEqual({ pagesClosed: true, contextClosed: true, appStarted: false });
});
