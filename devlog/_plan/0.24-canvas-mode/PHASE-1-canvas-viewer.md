# Canvas Mode Phase 1 - Canvas Viewer

**Date**: 2026-04-28  
**Scope**: Baseline image canvas viewer  
**Status**: Done  
**Backend**: None

## Goal

Double-clicking an image opens a canvas-style viewer around the selected image
only. The left sidebar and right panel keep their original layout positions.

## Delivered Behavior

- Dot grid background is applied only to the central image canvas area.
- Image size and position remain stable when Canvas Mode opens.
- ESC closes Canvas Mode.
- `+` zooms in, `-` zooms out, `0` resets zoom.
- Wheel zoom is blocked.
- Viewer state lives in `useAppStore`.

## Files

### Existing Phase 1 Surface

```text
ui/src/components/Canvas.tsx
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/store/useAppStore.ts
ui/src/styles/canvas-mode.css
ui/src/types/canvas.ts
ui/src/i18n/en.json
ui/src/i18n/ko.json
tests/canvas-mode-contract.test.js
```

## Store Contract

`ui/src/store/useAppStore.ts`

```diff
+ canvasOpen: boolean;
+ canvasZoom: number;
+ openCanvas: () => void;
+ closeCanvas: () => void;
+ setCanvasZoom: (zoom: number) => void;
+ resetCanvasZoom: () => void;
```

Zoom should clamp to the shared budget of `0.5` to `3.0`.

## Component Contract

`ui/src/components/Canvas.tsx`

```diff
+ <main className={`canvas${canvasOpen ? " canvas--mode-open" : ""}`}>
+   image content
+   canvas close affordance
+ </main>
```

The Canvas Mode class belongs on the central canvas element. It must not wrap
the full app grid.

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ useEffect(() => {
+   function onKey(event: KeyboardEvent) {
+     if (event.key === "Escape") closeCanvas();
+     if (event.key === "+" || event.key === "=") setCanvasZoom(canvasZoom + 0.25);
+     if (event.key === "-" || event.key === "_") setCanvasZoom(canvasZoom - 0.25);
+     if (event.key === "0") resetCanvasZoom();
+   }
+ }, [canvasOpen, canvasZoom]);
```

## CSS Contract

`ui/src/styles/canvas-mode.css`

```diff
+ .canvas--mode-open {
+   background-color: var(--canvas-mode-bg);
+   background-image: radial-gradient(...);
+   background-size: 24px 24px;
+ }
+
+ .canvas--mode-open .canvas-image {
+   transform: scale(var(--canvas-zoom));
+   transform-origin: center center;
+ }
```

## Backlog From Phase 1

- Add annotation tools in Phase 2.
- Add memo/export/mobile polish in Phase 3.
- Add persistence only when reload survival becomes a requirement.
- Add visual regression screenshots if Canvas Mode layout regresses again.

## Verification

- `tests/canvas-mode-contract.test.js` covers store keys, CSS selectors, keyboard
  shortcuts, and wheel blocking.
- Manual screenshot review should confirm sidebars remain outside the dot grid.

