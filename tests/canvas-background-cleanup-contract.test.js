import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const backgroundRemoval = readFileSync(join(root, "ui/src/lib/canvas/backgroundRemoval.ts"), "utf8");
const canvas = readFileSync(join(root, "ui/src/components/Canvas.tsx"), "utf8");
const toolbar = readFileSync(join(root, "ui/src/components/canvas-mode/CanvasToolbar.tsx"), "utf8");
const panel = readFileSync(
  join(root, "ui/src/components/canvas-mode/CanvasBackgroundCleanupPanel.tsx"),
  "utf8",
);
const main = readFileSync(join(root, "ui/src/main.tsx"), "utf8");
const css = readFileSync(join(root, "ui/src/styles/canvas-background-cleanup.css"), "utf8");
const en = JSON.parse(readFileSync(join(root, "ui/src/i18n/en.json"), "utf8"));
const ko = JSON.parse(readFileSync(join(root, "ui/src/i18n/ko.json"), "utf8"));

function extractBackgroundPickBranch() {
  const match = canvas.match(/if \(isBackgroundCleanupPickingSeed\) \{[\s\S]*?return;\n    \}/);
  assert.ok(match, "Canvas should keep an explicit background-pick pointer branch");
  return match[0];
}

test("background cleanup uses contiguous flood fill from seed pixels", () => {
  assert.match(backgroundRemoval, /removeContiguousBackground/);
  assert.match(backgroundRemoval, /getCornerBackgroundRemovalSeeds/);
  assert.match(backgroundRemoval, /sampleSeedColors/);
  assert.match(backgroundRemoval, /pushIfCandidate/);
  assert.match(backgroundRemoval, /Int32Array\(totalPixels\)/);
  assert.match(backgroundRemoval, /Uint8Array\(totalPixels\)/);
  assert.match(backgroundRemoval, /index - 1/);
  assert.match(backgroundRemoval, /index \+ 1/);
  assert.match(backgroundRemoval, /index - width/);
  assert.match(backgroundRemoval, /index \+ width/);
});

test("background cleanup preserves foreground pixels and emits transparent PNG preview", () => {
  assert.match(backgroundRemoval, /const output = new Uint8ClampedArray\(data\)/);
  assert.match(backgroundRemoval, /output\[offset \+ 3\] = 0/);
  assert.match(backgroundRemoval, /canvas\.toBlob/);
  assert.match(backgroundRemoval, /"image\/png"/);
  assert.match(backgroundRemoval, /blobToDataUrl/);
  assert.match(backgroundRemoval, /renderBackgroundRemovalMaskOverlay/);
  assert.match(backgroundRemoval, /overlay\.data\[offset\] = 168/);
  assert.match(backgroundRemoval, /overlay\.data\[offset \+ 3\] = 150/);
});

test("Canvas wires cleanup preview, seed picking, and apply-as-new-version", () => {
  assert.match(canvas, /backgroundCleanupSeeds/);
  assert.match(canvas, /backgroundCleanupTolerance/);
  assert.match(canvas, /backgroundCleanupPreview/);
  assert.match(canvas, /backgroundCleanupMaskOverlay/);
  assert.match(canvas, /backgroundCleanupUndoRef/);
  assert.match(canvas, /pushBackgroundCleanupUndo/);
  assert.match(canvas, /undoBackgroundCleanup/);
  assert.match(canvas, /isBackgroundCleanupPickingSeed/);
  assert.match(canvas, /renderBackgroundRemovalPreview/);
  assert.match(canvas, /renderBackgroundRemovalMaskOverlay/);
  assert.match(canvas, /imageSrc = backgroundCleanupPreview\?\.dataUrl \?\? baseImageSrc/);
  assert.match(canvas, /canvas-background-cleanup-mask/);
  assert.doesNotMatch(canvas, /canvas-background-cleanup-seed/);
  assert.match(canvas, /canvas-annotation-frame--cleanup-picking/);
  assert.match(canvas, /undoBackgroundCleanup\(\)/);
  assert.match(canvas, /handleBackgroundCleanupApply/);
  assert.match(canvas, /createCanvasVersion\(\{/);
  assert.match(canvas, /attachCanvasVersionReference\(savedItem\)/);
});

test("Background pick mode keeps its cursor active after a click", () => {
  const pickBranch = extractBackgroundPickBranch();
  assert.match(pickBranch, /setBackgroundCleanupSeeds\(nextSeeds\)/);
  assert.match(pickBranch, /void runBackgroundCleanupMaskOverlay\(nextSeeds\)/);
  assert.doesNotMatch(pickBranch, /setIsBackgroundCleanupPickingSeed\(false\)/);
});

test("Toolbar exposes a dedicated cleanup panel without provider coupling", () => {
  assert.match(toolbar, /CanvasBackgroundCleanupPanel/);
  assert.match(toolbar, /onCleanupAutoSample/);
  assert.match(toolbar, /onCleanupPickSeed/);
  assert.match(toolbar, /onCleanupPreview/);
  assert.match(toolbar, /onCleanupApply/);
  assert.match(panel, /type="range"/);
  assert.match(panel, /keepOpen/);
  assert.match(panel, /cleanupPickHint/);
  assert.match(panel, /cleanupMaskHint/);
  assert.match(panel, /cleanupTolerance/);
  assert.match(panel, /cleanupSeedCount/);
  assert.doesNotMatch(backgroundRemoval + toolbar + panel, /remove\.bg|SAM3|Roboflow|provider/i);
});

test("Cleanup styles and locale keys are present", () => {
  assert.match(main, /canvas-background-cleanup\.css/);
  assert.match(css, /\.canvas-toolbar__cleanup-panel/);
  assert.match(css, /\.canvas-background-cleanup-mask/);
  assert.doesNotMatch(css, /\.canvas-background-cleanup-seed/);
  assert.match(css, /cursor:\s*crosshair !important/);
  assert.doesNotMatch(css, /cursor:\s*cell !important/);
  assert.match(css, /\.canvas-annotation-frame--cleanup-picking/);
  assert.match(css, /\.canvas-toolbar__cleanup-slider/);
  for (const locale of [en, ko]) {
    assert.equal(typeof locale.canvas.toolbar.cleanup, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupTolerance, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupAutoSample, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupPickSeed, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupPreview, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupApply, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupPickHint, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupMaskHint, "string");
    assert.equal(typeof locale.canvas.toolbar.cleanupFailed, "string");
  }
});
