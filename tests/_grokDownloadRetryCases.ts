import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { grokFetchWithRetry, type RetryResponse } from "../lib/grokUpstreamRetry.js";
import {
  PUBLIC_IMAGE, IMAGE_BYTES, deferred, downloadError, eventTurn, fakeClock,
  observeProcessErrors, assertNoCallerListeners, type Download, type DownloadNetwork,
} from "./_grokDownloadPolicyCases.ts";

interface SourceResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: AsyncIterable<Uint8Array> | null;
  cancel(): unknown;
}
interface AdapterUnit {
  toRetryResponse(source: SourceResponse): RetryResponse & { source: SourceResponse };
  cancelPinnedImageResponse(source: SourceResponse): Promise<void>;
}
type BodyUnit = (source: SourceResponse, options: { maxBytes: number; signal: AbortSignal }) => Promise<Buffer>;

/** Advisory source-unit proof only. No production export, injection flag or rewritten body. */
function extractSourceUnit(names: string[], globals: Record<string, unknown>): unknown {
  const url = new URL("../lib/grokImageDownload.ts", import.meta.url);
  const source = readFileSync(url, "utf8");
  const tree = ts.createSourceFile(url.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = names.map((name) => {
    const matches = tree.statements.filter((node) =>
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === name);
    assert.equal(matches.length, 1, `exactly one actual source declaration: ${name}`);
    const node = matches[0];
    const text = source.slice(node.getStart(tree), node.end);
    assert.equal(text, node.getText(tree), `unchanged ${name} declaration text`);
    return text;
  });
  const unit = `${declarations.join("\n")}\n({ ${names.join(", ")} });`;
  const emitted = ts.transpileModule(unit, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }, reportDiagnostics: true,
  });
  assert.deepEqual(emitted.diagnostics, []);
  return runInNewContext(emitted.outputText, globals, { filename: "grok-private-source-unit.js" });
}

function adapterSourceUnit(): AdapterUnit {
  // VM result is cast at the test-owned source-evaluation boundary only, never a production response.
  return extractSourceUnit(["cancelPinnedImageResponse", "toRetryResponse"], { Headers, Promise }) as AdapterUnit;
}

export function readBodySourceUnit(): BodyUnit {
  const unit = extractSourceUnit(["ImageBodyFailure", "cancelPinnedImageResponse", "readBoundedImageBody"],
    { Headers, Promise, Buffer }) as { readBoundedImageBody: BodyUnit };
  return unit.readBoundedImageBody;
}

type Context = { network: DownloadNetwork; download: Download };

function registerTransientCases(context: () => Context) {
  for (const seconds of [0, 2]) {
    test(`public wrapper + real retry: 503 Retry-After=${seconds}, destroy before GET2, no discarded read`, async (t) => {
      const { network, download } = context();
      const advance = fakeClock(t);
      const controller = new AbortController();
      network.respond = ({ index }) => index === 0
        ? { status: 503, headers: { "retry-after": String(seconds) }, holdBody: true } : {};
      const pending = download(PUBLIC_IMAGE, controller.signal, 5_000);
      try {
        await eventTurn();
        if (seconds) {
          assert.equal(network.exchanges.length, 1); assert.ok(advance.delays.includes(2_000));
          await advance(1_999); assert.equal(network.exchanges.length, 1); await advance(1);
        }
        const result = await pending;
        assert.deepEqual(result.buffer, IMAGE_BYTES);
        assert.equal(network.exchanges.length, 2); assert.equal(network.resolutions.length, 2);
        assert.equal(network.exchanges[0].reads, 0);
        assert.ok(network.order.indexOf("destroy:0") < network.order.indexOf("get:1"));
        await eventTurn();
        assert.ok(network.order.includes("body-close:0")); assert.ok(network.order.includes("close:0"));
        assert.equal(advance.pending.size, 0); assertNoCallerListeners(controller.signal);
      } finally { controller.abort(); await Promise.allSettled([pending]); }
    });
  }
  for (const status of [400, 503]) {
    test(`public wrapper real retry status ${status}: exact attempt budget and final destroy`, async () => {
      const { network, download } = context();
      network.respond = () => ({ status, headers: { "retry-after": "0" }, holdBody: true });
      await assert.rejects(download(PUBLIC_IMAGE), downloadError());
      assert.equal(network.exchanges.length, status === 400 ? 1 : 3);
      assert.equal(network.resolutions.length, network.exchanges.length);
      for (const exchange of network.exchanges) {
        assert.equal(exchange.reads, 0); assert.equal(exchange.request.destroyed, true);
        assert.equal(exchange.response?.destroyed, true);
      }
    });
  }
}

function registerRevalidationCase(context: () => Context) {
  test("real 503 retry revalidates changed DNS and refuses private answer before GET2", async () => {
    const { network, download } = context();
    network.resolve = () => Promise.resolve(network.resolutions.length === 1
      ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "127.0.0.1", family: 4 }]);
    network.respond = () => ({ status: 503, headers: { "retry-after": "0" }, holdBody: true });
    await assert.rejects(download(PUBLIC_IMAGE), downloadError());
    assert.equal(network.resolutions.length, 2); assert.equal(network.exchanges.length, 1);
    assert.equal(network.exchanges[0].request.destroyed, true);
  });
}

function registerResetCases(context: () => Context) {
  for (const code of ["ECONNRESET", "EPIPE"]) {
    test(`public wrapper preserves preheader ${code} identity for actual reset retry`, async (t) => {
      const { network, download } = context(); const advance = fakeClock(t);
      t.mock.method(Math, "random", () => 0.5);
      network.respond = ({ index }) => index === 0
        ? { preheaderError: Object.assign(new Error("transport reset"), { code }) } : {};
      const controller = new AbortController(); const pending = download(PUBLIC_IMAGE, controller.signal);
      try {
        await eventTurn(); assert.equal(network.exchanges.length, 1);
        await advance(149); assert.equal(network.exchanges.length, 1); await advance(1);
        assert.deepEqual((await pending).buffer, IMAGE_BYTES);
        assert.equal(network.resolutions.length, 2); assert.equal(network.exchanges.length, 2);
      } finally { controller.abort(); await Promise.allSettled([pending]); }
    });
  }
  test("nested reset/transient budgets remain 3x3 GETs, never a generation POST", async (t) => {
    const { network, download } = context(); const advance = fakeClock(t);
    t.mock.method(Math, "random", () => 0.5);
    network.respond = ({ index }) => index % 3 < 2
      ? { preheaderError: Object.assign(new Error("reset"), { code: "ECONNRESET" }) }
      : { status: 503, headers: { "retry-after": "0" }, holdBody: true };
    const controller = new AbortController(); const pending = download(PUBLIC_IMAGE, controller.signal, 5_000);
    const refused = assert.rejects(pending, downloadError());
    try {
      await eventTurn();
      for (let group = 0; group < 3; group++) {
        await advance(150); await advance(300);
      }
      await refused; assert.equal(network.exchanges.length, 9); assert.equal(network.resolutions.length, 9);
      assert.ok(network.exchanges.every(({ options }) => options.method === "GET"));
      assert.equal(advance.pending.size, 0);
    } finally { controller.abort(); await Promise.allSettled([pending]); }
  });
}

function registerRetryCancellationCases(context: () => Context) {
  for (const timeout of [false, true]) {
    test(`public wrapper ${timeout ? "deadline" : "abort"} during real retry wait stops GET2`, async (t) => {
      observeProcessErrors(t);
      const { network, download } = context(); const advance = fakeClock(t);
      const controller = new AbortController();
      network.respond = () => ({ status: 503, headers: { "retry-after": "2" }, holdBody: true });
      const pending = download(PUBLIC_IMAGE, controller.signal, 1_000);
      const refused = assert.rejects(pending, downloadError(timeout ? 504 : 499,
        timeout ? "GROK_IMAGE_TIMEOUT" : "GENERATION_CANCELED"));
      try {
        await eventTurn(); assert.ok(advance.delays.includes(2_000));
        assert.equal(network.exchanges[0].request.destroyed, true);
        if (timeout) await advance(1_000); else controller.abort("arbitrary reason");
        await refused;
        assertNoCallerListeners(controller.signal); assert.equal(advance.pending.size, 0);
        assertNoCallerListeners(network.exchanges[0].options.signal!);
        await advance(4_000); assert.equal(network.exchanges.length, 1);
      } finally { controller.abort(); await Promise.allSettled([pending]); }
    });
  }
  test("retry consumes original deadline before held second DNS; late rejection cannot GET", async (t) => {
    observeProcessErrors(t);
    const { network, download } = context(); const advance = fakeClock(t);
    const entered = deferred(); const resolver = deferred<Array<{ address: string; family: 4 }>>();
    const controller = new AbortController();
    network.resolve = (hostname) => {
      if (network.resolutions.length > 1) { entered.resolve(); return resolver.promise; }
      return Promise.resolve(network.hosts[hostname]);
    };
    network.respond = () => ({ status: 503, headers: { "retry-after": "0.6" }, holdBody: true });
    const pending = download(PUBLIC_IMAGE, controller.signal, 1_000);
    const refused = assert.rejects(pending, downloadError(504, "GROK_IMAGE_TIMEOUT"));
    try {
      await eventTurn(); await advance(600); await entered.promise;
      await advance(399); assert.equal(advance.pending.size, 1); await advance(1); await refused;
      assert.equal(network.exchanges.length, 1); assert.equal(advance.pending.size, 0);
    } finally { resolver.reject(new Error("late DNS")); controller.abort(); await Promise.allSettled([pending]); await eventTurn(); }
    assert.equal(network.exchanges.length, 1);
  });
}

function registerNodeEventCases(context: () => Context) {
  for (const timing of ["after-headers", "after-abort"] as const) {
    test(`real Node error events ${timing} remain handled until close`, async (t) => {
      observeProcessErrors(t);
      const { network, download } = context(); const controller = new AbortController();
      let wrapperListeners: Function[] = [];
      network.respond = () => ({ status: 503, holdBody: true, afterHeaders(exchange) {
        wrapperListeners = exchange.response!.listeners("error");
        if (timing === "after-abort") controller.abort("before retry classification");
        const error = new Error("late Node event sentinel");
        exchange.request.emit("error", error);
        exchange.response!.emit("error", error);
      } });
      // A successful status must still fail when the actual Node body errors.
      const respond = network.respond;
      if (timing === "after-headers") network.respond = (exchange) => ({ ...respond(exchange), status: 200 });
      await assert.rejects(download(PUBLIC_IMAGE, controller.signal), timing === "after-abort"
        ? downloadError(499, "GENERATION_CANCELED") : downloadError());
      await eventTurn();
      assert.equal(network.exchanges.length, 1);
      assert.equal(network.exchanges[0].request.listenerCount("error"), 0);
      assert.equal(network.exchanges[0].response!.closed, true);
      assert.equal(wrapperListeners.length, 1, "observe the actual wrapper listener before body iteration");
      // Node's async iterator retains its own end-of-stream error listener. Prove
      // removal of the wrapper-owned handler by identity, not all Node listeners.
      for (const listener of wrapperListeners) {
        assert.equal(network.exchanges[0].response!.listeners("error").includes(listener), false);
      }
      assertNoCallerListeners(controller.signal);
    });
  }
}

function registerAdvisoryAbortCases() {
  for (const lateReject of [false, true]) {
    test(`PRIVATE AST adapter real retry abort with pending advisory cleanup, lateReject=${lateReject}`, async (t) => {
      observeProcessErrors(t);
      const adapter = adapterSourceUnit(); const advance = fakeClock(t);
      const held = deferred(); const controller = new AbortController();
      const reason = new Error("private adapter caller abort");
      let calls = 0; let destroyed = 0;
      const source: SourceResponse = { status: 503, headers: { get: () => "2" }, body: null,
        cancel() { destroyed++; return held.promise; } };
      const pending = grokFetchWithRetry(async () => { calls++; return adapter.toRetryResponse(source); },
        { signal: controller.signal });
      const refused = assert.rejects(pending, (error) => { assert.equal(error, reason); return true; });
      try {
        await eventTurn(); assert.equal(destroyed, 1); assert.ok(advance.delays.includes(2_000));
        controller.abort(reason); await refused;
        assertNoCallerListeners(controller.signal); assert.equal(advance.pending.size, 0);
      } finally {
        if (lateReject) held.reject(new Error("late advisory rejection")); else held.resolve();
        controller.abort(reason); await Promise.allSettled([pending]); await eventTurn();
      }
      await advance(2_000); assert.equal(calls, 1); assert.equal(destroyed, 1);
    });
  }
}

function registerAdvisorySourceCases() {
  for (const mode of ["reject", "never", "throw"] as const) {
    test(`PRIVATE AST adapter + real retry: advisory cancel ${mode} cannot delay attempts`, async (t) => {
      observeProcessErrors(t);
      const adapter = adapterSourceUnit(); const held = deferred(); const order: string[] = [];
      let calls = 0;
      const source: SourceResponse = { status: 503, headers: { get: (name) => name === "retry-after" ? "0" : null },
        body: { [Symbol.asyncIterator]() { assert.fail("discarded body must not be read"); } }, cancel() {
          order.push("destroy");
          if (mode === "throw") throw new Error("advisory throw");
          if (mode === "reject") return Promise.reject(new Error("advisory rejection"));
          return held.promise;
        } };
      const success: SourceResponse = { ...source, status: 200, cancel() {} };
      try {
        const result = await grokFetchWithRetry(async () => {
          order.push(`fetch:${++calls}`); return adapter.toRetryResponse(calls === 1 ? source : success);
        });
        assert.equal(result.source, success); assert.equal(calls, 2);
        assert.deepEqual(order, ["fetch:1", "destroy", "fetch:2"]);
        assert.ok(result.headers instanceof Headers); assert.equal(result.headers.get("retry-after"), "0");
      } finally { held.resolve(); await eventTurn(); }
    });
  }
  test("PRIVATE AST adapter cleanup handle exists even when pinned source body is null", async () => {
    const adapter = adapterSourceUnit(); let destroyed = 0;
    const source: SourceResponse = { status: 503, headers: { get: () => null }, body: null, cancel() { destroyed++; } };
    const result = adapter.toRetryResponse(source);
    assert.equal(result.source, source); assert.ok(result.body); await result.body.cancel();
    const entries: string[] = [];
    result.headers.forEach((value, key) => entries.push(`${key}:${value}`));
    assert.equal(destroyed, 1); assert.deepEqual(entries, []);
  });
}

export function registerDownloadRetryCases(context: () => Context) {
  registerTransientCases(context);
  registerRevalidationCase(context);
  registerResetCases(context);
  registerRetryCancellationCases(context);
  registerNodeEventCases(context);
  registerAdvisorySourceCases();
  registerAdvisoryAbortCases();
}
