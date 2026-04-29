import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("gallery viewer focusless navigation contract", () => {
  it("handles movement globally and delete only on the selected viewer", () => {
    const hook = readSource("ui/src/hooks/useGalleryViewerNavigation.ts");
    const store = readSource("ui/src/store/useAppStore.ts");
    const canvas = readSource("ui/src/components/Canvas.tsx");
    const domEvents = readSource("ui/src/lib/domEvents.ts");
    const css = readSource("ui/src/index.css");

    assert.match(hook, /KEY_TO_ACTION/);
    assert.match(hook, /ArrowLeft:\s*"previous"/);
    assert.match(hook, /ArrowRight:\s*"next"/);
    assert.match(hook, /Home:\s*"first"/);
    assert.match(hook, /End:\s*"last"/);
    assert.doesNotMatch(hook, /Delete:\s*/);
    assert.doesNotMatch(hook, /Shift\+Delete/);
    assert.match(hook, /uiMode !== "classic"/);
    assert.match(hook, /event\.defaultPrevented/);
    assert.match(hook, /isEditableTarget\(event\.target\)/);

    assert.match(domEvents, /HTMLButtonElement/);
    assert.match(store, /selectHistoryShortcutTarget:\s*\(action\) =>/);
    assert.match(store, /getShortcutTarget\(get\(\)\.history,\s*get\(\)\.currentImage,\s*action\)/);
    assert.match(store, /resolveVisibleShortcutCurrent,/);
    assert.match(store, /getVisibleGalleryItems,/);
    assert.match(store, /saveSelectedFilename\(target\?\.filename \?\? null\)/);
    assert.match(canvas, /const handleViewerMouseDown/);
    assert.match(canvas, /isEditableTarget\(event\.target\)/);
    assert.match(canvas, /event\.currentTarget\.focus\(\)/);
    assert.match(canvas, /onMouseDown=\{handleViewerMouseDown\}/);
    assert.match(canvas, /onKeyDown=\{handleViewerKeyDown\}/);
    assert.match(canvas, /event\.key === "Delete" \|\| event\.key === "Backspace"/);
    assert.match(canvas, /event\.target !== event\.currentTarget/);
    assert.match(canvas, /event\.shiftKey/);
    assert.match(canvas, /permanentlyDeleteHistoryItemByShortcut\(currentImage\)/);
    assert.match(canvas, /trashHistoryItem\(currentImage\)/);
    assert.match(canvas, /selectHistoryShortcutTarget\("previous"\)/);
    assert.match(canvas, /selectHistoryShortcutTarget\("first"\)/);
    assert.match(css, /\.result-container:focus,/);
    assert.match(css, /\.result-img\s*\{[\s\S]*?cursor:\s*pointer;/);
    assert.match(css, /\.right-panel-backdrop\s*\{[\s\S]*?pointer-events:\s*none;/);
  });

  it("keeps permanent delete explicit by click or focused Shift+Delete", () => {
    const resultActions = readSource("ui/src/components/ResultActions.tsx");
    const store = readSource("ui/src/store/useAppStore.ts");
    const hook = readSource("ui/src/hooks/useGalleryViewerNavigation.ts");
    const canvas = readSource("ui/src/components/Canvas.tsx");
    const canvasShortcuts = readSource("ui/src/components/canvas-mode/useCanvasModeShortcuts.ts");

    assert.doesNotMatch(hook, /trashHistoryItem/);
    assert.match(resultActions, /onClick=\{\(\) => void trashHistoryItem\(actionImage\)\}/);
    assert.match(resultActions, /onClick=\{\(\) => void permanentlyDeleteHistoryItemByClick\(actionImage\)\}/);
    assert.match(resultActions, /result\.permanentDelete/);
    assert.match(canvas, /event\.shiftKey[\s\S]*permanentlyDeleteHistoryItemByShortcut\(currentImage\)/);
    assert.match(canvasShortcuts, /event\.shiftKey[\s\S]*permanentlyDeleteHistoryItemByShortcut\(currentImage\)/);
    assert.match(canvasShortcuts, /event\.target !== event\.currentTarget/);
    assert.match(store, /permanentlyDeleteHistoryItemByClick:\s*async \(item\) => \{[\s\S]*permanentlyDeleteHistoryItemByShortcut\(item\)/);
    assert.match(store, /window\.confirm\(t\("result\.permanentDeleteConfirm"/);
  });
});
