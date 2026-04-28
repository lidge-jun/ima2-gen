# Canvas Mode Phase 7 - Multi-select and Group Actions

**Date**: 2026-04-28  
**Scope**: Select multiple annotations and move/delete them together  
**Status**: Backlog  
**Backend**: None

## Goal

Make annotation editing usable once users have many objects on an image.

## QA Baseline To Preserve

Phase 7 selection is an in-Canvas editing feature only.

- Do not expose canvas version files in Gallery or HistoryStrip.
- Default viewer actions keep using the source/original image.
- Canvas Mode actions keep using the canvas-edited version.
- Selection/delete/move operations must affect annotation objects only, not
  gallery/history image rows.
- The latest saved canvas version remains resolved through the current source
  image and must keep the source prompt for `Continue Here`.
- `Esc` behavior from Phase 6 remains required: editable fields blur first,
  then Canvas closes through the save-aware close path.

## Files

### New

```text
ui/src/lib/canvas/hitTest.ts
tests/canvas-hit-test-contract.test.js
```

### Modify

```text
ui/src/hooks/useCanvasAnnotations.ts
ui/src/components/canvas-mode/CanvasAnnotationLayer.tsx
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/components/Canvas.tsx
ui/src/lib/canvas/annotationRenderer.ts
ui/src/styles/canvas-mode.css
tests/canvas-selection-contract.test.js
tests/gallery-navigation-ux-contract.test.js
```

## State Diff

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ selectedIds: string[];
+ selectionBox: BoundingBox | null;
+ selectOne(id: string): void;
+ toggleSelected(id: string): void;
+ clearSelection(): void;
+ deleteSelected(): void;
+ moveSelected(delta: NormalizedPoint): void;
```

## Hit Testing

`ui/src/lib/canvas/hitTest.ts`

```diff
+ export function hitTestAnnotation(input: {
+   point: NormalizedPoint;
+   paths: DrawingPath[];
+   boxes: BoundingBox[];
+   memos: CanvasMemo[];
+   tolerance: number;
+ }): string | null;
+
+ export function findAnnotationsInBox(input: {
+   box: BoundingBox;
+   annotations: AnnotationSnapshot;
+ }): string[];
```

Rules:

- Topmost annotation wins.
- Shift-click toggles selection.
- Empty click clears selection.
- Drag on empty area creates a selection box.

## Renderer Diff

`ui/src/lib/canvas/annotationRenderer.ts`

```diff
+ renderSelectionOutline(ctx, annotationBounds, size);
```

Selected annotations get a consistent outline/handles treatment without changing
their saved color or stroke width.

## Canvas Integration Diff

`ui/src/components/Canvas.tsx`

```diff
+ if (activeTool === "pan" && hit) {
+   event.shiftKey ? annotations.toggleSelected(hit) : annotations.selectOne(hit);
+ }
+
+ if (draggingSelection) {
+   annotations.moveSelected(normalizedDelta);
+ }
```

Rules:

- Selection gestures must run against `canvasDisplayImage` / annotation state
  inside Canvas, never against the default viewer source row.
- Deleting selected annotations must not call `trashHistoryItem`,
  `permanentlyDeleteHistoryItemByClick`, or any gallery/history delete action.
- Empty canvas click clears annotation selection only. It must not change the
  current gallery/history item.

## Toolbar Diff

```diff
+ <button onClick={deleteSelected} disabled={selectedIds.length === 0}>
+   <Trash2 />
+ </button>
```

## Tests

- Hit test finds boxes, paths, and memos.
- Shift-click toggles selected ids.
- Selection box selects multiple annotations.
- Delete selected removes only selected annotations.
- Moving selected annotations preserves normalized coordinates.
- Selection code does not import or call gallery/history delete actions.
- Gallery/HistoryStrip still filter out `canvasVersion` items.

## Manual QA

- Select one annotation, delete it.
- Shift-select multiple annotations, move them together.
- Drag-select a region and delete selected annotations.
- Verify history from Phase 6 captures group operations as one action.
- Save a canvas version, confirm it remains hidden in Gallery/HistoryStrip.
- In Canvas, select/move annotations on the saved canvas version and verify
  default viewer remains the source image after close.
- Canvas `Continue Here`, copy, and download still target the edited canvas
  version while default viewer actions target the source image.
