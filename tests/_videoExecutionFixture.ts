import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs/promises";
import { realpathSync } from "node:fs";
import { Server } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { dirname } from "node:path";
import { mock } from "node:test";
import type { Express, RequestHandler } from "express";
import type { RuntimeContext } from "../lib/runtimeContext.ts";
import type { UpstreamCall } from "./_executionRouteHarness.ts";
import { executionChildEnv } from "./_executionTestProcess.ts";
import { assertOwned, isolateExecution } from "./_executionRouteIsolation.ts";
import { PromiseTracker, SettlementTimeout } from "./_executionTrackedWrites.ts";
import { listenOwnedLoopback } from "./_grokImageTransportFixture.ts";
import { captureFfmpegCapability, installVideoFfmpeg, type FfmpegAttempt } from "./_videoFfmpegFixture.ts";
import { forbidArtifactArrayBuffer, type makeVideoStreamFixture } from "./_videoStreamFixture.ts";

export type { UpstreamCall };
type Codec = Awaited<ReturnType<typeof installVideoFfmpeg>>;
type Isolation = Awaited<ReturnType<typeof isolateExecution>>;
type Stream = ReturnType<typeof makeVideoStreamFixture>;
type Responder = (call: UpstreamCall) => Response | Promise<Response>;
type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
const nativeSetImmediate = globalThis.setImmediate;
const DRAIN_TIMEOUT_MS = 5000;
const ownedWork = new AsyncLocalStorage<VideoFixture>();
let used = false;

function bounded<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = nativeSetTimeout(() => reject(new SettlementTimeout("Video fixture work did not settle")), DRAIN_TIMEOUT_MS);
    void work.then(value => { nativeClearTimeout(timer); resolve(value); }, error => {
      nativeClearTimeout(timer); reject(error);
    });
  });
}

function isolatedEnvironment(): () => void {
  const saved = { ...process.env };
  const clean = executionChildEnv();
  for (const key of ["EXECUTION_TEST_FILE", "NODE_TEST_CONTEXT"]) {
    if (process.env[key] !== undefined) clean[key] = process.env[key];
  }
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, clean);
  return () => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  };
}

async function loadRuntime(root: string) {
  const { config } = await import("../config.js");
  for (const key of ["configDir", "configFile", "dbPath", "generatedDir", "trashDir", "generationRequestLogFile"] as const) {
    assertOwned(root, config.storage[key]);
  }
  (await import("../lib/logger.js")).configureLogger({ level: "silent" });
  const db = await import("../lib/db.js");
  try {
    const inflight = await import("../lib/inflight.js");
    assertOwned(root, db.getDbPath());
    assert.deepEqual(inflight.listJobs(), [], "Fresh video fixture must have no inflight jobs");
    return { config, db, inflight };
  } catch (error) { db.closeDb(); throw error; }
}

function normalizeCall(input: Parameters<typeof fetch>[0], init?: RequestInit): UpstreamCall {
  // Do not consume a Request stream and then forward its exhausted body.
  assert.ok(!(input instanceof Request), "Video upstream uses URL plus JSON string init only");
  assert.ok(init?.body == null || typeof init.body === "string", "Unsupported video wire body");
  const request = new Request(input, init);
  return { url: request.url, method: request.method, headers: request.headers,
    body: typeof init?.body === "string" ? init.body : "", signal: init?.signal ?? undefined };
}

function origin(server: Server): string {
  const address = Server.prototype.address.call(server);
  assert.ok(server.listening && address && typeof address !== "string" && address.address === "127.0.0.1");
  assert.notEqual(address.port, 3333);
  return `http://127.0.0.1:${address.port}`;
}

function validateProxy(call: UpstreamCall, server: Server, artifactPath: string): boolean {
  const url = new URL(call.url);
  assert.equal(url.origin, origin(server));
  assert.equal(url.username + url.password + url.search + url.hash, "");
  assert.equal(call.headers.has("cookie"), false);
  if (url.pathname === artifactPath) {
    assert.equal(call.method, "GET"); assert.equal(call.body, "");
    assert.equal(call.headers.has("authorization"), false);
    return true;
  }
  const posts = ["/v1/responses", "/v1/chat/completions", "/v1/videos/generations", "/v1/videos/edits", "/v1/videos/extensions"];
  assert.equal(call.headers.get("authorization"), "Bearer dummy");
  if (call.method === "POST" && posts.includes(url.pathname)) {
    assert.match(call.headers.get("content-type") ?? "", /^application\/json(?:;|$)/);
    const body: unknown = JSON.parse(call.body);
    assert.ok(body && typeof body === "object" && !Array.isArray(body));
  } else {
    assert.equal(call.method, "GET"); assert.equal(call.body, "");
    assert.match(url.pathname, /^\/v1\/videos\/[A-Za-z0-9_-]{1,128}$/);
    assert.ok(!posts.includes(url.pathname));
  }
  return false;
}

interface OwnedServer { role: "app" | "proxy"; closed: Promise<void>; closing: boolean; }

class VideoFixture {
  readonly calls: UpstreamCall[] = [];
  readonly violations: unknown[];
  readonly work = new PromiseTracker();
  readonly restores: Array<() => void> = [];
  readonly streams = new Set<Stream>();
  readonly controllers = new Set<AbortController>();
  readonly servers = new Map<Server, OwnedServer>();
  readonly expected = new Set<unknown>();
  readonly apps = new WeakSet<Express>();
  ffmpeg: Codec | null = null;
  modules!: Runtime;
  app: Server | undefined;
  responder: Responder | undefined;
  finishing: Promise<void> | undefined;
  closed = false;
  frozen = false;
  active = false;
  epoch = 0;

  constructor(readonly isolation: Isolation, readonly restoreEnv: () => void) {
    this.violations = isolation.violations;
  }

  admission(): void {
    assert.ok(this.active && !this.closed && !this.frozen, "Video fixture requires an active, non-finishing case");
  }

  beginCase(): void {
    assert.ok(!this.active && !this.closed && !this.frozen && !this.finishing, "Video fixture is not idle");
    assert.deepEqual(this.violations, [], "Cannot reuse a fixture with retained violations");
    assert.equal(this.work.pending.size + this.servers.size, 0, "Previous case has unsettled work");
    this.calls.length = 0; this.expected.clear(); this.responder = undefined;
    this.active = true;
  }

  track<T>(promise: Promise<T>, expected?: (error: unknown) => boolean): Promise<T> {
    this.epoch++;
    this.work.track(promise.then(() => undefined, error => {
      if (!expected?.(error) && !this.violations.includes(error)) this.violations.push(error);
    }));
    return promise;
  }

  async upstream(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
    let call: UpstreamCall | undefined;
    try {
      call = normalizeCall(input, init);
      this.calls.push(call);
      assert.ok(this.responder, "No active video responder");
      const response = await ownedWork.run(this, () => this.responder!(call!));
      assert.ok(response instanceof Response, "Video responder must return an actual Response");
      return response;
    } catch (error) {
      if (error instanceof assert.AssertionError || !(this.expected.has(error)
        || (call?.signal?.aborted && error === call.signal.reason))) this.violations.push(error);
      throw error;
    }
  }

  enroll(server: Server, role: "app" | "proxy"): OwnedServer {
    this.admission();
    assert.ok(server instanceof Server);
    const existing = this.servers.get(server);
    if (existing) { assert.equal(existing.role, role); return existing; }
    assert.equal(server.listening, false, "Enroll servers before listen");
    const closed = new Promise<void>(resolve => server.once("close", resolve));
    const owned = { role, closed, closing: false };
    server.on("error", error => this.violations.push(error));
    this.servers.set(server, owned);
    return owned;
  }

  async listen(server: Server, role: "app" | "proxy"): Promise<string> {
    const owned = this.enroll(server, role);
    let ready!: () => void;
    let failed!: (error: Error) => void;
    const listening = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject; });
    server.once("listening", ready); server.once("error", failed);
    try {
      listenOwnedLoopback(() => server.listen(0, "127.0.0.1"));
      await bounded(listening);
      if (role === "app") this.registerApp(server);
      return origin(server);
    } catch (error) { await this.closeServer(server, owned); throw error; }
    finally { server.off("listening", ready); server.off("error", failed); }
  }

  registerApp(server: Server): void {
    this.admission();
    assert.equal(this.servers.get(server)?.role, "app", "App must be enrolled by fixture.listen");
    assert.ok(!this.app || this.app === server, "Only one owned app is admitted per case");
    origin(server); this.app = server;
  }

  trackApp(app: Express): void {
    this.admission();
    assert.ok(!this.apps.has(app), "Track each app exactly once before registering routes");
    this.apps.add(app);
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "all"] as const) {
      const original = app[method];
      const wrap = (callback: unknown): unknown => {
        if (Array.isArray(callback)) return callback.map(wrap);
        assert.equal(typeof callback, "function");
        const handler = callback as RequestHandler;
        return ((req, res, next) => {
          const result = ownedWork.run(this, () => handler(req, res, next));
          if (result instanceof Promise) this.track(result);
          return result;
        }) satisfies RequestHandler;
      };
      // Preserve Express's get(setting) overload and registration return value.
      Object.defineProperty(app, method, { configurable: true, writable: true, value: (...args: unknown[]) => {
        if (args.length === 1 && method === "get") return Reflect.apply(original, app, args);
        this.admission();
        return Reflect.apply(original, app, [args[0], ...args.slice(1).map(wrap)]);
      } });
      this.restores.push(() => { app[method] = original; });
    }
  }

  bridgeProxy(server: Server, validate: (call: UpstreamCall) => void, artifactPath: string): void {
    this.admission();
    assert.equal(this.servers.get(server)?.role, "proxy");
    assert.ok(artifactPath.startsWith("/") && new URL(artifactPath, origin(server)).origin === origin(server));
    this.responder = async call => {
      try {
        const artifact = validateProxy(call, server, artifactPath);
        validate(call);
        const response = await this.isolation.fetchOwned(server, call.url, {
          method: call.method, headers: call.headers, signal: call.signal, redirect: "error",
          ...(call.body ? { body: call.body } : {}),
        });
        if (artifact) forbidArtifactArrayBuffer(response, this.violations);
        return response;
      } catch (error) {
        if (error instanceof assert.AssertionError || !(call.signal?.aborted && error === call.signal.reason)) {
          this.violations.push(error);
        }
        throw error;
      }
    };
  }

  async drain(): Promise<void> {
    try {
      await bounded((async () => {
        let previous: number;
        do {
          previous = this.epoch;
          while (this.work.pending.size) await Promise.allSettled([...this.work.pending]);
          await this.ffmpeg?.drain();
          await this.isolation.imageTransport.drain();
          await new Promise<void>(resolve => nativeSetImmediate(resolve));
        } while (this.work.pending.size || previous !== this.epoch);
      })());
    } catch (error) { throw error; }
  }

  async closeServer(server: Server, owned: OwnedServer): Promise<void> {
    try {
      if (!owned.closing) {
        owned.closing = true;
        server.close(); server.closeAllConnections();
      }
      await bounded(owned.closed);
    } catch (error) { throw error; }
  }

  finishCase(): Promise<void> {
    if (this.finishing) return this.finishing;
    if (this.closed || !this.active) return Promise.resolve();
    this.frozen = true;
    this.finishing = Promise.resolve().then(() => this.finish());
    return this.finishing;
  }

  async finish(): Promise<void> {
    const failures: unknown[] = [];
    const settle = async (work: Promise<unknown>) => {
      try { await work; }
      catch (error) { if (error instanceof SettlementTimeout) throw error; failures.push(error); }
    };
    try {
      for (const controller of this.controllers) controller.abort();
      for (const job of this.modules.inflight.listJobs()) this.modules.inflight.abortJob(job.requestId);
      for (const stream of this.streams) { stream.close(); stream.releaseCancel(); }
      await settle(this.drain());
      await settle(Promise.all([...this.servers].map(([server, owned]) => this.closeServer(server, owned))));
      await settle(this.drain());
      for (const stream of this.streams) {
        try { stream.assertDrained(); } catch (error) { failures.push(error); }
      }
      failures.push(...this.isolation.imageTransport.violations);
      this.modules.inflight._resetForTests();
      this.servers.clear(); this.streams.clear(); this.controllers.clear(); this.app = undefined;
      this.violations.push(...failures); this.frozen = false; this.active = false;
      assert.deepEqual(this.violations, [], "Video fixture boundary/work failures remain fatal even if caught");
    } catch (error) { throw error; }
    finally { this.finishing = undefined; }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    let failure: unknown;
    try { await this.finishCase(); }
    catch (error) { if (error instanceof SettlementTimeout) throw error; failure = error; }
    if (this.work.pending.size || this.servers.size) throw new SettlementTimeout("Retaining video fixture guards with pending work/servers");
    await bounded(this.ffmpeg?.close() ?? Promise.resolve());
    await this.drain();
    try {
      this.modules.db.closeDb();
      for (const restore of this.restores.reverse()) restore();
      this.ffmpeg?.restore();
      await this.isolation.close();
    } finally { this.closed = true; this.restoreEnv(); }
    if (failure) throw failure;
  }
}

async function installObservers(fixture: VideoFixture): Promise<void> {
  installUnlinkObserver(fixture);
  const log = await import("../lib/generationRequestLog.js");
  const image = await import("../lib/imageThumb.js");
  const thumb = await import("../lib/videoThumb.js");
  const replacements = [
    ["../lib/generationRequestLog.js", { ...log, appendGenerationRequestLog: (...args: Parameters<typeof log.appendGenerationRequestLog>) =>
      fixture.track(log.appendGenerationRequestLog(...args)) }],
    ["../lib/imageThumb.js", { ...image, generateImageThumbnailFromBuffer: (...args: Parameters<typeof image.generateImageThumbnailFromBuffer>) =>
      fixture.track(image.generateImageThumbnailFromBuffer(...args)) }],
    ["../lib/videoThumb.js", { ...thumb, generateVideoThumbnail: (path: string) =>
      observeThumbnail(fixture, path, () => thumb.generateVideoThumbnail(path)) }],
  ] as const;
  for (const [path, namedExports] of replacements) {
    const replacement = mock.module(new URL(path, import.meta.url).href, { namedExports });
    fixture.restores.push(() => replacement.restore());
  }
  // The operation imports persistence, which must see the already-wrapped thumbnail.
  const operation = await import("../lib/videoExtendI2vOperation.js");
  const replacement = mock.module(new URL("../lib/videoExtendI2vOperation.js", import.meta.url).href, {
    namedExports: { ...operation, runLastFrameI2v: (...args: Parameters<typeof operation.runLastFrameI2v>) =>
      fixture.track(operation.runLastFrameI2v(...args)) },
  });
  fixture.restores.push(() => replacement.restore());
}

function expectedThumbnailFailure(path: string, error: unknown, attempt?: FfmpegAttempt): boolean {
  if (!(error instanceof Error) || error.message !== `Failed to generate thumbnail for ${path}`) return false;
  const args = ["-y", "-i", path, "-vframes", "1", "-q:v", "4", "-vf", "scale='min(320,iw)':-2", `${path}.thumb.jpg`];
  return Boolean(attempt?.error && attempt.closed && attempt.callbackDone && !attempt.canceled
    && attempt.input && attempt.output && JSON.stringify(attempt.args) === JSON.stringify(args)
    && (attempt.code !== 0 || (attempt.error as NodeJS.ErrnoException).code === "ENOENT"));
}

function observeThumbnail(fixture: VideoFixture, path: string, invoke: () => Promise<string>): Promise<string> {
  const start = fixture.ffmpeg?.attempts.length ?? 0;
  const promise = invoke();
  const attempts = fixture.ffmpeg?.attempts.slice(start) ?? [];
  const observer = promise.then(() => undefined, async error => {
    try {
      await fixture.ffmpeg?.drain();
      if (fixture.violations.length || attempts.length !== 1 || !expectedThumbnailFailure(path, error, attempts[0])) {
        fixture.violations.push(error);
      }
    } catch (failure) { fixture.violations.push(failure); }
  });
  fixture.track(observer);
  return promise;
}

function installUnlinkObserver(fixture: VideoFixture): void {
  const unlink = fs.unlink;
  const descriptor = Object.getOwnPropertyDescriptor(fs, "unlink")!;
  Object.defineProperty(fs, "unlink", { ...descriptor, value: (path: Parameters<typeof unlink>[0]) => {
    try {
      const thumbnail = typeof path === "string" && path.endsWith(".thumb.jpg");
      if (thumbnail) {
        assertOwned(fixture.isolation.rootDir, path);
        assertOwned(realpathSync(fixture.isolation.rootDir), realpathSync(dirname(path)));
      }
      const promise = unlink(path);
      if (thumbnail) fixture.track(promise, error => (error as NodeJS.ErrnoException)?.code === "ENOENT");
      return promise;
    } catch (error) {
      fixture.violations.push(error);
      throw error;
    }
  } });
  syncBuiltinESMExports();
  fixture.restores.push(() => { Object.defineProperty(fs, "unlink", descriptor); syncBuiltinESMExports(); });
}

export async function openVideoFixture(options: { codec?: boolean } = {}) {
  assert.equal(used, false, "Use one video fixture per isolated test process; config modules retain their root");
  used = true;
  const capability = captureFfmpegCapability();
  const restoreEnv = isolatedEnvironment();
  let fixture: VideoFixture | undefined;
  try {
    const isolation = await isolateExecution();
    fixture = new VideoFixture(isolation, restoreEnv);
    if (options.codec) fixture.ffmpeg = await installVideoFfmpeg(isolation.rootDir, capability, fixture.violations);
    fixture.modules = await loadRuntime(isolation.rootDir);
    await installObservers(fixture);
    globalThis.fetch = (input, init) => fixture!.track(fixture!.upstream(input, init), () => true);
    return publicFixture(fixture);
  } catch (error) {
    if (fixture) {
      for (const restore of fixture.restores.reverse()) restore();
      fixture.ffmpeg?.restore(); fixture.modules?.db.closeDb();
      await fixture.isolation.close();
    }
    restoreEnv(); throw error;
  }
}

function publicFixture(fixture: VideoFixture) {
  return {
    root: fixture.isolation.rootDir, config: fixture.modules.config as RuntimeContext["config"],
    calls: fixture.calls, violations: fixture.violations, ffmpeg: fixture.ffmpeg,
    beginCase: fixture.beginCase.bind(fixture),
    trackApp: fixture.trackApp.bind(fixture), listen: fixture.listen.bind(fixture),
    registerApp: fixture.registerApp.bind(fixture), bridgeProxy: fixture.bridgeProxy.bind(fixture),
    fetchApp(input: Parameters<typeof fetch>[0], init?: RequestInit) {
      fixture.admission(); assert.ok(fixture.app, "No owned application server");
      return fixture.track(fixture.isolation.fetchOwned(fixture.app, input, init), error =>
        fixture.expected.has(error) || Boolean(init?.signal?.aborted && error === init.signal.reason));
    },
    respond(handler: Responder) { fixture.admission(); fixture.responder = handler; },
    allowFailure(error: unknown) { fixture.admission(); fixture.expected.add(error); },
    controller() { fixture.admission(); const controller = new AbortController(); fixture.controllers.add(controller); return controller; },
    track: <T>(work: Promise<T>): Promise<T> => { fixture.admission(); return fixture.track(work); },
    addStream(stream: Stream) {
      if (ownedWork.getStore() !== fixture) fixture.admission();
      assert.equal(fixture.closed, false);
      fixture.streams.add(stream);
      if (fixture.frozen) { stream.close(); stream.releaseCancel(); }
    },
    drain: fixture.drain.bind(fixture), finishCase: fixture.finishCase.bind(fixture), close: fixture.close.bind(fixture),
  };
}
