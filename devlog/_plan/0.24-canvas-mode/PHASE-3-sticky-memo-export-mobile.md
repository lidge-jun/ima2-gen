# Canvas Mode Phase 3 - Apply Merged Image, Sticky Memo, Export, Mobile

**Date**: 2026-04-28  
**Scope**: Apply annotations into the current image, text memos, merged PNG export, responsive touch polish  
**Status**: Planned  
**Backend**: None

## Goal

Make Canvas Mode output useful beyond drawing overlays. Phase 3 should let users
apply visible canvas edits into a merged image, continue generation from that
merged image, add sticky text memos, and export the merged PNG locally. Keep
editable layer persistence out of scope until Phase 4.

## Files

### New

```text
ui/src/components/canvas-mode/CanvasMemoOverlay.tsx
ui/src/lib/canvas/mergeRenderer.ts
ui/src/lib/canvas/exportRenderer.ts
tests/canvas-memo-contract.test.js
tests/canvas-export-contract.test.js
tests/canvas-apply-merged-contract.test.js
```

### Modify

```text
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/hooks/useCanvasAnnotations.ts
ui/src/lib/canvas/annotationRenderer.ts
ui/src/styles/canvas-mode.css
ui/src/types/canvas.ts
ui/src/components/Canvas.tsx
ui/src/store/useAppStore.ts
ui/src/i18n/en.json
ui/src/i18n/ko.json
```

## Apply Merged Image

`ui/src/lib/canvas/mergeRenderer.ts`

```diff
+ export async function renderMergedCanvasImage(input: {
+   imageElement: HTMLImageElement;
+   paths: DrawingPath[];
+   boxes: BoundingBox[];
+   memos: CanvasMemo[];
+ }): Promise<{ blob: Blob; dataUrl: string }> {
+   draw base image into an offscreen canvas;
+   render paths, boxes, arrows, and memos into the same canvas;
+   return PNG blob plus data URL;
+ }
```

`ui/src/components/Canvas.tsx`

```diff
+ async function handleApplyCanvas(): Promise<void> {
+   const merged = await renderMergedCanvasImage(...);
+   applyMergedCanvasImage({
+     image: merged.dataUrl,
+     url: merged.dataUrl,
+     filename: currentImage.filename,
+     prompt: currentImage.prompt,
+     source: "canvas-merged",
+   });
+   annotations.clear();
+ }
```

Store contract:

```diff
+ applyMergedCanvasImage(image: CurrentImage): void;
```

Required UX behavior:

- The toolbar has a primary Apply button when annotations or memos exist.
- Apply bakes visible annotations into the current image preview.
- Existing Continue Here / New from here must use the merged image as the
  reference source after Apply.
- This is not editable persistence. Once applied, the annotation layer clears
  because the edits are baked into pixels.

## Data Model

`ui/src/types/canvas.ts`

```diff
+ export interface CanvasMemo {
+   id: string;
+   x: number;
+   y: number;
+   text: string;
+   color: string;
+ }
```

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ memos: CanvasMemo[];
+ activeMemoId: string | null;
+ createMemo(point: NormalizedPoint): void;
+ updateMemo(id: string, text: string): void;
+ deleteMemo(id: string): void;
```

## Memo Overlay

`ui/src/components/canvas-mode/CanvasMemoOverlay.tsx`

```diff
+ export function CanvasMemoOverlay({ memos, activeMemoId, onUpdate, onDelete }) {
+   return (
+     <div className="canvas-memo-overlay">
+       {memos.map((memo) => (
+         <textarea
+           className="canvas-memo"
+           value={memo.text}
+           style={{ left: `${memo.x * 100}%`, top: `${memo.y * 100}%` }}
+           onChange={(event) => onUpdate(memo.id, event.currentTarget.value)}
+           onBlur={() => memo.text.trim() === "" && onDelete(memo.id)}
+         />
+       ))}
+     </div>
+   );
+ }
```

Behavior:

- Memo tool uses shortcut `5`.
- Click image in memo mode to create a memo at normalized coordinates.
- Empty memo on blur is removed.
- ESC blurs the active memo before closing Canvas Mode.

## Export Renderer

`ui/src/lib/canvas/exportRenderer.ts`

```diff
+ export async function exportCanvasImage(input: ExportCanvasInput): Promise<Blob> {
+   const canvas = document.createElement("canvas");
+   const ctx = canvas.getContext("2d");
+   draw base image;
+   renderAnnotationPath, renderBoundingBox, and arrows;
+   render memo text blocks;
+   return await canvasToBlob(canvas, "image/png");
+ }
```

Filename:

```text
canvas-export-{YYYYMMDD-HHmmss}.png
```

## Toolbar Diff

`ui/src/components/canvas-mode/CanvasToolbar.tsx`

```diff
+ { id: "memo", shortcut: "5", icon: StickyNote }
+ <button onClick={onApply} disabled={!hasExportableContent}>
+   Apply
+ </button>
+ <button onClick={onExport} disabled={!hasExportableContent}>
+   <Download />
+ </button>
```

## Mobile CSS

`ui/src/styles/canvas-mode.css`

```diff
+ @media (max-width: 720px) {
+   .canvas-toolbar {
+     left: max(12px, env(safe-area-inset-left));
+     right: max(12px, env(safe-area-inset-right));
+     bottom: max(12px, env(safe-area-inset-bottom));
+     transform: none;
+     justify-content: center;
+     flex-wrap: wrap;
+   }
+
+   .canvas-memo {
+     min-width: 140px;
+     max-width: min(220px, 70vw);
+   }
+ }
```

## i18n

```diff
+ "memo": "Sticky memo",
+ "apply": "Apply to image",
+ "export": "Export image",
+ "applyFailed": "Could not apply canvas edits",
+ "exporting": "Exporting...",
+ "exportFailed": "Export failed"
```

Korean labels:

```diff
+ "memo": "메모"
+ "apply": "이미지에 적용"
+ "export": "이미지 내보내기"
+ "applyFailed": "캔버스 편집 적용 실패"
+ "exporting": "내보내는 중..."
+ "exportFailed": "내보내기 실패"
```

## Tests

- Memo overlay file exists and renders textareas from memo state.
- Empty memo blur path calls delete.
- Merge renderer draws image, annotations, boxes, arrows, and memo text.
- Apply action updates the current image so Continue Here uses the merged image.
- Export renderer downloads the same merged visual output without changing state.
- Toolbar exposes memo and export actions.
- Mobile CSS has toolbar wrapping and safe-area inset handling.

## Manual QA

- Create, edit, blur, and delete a memo.
- Export a PNG and verify annotations/memos are merged into the file.
- On mobile width, toolbar does not overflow or cover the side panels.
- Touch drawing works for pen/box/arrow/memo.
