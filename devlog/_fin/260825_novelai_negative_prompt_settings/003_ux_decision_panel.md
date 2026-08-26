# 003 — UX decision: what the NAI settings panel shows

Pairs with the parity table in 001. Decides the control surface before wp3
implements it.

## The problem with the current panel

For `provider === "nai"` the right panel currently renders (`ui/src/components/GenerationControlsPanel.tsx:329-375`):

| Control | Does the NAI adapter read it? |
|---|---|
| Quality (low/medium/high) | **No** |
| Format (PNG/JPEG/WebP) | **No** — the lane always returns PNG (`lib/naiImageAdapter.ts:226-244`) |
| Moderation (auto/low) | **No** |
| GPT compatibility copy | **No** — wrong provider entirely (`:159-165`) |
| SizePicker | Partially — size is used, but the presets are GPT-shaped |
| CountPicker | **No** — `n_samples` is pinned to 1 (`:125-126`) |
| CostEstimate | **No** — priced for OpenAI, not Anlas |

Six of seven controls are inert. A user changing "quality: high" gets exactly
the same image, which is worse than showing nothing.

## The panel this unit builds

Rendered only when `provider === "nai"` and no video model is selected.

### Group 1 — Model
Four options from the generated catalog. Existing labels
(`ui/src/lib/imageModels.ts`) already cover them; no new label work.

### Group 2 — Size
NovelAI resolutions are fixed tiers, not free-form. Presets:

| Label | Value | Note |
|---|---|---|
| Portrait | `832x1216` | lane default |
| Landscape | `1216x832` | |
| Square | `1024x1024` | |

**No Custom option** (amended by `004` §B7b). `getCustomSizeConfirmation`
already excludes `nai` from custom-size normalization
(`ui/src/store/storeHelpers.ts:341-348`) with a comment stating NAI sizes are
fixed presets — offering a free-form pair would contradict a guard the codebase
already relies on, and NovelAI prices per resolution tier, so an arbitrary size
is a billing surprise as well as a correctness one.

Wide/large tiers are omitted: they cost more Anlas and this unit ships no cost
surface to warn about it.

### Group 3 — Sampling
| Control | Type | Values | Default |
|---|---|---|---|
| Sampler | select | `k_euler_ancestral`, `k_dpmpp_2s_ancestral`, `k_dpmpp_2m_sde`, `k_euler`, `k_dpmpp_2m`, `k_dpmpp_sde` | config |
| Noise schedule | select | `native`, `karras`, `exponential`, `polyexponential` | config |
| Steps | slider 1-50 | | config (23) |
| Guidance (scale) | slider 1-10, step 0.1 | | config (5) |
| CFG rescale | slider 0-1, step 0.01 | | 0 |

The sampler list is the modern six (001 §D) — `ddim_v3` is excluded because no
registered model accepts it.

### Group 4 — Presets
| Control | Values | Default |
|---|---|---|
| Undesired-content preset | Heavy / Light / Furry focus / Human focus / None | Heavy |
| Quality preset | Standard / Light / None | Standard |

These are V5's replacement for the numeric `ucPreset` and they compose with the
user's negative prompt rather than replacing it.

### Group 5 — Output
| Control | Type | Note |
|---|---|---|
| Variety+ | toggle | sets `skip_cfg_above_sigma`; the coefficient is fixed for V4.5/V5 (001 §E) |
| Transparent background | toggle | `straight_alpha`; V5 only — hidden for V4.5 models |
| Seed | number + dice button | empty = server-random |

### Hidden for NAI
Quality, Format, Moderation + its help text, CountPicker, CostEstimate, and the
GPT compatibility `<details>`. Multimode also hides: multimode batches through
a pipeline that (until wp1) forwards no NAI options, and `n_samples` is 1
regardless.

## Model gating inside the panel

Two gates survive the four-model registry (amended by `004` §B7a):

| Control | Shown for | Reason |
|---|---|---|
| Transparent background | V5 Full / V5 Curated | `straight_alpha` is a V5 feature (`devlog/_fin/260825_novelai_provider_lane/001_nai_api_surface.md`) |
| Quality preset | V5 Full / V5 Curated | `NAI_QUALITY_PRESET_IDS` is documented V5-only (`lib/naiImageAdapter.ts:36-37`) |

The panel resets both when a V4.5 model is selected, but that is a
**convenience, not the guarantee** (corrected by `005` §R2-B2 — the original
"can never disagree" claim was false). Model and options hydrate from two
independent persisted keys, and `storeSettingsImpl.ts:485-489` can set a NAI
model without passing through this panel, so persisted state *can* disagree.

What makes it safe is the boundary: `naiPayloadFields` strips both keys for a
non-V5 model, and `generateViaNai` gates them again server-side. Three layers,
because the state has three arrival paths.

Everything else applies to all four. This is still the payoff of dropping
V4/V3/V2: CLIsu needs six model-gated conditionals, this panel needs two.

## Negative prompt placement

Per 002 §D4 the field lives in the composer, not this panel.

- **Classic composer:** directly under the main prompt textarea, before the
  toolbar (`ui/src/components/PromptComposer.tsx:341-414`). Collapsed to a
  single row by default, expanding on focus — it must be visibly secondary to
  the positive prompt.
- **Home composer:** between the main textarea and the footer
  (`ui/src/components/home/HomePromptComposer.tsx:101-136`).

Label: "Undesired content" (NovelAI's own term), placeholder listing common
tags. Not "negative prompt" — the product word beats the API word.
