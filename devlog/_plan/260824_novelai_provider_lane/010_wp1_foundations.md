# 010 — wp1: registry, type unions, config/runtimeContext/keys plumbing

Depends on: nothing. This phase must land first because `CoreProviderId` is
derived from `REGISTRY`; until `nai` exists there, no other file can name the
lane without a type error.

Independently verifiable at close: `npm run typecheck` = 0,
`node scripts/generate-provider-types.mjs --check` = 0 after regeneration, and
the registry/parity/key tests pass.

## File change map

| Path | Action |
|------|--------|
| `lib/providers/types.ts` | MODIFY — widen `KeyProviderId`, `ProviderVendor` |
| `lib/providers/registry.ts` | MODIFY — add `nai` manifest |
| `config.ts` | MODIFY — add `naiProvider` block + `naiApiKey` source |
| `lib/configKeys.ts` | MODIFY — register `naiApiKey` config key |
| `lib/runtimeContext.ts` | MODIFY — `naiApiKey`/`naiApiKeySource`/`hasNaiApiKey` |
| `routes/keys.ts` | MODIFY — `nai` KeyProvider through validate/set/clear |
| `ui/src/generated/providers.ts` | REGENERATE — `node scripts/generate-provider-types.mjs` |
| `tests/nai-key-validation-route.test.ts` | NEW |

## 1. `lib/providers/types.ts`

```diff
-export type KeyProviderId = "openai" | "xai" | "gemini" | "atlascloud" | "minimax";
+export type KeyProviderId = "openai" | "xai" | "gemini" | "atlascloud" | "minimax" | "nai";

-export type ProviderVendor = "openai" | "xai" | "google" | "atlascloud" | "minimax" | "comfy";
+export type ProviderVendor = "openai" | "xai" | "google" | "atlascloud" | "minimax" | "novelai" | "comfy";
```

## 2. `lib/providers/registry.ts`

Insert after the `minimax` entry, before `comfy`:

```diff
+  {
+    id: "nai",
+    vendor: "novelai",
+    credentials: [{
+      kind: "api-key",
+      keyVocabulary: "nai",
+      envVars: ["NOVELAI_API_KEY"],
+      // No keyPrefix ON PURPOSE: NAI accepts both a persistent API token and a
+      // session JWT, and publishes no prefix for either (001 §Authentication).
+      // Inventing one would reject valid tokens.
+      validateUrl: "https://api.novelai.net/user/data",
+      configKey: "naiApiKey",
+    }],
+    models: [
+      { id: "nai-diffusion-5-full", aliases: ["nai-v5-full"], kind: "image", supports: EDIT },
+      { id: "nai-diffusion-5-curated", aliases: ["nai-v5-curated"], kind: "image", supports: EDIT },
+      { id: "nai-diffusion-4-5-full", aliases: ["nai-v45-full"], kind: "image", supports: EDIT },
+      { id: "nai-diffusion-4-5-curated", aliases: ["nai-v45-curated"], kind: "image", supports: EDIT },
+    ],
+    referenceLimits: { image: 1, edit: 1 },
+    elementTaxonomy: "gpt",
+    limits: { timeoutMs: 180_000, maxInputBytes: 50 * 1024 * 1024 },
+    errorPrefix: "NAI_",
+  },
```

Notes on each non-obvious field:

- `supports: EDIT` = `{edit:true, mask:false, streaming:false}`. Masking is
  excluded because `routes/edit.ts` only routes mask-capable lanes to
  `editViaResponses`; NAI infill is a separate action and out of scope.
- `validateUrl` uses the **account** host `api.novelai.net`, not the image host.
  Validating a key by generating an image would spend Anlas on every key save —
  the same reasoning that made MiniMax validate against `/models`.
- `timeoutMs: 180_000` — above MiniMax's 120s because diffusion at V5
  resolutions is slower than a hosted REST image call, below Comfy's 30min
  because NAI is a hosted service with its own queue discipline.
- Aliases give the UI/CLI a short handle without changing the wire id.

## 3. `config.ts`

Add after the `minimaxProvider` block (~line 364):

```diff
+  naiProvider: {
+    defaultImageModel: pickStr(env.IMA2_NAI_IMAGE_MODEL_DEFAULT, fileCfg.naiProvider?.defaultImageModel, "nai-diffusion-5-full"),
+    baseUrl: pickStr(env.IMA2_NAI_BASE_URL, fileCfg.naiProvider?.baseUrl, "https://image.novelai.net"),
+    accountBaseUrl: pickStr(env.IMA2_NAI_ACCOUNT_BASE_URL, fileCfg.naiProvider?.accountBaseUrl, "https://api.novelai.net"),
+    generationTimeoutMs: pickInt(env.IMA2_NAI_GENERATION_TIMEOUT_MS, fileCfg.naiProvider?.generationTimeoutMs, 180_000),
+    defaultSteps: pickInt(env.IMA2_NAI_DEFAULT_STEPS, fileCfg.naiProvider?.defaultSteps, 23),
+    defaultScale: pickNum(env.IMA2_NAI_DEFAULT_SCALE, fileCfg.naiProvider?.defaultScale, 5),
+    defaultSampler: pickStr(env.IMA2_NAI_DEFAULT_SAMPLER, fileCfg.naiProvider?.defaultSampler, "k_euler_ancestral"),
+    defaultNoiseSchedule: pickStr(env.IMA2_NAI_DEFAULT_NOISE_SCHEDULE, fileCfg.naiProvider?.defaultNoiseSchedule, "karras"),
+  },
```

`defaultSteps: 23` matches the reference client's V4.5/V5 preset and stays
under the Opus free-tier ceiling of 28 (001 §Anlas). If `pickNum` does not
exist in `config.ts`, use `pickInt` for scale and document the integer
restriction instead of adding a helper.

Also register the key source alongside the other API keys:

```diff
+  naiApiKey: pickStr(env.NOVELAI_API_KEY, fileCfg.naiApiKey, undefined),
```

following whatever shape the existing `minimaxApiKey` resolution uses in the
same file.

## 4. `lib/configKeys.ts`

Add `naiApiKey` to the key registry next to `minimaxApiKey`, matching the
existing entry's shape exactly (secret-masking behavior depends on it).

## 5. `lib/runtimeContext.ts`

Mirror the three MiniMax lines at each of the three sites (interface ~line 51,
normalizer ~line 149, factory defaults ~line 216):

```diff
   minimaxApiKey: string | undefined;
   minimaxApiKeySource: ApiKeySource;
   hasMinimaxApiKey: boolean;
+  naiApiKey: string | undefined;
+  naiApiKeySource: ApiKeySource;
+  hasNaiApiKey: boolean;
```

```diff
+  if (target.naiApiKey === undefined && !Object.prototype.hasOwnProperty.call(target, 'naiApiKey')) target.naiApiKey = undefined;
+  if (target.hasNaiApiKey === undefined) target.hasNaiApiKey = false;
+  if (target.naiApiKeySource === undefined) target.naiApiKeySource = undefined;
```

```diff
+    naiApiKey: undefined,
+    naiApiKeySource: undefined,
+    hasNaiApiKey: false,
```

## 6. `routes/keys.ts` — the full field chain (PLAN-FIELD-CHAIN-01)

`nai` is a new value in the `KeyProvider` union, so every consumer must be
updated. Each stage below is a real edit site, verified by reading the file:

| Stage | Site | Change |
|-------|------|--------|
| type | `type KeyProvider` (L36) | add `\| "nai"` |
| creation | `isKeyProvider` (L81) | add `\|\| v === "nai"` |
| config map | `CONFIG_KEY_MAP` (L77) | `nai: "naiApiKey"` |
| prefix map | `KEY_PREFIX_MAP` (L38) | `nai: []` (no prefix — see registry note) |
| validate map | `VALIDATE_URL_MAP` (L53) | `nai: "https://api.novelai.net/user/data"` |
| read | `keySourceForProvider` (L94) | `if (provider === "nai") return { key: ctx.naiApiKey, source: ctx.naiApiKeySource \|\| "none" }` |
| status loop | `/api/keys/status` (L101) | add `"nai"` to the iterated tuple |
| set | PUT handler (L302) | set `naiApiKey`/`naiApiKeySource="config"`/`hasNaiApiKey=true` |
| clear | DELETE handler (L343) | reset the same three to undefined/"none"/false |

Validation branch: NAI's `/user/data` is a plain `GET` with
`Authorization: Bearer`. It needs no special-casing beyond the generic `else`
branch that already sends a bearer header and checks `res.ok`, so **no new
branch is added** — `nai` deliberately falls through to the existing default.

**Missing any one of these nine sites makes `nai` a ghost value:** the type
would admit it while the runtime silently ignored it.

## 7. Regenerate the UI catalog

```
node scripts/generate-provider-types.mjs
```

This rewrites `ui/src/generated/providers.ts` (marked *Do not edit*), adding
`"nai"` to `CORE_PROVIDER_IDS`, its four models to `PROVIDER_MODELS` and
`IMAGE_MODEL_IDS`, and `{image:1, edit:1}` to `PROVIDER_REFERENCE_LIMITS`.
Committing the registry without regenerating fails
`npm run test:provider-registry`.

## 8. `tests/nai-key-validation-route.test.ts` (NEW)

Mirrors `tests/minimax-key-validation-route.test.ts`. Asserts:

- `GET /api/keys/status` includes a `nai` row reporting
  `{configured:false, source:"none"}` with no key set.
- `PUT /api/keys/nai` with a stubbed-OK validation stores the key and reports
  `source:"config"`.
- `DELETE /api/keys/nai` clears it back to `source:"none"`.
- An unknown provider still yields `INVALID_PROVIDER`.

## Accept criteria

1. `npm run typecheck` = 0.
2. `node scripts/generate-provider-types.mjs --check` = 0.
3. `node --test tests/provider-registry-contract.test.ts tests/provider-registry-parity.test.ts tests/nai-key-validation-route.test.ts` = 0.
4. `GET /api/keys/status` shows a `nai` row with `source:"none"` on a keyless
   boot (activation evidence: the row only appears if all nine chain sites are
   wired).

## Scope boundary

IN: the eight files above. OUT: any adapter logic, any request to the image
host, any UI component edit (the generated catalog is not a component).
