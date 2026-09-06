import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";

export type JobTrackingUiRuntime = typeof import("../ui/src/store/useAppStore.ts")
  & typeof import("../ui/src/store/storeInflightImpl.ts")
  & typeof import("../ui/src/store/storeHelpers.ts")
  & typeof import("../ui/src/store/storeVideoImpl.ts")
  & typeof import("../ui/src/store/storeSettingsImpl.ts")
  & typeof import("../ui/src/store/storeAssetGenImpl.ts")
  & typeof import("../ui/src/store/storeSpriteRecipeImpl.ts")
  & typeof import("../ui/src/store/storeGraphSave.ts")
  & typeof import("../ui/src/lib/mcpProviders.ts")
  & typeof import("../ui/src/lib/errorCodes.ts")
  & typeof import("../ui/src/lib/errorHandler.ts")
  & typeof import("../ui/src/lib/sseStreamError.ts")
  & typeof import("../ui/src/lib/nodeErrorInfo.ts")
  & typeof import("../ui/src/lib/videoExtendStream.ts")
  & typeof import("../ui/src/lib/eventChannel.ts");

export interface UiRequest {
  url: string; method: string; body: unknown; headers: Headers;
  signal: AbortSignal | null;
}
export interface UiDeferred<T> {
  promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void;
}
type Timer = { kind: "interval" | "timeout"; delay: number; callback: () => void | Promise<void> };
export interface JobTrackingUiFixture {
  runtime: JobTrackingUiRuntime;
  requests: UiRequest[];
  storage: MapStorage;
  timers: Map<number, Timer>;
  ledger: { violations: string[]; events: string[]; canceledTimers: number; disposedListeners: number };
  route(method: string, pathname: string, handler: (request: UiRequest) => Response | Promise<Response>): void;
  openStream(): void;
  emit(event: string, data: Record<string, unknown>, lastEventId?: string): void;
  transportError(): void;
  runTimer(id: number): Promise<void>;
  setNow(value: number): void;
  defer<T>(): UiDeferred<T>;
  track<T>(work: Promise<T>): Promise<T>;
}

class MapStorage implements Storage {
  readonly values = new Map<string, string>([["ima2.browserId", "wp07-fixture"]]);
  readonly writes: Array<[string, string]> = [];
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push([key, value]); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  seed(key: string, value: unknown) { this.values.set(key, JSON.stringify(value)); }
}

let bundle: Promise<string> | undefined;
let instance = 0;
export async function loadJobTrackingUiRuntime(): Promise<JobTrackingUiRuntime> {
  try {
    bundle ??= compileRuntime();
    const source = await bundle;
    return await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#wp07-${instance++}`);
  } catch (error) {
    throw new Error(`WP07 runtime: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function compileRuntime(): Promise<string> {
  try {
    const modules = [
      "store/useAppStore", "store/storeInflightImpl", "store/storeHelpers",
      "store/storeVideoImpl", "store/storeSettingsImpl", "store/storeAssetGenImpl",
      "store/storeSpriteRecipeImpl", "store/storeGraphSave", "lib/mcpProviders",
      "lib/errorCodes", "lib/errorHandler", "lib/sseStreamError", "lib/nodeErrorInfo", "lib/eventChannel",
      "lib/videoExtendStream",
    ];
    const result = await build({
      stdin: { resolveDir: fileURLToPath(new URL("../", import.meta.url)),
        contents: modules.map((name) => `export * from './ui/src/${name}.ts';`).join("\n") },
      bundle: true, write: false, platform: "browser", format: "esm", logLevel: "silent",
      define: { "import.meta.env": '{"DEV":false,"PROD":true,"MODE":"production","BASE_URL":"/"}',
        "process.env.NODE_ENV": '"production"' },
    });
    return result.outputFiles[0].text;
  } finally { stop(); }
}

function createControls() {
  const storage = new MapStorage();
  const requests: UiRequest[] = [];
  const timers = new Map<number, Timer>();
  const ledger = { violations: [] as string[], events: [] as string[], canceledTimers: 0, disposedListeners: 0 };
  const routes = new Map<string, (request: UiRequest) => Response | Promise<Response>>();
  const pending = new Set<Promise<unknown>>();
  const releases = new Set<() => void>();
  let now = 1_000_000, nextTimer = 0;
  function deny(message: string): never { ledger.violations.push(message); throw new Error(message); }
  function track<T>(work: Promise<T>): Promise<T> {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  }
  function defer<T>(): UiDeferred<T> {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    const release = () => reject(new Error("WP07 fixture teardown"));
    releases.add(release);
    void promise.then(() => releases.delete(release), () => releases.delete(release));
    return { promise, resolve, reject };
  }
  function schedule(kind: Timer["kind"], callback: Timer["callback"], delay = 0): number {
    const id = ++nextTimer;
    timers.set(id, { kind, delay, callback }); ledger.events.push(`timer:add:${kind}:${id}:${delay}`);
    return id;
  }
  function cancel(id: number) { timers.delete(id); ledger.events.push(`timer:remove:${id}`); }
  async function runTimer(id: number): Promise<void> {
    try {
      const timer = timers.get(id);
      if (!timer) return deny(`Unknown timer ${id}`);
      if (timer.kind === "timeout") timers.delete(id);
      await track(Promise.resolve(timer.callback()));
    } catch (error) { throw error; }
  }
  return { storage, requests, timers, ledger, routes, pending, releases, deny, track, defer,
    schedule, cancel, runTimer, setNow: (value: number) => { now = value; }, now: () => now };
}
type Controls = ReturnType<typeof createControls>;

function controlledFetch(c: Controls): typeof fetch {
  return async (input, init) => {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://wp07.invalid");
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const request: UiRequest = { url: url.href, method, body: null,
        headers: new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)),
        signal: init?.signal ?? (input instanceof Request ? input.signal : null) };
      c.requests.push(request);
      const handler = c.routes.get(`${method} ${url.pathname}`);
      if (url.origin !== "http://wp07.invalid" || !handler) c.deny(`Denied ${method} ${url.href}`);
      const rawBody = init?.body ?? (input instanceof Request ? await input.clone().text() : null);
      request.body = typeof rawBody === "string" && rawBody ? JSON.parse(rawBody) : rawBody;
      return await c.track(Promise.resolve(handler!(request)));
    } catch (error) { throw error; }
  };
}

function streamControls(c: Controls) {
  const sources: ControlledSource[] = [];
  class ControlledSource {
    static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
    readyState = 0;
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    constructor(readonly url: string) {
      const parsed = new URL(url, "http://wp07.invalid");
      if (parsed.origin !== "http://wp07.invalid" || parsed.pathname !== "/api/events") c.deny(`Denied EventSource ${url}`);
      sources.push(this); c.ledger.events.push(`stream:create:${url}`);
    }
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener); this.listeners.set(type, listeners); c.ledger.events.push(`listener:add:${type}`);
    }
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.get(type)?.delete(listener); c.ledger.events.push(`listener:remove:${type}`);
    }
    close() { this.readyState = 2; c.ledger.events.push("stream:close"); }
    dispatch(event: Event) {
      for (const listener of this.listeners.get(event.type) ?? []) {
        if (typeof listener === "function") listener(event); else listener.handleEvent(event);
      }
      if (event.type === "error") this.onerror?.(event);
    }
  }
  const current = () => sources.filter((source) => source.readyState !== 2).at(-1);
  return { ControlledSource, sources,
    openStream() {
      const source = current() ?? c.deny("No EventSource to open");
      source.readyState = 1; source.onopen?.(new Event("open")); c.ledger.events.push("stream:open");
    },
    emit(event: string, data: Record<string, unknown>, lastEventId = "") {
      const source = current() ?? c.deny("No EventSource for data");
      source.dispatch(new MessageEvent(event, { data: JSON.stringify(data), lastEventId }));
    },
    transportError() { (current() ?? c.deny("No EventSource for transport error")).dispatch(new Event("error")); },
  };
}

function installGlobals(c: Controls, streams: ReturnType<typeof streamControls>): () => void {
  const timerGlobals = {
    setTimeout: (cb: Timer["callback"], ms?: number) => c.schedule("timeout", cb, ms),
    setInterval: (cb: Timer["callback"], ms?: number) => c.schedule("interval", cb, ms),
    clearTimeout: c.cancel, clearInterval: c.cancel,
  };
  class DeniedTransport { constructor() { c.deny("Unassigned browser transport"); } }
  const globals = { ...timerGlobals, localStorage: c.storage, sessionStorage: new MapStorage(),
    fetch: controlledFetch(c), EventSource: streams.ControlledSource,
    WebSocket: DeniedTransport, XMLHttpRequest: DeniedTransport,
    window: Object.assign(new EventTarget(), timerGlobals, { location: new URL("http://wp07.invalid") }) };
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const originalNow = Date.now;
  Date.now = c.now;
  return () => {
    Date.now = originalNow;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  };
}

async function teardown(c: Controls, streams: ReturnType<typeof streamControls>, runtime?: JobTrackingUiRuntime) {
  try {
    for (const release of c.releases) release();
    if (c.pending.size) {
      c.setNow(c.now() + (runtime?.JOB_STREAM_TIMEOUT_MS ?? 10_000));
      for (const [id, timer] of [...c.timers]) {
        if (timer.kind === "timeout" && timer.delay === 50) await c.runTimer(id);
      }
    }
    // Watcher deadlines settle abandoned public promises before globals are restored.
    for (const [id, timer] of [...c.timers]) {
      if (timer.kind === "timeout" && timer.delay === runtime?.JOB_STREAM_TIMEOUT_MS) await c.runTimer(id);
    }
    runtime?.disconnect();
    for (let turns = 0; c.pending.size && turns < 100; turns++) await Promise.resolve();
    assert.equal(c.pending.size, 0, "all tracked work must settle before restoring globals");
    assert.ok(streams.sources.every((source) => source.readyState === 2), "all streams closed");
    for (const source of streams.sources) {
      c.ledger.disposedListeners += [...source.listeners.values()].reduce((n, listeners) => n + listeners.size, 0);
      source.listeners.clear(); source.onopen = null; source.onerror = null;
    }
    c.ledger.canceledTimers = c.timers.size;
    c.timers.clear();
    assert.deepEqual(c.ledger.violations, [], "unexpected operations survive product catches");
  } finally {
    console.log(JSON.stringify({ fixture: "wp07-ui", requests: c.requests.map(({ method, url }) => ({ method, url })),
      ...c.ledger, pending: c.pending.size, listeners: streams.sources.reduce((n, s) => n + s.listeners.size, 0) }));
  }
}

export async function withJobTrackingUi<T>(run: (fixture: JobTrackingUiFixture) => Promise<T>): Promise<T> {
  const c = createControls(), streams = streamControls(c);
  const restore = installGlobals(c, streams);
  let runtime: JobTrackingUiRuntime | undefined;
  try {
    runtime = await loadJobTrackingUiRuntime();
    return await run({ ...c, ...streams, runtime,
      route: (method, pathname, handler) => { c.routes.set(`${method.toUpperCase()} ${pathname}`, handler); } });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  } finally {
    try { await teardown(c, streams, runtime); } finally { restore(); }
  }
}
