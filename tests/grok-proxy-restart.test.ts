// The launcher used to retry a dead progrok every 2s forever, flooding the log on a broken
// binary or a permanently occupied port. These lock the bounded backoff.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { restartPlan, startGrokProxy } from "../lib/grokProxyLauncher.js";

const OPTS = { baseMs: 2_000, maxMs: 60_000, maxAttempts: 6 };

describe("grok proxy restart policy", () => {
  it("backs off exponentially instead of hammering every 2s", () => {
    const delays = [0, 1, 2, 3, 4, 5].map((n) => restartPlan(n, OPTS).delayMs);
    assert.deepEqual(delays, [2_000, 4_000, 8_000, 16_000, 32_000, 60_000]);
  });

  it("clamps the delay at the configured maximum", () => {
    // 2000 * 2^5 = 64000, which must clamp rather than keep doubling.
    assert.equal(restartPlan(5, OPTS).delayMs, 60_000);
  });

  it("gives up instead of restarting forever", () => {
    assert.equal(restartPlan(5, OPTS).giveUp, false);
    assert.equal(restartPlan(6, OPTS).giveUp, true);
    assert.equal(restartPlan(99, OPTS).giveUp, true);
  });

  it("respects a custom budget", () => {
    const tight = { baseMs: 1_000, maxMs: 4_000, maxAttempts: 2 };
    assert.deepEqual(restartPlan(0, tight), { delayMs: 1_000, giveUp: false });
    assert.deepEqual(restartPlan(1, tight), { delayMs: 2_000, giveUp: false });
    assert.equal(restartPlan(2, tight).giveUp, true);
  });
});

describe("grok proxy spawn failure", () => {
  it("retries a missing binary and stops at the budget", async () => {
    // An unlaunchable binary emits `error` and never `exit`, so this path proves the
    // restart actually arms from the error handler rather than only from a clean exit.
    const exits: Array<number | null> = [];
    const proxy = await startGrokProxy({
      progrokBinPath: "/nonexistent/ima2-test-progrok",
      restartDelayMs: 5,
      restartMaxDelayMs: 10,
      restartMaxAttempts: 2,
      restartHealthyMs: 60_000,
      onExit: (info) => { exits.push(info.code); },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    proxy.stop();
    // 1 initial spawn + 2 bounded restarts, then the launcher gives up.
    assert.ok(exits.length >= 2, `expected the error path to schedule restarts, saw ${exits.length}`);
    assert.ok(exits.length <= 3, `restarts must stay bounded, saw ${exits.length}`);
  });
});
