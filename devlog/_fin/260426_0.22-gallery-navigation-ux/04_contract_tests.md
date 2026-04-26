# 04 Contract Tests

## Goal

Lock the navigation UX with source-contract tests before adding browser E2E.

This prevents regressions without making CI depend on live image generation or a real browser.

## Diff-level Plan

### NEW `tests/gallery-navigation-ux-contract.test.js`

Test groups:

```text
keyboard navigation
gallery position restore
horizontal wheel scroll
localization
```

### Keyboard Assertions

- `Canvas.tsx` has a focusable image viewer.
- `Canvas.tsx` handles `ArrowLeft`.
- `Canvas.tsx` handles `ArrowRight`.
- `Canvas.tsx` calls `selectImage`.
- `Canvas.tsx` ignores editable targets via `isEditableTarget`.

### Restore Assertions

- `GalleryModal.tsx` has `scrollRef`.
- `GalleryModal.tsx` has `itemRefs`.
- `GalleryModal.tsx` has `lastScrollTopRef`.
- `GalleryModal.tsx` calls `scrollIntoView`.
- Restore is frontend-only.

### Wheel Assertions

- `horizontalWheel.ts` exists.
- It checks horizontal overflow.
- It checks vertical wheel intent.
- It avoids trapping scroll at edges.
- `HistoryStrip.tsx` uses it.

### i18n Assertions

- `canvas.imageViewerAria` exists in Korean.
- `canvas.imageViewerAria` exists in English.

## Verification Commands

```bash
node --test tests/gallery-navigation-ux-contract.test.js
node --test tests/gallery-navigation-ux-contract.test.js tests/card-news-smoke.test.js tests/card-news-frontend-contract.test.js
cd ui && npx tsc -b --pretty false
npm test
npm run build
git diff --check
```

## Manual Smoke Checklist

- Focus generated image and press arrow keys.
- Reopen Gallery after selecting a lower image.
- Wheel over horizontal thumbnail strip.
- Confirm no console errors.
