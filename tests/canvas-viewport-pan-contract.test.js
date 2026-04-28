import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const types = readFileSync(join(root, "ui/src/types/canvas.ts"), "utf8");
const hook = readFileSync(join(root, "ui/src/hooks/useCanvasAnnotations.ts"), "utf8");
const canvas = readFileSync(join(root, "ui/src/components/Canvas.tsx"), "utf8");
const store = readFileSync(join(root, "ui/src/store/useAppStore.ts"), "utf8");
const coords = readFileSync(join(root, "ui/src/lib/canvas/coordinates.ts"), "utf8");

test("canvas tool 'pan' renamed to 'select'", () => {
  assert.match(types, /CanvasTool\s*=\s*"select"\s*\|/);
  assert.match(hook, /activeTool:\s*"select"/);
  assert.match(canvas, /activeTool === "select"/);
});

test("store carries canvasPanX/Y with setters and reset", () => {
  assert.match(store, /canvasPanX:\s*number/);
  assert.match(store, /canvasPanY:\s*number/);
  assert.match(store, /setCanvasPan:\s*\(x:\s*number,\s*y:\s*number\)\s*=>\s*void/);
  assert.match(store, /resetCanvasPan:\s*\(\)\s*=>\s*void/);
});

test("Canvas applies translate+scale transform when canvas is open", () => {
  assert.match(
    canvas,
    /transform:\s*canvasOpen[\s\S]{0,160}translate\(\$\{canvasPanX\}px,\s*\$\{canvasPanY\}px\)\s*scale\(\$\{canvasZoom\}\)/,
  );
});

test("Canvas reacts to Space and middle-mouse for viewport pan", () => {
  assert.match(canvas, /viewportPanRef/);
  assert.match(canvas, /spaceHeld/);
  assert.match(canvas, /event\.button === 1/);
});

test("openCanvas / resetCanvasZoom reset pan", () => {
  assert.match(store, /openCanvas:[\s\S]{0,200}canvasPanX:\s*0[\s\S]{0,40}canvasPanY:\s*0/);
  assert.match(store, /resetCanvasZoom:[\s\S]{0,160}canvasPanX:\s*0/);
});

test("screenToNormalized still uses getBoundingClientRect (post-transform safe)", () => {
  assert.match(coords, /getBoundingClientRect\(\)/);
  assert.match(coords, /rect\.width/);
  assert.match(coords, /rect\.height/);
});
