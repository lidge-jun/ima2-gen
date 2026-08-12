// Retry activation is proven by call counts, not by an aggregate "it worked": each case
// asserts how many times the replayable fetch actually ran.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
