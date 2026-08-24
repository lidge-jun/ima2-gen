# 040 — wp4: UI, doctor, i18n

Depends on wp3 (`030`): the UI reads `/api/models`, so the lane must already be
served.

Independently verifiable at close: `cd ui && npm run build` = 0 and a rendered
screenshot shows NovelAI selectable with its four models.

## What the registry already did for us

`ui/src/generated/providers.ts` is produced by
`scripts/generate-provider-types.mjs` from `lib/providers/registry.ts`. After
wp1 regenerated it, the UI already knows `"nai"`, its four models, and its
reference limits. So this phase is **not** "teach the UI about a provider" — it
is "add the human-facing labels and the key-entry row that the generator cannot
infer".

Anything in the UI that derives from `CORE_PROVIDER_IDS`, `PROVIDER_MODELS`,
`IMAGE_MODEL_IDS`, or `PROVIDER_REFERENCE_LIMITS` needs **no edit**. Only
hand-written maps do.

## File change map

| Path | Action |
|------|--------|
| `ui/src/lib/imageModels.ts` | MODIFY — display labels for the 4 NAI models |
| `ui/src/lib/referenceLimits.ts` | VERIFY — should be generator-driven; edit only if it hardcodes |
| `ui/src/lib/errorCodes.ts` | MODIFY — user-facing text for `NAI_*` codes |
| `ui/src/hooks/useKeyStatus.ts` | MODIFY — include `nai` in the polled providers |
| `ui/src/hooks/useProviderAvailability.ts` | MODIFY — `nai` availability from key status |
| `ui/src/store/storeSettingsImpl.ts` | MODIFY — persist NAI selection/options |
| `ui/src/store/storeHelpers.ts` | MODIFY — provider-label / default-model helpers |
| `ui/src/components/GenProviderModelSelect.tsx` | MODIFY — NovelAI option group |
| `ui/src/components/ApiKeyInput.tsx` | MODIFY — NAI key field |
| `ui/src/components/AccountSettings.tsx` | MODIFY — NAI account row |
| `ui/src/components/settings/ProviderStatusSelect.tsx` | MODIFY — NAI status entry |
| `ui/src/components/home/HomePromptComposer.tsx` | MODIFY — NAI in composer provider list |
| `ui/src/components/ResultMetadataModal.tsx` | MODIFY — NAI provider label in metadata |
| `bin/lib/doctor-providers.ts` | MODIFY — NAI doctor branch |
| i18n dictionaries | MODIFY — every new string key, all locales |
| `tests/nai-ui-registration-contract.test.ts` | NEW |

## Display labels

| Model id | Label |
|----------|-------|
| `nai-diffusion-5-full` | NAI Diffusion V5 Full |
| `nai-diffusion-5-curated` | NAI Diffusion V5 Curated |
| `nai-diffusion-4-5-full` | NAI Diffusion V4.5 Full |
| `nai-diffusion-4-5-curated` | NAI Diffusion V4.5 Curated |

Provider display name: **NovelAI**. Lane id stays `nai`.

## Error strings (`ui/src/lib/errorCodes.ts`)

| Code | User-facing message |
|------|--------------------|
| `NAI_API_KEY_MISSING` | NovelAI API token is not set. |
| `NAI_AUTH_FAILED` | NovelAI rejected the token. |
| `NAI_SUBSCRIPTION_REQUIRED` | NovelAI requires an active subscription (Opus/Scroll/Tablet). |
| `NAI_RATE_LIMITED` | NovelAI is rate limiting requests. Try again shortly. |
| `NAI_BAD_REQUEST` | NovelAI rejected the generation parameters. |
| `NAI_ZIP_INVALID` / `NAI_ZIP_UNSUPPORTED` / `NAI_ZIP_TOO_LARGE` | NovelAI returned an unreadable image archive. |
| `NAI_IMAGE_INVALID` / `NAI_EMPTY_IMAGE` | NovelAI returned no usable image. |
| `NAI_MASK_UNSUPPORTED` | NovelAI editing does not support masks yet. |
| `NAI_UPSTREAM_ERROR` | NovelAI request failed. |

The subscription message names the tiers because "402" is otherwise
indistinguishable from a bad token to a first-time user.

## Key input affordance

`ApiKeyInput` must **not** apply a prefix hint or client-side format check for
NAI. Both accepted token kinds (persistent token, session JWT) have no
published prefix (001 §Authentication); a hint would mislead and a check would
reject valid tokens. Placeholder text: "NovelAI persistent API token".

## `bin/lib/doctor-providers.ts`

Existing shape at L116 branches on `credential.keyVocabulary`. Add:

```diff
+  if (credential.keyVocabulary === "nai") {
+    const cfg = runtimeConfig.naiProvider;
+    // report base URL, default model, and whether NOVELAI_API_KEY / config key resolves
+  }
```

matching the MiniMax branch's output shape so `tests/doctor-provider-contract.test.ts`
stays satisfied.

## i18n

Every new string goes into all locale dictionaries.
`tests/i18n-dictionary-contract.test.ts` fails on a key present in one locale
and missing in another, so partial translation is a build failure, not a
cosmetic gap.

## `tests/nai-ui-registration-contract.test.ts` (NEW)

Mirrors `tests/minimax-ui-registration-contract.test.ts`:

| Case | Assertion |
|------|-----------|
| generated catalog | `CORE_PROVIDER_IDS` includes `"nai"` |
| generated catalog | `PROVIDER_MODELS.nai.image` has the 4 ids, `.video` empty |
| labels | every NAI model id has a display label (no raw id leaks to UI) |
| error codes | every `NAI_*` thrown by the adapter has UI text |
| key status | `nai` appears in the polled provider list |

The "every thrown code has UI text" row is the one that catches drift: it
enumerates the adapter's codes and fails if a new one lacks a message.

## Accept criteria

1. `cd ui && npm run build` = 0.
2. `node --test tests/nai-ui-registration-contract.test.ts tests/i18n-dictionary-contract.test.ts tests/doctor-provider-contract.test.ts` = 0.
3. **Render grounding (C-RENDER-GROUNDING-01):** serve the built UI, open the
   provider selector, screenshot at 1280x720, and read the screenshot back —
   NovelAI present with four correctly-labelled models. Screenshot persisted to
   this unit folder (C4 = STRICT).

## Scope boundary

IN: the files above. OUT: any server behavior change; any restyle beyond adding
the provider to existing controls.
