# Oracle Audit

**Status**: complete
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `app weight audit`
**Output**: `/tmp/oracle-app-weight-audit.md`

## Verdict

**NEEDS_FIX**

Oracle agreed the direction is sound, but the plan needed corrections before
implementation.

## Blockers

1. Phase A reduces package/install weight, not default UI runtime cost. Do not
   present sourcemap removal as the app responsiveness fix.
2. Verification commands must be root-safe; avoid `cd ui && ...` followed by
   root commands in the same copied block.
3. Do not lazy-load `Canvas.tsx` wholesale because it is the default classic
   surface. Split Canvas Mode internals later.
4. `NodeCanvas` is the safest high-impact runtime split because it is mode-gated
   and imports React Flow.
5. Card News and Prompt Library need explicit coverage; `PromptLibraryPanel` is
   also an eager import from `App.tsx`.
6. Asset allowlist tightening can break runtime behavior unless runtime assets
   are inventoried first.
7. Downscaled Canvas preview is unsafe unless final apply/export always
   recomputes from natural source dimensions.
8. CSS size must be measured separately; JS lazy-loading may not reduce global
   CSS if styles stay centralized.

## Revised Ordering

```text
A.1 sourcemap opt-in + package map contract
A.2 asset allowlist after runtime inventory
B.0 bundle measurement/manifest/report-only guard
B.1 lazy-load NodeCanvas + CardNewsWorkspace + PromptLibraryPanel
B.2 lazy-load Settings + Prompt Import/Dialog subflows
B.3 split Canvas Mode internals
C Canvas runtime performance
```

## Smallest Safe First PR

Implement **A.1 only**:

- make production sourcemaps opt-in;
- add/adjust package contract for no `.map` files in normal packed output;
- keep runtime assets untouched;
- do not claim runtime speedup.

## Smallest Safe Runtime PR

After A.1, implement **B.1**:

- lazy-load `NodeCanvas`;
- lazy-load `CardNewsWorkspace`;
- lazy-load `PromptLibraryPanel`;
- use local `Suspense` boundaries;
- verify chunks moved using build output or manifest.

---

## Post-TS Re-Audit

**Status**: needs-fix
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `app-weight-node-audit`
**Date**: 2026-04-29

### Verdict

**NEEDS_FIX**

Oracle confirmed that the Node/React Flow boundary is probably correct:

- `App.tsx` lazy-loads `NodeCanvas`.
- `NodeCanvas.tsx` owns the `@xyflow/react` import.
- `ImageNode.tsx` imports React Flow handles, but is only imported by `NodeCanvas`.

The blocker was verification strength and adjacent eager Canvas Mode code, not an obvious eager React Flow import.

### Blocking Findings

1. `Canvas.tsx` still imports Canvas Mode helper modules at top level, so the default classic path can still pay for annotation/render/export/background-removal helpers even though visible Canvas Mode widgets are lazy.
2. `tests/app-weight-splitting-contract.test.js` only proved that a `NodeCanvas-*` chunk existed; it did not fail when the manifest was absent or prove that node-mode chunks were excluded from the entry static import graph.
3. `prepack` built only server/CLI artifacts even though `ui/dist/` is part of the package payload.
4. `npm start` used `tsx server.ts`, but `tsx` is a devDependency; package runtime should use emitted JS.

### Applied Follow-Up

- Strengthened the bundle contract so missing `ui/dist/.vite/manifest.json` fails and the entry static import graph is checked against lazy chunks.
- Added package smoke coverage for representative emitted JS runtime files.
- Changed package lifecycle so `prepack` and `prepublishOnly` build the UI before packaging.
- Changed `npm start` to use the emitted CLI runtime path.

### Remaining Follow-Up

Split heavy Canvas Mode helper imports out of the default `Canvas.tsx` module,
ideally by introducing a lazy Canvas Mode controller/layer mounted only while
`canvasOpen` is true. The proposed diff-level plan is documented in
`PHASE-B3-canvas-mode-controller-split.md` and should be audited before code
implementation.

### B.3 Diff Plan Audit

**Status**: needs-fix
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `canvas split plan audit`
**Date**: 2026-04-29

Oracle agreed that Node/React Flow should not block B.3, because the obvious
React Flow value imports are confined to the lazy `NodeCanvas` path and
`useAppStore.ts` uses `import type` for React Flow types.

Oracle did not approve direct implementation yet. Required corrections:

- write failing import/bundle guards first;
- prove `Canvas.tsx` no longer statically imports Canvas Mode helpers;
- prove the entry static JS content does not contain Canvas helper or React Flow
  sentinels;
- avoid wiring `CanvasModeShell` as-is because its direct `closeCanvas()` path
  can bypass the current save-before-close behavior;
- preserve natural-dimension final apply/export/mask/background cleanup.

These corrections were folded into
`PHASE-B3-canvas-mode-controller-split.md`; the updated plan is pending
re-audit before production refactoring begins.

### B.3 Corrected Plan Re-Audit

**Status**: pass
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `canvas split plan reaudit`
**Date**: 2026-04-29

Oracle approved the corrected plan as sound enough to implement after reporting
to the user. Remaining conditions are implementation details, not blockers:

- bundle checks must fail if the Vite manifest is missing;
- React Flow checks must inspect the built entry/static graph, not source text,
  because type-only imports are safe;
- all close paths must share one async save-before-close function;
- saved/exported/final background-cleanup outputs must assert natural image
  dimensions.

Smallest safe order:

```text
1. Report PASS and scope.
2. Add test-first guards only, then stop.
3. Confirm expected pre-refactor guard failures.
4. Create lazy CanvasModeWorkspace and move Canvas Mode-only imports/state/effects.
5. Keep Canvas.tsx as Classic/default viewer shell.
6. Verify source guards, close flow, natural dimensions, typecheck, tests,
   ui build, and static bundle sentinel.
```

### B.3 Modularization Audit

**Status**: needs-fix
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `canvas modular plan audit`
**Date**: 2026-04-29

Oracle agreed that feature modularization improves the plan, but required the
module shape to stay narrower:

- `canvas-mode/index.ts` must export only `CanvasModeWorkspace` and type-only
  props if needed;
- avoid broad runtime re-exports from the feature barrel;
- rename/remove `canvasModeActions`; use `canvasModeHelpers` only for pure
  helper functions and keep side effects inside hooks;
- delete `CanvasModeShell` during B.3 rather than leaving it as dead code;
- do not keep nested lazy widget chunks inside the already lazy
  `CanvasModeWorkspace`;
- update bundle tests to target the `canvas-mode/index.ts` feature boundary
  instead of individual Canvas widget chunks.

These corrections are now folded into
`PHASE-B3-canvas-mode-controller-split.md` and should be re-audited before
production refactoring starts.

### B.3 Modularization Re-Audit

**Status**: needs-fix
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `canvas modular plan reaudit`
**Date**: 2026-04-29

Oracle confirmed the narrow barrel, `canvasModeHelpers`, static internal widget
imports, feature-boundary tests, and `Canvas.tsx` lazy `./canvas-mode` entry are
sound. The only remaining fix was to make `CanvasModeShell.tsx` a deletion
target instead of leaving it unused, because it contains duplicate shell/close
behavior and can become an accidental bypass of the save-aware close path.

The B.3 plan now marks `CanvasModeShell.tsx` as `DELETE`.

### B.3 Modularization Final Re-Audit

**Status**: pass
**Engine**: browser
**Model**: `gpt-5-pro`
**Session slug**: `canvas modular final pass 2`
**Date**: 2026-04-29

Oracle returned `PASS`: the B.3 plan is internally consistent for
implementation because the lazy import targets `./canvas-mode`, stale deep
import wording is gone, tests target the feature boundary, and
`CanvasModeShell.tsx` is clearly `DELETE`-only.

## Phase C Closeout Review

After B.3 implementation, Phase C runtime safeguards are already represented in
the current code and contracts:

- `useCanvasBackgroundCleanup.ts` owns stale-render cancellation and tolerance
  debounce;
- `alphaDetect.ts` caches alpha scans per image element/source/dimensions;
- `backgroundRemoval.ts` supports downscaled mask overlays while preserving
  natural image dimensions for final output paths;
- `tests/canvas-background-cleanup-contract.test.js` locks these guarantees.

No additional production refactor is planned for Phase C unless audit finds a
missing runtime path.
