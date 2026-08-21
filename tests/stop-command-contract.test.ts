import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  escalateKill,
  gracefulStop,
  verifyServerIdentity,
  waitForExit,
  type AdvertiseEntry,
} from "../lib/processControl.js";

// devlog/_plan/260821_260821c-stop-service-commands/010: the stop sequence must
// never kill a pid the advertise file merely claims. Identity is verified
// against the live /api/health pid, and mismatches clean the stale file
// instead of signalling an innocent recycled pid (adversarial audit blocker).

function fakeFetch(response: { status?: number; ok?: boolean; json?: unknown }): typeof fetch {
  return (async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.json ?? {},
  })) as unknown as typeof fetch;
}

describe("verifyServerIdentity", () => {
  const entry: AdvertiseEntry = { pid: 4242, port: 3333 };

  test("matching health pid verifies", async () => {
    assert.equal(await verifyServerIdentity(entry, fakeFetch({ json: { pid: 4242 } })), "match");
  });

  test("a different pid answering there is a mismatch, never a kill target", async () => {
    assert.equal(await verifyServerIdentity(entry, fakeFetch({ json: { pid: 9999 } })), "mismatch");
  });

  test("unreachable server yields unreachable, not a guess", async () => {
    const failing = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    assert.equal(await verifyServerIdentity(entry, failing), "unreachable");
  });

  test("an entry without pid or url cannot be verified", async () => {
    assert.equal(await verifyServerIdentity({}, fakeFetch({ json: { pid: 1 } })), "unreachable");
  });
});

describe("gracefulStop", () => {
  test("202 from the admin API is the only success", async () => {
    const entry: AdvertiseEntry = { pid: 1, port: 3333, adminNonce: "n" };
    assert.equal(await gracefulStop(entry, fakeFetch({ status: 202 })), true);
    assert.equal(await gracefulStop(entry, fakeFetch({ status: 401 })), false);
    assert.equal(await gracefulStop(entry, fakeFetch({ status: 403 })), false);
  });

  test("without a nonce the graceful path is skipped entirely", async () => {
    let called = false;
    const spy = (async () => { called = true; return { status: 202 }; }) as unknown as typeof fetch;
    assert.equal(await gracefulStop({ pid: 1, port: 3333 }, spy), false);
    assert.equal(called, false);
  });
});

describe("escalateKill / waitForExit", () => {
  test("a dead pid reports already-dead without signalling", async () => {
    // pid 2^22-ish beyond typical ranges; if alive on this machine the test is
    // still safe because escalateKill only probes with signal 0 first.
    let target = 999999;
    while (isAlive(target) && target < 1000100) target++;
    assert.equal(await escalateKill(target), "already-dead");
  });

  test("waitForExit resolves fast for a dead pid", async () => {
    let target = 999999;
    while (isAlive(target) && target < 1000100) target++;
    const started = Date.now();
    assert.equal(await waitForExit(target, 2000), true);
    assert.ok(Date.now() - started < 500);
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
