import { after, afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { assertOwned, isolateExecution } from "./_executionRouteIsolation.ts";
import { fakeMp4Bytes, forbidArtifactArrayBuffer, makeVideoStreamFixture, type VideoStreamOptions } from "./_videoStreamFixture.ts";

const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
const URL_OK = "https://video.fixture.invalid/result.mp4";
const SIZE = "Grok video download exceeds the 100MB limit";
const EMPTY = "Grok video download was empty";
const INVALID = "Grok video download returned an invalid MP4 container";
const CANCELED = { status: 499, code: "GENERATION_CANCELED", message: "Generation canceled" };
const TIMEOUT = { status: 504, code: "GROK_VIDEO_TIMEOUT", message: "Grok video download timed out" };
const failed = (message: string) => ({ status: 502, code: "GROK_VIDEO_DOWNLOAD_FAILED", message });

async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = nativeSetTimeout(() => reject(new Error("video fixture watchdog expired")), 1000);
    })]);
  } finally { nativeClearTimeout(timer); }
}

if (executionTestProcess(import.meta.url)) {
  const isolation = await isolateExecution();
  const deniedFetch = globalThis.fetch;
  after(async () => { await bounded(Promise.allSettled(works)); await isolation.close(); });
  // No production import (including config) occurs before the owned environment/guards.
  const direct = await import("../lib/grokVideoDownload.js");
  const facade = await import("../lib/grokVideoAdapter.js");
  const { config } = await import("../config.js");
  for (const key of ["configDir", "dbPath", "generatedDir", "trashDir", "generationRequestLogFile"] as const) {
    assertOwned(isolation.rootDir, config.storage[key]);
  }
  const streams: ReturnType<typeof makeVideoStreamFixture>[] = [];
  const controllers: AbortController[] = [];
  const works: Promise<unknown>[] = [];
  const pendingWork = new Set<Promise<unknown>>();
  const restoreSpies: Array<() => void> = [];
  const expectedFailures = new Set<unknown>();
  const signals = new Set<AbortSignal>();
  let fetchCalls = 0;

  function controller() { const c = new AbortController(); controllers.push(c); return c; }
  function fixture(chunks: readonly Uint8Array[] = [fakeMp4Bytes()], options: VideoStreamOptions = {}) {
    const f = makeVideoStreamFixture(chunks, options); streams.push(f); return f;
  }
  function track<T>(work: Promise<T>): Promise<T> {
    works.push(work); pendingWork.add(work);
    void work.then(() => pendingWork.delete(work), () => pendingWork.delete(work)); return work;
  }
  function ctx(timeout = 5000): RouteRuntimeContext {
    return { config: { ...config, grokProvider: { ...config.grokProvider, videoDownloadTimeoutMs: timeout } } };
  }
  function read(f: ReturnType<typeof fixture>, cap = 16, signal = controller().signal) {
    signals.add(signal); return track(direct.readVideoDownloadBody(f.response, signal, cap));
  }
  function download(signal = controller().signal, url = URL_OK, timeout = 5000) {
    return track(facade.downloadVideo(ctx(timeout), url, signal));
  }
  function respond(handler: (signal: AbortSignal) => Response | Promise<Response>, url = URL_OK) {
    globalThis.fetch = async (input, init) => {
      fetchCalls++;
      try {
        assert.equal(input, url);
        assert.deepEqual(Object.keys(init ?? {}), ["signal"], "artifact GET must add no headers/body/policy");
        assert.ok(init.signal instanceof AbortSignal);
        signals.add(init.signal);
        return await handler(init.signal);
      } catch (error) {
        if (!expectedFailures.has(error) && !(init?.signal?.aborted && error === init.signal.reason)) {
          isolation.violations.push(error);
        }
        throw error;
      }
    };
  }
  function assembly(f?: ReturnType<typeof fixture>) {
    const copied: Uint8Array[] = [];
    const concats: Uint8Array[][] = [];
    const originalFrom = Buffer.from;
    const originalConcat = Buffer.concat;
    const from = mock.method(Buffer, "from", (...args: unknown[]) => {
      if (args[0] instanceof Uint8Array) { copied.push(args[0]); f?.stats.copiedChunks.push(args[0]); }
      return Reflect.apply(originalFrom, Buffer, args);
    });
    const concat = mock.method(Buffer, "concat", (chunks: readonly Uint8Array[], length?: number) => {
      concats.push([...chunks]); return originalConcat(chunks, length);
    });
    restoreSpies.push(() => from.mock.restore(), () => concat.mock.restore());
    return { copied, concats };
  }
  function clocks() {
    const started: { timer: ReturnType<typeof setTimeout>; ms: number }[] = [];
    const cleared: unknown[] = [];
    const set = mock.method(globalThis, "setTimeout", (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
      const timer = nativeSetTimeout(fn, ms, ...args); started.push({ timer, ms }); return timer;
    });
    const clear = mock.method(globalThis, "clearTimeout", (timer: ReturnType<typeof setTimeout>) => {
      cleared.push(timer); nativeClearTimeout(timer);
    });
    restoreSpies.push(() => set.mock.restore(), () => clear.mock.restore());
    return { started, cleared };
  }
  afterEach(async () => {
    // Drain before restoring guards/spies, even when an assertion above fails.
    const settledListeners = pendingWork.size ? [] : [...signals].map(signal => getEventListeners(signal, "abort").length);
    for (const c of controllers) c.abort(new Error("fixture teardown"));
    for (const f of streams) { f.close(); f.releaseCancel(); }
    await bounded(Promise.allSettled(works));
    try {
      assert.ok(settledListeners.every(count => count === 0), "settled operation leaked listeners before teardown abort");
      for (const f of streams) f.assertDrained();
      for (const signal of signals) assert.equal(getEventListeners(signal, "abort").length, 0, "abort listener leaked");
      assert.deepEqual(isolation.violations, []);
    } finally {
      for (const restore of restoreSpies.splice(0).reverse()) restore();
      globalThis.fetch = deniedFetch;
      streams.length = controllers.length = works.length = 0;
      signals.clear(); expectedFailures.clear(); fetchCalls = 0;
    }
  });

  for (const length of [15, 16]) it(`V06m-01 accepts ${length} bytes across split ftyp`, async () => {
    const bytes = fakeMp4Bytes().subarray(0, length);
    const f = fixture([bytes.subarray(0, 5), bytes.subarray(5, 7), bytes.subarray(7, 8), bytes.subarray(8)]);
    const spy = assembly(f);
    assert.deepEqual(await read(f), bytes);
    assert.equal(spy.concats.length, 1); assert.equal(spy.concats[0].length, 4);
    assert.equal(f.stats.bytesEnqueued, length); assert.equal(f.stats.readerCancelCalls, 0);
    assert.equal(f.stats.sourceCancelCalls, 0); assert.equal(f.stats.releaseLockCalls, 1);
  });

  for (const declared of [undefined, "1", "0", "-1", "bogus"]) {
    it(`V06m-02 rejects 16+1 before copy/concat, length=${declared}`, async () => {
      const rejected = new Uint8Array([42]);
      const f = fixture([fakeMp4Bytes(), rejected, new Uint8Array([43])], {
        headers: declared === undefined ? {} : { "content-length": declared },
      });
      const spy = assembly(f);
      await assert.rejects(read(f), failed(SIZE));
      assert.equal(f.stats.pulls, 2); assert.equal(f.stats.bytesEnqueued, 17);
      assert.equal(f.stats.readerCancelCalls, 1); assert.equal(f.stats.sourceCancelCalls, 1);
      assert.equal(spy.copied.includes(rejected), false); assert.equal(spy.copied.length, 1);
      assert.equal(spy.concats.length, 0);
    });
  }
  it("V06m-02 rejects an oversized first chunk before copying any bytes", async () => {
    const oversized = new Uint8Array(17); oversized.set(fakeMp4Bytes());
    const f = fixture([oversized]); const spy = assembly(f);
    await assert.rejects(read(f), failed(SIZE));
    assert.equal(spy.copied.length, 0); assert.equal(spy.concats.length, 0);
    assert.equal(f.stats.pulls, 1); assert.equal(f.stats.readerCancelCalls, 1);
  });
  it("V06m-03 internal declared cap rejects 17 before any read", async () => {
    const f = fixture([], { headers: { "content-length": "17" }, holdOpen: true }); const spy = assembly();
    await assert.rejects(read(f), failed(SIZE));
    assert.equal(f.stats.pulls, 0); assert.equal(f.stats.readerCancelCalls, 0);
    assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.copied.length, 0); assert.equal(spy.concats.length, 0);
  });
  it("V06m-02 accepted subarrays are copied before backing-store mutation", async () => {
    const backing = new Uint8Array(64); backing.set(fakeMp4Bytes(), 20);
    const chunk = backing.subarray(20, 36); const expected = fakeMp4Bytes();
    const f = fixture([chunk], { holdOpen: true }); const spy = assembly(f);
    const work = read(f); await bounded(f.waiting); backing.fill(255); f.close();
    assert.deepEqual(await work, expected); assert.equal(spy.copied[0], chunk);
    assert.equal(spy.concats.length, 1); assert.equal(spy.concats[0][0].byteLength, 16);
  });

  for (const header of ["104857600", "104857601"]) it(`V06m-03 public default cap header ${header}`, async () => {
    const f = fixture([fakeMp4Bytes()], { headers: { "content-length": header }, holdOpen: header.endsWith("1") });
    respond(() => f.response); const spy = assembly();
    if (header.endsWith("1")) {
      await assert.rejects(download(), failed(SIZE)); assert.equal(f.stats.pulls, 0);
      assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.concats.length, 0);
    } else { assert.deepEqual((await download()).buffer, fakeMp4Bytes()); assert.equal(spy.concats.length, 1); }
    assert.equal(fetchCalls, 1); assert.equal(f.stats.arrayBufferCalls, 0);
  });
  for (const kind of ["empty", "short", "wrong-ftyp", "null"] as const) it(`V06m-04 ${kind} never concats`, async () => {
    const f = fixture(kind === "empty" ? [] : [kind === "short" ? new Uint8Array(11) : new Uint8Array(16)]);
    const nullSpy = forbidArtifactArrayBuffer(new Response(null), isolation.violations);
    respond(() => kind === "null" ? nullSpy.response : f.response); const spy = assembly();
    await assert.rejects(download(), failed(kind === "empty" || kind === "null" ? EMPTY : INVALID));
    assert.equal(spy.concats.length, 0); nullSpy.assertUnused();
    if (kind !== "null") assert.equal(f.stats.readerCancelCalls, 1);
  });
  for (const type of [undefined, "video/mp4; codecs=avc1", "application/octet-stream", "text/html"]) {
    it(`V06m-05 MIME ${type}`, async () => {
      const f = fixture([fakeMp4Bytes()], { headers: type ? { "content-type": type } : {}, holdOpen: type === "text/html" });
      respond(() => f.response); const spy = assembly();
      if (type === "text/html") {
        await assert.rejects(download(), failed("Grok video download returned a non-video response"));
        assert.equal(f.stats.pulls, 0); assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.concats.length, 0);
      } else assert.equal((await download()).contentType, type ?? "video/mp4");
    });
  }
  for (const status of [200, 400]) it(`V06m-03/05 header precedence status=${status}`, async () => {
    const f = fixture([], { status, holdOpen: true, headers: { "content-length": "104857601", "content-type": "text/html" } });
    respond(() => f.response); const spy = assembly();
    await assert.rejects(download(), failed(status === 400 ? "Grok video download failed: HTTP 400" : SIZE));
    assert.equal(f.stats.pulls, 0); assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.concats.length, 0);
  });

  for (const reason of [new Error("custom caller"), "caller string", { kind: "cancel" }, null]) {
    it(`V06m-06 arbitrary caller abort before headers: ${String(reason)}`, async () => {
      const c = controller(); c.abort(reason); const clock = clocks();
      await assert.rejects(download(c.signal), CANCELED); assert.equal(fetchCalls, 0);
      assert.equal(clock.started.length, 1); assert.ok(clock.cleared.includes(clock.started[0].timer));
    });
  }
  it("V06m-06 caller abort after headers cancels before reader acquisition", async () => {
    const c = controller(); const f = fixture([], { holdOpen: true });
    respond(() => { c.abort(new Error("after headers")); return f.response; }); const spy = assembly();
    await assert.rejects(download(c.signal), CANCELED);
    assert.equal(f.stats.pulls, 0); assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.concats.length, 0);
  });
  it("V06m-06 pending read ignores fetch signal but caller abort settles", async () => {
    const c = controller(); const f = fixture([fakeMp4Bytes()], { holdOpen: true });
    respond(() => f.response); const spy = assembly(); const work = download(c.signal);
    await bounded(f.waiting); c.abort(new Error("pending read"));
    await assert.rejects(bounded(work), CANCELED);
    assert.equal(spy.concats.length, 0); assert.equal(f.stats.readerCancelCalls, 1); assert.equal(f.body.locked, false);
  });
  it("V06m-07 timeout before response headers", async () => {
    respond((signal) => new Promise<Response>((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    const clock = clocks(); await assert.rejects(bounded(download(undefined, URL_OK, 10)), TIMEOUT);
    assert.equal(fetchCalls, 1); assert.equal(clock.started.length, 1);
    assert.ok(clock.cleared.includes(clock.started[0].timer));
  });
  it("V06m-07 timeout interrupts held post-header body", async () => {
    const f = fixture([fakeMp4Bytes()], { holdOpen: true }); respond(() => f.response);
    const spy = assembly(); const work = download(undefined, URL_OK, 10);
    await bounded(f.waiting); await assert.rejects(bounded(work), TIMEOUT);
    assert.equal(fetchCalls, 1); assert.equal(spy.concats.length, 0);
    assert.equal(f.stats.readerCancelCalls, 1); assert.equal(f.body.locked, false);
  });
  for (const cancelBehavior of ["reject", "pending"] as const) for (const trigger of ["overflow", "abort"]) {
    it(`V06m-08 ${trigger} survives ${cancelBehavior} cleanup`, async () => {
      const c = controller(); const f = fixture(trigger === "overflow" ? [fakeMp4Bytes(), new Uint8Array([1])] : [], {
        holdOpen: trigger === "abort", cancelBehavior,
      });
      respond(() => f.response); const spy = assembly();
      const work = trigger === "overflow" ? read(f) : download(c.signal);
      if (trigger === "abort") { await bounded(f.waiting); c.abort("cleanup abort"); }
      await assert.rejects(bounded<unknown>(work), trigger === "overflow" ? failed(SIZE) : CANCELED);
      assert.equal(f.stats.readerCancelCalls, 1); assert.equal(f.body.locked, false);
      assert.equal(spy.concats.length, 0); f.releaseCancel();
    });
  }
  it("V06m-09 body ECONNRESET does not retry GET", async () => {
    const error = Object.assign(new Error("read reset"), { code: "ECONNRESET" });
    const f = fixture([fakeMp4Bytes()], { failAfterChunks: error }); respond(() => f.response);
    const spy = assembly(); await assert.rejects(download(), failed("Grok video download request failed: read reset"));
    assert.equal(fetchCalls, 1); assert.equal(f.stats.readerCancelCalls, 1);
    assert.equal(f.stats.releaseLockCalls, 1); assert.equal(spy.concats.length, 0);
  });

  for (const kind of ["success", "http", "header", "mime", "read", "url"]) it(`V06m-10 clears timer: ${kind}`, async () => {
    const f = fixture([fakeMp4Bytes()], { status: kind === "http" ? 400 : 200,
      headers: kind === "header" ? { "content-length": "104857601" } : kind === "mime" ? { "content-type": "text/html" } : {},
      failAfterChunks: kind === "read" ? new Error("read failed") : undefined });
    respond(() => f.response); const clock = clocks();
    if (kind === "success") await download();
    else await assert.rejects(download(undefined, kind === "url" ? "malformed" : URL_OK), { status: 502, code: "GROK_VIDEO_DOWNLOAD_FAILED" });
    assert.equal(clock.started.length, 1); assert.equal(clock.started[0].ms, 5000);
    assert.ok(clock.cleared.includes(clock.started[0].timer));
  });
  it("V06m-10 one deadline survives retry and held body without reset", async () => {
    const retry = fixture([], { status: 503, headers: { "retry-after": "0" }, holdOpen: true });
    const f = fixture([], { holdOpen: true }); const clock = clocks();
    respond(() => {
      assert.equal(clock.started.length, 1, "deadline must exist before the first GET and survive retry");
      return fetchCalls === 1 ? retry.response : f.response;
    });
    const work = download(undefined, URL_OK, 10);
    await bounded(f.waiting); await assert.rejects(bounded(work), TIMEOUT);
    assert.equal(fetchCalls, 2); assert.equal(clock.started.length, 1);
    assert.equal(clock.started[0].ms, 10); assert.ok(clock.cleared.includes(clock.started[0].timer));
    assert.equal(retry.stats.sourceCancelCalls, 1); assert.equal(f.stats.readerCancelCalls, 1);
  });

  function abortAtEof(f: ReturnType<typeof fixture>, c: AbortController, afterReader: boolean) {
    const getReader = f.body.getReader.bind(f.body);
    Object.defineProperty(f.body, "getReader", { configurable: true, value: () => {
      const reader = getReader();
      if (afterReader) {
        const release = reader.releaseLock.bind(reader);
        reader.releaseLock = () => { release(); queueMicrotask(() => c.abort("after reader")); };
      } else {
        const read = reader.read.bind(reader);
        reader.read = async () => {
          try { const result = await read(); if (result.done) c.abort("before EOF"); return result; }
          catch (error) { throw error; }
        };
      }
      return reader;
    } });
  }
  for (const afterReader of [false, true]) it(`V06m-11 EOF abort afterReader=${afterReader}`, async () => {
    const c = controller(); const f = fixture(); abortAtEof(f, c, afterReader);
    respond(() => f.response); const spy = assembly();
    await assert.rejects(download(c.signal), CANCELED);
    assert.equal(spy.concats.length, afterReader ? 1 : 0);
    assert.equal(f.stats.readerCancelCalls, afterReader ? 0 : 1); assert.equal(f.body.locked, false);
  });
  it("V06m-11 caller takes precedence when both signals abort before catch", async () => {
    const c = controller(); const f = fixture([], { holdOpen: true });
    respond((signal) => { signal.addEventListener("abort", () => c.abort({ caller: true }), { once: true }); return f.response; });
    await assert.rejects(bounded(download(c.signal, URL_OK, 10)), CANCELED);
  });

  it("V06m-12 facade identity, signature and public cap ownership", () => {
    assert.equal(facade.downloadVideo, direct.downloadVideo); assert.equal(facade.downloadVideo.length, 3);
    assert.equal("readVideoDownloadBody" in facade, false);
    const source = readFileSync(new URL("../lib/grokVideoDownload.ts", import.meta.url), "utf8");
    assert.match(source, /const MAX_VIDEO_DOWNLOAD_BYTES = 100 \* 1024 \* 1024;/);
    assert.match(source, /readVideoDownloadBody\((?:res|response), combinedSignal\)/);
  });
  for (const url of [URL_OK, "http://localhost/result.mp4", "http://127.0.0.1/result.mp4"]) {
    it(`V06m-12 preserves accepted URL ${url}`, async () => {
      const f = fixture(); respond(() => f.response, url);
      assert.deepEqual((await download(undefined, url)).buffer, fakeMp4Bytes()); assert.equal(fetchCalls, 1);
    });
  }
  for (const url of ["http://example.invalid/video.mp4", "http://[::1]/video.mp4", "file:///tmp/video.mp4", "invalid"]) {
    it(`V06m-12 rejects URL before fetch ${url}`, async () => {
      await assert.rejects(download(undefined, url), { status: 502, code: "GROK_VIDEO_DOWNLOAD_FAILED" });
      assert.equal(fetchCalls, 0);
    });
  }
  it("V06m-13 zero chunks do not enter retained concat inputs", async () => {
    const f = fixture([new Uint8Array(), fakeMp4Bytes(), new Uint8Array()]); const spy = assembly();
    assert.deepEqual(await read(f), fakeMp4Bytes());
    assert.equal(spy.concats.length, 1); assert.equal(spy.concats[0].length, 1); assert.equal(spy.copied.length, 1);
  });
  for (const cap of [0, -1, NaN, Infinity, 1.5, 104857601]) it(`V06m-13 rejects invalid internal cap ${cap}`, async () => {
    const f = fixture([], { holdOpen: true }); const spy = assembly();
    await assert.rejects(read(f, cap), { name: "RangeError", message: "Invalid internal video byte limit" });
    assert.equal(f.stats.pulls, 0); assert.equal(f.stats.sourceCancelCalls, 1); assert.equal(spy.concats.length, 0);
  });

  for (const kind of ["reset", "503"]) it(`V06m-14 retries ${kind} GET-to-headers only`, async () => {
    const error = Object.assign(new Error("synthetic reset"), { code: "ECONNRESET" }); expectedFailures.add(error);
    const retry = fixture([], { status: 503, headers: { "retry-after": "0" }, holdOpen: true });
    const f = fixture(); respond(() => {
      if (fetchCalls > 1) return f.response;
      if (kind === "reset") throw error;
      return retry.response;
    });
    assert.deepEqual((await bounded(download())).buffer, fakeMp4Bytes()); assert.equal(fetchCalls, 2);
    assert.equal(retry.stats.sourceCancelCalls, kind === "503" ? 1 : 0);
  });
  const structured = [Object.assign(new Error("coded"), { status: 418, code: "KEEP" }),
    { name: "TimeoutError", status: 409, code: "OBJECT" }, Object.assign(() => {}, { status: 410, code: "FUNCTION" })];
  for (const value of structured) it(`preserves structured thrown identity ${value.code}`, async () => {
    expectedFailures.add(value); respond(() => { throw value; });
    await assert.rejects(download(), (error) => error === value); assert.equal(fetchCalls, 1);
  });
  for (const value of [new DOMException("abort", "AbortError"), { name: "AbortError", status: 418, code: "IGNORE" },
    new DOMException("deadline", "TimeoutError")]) it(`maps unobserved ${value.name} with legacy priority`, async () => {
    expectedFailures.add(value); respond(() => { throw value; });
    await assert.rejects(download(), TIMEOUT); assert.equal(fetchCalls, 1);
  });
  for (const value of [null, undefined, "https://private.invalid/body"]) it(`primitive failure does not echo arbitrary values: ${typeof value}`, async () => {
    expectedFailures.add(value); respond(() => { throw value; });
    await assert.rejects(download(), (error: Error & { status?: number; code?: string }) => {
      assert.equal(error.status, 502); assert.equal(error.code, "GROK_VIDEO_DOWNLOAD_FAILED");
      assert.match(error.message, /^Grok video download request failed: /); assert.doesNotMatch(error.message, /private\.invalid/); return true;
    });
  });
  it("artifact spy keeps the original Response and independently exposes caught violations", async () => {
    const response = new Response(null); const violations: unknown[] = [];
    const spy = forbidArtifactArrayBuffer(response, violations);
    assert.equal(spy.response, response); assert.equal(spy.arrayBufferCalls, 0);
    await assert.rejects(response.arrayBuffer(), /Artifact response.arrayBuffer is forbidden/);
    assert.equal(spy.arrayBufferCalls, 1); assert.equal(violations.length, 1);
    assert.throws(() => spy.assertUnused(), /artifact arrayBuffer was called/);
  });
}
