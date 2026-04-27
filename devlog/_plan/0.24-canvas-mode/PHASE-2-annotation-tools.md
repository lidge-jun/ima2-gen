# Canvas Mode Phase 2 - Annotation Tools

**Date**: 2026-04-28  
**Scope**: Pen, box, arrow drawing tools on the current canvas viewer  
**Status**: Ready for implementation  
**Backend**: None

## Goal

Add ephemeral image annotations in Canvas Mode:

- Pan mode keeps Phase 1 viewer behavior.
- Pen draws freehand strokes.
- Box draws rectangular highlights.
- Arrow draws drag-to-arrow annotations.
- Compact icon toolbar and `1`-`4` keyboard shortcuts switch tools.

Annotations are not persisted in this phase. Reloading or closing the app clears
them.

## Files

### New

```text
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/components/canvas-mode/CanvasAnnotationLayer.tsx
ui/src/lib/canvas/annotationRenderer.ts
ui/src/lib/canvas/coordinates.ts
ui/src/hooks/useCanvasAnnotations.ts
tests/canvas-annotation-contract.test.js
```

### Modify

```text
ui/src/components/Canvas.tsx
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/styles/canvas-mode.css
ui/src/types/canvas.ts
ui/src/i18n/en.json
ui/src/i18n/ko.json
```

## Data Model

`ui/src/types/canvas.ts`

```diff
+ export type CanvasTool = "pan" | "pen" | "box" | "arrow" | "memo";
+
+ export interface NormalizedPoint {
+   x: number;
+   y: number;
+ }
+
+ export interface DrawingPath {
+   id: string;
+   tool: "pen" | "arrow";
+   points: NormalizedPoint[];
+   color: string;
+   strokeWidth: number;
+ }
+
+ export interface BoundingBox {
+   id: string;
+   x: number;
+   y: number;
+   width: number;
+   height: number;
+   color: string;
+   strokeWidth: number;
+ }
```

## Hook Plan

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ interface AnnotationState {
+   activeTool: Exclude<CanvasTool, "memo">;
+   color: string;
+   strokeWidth: number;
+   paths: DrawingPath[];
+   boxes: BoundingBox[];
+   activePath: DrawingPath | null;
+   activeBox: BoundingBox | null;
+ }
+
+ type AnnotationAction =
+   | { type: "SET_TOOL"; tool: AnnotationState["activeTool"] }
+   | { type: "START_PATH"; point: NormalizedPoint }
+   | { type: "ADD_POINT"; point: NormalizedPoint }
+   | { type: "END_PATH" }
+   | { type: "START_BOX"; point: NormalizedPoint }
+   | { type: "UPDATE_BOX"; point: NormalizedPoint }
+   | { type: "END_BOX" }
+   | { type: "CLEAR" };
+
+ export function useCanvasAnnotations() {
+   const [state, dispatch] = useReducer(reducer, initialAnnotationState);
+   return { ...state, setTool, startDrawing, moveDrawing, endDrawing, clear };
+ }
```

Behavior:

- `START_PATH` is used for pen and arrow.
- `START_BOX` stores the initial normalized pointer position.
- `END_BOX` discards boxes smaller than `0.01` normalized width/height.
- `CLEAR` removes committed and active annotations.

## Renderer Plan

`ui/src/lib/canvas/annotationRenderer.ts`

```diff
+ export function renderAnnotationPath(
+   ctx: CanvasRenderingContext2D,
+   path: DrawingPath,
+   size: ImageSize,
+ ): void {
+   // map normalized points to image pixels, draw path, add arrow head if needed
+ }
+
+ export function renderBoundingBox(
+   ctx: CanvasRenderingContext2D,
+   box: BoundingBox,
+   size: ImageSize,
+   mode: "active" | "committed",
+ ): void {
+   // map normalized box to image pixels and stroke the rectangle
+ }
```

`ui/src/lib/canvas/coordinates.ts`

```diff
+ export function screenToNormalized(
+   event: PointerEvent | React.PointerEvent,
+   element: HTMLElement,
+ ): NormalizedPoint {
+   const rect = element.getBoundingClientRect();
+   return {
+     x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
+     y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
+   };
+ }
```

## Component Integration

`ui/src/components/canvas-mode/CanvasAnnotationLayer.tsx`

```diff
+ export function CanvasAnnotationLayer(props: CanvasAnnotationLayerProps) {
+   const canvasRef = useRef<HTMLCanvasElement>(null);
+   useEffect(() => {
+     const ctx = canvasRef.current?.getContext("2d");
+     if (!ctx) return;
+     syncBackingStore(canvasRef.current, props.imageSize);
+     render all committed paths/boxes plus active draft annotation;
+   }, [props]);
+   return <canvas ref={canvasRef} className="canvas-annotation-layer" />;
+ }
```

`ui/src/components/canvas-mode/CanvasToolbar.tsx`

```diff
+ const TOOLS = [
+   { id: "pan", shortcut: "1", icon: HandIcon },
+   { id: "pen", shortcut: "2", icon: PenIcon },
+   { id: "box", shortcut: "3", icon: BoxIcon },
+   { id: "arrow", shortcut: "4", icon: ArrowIcon },
+ ] as const;
+
+ export function CanvasToolbar({ activeTool, onToolChange, onClear, hasAnnotations }) {
+   return <div className="canvas-toolbar">icon-only tool buttons + clear button</div>;
+ }
```

Use small inline SVGs in this component unless a real icon dependency is added.
Visible text labels should not appear inside the toolbar buttons; keep labels in
`aria-label`, `title`, and a compact numeric shortcut badge.

## Shell Diff

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ import { useCanvasAnnotations } from "../../hooks/useCanvasAnnotations";
+ import { CanvasAnnotationLayer } from "./CanvasAnnotationLayer";
+ import { CanvasToolbar } from "./CanvasToolbar";
+ import { screenToNormalized } from "../../lib/canvas/coordinates";

  export function CanvasModeShell(...) {
+   const annotations = useCanvasAnnotations();
+   const imageFrameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
+       if (["1", "2", "3", "4"].includes(event.key)) {
+         const tools = ["pan", "pen", "box", "arrow"] as const;
+         annotations.setTool(tools[Number(event.key) - 1]);
+       }
      };
    }, [...]);

+   const onPointerDown = (event) => {
+     if (annotations.activeTool === "pan") return;
+     imageFrameRef.current?.setPointerCapture(event.pointerId);
+     annotations.startDrawing(screenToNormalized(event, imageFrameRef.current));
+   };

+   return (
+     <div className="canvas-mode-image-frame" ref={imageFrameRef} ...>
+       {children}
+       <CanvasAnnotationLayer {...annotationProps} />
+       <CanvasToolbar ... />
+     </div>
+   );
  }
```

## CSS Diff

`ui/src/styles/canvas-mode.css`

```diff
+ .canvas-mode-image-frame {
+   position: relative;
+ }
+
+ .canvas-annotation-layer {
+   position: absolute;
+   inset: 0;
+   width: 100%;
+   height: 100%;
+   pointer-events: none;
+ }
+
+ .canvas-toolbar {
+   position: absolute;
+   left: 50%;
+   bottom: 24px;
+   transform: translateX(-50%);
+   display: flex;
+   align-items: center;
+   gap: 4px;
+   padding: 6px;
+   border-radius: 8px;
+   background: rgba(20, 20, 20, 0.92);
+ }
```

## i18n

```diff
+ "canvas": {
+   "toolbar": {
+     "pan": "Pan",
+     "pen": "Pen",
+     "box": "Box",
+     "arrow": "Arrow",
+     "clear": "Clear all"
+   }
+ }
```

Korean labels:

```diff
+ "pan": "이동"
+ "pen": "펜"
+ "box": "박스"
+ "arrow": "화살표"
+ "clear": "모두 지우기"
```

## Tests

`tests/canvas-annotation-contract.test.js`

- `CanvasToolbar.tsx` exists and exposes pan/pen/box/arrow tools.
- `CanvasAnnotationLayer.tsx` renders a canvas overlay.
- `annotationRenderer.ts` exports path and box renderers.
- `coordinates.ts` clamps screen coordinates into normalized coordinates.
- `CanvasModeShell.tsx` wires keyboard shortcuts `1`-`4`.
- `canvas-mode.css` keeps annotation layer inside the image frame.

## Manual QA

- Double-click opens Canvas Mode with Phase 1 layout preserved.
- Press `2`, draw a pen stroke.
- Press `3`, drag a box.
- Press `4`, drag an arrow with a visible head.
- Press `1`, dragging no longer creates annotations.
- Clear button disables when no annotations exist.
- Sidebars do not move or become part of the dot grid.
