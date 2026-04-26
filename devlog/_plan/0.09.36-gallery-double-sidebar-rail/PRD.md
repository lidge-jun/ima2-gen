---
created: 2026-04-27
tags: [prd, ui, gallery, history-strip, responsive]
status: draft
github_issues:
  - https://github.com/lidge-jun/ima2-gen/issues/6
  - https://github.com/lidge-jun/ima2-gen/issues/7
  - https://github.com/lidge-jun/ima2-gen/issues/8
---

# PRD — Gallery Double Sidebar Rail

## 1. Problem

The current compact gallery/history strip is embedded at the bottom of the left
sidebar:

```tsx
<aside className="sidebar">
  <div className="sidebar__scroll">...</div>
  <HistoryStrip />
</aside>
```

This causes three UX problems reported by users:

1. The active thumbnail can be highlighted but not visible.
2. The gallery button is sticky inside the horizontal strip and visually masks
   the first thumbnails, leaving fewer visible thumbnails than expected.
3. The strip consumes vertical space inside the main sidebar, even though it is
   conceptually a separate image-history rail.

The user explicitly clarified that the desired layout is not a large gallery
panel on the right. The desired layout is the same compact strip, moved beside
the existing sidebar as a second thin sidebar.

## 2. Product Goal

Turn the compact gallery strip into a stable, always-visible desktop rail:

```text
+--------------+--------------+----------------------+--------------+
| main sidebar | gallery rail | workspace            | settings*    |
| prompt/tools | button/thumb | selected image/node  | optional     |
+--------------+--------------+----------------------+--------------+
```

On narrow screens, it folds back to the current horizontal behavior:

```text
+----------------------+
| main sidebar         |
+----------------------+
| gallery button/thumb |
+----------------------+
| workspace            |
+----------------------+
```

## 3. User Stories

### 3.1 Desktop user reviewing outputs

As a desktop user, I want the generated thumbnails to stay visible beside the
sidebar, so I can switch outputs without opening the full gallery modal.

Acceptance:

- Gallery rail is directly beside the main sidebar.
- The gallery open button is at the top of the rail.
- Thumbnails are stacked vertically below the button.
- Scrolling the rail does not scroll the prompt/options sidebar.

### 3.2 User navigating with arrow keys

As a user navigating images with arrow keys, I want the active thumbnail to
scroll into view automatically.

Acceptance:

- `Canvas` arrow navigation updates `currentImage`.
- `HistoryStrip` observes `currentImage`.
- The active thumbnail calls `scrollIntoView()` after selection changes.
- The scroll target is centered or nearest-visible without jumping the full app.

### 3.3 Narrow-screen user

As a narrow-screen user, I want the existing horizontal strip behavior to remain
familiar.

Acceptance:

- At the existing responsive breakpoint, the gallery rail becomes horizontal.
- Vertical wheel mapping is not applied to vertical desktop mode.
- Horizontal wheel mapping remains available in horizontal mode.
- The gallery button remains sticky on the left in horizontal mode.

## 4. UX Specification

### 4.1 Desktop layout

- `HistoryStrip` becomes an app-level adaptive rail.
- The product requirement is not "always show four fixed columns". The
  requirement is "main sidebar followed by gallery rail, then the active
  workspace, then optional settings".
- The right settings panel remains optional and should collapse naturally when
  it is not rendered.
- Recommended desktop track intent:
  - existing main sidebar width
  - adaptive gallery rail width, e.g. a narrow clamp range around `72px`-`112px`
  - `minmax(0, 1fr)` workspace
  - `auto` right panel when present
- `HistoryStrip` is an app-level child, not a child of `Sidebar`.
- `HistoryStrip` receives orientation through CSS, not a separate state flag.
- Desktop `.history-strip`:
  - `flex-direction: column`
  - `overflow-y: auto`
  - `overflow-x: hidden`
  - `border-right: 1px solid var(--border)`
  - no `border-top`
- Vertical rail height should use the full viewport so more thumbnails are
  visible than in the current bottom strip.
- `.history-thumb--add`:
  - sticky at `top: 0`
  - full rail width
  - no left sticky shadow

### 4.2 Narrow layout

- Existing `@media (max-width: 800px)` becomes:
  - `.app` rows: sidebar, history strip, workspace
  - `.history-strip` returns to horizontal mode
  - `.history-thumb--add` sticky on the left
- Right panel drawer behavior remains unchanged.

### 4.3 Auto-scroll active thumbnail

`HistoryStrip` should keep an element ref per item key. When `currentImage`
changes:

- Compute active key with the same identity rule used for selection:
  - preferred: `filename`
  - fallback: `image` / `url`
- Find active thumbnail DOM node.
- Call `scrollIntoView({ block: "nearest", inline: "nearest" })`.

Use `nearest`, not `center`, for the compact rail to avoid over-scrolling on
every arrow key press.

### 4.4 Wheel behavior

Current horizontal strip uses `handleHorizontalWheel` to map vertical wheel
input into horizontal scroll. In desktop vertical mode, that mapping is wrong.

Implementation direction:

- Keep `handleHorizontalWheel`.
- Only attach it in horizontal mode if feasible, or make it no-op when the
  element is taller than it is wide / vertical rail mode is detected.
- Contract test should ensure the vertical rail is not forced through
  horizontal-only behavior.

## 5. Implementation Scope

### 5.1 `ui/src/App.tsx`

Move `HistoryStrip` to app-level layout:

```tsx
<Sidebar />
<HistoryStrip />
{workspace}
{right panel}
```

Reason:

- The gallery rail is a sibling of the sidebar, not content inside it.

### 5.2 `ui/src/components/Sidebar.tsx`

Remove `HistoryStrip` import and render from `Sidebar`.

Reason:

- Sidebar should own prompt/tools/session controls only.
- Gallery rail gets its own layout column.

### 5.3 `ui/src/components/HistoryStrip.tsx`

Add active item refs and auto-scroll:

- import `useEffect`, `useRef` from React
- compute stable item key
- assign refs to thumbnails
- scroll active thumb into view on `currentImage` / `history` changes

Keep:

- existing gallery button behavior
- existing thumbnail click behavior
- existing active class

### 5.4 `ui/src/index.css`

Update layout and responsive rules:

- desktop `.app` grid columns
- desktop `.history-strip` vertical rail
- desktop scrollbar dimensions
- desktop `.history-thumb--add` top sticky
- mobile `.history-strip` horizontal fallback
- mobile `.history-thumb--add` left sticky fallback

### 5.5 Tests

Extend `tests/gallery-navigation-ux-contract.test.js`:

- `HistoryStrip` is imported/rendered from `App.tsx`.
- `Sidebar.tsx` no longer imports/renders `HistoryStrip`.
- `.app` defines a gallery rail grid column.
- desktop `.history-strip` uses vertical overflow.
- mobile `.history-strip` falls back to horizontal overflow.
- `HistoryStrip` uses refs and `scrollIntoView()` for active thumbnail.
- Existing `handleHorizontalWheel` guard is sufficient for vertical desktop
  mode because it returns when there is no horizontal overflow.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Card News workspace layout may inherit the rail unexpectedly | Keep rail app-level but test app child order. If needed, hide rail in card-news later, but not in this slice unless required. |
| Right panel grid column may shift incorrectly | Use explicit four-column app grid and existing drawer media rules. |
| Mobile layout could become too tall | Preserve current horizontal compact strip and current sidebar max-height behavior. |
| Auto-scroll could be jittery | Use `nearest`, not `center`, for compact rail. |
| `HistoryStrip` file grows too much | Keep helper functions small; split only if needed. |

## 7. Non-goals

- Do not redesign the full gallery modal.
- Do not add likes/favorites.
- Do not add new storage schema.
- Do not add new backend APIs.
- Do not change generation behavior.
- Do not move prompt composer in this slice.
