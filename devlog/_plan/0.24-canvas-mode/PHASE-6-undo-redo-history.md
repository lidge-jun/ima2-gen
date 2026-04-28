# Canvas Mode Phase 6 - Undo, Redo, History

**Date**: 2026-04-28  
**Scope**: Annotation undo/redo stack plus keyboard close reliability  
**Status**: Backlog  
**Backend**: None

## Goal

Let users recover from annotation mistakes without clearing everything.

## QA Baseline To Preserve

Phase 6 must be built on the current `Canvas.tsx` integration, not the older
unused shell path.

- Default viewer, Gallery, and HistoryStrip show only the source/original image.
- Canvas Mode displays the latest saved canvas version for the current source.
- `Continue Here`, copy, and download use the source image in the default viewer
  and the canvas-edited version while Canvas Mode is open.
- Canvas version prompts must inherit the source prompt. Do not send prompt text
  through custom canvas-version headers because long prompts caused HTTP 431.
- The physical MacBook `Esc` key must work:
  - when Canvas itself is focused, `Esc` runs the save-aware close path;
  - when a memo/textarea is focused, first `Esc` blurs the editor and preserves
    the canvas, then the next `Esc` closes Canvas.
- Undo/redo keyboard shortcuts must never fire while typing in memo/textarea
  fields.

## Files

### Modify

```text
ui/src/hooks/useCanvasAnnotations.ts
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/components/Canvas.tsx
ui/src/i18n/en.json
ui/src/i18n/ko.json
tests/canvas-history-contract.test.js
tests/canvas-version-contract.test.js
```

## State Model

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ interface HistoryState {
+   past: AnnotationSnapshot[];
+   present: AnnotationSnapshot;
+   future: AnnotationSnapshot[];
+ }
+
+ interface AnnotationSnapshot {
+   paths: DrawingPath[];
+   boxes: BoundingBox[];
+   memos: CanvasMemo[];
+ }
```

Rules:

- Committed changes push the previous snapshot into `past`.
- Draft pointer movement does not push snapshots.
- Undo moves one snapshot from `past` to `future`.
- Redo moves one snapshot from `future` to `past`.
- Limit `past` to 50 snapshots.

## Hook Diff

```diff
+ canUndo: boolean;
+ canRedo: boolean;
+ undo(): void;
+ redo(): void;
```

## Keyboard Diff

`ui/src/components/Canvas.tsx`

```diff
+ if (isEditableTarget(event.target)) {
+   if (event.key === "Escape") {
+     event.preventDefault();
+     (event.target as HTMLElement).blur();
+     annotations.focusMemo(null);
+   }
+   return;
+ }
+
+ if (canvasOpen && event.key === "Escape") {
+   event.preventDefault();
+   void handleCloseCanvas();
+   return;
+ }
+
+ if (canvasOpen && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
+   event.preventDefault();
+   if (event.shiftKey) annotations.redo();
+   else annotations.undo();
+ }
```

Implementation note:

- Keep the existing save-aware `handleCloseCanvas()` path. Do not wire `Esc`
  directly to `closeCanvas()`.
- If the current focus model still misses MacBook hardware `Esc`, add a scoped
  `window.addEventListener("keydown", ...)` only while `canvasOpen` is true,
  with the same editable-target guard above.

## Toolbar Diff

`ui/src/components/canvas-mode/CanvasToolbar.tsx`

```diff
+ <button onClick={onUndo} disabled={!canUndo} title={t("canvas.toolbar.undo")}>
+   <Undo2 />
+ </button>
+ <button onClick={onRedo} disabled={!canRedo} title={t("canvas.toolbar.redo")}>
+   <Redo2 />
+ </button>
```

## i18n

```diff
+ "undo": "Undo",
+ "redo": "Redo"
```

Korean labels:

```diff
+ "undo": "실행 취소"
+ "redo": "다시 실행"
```

## Tests

- Hook exposes `undo`, `redo`, `canUndo`, and `canRedo`.
- Pointer move actions do not push history snapshots.
- Toolbar disables unavailable history actions.
- `Canvas.tsx` wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
- `Canvas.tsx` keeps MacBook `Esc` on the save-aware close path.
- `Esc` inside memo/textarea blurs first and does not close immediately.
- Undo/redo shortcuts are ignored while typing in memo/textarea.
- History stack cap is enforced at 50 snapshots.

## Manual QA

- Draw pen, box, memo; undo each in reverse order.
- Redo restores each annotation.
- Drawing after undo clears future redo stack.
- Save a canvas version, close Canvas, confirm default viewer still shows source.
- Reopen Canvas, confirm saved canvas version is shown internally.
- Press physical MacBook `Esc` from Canvas focus: it closes through the save-aware path.
- Focus a memo, press `Esc`: focus leaves the memo; press `Esc` again: Canvas closes.
- Canvas `Continue Here` still uses the canvas version image and source prompt.
