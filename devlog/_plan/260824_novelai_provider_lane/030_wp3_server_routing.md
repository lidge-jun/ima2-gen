# 030 — wp3: server routing (models, options, pipelines, lanes)

Depends on wp2 (`020`): needs `generateViaNai` to exist and be callable.

Independently verifiable at close: a booted keyless server serves the `nai`
lane from `GET /api/models`.

## The alpha decision that shapes this phase

Five call sites classify providers as "forces JPEG" / "reports its own MIME".
Every hosted lane (`grok`, `agy`, `grok-api`, `gemini-api`, `atlascloud`,
`minimax`) is in the JPEG list.

**NAI must NOT join that list.** V5's native alpha (`straight_alpha`, 32-channel
VAE) is a headline capability and the reason this provider is worth adding for
sprite/asset work. JPEG has no alpha channel, so forcing it would silently
flatten every transparent generation onto black. NAI instead joins the
`providerReportsMime` group, which preserves the adapter-declared `image/png`.

This is the single most consequential line-level decision in the unit, and it
is invisible unless stated: adding `|| activeProvider === "nai"` to the wrong
one of two adjacent conditionals destroys the feature while all tests still
pass.

### Normative per-site table (audit B4 — supersedes any prose below)

There are **five** sites, not one pair. The A-phase audit caught that an
earlier draft conflated `nodeGeneration:261` (JPEG-forcing) with
`nodeGeneration:373` (MIME overwrite); following it literally would have
flattened alpha in node mode with every test green.

| File | Line | Group | Add `nai`? |
|------|------|-------|------------|
| `lib/generatePipeline.ts` | 383 `providerForcesJpeg` | JPEG-forcing | **NO** |
| `lib/generatePipeline.ts` | 573 `providerReportsMime` | MIME-reporting | YES |
| `lib/multimodePipeline.ts` | 271 `mmFormat` | JPEG-forcing | **NO** |
| `lib/multimodePipeline.ts` | 291, 294 | MIME-reporting | YES |
| `lib/nodeGeneration.ts` | 261 `resultFormat` init | JPEG-forcing | **NO** |
| `lib/nodeGeneration.ts` | 373 overwrite | MIME-reporting | YES |
| `lib/agentImageVideoGen.ts` | 155 | MIME-from-bytes | YES |
| `routes/edit.ts` | 351, 354 | MIME-reporting | YES |

## File change map

| Path | Action |
|------|--------|
| `lib/imageModels.ts` | MODIFY — `normalizeNaiImageModel` + fallback const |
| `lib/providerOptions.ts` | MODIFY — `nai` branch |
| `lib/generatePipeline.ts` | MODIFY — import, ref cap, dispatch, MIME group |
| `routes/models.ts` | MODIFY — `naiLane()` + registration |
| `lib/capabilities.ts` | MODIFY — `naiSupported` model list |
| `routes/edit.ts` | MODIFY — mask rejection + dispatch + MIME |
| `lib/multimodePipeline.ts` | MODIFY — dispatch + MIME |
| `lib/nodeGeneration.ts` | MODIFY — dispatch + ref cap + MIME |
| `lib/agentImageVideoGen.ts` | MODIFY — dispatch + format |
| `tests/nai-routing-contract.test.ts` | NEW |
| `tests/models-endpoint-contract.test.ts` | MODIFY — lane-key oracle (**audit B3**) |
| `tests/error-class-coverage.test.ts` | MODIFY — add `NAI` to `PROVIDER_CODE_PATTERN` (**audit B3**) |
| `tests/provider-canary-parity.test.ts` | MODIFY — `laneForVendor` (**audit B3**) |
| `scripts/provider-canary.mjs` | MODIFY — `CANARY_ENDPOINTS` (**audit R2-H2**) |
| `tests/provider-registry-parity.test.ts` | MODIFY — `maskRejectedLanes` (**audit B3**) |

> `provider-canary-parity` asserts `CANARY_ENDPOINTS[lane]` equals the URL in
> `routes/keys.ts`. Patching `laneForVendor` alone leaves the endpoint
> undefined and the test red: add
> `nai: "https://api.novelai.net/user/data"` to `scripts/provider-canary.mjs:25`.

> `error-class-coverage` is not merely a red test: its regex is what scans for
> provider error codes, so without `NAI` in the alternation every `NAI_*` code
> is invisible to the coverage and dead-code checks.

## 1. `lib/imageModels.ts`

```diff
+const NAI_FALLBACK_IMAGE_MODEL = "nai-diffusion-5-full";
+const VALID_NAI_IMAGE_MODELS = deriveModels("nai", "image");
+
+export function normalizeNaiImageModel(rawModel: unknown) {
+  if (typeof rawModel !== "string" || rawModel.length === 0) {
+    return { model: NAI_FALLBACK_IMAGE_MODEL };
+  }
+  if (!VALID_NAI_IMAGE_MODELS.has(rawModel)) {
+    return {
+      error: "NovelAI image model must be one of: " + [...VALID_NAI_IMAGE_MODELS].join(", "),
+      code: "INVALID_NAI_IMAGE_MODEL" as const,
+      status: 400 as const,
+    };
+  }
+  return { model: rawModel };
+}
```

Model set comes from `deriveModels("nai","image")` — registry-derived, never a
literal list, matching every sibling normalizer in this file.

## 2. `lib/providerOptions.ts`

Add before the `grok` branch. The config cast mirrors the existing
`minimax`/`grok` branches in this file verbatim — see the note under the
snippet:

```diff
+  if (provider === "nai") {
+    const naiCfg: { defaultImageModel?: string } = readProviderConfig(ctx, "naiProvider");
+    const naiModelCheck = normalizeNaiImageModel(rawModel || naiCfg.defaultImageModel);
+    if (naiModelCheck.error) return { error: naiModelCheck.error, code: naiModelCheck.code, status: naiModelCheck.status };
+    return {
+      provider: "nai" as const,
+      model: naiModelCheck.model,
+      reasoningEffort: "none",
+      size: rawSize || "832x1216",
+      webSearchEnabled: false,
+    };
+  }
```

**Config access note.** The sibling branches reach their config block through an
untyped cast because `resolveProviderOptions` takes a loosely-typed `ctx`. The
NAI branch must match whatever the neighbouring `minimax` branch does at
implementation time rather than inventing a second convention — if the
surrounding code still uses the untyped cast, use it and carry the same
trailing justification comment the repo's lint hook requires; if a typed
accessor exists by then, prefer it. Do not silently diverge from the file.

Default size `832x1216` (portrait) rather than `1024x1024`: it is the reference
client's default and the native training aspect for NAI's anime models.
`webSearchEnabled: false` — NAI has no search tool.

Import `normalizeNaiImageModel` in the existing import from `./imageModels.js`.

## 3. `lib/generatePipeline.ts`

```diff
+import { generateViaNai } from "./naiImageAdapter.js";
```

Reference cap (~L311), mirroring the MiniMax guard:

```diff
-      if (activeProvider === "minimax" && providerRefCount > providerReferenceLimit!) {
+      if ((activeProvider === "minimax" || activeProvider === "nai") && providerRefCount > providerReferenceLimit!) {
```

Dispatch (~L441), a new branch beside the MiniMax one:

```diff
+        if (activeProvider === "nai") {
+          const naiResult = await generateViaNai(prompt, ctx, {
+            model, size, signal, requestId,
+            straightAlpha: body?.straightAlpha === true,
+            negativePrompt: body?.negativePrompt,
+            steps: body?.steps, scale: body?.scale,
+            sampler: body?.sampler, noiseSchedule: body?.noiseSchedule,
+            seed: body?.seed,
+          });
+          // ...same result handling as the minimax branch...
+        }
```

MIME group (~L573) — **the alpha-preserving line**:

```diff
-          const providerReportsMime = ... || activeProvider === "minimax" || activeProvider === "comfy";
+          const providerReportsMime = ... || activeProvider === "minimax" || activeProvider === "nai" || activeProvider === "comfy";
```

Line ~383 `providerForcesJpeg` is deliberately **left untouched** (see the
alpha decision above).

## 4. `routes/models.ts`

```diff
+function naiLane(ctx: RuntimeContext): ModelLaneDto {
+  const adapter = getProviderAdapter(ctx, "nai");
+  const fallback: LaneState = ctx.naiApiKey
+    ? { status: "ready" }
+    : { status: "key-missing", reason: "NovelAI API token missing" };
+  return {
+    image: entries(deriveModels("nai", "image")),
+    video: [],
+    // ...remaining fields copied from minimaxLane...
+  };
+}
```

Copy `minimaxLane` (L221-231) verbatim, substituting the lane id, and register
it in the lanes object at L307:

```diff
     minimax: minimaxLane(ctx),
+    nai: naiLane(ctx),
```

## 5. `lib/capabilities.ts`

```diff
         minimaxSupported: ["image-01", "image-01-live"],
+        naiSupported: ["nai-diffusion-5-full", "nai-diffusion-5-curated", "nai-diffusion-4-5-full", "nai-diffusion-4-5-curated"],
```

(Matching the file's existing literal-list style at that site.)

## 6. `routes/edit.ts`

Mask rejection (L188-192): add `nai` to the rejected-mask condition, with code
`NAI_MASK_UNSUPPORTED` and label `"NovelAI"`. NAI infill exists as a separate
action but is out of this unit's scope, so a mask must fail loudly rather than
be silently dropped.

Dispatch (L273): add a `nai` branch calling `generateViaNai` with the reference
image attached. MIME lines (L351/L354): add `nai` to the PNG-preserving side,
not the JPEG side.

## 7-9. `multimodePipeline.ts`, `nodeGeneration.ts`, `agentImageVideoGen.ts`

Each gets: the `generateViaNai` import, a dispatch branch mirroring its
existing `minimax` branch (multimode L400, node L313, agent L121), and `nai`
added to the **MIME-reporting** side of its format conditional (multimode
L291/294, node L261/373, agent L155). `nodeGeneration` L176 also gets the
reference-count guard.

## 10. `tests/nai-routing-contract.test.ts` (NEW)

| Case | Assertion |
|------|-----------|
| `resolveProviderOptions({provider:"nai"})` | defaults to `nai-diffusion-5-full`, size `832x1216` |
| explicit V5 curated | passes through |
| unknown model | `INVALID_NAI_IMAGE_MODEL`, status 400 |
| `normalizeNaiImageModel("")` | falls back, no error |
| `GET /api/models` | contains a `nai` lane with 4 image models, 0 video |
| lane state without key | `key-missing` |
| alpha guard | source-regex over the whole normative table: `nai` absent from all **three** JPEG-forcing conditionals, present in all **five** MIME-reporting sites |

The last row is the regression test for the alpha decision. It must cover every
row of the normative table, not just the generate path — a generate-only regex
is a false green (audit B4). Concretely: **three JPEG-forcing conditionals**
(`generatePipeline:383`, `multimodePipeline:271`, `nodeGeneration:261`) where
`nai` must be ABSENT, and **five MIME-reporting sites** across four files where
it must be PRESENT. `tests/provider-registry-parity.test.ts` already reads
route source with regexes, so the pattern is established in-repo.

## Accept criteria

1. `npm run typecheck` = 0.
2. `node --test tests/nai-routing-contract.test.ts tests/models-endpoint-contract.test.ts tests/reference-limits.test.ts` = 0.
3. Booted keyless server: `curl localhost:PORT/api/models` shows the `nai` lane
   with all four models (live activation proof).

## Scope boundary

IN: the files listed in the change map above. OUT: UI components, doctor, i18n
(wp4).
