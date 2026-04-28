import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const store = readFileSync(join(root, "ui/src/store/useAppStore.ts"), "utf8");
const canvas = readFileSync(join(root, "ui/src/components/Canvas.tsx"), "utf8");
const preview = readFileSync(join(root, "ui/src/components/MultimodeSequencePreview.tsx"), "utf8");

test("multimode store no longer carries a single-slot lock", () => {
  assert.doesNotMatch(
    store,
    /if \(s\.multimodeAbortController\)\s*return;/,
    "single-slot lock should be removed",
  );
});

test("multimode store declares plural controllers/sequences with a preview pointer", () => {
  assert.match(store, /multimodeSequences:\s*Record<string,\s*MultimodeSequenceState>/);
  assert.match(store, /multimodeAbortControllers:\s*Record<string,\s*AbortController>/);
  assert.match(store, /multimodePreviewFlightId:\s*string\s*\|\s*null/);
});

test("Canvas and preview component select sequence via multimodePreviewFlightId", () => {
  assert.match(canvas, /multimodePreviewFlightId/);
  assert.match(preview, /multimodePreviewFlightId/);
});

test("cancelMultimode targets the currently previewed flightId", () => {
  const cancelBlock = store.split(/cancelMultimode:\s*\(\)\s*=>\s*\{/)[1] ?? "";
  assert.match(cancelBlock, /multimodePreviewFlightId/);
  assert.match(cancelBlock, /multimodeAbortControllers\[[^\]]+\]\?\.abort\(\)/);
});

test("generateMultimode preserves preview pointer on clean finish", () => {
  const generateMultimodeBody = store.split(/async generateMultimode\(/)[1] ?? "";
  assert.match(generateMultimodeBody, /isCleanFinish/);
  assert.match(generateMultimodeBody, /multimodeAbortControllers/);
  assert.match(generateMultimodeBody, /multimodePreviewFlightId:\s*nextPreview/);
});
