# 002 — Design decisions

Four decisions that shape every decade doc. Each is written here so wp1-wp4 do
not relitigate them.

## D1 — One normalizer, three request-driven pipelines

> Amended by audit round 1 (`004` §B1): a fourth caller exists.

**Problem.** `/api/generate` forwards seven NAI fields
(`lib/generatePipeline.ts:478-484`), multimode forwards zero
(`lib/multimodePipeline.ts:416-424`), node forwards zero
(`lib/nodeGeneration.ts:338-344`). Adding two more fields to the seven would
make the asymmetry worse, and copying the `...(typeof x === "string" ? {x} : {})`
ladder into three files is exactly how the three contracts drifted apart.

**The fourth caller.** `lib/agentImageVideoGen.ts:130-139` calls
`generateViaNai` directly. It is a conversational surface with no settings
panel; its provider options come from `lib/agentSettings.ts`, not a browser
store. Wiring the normalizer into it would require inventing an agent-side
option source no user can set, so Agent is **explicitly default-only and out of
scope** — recorded here rather than left as an unstated hole.

**Decision.** A new `lib/naiOptions.ts` exports:

```ts
export type NaiRequestOptions = { /* the full option set */ };
export function readNaiOptions(body: unknown): NaiRequestOptions;
```

It performs the type checks and alphabet validation once. All three pipelines
call `...readNaiOptions(req.body)`. Comfy set this precedent with
`lib/comfyGraphBind.ts`; this is the same move for NAI.

**Rejected alternative:** validating inside `generateViaNai`. The adapter would
then need to distinguish "caller omitted it" from "caller sent garbage", and the
error would surface as an upstream 400 instead of a local 400.

**Consequence:** multimode and node inherit the full option set for free, and
`tests/nai-*-contract` can assert one normalizer instead of three call sites.

## D2 — Validate against the alphabet, reject don't clamp

`NAI_SAMPLERS`, `NAI_NOISE_SCHEDULES`, `NAI_UC_PRESET_IDS`, and
`NAI_QUALITY_PRESET_IDS` are declared (`lib/naiImageAdapter.ts:20-37`) and
never enforced — the pipeline checks `typeof === "string"` and forwards
anything (`lib/generatePipeline.ts:482-483`).

**Decision.** `readNaiOptions` drops out-of-alphabet values and the caller gets
the config default, EXCEPT numeric ranges, which are clamped:

| Field | Rule | Rationale |
|---|---|---|
| `sampler` | must be in `NAI_SAMPLERS` minus `ddim_v3` | `ddim_v3` is V3-only (001 §D); no registered model accepts it |
| `noiseSchedule` | must be in `NAI_NOISE_SCHEDULES` | |
| `ucPresetId` | must be in `NAI_UC_PRESET_IDS` | |
| `qualityPresetId` | must be in `NAI_QUALITY_PRESET_IDS` | |
| `steps` | clamp 1-50 | NovelAI's Opus free tier caps at 28; 50 is the paid ceiling |
| `scale` | clamp 1-10 | UI slider range |
| `cfgRescale` | clamp 0-1 | matches CLIsu's number input (`OtherBotSettings.svelte:372-373`) |
| `seed` | finite integer 0 ≤ n ≤ 2^32-1, else omit | |
| `negativePrompt` | string, trimmed of nothing, max 10000 chars | prompt-shaped, no alphabet |

Dropping rather than 400-ing keeps a stale localStorage value from bricking
generation after a future alphabet change.

## D3 — one registry key holding SPARSE overrides

> Amended by audit rounds 2-3 (`005` §R2-B1). The original decision said "one
> key holding the whole object"; that shape cannot express which fields the
> user touched, so the first edit would freeze every untouched field at a
> compiled constant and the operator's configuration would stop applying.

`ui/src/store/storePersistence.ts` has two established patterns: a singleton
key registered in `persistenceRegistry.ts` (like `reasoningEffort`), or a field
inside the shared `ima2.generationDefaults` blob (like `sizePreset`).

**Decision.** One new registry key `ima2.naiOptions` holding a **sparse**
`Partial<NaiOptions>` — only the fields the user explicitly changed. The
displayed value is derived at read time:
`COMPILED_FALLBACK → server defaults → overrides`. An untouched field is
absent from persistence AND from the request, so the server keeps resolving it
from `config.naiProvider` for the life of the install.

Full mechanics: `020`.

Nine fields inside `generationDefaults` would mean nine validators inside
`loadGenerationDefaults` for settings that only one of ten providers reads,
and a NAI schema change would rewrite the blob every other lane shares.

The negative prompt is the exception below.

## D4 — Negative prompt is composer state, not settings state

The negative prompt is **prompt content**, not a setting. It belongs with
`prompt` in the composer:

- it is per-generation, not a persisted preference;
- `storeGenImpl` already snapshots `composerPrompt` for provenance, and the
  negative prompt must ride along or the history entry is unreproducible;
- putting it in the right panel means typing prose in a settings drawer.

**Decision.** `negativePrompt: string` lives in the composer slice next to
`prompt`, is persisted with the composer draft (same mechanism as `prompt`),
and is emitted in the payload only when `provider === "nai"` and the string is
non-empty.

**Gating note.** The field is rendered only for `provider === "nai"`. When the
user switches away, the value is **kept in state but not sent** — switching
provider back must not silently lose typed text. Nothing else reads it.
