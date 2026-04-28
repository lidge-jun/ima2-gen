import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas memo contract", () => {
  it("has a memo overlay component with textarea memo editing", () => {
    const source = readSource("ui/src/components/canvas-mode/CanvasMemoOverlay.tsx");
    assert.match(source, /CanvasMemoOverlay/);
    assert.match(source, /textarea/);
    assert.match(source, /onUpdate/);
    assert.match(source, /onDelete/);
    assert.match(source, /memo\.text\.trim\(\) === ""/);
    assert.match(source, /left: `\$\{memo\.x \* 100\}%`/);
    assert.match(source, /top: `\$\{memo\.y \* 100\}%`/);
  });

  it("prevents memo text input from bubbling into drawing handlers", () => {
    const overlay = readSource("ui/src/components/canvas-mode/CanvasMemoOverlay.tsx");
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(overlay, /event\.stopPropagation\(\)/);
    assert.match(overlay, /onPointerDown=\{stopMemoPointer\}/);
    assert.match(overlay, /onPointerMove=\{stopMemoPointer\}/);
    assert.match(overlay, /onPointerUp=\{stopMemoPointer\}/);
    assert.match(canvas, /if \(isEditableTarget\(event\.target\)\) return/);
  });

  it("guards keyboard shortcuts before tool switching and deletion", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    const editableIndex = source.indexOf("if (isEditableTarget(event.target))");
    const shortcutIndex = source.indexOf('["1", "2", "3", "4", "5", "6"]');
    const deleteIndex = source.indexOf('event.key === "Delete"');
    assert.ok(editableIndex > -1);
    assert.ok(shortcutIndex > editableIndex);
    assert.ok(deleteIndex > editableIndex);
  });

  it("has memo overlay pointer event CSS", () => {
    const source = readSource("ui/src/styles/canvas-mode.css");
    assert.match(source, /\.canvas-memo-overlay[\s\S]*pointer-events: none/);
    assert.match(source, /\.canvas-memo[\s\S]*pointer-events: auto/);
    assert.match(source, /@media \(max-width: 720px\)/);
  });
});
