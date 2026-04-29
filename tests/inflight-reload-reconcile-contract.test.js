import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

test("store boot does not render persisted in-flight jobs before server reconcile", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(store, /activeGenerations:\s*0,/);
  assert.match(store, /inFlight:\s*\[\],/);
  assert.doesNotMatch(store, /activeGenerations:\s*loadInFlight\(\)\.length/);
  assert.doesNotMatch(store, /inFlight:\s*loadInFlight\(\),/);
});

test("first in-flight reconciliation still uses persisted local request IDs", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(
    store,
    /const currentLocal = get\(\)\.inFlight;\s*const local = currentLocal\.length > 0 \? currentLocal : loadInFlight\(\);/,
  );
});

test("app reconciles in-flight state on mount after reload", () => {
  const app = readSource("ui/src/App.tsx");

  assert.match(app, /reconcileInflight\(\);/);
  assert.match(app, /startInFlightPolling\(\);/);
});
