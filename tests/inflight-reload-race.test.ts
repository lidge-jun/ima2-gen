import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withJobTrackingUi, loadJobTrackingUiRuntime } from "./_jobTrackingUiFixture.ts";

test("real store boot hides persisted spinners until reconciliation, then restores the server job", async () => {
  await withJobTrackingUi(async (f) => {
    f.runtime.saveInFlight([{ id: "persisted", kind: "classic", prompt: "local", startedAt: 1 }]);
    const runtime = await loadJobTrackingUiRuntime();
    assert.equal(runtime.useAppStore.getState().activeGenerations, 0);
    assert.deepEqual(runtime.useAppStore.getState().inFlight, []);
    runtime.useAppStore.setState({ uiMode: "classic", activeSessionId: null });
    const held = f.defer<Response>();
    f.route("GET", "/api/inflight", () => held.promise.then((response) => response.clone()));
    const work = f.track(runtime.useAppStore.getState().reconcileInflight());
    assert.deepEqual(runtime.useAppStore.getState().inFlight, []);
    held.resolve(Response.json({ jobs: [{ requestId: "persisted", kind: "classic", prompt: "server",
      startedAt: 1234, phase: "streaming" }], terminalJobs: [] }));
    await work;
    assert.deepEqual(runtime.useAppStore.getState().inFlight.map((job) => job.id), ["persisted"]);
    assert.equal(runtime.useAppStore.getState().activeGenerations, 1);
    assert.equal(runtime.useAppStore.getState().inFlight[0].prompt, "local");
    assert.equal(f.requests.every((request) => request.method === "GET"), true);
    runtime.disconnect();
  });
});

test("polling preserves its 1500ms interval and stops after two idle ticks without inflight fetches", async () => {
  await withJobTrackingUi(async (f) => {
    f.route("GET", "/api/history", () => Response.json({ items: [] }));
    f.runtime.useAppStore.getState().startInFlightPolling();
    f.runtime.useAppStore.getState().startInFlightPolling();
    assert.equal(f.timers.size, 1);
    const [id, timer] = [...f.timers][0];
    assert.equal(timer.kind, "interval"); assert.equal(timer.delay, 1500);
    await f.runTimer(id); assert.equal(f.timers.has(id), true);
    await f.runTimer(id); assert.equal(f.timers.has(id), false);
    assert.equal(f.requests.length, 2);
    assert.ok(f.requests.every((request) => new URL(request.url).pathname === "/api/history"));
  });
});

test("App retains its mount-time reconcile action and dependency wiring", () => {
  const app = readFileSync(new URL("../ui/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /reconcileInflight\(\);/);
  assert.match(app, /\[[^\]]*reconcileInflight[^\]]*\]/);
  assert.match(app, /startInFlightPolling\(\);/);
});
