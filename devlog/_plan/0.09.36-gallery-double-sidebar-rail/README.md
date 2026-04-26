---
created: 2026-04-27
tags: [ima2-gen, gallery, history-strip, ui, responsive-layout]
aliases:
  - gallery double sidebar rail
  - vertical history strip
  - gallery thumbnail sidebar
status: planning
owner: Boss
source:
  - community feedback 2026-04-26
  - user correction 2026-04-27 01:40
github_issues:
  - https://github.com/lidge-jun/ima2-gen/issues/6
  - https://github.com/lidge-jun/ima2-gen/issues/7
  - https://github.com/lidge-jun/ima2-gen/issues/8
---

# 0.09.36 — Gallery Double Sidebar Rail

This lane moves the compact gallery/history thumbnail strip out of the main
sidebar and turns it into a second narrow sidebar directly beside the existing
left sidebar.

The user's correction is important:

```text
지금처럼 하단에 작은 이런 걸 그냥 세로로 사이드바 옆에 이중사이드바로 한다고.
당연히 화면 너비 작아졌을때는 지금 작아졌을때처럼 가로로 내리면 되고.
```

So this is **not** a right-side gallery rail and **not** a full gallery modal
redesign. It is the existing small gallery button + thumbnail strip, rotated
into a desktop secondary rail.

## Scope

In scope:

- Move compact `HistoryStrip` out of `Sidebar`.
- Render it at app level immediately after `Sidebar`.
- Desktop layout:
  - existing main sidebar
  - adaptive narrow gallery rail immediately beside the sidebar
  - canvas / node canvas / card news workspace
  - right settings panel when present
- Gallery button stays at the top of the rail and no longer covers thumbnails.
- Thumbnails scroll vertically on desktop.
- The vertical rail uses viewport height, so it can show many more thumbnails
  than the current bottom strip.
- Active thumbnail auto-scrolls into view when `currentImage` changes.
- Narrow layout falls back to the current horizontal thumbnail strip behavior.
- Contract tests cover layout placement, active thumbnail scroll, and responsive
  fallback.

Out of scope:

- Full Gallery modal redesign.
- Liked queue / favorites.
- 21:9 size preset.
- Manual batch count.
- PNG metadata embedding.
- Viewer delete shortcuts.
- Sound alerts.
- ComfyUI integration.

Those are tracked in separate GitHub issues.

## Done Means

- On desktop, the compact gallery strip is a vertical rail between the left
  sidebar and the main workspace.
- On narrow screens, the rail becomes a horizontal strip matching the current
  mobile behavior.
- Selecting an image from the canvas, full gallery, or keyboard navigation keeps
  the active compact thumbnail visible.
- The gallery open button is visually separate from thumbnails and never masks
  the first few thumbnails.
- No backend changes are introduced.
- Tests pass:
  - `node --test tests/gallery-navigation-ux-contract.test.js`
  - `cd ui && npx tsc --noEmit`
  - `npm run ui:build`
