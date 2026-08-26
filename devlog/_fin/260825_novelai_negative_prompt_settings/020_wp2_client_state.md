# 020 — wp2: client state and payload emission

Depends on wp1 (`010`): the payload must have a server that reads it.

Independently verifiable at close: `cd ui && npm run build` = 0 and a new store
contract test proves the payload carries the options for `nai` and for no other
provider.

> **Rewritten after audit round 3.** Rounds 1-2 layered a sparse-override
> redesign on top of full-object pseudocode and left both in the file. An
> engineer following the detail would have rebuilt the defect. This document is
> now single-design throughout; `004` and `005` record why.

## Deliverable

Sparse `naiOptionOverrides` + server-published display defaults +
`negativePrompt` composer state, all emitted in the payload only for the nai
lane.

## The state model in one paragraph

The user's persisted state is **only what they explicitly changed**. Everything
else follows the operator's configuration, forever — not "until the first
edit". Three inputs resolve to one displayed value; only the middle one crosses
the network, and untouched fields cross nothing at all.

```
COMPILED_FALLBACK  ->  naiServerDefaults  ->  naiOptionOverrides
(pre-fetch display)    (from capabilities)    (persisted, sparse)
```

## File change map

| Path | Action |
|---|---|
| `ui/src/lib/naiOptions.ts` | **NEW** — `NaiOptions`, `NaiOptionOverrides`, `COMPILED_FALLBACK`, alphabets, `coerceNaiOverrides`, `resolveNaiOptions`, `isNaiV5Model` |
| `ui/src/store/persistenceRegistry.ts` | MODIFY — append `ima2.naiOptions` (shape `json:NaiOptionOverrides`) |
| `ui/src/store/storePersistence.ts` | MODIFY — `loadNaiOverrides` / `saveNaiOverrides`; `negativePrompt` in the draft |
| `ui/src/store/storeTypes.ts` | MODIFY — state `naiOptionOverrides`, `naiServerDefaults`, `negativePrompt`; actions `setNaiOption`, `resetNaiOptions`, `setNegativePrompt` |
| `ui/src/store/storeHelpers.ts` | MODIFY — `selectResolvedNaiOptions(state)` selector |
| `ui/src/store/storeSettingsImpl.ts` | MODIFY — `setNaiOptionImpl`, `resetNaiOptionsImpl` |
| `ui/src/store/storeCapabilitiesImpl.ts` | MODIFY — set `naiServerDefaults` from `defaults.nai` |
| `ui/src/store/storeSettingsImpl.ts` | (same row as above) — `setNegativePromptImpl` beside `setPromptImpl` at `:565-568` |
| `ui/src/store/useAppStore.ts` | MODIFY — hydration + action wiring |
| `ui/src/store/storeGenImpl.ts` | MODIFY — `naiPayloadFields`, classic + multimode, forced `n: 1` |
| `ui/src/store/storeNodeGenImpl.ts` | MODIFY — same spread for node |
| `ui/src/store/storeGenerateEntryImpl.ts` | MODIFY — NAI bypasses multimode |
| `ui/src/lib/nodeApi.ts` | MODIFY — `NodeGenerateRequest` gains the fields |
| `ui/src/lib/api-capabilities.ts` | MODIFY — `Ima2Capabilities.defaults?.nai` |
| `ui/src/types.ts` | MODIFY — `GenerateRequest` gains the optional fields |
| `tests/nai-client-options-contract.test.ts` | **NEW** |

## `ui/src/lib/naiOptions.ts` (new)

```ts
export const NAI_UI_SAMPLERS = [
  "k_euler_ancestral", "k_dpmpp_2s_ancestral", "k_dpmpp_2m_sde",
  "k_euler", "k_dpmpp_2m", "k_dpmpp_sde",
] as const;                               // modern six; ddim_v3 excluded (001 D)

export const NAI_UI_NOISE_SCHEDULES = ["native","karras","exponential","polyexponential"] as const;
export const NAI_UI_UC_PRESETS = ["heavy","light","furryFocus","humanFocus","none"] as const;
export const NAI_UI_QUALITY_PRESETS = ["standard","light","none"] as const;

export type NaiOptions = {
  sampler: string;
  noiseSchedule: string;
  steps: number;
  scale: number;
  cfgRescale: number;
  ucPresetId: string;
  qualityPresetId: string;
  varietyPlus: boolean;
  straightAlpha: boolean;
  seed: number | null;      // null = let the server randomize
};

/** ONLY the fields the user explicitly changed. */
export type NaiOptionOverrides = Partial<NaiOptions>;

/**
 * Shown before /api/capabilities answers. NOT sent: an untouched field is
 * absent from the request and the server resolves it from config.naiProvider.
 */
export const COMPILED_FALLBACK: NaiOptions = {
  sampler: "k_euler_ancestral",
  noiseSchedule: "karras",
  steps: 23,
  scale: 5,
  cfgRescale: 0,
  ucPresetId: "heavy",
  qualityPresetId: "standard",
  varietyPlus: false,
  straightAlpha: false,
  seed: null,
};

export function resolveNaiOptions(
  serverDefaults: Partial<NaiOptions> | null,
  overrides: NaiOptionOverrides,
): NaiOptions {
  return { ...COMPILED_FALLBACK, ...(serverDefaults ?? {}), ...overrides };
}

export function isNaiV5Model(model: string): boolean {
  return model === "nai-diffusion-5-full" || model === "nai-diffusion-5-curated";
}

/** Per-key validation. An invalid key is DROPPED, so that field returns to
 *  server ownership rather than snapping to a compiled constant. */
export function coerceNaiOverrides(value: unknown): NaiOptionOverrides;
```

The alphabets duplicate the server's. Duplication is intentional and bounded —
the UI cannot import from `lib/` (different tsconfig, different bundle) — and
the contract test asserts equality, so drift fails a gate rather than shipping.

`COMPILED_FALLBACK` mirrors `config.ts:369-380` (001 F) but is display-only.
There is no `DEFAULT_NAI_OPTIONS`; that name belonged to the rejected design.

## Persistence

`persistenceRegistry.ts`:

- **append** `"ima2.naiOptions"` to the end of `PERSISTED_KEYS`. Constants are
  exported by index (`PERSISTED_KEYS[14]`, `[15]`...), so inserting anywhere
  else silently repoints `LOCALE_STORAGE_KEY` at another key;
- export `NAI_OPTIONS_STORAGE_KEY` at its own new index;
- registry row:
  `"ima2.naiOptions": { domain: "generation", shape: "json:NaiOptionOverrides", resetSafe: true }`.

`storePersistence.ts`:

```ts
export function loadNaiOverrides(): NaiOptionOverrides {
  try {
    const raw = localStorage.getItem(NAI_OPTIONS_STORAGE_KEY);
    return raw ? coerceNaiOverrides(JSON.parse(raw)) : {};
  } catch { return {}; }
}

/** Whole-object write of the SPARSE overrides. Best-effort: a quota failure is
 *  swallowed, exactly like saveReasoningEffort (storePersistence.ts:193-197,
 *  which uses a bare `catch {}` — there is no logging helper). */
export function saveNaiOverrides(overrides: NaiOptionOverrides): void {
  try { localStorage.setItem(NAI_OPTIONS_STORAGE_KEY, JSON.stringify(overrides)); }
  catch {}
}
```

There is no reload-then-merge helper. The caller owns the current overrides in
store state and writes the merged result, which is what makes "untouched"
survive a write to a neighbouring key.

Also add `negativePrompt` to `GenerationDefaults` (`storeTypes.ts:208-230`),
its loader (`storePersistence.ts:387-390`), and hydration
(`useAppStore.ts:264-266`), so the draft survives reload the way `prompt` does
(004 B6b).

## Store wiring

`storeTypes.ts`:

```ts
  naiOptionOverrides: NaiOptionOverrides;
  naiServerDefaults: Partial<NaiOptions> | null;
  negativePrompt: string;
```
```ts
  setNaiOption: <K extends keyof NaiOptions>(key: K, value: NaiOptions[K]) => void;
  resetNaiOptions: () => void;
  setNegativePrompt: (value: string) => void;
```

There is **no `naiOptions` state field.** The resolved value is a selector:

```ts
// storeHelpers.ts
export function selectResolvedNaiOptions(state: AppState): NaiOptions {
  return resolveNaiOptions(state.naiServerDefaults, state.naiOptionOverrides);
}
```

**Consume it with `useShallow`.** The installed Zustand is 5.x
(`ui/package.json:23`) and `useStore` hands the selector's return value
straight to `React.useSyncExternalStore`
(`ui/node_modules/zustand/esm/react.mjs:5-11`). A selector that builds a fresh
object every call never returns a cached snapshot, which means repeated renders
and a React warning:

```ts
import { useShallow } from "zustand/react/shallow";
const naiOptions = useAppStore(useShallow(selectResolvedNaiOptions));
```

This is the first `useShallow` use in the codebase — every existing selector
returns a primitive or an existing reference — so wp3 must import it rather
than copy a neighbouring one-liner.

`storeSettingsImpl.ts`:

```ts
export function setNaiOptionImpl<K extends keyof NaiOptions>(
  set: StoreSet, get: StoreGet, key: K, value: NaiOptions[K],
): void {
  const naiOptionOverrides = { ...get().naiOptionOverrides, [key]: value };
  saveNaiOverrides(naiOptionOverrides);   // best-effort
  set({ naiOptionOverrides });            // in-memory update is unconditional
}

export function resetNaiOptionsImpl(set: StoreSet): void {
  saveNaiOverrides({});
  set({ naiOptionOverrides: {} });
}
```

Two properties the contract test pins:

- **Setting a value equal to the current server default still creates an
  override.** That is correct: it records intent, so a later change to
  `IMA2_NAI_DEFAULT_STEPS` does not move a number the user deliberately chose.
- **A quota failure does not block the in-memory update.** The session keeps
  working; the choice does not survive reload, and an older persisted override
  may reappear. Best-effort, stated rather than implied (005 §2).

`storeCapabilitiesImpl.ts`:

```ts
    const capabilities = await getCapabilities();
    set({
      referenceLimit: normalizeReferenceLimit(capabilities.limits?.maxRefCount),
      naiServerDefaults: coerceNaiOverrides(capabilities.defaults?.nai ?? null),
    });
```

Same coercion as persisted overrides: a server that publishes a field this
client version does not understand contributes nothing rather than corrupting
the resolve. The `catch` branch leaves `naiServerDefaults` at `null`.

`useAppStore.ts`: hydrate `naiOptionOverrides: loadNaiOverrides()`,
`naiServerDefaults: null`, `negativePrompt` from the draft; wire the three
actions.

### `setNegativePromptImpl`

Beside `setPromptImpl` (`storeSettingsImpl.ts:565-568` — **not**
`storePromptImpl.ts`, which owns library/insertion behavior), and it must
persist on every edit, exactly like `prompt`:

```ts
export function setNegativePromptImpl(negativePrompt: string, set: StoreSet): void {
  saveGenerationDefaultsPatch({ negativePrompt });
  set({ negativePrompt });
}
```

Adding the field to `GenerationDefaults`, the loader, and hydration is not
enough on its own: without this write, nothing ever lands in the blob.

## Payload emission

```ts
function naiPayloadFields(s: AppState): Record<string, unknown> {
  if (s.provider !== "nai") return {};
  const o: NaiOptionOverrides = { ...s.naiOptionOverrides };
  // V5-only fields never ride on a V4.5 request, whatever persistence holds
  // (005 R2-B2). The adapter enforces this too; this keeps the wire honest.
  if (!isNaiV5Model(s.imageModel)) {
    delete o.straightAlpha;
    delete o.qualityPresetId;
  }
  if (o.seed === null) delete o.seed;   // null means "let the server pick"
  const neg = s.negativePrompt.trim();
  return { ...o, ...(neg ? { negativePrompt: neg } : {}) };
}
```

**Overrides, not the resolved object.** A field the user never touched is
absent from the request, so `lib/naiImageAdapter.ts:122-124` resolves it from
`config.naiProvider` whether or not `syncCapabilities()` has returned. That
dissolves the async window instead of racing it, and it is why `defaults.nai`
is a display concern only.

Spread into **all three** builders: classic and multimode in `storeGenImpl.ts`,
node in `storeNodeGenImpl.ts`. The `provider !== "nai"` guard is the whole
safety story for c7 — for any other lane the spread contributes nothing and the
payload is byte-identical to today's.

Also in this file (004 B4): `n: s.provider === "nai" ? 1 : s.count`.

## Request types

`GenerateRequest` (`ui/src/types.ts:229-249`) gains the fields as optional;
`MultimodeGenerateRequest` derives from it and inherits them.

**Node does not** — `NodeGenerateRequest` is an independent type at
`ui/src/lib/nodeApi.ts:7-32` and `storeNodeGenImpl.ts:208-231` posts it
directly. It gets the same optional fields added explicitly.

`api-capabilities.ts`: `Ima2Capabilities` gains
`defaults?: { nai?: Partial<NaiOptions> }` — additive, matching the exact JSON
path `defaults.nai` that `010` publishes.

## `tests/nai-client-options-contract.test.ts` (new)

| Case | Assertion |
|---|---|
| alphabet parity | `NAI_UI_SAMPLERS` subset of server `NAI_SAMPLERS`; `ddim_v3` in server, not in UI |
| alphabet parity | UI noise/uc/quality lists === server lists exactly |
| fallback parity | `COMPILED_FALLBACK` steps/scale/sampler/noiseSchedule === `config.ts` defaults |
| resolve order | overrides beat server defaults beat compiled fallback |
| untouched field | absent from the payload entirely — the server default applies |
| touched = default | still recorded as an override |
| reset | `resetNaiOptions` empties overrides; payload carries no option keys |
| quota failure | in-memory overrides still update when `setItem` throws |
| corrupt override | one invalid key dropped, the others preserved |
| stale V5 state | V4.5 model + persisted `straightAlpha: true` / `qualityPresetId: "light"` -> neither key in the payload |
| payload gating | source gates on `provider !== "nai"` in all three builders |
| server acceptance | every key emitted is a key `readNaiOptions` reads |
| index stability | pre-existing `PERSISTED_KEYS` index constants still resolve to their original strings |
| negative prompt | omitted when empty/whitespace, present when non-empty |
| negative prompt | round-trip: `setNegativePrompt("x")` then reload restores `"x"` from `ima2.generationDefaults` |
| selector stability | `selectResolvedNaiOptions` is consumed via `useShallow` in `NaiControlsPanel` |
| count | `n === 1` for nai, `s.count` otherwise |

"Every key emitted is a key the server reads" is the case that matters most: it
is the exact defect this unit exists to fix, encoded so it cannot recur.

## Accept criteria

1. `cd ui && npm run build` = 0.
2. `npm test` = `fail 0`.
3. Reload persistence proven by the load/save round-trip test.
4. A non-nai provider's payload is unchanged — asserted by the gating case.

## Scope boundary

IN: the files above. OUT: any rendered control (wp3); i18n strings (wp4); any
server file.
