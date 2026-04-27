import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas annotation contract", () => {
  it("has toolbar component with core tools", () => {
    const source = readSource("ui/src/components/canvas-mode/CanvasToolbar.tsx");
    assert.match(source, /CanvasToolbar/);
    assert.match(source, /pan/);
    assert.match(source, /pen/);
    assert.match(source, /box/);
    assert.match(source, /arrow/);
    assert.match(source, /canvas-toolbar__shortcut/);
    assert.doesNotMatch(source, /<span>\{tool\.label\}<\/span>/);
  });

  it("has annotation canvas layer", () => {
    const source = readSource("ui/src/components/canvas-mode/CanvasAnnotationLayer.tsx");
    assert.match(source, /CanvasAnnotationLayer/);
    assert.match(source, /renderAnnotationPath/);
    assert.match(source, /renderBoundingBox/);
  });

  it("has annotation renderer", () => {
    const source = readSource("ui/src/lib/canvas/annotationRenderer.ts");
    assert.match(source, /renderAnnotationPath/);
    assert.match(source, /renderBoundingBox/);
    assert.match(source, /drawArrowHead/);
  });

  it("has normalized coordinate mapper", () => {
    const source = readSource("ui/src/lib/canvas/coordinates.ts");
    assert.match(source, /screenToNormalized/);
    assert.match(source, /getBoundingClientRect/);
  });

  it("wires annotation tools inside Canvas", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /CanvasToolbar/);
    assert.match(source, /CanvasAnnotationLayer/);
    assert.match(source, /onPointerDown/);
  });

  it("keeps annotation integration inside Canvas instead of the app shell", () => {
    const app = readSource("ui/src/App.tsx");
    assert.doesNotMatch(app, /CanvasModeShell/);
  });

  it("scales the image annotation frame instead of the image element", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    const frameIndex = source.indexOf("canvas-annotation-frame");
    const layerIndex = source.indexOf("<CanvasAnnotationLayer", frameIndex);
    const toolbarIndex = source.indexOf("<CanvasToolbar", frameIndex);
    const promptIndex = source.indexOf("result-prompt");
    const metaIndex = source.indexOf("result-meta");
    const actionsIndex = source.indexOf("<ResultActions");

    assert.ok(frameIndex > -1);
    assert.ok(layerIndex > frameIndex);
    assert.ok(toolbarIndex > frameIndex);
    assert.ok(promptIndex > frameIndex);
    assert.ok(metaIndex > frameIndex);
    assert.ok(actionsIndex > frameIndex);
    assert.match(source, /className="canvas-annotation-frame"[\s\S]*transform: canvasOpen \? `scale\(\$\{canvasZoom\}\)`/);
    assert.doesNotMatch(source, /<img[\s\S]{0,500}transform: canvasOpen \? `scale\(\$\{canvasZoom\}\)`/);
  });

  it("clears temporary annotations when the current image changes", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /previousImageKeyRef/);
    assert.match(source, /currentImage\?\.filename \?\? currentImage\?\.url \?\? currentImage\?\.image/);
    assert.match(source, /annotations\.clear\(\)/);
  });

  it("has annotation state contracts", () => {
    const types = readSource("ui/src/types/canvas.ts");
    const hook = readSource("ui/src/hooks/useCanvasAnnotations.ts");
    assert.match(types, /interface BoundingBox[\s\S]*strokeWidth: number/);
    assert.match(hook, /hasAnnotations/);
  });

  it("has localized toolbar keys", () => {
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));
    for (const locale of [en, ko]) {
      assert.equal(typeof locale.canvas.toolbar.label, "string");
      assert.equal(typeof locale.canvas.toolbar.pan, "string");
      assert.equal(typeof locale.canvas.toolbar.pen, "string");
      assert.equal(typeof locale.canvas.toolbar.box, "string");
      assert.equal(typeof locale.canvas.toolbar.arrow, "string");
      assert.equal(typeof locale.canvas.toolbar.clear, "string");
    }
  });
});
