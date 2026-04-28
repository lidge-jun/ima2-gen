# Canvas Mode Phase 4 - Canvas Version + Editable Draft Persistence

**Date**: 2026-04-28  
**Scope**: Persist editable drafts and save baked canvas versions that can be used as references  
**Status**: Build baseline exists, needs 4/5 integrated PABCD verification and polish  
**Backend**: Required

## Goal

Phase 4 is no longer only "annotation persistence". It is the bridge between
Canvas Mode as a drawing surface and Canvas Mode as a usable generation input.

It must support:

- editable draft persistence per browser + source filename;
- text memo creation/focus and pixel merge;
- baked canvas version PNG save/update;
- original + edited version coexistence in history;
- immediate reference attachment for Continue Here / next generation.

## Current Baseline

The current implementation already includes:

- `routes/annotations.js`
- `routes/canvasVersions.js`
- `lib/canvasVersionStore.js`
- `image_annotations` SQLite table in `lib/db.js`
- canvas version metadata in history rows and embedded metadata payloads
- frontend API helpers in `ui/src/lib/api.ts`
- `useCanvasAnnotations` dirty/load/toPayload/markSaved/resetLocal contracts
- save-aware Canvas close path
- blob/raw PNG canvas version upload
- compressed canvas reference attachment
- memo focus fix and shared merge path through `renderCanvasMemo`
- contract tests for persistence, canvas version API, and frontend version flow

## Behavior Contract

### Draft Editing

```text
source image
  └─ local editable overlay
```

- Drawing/memo edits do not create history branches.
- Draft overlays can be saved under `(browserId, filename)`.
- Image switch uses `resetLocal()`, not `clear()`.
- User Clear uses `clear()` and is dirty/server-delete semantic.

### First Save / Dirty Close

```text
source image remains in history
canvas version PNG is created
canvas version becomes currentImage
canvas version is attached as reference
local overlay resets
```

- Save uses `renderMergedCanvasImage().blob`.
- Save API body is raw `image/png`, not JSON data URL.
- Failure keeps Canvas open and shows an error state.

### Later Saves

```text
existing canvas version filename is updated
no duplicate history item is appended
currentImage/reference remain that version
```

- Reopening an existing `canvasVersion` initializes `canvasVersionItem`.
- Saved canvas versions are baked source-of-truth and must not reload baked
  annotation layers as editable overlays.

## Files

### New

```text
routes/annotations.js
routes/canvasVersions.js
lib/canvasVersionStore.js
tests/canvas-persistence-contract.test.js
tests/canvas-version-api.test.js
tests/canvas-version-contract.test.js
```

### Modify

```text
lib/db.js
lib/historyList.js
lib/imageMetadata.js
routes/index.js
ui/src/components/Canvas.tsx
ui/src/hooks/useCanvasAnnotations.ts
ui/src/lib/api.ts
ui/src/store/useAppStore.ts
ui/src/types.ts
ui/src/types/canvas.ts
ui/src/styles/canvas-mode.css
ui/src/i18n/en.json
ui/src/i18n/ko.json
tests/canvas-annotation-contract.test.js
tests/canvas-apply-merged-contract.test.js
```

## Backend Contract

```text
GET    /api/annotations/:filename
PUT    /api/annotations/:filename
DELETE /api/annotations/:filename

POST   /api/canvas-versions
PUT    /api/canvas-versions/:filename
```

Annotation endpoints:

- require `X-Ima2-Browser-Id`;
- validate filename safety;
- store `{ paths, boxes, memos }`;
- upsert by `(browser_id, filename)`;
- delete only that browser/image row.

Canvas version endpoints:

- use route-specific `express.raw({ type: "image/png" })`;
- reject empty/non-PNG bodies;
- reject unsafe update filenames;
- write PNG into `generatedDir`;
- write sidecar JSON;
- return `GenerateItem`-compatible `{ item }`.

Returned canvas version item must include:

```json
{
  "canvasVersion": true,
  "canvasSourceFilename": "original.png",
  "canvasEditableFilename": "canvas-original-20260428-0505.png",
  "canvasMergedAt": 1777310000000
}
```

## Frontend Contract

`Canvas.tsx`:

- captures source image at canvas-open time;
- resets source/version/save state on close or source-image change;
- loads editable source drafts only for non-canvas-version source images;
- saves dirty source drafts through annotation API;
- creates/updates canvas version through blob/raw PNG API;
- closes only after dirty save succeeds;
- keeps Canvas open on save failure;
- deletes source draft after successful baked save.

`useAppStore.ts`:

- `applyMergedCanvasImage(item)` inserts one canvas version or updates matching filename;
- `attachCanvasVersionReference(item)` must call `compressReferenceSource`;
- raw `/generated/...` URLs must not be stored in `referenceImages`;
- previous canvas reference is replaced without removing unrelated references.

`useCanvasAnnotations.ts`:

- mutation actions set `isDirty`;
- `load(payload)` sets dirty false;
- `markSaved()` clears dirty without removing overlays;
- `resetLocal()` removes overlays and clears dirty;
- `clear()` is user delete semantics and stays dirty.

## Tests

Required checks:

- TypeScript: `cd ui && npx tsc --noEmit`
- Full suite: `npm test`
- Focused:

```bash
node --test \
  tests/canvas-annotation-contract.test.js \
  tests/canvas-apply-merged-contract.test.js \
  tests/canvas-persistence-contract.test.js \
  tests/canvas-version-api.test.js \
  tests/canvas-version-contract.test.js
```

## Known Follow-up Before C/D

- Resolve jaw verification-state mismatch if it persists after read-only verifier.
- Manual browser QA is still needed for actual textarea focus, saved version history,
  and reference tray state.
