# Canvas Mode Master Plan

**Date**: 2026-04-28  
**Scope**: Canvas Mode roadmap split into phase-level implementation plans  
**Status**: Phase 1 done, Phase 2 ready, Phase 3-5 planned, Phase 6-8 backlog

This file is the index only. The diff-level implementation detail lives in the
phase documents listed below.

## Phase Index

| Phase | Document | Feature | Backend | Status |
|---|---|---|---|---|
| 1 | `PHASE-1-canvas-viewer.md` | Canvas Viewer: dot grid, zoom, ESC | No | Done |
| 2 | `PHASE-2-annotation-tools.md` | Pen, box, arrow, toolbar | No | Ready |
| 3 | `PHASE-3-sticky-memo-export-mobile.md` | Apply merged image, sticky memo, export, mobile polish | No | Planned |
| 4 | `PHASE-4-annotation-persistence.md` | Save annotations by image/browser | Yes | Planned |
| 5 | `PHASE-5-edit-with-mask.md` | Use boxes as edit masks | Yes | Planned |
| 6 | `PHASE-6-undo-redo-history.md` | Undo/redo and history stack | No | Backlog |
| 7 | `PHASE-7-multiselect-group-actions.md` | Multi-select, move, delete group | No | Backlog |
| 8 | `PHASE-8-color-palette-styles.md` | Color palette and stroke styles | No | Backlog |

## Shared Decisions

- Coordinates are stored normalized from `0.0` to `1.0`, then mapped to image
  pixels at render time.
- Phase 1-3 annotation state stays local to Canvas Mode.
- Phase 4 introduces persistence and can promote annotation state into a shared
  hook/store boundary.
- The dot grid belongs only inside the image canvas area, not around the left
  sidebar or right panel.
- The first implementation should keep the image position stable. Tools are
  overlays on the existing viewer, not a separate full-screen editor.

## Shared File Families

```text
ui/src/components/canvas-mode/
ui/src/lib/canvas/
ui/src/hooks/
ui/src/types/canvas.ts
ui/src/styles/canvas-mode.css
tests/*canvas*contract.test.js
```

## Shared Performance Budget

| Constraint | Budget |
|---|---|
| Annotation canvas backing store | max 2048px on long edge before downscale |
| Path points before simplification | 5000 |
| Memo count before virtualization | 50 |
| History stack size | 50 snapshots |
| Pointer event render cadence | `requestAnimationFrame` |
| Zoom range | `0.5` to `3.0` |

## Shared Manual QA

- Double-click opens Canvas Mode.
- ESC closes Canvas Mode.
- `+`, `-`, and `0` control zoom.
- Mouse wheel does not unexpectedly zoom the browser or image.
- Sidebars remain pinned to their original app layout.
- Annotation overlays scale with the image, not the viewport.
- Mobile controls fit without covering the core image action area.
