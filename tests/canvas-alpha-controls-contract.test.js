import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const types = readFileSync(join(root, "ui/src/types/canvas.ts"), "utf8");
const store = readFileSync(join(root, "ui/src/store/useAppStore.ts"), "utf8");
const merge = readFileSync(join(root, "ui/src/lib/canvas/mergeRenderer.ts"), "utf8");
const exportR = readFileSync(join(root, "ui/src/lib/canvas/exportRenderer.ts"), "utf8");
const canvas = readFileSync(join(root, "ui/src/components/Canvas.tsx"), "utf8");
const toolbar = readFileSync(join(root, "ui/src/components/canvas-mode/CanvasToolbar.tsx"), "utf8");
const css = readFileSync(join(root, "ui/src/styles/canvas-mode.css"), "utf8");
const en = JSON.parse(readFileSync(join(root, "ui/src/i18n/en.json"), "utf8"));
const ko = JSON.parse(readFileSync(join(root, "ui/src/i18n/ko.json"), "utf8"));

test("CanvasExportBackground union exists", () => {
  assert.match(types, /CanvasExportBackground\s*=\s*"alpha"\s*\|\s*"matte"/);
});

test("Store carries exportBackground state with setters", () => {
  assert.match(store, /canvasExportBackground:\s*CanvasExportBackground/);
  assert.match(store, /canvasExportMatteColor:\s*HexColor/);
  assert.match(store, /setCanvasExportBackground:\s*\(mode:\s*CanvasExportBackground\)\s*=>\s*void/);
  assert.match(store, /setCanvasExportMatteColor:\s*\(color:\s*HexColor\)\s*=>\s*void/);
  assert.match(store, /CANVAS_EXPORT_BG_KEY/);
});

test("Merge renderer accepts background option", () => {
  assert.match(merge, /background\?:\s*\{\s*mode:\s*"alpha"\s*\}\s*\|\s*\{\s*mode:\s*"matte";\s*color:\s*string\s*\}/);
  assert.match(merge, /input\.background\?\.mode === "matte"/);
  assert.match(merge, /ctx\.fillRect\(0, 0, canvas\.width, canvas\.height\)/);
});

test("Export filename appends -flat for matte mode", () => {
  assert.match(exportR, /canvas-export-\$\{stamp\}\$\{suffix\}\.png/);
  assert.match(exportR, /options\.matte\s*\?\s*"-flat"\s*:\s*""/);
});

test("Canvas detects image alpha and toggles modifier class", () => {
  assert.match(canvas, /imageUsesAlpha/);
  assert.match(canvas, /canvas-annotation-frame--alpha/);
});

test("Canvas wires export background option into export call", () => {
  assert.match(canvas, /exportBackground === "matte"/);
  assert.match(canvas, /background:\s*matte/);
  assert.match(canvas, /makeCanvasExportFilename\(\{ matte \}\)/);
});

test("Toolbar BackgroundControl rendered before Export", () => {
  assert.match(toolbar, /canvas-toolbar__bg/);
  assert.match(toolbar, /BackgroundControl/);
  assert.match(toolbar, /onMatteColorChange/);
});

test("CSS adds alpha checkerboard and toolbar bg group", () => {
  assert.match(css, /\.canvas-annotation-frame--alpha\s*\{/);
  assert.match(css, /background-size:\s*16px 16px/);
  assert.match(css, /linear-gradient\([^)]*45deg/);
  assert.match(css, /\.canvas-toolbar__bg-tab/);
});

test("i18n carries bg keys in both locales", () => {
  for (const locale of [en, ko]) {
    assert.equal(typeof locale.canvas.toolbar.bgGroup, "string");
    assert.equal(typeof locale.canvas.toolbar.bgAlpha, "string");
    assert.equal(typeof locale.canvas.toolbar.bgMatte, "string");
    assert.equal(typeof locale.canvas.toolbar.bgMatteColor, "string");
  }
});
