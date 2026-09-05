import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import express from "express";
import childProcess from "node:child_process";
import { access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { executionChildEnv, executionTestProcess } from "./_executionTestProcess.ts";
import { openRouteHarness, responsesSse, type RouteHarness } from "./_executionRouteHarness.ts";
import { observeBeforeWrite, PromiseTracker, SettlementTimeout } from "./_executionTrackedWrites.ts";
import { isolateExecution } from "./_executionRouteIsolation.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

if (executionTestProcess(import.meta.url)) {
  let harness: RouteHarness;
  let image: string;
  const payload = { provider: "api", prompt: "execution harness", async: true, n: 1, webSearchEnabled: false };
  before(async () => {
    const spawnBefore = childProcess.spawn;
    const beforeIsolation = globalThis.fetch;
    const owned = await isolateExecution();
    assert.throws(() => childProcess.spawn("must-never-launch"), /Provider process launch forbidden/);
    await assert.rejects(owned.close(), /Isolation violations/);
    assert.equal(childProcess.spawn, spawnBefore);
    assert.equal(globalThis.fetch, beforeIsolation);
    await assert.rejects(access(owned.rootDir), { code: "ENOENT" });
    const original = mock.module.bind(mock);
    const savedFetch = globalThis.fetch;
    const savedConfig = process.env.IMA2_CONFIG_DIR;
    let failedRoot = "";
    let count = 0;
    const moduleMock = mock.method(mock, "module", (...args: Parameters<typeof mock.module>) => {
      failedRoot = process.env.IMA2_CONFIG_DIR!;
      if (++count === 2) throw new Error("fixture mock installation failed");
      return original(...args);
    });
    try { await assert.rejects(openRouteHarness(), /fixture mock installation failed/); }
    finally { moduleMock.mock.restore(); }
    assert.equal(globalThis.fetch, savedFetch);
    assert.equal(process.env.IMA2_CONFIG_DIR, savedConfig);
    await assert.rejects(access(failedRoot), { code: "ENOENT" });
    harness = await openRouteHarness();
    image = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#345678" } }).png().toBuffer()).toString("base64");
  });
  after(async () => { observeBeforeWrite(); await harness?.close(); });
  const upstream = (call: { url: string }) => {
    assert.equal(call.url, "https://api.openai.com/v1/responses");
    return responsesSse([
      { type: "response.output_item.done", item: { type: "image_generation_call", result: image } },
      { type: "response.completed", response: { usage: { total_tokens: 7 } } },
    ]);
  };

  test("child environment excludes credentials and ambient loader options", () => {
    const env = executionChildEnv();
    for (const name of ["HOME", "IMA2_CONFIG_DIR", "OPENAI_API_KEY", "XAI_API_KEY", "NODE_OPTIONS", "EXECUTION_TEST_FILE"]) {
      assert.equal(env[name], undefined);
    }
  });

  test("route setup failure restores its fetch and removes its case directory", async () => {
    const beforeFetch = globalThis.fetch;
    const listen = mock.method(express.application, "listen", () => { throw new Error("fixture listen failed"); });
    try {
      await assert.rejects(harness.run("classic", { upstream }, async () => assert.fail("setup did not fail")), /fixture listen failed/);
    } finally { listen.mock.restore(); }
    assert.equal(globalThis.fetch, beforeFetch);
    await assert.rejects(access(join(process.env.IMA2_CONFIG_DIR!, "execution-1")), { code: "ENOENT" });
  });

  test("202 is not handler settlement; canceled held fetch honors the actual AbortSignal", async () => {
    const entered = deferred();
    await harness.run("classic", { upstream: (call) => {
      entered.resolve();
      return new Promise<Response>((_resolve, reject) => {
        assert.ok(call.signal);
        call.signal.addEventListener("abort", () => reject(call.signal!.reason), { once: true });
      });
    } }, async (fixture) => {
      const response = await fixture.post(payload);
      assert.equal(response.status, 202);
      await entered.promise;
      await assert.rejects(fixture.waitSettled(20), SettlementTimeout);
      fixture.cancel();
      await fixture.waitSettled();
      assert.equal(fixture.calls[0].signal?.aborted, true);
      assert.equal((await fixture.waitTerminal()).event, "error");
      assert.equal(fixture.events.some((entry) => entry.event === "done"), false);
    });
  });

  test("direct work retains original promise identity and expected rejection", async () => {
    await harness.run("classic", { upstream }, async (fixture) => {
      const sentinel = new Error("expected direct-operation refusal");
      const work = Promise.reject(sentinel);
      assert.equal(fixture.trackWork(work), work);
      await assert.rejects(work, (error) => error === sentinel);
      await fixture.waitSettled();
      assert.equal(fixture.calls.length, 0);
    });
  });

  test("pending direct work delays fixture settlement until released", async () => {
    const held = deferred();
    await harness.run("classic", { upstream }, async (fixture) => {
      const work = fixture.trackWork(held.promise);
      try {
        await assert.rejects(fixture.waitSettled(20), SettlementTimeout);
        await access(fixture.generatedDir);
      } finally { held.resolve(); await Promise.allSettled([work]); }
      await fixture.waitSettled();
    });
  });

  test("test-body failure releases held direct work before fixture cleanup", async () => {
    const held = deferred();
    const sentinel = new Error("test-body failure fixture");
    let generatedDir = "";
    await assert.rejects(harness.run("classic", { upstream }, async (fixture) => {
      generatedDir = fixture.generatedDir;
      const work = fixture.trackWork(held.promise);
      try { throw sentinel; }
      finally { held.resolve(); await Promise.allSettled([work]); }
    }), (error) => error === sentinel);
    await assert.rejects(access(generatedDir), { code: "ENOENT" });
  });

  test("actual handler cancellation cannot hide an unmatched upstream exception", async () => {
    const sentinel = new Error("UNMATCHED_ENDPOINT_SENTINEL");
    let cancel!: () => void;
    await assert.rejects(harness.run("classic", { upstream: (call) => {
      cancel();
      assert.equal(call.signal?.aborted, true);
      assert.notEqual(sentinel, call.signal?.reason);
      throw sentinel;
    } }, async (fixture) => {
      cancel = fixture.cancel;
      assert.equal((await fixture.post(payload)).status, 202);
      assert.equal((await fixture.waitTerminal()).data.code, "GENERATION_CANCELED");
      await fixture.waitSettled();
      assert.ok(fixture.calls.length > 0, "the real handler invoked the concrete transport");
    }), (error: assert.AssertionError) => {
      assert.match(error.message, /Unmatched upstream calls/);
      assert.ok(Array.isArray(error.actual) && error.actual.includes(sentinel));
      return true;
    });
  });

  for (const kind of ["request-log", "thumbnail"] as const) {
    test(`cleanup drains the held real ${kind} writer before scratch removal`, async () => {
      const entered = deferred<readonly unknown[]>();
      const bodyReturned = deferred();
      const release = deferred();
      let nextWriterArgs: readonly unknown[] | undefined;
      let written: Buffer | undefined;
      let observationError: unknown;
      const originalTrack = PromiseTracker.prototype.track;
      const tracked = mock.method(PromiseTracker.prototype, "track", function<T>(this: PromiseTracker, work: Promise<T>): Promise<T> {
        const args = nextWriterArgs;
        nextWriterArgs = undefined;
        if (args) void work.then(() => {
          try {
            const path = kind === "request-log" ? String(args[0]) : String(args[1]).replace(/\.(png|jpe?g|webp)$/i, ".thumb.jpg");
            // Read before the tracker releases drain; this observes the real completed writer.
            written = readFileSync(path);
          } catch (error) { observationError = error; }
        }, () => undefined);
        return originalTrack.call(this, work) as Promise<T>;
      });
      observeBeforeWrite(async (name, args) => {
        if (name === kind) { nextWriterArgs = args; entered.resolve(args); await release.promise; }
      });
      let generatedDir = "";
      let requestId = "";
      try {
        const run = harness.run("classic", { upstream }, async (fixture) => {
          generatedDir = fixture.generatedDir; requestId = fixture.requestId;
          assert.equal((await fixture.post(payload)).status, 202);
          assert.equal((await fixture.waitTerminal()).event, "done");
          bodyReturned.resolve();
        });
        let complete = false;
        void run.then(() => { complete = true; }, () => undefined);
        await entered.promise; await bodyReturned.promise;
        await access(generatedDir);
        assert.equal(complete, false, "run cleanup cannot remove an active writer's root");
        release.resolve();
        await run;
        assert.equal(observationError, undefined);
        assert.ok(written && written.length > 0, "real file observed before cleanup removal");
        if (kind === "request-log") assert.equal(JSON.parse(written.toString())[0].requestId, requestId);
        else assert.equal((await sharp(written).metadata()).format, "jpeg");
        await assert.rejects(access(generatedDir), { code: "ENOENT" });
      } finally { release.resolve(); observeBeforeWrite(); tracked.mock.restore(); }
    });
  }

  test("tracker returns the exact promise and retains rejection diagnostics", async () => {
    const tracker = new PromiseTracker();
    const failure = new Error("owned writer failure");
    const promise = Promise.reject(failure);
    assert.equal(tracker.track(promise), promise);
    await assert.rejects(promise, (error) => error === failure);
    await assert.rejects(tracker.drain(), (error: AggregateError) => error.errors[0] === failure);
  });

  test("real detached writer rejection fails cleanup even when production catches it", async () => {
    const failure = new Error("held request-log rejection");
    observeBeforeWrite(async (kind) => { if (kind === "request-log") throw failure; });
    try {
      await assert.rejects(harness.run("classic", { upstream }, async (fixture) => {
        assert.equal((await fixture.post(payload)).status, 202);
        await fixture.waitTerminal();
      }), (error: AggregateError) => error.errors.includes(failure));
    } finally { observeBeforeWrite(); }
  });

  test("unmatched global loopback fetch is recorded even if application catches it", async () => {
    await assert.rejects(harness.run("classic", { upstream: () => { throw new Error("unmatched endpoint"); } }, async () => {
      await assert.rejects(fetch(new Request("http://127.0.0.1:3333/forbidden", { method: "POST", body: "fixture" })), /unmatched endpoint/);
    }), /Unmatched upstream calls/);
  });

  test("cleanup timeout retains traps and storage until the held writer settles", async () => {
    const release = deferred();
    let generatedDir = "";
    let rootDir = "";
    observeBeforeWrite(async (kind) => { if (kind === "thumbnail") await release.promise; });
    try {
      await assert.rejects(harness.run("classic", { upstream }, async (fixture) => {
        generatedDir = fixture.generatedDir; rootDir = fixture.ctx.rootDir;
        await fixture.post(payload);
        await fixture.waitTerminal();
      }), SettlementTimeout);
      await access(generatedDir);
      await access(join(rootDir, "config.json"));
      assert.equal(process.env.IMA2_CONFIG_DIR, rootDir, "environment must not be restored with an active writer");
      release.resolve();
      await harness.close();
      await assert.rejects(access(rootDir), { code: "ENOENT" });
    } finally { release.resolve(); observeBeforeWrite(); }
  });
}
