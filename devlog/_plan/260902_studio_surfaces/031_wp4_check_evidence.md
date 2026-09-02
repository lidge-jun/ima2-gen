# 031 — wp4 check evidence (Canvas vectorize)

Commits: e484115e (canvas trace workflow), 1be36749 (contracts).
Worker verifiers at 1be36749: typecheck, typecheck:tests, npm test, test:inventory,
ui build all exit 0. Main re-run at C: see receipt (`npm test`).

Deviations accepted from 030: `ReadonlyArray<T>` instead of the doc's invalid
`readonly Array<T>`; `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx` added
to the change set (required by 030 §3.5) and now sits at 521 lines — one over the
convention because the pre-existing 520-line file was not refactored inside this unit;
recorded as follow-up debt.

## Render grounding (fresh serve on 3461, agbrowse CDP, 1440x813 window)

| Screenshot | Observed |
|---|---|
| `evidence/030-canvas-export-menu-1280x720.png` | Canvas mode export menu lists PNG image / SVG (embedded raster) / Trace to SVG (vector) / PowerPoint slide |
| `evidence/030-canvas-vectorize-modal-1280x720.png` | Clicking Trace opens the shared Convert to SVG modal with the canvas PNG as Original, presets, and "Not traced yet" |
| `evidence/030-canvas-vectorize-result-1280x720.png` | Flat colour preset traced: "176 paths · 262KB", Vector result pane filled, Download SVG button, toast "Saved the SVG to your project" |
| `evidence/030-traced-svg-rendered.png` | The written SVG (`~/.ima2/generated/canvas-...-vector-1788300211892.svg`, 268787 bytes, `<svg width="832" height="1216">` with real `<path>` data) rendered back to PNG with sharp at 512x748 |

The staged PNG went through `POST /api/canvas-versions` and the vector-svg derived
route, so the result is a path-based SVG, not the embedded-raster wrapper.

## Activation grounding

| Path | Trigger | Observation |
|---|---|---|
| Trace error toast | `fetch` stubbed to return 500 `{error:"trace exploded"}` for `/api/assets/derived` | modal `[role=alert]` shows "trace exploded"; toast shows the same message |
| Cancel on close | `fetch` stubbed to a never-resolving promise; Close clicked mid-trace | request signal aborted (`abortedOnClose: true`), dialog removed |
| Embedded-raster label | export menu | "SVG (embedded raster)" distinct from "Trace to SVG (vector)" |

