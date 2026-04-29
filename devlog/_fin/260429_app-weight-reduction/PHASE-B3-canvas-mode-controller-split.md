# Phase B.3 - Canvas Mode Workspace Split

## Status

**Oracle PASS. Stop before production refactor.**

This phase exists because the post-TypeScript Oracle re-audit found that the
Node/React Flow lazy boundary is likely sound, but the default classic `Canvas`
module still eagerly imports Canvas Mode helper code.

Oracle browser `gpt-5-pro` audited this plan on 2026-04-29 and agreed with the
direction, but blocked direct implementation until the import/bundle tests are
made stricter and the implementation order is test-first. Those corrections are
now folded into this version of the plan.

Oracle browser `gpt-5-pro` re-audited the corrected plan and returned **PASS**.
The plan is sound enough to implement after reporting to the user.

## Goal

Keep the classic generation/viewer path lightweight by moving Canvas Mode-only
state, event handling, render helpers, and UI wiring behind a lazy controller
that mounts only while `canvasOpen` is true.

## Current Findings

### Node Mode Boundary

Current source inspection shows the Node Mode UI is already behind a mode-level
dynamic import:

```text
ui/src/App.tsx
  LazyNodeCanvas -> import("./components/NodeCanvas")
```

`@xyflow/react` value imports are contained in Node Mode modules:

```text
ui/src/components/NodeCanvas.tsx
ui/src/components/ImageNode.tsx
ui/src/components/NodeBatchBar.tsx
```

`ui/src/store/useAppStore.ts` imports `FlowNode` and `FlowEdge` as types:

```ts
import type { Node as FlowNode, Edge as FlowEdge } from "@xyflow/react";
```

That type-only import should not create browser runtime cost after TypeScript
emit. The store still contains node graph actions, but the immediate heavy
React Flow boundary is not the primary blocker.

### Build Manifest Boundary

Fresh `npm run ui:build` emitted one entry chunk and lazy chunks for major
surfaces:

```text
entry: assets/index-DEATdk_J.js
entry imports: []
entry dynamicImports:
  src/components/NodeCanvas.tsx
  src/components/SettingsWorkspace.tsx
  src/components/card-news/CardNewsWorkspace.tsx
  src/components/PromptLibraryPanel.tsx
  src/components/canvas-mode/CanvasAnnotationLayer.tsx
  src/components/canvas-mode/CanvasMemoOverlay.tsx
  src/components/canvas-mode/CanvasToolbar.tsx
  src/components/canvas-mode/CanvasViewportMiniMap.tsx
  src/components/canvas-mode/CanvasZoomControl.tsx
```

Current build sizes:

```text
entry JS:       439.96 kB / gzip 133.56 kB
NodeCanvas JS: 186.81 kB / gzip  60.96 kB
```

The current test guard proves the existence of lazy Node and Canvas widget
chunks. It does not yet prove that Canvas Mode helper modules are excluded from
the classic entry graph, because those helpers are imported by `Canvas.tsx`
itself.

### Remaining Eager Canvas Imports

`ui/src/components/Canvas.tsx` is currently 1293 lines and imports these
Canvas Mode-only helpers at top level:

```text
../hooks/useCanvasAnnotations
../lib/canvas/coordinates
../lib/canvas/mergeRenderer
../lib/canvas/maskRenderer
../lib/canvas/hitTest
../lib/canvas/objectKeys
../lib/canvas/exportRenderer
../lib/canvas/alphaDetect
../lib/canvas/backgroundRemoval
../types/canvas
```

The `types/canvas` import is type-only and safe. The other imports are runtime
imports. Most of them are only useful while Canvas Mode is open.

## Before

`Canvas.tsx` owns both the classic viewer and Canvas Mode:

```text
Canvas.tsx
  classic image viewer
  drop-to-import behavior
  prompt/result metadata
  ResultActions
  Canvas Mode session lifecycle
  annotation reducer hook
  pointer hit testing
  viewport pan/zoom keyboard and wheel handlers
  annotation save/load/delete
  canvas version save/apply
  mask edit request
  export rendering
  background removal preview/apply
  alpha detection
  lazy Canvas Mode widgets
```

Because `Canvas.tsx` is the default classic workspace imported by `App.tsx`,
all value imports in `Canvas.tsx` are eligible for the initial bundle.

## After

Split the classic shell from the Canvas Mode workspace:

```text
Canvas.tsx
  classic image viewer shell
  drop-to-import behavior
  prompt/result metadata
  ResultActions
  image element and frame refs
  lazy CanvasModeWorkspace import

CanvasModeWorkspace.tsx
  Canvas Mode lifecycle
  annotation hook and autosave
  pointer hit testing and selection
  viewport pan/zoom handlers
  save/apply/close/export/edit-with-mask
  background cleanup preview/apply/undo
  alpha detection
  toolbar, annotation layer, memo overlay, minimap, zoom control
```

The intended import boundary:

```text
App.tsx -> Canvas.tsx
Canvas.tsx -> lazy import("./canvas-mode")
CanvasModeWorkspace.tsx -> Canvas Mode helper modules
```

## Modularization Plan

The first PASS plan only established the lazy boundary. The implementation
should also modularize Canvas Mode so future refactors and feature additions do
not recreate a 1000+ line component.

Use a feature-module layout inside the existing `canvas-mode` folder. Keep the
project's current React component naming style, but apply the cli-jaw/Lidge
principles:

```text
screaming feature folder
colocated state/actions/runtime helpers
single feature entry point
files under 500 lines
no Canvas Mode value imports from Canvas.tsx
```

Target structure:

```text
ui/src/components/canvas-mode/
  index.ts
  CanvasModeWorkspace.tsx
  CanvasModeStage.tsx
  CanvasModeTopbar.tsx
  CanvasAnnotationLayer.tsx
  CanvasMemoOverlay.tsx
  CanvasToolbar.tsx
  CanvasViewportMiniMap.tsx
  CanvasZoomControl.tsx
  CanvasBackgroundCleanupPanel.tsx
  useCanvasModeSession.ts
  useCanvasModeShortcuts.ts
  useCanvasModePointerHandlers.ts
  useCanvasBackgroundCleanup.ts
  canvasModeHelpers.ts
  canvasModeTypes.ts
```

Responsibility split:

```text
CanvasModeWorkspace.tsx
  orchestration only: compose hooks, wire callbacks, render topbar/stage/toolbar

CanvasModeStage.tsx
  image frame, annotation layer, memo overlay, cursor, pan/zoom transform

CanvasModeTopbar.tsx
  Canvas Mode label, zoom control, shortcut hint, close button

useCanvasModeSession.ts
  source image tracking, draft load/save/delete, canvas version save/apply/close

useCanvasModeShortcuts.ts
  1-6 tools, [, ], 0 zoom, Escape, undo/redo

useCanvasModePointerHandlers.ts
  normalized pointer conversion, hit-test, selection, drawing, eraser, memo

useCanvasBackgroundCleanup.ts
  seeds, tolerance, preview/mask/apply state, undo, stale render guard

canvasModeHelpers.ts
  pure display/source/response helpers only; no side effects

canvasModeTypes.ts
  local prop/session types that should not leak into Canvas.tsx

index.ts
  narrow barrel export for lazy entry only, plus type-only props if needed
```

Hard modularization rules:

```text
1. No new file over 500 lines.
2. CanvasModeWorkspace should stay under 250 lines if possible.
3. Canvas.tsx should shrink materially and remain a Classic/default shell.
4. Canvas.tsx may import only the lazy workspace entry, not internal hooks.
5. Canvas Mode internals import through local files or the feature barrel.
6. Background cleanup can remain in the first workspace split, but its state
   must already live in `useCanvasBackgroundCleanup.ts` so it can become a
   second-level lazy module later without another large rewrite.
7. The feature barrel must not re-export internal runtime modules.
8. Once `CanvasModeWorkspace` is lazy, its internal widgets should be normal
   static imports inside that workspace chunk. Do not keep nested lazy widget
   boundaries unless a later bundle report proves another split is needed.
```

Do not create a generic abstraction layer before there are two real consumers.
This is feature modularization, not framework extraction.

## Modularization Oracle Verdict

Oracle browser `gpt-5-pro` audited the added module layout and returned
**NEEDS_FIX** until these corrections were folded in:

```text
1. Keep index.ts narrow; export only CanvasModeWorkspace and type-only props.
2. Rename/remove canvasModeActions because it suggests a side-effect dumping
   layer; use canvasModeHelpers only for pure helpers.
3. Delete CanvasModeShell in the implementation plan.
4. Do not keep nested lazy Canvas widgets inside an already lazy workspace.
5. Update tests to target one canvas-mode feature boundary instead of five
   individually lazy widgets.
6. Keep canvasModeTypes local and small; do not duplicate shared canvas types.
```

These corrections are now part of the plan below.

## Prior Oracle Verdict

```text
NEEDS_FIX
```

Blocking findings:

```text
1. Canvas.tsx still statically imports Canvas Mode helper modules.
2. useCanvasAnnotations is called unconditionally in Canvas(), so annotation
   reducer/object-key/eraser/style-loading code still loads on classic startup.
3. Shared helper imports can make visible widget lazy chunks misleading because
   helpers may still live in the entry/static graph.
4. CanvasModeShell must not be wired as-is because its close path calls
   closeCanvas() directly and can bypass the current save-before-close behavior.
5. Node/React Flow does not appear to block B.3, but the test should prove the
   initial/static entry chunk does not contain React Flow runtime or CSS.
```

Required plan corrections:

```text
1. Write failing source and bundle contract tests first.
2. Add negative source assertions for Canvas.tsx static helper imports.
3. Add build/static-graph sentinel checks for Canvas helpers and React Flow.
4. Preserve current save-before-close semantics inside the lazy workspace.
5. Keep final apply/export/mask/background cleanup on natural image dimensions.
6. Treat background cleanup second-level lazy loading as optional follow-up,
   not part of the smallest first implementation.
```

All six corrections are now represented directly in the diff plan below.

## Refactor Stop Gate

Oracle has returned `PASS` on this updated plan.

Stop and report before editing production code. The next implementation step is
test-first guards only; production refactor starts after those guards are in
place and their expected pre-refactor failures are confirmed.

## Oracle Re-Audit Verdict

```text
PASS
```

Non-blocking implementation conditions:

```text
1. Bundle checks must fail if the Vite manifest is missing; do not skip.
2. React Flow checks must be bundle/static-graph checks, not naive source
   string checks, because type-only imports are safe.
3. Every close path must go through the same async save-before-close function:
   toolbar close, Escape, mode switch away, image/history navigation, and any
   parent-triggered close.
4. Natural dimensions must be asserted for saved canvas versions, export, and
   final background-cleanup output, not only preview rendering.
```

## Diff Plan

### B.3.0 - Write Failing Guards First

Do this before moving code.

#### MODIFY `tests/app-weight-splitting-contract.test.js`

Add source-level assertions:

```text
Canvas.tsx must lazy import CanvasModeWorkspace.
Canvas.tsx must not value-import:
  ../hooks/useCanvasAnnotations
  ../lib/canvas/coordinates
  ../lib/canvas/mergeRenderer
  ../lib/canvas/maskRenderer
  ../lib/canvas/hitTest
  ../lib/canvas/objectKeys
  ../lib/canvas/exportRenderer
  ../lib/canvas/alphaDetect
  ../lib/canvas/backgroundRemoval
```

Add build/static-graph assertions after `npm run ui:build`:

```text
entry static import graph must not include the canvas-mode feature chunk
entry static JS content must not include:
  useCanvasAnnotations
  renderMergedCanvasImage
  renderMaskFromBoxes
  renderBackgroundRemovalPreview
  removeContiguousBackground
  imageUsesAlpha
  @xyflow/react
  react-flow__renderer
```

React Flow checks must operate on the built entry static graph. Do not fail on
safe TypeScript source lines like `import type { Node } from "@xyflow/react"`.

Keep existing positive lazy-surface checks for:

```text
NodeCanvas
CardNewsWorkspace
PromptLibraryPanel
SettingsWorkspace
PromptImportDialog
Canvas Mode feature entry
```

The first run should fail against the current code because `Canvas.tsx`
currently imports the helpers.

Add modularity guards:

```text
CanvasModeWorkspace.tsx must stay under 500 lines
Canvas.tsx must stay under 500 lines after the refactor
canvas-mode/index.ts exports CanvasModeWorkspace
Canvas.tsx lazy import targets ./canvas-mode, not a deep internal helper
canvas-mode/index.ts must not use broad runtime export *
Canvas.tsx must not contain LazyCanvasAnnotationLayer/LazyCanvasToolbar/etc.
```

Add classic runtime/load guard if a browser harness is available:

```text
default Classic viewer render must not fetch canvas annotations
default Classic viewer render must not request CanvasModeWorkspace
opening Canvas Mode may then fetch annotations and request CanvasModeWorkspace
```

Suggested source assertion shape:

```js
const canvas = readSource("ui/src/components/Canvas.tsx");
assert.match(canvas, /lazy\(\(\) =>\s*import\("\.\/canvas-mode"\)/);
for (const forbidden of [
  "../hooks/useCanvasAnnotations",
  "../lib/canvas/coordinates",
  "../lib/canvas/mergeRenderer",
  "../lib/canvas/maskRenderer",
  "../lib/canvas/hitTest",
  "../lib/canvas/objectKeys",
  "../lib/canvas/exportRenderer",
  "../lib/canvas/alphaDetect",
  "../lib/canvas/backgroundRemoval",
]) {
  assert.doesNotMatch(canvas, new RegExp(`from ["']${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`));
}
```

Suggested bundle sentinel shape:

```js
const entryText = readEntryStaticJs(manifest, entries[0]);
for (const sentinel of [
  "useCanvasAnnotations",
  "renderMergedCanvasImage",
  "renderMaskFromBoxes",
  "renderBackgroundRemovalPreview",
  "removeContiguousBackground",
  "imageUsesAlpha",
  "@xyflow/react",
  "react-flow__renderer",
]) {
  assert.doesNotMatch(entryText, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
```

`readEntryStaticJs` should concatenate only the entry chunk and its static
imports as discovered through Vite manifest `imports`, not dynamic imports.

### MODIFY `ui/src/components/Canvas.tsx`

Keep:

```text
React shell hooks
useAppStore selectors for currentImage/history/import/drop/basic metadata
ResultActions
MultimodeSequencePreview
getCanvasDisplaySrc
withSourcePrompt
findCanvasVersionForSource
responseToGenerateItem only if still needed by shell; otherwise move
drop handlers
classic image element rendering
classic history keyboard shortcuts
openCanvas on double-click
```

Remove or move to `CanvasModeWorkspace.tsx`:

```text
useCanvasAnnotations
screenToNormalized
renderMergedCanvasImage
blobToDataUrl
imageElementToPngDataUrl
renderMaskFromBoxes
findAnnotationsInBox
hitTestAnnotation
normalizeSelectionBox
objectKeyMatches
downloadCanvasBlob
exportCanvasImage
makeCanvasExportFilename
imageUsesAlpha
getCornerBackgroundRemovalSeeds
renderBackgroundRemovalMaskOverlay
renderBackgroundRemovalPreview
BackgroundCleanupSnapshot
OBJECT_ERASER_CURSOR
BRUSH_ERASER_CURSOR
all background cleanup local state
annotation pointer handlers
Canvas Mode keyboard handlers
Canvas Mode wheel/pan handlers
Canvas version save/apply/close/export/edit-with-mask handlers
lazy CanvasAnnotationLayer/MemoOverlay/Toolbar/MiniMap/ZoomControl declarations
```

Add one lazy boundary:

```ts
const LazyCanvasModeWorkspace = lazy(() =>
  import("./canvas-mode").then((module) => ({
    default: module.CanvasModeWorkspace,
  })),
);
```

Render shape:

```tsx
{canvasOpen && currentImage ? (
  <Suspense fallback={null}>
    <LazyCanvasModeWorkspace currentImage={currentImage} />
  </Suspense>
) : (
  /* existing Classic image/frame markup */
)}
```

Important: the final implementation may choose a slightly narrower prop
contract, but `Canvas.tsx` must not import Canvas Mode helper modules as values.

Required shell/controller contract:

```text
Canvas.tsx passes DOM refs and classic image identity into CanvasModeWorkspace.
CanvasModeWorkspace owns all Canvas Mode side effects while mounted.
CanvasModeWorkspace can ask the shell to update displayed canvas version/image
  through explicit callbacks, not by reintroducing helper imports into Canvas.tsx.
Canvas.tsx remains usable when CanvasModeWorkspace has not loaded yet.
```

### NEW `ui/src/components/canvas-mode/index.ts`

Expose one public feature entry:

```ts
export { CanvasModeWorkspace } from "./CanvasModeWorkspace";
export type { CanvasModeWorkspaceProps } from "./canvasModeTypes";
```

`Canvas.tsx` should import the feature boundary through this barrel only.

Do not add broad runtime exports here:

```text
no export * from "./CanvasToolbar"
no export * from "./useCanvasModeSession"
no export * from "./CanvasModeStage"
```

### NEW `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx`

Responsibilities:

```text
1. Mount only when `canvasOpen` is true.
2. Own `useCanvasAnnotations`.
3. Load/save/delete annotation drafts.
4. Own Canvas Mode keyboard shortcuts:
   - 1-6 tool selection
   - Escape close
   - [ / ] / 0 zoom controls
   - Cmd/Ctrl+Z undo/redo
5. Own pointer handlers for annotation drawing, hit testing, eraser, memo, and selection.
6. Own viewport pan and zoom state interaction.
7. Own alpha detection.
8. Own background cleanup preview/mask/apply state.
9. Own canvas version save/apply/close/export/edit-with-mask actions.
10. Render Canvas Mode-only UI widgets.
11. Preserve the current close behavior: if annotations are dirty or present,
    save/apply the canvas version before calling `closeCanvas()`.
```

Imports allowed here:

```text
../../hooks/useCanvasAnnotations
../../lib/canvas/coordinates
../../lib/canvas/mergeRenderer
../../lib/canvas/maskRenderer
../../lib/canvas/hitTest
../../lib/canvas/objectKeys
../../lib/canvas/exportRenderer
../../lib/canvas/alphaDetect
../../lib/canvas/backgroundRemoval
./CanvasAnnotationLayer
./CanvasMemoOverlay
./CanvasToolbar
./CanvasViewportMiniMap
./CanvasZoomControl
```

Prefer delegating logic to the colocated hooks/modules from the modularization
plan instead of moving every block directly into this file.

Inside `CanvasModeWorkspace`, import Canvas Mode widgets normally. Do not keep
`React.lazy` boundaries for internal widgets in the first modular split:

```ts
import { CanvasAnnotationLayer } from "./CanvasAnnotationLayer";
import { CanvasMemoOverlay } from "./CanvasMemoOverlay";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasViewportMiniMap } from "./CanvasViewportMiniMap";
import { CanvasZoomControl } from "./CanvasZoomControl";
```

This avoids a chunk waterfall after the feature chunk has already loaded.

## Plan Audit Corrections

Backend plan audit found the split feasible but blocked the first implementation
plan until these integration details were made explicit.

### Workspace Props And Nullability

`Canvas.tsx` must not mount `CanvasModeWorkspace` unless there is an actual
image to edit:

```tsx
{canvasOpen && currentImage ? (
  <Suspense fallback={null}>
    <LazyCanvasModeWorkspace currentImage={currentImage} />
  </Suspense>
) : null}
```

`CanvasModeWorkspace` should read most Canvas Mode store actions directly from
`useAppStore` instead of accepting a wide prop bag. However, `Canvas.tsx` must
keep one parent-visible active Canvas Mode result bridge for `ResultActions`.

`CanvasModeWorkspaceProps` should start narrow:

```ts
import type { GenerateItem } from "../../types";

export interface CanvasModeWorkspaceProps {
  currentImage: GenerateItem;
  activeCanvasItem: GenerateItem | null;
  onCanvasVersionSaved: (item: GenerateItem) => Promise<void>;
  onCanvasSessionReset: () => void;
}
```

The bridge exists because `ResultActions` remains in `Canvas.tsx` and currently
uses `imageOverride={canvasOpen ? canvasDisplayImage : null}` for download/copy
/fork/send/delete behavior. `applyMergedCanvasImage(savedItem)` only upserts
history; it does not update `currentImage`. Therefore `Canvas.tsx` must keep
the active Canvas Mode display item visible enough to pass to `ResultActions`.

If DOM refs are later passed across the boundary, they must use React 19
nullable ref types:

```ts
RefObject<HTMLImageElement | null>
RefObject<HTMLDivElement | null>
```

### Allowed Feature Imports

The feature module may import the dependencies needed to preserve current
behavior:

```text
../../store/useAppStore
../../i18n
../../lib/api
../../lib/domEvents
../../types
../../types/canvas
../../hooks/useCanvasAnnotations
../../lib/canvas/*
```

`Canvas.tsx` must not import those Canvas Mode runtime modules.

### DOM Ownership

Use a slot swap instead of rendering two image frames:

```text
Canvas.tsx
  owns result-container, drop overlay, progress, metadata, ResultActions, prompt
  owns activeCanvasItem bridge used by ResultActions imageOverride
  renders Classic stage when canvasOpen is false
  renders lazy CanvasModeWorkspace in the stage slot when canvasOpen is true

CanvasModeWorkspace
  owns canvas-annotation-frame, image element, annotation overlays, memo overlay,
  mask overlay, topbar, toolbar, minimap, cursor, pan/zoom transform
```

Do not keep the same image/frame DOM in both `Canvas.tsx` and
`CanvasModeWorkspace`.

### Save-Before-Close Scope

For B.3, preserve the close paths that are currently real and controllable:

```text
toolbar close
Escape key close
Canvas Mode close button
dirty image change while Canvas Mode is open
```

Implementation should expose one `requestCloseCanvasMode()` function from
`useCanvasModeSession` and route those close paths through it.

Do not claim full parent-triggered close/mode-switch interception unless this
phase also adds a verified async store-level close request. External
`closeCanvas()` remains a follow-up risk because the current store action is
synchronous and only sets `canvasOpen: false`.

### Canvas Version Save Flow

Use names that match real behavior:

```text
onCanvasVersionSaved
setCanvasVersionItem
applyMergedCanvasImage
attachCanvasVersionReference
```

The saved-version flow must preserve the existing sequence:

```text
onCanvasVersionSaved(savedItem)
deleteCanvasAnnotations(source.filename)
annotations.resetLocal()
annotations.markSaved()
```

`Canvas.tsx` implements `onCanvasVersionSaved(savedItem)` and keeps the parent
bridge visible for `ResultActions`:

```text
setActiveCanvasItem(savedItem)
applyMergedCanvasImage(savedItem)
attachCanvasVersionReference(savedItem)
```

When Canvas Mode closes or the source image changes, `onCanvasSessionReset()`
clears the parent bridge.

Save/close behavior:

```text
CanvasModeWorkspace must preserve current handleCloseCanvas semantics:
  if annotations.hasAnnotations || annotations.isDirty:
    saveCanvasVersionAndUseReference()
    only close after save succeeds
  else:
    closeCanvas()
    reset Canvas Mode session state
```

All close paths must call that one save-before-close function:

```text
toolbar close
Escape key
image/history navigation while Canvas Mode is dirty
```

Full mode-switch and external parent-triggered close interception requires a
verified async store-level close request and is out of scope for the first B.3
split unless added explicitly.

Natural-dimension behavior:

```text
Final apply/export/mask/background cleanup must pass the real
HTMLImageElement into existing helpers and preserve naturalWidth/naturalHeight
output. Do not derive final canvas dimensions from getBoundingClientRect(),
annotation frame size, CSS scale, minimap size, or preview overlay size.
```

Tests must assert natural dimensions for:

```text
saved canvas version output
exported canvas output
final background-cleanup apply output
```

Implementation note:

```text
Delete CanvasModeShell during B.3. It is stale relative to the current
integrated flow because direct closeCanvas() can skip annotation save/apply.
Do not import, mount, or refactor it in the first modular split.
```

### MODIFY `tests/app-weight-splitting-contract.test.js`

This section is retained as the acceptance version of B.3.0.

Source-level assertions:

```text
Canvas.tsx must lazy import CanvasModeWorkspace.
Canvas.tsx must not value-import:
  useCanvasAnnotations
  mergeRenderer
  maskRenderer
  hitTest
  objectKeys
  exportRenderer
  alphaDetect
  backgroundRemoval
```

Manifest assertions:

```text
manifest contains src/components/canvas-mode/index.ts
entry dynamicImports includes src/components/canvas-mode/index.ts
entry static import graph does not include the canvas-mode feature chunk
entry static import graph does not include NodeCanvas/CardNews/PromptLibrary chunks
```

Do not assert hashed filenames. Use manifest keys and files.

Bundle-content sentinel assertions:

```text
entry static JS content must not include Canvas Mode helper sentinels:
  useCanvasAnnotations
  renderMergedCanvasImage
  renderMaskFromBoxes
  renderBackgroundRemovalPreview
  removeContiguousBackground
  imageUsesAlpha

entry static JS content must not include React Flow sentinels:
  @xyflow/react
  react-flow__renderer
  react-flow__node
```

### DELETE `ui/src/components/canvas-mode/CanvasModeShell.tsx`

Delete this file during B.3. Do not keep the file in the tree, and do not
import, mount, or refactor it as part of the first modular split. The new
`CanvasModeTopbar` and shortcut hook must call the save-aware session close
handler instead.

Reason:

```text
CanvasModeShell has its own store-driven Escape/zoom/wheel effects and duplicate
topbar shell markup. Keeping it around creates an attractive accidental
re-export/wiring target that can bypass the save-aware close flow.
```

### OPTIONAL NEW `ui/src/components/canvas-mode/CanvasBackgroundCleanupWorkspace.tsx`

Do not include this in the smallest first implementation. Once the entire
Canvas Mode workspace is lazy, classic mode no longer pays background cleanup
cost. A second-level lazy split is useful later because background cleanup is
heavier than ordinary annotation rendering, but it is not required to close the
B.3 blocker.

The first implementation should keep background cleanup inside
`CanvasModeWorkspace` so the first diff only creates one lazy boundary.

### OPTIONAL FOLLOW-UP `ui/src/store/useAppStore.ts`

Do not include this in the first implementation unless the entry chunk remains
too large after the Canvas Mode split.

The store still eagerly imports pure node helpers:

```text
../lib/nodeGraph
../lib/nodeLayout
../lib/nodeSelection
../lib/nodeBatch
```

These are not React Flow imports and are much lower-risk than the Canvas helper
split. If later metrics show store-level node helpers still matter, create a
separate store-slice phase rather than mixing it into B.3.

## Acceptance

Run after implementation:

```bash
npm run ui:build
node --test tests/app-weight-splitting-contract.test.js
npm run typecheck
npm test
```

First implementation order:

```text
1. Add test-first guards only.
2. Run the new guards and confirm expected pre-refactor failures.
3. Stop/report before production refactor if requested by the user gate.
4. Create CanvasModeWorkspace and move Canvas Mode-only imports/state/effects.
5. Keep Canvas.tsx as the Classic/default viewer owner.
6. Preserve one save-before-close path and natural-dimension final output.
7. Run targeted guards, close-flow tests, natural-dimension contract, typecheck,
   npm test, ui build, then static bundle sentinel against the built manifest.
```

Pass criteria:

```text
classic mode renders the default image viewer
double-click still opens Canvas Mode
Canvas Mode toolbar, annotation layer, memo overlay, minimap, and zoom controls render
1-6, [, ], 0, Escape, and undo shortcuts still work in Canvas Mode
annotation save/apply/close/export/edit-with-mask still work
background cleanup preview/apply still recomputes final output from natural image dimensions
NodeCanvas remains lazy and not in the entry static graph
canvas-mode/index.ts exists as a lazy feature chunk and is not in the entry static graph
Canvas.tsx no longer value-imports Canvas Mode helper modules
entry static JS content does not contain Canvas Mode helper or React Flow sentinels
Canvas Mode internal widgets are not nested lazy imports in the first split
CanvasModeShell.tsx is deleted and not exported/imported
```

## Rollback Criteria

Revert this phase if any of these happen and cannot be fixed locally:

```text
classic mode stops rendering current images
Canvas Mode opens but annotations do not save/apply
background cleanup final apply uses preview/downscaled dimensions
bundle contract cannot distinguish static entry graph from lazy chunks
Canvas.tsx still needs Canvas Mode helper value imports after the split
```

## Oracle Questions

1. Is this split boundary sound enough to implement directly?
2. Is the feature-module layout narrow enough, or is any planned file
   over-engineered?
3. Are any listed props a red flag for over-coupling between `Canvas.tsx` and
   the workspace?
4. Is the proposed contract test strong enough to prevent Canvas Mode helper
   code from drifting back into the classic entry graph?
5. Is there any hidden Node/React Flow cost path that should block this phase?
