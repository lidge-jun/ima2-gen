import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

type Runtime = typeof import("../ui/src/lib/api-comfy") & typeof import("../ui/src/lib/laneCatalog")
  & typeof import("../ui/src/lib/comfyDisplay");
type Request = { url: string; signal?: AbortSignal; resolve(response: Response): void; reject(error: unknown): void };
let compiled: Promise<string> | undefined;
let sequence = 0;
async function load(): Promise<Runtime> {
  try {
    compiled ??= build({ stdin: { resolveDir: fileURLToPath(new URL("../", import.meta.url)),
      contents: ["api-comfy", "laneCatalog", "comfyDisplay"].map((name) => `export * from './ui/src/lib/${name}.ts';`).join("\n") },
      bundle: true, write: false, platform: "browser", format: "esm", logLevel: "silent" })
      .then((result) => result.outputFiles[0].text);
    return await import(`data:text/javascript;base64,${Buffer.from(await compiled).toString("base64")}#lane-${sequence++}`);
  } catch (error) { throw new Error(`Catalog fixture import: ${error instanceof Error ? error.message : String(error)}`); }
}

export function catalogBody(id = "cedar") {
  return { ok: true, lanes: { comfy: { status: "ready", models: { image: [{ id, label: id }], video: [] } } } };
}

export async function withLaneCatalog(run: (fixture: {
  api: Runtime; requests: Request[]; focus: Set<EventListenerOrEventListenerObject>;
  subscribe(listener?: () => void): () => void; flush(): Promise<void>;
  respond(index: number, body?: unknown, status?: number): void;
}) => Promise<void>): Promise<void> {
  const originals = new Map(["fetch", "window", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const requests: Request[] = [], focus = new Set<EventListenerOrEventListenerObject>(), disposers: Array<() => void> = [];
  const violations: string[] = [];
  const windowValue = { addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
    assert.equal(name, "focus"); focus.add(listener);
  }, removeEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
    assert.equal(name, "focus"); focus.delete(listener);
  } };
  const fakeFetch = (url: string, init: RequestInit = {}) => {
    if (url !== "/api/models" || (init.method ?? "GET") !== "GET") {
      violations.push("unexpected fetch"); return Promise.reject(new Error("Fixture denied request"));
    }
    return new Promise<Response>((resolve, reject) => requests.push({ url, signal: init.signal ?? undefined, resolve, reject }));
  };
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: fakeFetch });
  Object.defineProperty(globalThis, "window", { configurable: true, get() { throw new Error("Import accessed window"); } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Catalog accessed storage"); } });
  try {
    const api = await load(); assert.equal(requests.length, 0);
    Object.defineProperty(globalThis, "window", { configurable: true, value: windowValue });
    await run({ api, requests, focus, flush,
      subscribe(listener = () => {}) { const close = api.subscribeLaneCatalog(listener); disposers.push(close); return close; },
      respond(index, body = catalogBody(), status = 200) { requests[index].resolve(new Response(JSON.stringify(body), { status })); } });
    assert.deepEqual(violations, []);
  } finally {
    disposers.reverse().forEach((close) => close());
    requests.forEach((request) => request.reject(new Error("Synthetic teardown")));
    await flush();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    assert.equal(focus.size, 0, "focus listeners must be removed");
  }
}
