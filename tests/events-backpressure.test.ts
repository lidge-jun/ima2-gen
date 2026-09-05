import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter, once } from "node:events";
import { createServer, type ServerResponse } from "node:http";
import express, { type Express, type Request, type Response, type RequestHandler } from "express";
import { registerEventsRoute } from "../routes/events.ts";
import { publish, _resetForTest, RING_SIZE, MAX_SSE_LISTENERS } from "../lib/eventBus.ts";
import { SSE_STREAM_POLICY } from "../lib/eventsPolicy.ts";
import type { RouteRuntimeContext } from "../lib/runtimeContext.ts";
import { runMcpJob } from "../bin/lib/mcpJob.ts";

// Only the Express writable/request boundary is modeled; route and bus are real.
class Writable extends EventEmitter {
  chunks: string[] = [];
  destroyed = false;
  writableEnded = false;
  destroys = 0;
  statusCode = 200;
  body: unknown;
  behavior: (chunk: string) => boolean = () => true;
  flush: () => void = () => {};
  setHeader() {}
  flushHeaders() { this.flush(); }
  status(code: number) { this.statusCode = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  write(chunk: string) { this.chunks.push(chunk); return this.behavior(chunk); }
  destroy() { this.destroyed = true; this.destroys++; this.emit("close"); return this; }
}

type Timer = { fn: () => void; delay: number; interval: boolean };
function fixture(run: (f: ReturnType<typeof setup>) => void) {
  const f = setup();
  try { run(f); } finally { f.close(); }
}

function setup() {
  _resetForTest();
  const timers = new Map<number, Timer>();
  const connections: Array<{ req: EventEmitter; res: Writable }> = [];
  const originals = new Map(["setTimeout", "clearTimeout", "setInterval", "clearInterval"].map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)!],
  ));
  let nextTimer = 0;
  for (const interval of [false, true]) {
    Object.defineProperty(globalThis, interval ? "setInterval" : "setTimeout", {
      configurable: true, value: (fn: () => void, delay: number) => {
        timers.set(++nextTimer, { fn, delay, interval }); return nextTimer;
      },
    });
    Object.defineProperty(globalThis, interval ? "clearInterval" : "clearTimeout", {
      configurable: true, value: (id: number) => timers.delete(id),
    });
  }
  const open = (query: unknown = undefined, options: { header?: string; res?: Writable } = {}) => {
    let handler: RequestHandler;
    // The route uses get only; request and response are controlled EventEmitters.
    registerEventsRoute({ get: (_path: string, fn: RequestHandler) => { handler = fn; } } as unknown as Express,
      {} as RouteRuntimeContext);
    const req = Object.assign(new EventEmitter(), { headers: { "last-event-id": options.header },
      query: query === undefined ? {} : { lastEventId: query } });
    const res = options.res ?? new Writable(); connections.push({ req, res });
    handler!(req as unknown as Request, res as unknown as Response, () => {});
    return { req, res };
  };
  const fire = (interval: boolean) => {
    const entry = [...timers].find(([, timer]) => timer.interval === interval);
    assert.ok(entry, `expected ${interval ? "heartbeat" : "deadline"}`);
    const [id, timer] = entry;
    if (!interval) timers.delete(id);
    timer.fn();
  };
  const close = () => {
    try {
      for (const { req } of connections) req.emit("close");
      assert.equal(timers.size, 0, "all owned timers released");
    } finally {
      for (const [key, descriptor] of originals) Object.defineProperty(globalThis, key, descriptor);
      _resetForTest();
    }
  };
  return { open, timers, fire, close };
}

function ids(res: Writable): number[] {
  return res.chunks.flatMap(chunk => /^id: (\d+)/.test(chunk) ? [Number(/^id: (\d+)/.exec(chunk)![1])] : []);
}

test("replay write(false) pauses; drain resumes once after accepted cursor and catches live arrivals", () => {
  fixture(f => {
    for (let n = 0; n < 3; n++) publish("a", "phase", { n });
    const res = new Writable(); res.behavior = () => false;
    const { req } = f.open(0, { res });
    assert.deepEqual(ids(res), [1]); assert.equal(res.destroyed, false);
    publish("a", "done", {}); f.fire(true);
    assert.deepEqual(ids(res), [1]);
    assert.equal([...f.timers.values()].filter(t => !t.interval).length, 1);
    assert.equal([...f.timers.values()].find(t => !t.interval)?.delay, 15_000);
    res.behavior = () => true; res.emit("drain"); res.emit("drain");
    assert.deepEqual(ids(res), [1, 2, 3, 4]);
    assert.equal([...f.timers.values()].filter(t => !t.interval).length, 0);
    req.emit("close"); res.emit("close"); res.emit("drain");
    assert.equal(res.destroys, 1);
    assert.deepEqual(req.eventNames(), []); assert.deepEqual(res.eventNames(), []);
    publish("a", "done", {}); assert.deepEqual(ids(res), [1, 2, 3, 4]);
  });
});

test("live full image payload is preserved; paused catch-up uses ring omission metadata", () => {
  fixture(f => {
    publish("old", "done", {});
    const { res } = f.open();
    assert.deepEqual(res.chunks, []);
    const image = "x".repeat(1001); // Just above the ring's omission boundary, not a load payload.
    res.behavior = () => false;
    publish("a", "partial", { image }); publish("a", "done", { image, filename: "out.png" });
    assert.match(res.chunks[0], /"image":"x+/);
    res.behavior = () => true; res.emit("drain");
    assert.deepEqual(ids(res), [2, 3]);
    assert.doesNotMatch(res.chunks[1], /"image":/);
    assert.match(res.chunks[1], /"_imageOmitted":true/);
    assert.match(res.chunks[1], /"filename":"out.png"/);
  });
});

test("heartbeat blocked at cursor zero emits one gap before retained events after eviction", () => {
  fixture(f => {
    const { res } = f.open();
    res.behavior = () => false; f.fire(true);
    const deadline = [...f.timers].find(([, t]) => !t.interval)![0];
    for (let n = 0; n <= RING_SIZE; n++) publish("a", "progress", {});
    f.fire(true);
    assert.deepEqual(res.chunks, [": ping\n\n"]);
    assert.ok(f.timers.has(deadline), "heartbeats do not extend the existing deadline");
    res.behavior = () => true; res.emit("drain");
    assert.equal(res.chunks.filter(c => c.startsWith("event: replay-gap")).length, 1);
    assert.equal(res.chunks[1], 'event: replay-gap\ndata: {"lastEventId":0,"oldestAvailableId":2}\n\n');
    assert.equal(ids(res)[0], 2); assert.equal(ids(res).at(-1), 2001);
  });
});

test("stalled deadline closes exactly once and frees capacity; stale callbacks are inert", () => {
  fixture(f => {
    assert.deepEqual(SSE_STREAM_POLICY, { drainTimeoutMs: 15_000 });
    assert.equal(Object.isFrozen(SSE_STREAM_POLICY), true);
    const connections = Array.from({ length: MAX_SSE_LISTENERS }, () => f.open());
    const rejected = f.open().res;
    assert.equal(rejected.statusCode, 503);
    assert.deepEqual(rejected.body, { error: { code: "SSE_CAPACITY", message: "Too many event stream connections" } });
    const target = connections[0]; target.res.behavior = () => false;
    const staleDrain = target.res.listeners("drain")[0];
    publish("a", "phase", {});
    const deadline = [...f.timers.values()].find(t => !t.interval)!.fn;
    f.fire(false); deadline(); staleDrain(); target.req.emit("close");
    assert.equal(target.res.destroys, 1); assert.deepEqual(target.res.eventNames(), []);
    assert.equal(f.open().res.statusCode, 200);
    assert.equal(f.open().res.statusCode, 503);
  });
});

test("failed setup, throw, reentrant close and response error leave no timer or subscriber", () => {
  fixture(f => {
    for (const fault of ["setup", "throw", "close", "error"] as const) {
      const res = new Writable();
      if (fault === "setup") res.flush = () => { throw new Error("fixture setup"); };
      else res.behavior = () => {
        if (fault === "throw") throw new Error("fixture write");
        res.emit(fault); return false;
      };
      publish("a", "phase", {});
      const { req } = f.open(0, { res });
      assert.equal(res.destroys, 1); assert.equal(f.timers.size, 0);
      assert.deepEqual(req.eventNames(), []); assert.deepEqual(res.eventNames(), []);
      const count = res.chunks.length;
      publish("a", "done", {}); assert.equal(res.chunks.length, count);
    }
  });
});

test("reentrant publication during a write catches up in order without duplicate frames", () => {
  fixture(f => {
    const { res } = f.open();
    res.behavior = () => {
      if (res.chunks.length === 1) publish("b", "done", {});
      return true;
    };
    publish("a", "phase", {});
    assert.deepEqual(ids(res), [1, 2]);
  });
});

test("future/zero/invalid/header cursors retain replay and live-only compatibility", () => {
  fixture(f => {
    const empty = f.open("42").res;
    assert.equal(empty.chunks[0], 'event: replay-gap\ndata: {"lastEventId":42,"oldestAvailableId":null}\n\n');
    publish("a", "phase", {}); publish("b", "done", {});
    assert.deepEqual(ids(f.open(0).res), [1, 2]);
    assert.deepEqual(ids(f.open(-2).res), [1, 2]);
    for (const value of [undefined, "bad", "9007199254740992"]) assert.deepEqual(f.open(value).res.chunks, []);
    assert.deepEqual(ids(f.open(0, { header: "1, 0" }).res), [2]);
    assert.deepEqual(ids(f.open(0, { header: "9007199254740992" }).res), [1, 2]);
    const future = f.open(8).res;
    assert.match(future.chunks[0], /event: replay-gap/);
    assert.deepEqual(ids(future), [1, 2]);
  });
});

test("a blocked gap control is accepted once and rebases catch-up before drain", () => {
  fixture(f => {
    publish("a", "phase", {}); publish("a", "done", {});
    const res = new Writable(); res.behavior = () => false;
    f.open(99, { res });
    assert.equal(res.chunks.length, 1); assert.match(res.chunks[0], /event: replay-gap/);
    publish("b", "done", {});
    assert.equal(res.chunks.length, 1);
    res.behavior = () => true; res.emit("drain"); res.emit("drain");
    assert.equal(res.chunks.filter(chunk => chunk.startsWith("event: replay-gap")).length, 1);
    assert.deepEqual(ids(res), [1, 2, 3]);
  });
});

type NativeProof = { posts: number; cursors: Array<string | null>; blocked: number; drains: number;
  sentIds: number[]; receivedIds: number[]; violations: string[]; result?: string; closed?: boolean };

function observeResponse(res: ServerResponse, proof: NativeProof) {
  const write = res.write.bind(res);
  // Observe the native boolean and drain. Never replace either with modeled events.
  res.write = ((chunk: string) => {
    const ready = write(chunk);
    if (!ready) proof.blocked++;
    const id = /^id: (\d+)/.exec(chunk);
    if (id) proof.sentIds.push(Number(id[1]));
    return ready;
  }) as typeof res.write;
  res.on("drain", () => { proof.drains++; });
}

function nativeApp(proof: NativeProof) {
  const app = express();
  let initial: ServerResponse | undefined;
  app.use(express.json());
  app.get("/api/events", (req, res, next) => {
    proof.cursors.push(typeof req.query.lastEventId === "string" ? req.query.lastEventId : null);
    if (proof.cursors.length > 3) {
      proof.violations.push("reconnect made no progress"); res.sendStatus(409); return;
    }
    if (proof.cursors.length !== 1) { observeResponse(res, proof); next(); return; }
    initial = res;
    publish("native", "progress", { phase: "1" });
    res.setHeader("Content-Type", "text/event-stream"); res.flushHeaders();
    res.write('id: 1\nevent: progress\ndata: {"jobId":"native","phase":"1"}\n\n');
  });
  app.post("/api/mcp/generate", (req, res) => {
    proof.posts++;
    assert.equal(req.body.requestId, "native");
    for (let id = 2; id <= 4; id++) publish("native", "progress", { phase: String(id) });
    publish("native", "done", { filename: "owned.png", url: "/generated/owned.png", proofId: 5 });
    res.status(202).json({ requestId: "native" }); initial!.end();
  });
  registerEventsRoute(app, {} as RouteRuntimeContext);
  app.use((req, res) => { proof.violations.push(`${req.method} ${req.path}`); res.sendStatus(404); });
  return app;
}

test("native small-HWM replay makes public runMcpJob progress with exactly one POST", async () => {
  _resetForTest();
  const proof: NativeProof = { posts: 0, cursors: [], blocked: 0, drains: 0, sentIds: [], receivedIds: [], violations: [] };
  const server = createServer({ highWaterMark: 64 }, nativeApp(proof));
  const sockets = new Set<import("node:net").Socket>();
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  const originalFetch = globalThis.fetch;
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address(); assert.ok(address && typeof address !== "string");
    assert.notEqual(address.port, 3333);
    const origin = `http://127.0.0.1:${address.port}`;
    globalThis.fetch = (input, init) => {
      const url = new URL(String(input)); const method = init?.method ?? "GET";
      if (url.origin !== origin || !((url.pathname === "/api/events" && method === "GET") ||
        (url.pathname === "/api/mcp/generate" && method === "POST"))) {
        proof.violations.push(`${method} ${url.pathname}`); throw new Error("Unassigned native request");
      }
      return originalFetch(input, init);
    };
    const result = await runMcpJob({ serverBase: origin, kind: "image", body: {}, requestId: "native",
      timeoutMs: 2000, json: true, onProgress: phase => { proof.receivedIds.push(Number(phase)); } });
    proof.result = result.filename; proof.receivedIds.push(Number(result.meta.proofId));
    assert.equal(result.filename, "owned.png"); assert.equal(proof.posts, 1);
    assert.deepEqual(proof.cursors, [null, "1"]);
    assert.deepEqual(proof.sentIds, [2, 3, 4, 5]);
    assert.deepEqual(proof.receivedIds, [1, 2, 3, 4, 5]);
    assert.ok(proof.blocked > 0); assert.ok(proof.drains > 0); assert.deepEqual(proof.violations, []);
  } finally {
    globalThis.fetch = originalFetch;
    const closedSockets = [...sockets].map(socket => once(socket, "close"));
    const closed = once(server, "close"); server.close(); server.closeAllConnections();
    await closed; await Promise.all(closedSockets); proof.closed = sockets.size === 0 && !server.listening;
    assert.equal(proof.closed, true); _resetForTest();
    console.log("WP07 native transport proof", JSON.stringify(proof));
  }
});
