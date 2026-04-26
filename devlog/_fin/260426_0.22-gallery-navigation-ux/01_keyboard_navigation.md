# 01 Keyboard Navigation

## Problem

Generated images are visible, but keyboard navigation is missing.

Expected user behavior:

```text
focus generated image
press ArrowLeft  -> previous image
press ArrowRight -> next image
```

This is a frontend interaction issue, not a backend issue.

## UX Contract

- The generated image surface must be focusable.
- `ArrowLeft` selects the previous gallery/history item.
- `ArrowRight` selects the next gallery/history item.
- The order follows the current `history` order.
- The active image should stay visible in the thumbnail strip when changed by keyboard.
- Do not intercept arrow keys while the user is typing in `input`, `textarea`, `select`, or editable content.
- If a modal is open, modal-specific key handling wins.
- If there is no previous/next item, do nothing.

## Diff-level Plan

### MODIFY `ui/src/components/Canvas.tsx`

Add keyboard navigation to the main generated-image viewer.

Implementation shape:

```tsx
const history = useAppStore((s) => s.history);
const currentImage = useAppStore((s) => s.currentImage);
const selectImage = useAppStore((s) => s.selectImage);

function handleViewerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (isEditableTarget(event.target)) return;

  const currentIndex = history.findIndex((item) =>
    currentImage?.filename
      ? item.filename === currentImage.filename
      : item.image === currentImage?.image,
  );
  if (currentIndex < 0) return;

  const nextIndex = event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
  const next = history[nextIndex];
  if (!next) return;

  event.preventDefault();
  selectImage(next);
}
```

Viewer attributes:

```tsx
<section
  className="canvas__image-frame"
  tabIndex={0}
  onKeyDown={handleViewerKeyDown}
  aria-label={t("canvas.imageViewerAria")}
>
```

### NEW `ui/src/lib/domEvents.ts`

Shared helper:

```ts
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
```

### MODIFY `ui/src/i18n/ko.json`

Add:

```json
"imageViewerAria": "생성 이미지 뷰어. 좌우 방향키로 이전 또는 다음 이미지를 볼 수 있습니다."
```

### MODIFY `ui/src/i18n/en.json`

Add:

```json
"imageViewerAria": "Generated image viewer. Use left and right arrow keys to move between images."
```

## Tests

### MODIFY `tests/gallery-navigation-ux-contract.test.js`

Assert:

- `Canvas.tsx` imports `isEditableTarget`.
- `Canvas.tsx` handles `ArrowLeft` and `ArrowRight`.
- `Canvas.tsx` uses `selectImage(next)`.
- viewer has `tabIndex={0}`.
- i18n has `imageViewerAria`.

## Manual QA

- Click generated image.
- Press right arrow.
- Current image advances.
- Press left arrow.
- Current image returns.
- Put cursor in prompt textarea.
- Press arrows.
- Text cursor moves; image selection does not change.
