import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";

type Channel = typeof import("../ui/src/lib/eventChannel.ts");
let moduleId = 0;

async function loadChannel(): Promise<Channel> {
  try {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("../ui/src/lib/eventChannel.ts", import.meta.url))],
      bundle: true, write: false, platform: "browser", format: "esm",
      define: { "import.meta.env": '{"DEV":true}', "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    return await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${moduleId++}`);
  } catch (error) {
    throw new Error(`Channel bundle failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    stop();
  }
}

// Models dispatch only. Native EventSource/browser proof belongs to hosted J7b.
class Source extends EventTarget {
  static OPEN = 1;
  static CLOSED = 2;
  static instances: Source[] = [];
  readyState = 0;
  closes = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) { super(); Source.instances.push(this); }
  close() { this.closes++; this.readyState = Source.CLOSED; }
  open() { this.readyState = Source.OPEN; this.onopen?.(new Event("open")); }
  emit(type: string, data?: string, id = "") {
    const ev = data === undefined ? new Event(type) : new MessageEvent(type, { data, lastEventId: id });
    this.dispatchEvent(ev);
    if (type === "error") this.onerror?.(ev);
  }
}

async function fixture(run: (channel: Channel, timers: Map<number, () => void>) => void): Promise<void> {
  const channel = await loadChannel();
  const originals = new Map(["EventSource", "setTimeout", "clearTimeout", "fetch"].map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
  ));
  const timers = new Map<number, () => void>();
  let timerId = 0, network = 0;
  Source.instances = [];
  Object.defineProperties(globalThis, {
    EventSource: { configurable: true, value: Source },
    setTimeout: { configurable: true, value: (fn: () => void) => { timers.set(++timerId, fn); return timerId; } },
    clearTimeout: { configurable: true, value: (id: number) => timers.delete(id) },
    fetch: { configurable: true, value: () => { network++; throw new Error("Unassigned channel request"); } },
  });
  try {
    run(channel, timers);
    assert.equal(network, 0);
  } catch (error) {
    // Avoid serializing data-URL source in a failure stack.
    throw new Error(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      channel.disconnect();
      assert.equal(timers.size, 0, "owned reconnect/deadline timers cleared");
    } finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  }
}

function reconnect(timers: Map<number, () => void>): Source {
  assert.equal(timers.size, 1);
  const [id, fn] = [...timers][0];
  timers.delete(id);
  fn();
  return Source.instances.at(-1)!;
}

test("gap is control: clears cursor, resyncs once, retains subscribers and accepts new IDs", async () => {
  await fixture((channel, timers) => {
    const jobs: string[] = [];
    let resyncs = 0;
    channel.onResync(() => { resyncs++; });
    channel.subscribe("a", null, event => jobs.push(event));
    channel.subscribe("b", "done", event => jobs.push(`b:${event}`));
    const first = Source.instances[0]; first.open();
    first.emit("phase", '{"jobId":"a"}', "99");
    first.emit("replay-gap", '{"lastEventId":99,"oldestAvailableId":null}');
    assert.equal(resyncs, 1);
    assert.deepEqual(jobs, ["phase"]);
    assert.equal(first.closes, 0);
    first.emit("error");
    const second = reconnect(timers);
    assert.equal(second.url, "/api/events"); second.open();
    assert.equal(resyncs, 2);
    second.emit("done", '{"jobId":"b"}', "2");
    assert.deepEqual(jobs, ["phase", "b:done"]);
    second.emit("error");
    assert.equal(reconnect(timers).url, "/api/events?lastEventId=2");
  });
});

test("application error MessageEvent delivers data without closing; transport errors reconnect once", async () => {
  await fixture((channel, timers) => {
    const delivered: string[] = [];
    channel.subscribe("a", null, event => delivered.push(event));
    const first = Source.instances[0]; first.open();
    first.emit("error", '{"jobId":"a","code":"JOB_TRACKING_TIMEOUT"}', "8");
    assert.deepEqual(delivered, ["error"]);
    assert.equal(first.closes, 0);
    assert.equal(timers.size, 0);
    first.emit("error"); first.emit("error");
    assert.equal(first.closes, 1);
    assert.deepEqual(delivered, ["error"]);
    assert.equal(reconnect(timers).url, "/api/events?lastEventId=8");
  });
});

test("stale open/data/gap/error callbacks cannot mutate or close the replacement source", async () => {
  await fixture((channel, timers) => {
    let delivered = 0, resyncs = 0;
    const states: string[] = [];
    channel.subscribe("a", null, () => { delivered++; });
    const old = Source.instances[0]; old.open();
    channel.disconnect();
    channel.onResync(() => { resyncs++; });
    channel.onConnectionStateChange(state => states.push(state));
    channel.subscribe("a", null, () => { delivered++; });
    const current = Source.instances[1]; current.open();
    current.emit("phase", '{"requestId":"a"}', "4");
    old.open(); old.emit("phase", '{"jobId":"a"}', "88");
    old.emit("replay-gap", '{}'); old.emit("error");
    assert.equal(delivered, 1); assert.equal(resyncs, 0);
    assert.deepEqual(states, ["connected"]);
    assert.equal(timers.size, 0); assert.equal(current.closes, 0);
    current.emit("error");
    assert.equal(reconnect(timers).url, "/api/events?lastEventId=4");
  });
});

test("wire JSON rejects null/array/primitives and invalid IDs without throwing or delivering", async t => {
  t.mock.method(console, "warn", () => {});
  await fixture(channel => {
    let delivered = 0;
    channel.subscribe("a", null, () => { delivered++; });
    const current = Source.instances[0]; current.open();
    for (const raw of ["{", "null", "[]", "1", '"a"', "false", "{}", '{"jobId":1}', '{"requestId":[]}', '{"jobId":""}']) {
      assert.doesNotThrow(() => current.emit("phase", raw));
    }
    current.emit("phase");
    assert.equal(delivered, 0);
    current.emit("phase", '{"jobId":"a"}');
    current.emit("done", '{"requestId":"a"}');
    assert.equal(delivered, 2);
  });
});

test("manual reconnect cancels queued reconnect; unsubscribe and stream timeout retain public behavior", async () => {
  await fixture((channel, timers) => {
    let delivered = 0;
    const off = channel.subscribe("a", "done", () => { delivered++; });
    Source.instances[0].open(); Source.instances[0].emit("error");
    channel.ensureConnected();
    assert.equal(timers.size, 0);
    const current = Source.instances[1]; current.open();
    current.emit("phase", '{"jobId":"a"}');
    off(); current.emit("done", '{"jobId":"a"}');
    assert.equal(delivered, 0);
    const disarm = channel.armStreamTimeout(() => { delivered++; });
    assert.equal(timers.size, 1); disarm();
    assert.equal(timers.size, 0);
  });
});

test("disconnect inside a connection-state callback cannot leave an orphan reconnect timer", async () => {
  await fixture((channel, timers) => {
    channel.subscribe("a", null, () => {});
    channel.onConnectionStateChange(state => { if (state === "reconnecting") channel.disconnect(); });
    Source.instances[0].open(); Source.instances[0].emit("error");
    assert.equal(timers.size, 0);
    assert.equal(Source.instances[0].closes, 1);
  });
});
