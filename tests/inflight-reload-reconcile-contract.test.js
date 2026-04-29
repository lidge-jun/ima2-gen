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

test("polling restores server-only active jobs after terminal cleanup", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(store, /const nextIds = new Set\(nextInflight\.map\(\(f\) => f\.id\)\);/);
  assert.match(
    store,
    /for \(const j of jobs\) \{\s*if \(!nextIds\.has\(j\.requestId\)\) \{\s*nextInflight\.push\(toPersistedInFlightJob\(j\)\);\s*changed = true;/,
  );
});

test("polling TTL prune keeps server-active jobs even after local TTL expires", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(store, /let scopedActiveServerIds = new Set<string>\(\);/);
  assert.match(store, /scopedActiveServerIds = new Set\(jobs\.map\(\(j\) => j\.requestId\)\);/);
  assert.match(
    store,
    /\(f\) => scopedActiveServerIds\.has\(f\.id\) \|\| now - f\.startedAt < INFLIGHT_TTL_MS/,
  );
});

test("app reconciles in-flight state on mount after reload", () => {
  const app = readSource("ui/src/App.tsx");

  assert.match(app, /reconcileInflight\(\);/);
  assert.match(app, /startInFlightPolling\(\);/);
});
