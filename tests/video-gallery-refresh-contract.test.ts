import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(root, p), "utf8");

// Issue #93: Video generation completes but gallery doesn't update without F5.
// These source contracts verify the architectural fix is in place.

test("#93 contract: runVideoGenerateImpl calls addHistory after video completes", () => {
  const src = read("ui/src/store/storeVideoImpl.ts");
  assert.ok(
    src.includes('import { addHistory } from "./storeGraphSave"'),
    "storeVideoImpl must import addHistory from storeGraphSave",
  );
  assert.ok(
    /await addHistory\(videoItem, set, get(?:, \{ autoSelectStartedAt \})?\)/.test(src),
    "video generation must call addHistory to update gallery directly",
  );
});

test("#93 contract: animateImageImpl captures postVideoGenerateStream result", () => {
  const src = read("ui/src/store/storeVideoImpl.ts");
  assert.ok(
    src.includes("const result = await postVideoGenerateStream"),
    "animateImageImpl must capture the result of postVideoGenerateStream",
  );
});

test("#93 contract: VideoGenerateDone has fields required by addHistory", () => {
  const src = read("ui/src/lib/api-generation.ts");
  const typeBlock = src.slice(
    src.indexOf("export type VideoGenerateDone"),
    src.indexOf("}", src.indexOf("export type VideoGenerateDone")) + 1,
  );
  for (const field of ["filename", "url", "requestId", "mediaType"]) {
    assert.ok(
      typeBlock.includes(`${field}:`),
      `VideoGenerateDone must include ${field} field`,
    );
  }
});

test("#93 contract: inflight polling uses grace-tick before clearing interval", () => {
  const src = read("ui/src/store/storeInflightImpl.ts");
  assert.ok(
    src.includes("__ima2StopTicks"),
    "polling must track consecutive stop ticks for grace-tick mechanism",
  );
  assert.ok(
    src.includes("(w.__ima2StopTicks ?? 0) >= 2"),
    "polling must require at least 2 consecutive stop ticks before clearing interval",
  );
});
