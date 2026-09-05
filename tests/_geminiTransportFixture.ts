import assert from "node:assert/strict";
import { mock } from "node:test";
import type { RuntimeContext } from "../lib/runtimeContext.ts";
import type { generateViaGeminiApi } from "../lib/geminiApiImageAdapter.ts";
import { isolateExecution } from "./_executionRouteIsolation.ts";
import { openRouteHarness, type UpstreamCall } from "./_executionRouteHarness.ts";
import { bounded } from "./_executionTrackedWrites.ts";

export const PUBLIC_KEY = "gemini-public-fixture-only";
export const VERTEX_TOKEN = "vertex-token-fixture-only";
export const PROJECT = "vertex-project-fixture";
export const FINAL_B64 = Buffer.from("native-final-fixture").toString("base64");
export const publicUrl = (model = "gemini-3.1-flash-image") =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
export const vertexUrl = (model = "gemini-3.1-flash-image") =>
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;

export function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

export function success(b64 = FINAL_B64) {
  return Response.json({ candidates: [{ content: { parts: [
    { text: "fixture revised" }, { inlineData: { data: b64, mimeType: "image/png" } },
  ] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 11, totalTokenCount: 18 } });
}

export function assertWire(call: UpstreamCall, url = publicUrl(), key = PUBLIC_KEY) {
  assert.equal(call.url, url);
  assert.equal(call.method, "POST");
  assert.equal(call.headers.get("content-type"), "application/json");
  const vertex = url === vertexUrl() || url.startsWith(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/`);
  assert.equal(call.headers.get("authorization"), vertex ? `Bearer ${VERTEX_TOKEN}` : null);
  assert.equal(call.headers.get("x-goog-api-key"), vertex ? null : key);
  assert.equal(call.headers.get("cookie"), null);
  assert.ok(call.signal);
  assert.ok(!call.url.includes(key) && !call.url.includes(VERTEX_TOKEN));
}

/** No real auth module is imported, spread, initialized, or constructed. */
function mockVertex(graph: "source" | "emitted", install: typeof mock.module = (url, options) => mock.module(url, options)) {
  const state = { ready: false, initCalls: 0, tokenCalls: 0, projectCalls: 0,
    token: (): Promise<string> => Promise.resolve(VERTEX_TOKEN) };
  const violations: string[] = [];
  const forbidden = () => { violations.push("unexpected auth entry point"); throw new Error(violations.at(-1)); };
  assert.equal(typeof mock.module, "function", "Vertex case requires --experimental-test-module-mocks; never skip");
  const auth = install(new URL(`../lib/vertexAuth.${graph === "source" ? "ts" : "js"}`, import.meta.url).href, {
    namedExports: {
      isVertexInitialized: () => { state.initCalls++; return state.ready; },
      getVertexAccessToken: () => { state.tokenCalls++; return state.token(); },
      getVertexProjectId: () => { state.projectCalls++; return PROJECT; },
      initVertexAuth: forbidden, clearVertexAuth: forbidden,
    },
  });
  return { state, close() { auth.restore(); assert.deepEqual(violations, []); } };
}

/** Route registrations and storage stay real, with the existing strict guards. */
export async function openGeminiRoutes() {
  const auth = mockVertex("source");
  try {
    const harness = await openRouteHarness();
    return { run: harness.run, vertex: auth.state, async close() {
      // Retain the mock if the harness cannot drain pending work.
      await harness.close(); auth.close();
    } };
  } catch (error) { auth.close(); throw error; }
}

type Loader = (url: string) => Promise<Record<string, unknown>>;
type NativeOptions = Parameters<typeof generateViaGeminiApi>[2];

/** Emitted callers supply import() from a plain-JS child, outside TSX's TS resolver. */
export async function openGeminiFixture(graph: "source" | "emitted" = "source", load: Loader = (url) => import(url), install?: typeof mock.module) {
  const isolation = await isolateExecution();
  let auth: ReturnType<typeof mockVertex> | undefined;
  try {
    auth = mockVertex(graph, install);
    const extension = graph === "source" ? "ts" : "js";
    const moduleAt = (name: string) => load(new URL(`../${name}.${extension}`, import.meta.url).href);
    const runtime = await moduleAt("lib/runtimeContext");
    const createContext = runtime.createTestRuntimeContext as typeof import("../lib/runtimeContext.ts").createTestRuntimeContext;
    const { config } = await moduleAt("config");
    const logger = await moduleAt("lib/logger");
    (logger.configureLogger as typeof import("../lib/logger.ts").configureLogger)({ level: "silent" });
    const ctx = createContext({ rootDir: isolation.rootDir, geminiApiKey: PUBLIC_KEY,
      config: config as RuntimeContext["config"] });
    const owner = await moduleAt("lib/providers/adapters/geminiOperations");
    const facade = await moduleAt("lib/geminiApiImageAdapter");
    const generate = owner.generateViaGeminiApi as typeof generateViaGeminiApi;
    assert.equal(facade.generateViaGeminiApi, generate, `${graph} facade identity`);
    return nativeFixture({ isolation, auth, ctx, generate });
  } catch (error) {
    try { auth?.close(); } finally { await isolation.close(); }
    throw error;
  }
}

function nativeFixture(deps: { isolation: Awaited<ReturnType<typeof isolateExecution>>;
  auth: ReturnType<typeof mockVertex>; ctx: RuntimeContext; generate: typeof generateViaGeminiApi }) {
  const { isolation, auth, ctx, generate } = deps;
  const calls: UpstreamCall[] = [], violations: unknown[] = [];
  const pending = new Set<Promise<unknown>>(), controllers = new Set<AbortController>();
  const releases = new Set<() => void>();
  let expectedUrl = publicUrl(), expectedKey = PUBLIC_KEY;
  let response: (call: UpstreamCall) => Response | Promise<Response> = () => success();
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const call = { url: request.url, method: request.method, headers: request.headers,
      body: await request.text(), signal: init?.signal ?? undefined };
    calls.push(call);
    try { assertWire(call, expectedUrl, expectedKey); }
    catch (error) { violations.push(error); throw error; }
    // Only the explicitly installed synthetic responder may reject as a transport fixture.
    return response(call);
  };
  function run(prompt = "native fixture", options: NativeOptions = {}) {
    const controller = new AbortController(); controllers.add(controller);
    const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    const work = generate(prompt, ctx, { ...options, signal }); pending.add(work);
    void work.then(() => { pending.delete(work); controllers.delete(controller); },
      () => { pending.delete(work); controllers.delete(controller); });
    return work;
  }
  return { ctx, calls, vertex: auth.state, run,
    respond(fn: typeof response, url = publicUrl(), key = PUBLIC_KEY) { response = fn; expectedUrl = url; expectedKey = key; },
    hold() { const held = gate(); releases.add(held.release); return held; },
    async close() {
      for (const controller of controllers) controller.abort();
      for (const release of releases) release();
      await bounded(Promise.allSettled([...pending]));
      // No traps/auth/config are restored before native work is settled.
      try { assert.deepEqual(violations, []); }
      finally { try { auth.close(); } finally { await isolation.close(); } }
    },
  };
}
