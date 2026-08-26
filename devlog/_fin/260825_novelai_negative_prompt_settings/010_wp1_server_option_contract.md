# 010 — wp1: server option contract

Depends on wp0. Independently verifiable at close: `npm run typecheck` = 0 and
new `tests/nai-options-contract.test.ts` passes.

## Deliverable

One normalizer that all three **request-driven** NAI dispatch sites share, plus
the two adapter parameters that do not exist yet (001 §B, G2 + G3), plus the
two server surfaces audit round 1 added: published defaults and negative-prompt
history metadata.

> `lib/agentImageVideoGen.ts:130-139` is a fourth direct `generateViaNai`
> caller and is deliberately excluded (`004` §B1): the Agent surface has no
> per-request option source, so it stays on adapter/config defaults.

## File change map

| Path | Action |
|---|---|
| `lib/naiOptions.ts` | **NEW** — `NaiRequestOptions` type + `readNaiOptions(body)` |
| `lib/naiImageAdapter.ts` | MODIFY — export `NaiGenerateOptions`; add `cfgRescale`, `varietyPlus`; wire both into `parameters` |
| `lib/generatePipeline.ts` | MODIFY — replace the seven-field ladder at `:478-484` with `...readNaiOptions(req.body)` |
| `lib/multimodePipeline.ts` | MODIFY — same spread in the NAI branch (`:416-424`) |
| `lib/nodeGeneration.ts` | MODIFY — same spread in the NAI branch (`:338-344`) |
| `lib/nodeHelpers.ts` | MODIFY — widen `NodeGenerateBody` so the fields survive typing |
| `lib/capabilities.ts` | MODIFY — add `defaults.nai` from `appConfig.naiProvider` (`004` §B3). `routes/capabilities.ts:10` just delegates to this builder and needs no edit |
| `lib/generatePipeline.ts` | MODIFY — record `composerNegativePrompt` in history metadata (`004` §B6b) |
| `lib/multimodePipeline.ts` | MODIFY — same metadata field |
| `tests/nai-options-contract.test.ts` | **NEW** |
| `tests/nai-provider-contract.test.ts` | MODIFY — assert `cfg_rescale` and `skip_cfg_above_sigma` on the wire |

## `lib/naiOptions.ts` (new)

```ts
import {
  NAI_SAMPLERS, NAI_NOISE_SCHEDULES,
  NAI_UC_PRESET_IDS, NAI_QUALITY_PRESET_IDS,
} from "./naiImageAdapter.js";

/** ddim_v3 is V3-only; no registered model accepts it (001 §D). */
const SELECTABLE_SAMPLERS = NAI_SAMPLERS.filter((s) => s !== "ddim_v3");

export type NaiRequestOptions = {
  negativePrompt?: string;
  steps?: number;
  scale?: number;
  cfgRescale?: number;
  sampler?: string;
  noiseSchedule?: string;
  seed?: number;
  straightAlpha?: boolean;
  varietyPlus?: boolean;
  ucPresetId?: string;
  qualityPresetId?: string;
};
```

`readNaiOptions(body: unknown): NaiRequestOptions` returns an object with ONLY
the keys that validated. Rules are the table in 002 §D2. Out-of-alphabet values
are dropped (not 400) so a stale client cannot brick generation; numbers are
clamped rather than dropped so a slider edge is forgiving.

Two helpers keep it under the 50-line function limit:

```ts
function pickEnum(value: unknown, allowed: readonly string[]): string | undefined
function pickNumber(value: unknown, min: number, max: number): number | undefined
```

## `lib/naiImageAdapter.ts` diff

1. `type NaiGenerateOptions` → `export type NaiGenerateOptions` (`:42`). The
   normalizer's return type must be assignable to it, and a compile error at
   that seam is the cheapest drift detector available.

2. Two new members:

```ts
  /** 0-1. CLIsu exposes this; the previous hardcoded 0 made it unreachable. */
  cfgRescale?: number | undefined;
  /** V4.5/V5 "Variety+": raises skip_cfg_above_sigma off null. */
  varietyPlus?: boolean | undefined;
```

3. `parameters.cfg_rescale` (`:136`) changes from `0` to
   `options.cfgRescale ?? 0`.

4. New, after the seed block (`:154-156`):

```ts
  // CLIsu's coefficient for the V4.5/V5 family (stableDiff.ts:416-419). The
  // V4-and-older 0.01889 branch is unreachable here: no V4/V3/V2 model is
  // registered, so a single coefficient is the honest shape.
  if (options.varietyPlus === true) {
    parameters.skip_cfg_above_sigma = Math.sqrt(width * height) * 0.05766;
  }
```

Left alone: the field is simply absent when Variety+ is off. CLIsu sends
explicit `null`; absent and null are equivalent to the API and absent matches
this adapter's existing conditional-field style (`seed`, `prefer_brownian`).

## Pipeline diffs

`lib/generatePipeline.ts:478-484` — the seven-line ladder collapses:

```ts
        if (activeProvider === "nai") {
          const r = await generateViaNai(generationPrompt, requireRuntimeContext(ctx), {
            model: imageModel,
            size: effectiveSize,
            signal: cancelController.signal,
            requestId,
            ...readNaiOptions(req.body),
          });
```

`lib/multimodePipeline.ts:416-424` and `lib/nodeGeneration.ts:338-344` gain
the same `...readNaiOptions(...)` spread. Both currently forward nothing, so
this is the fix for G4.

`lib/nodeHelpers.ts` `NodeGenerateBody` gains
`& Partial<NaiRequestOptions>` — the body already flows through untyped, but a
typed surface stops the next person from re-adding a private ladder.

## `tests/nai-options-contract.test.ts` (new)

| Case | Assertion |
|---|---|
| empty body | returns `{}`; no key with `undefined` value |
| every valid field | round-trips unchanged |
| `sampler: "ddim_v3"` | dropped — V3-only |
| `sampler: "nonsense"` | dropped |
| `noiseSchedule` / `ucPresetId` / `qualityPresetId` garbage | dropped |
| `steps: 999` | clamped to 50 |
| `steps: 0` | clamped to 1 |
| `scale: -5` | clamped to 1 |
| `cfgRescale: 2` | clamped to 1 |
| `seed: -1` / `seed: 2**33` / `seed: NaN` | dropped |
| `negativePrompt: 12345` | dropped (not coerced) |
| `straightAlpha: "true"` | dropped — string is not boolean |
| 20000-char negative prompt | truncated to 10000 |
| `null` / `undefined` / array body | returns `{}` without throwing |

Plus a **dispatch parity case** (amended by `004` §B1): read the source of the
three request-driven NAI dispatch sites and assert each contains
`readNaiOptions`, AND assert `lib/agentImageVideoGen.ts` does **not** — with
the exclusion reason in the assertion message.

A test that silently ignores a call site is how this defect gets re-created.
Naming Agent as a deliberate exclusion means a future contributor who wires it
up has to change the test on purpose, which is the moment they read why.

## `tests/nai-provider-contract.test.ts` additions

| Case | Assertion |
|---|---|
| `cfgRescale: 0.7` | wire body has `cfg_rescale === 0.7` |
| no `cfgRescale` | wire body has `cfg_rescale === 0` |
| `varietyPlus: true`, size `832x1216` | `skip_cfg_above_sigma ≈ sqrt(832*1216)*0.05766` |
| `varietyPlus` absent | key absent from `parameters` |
| `ucPresetId: "none"` | wire body carries it (proves G2 closed) |

## `/api/capabilities` — `defaults.nai` (`004` §B3)

The adapter prefers a sent value over config (`lib/naiImageAdapter.ts:122-124`),
so a hardcoded client default would silently defeat
`IMA2_NAI_DEFAULT_STEPS` and friends. The fix is to let the server tell the
client what its defaults are:

Inside the existing `defaults` object at `lib/capabilities.ts:76`, beside
`oauth` / `api` / `grok`, using that file's own `appConfig` binding:

```ts
      nai: {
        sampler: appConfig.naiProvider.defaultSampler,
        noiseSchedule: appConfig.naiProvider.defaultNoiseSchedule,
        steps: appConfig.naiProvider.defaultSteps,
        scale: appConfig.naiProvider.defaultScale,
      },
```

The JSON path is exactly **`defaults.nai`** — not a top-level `naiDefaults`.
Read-only echo of existing config; no new config keys. The client type mirrors
that path (`020`: `Ima2Capabilities.defaults?.nai`).

Additive and safe for existing consumers: capability tests inspect named
fields rather than whole-object equality, `bin/commands/capabilities.ts:93`
renders named `oauth`/`api`/`grok` members, and
`bin/commands/defaults.ts:79` spreads the object.

`model` is **not** published (amended by `005` §R2-B1): `NaiOptions` has no
`model` member — model flows through `imageModel` and
`normalizeNaiImageModel` — and publishing a field nothing consumes invites the
exact drift this unit is fixing.

**This block is for DISPLAY only.** The client shows it in the panel so the
numbers match the operator's configuration, but it never re-sends an untouched
value (020): the server already resolves defaults at
`lib/naiImageAdapter.ts:122-124`. That is what makes the async
`syncCapabilities()` window harmless rather than a race.

Test: `GET /api/capabilities` returns `defaults.nai` matching
`config.naiProvider`, and overriding `IMA2_NAI_DEFAULT_STEPS` changes
`defaults.nai.steps`.

## V5-only parameter gating in the adapter (`005` §R2-B2)

`straight_alpha` and `qualityPresetId` are V5 features
(`lib/naiImageAdapter.ts:36-37`) sent today with no model guard (`:127`,
`:142`). Client-side gating alone cannot hold: model and options hydrate from
two independent persisted keys, and `storeSettingsImpl.ts:485-489` sets a NAI
model without passing through the panel.

### The contract, stated once (`005` amended by audit round 3)

Round 2 asked for omission AND `straight_alpha: false` AND an unchanged V4.5
wire body. Those cannot all hold: the adapter today sends
`qualityPresetId: "standard"` (`:128`) and `straight_alpha: false` (`:142`)
for **every** model including V4.5.

**Chosen contract: preserve the current wire shape; neutralize user
influence.** Both keys keep appearing for every model, exactly as today, but on
a non-V5 model their value is pinned and no client input can move it:

```ts
  const isV5 = model === "nai-diffusion-5-full" || model === "nai-diffusion-5-curated";
  // V5-only features. On V4.5 these are pinned to today's constants: a request
  // carrying a user value is stale client state, not intent.
  parameters.straight_alpha = isV5 && options.straightAlpha === true;
  parameters.qualityPresetId = isV5 ? (options.qualityPresetId ?? "standard") : "standard";
```

Why this over strict omission: omitting `qualityPresetId` would be a real
change to the V4.5 request NovelAI receives today, in a unit that has no
credential to test the consequence. Pinning changes nothing upstream while
closing the whole hole — the reviewer's stale-persistence scenario produces a
wire body byte-identical to a fresh install's.

Test: a V4.5 model with `straightAlpha: true` and `qualityPresetId: "light"`
produces `straight_alpha === false` and `qualityPresetId === "standard"` —
the same body as a request that sent neither.

## History metadata (`004` §B6b)

`lib/generatePipeline.ts:351-352, 684-685` records `composerPrompt` and
`composerInsertedPrompts`. A generation whose undesired-content prompt is
unrecoverable cannot be reproduced, so `composerNegativePrompt` joins them
(same in `lib/multimodePipeline.ts:321-322`), written only when
`activeProvider === "nai"` **and** the string is non-empty (`005` §R2-C2 —
non-empty alone would let any API caller inject the field into another lane's
metadata). Every non-NAI history entry stays byte-identical to today's.

**Restoring** it into the composer from a history item is out of scope and
noted as a follow-on: recording is what makes restoration possible later, and
conflating the two would pull the metadata-restore dialog into this unit.

## Accept criteria

1. `npm run typecheck` = 0, `npm run typecheck:tests` = 0.
2. `npm test` = `fail 0`, including the new file.
3. `npm run test:inventory` = 0 after regeneration.
4. Grep proof: no **request-driven** NAI dispatch site builds options by hand.
   `lib/agentImageVideoGen.ts` is the named exception (`005` §R2-C1).

## Scope boundary

IN: the files above. OUT: any client change; any other provider's option
handling; the registry (no new model).
