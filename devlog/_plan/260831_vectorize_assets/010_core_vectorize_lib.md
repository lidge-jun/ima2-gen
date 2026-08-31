# wp2 — Core vectorize lib

## MODIFY `package.json`

```diff
   "dependencies": {
     "@modelcontextprotocol/sdk": "...",
+    "@neplex/vectorizer": "0.1.0",
     "better-sqlite3": "...",
```

Pinned exact. Rationale is **upstream staleness, not nativeness**: this repo's own
native deps float (`better-sqlite3: ^13.0.3`, `sharp: ^0.35.3`), so "native must not
float" would contradict convention. `@neplex/vectorizer` is a 0.x line whose latest
publish is `0.1.0`; a 0.x minor may break API, so we pin and bump deliberately.

```diff
-    "test:native-deps": "node -e \"require('better-sqlite3'); require('sharp')\"",
+    "test:native-deps": "node -e \"require('better-sqlite3'); require('sharp'); require('@neplex/vectorizer')\"",
```

No `allowScripts` change is EXPECTED: the package and all 14 platform prebuilds report
`hasInstallScript=false` and publish no install hooks. Because
`check-install-policy.mjs` also probes `binding.gyp` in the installed tree and CI
consults npm's pending list (`--npm-pending`), this is re-proven right after
`npm install` rather than assumed. NAPI-RS prebuilds ship `.node` binaries with no
`binding.gyp`, so we expect green; a surprise costs one `allowScripts` line.

## NEW `lib/vectorizeImage.ts` (~150 lines)

Exports:

```ts
export const VECTOR_PRESETS = ["auto", "flat", "detailed", "mono"] as const;
export type VectorPreset = (typeof VECTOR_PRESETS)[number];

export type VectorizeOptions = {
  preset?: VectorPreset;
  colorPrecision?: number;   // 1-8
  filterSpeckle?: number;    // 0-128
  cornerThreshold?: number;  // 0-180
  optimize?: boolean;        // default true
};

export type VectorizeResult = {
  svg: string;
  bytes: number;
  pathCount: number;
  elapsedMs: number;
  preset: VectorPreset;
  width: number;
  height: number;
};

export async function vectorizeImageBuffer(
  input: Buffer,
  options?: VectorizeOptions,
): Promise<VectorizeResult>;
```

### Preset mapping (named modes, not raw enum leakage)

| Ours | VTracer config |
|------|----------------|
| `auto` / `detailed` | `Preset.Photo` — measured best quality/size tradeoff |
| `flat` | Color, `colorPrecision 6`, `filterSpeckle 8`, `Spline`, `Stacked` |
| `mono` | `Preset.Bw` |

Numeric overrides, when supplied, promote to an explicit `Config` built from the
chosen preset's base so a caller can tune one axis without restating all nine.

### Guards (each its own named error code)

- `VECTORIZE_INPUT_EMPTY` — zero-length buffer.
- `VECTORIZE_INPUT_TOO_LARGE` — > 40 MB input.
- `VECTORIZE_DIMENSIONS_TOO_LARGE` — > 8000 px on a side, probed via `sharp.metadata()`
  before tracing. Tracing cost scales with area; this is the decompression-bomb guard
  mirroring `MAX_INPUT_PIXELS` in `lib/imageThumb.ts`.
- `VECTORIZE_DECODE_FAILED` — vectorizer throws `unable to read this image`
  (verified real behavior on garbage input), remapped to our code.
- `VECTORIZE_OUTPUT_TOO_LARGE` — > 24 MB SVG after optimize.

**`signal`/`VECTORIZE_ABORTED` removed (audit blocker 3).** No planned caller can
produce a signal: the route derives options from the query and the CLI is synchronous
local. Shipping the parameter would create a guard branch nothing can ever trigger —
exactly the dead path C-ACTIVATION-GROUNDING-01 forbids. The library also does not
honor a pre-aborted signal (measured: no throw), so advertising cancellation would be
doubly dishonest. Mid-trace cancel is a follow-up that needs a real producer first.

All errors carry `.code` and `.status = 400` (except output-too-large = 413) to match
the `errInfo` envelope used by routes.

### Notes grounded in measurement

- `optimize(svg, { preset: Safe, multipass: true })` cut 860 KB -> 323 KB (0.375).
- The library accepts an `AbortSignal` argument but **does not honor a pre-aborted
  signal** (verified: no throw) — one reason we do not expose cancellation at all.
- Traces are sub-second at realistic sizes (845 ms at 1254x1254), so the operation is
  short enough that cancellation buys little.

## NEW `tests/vectorize-image-contract.test.ts`

node:test + strict assert, following `tests/sprite-atlas-import.test.ts` conventions
(`mkdtemp` per test, `rm(root,{recursive:true,force:true})` in `finally`).

Fixtures are GENERATED at test time with sharp (no binary committed — respects
`check-new-blob-budget.mjs`): a 64x64 flat two-color PNG, and a transparent-corner RGBA PNG.

Cases:
1. flat PNG -> SVG starting `<svg`, `pathCount > 0`, width/height preserved.
2. RGBA input -> no opaque full-canvas background rect emitted (alpha preserved).
3. `mono` preset yields strictly fewer paths than `detailed` on the same input.
4. empty buffer -> rejects with `VECTORIZE_INPUT_EMPTY`.
5. garbage buffer -> rejects with `VECTORIZE_DECODE_FAILED`.
6. oversize dimensions -> rejects with `VECTORIZE_DIMENSIONS_TOO_LARGE`
   (driven by a sharp-generated wide image, not a mocked metadata call).
7. **security**: output contains no `<script`, no ` on`-handler attribute, no
   `<foreignObject`, no `javascript:`.
8. `optimize:false` produces strictly more bytes than `optimize:true`.

Test files stay at the TOP LEVEL of `tests/`: `scripts/run-tests.mjs` uses a
**non-recursive** `readdirSync`, so a subfolder would be silently invisible.
Then run `node scripts/classify-tests.mjs` and commit the regenerated
`docs/migration/runtime-test-inventory.md` (required by `npm run test:inventory`).

## Accept criteria

- `npm run typecheck`, `npm run typecheck:tests`, `npm test`, `npm run test:inventory`,
  `npm run test:native-deps`, `npm run test:install-policy` all exit 0.
- Activation evidence (C-ACTIVATION-GROUNDING-01): cases 4-7 each drive a distinct
  guard branch and assert its specific code — the guards are not dead paths. Every
  remaining guard has a named reachable producer: `INPUT_EMPTY` (truncated file /
  empty CLI input), `INPUT_TOO_LARGE` + `DIMENSIONS_TOO_LARGE`
  (`routes/imageImport.ts:17-20` accepts arbitrary raster with no dimension cap;
  the CLI takes any local file), `DECODE_FAILED` (garbage bytes with a raster
  extension), `OUTPUT_TOO_LARGE` (1254² Poster already emits 1.36 MB; an 8000²
  noisy input scales ~40x past the 24 MB ceiling).
## wp2 C-phase render observation (evidence/)

Real keyed asset (1254x1254 RGBA) traced through the SHIPPED module, rendered back
to PNG with sharp and visually observed:

| preset | paths | bytes | ms |
|--------|-------|-------|----|
| auto | 722 | 598,990 | 1360 |
| flat | 1478 | 578,299 | 915 |
| mono | 12 | 64,338 | 93 |

`auto` is visually faithful with alpha intact. **`mono` fills transparent regions
black** — binary tracing has no alpha channel, so a cutout becomes a silhouette on a
black field. That is inherent to binary mode, not a defect, but it means the GUI must
describe `mono` as a silhouette/line-art option rather than offering it as a general
cutout preset. Recorded here so wp4 copy does not mislead.
