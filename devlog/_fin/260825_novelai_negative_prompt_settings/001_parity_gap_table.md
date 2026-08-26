# 001 — CLIsu ↔ ima2-gen NovelAI parameter gap table

Both sides were read in full during wp0. CLIsu citations are relative to
`/Users/jun/developer/new/700_projects/clisu`; ima2-gen citations are relative
to the repo root.

## A. Request-body parity

Restricted to the four models ima2-gen actually registers (V5 Full/Curated,
V4.5 Full/Curated). Parameters gated to V4-and-older in CLIsu are listed in §D
and deliberately excluded.

| NovelAI parameter | CLIsu source | ima2-gen source | Gap |
|---|---|---|---|
| `input` | normalized `genPrompt` (`src/ts/process/stableDiff.ts:329-342`) | `prompt` arg (`lib/naiImageAdapter.ts:185`) | CLIsu rewrites `(`/`)` → `{`/`}`; ima2 does not. **Deliberate divergence** — see §C |
| `model` | `db.NAIImgModel` (`:343`) | option → config → default (`lib/naiImageAdapter.ts:112-114`) | none |
| `action` | `"generate"` / `"img2img"` (`:558-561`) | `"generate"` (`:185`) | img2img out of scope |
| `params_version` | `3` (`:344`) | `3` (`lib/naiImageAdapter.ts:119`) | none |
| `width` / `height` | `NAIImgConfig.width/height` (`:351-352`) | parsed from `options.size` (`lib/naiImageAdapter.ts:78-84`) | none — different plumbing, same result |
| `sampler` | `NAIImgConfig.sampler` (`:353`) | option → config (`:123`) | **client cannot set it** |
| `noise_schedule` | `NAIImgConfig.noise_schedule` (`:359`) | option → config (`:137`) | **client cannot set it** |
| `steps` | `NAIImgConfig.steps` (`:354`) | option → config (`:124`) | **client cannot set it** |
| `scale` | `NAIImgConfig.scale` (`:355`) | option → config (`:122`) | **client cannot set it** |
| `cfg_rescale` | `NAIImgConfig.cfg_rescale` (`:347`) | **hardcoded `0`** (`lib/naiImageAdapter.ts:136`) | **server gap** — no option at all |
| `negative_prompt` | `neg` arg (`:356`) | `options.negativePrompt ?? ""` (`:141`) | **client cannot set it** |
| `v4_negative_prompt.caption.base_caption` | `neg` (`:378-381`) | same normalized value (`:149-150`) | same as above |
| `seed` | `random(0, 2**32-1)` every call (`:391`) | only when finite number given (`:154-156`) | **client cannot set it**; also ima2 omits seed entirely when unset, so NovelAI picks — behaviorally equivalent |
| `extra_noise_seed` | independent random (`:393`) | **absent** | low value for txt2img; §C |
| `skip_cfg_above_sigma` | `null` or Variety+ computed (`:396`, `:410-419`) | **absent** | **server gap** — Variety+ unavailable |
| `prefer_brownian` | always `true` (`:394`) | only for `k_euler_ancestral` (`:157-162`) | ima2 is the stricter/more correct shape |
| `deliberate_euler_ancestral_bug` | always `false` (`:395`) | only for `k_euler_ancestral` (`:157-161`) | same |
| `ucPreset` (numeric) | hardcoded `3` (`:361`) | — | CLIsu uses the legacy numeric field |
| `ucPresetId` (string) | — | `options.ucPresetId ?? "heavy"` (`:127`) | **V5 form; adapter accepts it but no pipeline forwards it** |
| `qualityPresetId` | — | `options.qualityPresetId ?? "standard"` (`:128`) | **same: adapter-only** |
| `straight_alpha` | **absent** | `options.straightAlpha === true` (`:142`) | ima2-only V5 feature; **client cannot set it** |
| `legacy_uc` | `NAIImgConfig.legacy_uc` (`:369`) | hardcoded `false` (`:134`) | V4-only control; out of scope (§D) |
| `dynamic_thresholding` | `decrisp` for V3/furry/V2 else `false` (`:349`) | hardcoded `false` (`:130`) | V3-only; out of scope |
| `sm` / `sm_dyn` | V3/furry/V2 only (`:357-358`) | absent | out of scope |
| `n_samples` | `1` (`:350`) | `1` (`:126`) | none |
| `characterPrompts` | — | `[]` (`:143`) | free-canvas positioning is a later unit |
| `director_reference_*` | character-reference branch (`:397-401`) | absent | out of scope |
| `reference_image_multiple` / `reference_strength_multiple` | vibe branch (`:385-386`) | absent | out of scope |
| `inpaintImg2ImgStrength` | absent | `1` (`:140`) | harmless constant |

## B. Gap classification

Three distinct kinds of gap, and they need different fixes:

**G1 — wired server, silent client (7 fields).**
`straightAlpha`, `negativePrompt`, `steps`, `scale`, `sampler`,
`noiseSchedule`, `seed` are all forwarded by
`lib/generatePipeline.ts:478-484` and never sent by anyone
(`ui/src/types.ts:229-249`, `ui/src/store/storeGenImpl.ts:307-330`). Pure
client work.

**G2 — adapter-only options (2 fields).**
`ucPresetId` / `qualityPresetId` are read by the adapter
(`lib/naiImageAdapter.ts:127-128`) but no pipeline forwards them
(`lib/generatePipeline.ts:473-485`). One-line-per-field server fix.

**G3 — absent from the adapter (2 fields).**
`cfg_rescale` is hardcoded `0` (`:136`) and `skip_cfg_above_sigma` does not
exist. Both need new `NaiGenerateOptions` members.

**G4 — pipeline asymmetry.**
The multimode (`lib/multimodePipeline.ts:416-424`) and node
(`lib/nodeGeneration.ts:338-344`) NAI branches forward **none** of the seven
fields that `/api/generate` forwards. Same lane, three different contracts.
This is the drift that a shared normalizer removes.

## C. Deliberate divergences from CLIsu

Not everything CLIsu does should be copied.

| CLIsu behavior | Decision | Why |
|---|---|---|
| `(` → `{` prompt rewriting (`:329-336`) | **do not port** | ima2-gen's prompt pipeline (presets, elements, composer snapshots) owns prompt text; a silent character substitution inside one lane would corrupt round-tripped prompts and break `composerPrompt` provenance |
| `seed` randomized on every request | **do not port** | omitting `seed` lets NovelAI randomize server-side, which is the same result with less state. A UI seed field is added, but "unset" stays unset |
| `extra_noise_seed` | **skip** | only meaningful for img2img/inpaint noise, which is out of scope |
| `ucPreset: 3` numeric | **skip** | V5 replaced it with `ucPresetId` strings, which the adapter already uses. Sending both is contradictory |
| `prefer_brownian` unconditionally | **keep ima2's gating** | the sampler-gated form matches the reference client; unconditional is CLIsu being loose |
| `NAIImgUrl` / API key in the generation settings panel | **skip** | ima2-gen owns credentials in Account Settings; duplicating a token field into the generation panel is a security-surface regression |

## D. Out-of-scope by model registry

CLIsu offers nine models; ima2-gen registers four. Every control below is gated
to a family ima2-gen does not serve, so porting it would render a control that
can never activate:

| Control | CLIsu gate | Citation |
|---|---|---|
| Use SMEA (`sm`) | V3 / furry-3 / V2, non-DDIM | `OtherBotSettings.svelte:574-577` |
| Use DYN (`sm_dyn`) | V3 only, non-DDIM | `:579-581` |
| Decrisp (`dynamic_thresholding`) | V3 / furry-3 / V2 | `:590-592` |
| Use legacy uc | V4 full / V4 curated-preview | `:594-597` |
| `ddim_v3` sampler | V3 / furry-3 / V2 legacy list | `:348-357` |

**Consequence for the sampler list:** ima2-gen's `NAI_SAMPLERS`
(`lib/naiImageAdapter.ts:20-29`) includes `ddim_v3`, which no registered model
accepts. The UI list must be the modern six from CLIsu
(`:334-347`), not the raw constant.

## E. Variety+ coefficient (the one formula worth porting)

CLIsu, `src/ts/process/stableDiff.ts:410-419`:

- V4 full / V4 curated-preview / V3 / furry-3 → `sqrt(w*h) * 0.01889`
- V4.5 full/curated / V5 full/curated → `sqrt(w*h) * 0.05766`

Only the second row is reachable for ima2-gen's four models, so the
implementation is a single coefficient: `Math.sqrt(width * height) * 0.05766`,
applied only when `varietyPlus === true`, otherwise the field is `null`.

## F. Defaults comparison

| Setting | CLIsu default | ima2-gen default | Adopted |
|---|---|---|---|
| model | `nai-diffusion-4-5-full` (`defaults.ts:231-242`) | `nai-diffusion-5-full` (`config.ts:370`) | ima2's |
| width × height | 1024 × 1024 (`defaults.ts:306-309`) | 832 × 1216 (`lib/naiImageAdapter.ts:39-40`) | ima2's — NovelAI's native portrait |
| sampler | `k_euler_ancestral` (`:310`) | `k_euler_ancestral` (`config.ts:379`) | same |
| noise schedule | `karras` (`:311`) | `karras` (`config.ts:380`) | same |
| steps | 28 (`:312`) | 23 (`config.ts:377`) | ima2's |
| scale | 5 (`:313`) | 5 (`config.ts:378`) | same |
| cfg_rescale | 0 (`:314`) | hardcoded 0 | 0 |
| variety_plus | `false` (`:341`) | n/a | `false` |

Config-driven ima2 defaults win: they are already the documented environment
contract (`IMA2_NAI_DEFAULT_STEPS` etc., `config.ts:369-380`), and overriding
them from a hardcoded client constant would make the env vars a lie.

