import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const exportMenu = readFileSync("ui/src/components/canvas-mode/CanvasExportMenu.tsx", "utf8");
const exportRenderer = readFileSync("ui/src/lib/canvas/exportRenderer.ts", "utf8");
const session = readFileSync("ui/src/components/canvas-mode/useCanvasModeSession.ts", "utf8");
const canvas = readFileSync("ui/src/components/Canvas.tsx", "utf8");
const toolbar = readFileSync("ui/src/components/canvas-mode/CanvasToolbar.tsx", "utf8");
const resultActions = readFileSync("ui/src/components/ResultActions.tsx", "utf8");
const en = readFileSync("ui/src/i18n/en.json", "utf8");
const ko = readFileSync("ui/src/i18n/ko.json", "utf8");

test("Canvas export menu keeps immediate formats separate from vector tracing", () => {
  const actionIds = [...exportMenu.matchAll(/\{ id: "([^"]+)", kind: "(?:export|trace)" \}/g)]
    .map((match) => match[1]);
  assert.deepEqual(actionIds, ["png", "svg", "vector", "pptx"]);
  assert.match(exportMenu, /onTrace: \(\) => void/);
  assert.match(exportMenu, /if \(action\.kind === "trace"\) onTrace\(\)/);
  assert.match(exportMenu, /else onExport\(action\.id\)/);
});

test("Canvas tracing reuses the PNG renderer and stages a real Canvas version", () => {
  assert.match(exportRenderer, /export async function exportCanvasImage/);
  const imageExport = exportRenderer.slice(exportRenderer.indexOf("export async function exportCanvasImage"));
  assert.match(imageExport.slice(0, imageExport.indexOf("\n}")), /return merged\.blob/);

  const trace = session.slice(session.indexOf("const handleTraceCanvas"));
  assert.match(trace, /exportCanvasImage\(\{/);
  assert.match(trace, /createCanvasVersion\(\{[\s\S]*?image: blob/);
  assert.match(trace, /setVectorizeTarget\(target\)/);
});

test("Canvas mode mounts the shared vectorize panel", () => {
  const canvasModeBranch = canvas.slice(canvas.indexOf("if (canvasOpen && currentImage)"));
  assert.match(canvasModeBranch.slice(0, canvasModeBranch.indexOf("const displayQuality")), /<VectorizePanel \/>/);
});

test("image-only Canvas can export while Apply and Clear stay annotation-gated", () => {
  assert.match(toolbar, /const canClear = hasAnnotations \?\? false/);
  assert.match(toolbar, /const canExport = hasExportableContent \?\? canClear/);
  assert.match(toolbar, /disabled=\{!canClear \|\| isApplying\}/);
  assert.match(toolbar, /disabled=\{!canClear\}/);
});

test("classic ResultActions does not duplicate the vectorize entry", () => {
  assert.doesNotMatch(resultActions, /setVectorizeTarget/);
});

test("English and Korean distinguish embedded raster SVG from vector tracing", () => {
  assert.match(en, /embedded raster/);
  assert.match(en, /Trace to SVG/);
  assert.match(ko, /래스터 포함/);
  assert.match(ko, /SVG로 추적/);
});
