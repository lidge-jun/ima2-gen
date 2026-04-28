# Canvas Mode Phase 5 - Edit With Mask on Saved Canvas Versions

**Date**: 2026-04-28  
**Scope**: Use Canvas boxes as edit masks, built on Phase 4 canvas-version persistence  
**Status**: Planned for integrated Phase 4/5 PABCD  
**Backend**: Required

## Goal

Phase 5 should not treat masks as a separate throwaway feature. It should build
on the Phase 4 baseline:

1. Canvas edits can be saved as a baked version.
2. That saved version is an internal Canvas version for the source image.
3. Boxes drawn in Canvas can define edit regions.
4. The edit result returns through the existing generated history flow.

This keeps the user flow coherent:

```text
open canvas
draw box / memo / arrows
save canvas version
use saved version inside Canvas as edit/reference input
draw mask boxes
edit with mask
result appears in history
```

## Behavior Contract

### Mask Source

- If the current canvas has unsaved dirty overlays, save/update the canvas version first.
- Mask edit should use the latest Canvas display image as the edit source.
- The original image remains preserved.
- Default viewer, Gallery, and HistoryStrip keep showing the source/original image.
- Canvas versions remain hidden internal assets resolved from the source image.
- Canvas actions can use the canvas version without making it the default viewer image.
- Prompt comes from the canvas version or source prompt fallback; never send prompt text in custom canvas-version headers.
- The mask result is a normal generated/edit result, not another editable overlay.

### Mask Semantics

- Boxes are normalized coordinates.
- Mask renderer converts boxes to a PNG at the source image natural dimensions.
- Multiple boxes are supported.
- No boxes means Edit with Mask is disabled.
- The renderer owns provider-specific mask convention.

### Save Boundary

Before `Edit with Mask`:

```text
dirty canvas? -> save canvas version -> attach as reference -> render mask -> submit edit
clean canvas? -> render mask -> submit edit
```

If save fails, do not call edit.

## Files

### New

```text
ui/src/lib/canvas/maskRenderer.ts
tests/canvas-mask-contract.test.js
tests/edit-mask-api-contract.test.js
tests/canvas-edit-mask-flow-contract.test.js
```

### Modify

```text
routes/edit.js
ui/src/components/Canvas.tsx
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/lib/api.ts
ui/src/store/useAppStore.ts
ui/src/i18n/en.json
ui/src/i18n/ko.json
ui/src/styles/canvas-mode.css
```

## Backend API

`routes/edit.js`

```diff
 const mask = typeof req.body?.mask === "string" ? req.body.mask : null;

+ if (mask) {
+   const maskCheck = validateAndNormalizeEditMask(mask);
+   if (maskCheck.error) {
+     return res.status(400).json({
+       error: maskCheck.error,
+       code: maskCheck.code,
+     });
+   }
+ }
```

Edit request contract:

```json
{
  "image": "base64-or-data-url-source-image",
  "mask": "base64-or-data-url-png-mask",
  "prompt": "change the selected area...",
  "quality": "medium",
  "size": "1024x1024",
  "format": "png",
  "moderation": "low",
  "provider": "oauth"
}
```

Rules:

- `mask` is optional.
- No-mask edit behavior must remain unchanged.
- Mask must be PNG.
- Mask byte size is capped.
- Source image and mask dimensions must match.
- Mask PNG must include an alpha channel.
- If upstream mask support is not verified, return `EDIT_MASK_NOT_SUPPORTED`
  instead of silently degrading to prompt-only or full-image edit.
- Invalid mask returns a stable validation code.
- Logs must record only mask presence/size, never raw mask data.

## Frontend Mask Renderer

`ui/src/lib/canvas/maskRenderer.ts`

```ts
import type { BoundingBox } from "../../types/canvas";

export async function renderMaskFromBoxes(input: {
  imageElement: HTMLImageElement;
  boxes: BoundingBox[];
}): Promise<Blob> {
  // canvas size = natural image size
  // fill base mask
  // fill each normalized box region according to provider convention
  // return PNG blob
}
```

The function must:

- use `imageElement.naturalWidth` / `naturalHeight`;
- reject empty boxes;
- clamp box coordinates;
- return `canvas.toBlob(..., "image/png")`;
- never use DOM layout size for mask pixels.

## Canvas Flow

`ui/src/components/Canvas.tsx`

```diff
+ async function handleEditWithMask(): Promise<void> {
+   if (!imageElementRef.current || annotations.boxes.length === 0) return;
+   if (annotations.isDirty || annotations.hasAnnotations) {
+     const saved = await saveCanvasVersionAndUseReference();
+     if (!saved) return;
+   }
+   const mask = await renderMaskFromBoxes({
+     imageElement: imageElementRef.current,
+     boxes: annotations.boxes,
+   });
+   await submitMaskedEdit({ mask });
+ }
```

Important integration rule:

- `saveCanvasVersionAndUseReference()` must remain the single save boundary.
- Mask edit must not duplicate canvas version creation logic.
- If Phase 4 reference attach fails, mask edit does not proceed.

## Toolbar

`CanvasToolbar.tsx`

```diff
+ onEditWithMask?: () => void;
+ canEditWithMask?: boolean;
+ isEditingWithMask?: boolean;
```

Add an icon-only mask-edit button:

```tsx
<button
  type="button"
  disabled={!canEditWithMask || isEditingWithMask}
  aria-label={t("canvas.toolbar.editMask")}
  title={t("canvas.toolbar.editMask")}
>
  <MaskEditIcon />
</button>
```

No visible debug text. Button is disabled until at least one box exists.

## API Client

`ui/src/lib/api.ts`

```diff
 export function postEdit(payload: GenerateRequest & {
   mask?: string;
 }): Promise<GenerateResponse>;
```

Mask blob must be converted to base64/data URL by a small helper before calling
`postEdit`, matching the existing edit payload format.

## i18n

```json
{
  "canvas": {
    "toolbar": {
      "editMask": "Edit selected area",
      "editMaskDisabled": "Draw a box first",
      "editMaskFailed": "Masked edit failed"
    }
  }
}
```

Korean:

```json
{
  "canvas": {
    "toolbar": {
      "editMask": "선택 영역 편집",
      "editMaskDisabled": "먼저 박스를 그려주세요",
      "editMaskFailed": "마스크 편집 실패"
    }
  }
}
```

## Tests

Required checks:

- `maskRenderer.ts` creates PNG from one box.
- Multiple boxes are included.
- Empty boxes reject or disable path.
- Toolbar disables edit-mask without boxes.
- `routes/edit.js` accepts optional mask.
- Invalid mask payload returns validation error.
- No-mask edit path remains unchanged.
- Mask edit calls Phase 4 save boundary before edit when dirty.
- Mask edit does not proceed when save fails.

## Manual QA

- Draw one box and run masked edit.
- Draw multiple boxes and confirm all are included.
- Add memo/arrow, dirty close/save, then masked edit uses latest saved version.
- Try Edit with Mask without boxes; button is disabled.
- Confirm result lands in existing gallery/history flow.
