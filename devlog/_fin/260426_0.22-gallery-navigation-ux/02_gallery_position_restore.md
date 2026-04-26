# 02 Gallery Position Restore

## Problem

When the user selects a lower item in Gallery, closes Gallery, and opens it again, the list starts at the top.

This is not a backend or browser-cache issue. It is frontend state restoration.

## UX Contract

- Gallery remembers the last selected filename during the app session.
- When Gallery opens again, it scrolls the selected item into view.
- Prefer selected-item restore over raw `scrollTop`.
- If the selected item no longer exists, fallback to the last scroll position.
- Search query or grouping changes may reset restore behavior.
- No backend API changes.

## Diff-level Plan

### MODIFY `ui/src/store/useAppStore.ts`

There is already selected filename persistence via:

```ts
loadSelectedFilename()
saveSelectedFilename(filename)
```

Keep using this as the canonical selected item source.

No new backend state is needed.

### MODIFY `ui/src/components/GalleryModal.tsx`

Add refs:

```tsx
const scrollRef = useRef<HTMLDivElement | null>(null);
const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
const lastScrollTopRef = useRef(0);
```

On scroll:

```tsx
function handleScroll() {
  lastScrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
}
```

When Gallery opens:

```tsx
useLayoutEffect(() => {
  if (!open) return;
  const key = currentImage?.filename ?? currentImage?.image;
  const target = key ? itemRefs.current[key] : null;
  if (target) {
    target.scrollIntoView({ block: "center" });
    return;
  }
  if (scrollRef.current) scrollRef.current.scrollTop = lastScrollTopRef.current;
}, [open, currentImage?.filename, currentImage?.image, filtered.length, groupBy]);
```

Attach:

```tsx
<div className="gallery__scroll" ref={scrollRef} onScroll={handleScroll}>
```

Item ref:

```tsx
ref={(node) => {
  itemRefs.current[item.filename ?? item.image] = node;
}}
```

## Tests

### MODIFY `tests/gallery-navigation-ux-contract.test.js`

Assert:

- `GalleryModal.tsx` has `scrollRef`.
- `GalleryModal.tsx` has `itemRefs`.
- `GalleryModal.tsx` calls `scrollIntoView({ block: "center" })`.
- `GalleryModal.tsx` keeps `lastScrollTopRef`.
- No backend route file is changed for this behavior.

## Manual QA

- Open Gallery.
- Scroll down.
- Select a lower image.
- Close Gallery.
- Reopen Gallery.
- Selected image should be centered or at least visible.
