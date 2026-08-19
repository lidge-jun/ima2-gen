import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvertisePayload } from "../server.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

function ctxWith(overrides: Record<string, unknown>) {
  const ctx = createTestRuntimeContext() as unknown as Record<string, unknown>;
  ctx.serverActualPort = 3981;
  ctx.serverConfiguredPort = 3981;
  ctx.serverUrl = "http://127.0.0.1:3981";
  ctx.grokPort = 18645;
  ctx.grokActualPort = 18646;
  ctx.grokUrl = "http://127.0.0.1:18646/v1";
  Object.assign(ctx, overrides);
  return ctx as never;
}

test("a dead grok proxy is never advertised as a reachable endpoint", () => {
  const payload = buildAdvertisePayload(ctxWith({ grokProxyLive: false }));
  // Publishing a port for a child that already exited is a claim the file
  // cannot back up — that is exactly how ~/.ima2/server.json went stale.
  assert.equal(payload.grok.actualPort, null);
  assert.equal(payload.grok.url, null);
  assert.equal(payload.grok.live, false);
  // configuredPort stays: it is intent, not a liveness claim, and aids diagnosis.
  assert.equal(payload.grok.configuredPort, 18645);
});

test("an unknown liveness state is treated as dead, not as live", () => {
  const payload = buildAdvertisePayload(ctxWith({}));
  assert.equal(payload.grok.live, false);
  assert.equal(payload.grok.url, null);
});

test("a listening grok proxy advertises its real port", () => {
  const payload = buildAdvertisePayload(ctxWith({ grokProxyLive: true }));
  assert.equal(payload.grok.live, true);
  assert.equal(payload.grok.actualPort, 18646);
  assert.equal(payload.grok.url, "http://127.0.0.1:18646/v1");
});

test("grok liveness does not disturb the backend advertise contract", () => {
  const dead = buildAdvertisePayload(ctxWith({ grokProxyLive: false }));
  const live = buildAdvertisePayload(ctxWith({ grokProxyLive: true }));
  for (const p of [dead, live]) {
    assert.equal(p.backend.actualPort, 3981);
    assert.equal(p.backend.url, "http://127.0.0.1:3981");
    assert.equal(p.port, 3981);
  }
});

