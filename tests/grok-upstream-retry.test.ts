// Retry activation is proven by call counts, not by an aggregate "it worked": each case
// asserts how many times the replayable fetch actually ran.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import type { RetryResponse } from "../lib/grokUpstreamRetry.js";
import {
  grokFetchWithRetry,
  isConnectionResetError,
  isTransientUpstreamStatus,
  retryBackoffDelayMs,
} from "../lib/grokUpstreamRetry.js";

function resetError(code: string): Error {
  const err = new Error("socket hang up") as Error & { code?: string };
  err.code = code;
  return err;
}

describe("grok upstream retry classification", () => {
  it("retries socket resets but never aborts or timeouts", () => {
    assert.equal(isConnectionResetError(resetError("ECONNRESET")), true);
    assert.equal(isConnectionResetError(resetError("EPIPE")), true);
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    assert.equal(isConnectionResetError(aborted), false);
    const timedOut = new Error("timed out");
    timedOut.name = "TimeoutError";
    assert.equal(isConnectionResetError(timedOut), false);
  });

  it("sees a reset reported through error.cause", () => {
    const wrapped = new Error("fetch failed", { cause: resetError("ECONNRESET") });
    assert.equal(isConnectionResetError(wrapped), true);
  });

  it("treats gateway classes as transient and leaves 4xx alone", () => {
    for (const status of [500, 502, 503, 504, 520, 521, 522]) {
      assert.equal(isTransientUpstreamStatus(status), true, `${status} must be transient`);
    }
    // 429 has its own rate-limit semantics; 507 is storage-class, not gateway-transient.
    for (const status of [200, 400, 401, 404, 429, 507]) {
      assert.equal(isTransientUpstreamStatus(status), false, `${status} must not be transient`);
    }
  });

  it("honors Retry-After over exponential backoff, capped at the max", () => {
    const headers = new Headers({ "retry-after": "2" });
    assert.equal(retryBackoffDelayMs(0, { baseDelayMs: 400, maxDelayMs: 5_000, headers }), 2_000);
    const capped = new Headers({ "retry-after": "600" });
    assert.equal(retryBackoffDelayMs(0, { baseDelayMs: 400, maxDelayMs: 5_000, headers: capped }), 5_000);
  });

  it("keeps jittered backoff inside its own bounds", () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delay = retryBackoffDelayMs(attempt, { baseDelayMs: 400, maxDelayMs: 5_000 });
      assert.ok(delay >= 0 && delay <= 5_000, `attempt ${attempt} produced ${delay}`);
    }
  });
});

describe("grokFetchWithRetry", () => {
  it("infers native Response methods and preserves the exact native object", async () => {
    const native = new Response('{"native":true}', { headers: { "content-type": "application/json" } });
    const result = await grokFetchWithRetry(async () => native);
    const text: Promise<string> = result.clone().text();
    const json: Promise<unknown> = result.json();
    assert.equal(result, native);
    assert.equal(await text, '{"native":true}');
    assert.deepEqual(await json, { native: true });
  });

  for (const cleanup of ["resolve", "reject", "never", "throw"] as const) {
    it(`structural subtype: ${cleanup} cleanup precedes retry without delaying Retry-After`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
      const order: string[] = [];
      let calls = 0;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const controller = new AbortController();
      const success = { ok: true, status: 200, headers: new Headers(), body: null, marker: "structural-native" as const } satisfies RetryResponse & { marker: string };
      const transient = { ...success, ok: false, status: 503, headers: new Headers({ "retry-after": "2" }),
        body: { cancel(): Promise<void> {
          order.push("cancel");
          if (cleanup === "throw") throw new Error("advisory cleanup");
          if (cleanup === "reject") return Promise.reject(new Error("advisory cleanup"));
          return cleanup === "never" ? held : Promise.resolve();
        } },
      };
      const work = grokFetchWithRetry(async () => {
        order.push(`fetch${++calls}`);
        return calls === 1 ? transient : success;
      }, { signal: controller.signal });
      try {
        await setImmediate();
        assert.deepEqual(order, ["fetch1", "cancel"]);
        t.mock.timers.tick(1_999);
        await setImmediate();
        assert.equal(calls, 1);
        t.mock.timers.tick(1);
        const result = await work;
        const marker: "structural-native" = result.marker;
        assert.equal(result, success);
        assert.equal(marker, "structural-native");
        assert.equal(Date.now(), 2_000);
        assert.deepEqual(order, ["fetch1", "cancel", "fetch2"]);
      } finally {
        controller.abort(); release();
        await Promise.allSettled([work]);
        t.mock.timers.reset();
      }
    });
  }

  it("abort during structural retry delay prevents another fetch even with pending cleanup", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const controller = new AbortController();
    const reason = new Error("owned retry abort");
    let calls = 0;
    let cancels = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const work = grokFetchWithRetry(async () => {
      calls++;
      return { ok: false, status: 503, headers: new Headers({ "retry-after": "2" }),
        body: { cancel() { cancels++; return held; } } };
    }, { signal: controller.signal });
    const rejected = assert.rejects(work, (error) => error === reason);
    try {
      await setImmediate();
      assert.equal(cancels, 1);
      controller.abort(reason);
      await rejected;
      t.mock.timers.tick(10_000);
      await setImmediate();
      assert.equal(calls, 1);
      assert.equal(cancels, 1);
    } finally {
      controller.abort(reason); release();
      await Promise.allSettled([work, rejected]);
      t.mock.timers.reset();
    }
  });

  it("structural transient exhaustion returns the third object and cancels only discarded attempts", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const order: string[] = [];
    const controller = new AbortController();
    let calls = 0;
    const responses = [1, 2, 3].map((id) => ({
      ok: false, status: 503, headers: new Headers({ "retry-after": "2" }), marker: id,
      body: { cancel() { order.push(`cancel${id}`); return Promise.resolve(); } },
    }));
    const work = grokFetchWithRetry(async () => {
      order.push(`fetch${++calls}`);
      return responses[calls - 1]!;
    }, { attempts: 3, signal: controller.signal });
    try {
      await setImmediate(); t.mock.timers.tick(2_000);
      await setImmediate(); t.mock.timers.tick(2_000);
      const result = await work;
      assert.equal(result, responses[2]);
      assert.equal(result.marker, 3);
      assert.deepEqual(order, ["fetch1", "cancel1", "fetch2", "cancel2", "fetch3"]);
    } finally {
      controller.abort(); await Promise.allSettled([work]); t.mock.timers.reset();
    }
  });

  it("replays a reset and returns the eventual success", async () => {
    let calls = 0;
    const res = await grokFetchWithRetry(async () => {
      calls += 1;
      if (calls === 1) throw resetError("ECONNRESET");
      return new Response("ok", { status: 200 });
    });
    assert.equal(calls, 2);
    assert.equal(res.status, 200);
  });

  it("replays a transient 502 and returns the eventual success", async () => {
    let calls = 0;
    const res = await grokFetchWithRetry(async () => {
      calls += 1;
      return calls === 1 ? new Response("bad gateway", { status: 502 }) : new Response("ok", { status: 200 });
    });
    assert.equal(calls, 2);
    assert.equal(res.status, 200);
  });

  it("does not replay a 400", async () => {
    let calls = 0;
    const res = await grokFetchWithRetry(async () => {
      calls += 1;
      return new Response("nope", { status: 400 });
    });
    assert.equal(calls, 1);
    assert.equal(res.status, 400);
  });

  it("never issues a request once the caller has aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(() => grokFetchWithRetry(async () => {
      calls += 1;
      return new Response("ok");
    }, { signal: controller.signal }));
    assert.equal(calls, 0);
  });

  it("propagates a timeout instead of retrying it", async () => {
    let calls = 0;
    await assert.rejects(() => grokFetchWithRetry(async () => {
      calls += 1;
      const err = new Error("timed out");
      err.name = "TimeoutError";
      throw err;
    }), /timed out/);
    assert.equal(calls, 1);
  });

  it("gives up after the attempt budget instead of hammering upstream", async () => {
    let calls = 0;
    const res = await grokFetchWithRetry(async () => {
      calls += 1;
      return new Response("down", { status: 503 });
    }, { attempts: 3 });
    assert.equal(calls, 3);
    assert.equal(res.status, 503);
  });
});
