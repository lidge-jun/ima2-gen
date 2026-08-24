# 020 — wp2: naiImageAdapter, ZIP→PNG decode, NAI_* error mapping

Depends on wp1 (`010`): needs `ctx.naiApiKey`, `ctx.config.naiProvider`, and
the `nai` registry entry to exist.

Independently verifiable at close: the new adapter tests drive both the decode
path and every error branch with no network and no token.

## File change map

| Path | Action |
|------|--------|
| `lib/naiZip.ts` | NEW — single-entry ZIP extractor |
| `lib/naiImageAdapter.ts` | NEW — HTTP + request builder + result shaping |
| `lib/providers/adapters/nai.ts` | NEW — `ProviderAdapterV1` lane descriptor |
| `lib/providers/adapters/index.ts` | MODIFY — register the factory |
| `lib/errors/providerMap.ts` | MODIFY — map every `NAI_*` code to a UI class |
| `tests/nai-zip-decode.test.ts` | NEW |
| `tests/nai-provider-contract.test.ts` | NEW |

`naiZip.ts` is split out from the adapter deliberately: it is pure
`Buffer -> Buffer` with no HTTP, which is what makes it directly testable
without stubbing `fetch`.

## 1. `lib/naiZip.ts` (NEW)

```ts
// lib/naiZip.ts — minimal single-entry ZIP reader for NovelAI responses.
//
// NAI returns generated images as a ZIP archive rather than JSON. Full ZIP
// support is not needed: the archive comes from a known server and holds one
// PNG. This parses the local file header and inflates that entry, rejecting
// every shape it does not fully understand instead of guessing (a wrong guess
// is persisted as a corrupt .png, which is far harder to diagnose).
import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const FLAG_ENCRYPTED = 0x1;
const FLAG_DATA_DESCRIPTOR = 0x8;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const ZIP64_SENTINEL = 0xffffffff;
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;

function naiZipError(message: string, code: string): Error {
  const err = new Error(message) as Error & { status?: number; code?: string; isOperational?: boolean };
  err.status = 502;
  err.code = code;
  err.isOperational = true;
  return err;
}

export function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === LOCAL_FILE_HEADER_SIG;
}

export function extractFirstZipEntry(buffer: Buffer): Buffer {
  if (!looksLikeZip(buffer)) {
    throw naiZipError("NovelAI response is not a ZIP archive", "NAI_ZIP_INVALID");
  }
  if (buffer.length < 30) {
    throw naiZipError("NovelAI ZIP header is truncated", "NAI_ZIP_INVALID");
  }
  const flags = buffer.readUInt16LE(6);
  const method = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const uncompressedSize = buffer.readUInt32LE(22);
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);

  if (flags & FLAG_ENCRYPTED) {
    throw naiZipError("NovelAI ZIP entry is encrypted", "NAI_ZIP_UNSUPPORTED");
  }
  // Bit 3 puts the sizes in a trailing data descriptor, so the header values
  // are zero and the entry cannot be located without the central directory.
  if (flags & FLAG_DATA_DESCRIPTOR) {
    throw naiZipError("NovelAI ZIP entry uses a data descriptor", "NAI_ZIP_UNSUPPORTED");
  }
  if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
    throw naiZipError("NovelAI ZIP entry is ZIP64", "NAI_ZIP_UNSUPPORTED");
  }
  if (uncompressedSize > MAX_ENTRY_BYTES) {
    throw naiZipError("NovelAI ZIP entry exceeds 50MB", "NAI_ZIP_TOO_LARGE");
  }

  const dataStart = 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > buffer.length) {
    throw naiZipError("NovelAI ZIP entry extends past the payload", "NAI_ZIP_INVALID");
  }
  const payload = buffer.subarray(dataStart, dataEnd);

  if (method === METHOD_STORED) return Buffer.from(payload);
  if (method !== METHOD_DEFLATE) {
    throw naiZipError(\`NovelAI ZIP compression method \${method} is unsupported\`, "NAI_ZIP_UNSUPPORTED");
  }
  try {
    // Raw inflate: ZIP stores bare DEFLATE with no zlib 2-byte header.
    return inflateRawSync(payload, { maxOutputLength: MAX_ENTRY_BYTES });
  } catch {
    throw naiZipError("NovelAI ZIP entry could not be inflated", "NAI_ZIP_INVALID");
  }
}
```

## 2. `lib/naiImageAdapter.ts` (NEW)

Shape mirrors `lib/minimaxImageAdapter.ts` so the shared pipeline is unchanged.

**Exports**

```ts
export const NAI_DEFAULT_IMAGE_MODEL = "nai-diffusion-5-full";
export const NAI_SAMPLERS: readonly string[];      // 7 values, 001 §Sampler enum
export const NAI_NOISE_SCHEDULES: readonly string[]; // native|karras|exponential|polyexponential
export const NAI_UC_PRESET_IDS: readonly string[];   // heavy|light|furryFocus|humanFocus|none
export const NAI_QUALITY_PRESET_IDS: readonly string[]; // standard|light|none
export async function generateViaNai(prompt, ctx, options): Promise<NaiImageResult>;
```

`NaiImageResult` matches the MiniMax result contract exactly:
`{ b64, revisedPrompt: null, usage: null, webSearchCalls: 0, mime, providerUrl: null, effectiveModel }`.
Returning the same shape is what lets `generatePipeline` treat NAI as just
another lane.

**Request construction** (V5 field names from 001 §Request body):

```ts
const body = {
  input: prompt,
  model,
  action: "generate",
  parameters: {
    params_version: 3,
    width, height,                       // parsed from options.size, default 832x1216
    scale, sampler, steps,
    n_samples: 1,                        // >1 forfeits Opus free-tier eligibility
    ucPresetId, qualityPresetId,         // V5 string ids, not V4 numbers
    autoSmea: false,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false, legacy_v3_extend: false, legacy_uc: false,
    add_original_image: true,
    cfg_rescale: 0,
    noise_schedule,
    use_coords: false,
    normalize_reference_strength_multiple: true,
    inpaintImg2ImgStrength: 1,
    seed,
    negative_prompt: negativePrompt,
    straight_alpha: options.straightAlpha === true,   // V5 native alpha
    characterPrompts: [],
    v4_prompt: { caption: { base_caption: prompt, char_captions: [] }, use_coords: false, use_order: true },
    v4_negative_prompt: { caption: { base_caption: negativePrompt, char_captions: [] }, legacy_uc: false },
  },
};
// Only sent for this sampler, matching the reference client.
if (sampler === "k_euler_ancestral") {
  body.parameters.deliberate_euler_ancestral_bug = false;
  body.parameters.prefer_brownian = true;
}
```

`skip_cfg_above_sigma` is omitted: it is `null` for V5 (001).

**Transport**

- `POST \${ctx.config.naiProvider.baseUrl}/ai/generate-image`
- Headers `Authorization: Bearer \${ctx.naiApiKey}`, `Content-Type: application/json`
- `AbortSignal.any([options.signal, AbortSignal.timeout(cfg.generationTimeoutMs)])`
- Success = `res.status === 200 || res.status === 201` (001 §Response format)

**Response handling**

```ts
const raw = Buffer.from(await res.arrayBuffer());
const png = extractFirstZipEntry(raw);
const b64 = png.toString("base64");
const detected = detectImageMimeFromB64(b64);
if (detected !== "image/png") {
  throw naiError("NovelAI returned a non-PNG payload", 502, "NAI_IMAGE_INVALID");
}
```

Magic bytes decide, never the Content-Type header — the same rule
`minimaxImageAdapter` documents.

**Error mapping** — an error body is JSON while success is binary, so the
adapter reads the body as text and parses defensively:

| Condition | status | code |
|-----------|--------|------|
| no `ctx.naiApiKey` | 401 | `NAI_API_KEY_MISSING` |
| 401 | 401 | `NAI_AUTH_FAILED` |
| 402 | 402 | `NAI_SUBSCRIPTION_REQUIRED` |
| 429 | 429 | `NAI_RATE_LIMITED` |
| 400 / 409 | as-is | `NAI_BAD_REQUEST` |
| other non-OK | 502 | `NAI_UPSTREAM_ERROR` |
| empty body | 502 | `NAI_EMPTY_IMAGE` |
| 2xx body is not a ZIP | 502 | `NAI_RESPONSE_NOT_ZIP` |
| non-PNG after decode | 502 | `NAI_IMAGE_INVALID` |
| (from `naiZip`) | 502 | `NAI_ZIP_INVALID` / `NAI_ZIP_UNSUPPORTED` / `NAI_ZIP_TOO_LARGE` |

### Open risk: `stream: "msgpack"` (audit M1)

The V5 reference client sends `parameters.stream = "msgpack"`. This adapter
omits it and expects the documented ZIP attachment. Which behavior the live
image host requires cannot be settled here, because proving it needs a real
credentialed 200 response and this unit is forbidden from spending the user's
Anlas.

Containment rather than assumption: on a 2xx whose body fails `looksLikeZip`,
throw `NAI_RESPONSE_NOT_ZIP` with the received `Content-Type` in the message.
If NAI ever answers msgpack/SSE instead, the first real generation says exactly
that, instead of surfacing a confusing `NAI_ZIP_INVALID` from the parser. The
fix would then be a one-line body addition.

402 gets its own code because "you have no active subscription" is the single
most likely first-run failure and deserves an actionable message rather than a
generic auth error.

## 3. `lib/providers/adapters/nai.ts` (NEW)

Copy of the MiniMax lane descriptor with `LANE_ID = "nai"`,
`ERROR_PREFIX = "NAI_"`, `validateAuth()` checking `ctx.naiApiKey` presence
only (no prefix rule exists), `listModels()` returning
`getProvider("nai").models`, and the same `RETRYABLE_STATUSES` set
`{408,425,429,500,502,503,504}`.

## 4. `lib/providers/adapters/index.ts`

```diff
+import { createNaiAdapter } from "./nai.js";

 const ADAPTER_FACTORIES: Partial<Record<CoreProviderId, AdapterFactory>> = {
   minimax: createMinimaxAdapter,
   atlascloud: createAtlasCloudAdapter,
   comfy: createComfyAdapter,
+  nai: createNaiAdapter,
 };
```

`listProviderAdapters` iterates this map, so `tests/provider-adapter-v1-contract.test.ts`
covers the new adapter automatically.

## 5. `lib/errors/providerMap.ts`

Add every `NAI_*` code to `PROVIDER_ERROR_MAP`, mirroring MiniMax's class
choices (auth→`AUTH_INVALID`, rate→`RATE_LIMITED`, zip/image→ the internal or
upstream class MiniMax uses for `MINIMAX_IMAGE_INVALID`). An unmapped code
degrades to an unclassified failure in the UI.

## 6. `tests/nai-zip-decode.test.ts` (NEW) — activation evidence

Builds archives in-memory with `zlib.deflateRawSync`, so the real decoder runs
against a real archive and no binary fixture is committed.

| Case | Assertion |
|------|-----------|
| deflated PNG entry | output bytes equal the original PNG |
| stored (method 0) entry | output bytes equal the original PNG |
| JSON error body | throws `NAI_ZIP_INVALID` |
| encrypted flag | throws `NAI_ZIP_UNSUPPORTED` |
| data-descriptor flag | throws `NAI_ZIP_UNSUPPORTED` |
| ZIP64 sentinel size | throws `NAI_ZIP_UNSUPPORTED` |
| declared size > 50MB | throws `NAI_ZIP_TOO_LARGE` |
| compressed size past buffer | throws `NAI_ZIP_INVALID` |
| `looksLikeZip` on a PNG | false |

## 7. `tests/nai-provider-contract.test.ts` (NEW) — activation evidence

Stubs `globalThis.fetch`; no network, no token.

| Case | Assertion |
|------|-----------|
| ctx without key | `generateViaNai` throws `NAI_API_KEY_MISSING` |
| 200 + valid ZIP | resolves with base64 PNG and `effectiveModel` |
| 201 + valid ZIP | also treated as success |
| 401 / 402 / 429 / 500 | throw the mapped `NAI_*` codes |
| request body | `model`, `action:"generate"`, `n_samples:1`, `params_version:3` present |
| `straightAlpha: true` | body carries `straight_alpha: true` |
| sampler `k_euler_ancestral` | body carries `prefer_brownian` |
| sampler `k_euler` | body omits `prefer_brownian` |
| adapter | `laneId==="nai"`, `listModels()` matches registry, `normalizeError` prefixes `NAI_` |

The last two rows are the conditional-path proof for the sampler branch, which
otherwise never executes in a default run.

## Accept criteria

1. `npm run typecheck` = 0, `npm run typecheck:tests` = 0.
2. `node --test tests/nai-zip-decode.test.ts tests/nai-provider-contract.test.ts tests/provider-adapter-v1-contract.test.ts` = 0.
3. Every table row above observed passing (fired-path evidence, not suite-green).

## Scope boundary

IN: the seven files above. OUT: pipeline/route wiring (wp3), UI (wp4), img2img
or inpaint actions, Anlas estimation.
