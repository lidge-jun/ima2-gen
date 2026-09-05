import assert from "node:assert/strict";
import { before, beforeEach, after, afterEach, test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { openVideoFixture, type UpstreamCall } from "./_videoExecutionFixture.ts";
import { fakeMp4Bytes, makeVideoStreamFixture } from "./_videoStreamFixture.ts";
import { bounded } from "./_executionTrackedWrites.ts";
import type { BusEvent } from "../lib/eventBus.ts";

type Mode = "generate" | "edit" | "native" | "last-frame";
const PROXY = "http://video-fixture.invalid";
const ARTIFACT = "https://video-fixture.invalid/held.mp4";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

if (executionTestProcess(import.meta.url)) {
  let fixture: Awaited<ReturnType<typeof openVideoFixture>>;
  let registerVideoRoutes: typeof import("../routes/video.js").registerVideoRoutes;
  let registerVideoExtendedRoutes: typeof import("../routes/videoExtended.js").registerVideoExtendedRoutes;
  let createContext: typeof import("../lib/runtimeContext.js").createTestRuntimeContext;
  let subscribe: typeof import("../lib/eventBus.js").subscribe;
  let abortJob: typeof import("../lib/inflight.js").abortJob;
  before(async () => {
    fixture = await openVideoFixture();
    ({ registerVideoRoutes } = await import("../routes/video.js"));
    ({ registerVideoExtendedRoutes } = await import("../routes/videoExtended.js"));
    ({ createTestRuntimeContext: createContext } = await import("../lib/runtimeContext.js"));
    ({ subscribe } = await import("../lib/eventBus.js"));
    ({ abortJob } = await import("../lib/inflight.js"));
  });
  beforeEach(() => fixture.beginCase());
  afterEach(async () => { await fixture.finishCase(); });
  after(async () => { await fixture.close(); });

  function upstream(mode: Mode, stream: ReturnType<typeof makeVideoStreamFixture>) {
    const counts = { starts: 0, polls: 0, artifacts: 0 };
    let signal: AbortSignal | undefined;
    const start = mode === "edit" ? "edits" : mode === "native" ? "extensions" : "generations";
    fixture.respond((call: UpstreamCall) => {
      if (call.url === ARTIFACT) {
        assert.equal(call.method, "GET"); assert.equal(call.headers.get("authorization"), null);
        assert.equal(call.headers.get("cookie"), null); assert.equal(call.body, "");
        counts.artifacts++; signal = call.signal ?? undefined; return stream.response;
      }
      assert.equal(new URL(call.url).origin, PROXY);
      assert.equal(call.headers.get("authorization"), "Bearer dummy");
      if (call.url === `${PROXY}/v1/videos/cancel-artifact`) {
        assert.equal(call.method, "GET"); counts.polls++;
        return Response.json({ status: "done", video: { url: ARTIFACT, duration: 1, respect_moderation: true } });
      }
      assert.equal(call.method, "POST"); assert.ok(JSON.parse(call.body));
      if (call.url === `${PROXY}/v1/responses`) return Response.json({ output: [{ type: "message", content: [{ type: "text", text: "fixture brief" }] }] });
      if (call.url === `${PROXY}/v1/chat/completions`) return Response.json({ choices: [{ message: { tool_calls: [{
        type: "function", function: { name: "generate_video", arguments: JSON.stringify({ prompt: "fixture planned" }) },
      }] } }] });
      assert.equal(call.url, `${PROXY}/v1/videos/${start}`); counts.starts++;
      return Response.json({ request_id: "cancel-artifact" });
    });
    return { counts, signal: () => signal };
  }

  async function appFor(mode: Mode, dir: string) {
    const app = express(); fixture.trackApp(app); app.use(express.json());
    let response: express.Response | undefined;
    app.use((_req, res, next) => { response = res; next(); });
    const ctx = createContext({ rootDir: fixture.root, grokUrl: PROXY,
      config: { ...fixture.config, storage: { ...fixture.config.storage, generatedDir: dir } } });
    if (mode === "generate") registerVideoRoutes(app, ctx);
    else registerVideoExtendedRoutes(app, ctx, { extractFrame: async () => PNG });
    const server = createServer(app);
    const url = await fixture.listen(server, "app");
    return { url, response: () => response };
  }

  function payload(mode: Mode, requestId: string) {
    return { requestId, provider: "grok", model: "grok-imagine-video", prompt: "cancel held download",
      duration: mode === "native" ? 5 : 1, resolution: "480p", aspectRatio: "auto", webSearchEnabled: false,
      ...(mode === "last-frame" ? { sourceVideoId: "parent.mp4" }
        : mode === "edit" || mode === "native" ? { videoUrl: "https://fixture.invalid/input.mp4" } : {}) };
  }

  async function signalAborted(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    let listener!: () => void;
    const event = new Promise<void>(resolve => { listener = resolve; signal.addEventListener("abort", listener, { once: true }); });
    try { await bounded(event); } finally { signal.removeEventListener("abort", listener); }
  }

  for (const mode of ["generate", "edit", "native", "last-frame"] as const) {
    test(`${mode}: cancellation after artifact read starts settles real work without persistence`, async () => {
      const dir = join(fixture.root, `cancel-${mode}`); await mkdir(dir);
      if (mode === "last-frame") {
        await writeFile(join(dir, "parent.mp4"), fakeMp4Bytes());
        await writeFile(join(dir, "parent.mp4.json"), JSON.stringify({ provider: "grok", model: "grok-imagine-video",
          userPrompt: "parent", video: { duration: 1, resolution: "480p", aspectRatio: "auto" } }));
      }
      const prior = await Promise.all((await readdir(dir)).sort().map(async name => ({ name, bytes: await readFile(join(dir, name)) })));
      const stream = makeVideoStreamFixture([fakeMp4Bytes()], { holdOpen: true }); fixture.addStream(stream);
      const observed = upstream(mode, stream);
      const requestId = `cancel-read-${mode}`, events: BusEvent[] = [];
      const stop = subscribe(entry => { if (entry.jobId === requestId) events.push(entry); });
      const app = await appFor(mode, dir);
      const endpoint = mode === "native" ? "extend/native" : mode === "last-frame" ? "extend" : mode;
      const client = fixture.controller(), clientReason = new Error("owned HTTP client canceled");
      let received = false, wire = "", clientError: unknown;
      const work = fixture.fetchApp(`${app.url}/api/video/${endpoint}`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(mode, requestId)),
        ...(mode === "edit" || mode === "native" ? { signal: client.signal } : {}) })
        .then(async response => { received = true; wire = await response.text(); }, error => { clientError = error; });
      try {
        await bounded(stream.waiting);
        const signal = observed.signal(); assert.ok(signal); assert.equal(signal.aborted, false);
        if (mode === "edit" || mode === "native") { fixture.allowFailure(clientReason); client.abort(clientReason); }
        else abortJob(requestId);
        await signalAborted(signal); await bounded(work); await fixture.drain();
        assert.deepEqual(observed.counts, { starts: 1, polls: 1, artifacts: 1 });
        assert.equal(stream.stats.arrayBufferCalls, 0); assert.equal(stream.stats.readerCancelCalls, 1);
        assert.equal(stream.body.locked, false);
        assert.equal(events.some(entry => entry.event === "done"), false);
        if (mode === "edit" || mode === "native") {
          assert.equal(received, false); assert.equal(clientError, clientReason);
          assert.equal(app.response()?.statusCode, 499);
        } else {
          assert.ok(events.some(entry => entry.event === "error" && entry.data.status === 499));
          const terminal = events.filter(entry => entry.envelope?.terminal);
          assert.equal(terminal.length, 1, "registry cancellation publishes exactly one terminal");
          assert.equal(terminal[0]?.envelope?.phase, "cancelled");
          assert.equal(terminal[0]?.envelope?.error?.code, "GENERATION_CANCELED");
          if (mode === "generate") assert.ok(!wire.includes("event: done"));
        }
        assert.deepEqual((await readdir(dir)).sort(), prior.map(x => x.name));
        for (const item of prior) assert.deepEqual(await readFile(join(dir, item.name)), item.bytes);
      } finally { stop(); client.abort(clientReason); stream.close(); stream.releaseCancel(); await work; await fixture.finishCase(); }
    });
  }
}
