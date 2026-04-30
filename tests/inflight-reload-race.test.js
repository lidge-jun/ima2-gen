// Source-level contract test for the in-flight reload race regression.
// Asserts the store does not render persisted spinners before reconcile,
// and that reconcile / mount-time wiring stays intact.
//
// See: devlog/_plan/260429_issue47-inflight-reload-reconcile/README.md

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readSource = (path) => readFileSync(join(root, path), "utf8");

test("store does not initialize activeGenerations from loadInFlight().length", () => {
  const store = readSource("ui/src/store/useAppStore.ts");
  assert.doesNotMatch(
    store,
    /activeGenerations:\s*loadInFlight\(\)\.length/,
    "activeGenerations must boot at 0 to avoid stale spinner flash on reload",
  );
  assert.match(store, /activeGenerations:\s*0,/);
});

test("store does not initialize inFlight from loadInFlight() directly", () => {
  const store = readSource("ui/src/store/useAppStore.ts");
  assert.doesNotMatch(
    store,
    /inFlight:\s*loadInFlight\(\),/,
    "inFlight must boot as [] so InFlightList does not render before /api/inflight reconcile",
  );
  assert.match(store, /inFlight:\s*\[\],/);
});

test("reconcileInflight exists and uses loadInFlight() as a snapshot", () => {
  const store = readSource("ui/src/store/useAppStore.ts");
  assert.match(store, /reconcileInflight:\s*async\s*\(\)\s*=>/);
  // Snapshot pattern: take current store state if non-empty, else fall back
  // to localStorage. This preserves out-of-scope persisted ids on first pass.
  assert.match(
    store,
    /const currentLocal = get\(\)\.inFlight;\s*const local = currentLocal\.length > 0 \? currentLocal : loadInFlight\(\);/,
  );
});

test("App.tsx still calls reconcileInflight() on mount", () => {
  const app = readSource("ui/src/App.tsx");
  assert.match(app, /reconcileInflight\(\);/);
  // The mount effect must list reconcileInflight in its dep array so it runs
  // exactly once on (re)load.
  assert.match(
    app,
    /\[[^\]]*reconcileInflight[^\]]*\]/,
    "reconcileInflight must be in the mount-effect dependency array",
  );
});

test("polling backs off when no local jobs and no active generations", () => {
  const store = readSource("ui/src/store/useAppStore.ts");
  // Idle-tab guard: skip polling tick when both inFlight is empty and the
  // activeGenerations counter is zero. Keeps CPU low on idle reloads.
  assert.match(
    store,
    /cur\.length === 0 && get\(\)\.activeGenerations === 0/,
  );
});
