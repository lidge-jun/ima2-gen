# Canvas Mode Phase 6 - Undo, Redo, History

**Date**: 2026-04-28  
**Scope**: Annotation undo/redo stack  
**Status**: Backlog  
**Backend**: None

## Goal

Let users recover from annotation mistakes without clearing everything.

## Files

### Modify

```text
ui/src/hooks/useCanvasAnnotations.ts
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/i18n/en.json
ui/src/i18n/ko.json
tests/canvas-history-contract.test.js
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

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
+   event.preventDefault();
+   if (event.shiftKey) annotations.redo();
+   else annotations.undo();
+ }
```

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
- Shell wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
- History stack cap is enforced at 50 snapshots.

## Manual QA

- Draw pen, box, memo; undo each in reverse order.
- Redo restores each annotation.
- Drawing after undo clears future redo stack.

