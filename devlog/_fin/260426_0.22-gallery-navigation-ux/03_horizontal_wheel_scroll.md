# 03 Horizontal Wheel Scroll

## Problem

Thumbnail strips are horizontal, but mouse users naturally scroll vertically.

The requested fix is not a vertical rail. Keep the current layout and convert vertical wheel movement to horizontal scrolling only when the pointer is over a horizontal thumbnail strip.

## UX Contract

- Keep current horizontal thumbnail layout.
- On thumbnail strip hover, vertical wheel scroll moves the strip left/right.
- Do not block page scroll if the strip cannot scroll horizontally.
- Do not block page scroll when the strip is already at the left or right edge.
- Preserve native horizontal trackpad gestures.
- Apply to Classic history strip first.
- Apply to Gallery thumbnail/action strip if it has horizontal overflow.
- Apply to Card News deck rail only if it overflows horizontally.

## Diff-level Plan

### NEW `ui/src/lib/horizontalWheel.ts`

```ts
export function handleHorizontalWheel(event: React.WheelEvent<HTMLElement>) {
  const el = event.currentTarget;
  const canScrollHorizontally = el.scrollWidth > el.clientWidth;
  if (!canScrollHorizontally) return;

  const verticalIntent = Math.abs(event.deltaY) > Math.abs(event.deltaX);
  if (!verticalIntent) return;

  const atStart = el.scrollLeft <= 0;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  const goingLeft = event.deltaY < 0;
  const goingRight = event.deltaY > 0;

  if ((goingLeft && atStart) || (goingRight && atEnd)) return;

  event.preventDefault();
  el.scrollLeft += event.deltaY;
}
```

### MODIFY `ui/src/components/HistoryStrip.tsx`

Add:

```tsx
import { handleHorizontalWheel } from "../lib/horizontalWheel";
```

Apply:

```tsx
<div className="history-strip" onWheel={handleHorizontalWheel}>
```

### MODIFY `ui/src/components/card-news/CardDeckRail.tsx`

Apply the same handler to the deck rail only if its current CSS supports horizontal overflow.

### MODIFY `ui/src/components/GalleryModal.tsx`

If Gallery has a horizontal thumbnail strip for Card News set thumbnails, apply the same handler there. Do not apply to the main vertical gallery list.

## Tests

### MODIFY `tests/gallery-navigation-ux-contract.test.js`

Assert:

- `horizontalWheel.ts` exists.
- Helper checks `scrollWidth > clientWidth`.
- Helper checks vertical intent.
- Helper checks start/end bounds.
- `HistoryStrip.tsx` uses `onWheel={handleHorizontalWheel}`.
- `CardDeckRail.tsx` uses the handler if the deck rail is horizontal.

## Manual QA

- Put mouse over the bottom thumbnail strip.
- Wheel down.
- Strip scrolls right.
- Wheel up.
- Strip scrolls left.
- At strip edge, page scroll is not trapped.
- Trackpad horizontal gesture still works.
