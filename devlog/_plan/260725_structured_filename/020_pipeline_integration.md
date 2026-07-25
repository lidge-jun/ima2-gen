# 020 — Phase 2: pipeline integration + merge + PR #116 closeout (v2, audit fold-back)

Wire `buildFilename` + `writeFileUnique` into the four image pipelines.
Video, MCP, node store, sprite rows unchanged. Then squash-merge to `dev` and
close PR #116 as superseded.
v2 folds back Sol-audit blockers #2 (atomic writer replaces name checker),
#3 (agent size threading), #5 (pipeline-level tests), #6 (exact imports +
anchors), #7 (single createdAt per artifact).

## File change map

| Path | Action | What |
|------|--------|------|
| `lib/generatePipeline.ts` | MODIFY | name+write at :428/:465-471; keep `randomBytes` (request-log IDs at :602); drop `writeFile` from the :1 import if no other use remains |
| `lib/multimodePipeline.ts` | MODIFY | name+write at :275/:309-312; keep `randomBytes` (`sequenceId` at :252); drop `writeFile` from the :1 import if no other use remains |
| `lib/agentImageVideoGen.ts` | MODIFY | `persistAgentImage` gains `size` (:175-205); caller passes `providerOptions.size` (:132); keep `randomBytes` (video name at :339) and `writeFile` (video at :369) |
| `routes/edit.ts` | MODIFY | name+write at :314/:316; drop `randomBytes` (:4) and `writeFile` (:1) imports — no other uses |
| `tests/structured-filename-pipelines.test.ts` | NEW | behavioral persistence tests for all four lanes |
| `docs/migration/runtime-test-inventory.md` | MODIFY (regenerated) | `npm run test:inventory` |

Import additions: `import { buildFilename, writeFileUnique } from "./filename.js";`
in the three `lib/` files; `from "../lib/filename.js"` in `routes/edit.ts`.

Write order at every site: build the base name → construct metadata → embed
metadata into the image → `writeFileUnique(..., embedded.buffer)` → resolved
name → sidecar/log/thumbnail. The bytes that must be saved are the EMBEDDED
buffer (`embedded.buffer` at lib/generatePipeline.ts:465,
lib/multimodePipeline.ts:309, lib/agentImageVideoGen.ts:200); edit already has
`editBuffer` before the call (routes/edit.ts:315).

Filename/sidecar contract (audit round 3, refined at WP2b P): EMBEDDED (XMP)
metadata intentionally OMITS the filename — it is serialized inside
`embedImageMetadata` (lib/imageMetadataStore.ts:24) before the collision
resolution can know the final name. Verified at WP2b P: NONE of the four
meta objects carries a `filename` field at all (classic :434, multimode :277,
agent :187, edit :320) — sidecars persist `meta` as-is and only the sidecar
PATH (`<filePath>.json`) derives from the resolved name. Therefore NO
sidecarMeta copy and NO meta mutation is needed: resolve the name with
`writeFileUnique`, then derive filePath/sidecar path/thumbnail from the
returned name exactly as the code does today. `noUnusedLocals`
(tsconfig.json:14) makes the import removals mandatory.

Agent model (WP2b P verification): the caller already computes
`effectiveModel` (grok high-quality override, atlas/grok paths at
lib/agentImageVideoGen.ts:85-87) and passes it as `generation.model` — so the
agent lane needs NO effectiveFilenameModel; `generation.model` is already the
actual model. Agent also has two separate `Date.now()` calls (meta :196,
return :217) — hoist one `createdAt` for both.

Effective model rule (audit round 2): the grok quality-model override applies
to BOTH `grok` and `grok-api` — classic lib/generatePipeline.ts:286, multimode
lib/multimodePipeline.ts:373, and edit routes/edit.ts:265 all invoke
`grok-imagine-image-quality` for high quality on either provider. All three
sites compute:

```ts
const effectiveFilenameModel =
  (activeProvider === "grok" || activeProvider === "grok-api") && quality === "high"
    ? "grok-imagine-image-quality"
    : imageModel;
```

## Diffs (before → after)

### `lib/generatePipeline.ts` (~:426-471)

Before:

```ts
const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
const filename = `${Date.now()}_${rand}_${images.length}.${resultFormat}`;
const createdAt = Date.now();
// ... meta -> embed -> await writeFile(join(generatedDir, filename), embedded.buffer);
```

After (baseName built early, written after embedding, paths derived from the
RESOLVED name):

```ts
const createdAt = Date.now();
const baseName = buildFilename({
  model: effectiveFilenameModel,
  size: effectiveSize,
  createdAt,
  prompt,
  ext: resultFormat,
  index: images.length,
});
// ... meta constructed -> metadata embedded into image ->
const filename = await writeFileUnique(
  ctx.config.storage.generatedDir,
  baseName,
  embedded.buffer,
);
```

(Metadata embedding/output lives at lib/generatePipeline.ts:449-471; the old
bare `writeFile` is removed; sidecar path derives from the resolved name.
`writeFile` import at :1 dropped if unused.)

### `lib/multimodePipeline.ts` (~:273-312)

Before:

```ts
const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
const filename = `${Date.now()}_${rand}_multimode_${index}.${resultFormat}`;
const createdAt = Date.now();
// ... later: await writeFile(join(generatedDir, filename), buffer);
```

After:

```ts
const createdAt = Date.now();
const baseName = buildFilename({
  model: effectiveFilenameModel,
  size: effectiveSize,
  createdAt,
  prompt,
  ext: resultFormat,
  index,
});
// ... meta constructed -> metadata embedded ->
const filename = await writeFileUnique(
  ctx.config.storage.generatedDir,
  baseName,
  embedded.buffer,
);
```

### `lib/agentImageVideoGen.ts` (`persistAgentImage`, :175-205) — image only

Before:

```ts
// signature: (ctx, sessionId, prompt, format, requestId, response, generation)
const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
const filename = `${Date.now()}_${rand}_agent.${format}`;
// ... writeFile + sidecar + createdAt at :196
```

After:

```ts
// signature gains `size: string` (from providerOptions.size, call site :132)
const createdAt = Date.now();
const baseName = buildFilename({ model: generation.model, size, createdAt, prompt, ext: format });
// ... meta constructed -> metadata embedded (embedded.buffer at :200) ->
const filename = await writeFileUnique(ctx.config.storage.generatedDir, baseName, embedded.buffer);
// sidecar path + returned item reuse the same createdAt and resolved filename
```

(Agent resolves `providerOptions.size` at :71 and sends it to providers at
:94/:103/:112 — non-square agent images now get their true aspect instead of
the `1x1` fallback. Video path at :340 keeps `_agent.mp4`;
`tests/agent-mode-runtime-contract.test.ts:338,423` depends on it.)

### `routes/edit.ts` (~:312-319)

Before:

```ts
const filename = `${Date.now()}_${randomBytes(ctx.config.ids.generatedHexBytes).toString("hex")}.${editExt}`;
const editBuffer = Buffer.from(resultB64, "base64");
const editFilePath = join(ctx.config.storage.generatedDir, filename);
await writeFile(editFilePath, editBuffer);
// ... createdAt at :319
```

After:

```ts
const createdAt = Date.now();
const editBuffer = Buffer.from(resultB64, "base64");
const filename = await writeFileUnique(
  ctx.config.storage.generatedDir,
  buildFilename({
    model: effectiveFilenameModel || activeProvider,
    size: effectiveSize,
    createdAt,
    prompt,
    ext: editExt,
  }),
  editBuffer,
);
const editFilePath = join(ctx.config.storage.generatedDir, filename);
```

(`effectiveSize` and `prompt` are both in scope — :111/:138. Sidecar/meta
reuse the same `createdAt`; `randomBytes` import at :4 is removed — no other
use in this file; `writeFile` import at :1 likewise if unused after the
swap.)

## `tests/structured-filename-pipelines.test.ts` (NEW, audit blocker #5)

Behavioral persistence tests driving each lane with mocked providers
(fixture pattern follows tests/multimode-backend-contract.test.js and
tests/agent-mode-runtime-contract.test.ts):

- classic generate: saved file matches
  `^[a-z0-9.\-]+_\d+x\d+_\d{8}_[^-].*_\d+\.(png|jpeg|webp)$`; sidecar
  `<filename>.json` exists and its `model`/`prompt` fields match.
- classic grok high quality: name starts `grok-imagine-image-quality_`.
- classic grok-api high quality AND edit grok/grok-api high quality: same
  `grok-imagine-image-quality_` prefix (effectiveFilenameModel rule).
- classic Atlas Cloud: slash model produces
  `openai-gpt-image-2-text-to-image_...` (no nested dirs).
- multimode: structured pattern per image with incrementing index suffix;
  sidecar pairing per index.
- agent image, non-square size (e.g. `1536x1024`): aspect field `3x2`,
  not `1x1`.
- edit: structured name; `prompt`-derived slug present.
- two identical concurrent classic requests: distinct filenames, both
  sidecars intact (drives `writeFileUnique` under the real pipeline).

## Merge + PR closeout

1. Branch `feat/structured-filename` off `dev`; Phase 1 + Phase 2 commits.
2. Gates: `npm run typecheck`, `npm run typecheck:tests`, `npm test`,
   `node scripts/classify-tests.mjs` (regenerate inventory for the new test
   file), `npm run test:inventory` (verify).
3. `git checkout dev && git merge --squash feat/structured-filename` → one
   commit `feat: structured filename format for generated images`.
4. Close PR #116 with an English comment: spec adopted natively on dev
   (commit SHA), collision guard + model sanitization added, thank-you +
   credit.

## Acceptance

- Full gates green on merged `dev`.
- `rg "_multimode_|_agent\\." lib routes` shows no remaining image-path
  patterns (video `_agent.mp4` remains by design).
- Pipeline behavioral tests above pass; Atlas/grok-high/agent-aspect cases
  observable in test output.
- PR #116 closed with comment referencing the squash commit.
