# Canvas Mode Phase 4 - Annotation Persistence

**Date**: 2026-04-28  
**Scope**: Persist annotations per browser and image filename  
**Status**: Planned  
**Backend**: Required

## Goal

Save Canvas Mode annotations so they survive reloads. Persistence is keyed by
browser identity and image filename to avoid leaking annotations across users or
browser profiles.

Phase 4 persists editable layer data. It does not replace Phase 3 Apply, which
bakes annotations into pixels for Continue Here. Both flows should coexist:
Apply creates a merged image; persistence keeps editable annotation layers for
later revision.

## Files

### New

```text
routes/annotations.js
tests/annotations-api.test.js
ui/src/lib/api/annotations.ts
tests/canvas-persistence-contract.test.js
```

### Modify

```text
lib/db.js
server.js
ui/src/hooks/useCanvasAnnotations.ts
ui/src/components/canvas-mode/CanvasModeShell.tsx
ui/src/i18n/en.json
ui/src/i18n/ko.json
```

## Database

`lib/db.js`

```diff
+ CREATE TABLE IF NOT EXISTS image_annotations (
+   id TEXT PRIMARY KEY,
+   browser_id TEXT NOT NULL,
+   filename TEXT NOT NULL,
+   payload TEXT NOT NULL,
+   schema_version INTEGER NOT NULL DEFAULT 1,
+   created_at INTEGER NOT NULL DEFAULT (unixepoch()),
+   updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
+   UNIQUE(browser_id, filename)
+ );
+
+ CREATE INDEX IF NOT EXISTS idx_image_annotations_filename
+   ON image_annotations(filename);
```

`payload` shape:

```json
{
  "paths": [],
  "boxes": [],
  "memos": []
}
```

## API

`routes/annotations.js`

```diff
+ router.get("/:filename", async (req, res) => {
+   const browserId = requireBrowserId(req);
+   const row = db.getAnnotation(browserId, req.params.filename);
+   res.json({ ok: true, annotations: row ? JSON.parse(row.payload) : null });
+ });
+
+ router.put("/:filename", async (req, res) => {
+   const browserId = requireBrowserId(req);
+   const payload = validateAnnotationPayload(req.body);
+   db.upsertAnnotation(browserId, req.params.filename, payload);
+   res.json({ ok: true });
+ });
+
+ router.delete("/:filename", async (req, res) => {
+   const browserId = requireBrowserId(req);
+   db.deleteAnnotation(browserId, req.params.filename);
+   res.json({ ok: true });
+ });
```

Endpoints:

```text
GET    /api/annotations/:filename
PUT    /api/annotations/:filename
DELETE /api/annotations/:filename
```

## Server Wiring

`server.js`

```diff
+ import annotationsRouter from "./routes/annotations.js";
+ app.use("/api/annotations", annotationsRouter);
```

## Frontend API

`ui/src/lib/api/annotations.ts`

```diff
+ export async function fetchAnnotations(filename: string): Promise<SavedAnnotations | null>;
+ export async function saveAnnotations(filename: string, payload: SavedAnnotations): Promise<void>;
+ export async function deleteAnnotations(filename: string): Promise<void>;
```

## Hook Diff

`ui/src/hooks/useCanvasAnnotations.ts`

```diff
+ load(payload: SavedAnnotations): void;
+ toPayload(): SavedAnnotations;
+ isDirty: boolean;
+ markSaved(): void;
```

## Shell Diff

`ui/src/components/canvas-mode/CanvasModeShell.tsx`

```diff
+ useEffect(() => {
+   if (!canvasOpen || !currentFilename) return;
+   fetchAnnotations(currentFilename).then((payload) => {
+     if (payload) annotations.load(payload);
+   });
+ }, [canvasOpen, currentFilename]);
+
+ useDebouncedEffect(() => {
+   if (!annotations.isDirty || !currentFilename) return;
+   saveAnnotations(currentFilename, annotations.toPayload())
+     .then(annotations.markSaved);
+ }, [annotations, currentFilename], 800);
```

## Validation Rules

- Reject payloads over the agreed JSON size budget.
- Reject unknown top-level fields.
- Clamp all normalized coordinates to `0`-`1`.
- Require path point arrays to have finite numeric `x` and `y`.
- Require memo text length limit.

## i18n

```diff
+ "saving": "Saving...",
+ "saved": "Saved",
+ "saveFailed": "Could not save annotations",
+ "confirmClose": "You have unsaved annotations. Close anyway?"
```

## Tests

- API returns `null` when no annotation exists.
- API upserts by `(browser_id, filename)`.
- API delete removes only the current browser/image row.
- Invalid payload returns 400.
- Frontend API uses the expected endpoints.
- Shell has a debounced save path.

## Manual QA

- Draw annotations, reload, verify they return.
- Open the same image in another browser profile, verify annotations do not leak.
- Delete annotations, reload, verify empty state.
