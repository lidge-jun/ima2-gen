# wp3 — `vector-svg` derived kind + SVG-safe listing

## MODIFY `routes/assetDerived.ts`

Today: `DERIVED_KINDS = ["keyed-png"]`, an `express.raw({type:"image/png"})` parser,
a PNG-signature check, and an unconditional `*-keyed-*.png` output name.

Key design decision: for `vector-svg` the client sends **no body**. The route already
validates and resolves `?source=` inside generated storage, so the server reads that
file itself. That avoids a second multi-MB upload of bytes the server already has, and
keeps arbitrary XML off the request surface (serve-audit finding 14).

```diff
-const DERIVED_KINDS = ["keyed-png"] as const;
+const DERIVED_KINDS = ["keyed-png", "vector-svg"] as const;
```

```diff
   app.post("/api/assets/derived", rawPng, async (req, res) => {
     try {
       const kind = ...;
       if (!DERIVED_KINDS.includes(kind)) throw httpError(400, "DERIVED_KIND_INVALID", ...);
       const sourceRel = ...;
       const sourceAbs = resolveInGenerated(...);
       if (!existsSync(sourceAbs)) throw httpError(400, "DERIVED_SOURCE_MISSING", ...);
       await assertRegularGeneratedPath(sourceAbs);
+
+      if (kind === "vector-svg") {
+        return await handleVectorSvg(req, res, { sourceRel, sourceAbs });
+      }

       const body = req.body as Buffer;   // keyed-png path unchanged below
```

`rawPng` stays mounted; a bodyless POST simply yields an empty buffer, and the
`vector-svg` branch returns before the PNG-signature check. **keyed-png is untouched.**

### NEW `handleVectorSvg` (same file, < 50 lines)

1. Parse `preset` (`VECTOR_PRESETS` allowlist) + optional numeric `colorPrecision`,
   `filterSpeckle`, `cornerThreshold` from the query, each range-clamped.
2. Reject a source that is not `.png/.jpg/.jpeg/.webp` -> `DERIVED_SOURCE_NOT_RASTER`
   (prevents vectorizing an existing `.svg`, i.e. no recursion).
3. `readFile(sourceAbs)` -> `vectorizeImageBuffer(buf, opts)`.
4. Write `${stem}-vector-${Date.now()}.svg` via `resolveInGenerated`.
5. `safeWriteSidecar(`${outAbs}.json`, { kind, derivedFrom, createdAt, preset,
   pathCount, ...meta })` — matches the existing sidecar contract; `historyList`
   sidecar lookup already tolerates this.
6. `createAsset({ kind:"image", name, filePath: outName, folderId: projectId,
   metadata:{ derivedFrom, derivedKind:"vector-svg", vector:true, preset, pathCount }})`.
7. `invalidateHistoryIndex()`; `logEvent("assets","derived-create",{...})`;
   `res.status(201).json({ filePath, asset, pathCount, bytes, elapsedMs })`.

## MODIFY `lib/imageThumb.ts` — latent identity-mapping hazard (not a live bug)

`thumbPathForImage` matches only `png|jpe?g|webp`, so for `foo.svg` it returns
`foo.svg` **unchanged** — and `generateImageThumbnail` would then write JPEG bytes
over the vector.

Honest scope (audit blocker 5): this is **unreachable today**. Every caller filters to
raster first — `lib/historyList.ts:19` and `lib/thumbBackfill.ts:56` gate on
`png|jpe?g|webp|mp4`, `lib/mcp/commitMediaResult.ts:43` derives its extension from
`extensionFor()`, and the buffer variants are fed by raster pipelines. wp3's route
generates no thumbnail at all. So this is defensive hardening that makes the helper
total, not a fix for a live incident. Recorded this way so the devlog does not carry
a false crash narrative.

```diff
+const RASTERIZABLE = /\.(png|jpe?g|webp)$/i;
+
 export function thumbPathForImage(imagePath: string): string {
-  return imagePath.replace(/\.(png|jpe?g|webp)$/i, ".thumb.jpg");
+  // A non-raster path must never map onto itself: returning the input would make
+  // callers treat the original as its own thumbnail and overwrite it.
+  if (!RASTERIZABLE.test(imagePath)) return `${imagePath}.thumb.jpg`;
+  return imagePath.replace(RASTERIZABLE, ".thumb.jpg");
 }
```

Same shape for `thumbUrlForImage`. `tests/thumb-backfill.test.ts` still passes: it only
asserts raster inputs, whose behavior is byte-identical.

## Listing decision (deliberate, documented)

`lib/historyList.ts:19` scans `png|jpe?g|webp|mp4`; `lib/thumbBackfill.ts` the same.
**We do NOT add svg to either.** Vector output is an *asset-library* artifact, reachable
via `/api/assets` (which has no extension filter — serve finding 4), not a generation
history row. Adding it to history without a raster thumbnail would produce a thumbless
gallery tile. Recorded as an explicit non-goal so a later reader does not read it as an
oversight.

## MODIFY `ui/src/lib/assetPreview.ts`

**Blast radius (audit blocker 1):**
`tests/asset-gen-media-lightbox-contract.test.js:30` asserts this exact source text:

```js
assert.match(assetPreview, /derivedKind\.startsWith\("keyed-"\) \? "edit" : "imported"/);
```

The rewrite below breaks that regex, so the test MUST be updated in the same commit —
preserving its intent (keyed and vector map to `"edit"`, everything else
`"imported"`). This file was missing from the original file-change map.

`derivedKind "vector-svg"` currently falls through to `kind:"imported"`, which makes
`canKey` true — so the lightbox would offer "remove background" on a vector. Add:

```diff
-    kind: typeof derivedKind === "string" && derivedKind.startsWith("keyed-") ? "edit" : "imported",
+    // A traced vector has no raster alpha to key, and keying it would silently
+    // rasterize the asset. Mark it "edit" so canKey suppresses the entry.
+    kind: typeof derivedKind === "string"
+      && (derivedKind.startsWith("keyed-") || derivedKind === "vector-svg")
+      ? "edit"
+      : "imported",
```

## MODIFY `ui/src/lib/api-assets.ts`

`uploadDerivedAsset` hardcodes `kind=keyed-png` and `Content-Type: image/png`. Leave it
alone (keyed path untouched) and ADD a sibling:

```ts
export async function requestVectorize(input: {
  source: string; preset?: string; colorPrecision?: number;
  filterSpeckle?: number; cornerThreshold?: number;
  projectId?: string | null; name?: string;
}): Promise<{ filePath: string; asset: AssetItem; pathCount: number; bytes: number }>;
```

POST with no body, params only.

## Tests — NEW `tests/asset-derived-vector-contract.test.ts`

Plus MODIFY `tests/asset-gen-media-lightbox-contract.test.js` — update the
`assetPreview` source assertion to the new branch shape.

Route-level via a real express app (mirroring existing route tests):
1. `kind=vector-svg` + real PNG source -> 201, `.svg` exists on disk, asset row has
   `derivedKind:"vector-svg"`.
2. missing source -> 400 `DERIVED_SOURCE_MISSING`.
3. `.svg` source -> 400 `DERIVED_SOURCE_NOT_RASTER` (no recursion).
4. bad preset -> 400.
5. `kind=keyed-png` regression: unchanged 201 + `.png`.
6. `thumbPathForImage("a.svg") === "a.svg.thumb.jpg"` (never identity).
7. `.svg` served from `/generated` carries the CSP and `nosniff` headers.

## MODIFY `server.ts` — SVG serving headers (audit blocker 4)

`/generated` is outside the LAN token guard (`./server.ts:252` only covers `/api`), so
the SVG safety guarantee must not rest on writer discipline alone:

```diff
   app.use("/generated", (req, res, next) => {
     if (req.path.endsWith(".json")) return res.status(404)...;
+    if (req.path.toLowerCase().endsWith(".svg")) {
+      // SVG is an active document in a navigation context. The traced output is
+      // machine-generated, but /generated is unauthenticated on LAN and any future
+      // .svg writer would inherit this surface — so neuter it at the serving layer.
+      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
+      res.setHeader("X-Content-Type-Options", "nosniff");
+    }
     return next();
   }, express.static(...));
```

Activation scenario: a request for a `.svg` under `/generated` — driven directly by
test 7, asserting both headers on a real response.

## Accept criteria

- Real HTTP invocation writes a real SVG (c-3), rendered back to PNG and observed.
- All gates exit 0; keyed-png regression green.
