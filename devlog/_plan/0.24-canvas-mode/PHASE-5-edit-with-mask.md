# Canvas Mode Phase 5 - Edit With Mask

**Date**: 2026-04-28  
**Scope**: Use Canvas Mode boxes as image edit masks  
**Status**: Planned  
**Backend**: Required

## Goal

Let users draw one or more boxes on an image, convert those boxes into an edit
mask, and send the image plus mask to the existing edit flow.

## Files

### New

```text
ui/src/lib/canvas/maskRenderer.ts
tests/canvas-mask-contract.test.js
tests/edit-mask-api-contract.test.js
```

### Modify

```text
routes/edit.js
ui/src/components/canvas-mode/CanvasToolbar.tsx
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/lib/api/edit.ts
ui/src/i18n/en.json
ui/src/i18n/ko.json
```

## Backend API

`routes/edit.js`

```diff
  const {
    image,
+   mask,
    prompt,
    size,
  } = req.body;

+ if (mask !== undefined) {
+   validateBase64Png(mask, { maxBytes: EDIT_MASK_MAX_BYTES });
+ }

  const result = await client.images.edit({
    model: imageModel,
    image: toFile(image),
+   ...(mask ? { mask: toFile(mask) } : {}),
    prompt,
    size,
  });
```

Rules:

- `mask` is optional.
- `mask` must be a base64 PNG when present.
- Existing edit behavior stays unchanged when `mask` is omitted.
- Backend must return a clear validation error for malformed masks.

## Mask Renderer

`ui/src/lib/canvas/maskRenderer.ts`

```diff
+ export async function renderMaskFromBoxes(input: {
+   imageWidth: number;
+   imageHeight: number;
+   boxes: BoundingBox[];
+ }): Promise<Blob> {
+   const canvas = document.createElement("canvas");
+   const ctx = canvas.getContext("2d");
+   fill non-editable area;
+   fill selected boxes as editable mask area;
+   return canvasToBlob(canvas, "image/png");
+ }
```

The renderer should use the mask convention required by the active image edit
provider. If the provider convention changes, the renderer is the only frontend
module that should change.

## Toolbar Diff

`ui/src/components/canvas-mode/CanvasToolbar.tsx`

```diff
+ <button
+   type="button"
+   onClick={onEditWithMask}
+   disabled={boxes.length === 0 || isEditing}
+   title={t("canvas.toolbar.editMask")}
+ >
+   <WandSparkles />
+ </button>
```

## Shell Flow

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ async function handleEditWithMask(): Promise<void> {
+   if (annotations.boxes.length === 0) return;
+   const mask = await renderMaskFromBoxes({
+     imageWidth,
+     imageHeight,
+     boxes: annotations.boxes,
+   });
+   await submitEdit({ image: currentImage, mask, prompt: currentPrompt });
+ }
```

Flow:

1. User draws boxes around edit target areas.
2. User clicks Edit with Mask.
3. Frontend renders boxes into a PNG mask.
4. Existing edit request includes `mask`.
5. Result image enters the normal gallery/history path.

## i18n

```diff
+ "editMask": "Edit with mask",
+ "editMaskDisabled": "Draw a box first",
+ "editMaskFailed": "Masked edit failed"
```

Korean labels:

```diff
+ "editMask": "마스크로 편집"
+ "editMaskDisabled": "먼저 박스를 그려주세요"
+ "editMaskFailed": "마스크 편집 실패"
```

## Tests

- `maskRenderer.ts` creates a PNG blob from boxes.
- Toolbar disables Edit with Mask when no boxes exist.
- Edit API contract accepts optional `mask`.
- Invalid mask payload returns validation error.
- Existing no-mask edit path remains covered.

## Manual QA

- Draw one box and run masked edit.
- Draw multiple boxes and verify all become editable regions.
- Try Edit with Mask without boxes; button should be disabled.
- Confirm generated result lands in the same gallery/session flow.

