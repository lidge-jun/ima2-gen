import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas eraser contract", () => {
  it("exposes one eraser tool with object and brush modes", () => {
    const types = readSource("ui/src/types/canvas.ts");
    const toolbar = readSource("ui/src/components/canvas-mode/CanvasToolbar.tsx");
    assert.match(types, /"eraser"/);
    assert.doesNotMatch(types, /"object-eraser"/);
    assert.match(types, /CanvasEraserMode = "object" \| "brush"/);
    assert.match(toolbar, /canvas-toolbar__split-button/);
    assert.match(toolbar, /canvas\.toolbar\.eraserMenu/);
    assert.match(toolbar, /canvas\.toolbar\.objectEraser/);
    assert.match(toolbar, /canvas\.toolbar\.brushEraser/);
  });

  it("adds pure eraser helpers for splitting path strokes", () => {
    const source = readSource("ui/src/lib/canvas/eraser.ts");
    assert.match(source, /erasePathsByStroke/);
    assert.match(source, /splitPathByEraser/);
    assert.match(source, /MIN_FRAGMENT_POINTS/);
    assert.match(source, /changed/);
    assert.match(source, /getSegmentEraserCut/);
    assert.match(source, /projectPointToSegmentT/);
    assert.match(source, /pointAtSegment/);
    assert.match(source, /leftT/);
    assert.match(source, /rightT/);
    assert.match(source, /tool: path\.tool === "arrow" && index !== arrowIndex \? "pen" : path\.tool/);
  });

  it("makes object and brush eraser gestures undoable without no-op history", () => {
    const hook = readSource("ui/src/hooks/useCanvasAnnotations.ts");
    assert.match(hook, /ERASE_OBJECT/);
    assert.match(hook, /START_ERASER_STROKE/);
    assert.match(hook, /UPDATE_ERASER_STROKE/);
    assert.match(hook, /END_ERASER_STROKE/);
    assert.match(hook, /eraserBaseline/);
    assert.match(hook, /if \(!exists\) return state/);
    assert.match(hook, /if \(!result\.changed\)/);
    assert.match(hook, /pushSnapshot\(state, state\.eraserBaseline\)/);
  });

  it("routes shortcut 6 to eraser and keeps shortcut 7 unused", () => {
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(canvas, /\["1", "2", "3", "4", "5", "6"\]/);
    assert.match(canvas, /\["pan", "pen", "box", "arrow", "memo", "eraser"\]/);
    assert.doesNotMatch(canvas, /"7"/);
    assert.match(canvas, /annotations\.eraserMode === "object"/);
    assert.match(canvas, /annotations\.eraserMode === "brush"/);
    assert.match(canvas, /OBJECT_ERASER_CURSOR/);
    assert.match(canvas, /BRUSH_ERASER_CURSOR/);
    assert.match(canvas, /annotations\.eraserMode === "object"[\s\S]*OBJECT_ERASER_CURSOR[\s\S]*BRUSH_ERASER_CURSOR/);
    assert.doesNotMatch(canvas, /\? "cell"/);
  });
});
