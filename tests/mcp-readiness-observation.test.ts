import assert from "node:assert/strict";
import test from "node:test";
import { jsonGetObservation } from "../ui/src/lib/api-core";
import { listMcpProviders, readMcpProviderObservation, readMcpModelObservation, getCachedMcpProviders } from "../ui/src/lib/mcpProviders";

function response(status: number, body: unknown | (() => Promise<unknown>), cancel = async () => {}): Response {
  return { ok: status >= 200 && status < 300, status, body: { cancel }, json: () => typeof body === "function" ? body() : Promise.resolve(body) } as unknown as Response;
}

test("observation is GET-only and returns the raw envelope", async () => {
  const original = globalThis.fetch;
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url, init) => { calls.push(init ?? {}); return response(200, { ok: true, providers: [], extra: { retained: true } }); }) as typeof fetch;
  try { assert.deepEqual(await readMcpProviderObservation(), { ok: true, providers: [], extra: { retained: true } }); assert.equal(calls[0].method, "GET"); } finally { globalThis.fetch = original; }
});

test("after-headers body abort propagates and does not replace a primed cache", async () => {
  const original = globalThis.fetch;
  const primed = [{ id: "runway", endpoint: "x", enabled: true, status: { provider: "runway", state: "connected" } }];
  let call = 0;
  let reading!: () => void;
  const bodyStarted = new Promise<void>((resolve) => { reading = resolve; });
  globalThis.fetch = (async (_url, init) => {
    call += 1;
    if (call === 1) return response(200, { ok: true, providers: primed });
    return response(200, () => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      reading();
    }));
  }) as typeof fetch;
  try {
    await listMcpProviders();
    const before = getCachedMcpProviders();
    const controller = new AbortController();
    const pending = readMcpProviderObservation(controller.signal);
    await bodyStarted;
    controller.abort();
    await assert.rejects(pending);
    assert.strictEqual(getCachedMcpProviders(), before);
    assert.deepEqual(getCachedMcpProviders(), primed);
  } finally { globalThis.fetch = original; }
});

test("HTTP errors retain status and body/parser errors are not catch-to-empty", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url) => url.toString().includes("models") ? response(503, { error: "down" }) : response(200, async () => { throw new SyntaxError("bad json"); })) as typeof fetch;
  try {
    await assert.rejects(readMcpModelObservation("runway"), (error: unknown) => (error as { status?: number }).status === 503);
    await assert.rejects(jsonGetObservation("/api/mcp/providers"), SyntaxError);
  } finally { globalThis.fetch = original; }
});

test("observation wrappers never write the legacy provider cache", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => response(200, { ok: true, models: { image: [], video: [] } })) as typeof fetch;
  try { const before = getCachedMcpProviders(); await readMcpModelObservation("runway"); assert.strictEqual(getCachedMcpProviders(), before); } finally { globalThis.fetch = original; }
});
