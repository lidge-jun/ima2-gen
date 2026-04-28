# Canvas Mode Master Plan

**Date**: 2026-04-28  
**Scope**: Canvas Mode roadmap split into phase-level implementation plans  
**Status**: Phase 1-4 baseline implemented with QA fixes, Phase 5 planned, Phase 6-9 backlog

This file is the index only. The diff-level implementation detail lives in the
phase documents listed below.

## Phase Index

| Phase | Document | Feature | Backend | Status |
|---|---|---|---|---|
| 1 | `PHASE-1-canvas-viewer.md` | Canvas Viewer: dot grid, zoom, ESC | No | Done |
| 2 | `PHASE-2-annotation-tools.md` | Pen, box, arrow, toolbar | No | Done |
| 3 | `PHASE-3-sticky-memo-export-mobile.md` | Apply merged image, sticky memo, export, mobile polish | No | Done |
| 4 | `PHASE-4-annotation-persistence.md` | Canvas version + editable draft persistence | Yes | Baseline implemented + QA patched |
| 5 | `PHASE-5-edit-with-mask.md` | Use boxes as edit masks on saved canvas versions | Yes | Planned after QA patch |
| 6 | `PHASE-6-undo-redo-history.md` | Undo/redo and history stack | No | Backlog |
| 7 | `PHASE-7-multiselect-group-actions.md` | Multi-select, move, delete group | No | Backlog |
| 8 | `PHASE-8-color-palette-styles.md` | Color palette and stroke styles | No | Backlog |
| 9 | `PHASE-9-object-eraser.md` | Object model, object eraser, freehand eraser | No | Backlog |

## Shared Decisions

- Coordinates are stored normalized from `0.0` to `1.0`, then mapped to image
  pixels at render time.
- Phase 1-3 annotation state starts local to Canvas Mode.
- Phase 4 persists editable source drafts and saves baked canvas version PNGs.
- Phase 5 must use the Phase 4 save boundary before masked edits when Canvas is dirty.
- Default viewer, Gallery, and HistoryStrip show the original/source image only.
  Canvas version files are internal per-source assets and must not appear as
  normal gallery/history items.
- Canvas Mode resolves and displays the latest saved canvas version for the
  current source image. Exiting Canvas returns the default viewer to the source
  image view.
- `Continue Here`, copy, and download are context-aware:
  - default viewer actions use the source/original image;
  - Canvas Mode actions use the canvas-edited version.
- Canvas version prompts inherit the source image prompt. Do not reintroduce
  long prompt custom headers; the raw PNG canvas-version API must stay header
  light to avoid HTTP 431.
- Saved canvas versions are reference-ready through compressed data URLs, never
  raw `/generated/...` reference payloads.
- The physical MacBook `Esc` key must close Canvas Mode from normal Canvas focus
  states. If focus is inside a memo/textarea, `Esc` should blur the editor first
  and the next `Esc` should close Canvas.
- A later object/eraser phase should make Canvas annotations explicitly
  object-addressable and add two eraser modes: object eraser for whole
  annotation objects and freehand eraser for pixel-like stroke removal.
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
- ESC closes Canvas Mode on MacBook hardware keyboards and browser keyboards.
- ESC inside a memo/textarea blurs the field first, then a second ESC closes Canvas.
- Gallery and HistoryStrip do not show canvas version files.
- Default viewer actions use the source image; Canvas actions use the canvas version.
- Canvas version `Continue Here` carries the source prompt, not "no prompt".
- `+`, `-`, and `0` control zoom.
- Mouse wheel does not unexpectedly zoom the browser or image.
- Sidebars remain pinned to their original app layout.
- Annotation overlays scale with the image, not the viewport.
- Mobile controls fit without covering the core image action area.
