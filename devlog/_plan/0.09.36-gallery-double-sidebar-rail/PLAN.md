---
created: 2026-04-27
tags: [plan, gallery, ui, responsive, history-strip]
status: draft
---

# PLAN — 0.09.36 Gallery Double Sidebar Rail

## Part 1 — Easy Explanation

The current compact gallery strip lives at the bottom of the left sidebar.
This plan moves that exact small gallery control into its own thin vertical
rail immediately beside the existing sidebar.

Desktop:

```text
[sidebar] [adaptive gallery rail] [workspace] [settings if present]
```

Narrow screens:

```text
[sidebar]
[horizontal gallery strip]
[workspace]
```

The selected thumbnail should also scroll into view automatically whenever the
current image changes by click, gallery selection, or arrow-key navigation.

## Part 2 — Diff-Level Plan

### 1. `ui/src/App.tsx` — MODIFY

Current:

```tsx
<Sidebar />
{workspace}
{uiMode === "card-news" ? null : <RightPanel />}
```

Planned:

```tsx
<Sidebar />
<HistoryStrip />
{workspace}
{uiMode === "card-news" ? null : <RightPanel />}
```

Also add:

```tsx
import { HistoryStrip } from "./components/HistoryStrip";
```

Purpose:

- Make the compact gallery strip a sibling column next to the sidebar.

### 2. `ui/src/components/Sidebar.tsx` — MODIFY

Remove:

```tsx
import { HistoryStrip } from "./HistoryStrip";
...
<HistoryStrip />
```

Purpose:

- Keep sidebar focused on prompt/tools/session controls.
- Avoid nesting the gallery rail inside the scrollable sidebar.

### 3. `ui/src/components/HistoryStrip.tsx` — MODIFY

Add:

- `import { useEffect, useRef } from "react"`
- stable active thumbnail key
- active thumbnail ref map
- `scrollIntoView({ block: "nearest", inline: "nearest" })`

Current identity logic:

```tsx
const active = item.filename
  ? currentImage?.filename === item.filename
  : currentImage?.image === item.image;
```

Planned helper:

```tsx
function getHistoryItemKey(item: GenerateItem): string {
  return item.filename ?? item.url ?? item.image;
}
```

Active thumb scroll:

```tsx
useEffect(() => {
  const key = currentImage ? getHistoryItemKey(currentImage) : null;
  if (!key) return;
  thumbRefs.current[key]?.scrollIntoView({ block: "nearest", inline: "nearest" });
}, [currentImage, history]);
```

Purpose:

- Highlighted thumbnail becomes visible automatically.
- Arrow-key navigation in `Canvas` also updates the rail position because it
  already updates `currentImage`.

### 4. `ui/src/index.css` — MODIFY

Desktop `.app`:

```css
.app {
  --gallery-rail-w: clamp(72px, 7vw, 112px);
  grid-template-columns: 260px var(--gallery-rail-w) minmax(0, 1fr) auto;
}
```

This is not a hard product rule that the app must always show four visible
columns. It is the desktop grid expression for the intended dynamic layout:
main sidebar, adaptive gallery rail, active workspace, and optional right panel.
If the right panel is not rendered, the auto track naturally contributes no
visible settings panel.

Desktop `.history-strip`:

```css
.history-strip {
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--border);
  border-top: 0;
  padding: 10px;
}
```

Desktop `.history-thumb--add`:

```css
.history-thumb--add {
  position: sticky;
  top: 0;
  left: auto;
}
```

Responsive fallback under the existing breakpoint:

```css
@media (max-width: 800px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }
  .history-strip {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .history-thumb--add {
    top: auto;
    left: 0;
  }
}
```

Purpose:

- Desktop uses the corrected double-sidebar layout.
- Vertical rail can show many more thumbnails than the current bottom strip
  because it can use viewport height.
- Narrow screens preserve the familiar horizontal strip behavior.

### 5. `ui/src/lib/horizontalWheel.ts` — REVIEW ONLY / NO MODIFY EXPECTED

Current horizontal wheel mapping is useful only for horizontal strips.

Audit result:

The needed guard already exists:

```ts
if (el.scrollWidth <= el.clientWidth) return;
```

Purpose:

- Prevent desktop vertical gallery rail from interpreting vertical wheel input
  as horizontal scrolling.
- No source change is expected unless implementation reveals a new edge case.

### 6. `tests/gallery-navigation-ux-contract.test.js` — MODIFY

Add contract coverage:

- `App.tsx` imports and renders `HistoryStrip`.
- `Sidebar.tsx` does not render `HistoryStrip`.
- CSS app grid includes a second gallery rail column.
- Gallery rail width is adaptive, not a hard-coded product constant.
- Desktop `.history-strip` is vertical with `overflow-y`.
- Responsive `.history-strip` returns to horizontal with `overflow-x`.
- `HistoryStrip.tsx` uses refs and `scrollIntoView`.
- `scrollIntoView` uses `nearest`.
- `horizontalWheel.ts` keeps its existing no-horizontal-overflow guard.

## Verification

Targeted:

```bash
node --test tests/gallery-navigation-ux-contract.test.js
```

Static / build:

```bash
cd ui && npx tsc --noEmit
npm run ui:build
```

Manual smoke:

```text
1. Generate/select multiple images.
2. Confirm compact gallery appears as a vertical rail beside the sidebar.
3. Click thumbnails and verify current image changes.
4. Use ArrowLeft/ArrowRight on focused image viewer.
5. Confirm active thumbnail scrolls into view.
6. Resize below 800px and confirm strip becomes horizontal again.
```
