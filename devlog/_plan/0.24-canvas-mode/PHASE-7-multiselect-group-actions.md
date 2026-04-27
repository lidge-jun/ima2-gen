# Canvas Mode Phase 7 - Multi-select and Group Actions

**Date**: 2026-04-28  
**Scope**: Select multiple annotations and move/delete them together  
**Status**: Backlog  
**Backend**: None

## Goal

Make annotation editing usable once users have many objects on an image.

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
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/lib/canvas/annotationRenderer.ts
ui/src/styles/canvas-mode.css
tests/canvas-selection-contract.test.js
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

## Shell Diff

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ if (activeTool === "pan" && hit) {
+   event.shiftKey ? annotations.toggleSelected(hit) : annotations.selectOne(hit);
+ }
+
+ if (draggingSelection) {
+   annotations.moveSelected(normalizedDelta);
+ }
```

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

## Manual QA

- Select one annotation, delete it.
- Shift-select multiple annotations, move them together.
- Drag-select a region and delete selected annotations.
- Verify history from Phase 6 captures group operations as one action.

