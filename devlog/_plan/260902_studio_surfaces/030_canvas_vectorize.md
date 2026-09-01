# 030 — Canvas raster-to-vector surface (wp4)

## Loop specification

- Loop archetype: spec-satisfaction.
- Goal: make Canvas Mode expose a clearly named real raster-to-path SVG trace while
  retaining the existing self-contained SVG export that embeds the source raster.
- Non-goals: redesigning `lib/vectorizeImage.ts`, changing preset math, adding SVG to
  generation history, adding a second vectorize UI, or adding the action to classic
  `ResultActions` in this cycle.
- Verifier: focused Canvas/vectorize contracts, all five requested repository gates,
  a live 1280x720 browser pass, and Sharp rasterization of the produced SVG.
- Stop condition: the export menu distinguishes embedded-raster SVG from traced SVG;
  Canvas can open the shipped vectorize modal; success, HTTP error, and client-cancel
  paths are activated; the traced SVG renders back to PNG.
- Escalation: a design fork the Design Read cannot resolve. Locale scope is settled:
  the four runtime locales are the whole contract (000_plan.md "Locale correction");
  a partial `ja.json` is forbidden and a Japanese locale is a non-goal.

Depends on the shipped vectorize unit at
`devlog/_plan/260831_vectorize_assets/000_plan.md:79-92`. This document changes no
production code in wp1; every diff below is the implementation contract for wp4.

## 1. Grounded current state

### 1.1 Vectorize is already a complete stored-file pipeline

- `lib/vectorizeImage.ts:13-21` explicitly distinguishes tracing from Canvas's
  raster-wrapping SVG export and records the honest quality boundary.
- `routes/assetDerived.ts:44-73` accepts only a generated raster path for
  `kind=vector-svg`; it reads the file from storage and applies `preset`,
  `colorPrecision`, `filterSpeckle`, and `cornerThreshold`.
- `routes/assetDerived.ts:118-136` requires `source`, resolves it inside generated
  storage, and branches to `handleVectorSvg`. The route does not accept an uploaded
  vectorize source today. Its raw PNG body is used only by `keyed-png` after the
  vector branch (`routes/assetDerived.ts:139-168`).
- `ui/src/lib/api-assets.ts:109-139` mirrors that contract: `requestVectorize` sends a
  bodyless POST with query parameters.
- `ui/src/components/assetgen/VectorizePanel.tsx:50-77` owns presets, advanced knobs,
  result registration, and the request lifecycle. Reusing it prevents a second set of
  tuning defaults from drifting.
- The panel is mounted only by AssetGen and Assets
  (`ui/src/components/assetgen/AssetGenWorkspace.tsx:278-280`,
  `ui/src/components/assets/AssetsWorkspace.tsx:149-152`), so setting
  `vectorizeTarget` from Canvas alone would currently render nothing.

### 1.2 Canvas has two different SVG concepts but one ambiguous label

- `ui/src/components/canvas-mode/CanvasExportMenu.tsx:5` lists only
  `png | svg | pptx` and uses `canvas.toolbar.exportAs.<format>` at
  `ui/src/components/canvas-mode/CanvasExportMenu.tsx:94-106`.
- `ui/src/lib/canvas/exportRenderer.ts:40-49` handles `svg` by embedding a clean
  raster data URL and drawing annotations as vector markup.
- `ui/src/lib/canvas/svgExport.ts:107-129` confirms the base image remains an SVG
  `<image>`; only annotations are vector elements.
- `ui/src/i18n/en.json:526-530` calls that output “SVG vector”, which is inaccurate
  once a real trace action appears beside it.
- `ui/src/lib/canvas/exportRenderer.ts:9-12` already exports the exact primitive needed
  for tracing: `exportCanvasImage(input): Promise<Blob>` returns the merged PNG blob.
  No new renderer is needed.

### 1.3 A Canvas-native upload path already exists

`POST /api/canvas-versions` accepts a raw PNG plus `sourceFilename` and returns a
persisted `GenerateItem` (`routes/canvasVersions.ts:28-49`). Its existing client wrapper
is `createCanvasVersion` at `ui/src/lib/api-canvas.ts:48-60`, already imported by the
Canvas session. `lib/canvasVersionStore.ts:182-213` writes the generated-storage file
and marks it `canvasVersion: true`; those versions are excluded from visible gallery
items by `ui/src/lib/galleryShortcuts.ts:26-27`. Therefore the minimal pipeline is:

```text
Canvas composition -> existing exportCanvasImage PNG Blob
  -> existing /api/canvas-versions -> hidden persisted GenerateItem with filename
  -> existing setVectorizeTarget(item) -> existing VectorizePanel
  -> existing bodyless /api/assets/derived?kind=vector-svg&source=<filename>
```

Decision: do not modify `routes/assetDerived.ts`. Accepting an upload there would either
trace immediately before the user chooses modal parameters or require a second “stage
upload” response shape. Reusing Canvas version upload is smaller, avoids a visible
intermediate gallery import, and preserves the stored-file invariant that the shipped
panel and route already enforce.

## 2. File-change map

| Action | File | Purpose |
|---|---|---|
| MODIFY | `ui/src/components/canvas-mode/CanvasExportMenu.tsx` | Add a distinct trace action while keeping file formats typed separately. |
| MODIFY | `ui/src/components/canvas-mode/CanvasToolbar.tsx` | Pass trace action and separate exportability from clear/apply availability. |
| MODIFY | `ui/src/components/canvas-mode/CanvasModeFloatingToolbar.tsx` | Thread `handleTraceCanvas` into the toolbar. |
| MODIFY | `ui/src/components/canvas-mode/useCanvasModeSession.ts` | Render PNG, persist as a hidden Canvas version, and open the existing modal. |
| MODIFY | `ui/src/components/Canvas.tsx` | Mount `VectorizePanel` while Canvas Mode is active. |
| MODIFY | `ui/src/lib/api-assets.ts` | Let the existing vector request receive an `AbortSignal`. |
| MODIFY | `ui/src/components/assetgen/VectorizePanel.tsx` | Abort client wait on close/target change and toast HTTP failures. |
| MODIFY | `ui/src/i18n/{en,ko,zh-Hans,zh-Hant}.json` | Clarify embedded-raster SVG and name the real trace action. |
| NEW | `tests/canvas-vectorize-entry-contract.test.ts` | Lock menu, PNG staging, panel reuse, and classic-action exclusion. |
| MODIFY | `tests/vectorize-panel-contract.test.ts` | Lock abort and toast behavior. |
| MODIFY | `structure/04-frontend-architecture.md` | Record the two SVG semantics and modal reuse. |

No change: `lib/vectorizeImage.ts`, `routes/assetDerived.ts`,
`ui/src/lib/canvas/svgExport.ts`, and `ui/src/components/ResultActions.tsx`.

## 3. Diff-level implementation

### 3.1 MODIFY `ui/src/components/canvas-mode/CanvasExportMenu.tsx`

Before (`ui/src/components/canvas-mode/CanvasExportMenu.tsx:3-22`):

```ts
import type { CanvasExportFormat } from "../../lib/canvas/exportRenderer";

const FORMATS: CanvasExportFormat[] = ["png", "svg", "pptx"];

export function CanvasExportMenu({
  onExport,
  disabled,
  isExporting,
}: {
  onExport: (format: CanvasExportFormat) => void;
  disabled: boolean;
  isExporting: boolean;
}) {
```

After:

```diff
 import type { CanvasExportFormat } from "../../lib/canvas/exportRenderer";
 
-const FORMATS: CanvasExportFormat[] = ["png", "svg", "pptx"];
+const ACTIONS = [
+  { id: "png", kind: "export" },
+  { id: "svg", kind: "export" },
+  { id: "vector", kind: "trace" },
+  { id: "pptx", kind: "export" },
+] as const satisfies readonly Array<
+  | { id: CanvasExportFormat; kind: "export" }
+  | { id: "vector"; kind: "trace" }
+>;
 
 export function CanvasExportMenu({
   onExport,
+  onTrace,
   disabled,
   isExporting,
 }: {
   onExport: (format: CanvasExportFormat) => void;
+  onTrace: () => void;
   disabled: boolean;
   isExporting: boolean;
 }) {
```

Replace the map at `ui/src/components/canvas-mode/CanvasExportMenu.tsx:94-107`:

```diff
-          {FORMATS.map((format) => (
+          {ACTIONS.map((action) => (
             <button
-              key={format}
+              key={action.id}
               type="button"
               role="menuitem"
               className="canvas-export-menu__item"
               onClick={() => {
                 close(true);
-                onExport(format);
+                if (action.kind === "trace") onTrace();
+                else onExport(action.id);
               }}
             >
-              {t(`canvas.toolbar.exportAs.${format}`)}
+              {t(`canvas.toolbar.exportAs.${action.id}`)}
             </button>
           ))}
```

Why `vector` is not added to `CanvasExportFormat`: `exportCanvasAs` has exhaustive
file serialization for PNG/SVG/PPTX (`ui/src/lib/canvas/exportRenderer.ts:30-63`). A
trace is a staged workflow that opens a modal, not a fourth immediate download format.
Keeping the types separate prevents `vector` from accidentally falling through to the
PPTX branch.

### 3.2 MODIFY `ui/src/components/canvas-mode/CanvasToolbar.tsx`

Add the prop beside `onExport` (`ui/src/components/canvas-mode/CanvasToolbar.tsx:31-35`)
and destructure it beside `onExport` (`ui/src/components/canvas-mode/CanvasToolbar.tsx:83-88`):

```diff
   onRevertAnnotations?: () => void;
   onExport?: (format: CanvasExportFormat) => void;
+  onTrace?: () => void;
   onUndo?: () => void;
```

```diff
   onRevertAnnotations,
   onExport,
+  onTrace,
   onUndo,
```

Separate image export availability from annotation clearing at
`ui/src/components/canvas-mode/CanvasToolbar.tsx:128`:

```diff
-  const canExport = hasExportableContent ?? hasAnnotations ?? false;
+  const canClear = hasAnnotations ?? false;
+  const canExport = hasExportableContent ?? canClear;
```

Then preserve annotation-only semantics for Apply and Clear:

```diff
-          disabled={!canExport || isApplying}
+          disabled={!canClear || isApplying}
```

```diff
-        disabled={!canExport}
+        disabled={!canClear}
```

Pass the new action at `ui/src/components/canvas-mode/CanvasToolbar.tsx:354-360`:

```diff
-      {onExport ? (
+      {onExport && onTrace ? (
         <CanvasExportMenu
           onExport={onExport}
+          onTrace={onTrace}
           disabled={!canExport}
           isExporting={Boolean(isExporting)}
         />
```

Activation reason: Canvas Mode itself guarantees a loaded `currentImage` before this
toolbar renders (`ui/src/components/Canvas.tsx:171-176`). Export/trace must therefore be
available even with zero annotations, while Apply/Clear must remain disabled until
annotations exist.

### 3.3 MODIFY `ui/src/components/canvas-mode/CanvasModeFloatingToolbar.tsx`

Thread the handler through the local action contract
(`ui/src/components/canvas-mode/CanvasModeFloatingToolbar.tsx:18-26`) and toolbar props
(`ui/src/components/canvas-mode/CanvasModeFloatingToolbar.tsx:43-51`):

```diff
   actions: {
     handleApplyCanvas: () => Promise<void>;
     handleRevertAnnotations: () => Promise<void>;
     handleExportCanvas: (format?: CanvasExportFormat) => Promise<void>;
+    handleTraceCanvas: () => Promise<void>;
     handleEditWithMask: () => Promise<void>;
```

```diff
-      hasExportableContent={annotations.hasAnnotations}
+      hasAnnotations={annotations.hasAnnotations}
+      hasExportableContent
       onToolChange={annotations.setTool}
```

```diff
       onExport={(format) => void actions.handleExportCanvas(format)}
+      onTrace={() => void actions.handleTraceCanvas()}
```

### 3.4 MODIFY `ui/src/components/canvas-mode/useCanvasModeSession.ts`

Extend the existing renderer import at
`ui/src/components/canvas-mode/useCanvasModeSession.ts:17-22`:

```diff
 import {
   downloadCanvasBlob,
   exportCanvasAs,
+  exportCanvasImage,
   makeCanvasExportFilename,
```

Insert immediately after `handleExportCanvas` at
`ui/src/components/canvas-mode/useCanvasModeSession.ts:232-256`:

```ts
  const handleTraceCanvas = async (): Promise<void> => {
    if (!imageElementRef.current || !currentImage?.filename) return;
    setIsExporting(true);
    try {
      const matte = exportBackground === "matte";
      const blob = await exportCanvasImage({
        imageElement: imageElementRef.current,
        paths: annotations.paths,
        boxes: annotations.boxes,
        memos: annotations.memos,
        background: matte
          ? { mode: "matte", color: exportMatteColor }
          : { mode: "alpha" },
      });
      const { item: target } = await createCanvasVersion({
        sourceFilename: canvasSourceImageRef.current?.filename ?? currentImage.filename,
        image: blob,
        prompt: currentImage.prompt,
      });
      useAppStore.getState().setVectorizeTarget(target);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : t("canvas.toolbar.tracePrepareFailed");
      showToast(message, true);
    } finally {
      setIsExporting(false);
    }
  };
```

Add the handler to the returned object at
`ui/src/components/canvas-mode/useCanvasModeSession.ts:384-392`:

```diff
     handleCloseCanvas,
     handleExportCanvas,
+    handleTraceCanvas,
     handleEditWithMask,
```

This is a synthesized tracing source in the sense required by the product flow, but it
is not a fake object: `createCanvasVersion` returns the server-authored `GenerateItem`
with a real filename and hidden-canvas metadata, exactly what `VectorizePanel` requires
(`ui/src/components/assetgen/VectorizePanel.tsx:50-59`).

### 3.5 MODIFY `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx`

Destructure and pass the new handler at
`ui/src/components/canvas-mode/CanvasModeWorkspace.tsx:279-312` and
`ui/src/components/canvas-mode/CanvasModeWorkspace.tsx:486-494`:

```diff
-  const { handleApplyCanvas, handleRevertAnnotations, handleCloseCanvas, handleExportCanvas, handleEditWithMask, handleGptTransparency } = useCanvasModeSession({
+  const { handleApplyCanvas, handleRevertAnnotations, handleCloseCanvas, handleExportCanvas, handleTraceCanvas, handleEditWithMask, handleGptTransparency } = useCanvasModeSession({
```

```diff
                 handleRevertAnnotations,
                 handleExportCanvas,
+                handleTraceCanvas,
                 handleEditWithMask,
```

No modal is mounted here because this file is already 520 lines. Adding another wrapper
would worsen the repository's file-size violation; `Canvas.tsx` is the owning mode
switch and can mount the overlay with a smaller diff.

### 3.6 MODIFY `ui/src/components/Canvas.tsx`

Add the existing component import beside `ResultActions`
(`ui/src/components/Canvas.tsx:12-15`):

```diff
 import { ResultActions } from "./ResultActions";
+import { VectorizePanel } from "./assetgen/VectorizePanel";
```

Mount it only in the Canvas Mode early-return branch
(`ui/src/components/Canvas.tsx:171-176`):

```diff
   if (canvasOpen && currentImage) {
     return (
-      <Suspense fallback={<main className="canvas canvas--mode-open" aria-busy="true" />}>
-        <LazyCanvasModeWorkspace currentImage={currentImage} />
-      </Suspense>
+      <>
+        <Suspense fallback={<main className="canvas canvas--mode-open" aria-busy="true" />}>
+          <LazyCanvasModeWorkspace currentImage={currentImage} />
+        </Suspense>
+        <VectorizePanel />
+      </>
     );
   }
```

### 3.7 MODIFY `ui/src/lib/api-assets.ts`

Add a signal to the existing input and fetch
(`ui/src/lib/api-assets.ts:115-138`):

```diff
 export async function requestVectorize(input: {
   source: string;
   preset?: string;
   colorPrecision?: number;
   filterSpeckle?: number;
   cornerThreshold?: number;
   projectId?: string | null;
   name?: string;
+  signal?: AbortSignal;
 }): Promise<VectorizeResponse> {
```

```diff
-  const res = await fetch(`/api/assets/derived?${params.toString()}`, { method: "POST" });
+  const res = await fetch(`/api/assets/derived?${params.toString()}`, {
+    method: "POST",
+    signal: input.signal,
+  });
```

### 3.8 MODIFY `ui/src/components/assetgen/VectorizePanel.tsx`

Add lifecycle primitives at `ui/src/components/assetgen/VectorizePanel.tsx:1`:

```diff
-import { useCallback, useState } from "react";
+import { useCallback, useEffect, useRef, useState } from "react";
```

Replace the direct close callback at
`ui/src/components/assetgen/VectorizePanel.tsx:36-41` with an abort-aware owner:

```diff
   const item = useAppStore((s) => s.vectorizeTarget);
   const close = useAppStore((s) => s.setVectorizeTarget);
-  const dialogRef = useModalFocus<HTMLDivElement>(!!item, () => close(null));
   const addDerivedItem = useAppStore((s) => s.addAssetGenDerivedItem);
   const selectedProjectId = useAppStore((s) => s.selectedProjectId);
   const showToast = useAppStore((s) => s.showToast);
+  const abortRef = useRef<AbortController | null>(null);
+  // Written synchronously during render so the promise guards see the NEW target
+  // even before the passive abort effect below has run.
+  const targetRef = useRef<string | null>(item?.filename ?? null);
+  targetRef.current = item?.filename ?? null;
+  const closePanel = useCallback(() => {
+    abortRef.current?.abort();
+    abortRef.current = null;
+    close(null);
+  }, [close]);
+  const dialogRef = useModalFocus<HTMLDivElement>(!!item, closePanel);
```

After state declarations at `ui/src/components/assetgen/VectorizePanel.tsx:42-48`,
abort on unmount and whenever the target changes:

```ts
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setError(null);
    setResult(null);
  }, [item?.filename]);

  useEffect(() => () => abortRef.current?.abort(), []);
```

Update `onRun` at `ui/src/components/assetgen/VectorizePanel.tsx:50-77`:

```diff
   const onRun = useCallback(() => {
     if (!item?.filename || running) return;
     const filename = item.filename;
+    const controller = new AbortController();
+    abortRef.current = controller;
     setRunning(true);
     setError(null);
     requestVectorize({
       source: filename,
       preset,
       ...(colorPrecision !== DEFAULTS.colorPrecision ? { colorPrecision } : {}),
       ...(filterSpeckle !== DEFAULTS.filterSpeckle ? { filterSpeckle } : {}),
       ...(cornerThreshold !== DEFAULTS.cornerThreshold ? { cornerThreshold } : {}),
       projectId: selectedProjectId,
+      signal: controller.signal,
     })
       .then((res) => {
+        if (abortRef.current !== controller || targetRef.current !== filename) return; // stale: newer trace, close, or target change
         if (!res.filePath) throw new Error(t("vectorize.saveError"));
         setResult({ filePath: res.filePath, pathCount: res.pathCount, bytes: res.bytes });
         addDerivedItem(makeDerivedItem(item, res.filePath));
         showToast(t("vectorize.saved"));
       })
       .catch((err: unknown) => {
-        setError(err instanceof Error ? err.message : t("vectorize.saveError"));
+        if (err instanceof DOMException && err.name === "AbortError") return;
+        if (abortRef.current !== controller || targetRef.current !== filename) return; // stale failure must not paint the new run
+        const message = err instanceof Error ? err.message : t("vectorize.saveError");
+        setError(message);
+        showToast(message, true);
       })
-      .finally(() => setRunning(false));
+      .finally(() => {
+        if (abortRef.current !== controller || targetRef.current !== filename) return; // a newer run or target owns `running`
+        abortRef.current = null;
+        setRunning(false);
+      });
```

Use `closePanel` for all three close surfaces:

```diff
-    <div className="assetgen-popup-backdrop" onClick={() => close(null)}>
+    <div className="assetgen-popup-backdrop" onClick={closePanel}>
```

```diff
-          <button type="button" className="assetgen-popup__close" onClick={() => close(null)}>{t("project.close")}</button>
+          <button type="button" className="assetgen-popup__close" onClick={closePanel}>{t("project.close")}</button>
```

Cancellation boundary: aborting fetch cancels the browser's wait and guarantees no
late result is applied by this panel. It cannot interrupt the native VTracer call after
the server has begun; the shipped library deliberately exposes no working cancellation
(`devlog/_plan/260831_vectorize_assets/010_core_vectorize_lib.md:83-99`). A server may
finish and persist the SVG after the user closes the modal. True compute cancellation
would require a worker/process boundary and is outside this cycle.

### 3.9 MODIFY i18n dictionaries

Actual repository contract: only four dictionaries exist, imported by
`ui/src/i18n/index.ts:1-9`, and `SUPPORTED_LOCALES` lists the same four at
`ui/src/i18n/index.ts:62-78`. `tests/i18n-coverage-contract.test.ts:53-65` enforces
exact key parity across English, Korean, Simplified Chinese, and Traditional Chinese;
the AST-backed dictionary scanner loads the same four dictionaries at
`tests/i18n-dictionary-contract.test.ts:18-27`. There is no
`ui/src/i18n/ja.json`.

Required key shape for every supported locale:

```json
"canvas": {
  "toolbar": {
    "tracePrepareFailed": "...",
    "exportAs": {
      "png": "...",
      "svg": "...",
      "vector": "...",
      "pptx": "..."
    }
  }
}
```

Exact English diff at `ui/src/i18n/en.json:506-530`:

```diff
       "exporting": "Exporting...",
       "exportFailed": "Export failed",
+      "tracePrepareFailed": "Could not prepare the canvas for tracing",
@@
       "exportAs": {
         "png": "PNG image",
-        "svg": "SVG vector",
+        "svg": "SVG (embedded raster)",
+        "vector": "Trace to SVG (vector)",
         "pptx": "PowerPoint slide"
       }
```

Exact Korean diff at `ui/src/i18n/ko.json:506-530`:

```diff
       "exporting": "내보내는 중...",
       "exportFailed": "내보내기 실패",
+      "tracePrepareFailed": "SVG 추적용 캔버스를 준비하지 못했습니다",
@@
       "exportAs": {
         "png": "PNG 이미지",
-        "svg": "SVG 벡터",
+        "svg": "SVG (래스터 포함)",
+        "vector": "SVG로 추적 (벡터)",
         "pptx": "PowerPoint 슬라이드"
       }
```

`ui/src/i18n/zh-Hans.json` and `ui/src/i18n/zh-Hant.json` must add the same keys and
clarify the same semantic distinction; translation is required in the implementation
commit, not English passthrough. Four locales is the full set (non-goal: Japanese).

### 3.10 MODIFY `structure/04-frontend-architecture.md`

Insert after the Assets workspace row at
`structure/04-frontend-architecture.md:62-68`:

```diff
 | Assets workspace | `components/assets/AssetsWorkspace.tsx`, `AssetsFolderTree.tsx`, `AssetsGrid.tsx` | Workspace-only asset catalog with folder navigation, kind/tag/search filters, virtualized grid, and cursor paging |
+| Raster-to-vector UI | `assetgen/VectorizePanel.tsx`, `canvas-mode/CanvasExportMenu.tsx`, `canvas-mode/useCanvasModeSession.ts`, `ui/src/lib/api-assets.ts` | Assets/AssetGen trace stored rasters directly. Canvas renders its composition to PNG, persists a hidden Canvas version, then opens the same preset/tuning modal. “SVG (embedded raster)” remains distinct from “Trace to SVG (vector)”. |
```

## 4. Classic `ResultActions` decision

Do not add “Convert to SVG” to `ui/src/components/ResultActions.tsx` in wp4.

Evidence and rationale:

- Classic already exposes a dense action row plus overflow
  (`ui/src/components/ResultActions.tsx:319-495`).
- A generated image can already reach vectorize through AssetGen tiles and Assets
  previews (`ui/src/components/assetgen/AssetGenWorkspace.tsx:250-259` and the shared
  lightbox/store flow).
- The requested gap is specifically the composed Canvas result. Adding a classic action
  would widen the cycle and duplicate the existing asset entry points.
- `ResultActions` is also rendered inside Canvas Mode
  (`ui/src/components/canvas-mode/CanvasModeResultDetails.tsx:42-48`), so adding the
  action there would create two vectorize controls on the same screen.

The new contract test must assert that `ResultActions.tsx` does not reference
`setVectorizeTarget`, preventing accidental duplication in this cycle.

## 5. Tests and activation grounding

### 5.1 NEW `tests/canvas-vectorize-entry-contract.test.ts`

Use `node:test`, `node:assert/strict`, and `readFileSync`, matching nearby source-level
Canvas contracts such as `tests/canvas-pptx-export-contract.test.ts:54-66`.

Exact assertions:

1. `CanvasExportMenu.tsx` contains action IDs in order `png`, `svg`, `vector`, `pptx`,
   has `onTrace`, and dispatches trace separately from `onExport`.
2. `exportRenderer.ts` exports `exportCanvasImage`, and that function returns
   `merged.blob` (`ui/src/lib/canvas/exportRenderer.ts:9-12`).
3. `useCanvasModeSession.ts` calls `exportCanvasImage`, passes the PNG Blob to
   `createCanvasVersion`, and then calls `setVectorizeTarget` with the returned item.
4. `Canvas.tsx` mounts `VectorizePanel` in the `canvasOpen && currentImage` branch.
5. `CanvasToolbar.tsx` separates `canClear` and `canExport`; image-only Canvas can
   export while Clear/Apply remain annotation-gated.
6. `ResultActions.tsx` does not contain `setVectorizeTarget`.
7. English and Korean labels contain both “embedded raster/래스터 포함” and
   “Trace to SVG/SVG로 추적”.

Because this is a new top-level test, run `npm run test:inventory`; the runner scans
top-level `tests/` and inventory drift is a gate
(`devlog/_plan/260831_vectorize_assets/010_core_vectorize_lib.md:121-124`).

### 5.2 MODIFY `tests/vectorize-panel-contract.test.ts`

After the bodyless request test at `tests/vectorize-panel-contract.test.ts:23-26`, add:

```ts
test("closing a running trace aborts the client wait and HTTP failures toast", () => {
  assert.match(api, /signal: input\.signal/);
  assert.match(panel, /new AbortController\(\)/);
  assert.match(panel, /abortRef\.current\?\.abort\(\)/);
  assert.match(panel, /err instanceof DOMException && err\.name === "AbortError"/);
  assert.match(panel, /showToast\(message, true\)/);
});
```

Its locale loop stays on the four real dictionaries.

### 5.3 Activation matrix (C-ACTIVATION-GROUNDING-01)

| Conditional path | Producer | Assertion/evidence |
|---|---|---|
| Image loaded, no annotations | Enter Canvas Mode on any raster and open Export | PNG/SVG/vector/PPTX enabled; Apply/Clear disabled. Screenshot + contract #5. |
| Existing embedded SVG | Choose “SVG (embedded raster)” | Immediate `.svg` download still contains `<image href="data:image/png...">`; existing `tests/canvas-svg-export-contract.test.ts:33-37`. |
| Trace setup success | Choose “Trace to SVG (vector)” | PNG goes to `/api/canvas-versions`, modal opens with source preview and presets. Browser network + screenshot. |
| Trace route success | Press Convert in modal | `POST /api/assets/derived?...kind=vector-svg`; result preview, path count, download link, success toast. |
| Trace route 4xx | Corrupt/remove staged source before pressing Convert, or issue request with missing source in a focused HTTP test | Route error text appears inline and through `showToast(message, true)`; no derived item appended. |
| Trace route 5xx | Stub `requestVectorize` rejection in a component-level contract or inject a test-only route dependency in the existing route harness | Generic/returned error toasts; panel remains retryable. Do not force a production 500 by damaging storage. |
| Cancel while request pending | Start trace on a detailed large raster, then click Close/backdrop/Escape before response | fetch rejects `AbortError`; no error toast, no late panel result. Server-side computation may finish, as documented above. |
| Target changes while pending | Open a second vectorize target before first returns | target-change effect aborts prior client wait and resets local result/error state. |
| Preparation upload fails | Stub `/api/canvas-versions` to 4xx or stop server after Canvas loaded | Canvas shows error toast and does not open modal. |

## 6. Render grounding (C-RENDER-GROUNDING-01)

Run against a fresh built UI and live server, not Vite-only mocks:

```bash
cd ui && npm run build
IMA2_QA_PORT=3347
IMA2_PORT="$IMA2_QA_PORT" node bin/ima2.js serve
```

If 3347 is occupied, choose another verified spare port; do not reuse the stale process
described in `devlog/_plan/260902_studio_surfaces/000_plan.md:36-39`.

At viewport 1280x720, persist and inspect these screens under
`devlog/_plan/260902_studio_surfaces/evidence/`:

1. `wp4_canvas_export_menu.png` — Canvas Mode with a loaded flat/icon image, export
   menu open, showing “SVG (embedded raster)” and “Trace to SVG (vector)” together.
2. `wp4_canvas_vectorize_modal.png` — existing VectorizePanel opened from Canvas,
   source preview visible, presets visible, advanced controls collapsed.
3. `wp4_canvas_vectorize_result.png` — traced result preview, path count/size, download
   control, and success toast.
4. `wp4_canvas_vectorize_error.png` — missing-source 4xx visible as both panel alert and
   toast.

Download the result SVG, rasterize it with the already-installed Sharp, and inspect the
PNG with `view_image`:

```bash
node --input-type=module -e 'import sharp from "sharp"; await sharp(process.argv[1]).png().toFile(process.argv[2])' \
  "$HOME/.ima2/generated/<returned-vector-file>.svg" \
  "devlog/_plan/260902_studio_surfaces/evidence/wp4_traced_svg_render.png"
```

The observed render must preserve the canvas composition at its natural dimensions and
contain real `<path>` geometry. Record `pathCount`, SVG bytes, and the returned filename
next to the screenshots. Avoid a photographic fixture; the implementation itself warns
that photographs and small text trace poorly (`lib/vectorizeImage.ts:19-21`).

## 7. Verifier matrix

These commands are required by the parent goal. “Reads target” refers to the future
wp4 implementation diff, not this docs-only file.

| Command | Reads wp4 targets? | What it proves |
|---|---|---|
| `npm run typecheck` | Yes | Compiles `ui/src/lib/api-assets.ts`; root TS resolution also catches server/shared type drift. It does not typecheck TSX — UI build does. |
| `npm run typecheck:tests` | Yes | Compiles new/modified `.test.ts` contracts and their imported types. |
| `npm test` | Yes | Executes the new Canvas/vectorize contract, existing vectorize route/panel contracts, i18n parity, and Canvas SVG/PPTX regressions. |
| `npm run test:inventory` | Indirect | Reads the new test file and verifies registry/classification; it does not exercise Canvas behavior. |
| `cd ui && npm run build` | Yes | Vite/TypeScript compiles all modified TSX, API client, i18n JSON, and lazy Canvas graph. |

Additional focused commands:

```bash
node --experimental-strip-types --test \
  tests/canvas-vectorize-entry-contract.test.ts \
  tests/vectorize-panel-contract.test.ts \
  tests/canvas-svg-export-contract.test.ts \
  tests/asset-derived-vector-contract.test.ts
node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces
```

## 8. Acceptance and open question

- The existing `svg` output remains byte-compatible except for its user-facing label.
- The new trace action always uses the existing PNG renderer, generated-storage import,
  vector route, preset UI, asset registration, and download path.
- HTTP failures toast and remain retryable; closing cancels client observation and blocks
  late UI application.
- No duplicate classic ResultActions entry is introduced.
- Locale scope is LOCKED to the four runtime locales (en, ko, zh-Hans, zh-Hant) per
  `devlog/_plan/260902_studio_surfaces/000_plan.md` "Locale correction"; wp4 claims
  four-locale coverage and a Japanese locale is a non-goal.
- Cancellation contract: every side effect in the trace promise chain (success,
  failure, finally) is guarded on BOTH `abortRef.current === controller` AND
  `targetRef.current === filename` (the render-synchronous target ref), so a
  superseded request can neither attach a result to the wrong target nor clear
  `running` for the newer run. Activation: start trace A, change target and start
  trace B, let A settle; assert the store receives only B's result and `running`
  stays true until B settles.
