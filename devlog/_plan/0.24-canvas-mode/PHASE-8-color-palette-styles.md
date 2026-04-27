# Canvas Mode Phase 8 - Color Palette and Styles

**Date**: 2026-04-28  
**Scope**: User-selectable annotation color and stroke style  
**Status**: Backlog  
**Backend**: None

## Goal

Let users choose annotation colors and stroke widths without changing earlier
data contracts.

## Files

### New

```text
ui/src/components/canvas-mode/CanvasStylePopover.tsx
tests/canvas-style-contract.test.js
```

### Modify

```text
ui/src/hooks/useCanvasAnnotations.ts
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/styles/canvas-mode.css
ui/src/i18n/en.json
ui/src/i18n/ko.json
```

## State Diff

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ color: string;
+ strokeWidth: number;
+ setColor(color: string): void;
+ setStrokeWidth(width: number): void;
```

Annotation creation should copy the current style into each new annotation so
old objects do not change when the user changes the active style.

## Style Popover

`ui/src/components/canvas-mode/CanvasStylePopover.tsx`

```diff
+ const PRESET_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#facc15", "#ffffff"];
+ const STROKE_WIDTHS = [1, 2, 3, 5, 8, 10];
+
+ export function CanvasStylePopover({ color, strokeWidth, onColorChange, onStrokeWidthChange }) {
+   return color swatches + stroke width segmented control;
+ }
```

## Toolbar Diff

`ui/src/components/canvas-mode/CanvasToolbar.tsx`

```diff
+ <CanvasStylePopover
+   color={color}
+   strokeWidth={strokeWidth}
+   onColorChange={onColorChange}
+   onStrokeWidthChange={onStrokeWidthChange}
+ />
```

## Persistence

Local preference only:

```diff
+ localStorage.setItem("canvas.annotationStyle", JSON.stringify({ color, strokeWidth }));
```

Rules:

- Do not require backend persistence for style preferences.
- Validate restored values against presets/bounds.
- Stroke width range is `1` to `10`.

## CSS Diff

`ui/src/styles/canvas-mode.css`

```diff
+ .canvas-style-popover {
+   position: absolute;
+   bottom: calc(100% + 8px);
+   display: grid;
+   gap: 8px;
+   padding: 8px;
+   border-radius: 8px;
+   background: rgba(20, 20, 20, 0.96);
+ }
+
+ .canvas-style-swatch {
+   width: 24px;
+   height: 24px;
+   border-radius: 999px;
+ }
```

## i18n

```diff
+ "style": "Style",
+ "color": "Color",
+ "strokeWidth": "Stroke width"
```

Korean labels:

```diff
+ "style": "스타일"
+ "color": "색상"
+ "strokeWidth": "선 굵기"
```

## Tests

- Style popover exposes preset colors and widths.
- Hook persists and restores validated style preference.
- New annotations copy active color and stroke width.
- Existing annotations do not mutate when style changes.
- Toolbar exposes the style control.

## Manual QA

- Pick each preset color and draw pen/box/arrow.
- Change stroke width and verify new annotations use it.
- Reload app and verify preferred style returns.
- Confirm existing annotations keep their original style.

