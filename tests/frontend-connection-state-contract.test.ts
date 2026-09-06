import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withJobTrackingUi } from "./_jobTrackingUiFixture.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("eventChannel exports onConnectionStateChange and ConnectionState type", () => {
  const src = read("ui/src/lib/eventChannel.ts");
  assert.match(src, /export type ConnectionState/);
  assert.match(src, /export function onConnectionStateChange/);
  assert.match(src, /"connected"\s*\|\s*"reconnecting"\s*\|\s*"failed"/);
});

test("eventChannel fires connected state on successful open", () => withJobTrackingUi(async (f) => {
  const states: string[] = [];
  f.runtime.onConnectionStateChange(state => states.push(state));
  f.runtime.ensureConnected();
  assert.deepEqual(states, []);
  f.openStream();
  assert.deepEqual(states, ["connected"]);
}));

test("eventChannel fires failed state after threshold reconnect attempts", () => {
  const src = read("ui/src/lib/eventChannel.ts");
  assert.match(src, /FAILED_THRESHOLD/);
  assert.match(src, /reconnectAttempt >= FAILED_THRESHOLD \? "failed" : "reconnecting"/);
});

test("eventChannel disconnect resets connectionStateCallback", () => {
  const src = read("ui/src/lib/eventChannel.ts");
  const disconnectBlock = src.slice(src.indexOf("export function disconnect"));
  assert.match(disconnectBlock, /connectionStateCallback\s*=\s*null/);
});

test("App registers onConnectionStateChange callback", () => {
  const app = read("ui/src/App.tsx");
  assert.match(app, /onConnectionStateChange/);
  assert.match(app, /state === "failed"/);
});

test("storeInflightImpl logs errors in dev mode instead of silent catch", () => {
  const src = read("ui/src/store/storeInflightImpl.ts");
  const catches = [...src.matchAll(/catch\s*\{[\s\S]*?\}/g)];
  for (const m of catches) {
    assert.ok(!m[0].match(/catch\s*\{\s*\}/), "empty catch {} found — must log in dev mode");
  }
  assert.match(src, /console\.warn\(\s*"\[inflight\] polling failed/);
  assert.match(src, /console\.warn\(\s*"\[inflight\] reconcile failed/);
});

test("multimode partial writeSse checks res.writableEnded before write", () => {
  const src = (read("routes/multimode.ts") + read("lib/multimodePipeline.ts"));
  const partialBlock = src.slice(src.indexOf("onPartialImage"));
  assert.match(partialBlock, /res\.writableEnded/);
  assert.match(partialBlock, /res\.destroyed/);
});
