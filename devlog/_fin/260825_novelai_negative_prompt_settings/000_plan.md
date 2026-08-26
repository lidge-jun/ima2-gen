# 000 — NovelAI negative prompt + provider-native settings panel

Unit: `devlog/_plan/260825_novelai_negative_prompt_settings/`
Created: 2026-08-25
Work class: C4 (server option contract + client state + new UI surface + i18n across 4 locales)
Loop: HOTL goalplan `make-the-novelai-nai-lane-in-ima2-gen-a-first-cl`
Branch: `dev` @ `7e504f32`

## Objective

The `nai` lane exists and generates images, but the web UI treats it as if it
were a GPT lane. Two concrete defects:

1. **No negative prompt input.** NovelAI's undesired-content prompt is the
   single most load-bearing control in anime-illustration generation, and the
   UI offers no way to type one. The server already accepts it.
2. **Wrong settings panel.** The right-hand panel renders quality /
   format / moderation — none of which the NAI adapter reads — and hides every
   control that actually changes a NovelAI result.

This unit closes both, using CLIsu's NovelAI surface as the parity reference.

## The core finding (wp0 research)

`/api/generate` already forwards seven NAI-specific body fields to the adapter
(`lib/generatePipeline.ts:478-484`): `straightAlpha`, `negativePrompt`,
`steps`, `scale`, `sampler`, `noiseSchedule`, `seed`.

**No client code sends any of them.** `GenerateRequest`
(`ui/src/types.ts:229-249`) has no NAI property, and neither payload builder
in `ui/src/store/storeGenImpl.ts:103-126` / `:307-330` emits one. The wiring
exists from the HTTP boundary inward and stops dead at the browser.

So this is not "add a provider feature" — it is "connect a lane that was built
half-way". That changes the shape of the work: wp1 is a small server
completion, and the bulk lands in wp2/wp3 on the client.

## Constraints

- **Additive and lane-scoped.** No behavior change to oauth / api / grok /
  grok-api / agy / gemini-api / atlascloud / minimax / comfy. Every new payload
  field is emitted only when `provider === "nai"`.
- **Four models only.** The registry declares V5 Full/Curated and V4.5
  Full/Curated (`lib/providers/registry.ts:199-210`). CLIsu additionally offers
  V4, V3, furry-3, and V2. Those families are **out of scope**, which removes
  SMEA / DYN / decrisp / legacy-uc from the control surface entirely — every
  one of those is gated to V4-and-older in CLIsu
  (`src/lib/Setting/Pages/OtherBotSettings.svelte:574-597`).
- **No new runtime dependency.**
- **`.ts` only in git.** `/lib/**/*.js` is gitignored build output.
- **No live NAI call.** Every gate passes with no token present.
- Branch `dev`; local commits only; **no push, no tag, no force-push**.

## Dependency-ordered work-phase map (PHASE-SPLIT-01)

| WP | Doc | Deliverable | Depends on |
|----|-----|-------------|------------|
| wp0 | this + 001-003 | Parity inventory, gap table, diff-level roadmap | — |
| wp1 | `010` | `lib/naiOptions.ts` normalizer + adapter completion + the three request-driven pipelines forwarding it + `defaults.nai` | wp0 |
| wp2 | `020` | Client state: sparse `naiOptionOverrides`, server-default resolution, payload emission | wp1 (payload must have a server that reads it) |
| wp3 | `030` | UI: negative-prompt field + `NaiControlsPanel` | wp2 (controls need setters to call) |
| wp4 | `040` | i18n × 4 locales + contract test updates | wp3 (keys are known only once the controls exist) |
| wp5 | `050` | Gate sweep, render grounding, adversarial audit | wp1-wp4 |

Server first because the client cannot be verified against a contract that does
not exist yet: wp2's acceptance is "the payload reaches the adapter", which is
only checkable once wp1 defines what the adapter accepts.

## Accept criteria (goalplan c1-c10)

| id | Criterion | Verifier |
|----|-----------|----------|
| c1 | Gap table with measured citations | this folder, 001-003 |
| c2 | Every implementation phase has a diff-level decade doc | file listing |
| c3 | Server reflects every UI-sent parameter in the NovelAI body | `tests/nai-*-contract` |
| c4 | Options persist across reload and ride in the payload | store contract test |
| c5 | Negative prompt visible for nai and reaches the server | screenshot + test |
| c6 | Right panel is nai-specific; 4 locales carry the strings | screenshot + i18n contract |
| c7 | No behavior change on other lanes | existing provider contracts |
| c8 | Gate sweep green | each command exit 0 |
| c9 | `npm test` no new failures vs baseline | counts |
| c10 | Read-only reviewer audit passes | verdict text |

## Verifier reality check (PLAN-VERIFIER-REAL-01)

Measured on `dev` @ `7e504f32` **before** this plan was written:

| Command | Exit | Observes this unit's target? |
|---------|------|------------------------------|
| `npm run typecheck` | 0 | YES — includes `lib/**/*.ts`, `routes/**/*.ts` |
| `npm test` | **0** — 2580 tests, 2578 pass, 0 fail, 2 skip | YES |
| `npm run typecheck:tests` | not yet measured | YES |
| `npm run test:inventory` | not yet measured | YES — new test files make it stale unless regenerated |
| `node scripts/generate-provider-types.mjs --check` | not yet measured | Only if the registry changes — this unit does not change it |
| `cd ui && npm run build` | not yet measured | YES |

### Baseline carve-out

Unlike the original NAI lane unit (which recorded 2 pre-existing failures),
**this baseline is clean**: `ℹ pass 2578 / ℹ fail 0 / ℹ skipped 2`. Criterion
c9 is therefore the strict form — `npm test` must still report `fail 0`. There
is no carve-out to hide behind.

## Bypass disclosure (PLAN-BYPASS-NAMED-01)

- Tier: E2 (repo test gates).
- Executing surface: `npm test` / `tsc` locally and in CI.
- Known bypass: `--no-verify`, or skipping gates before commit.
- Residual risk: an i18n key present in one locale only, caught by
  `i18n-dictionary-contract` if the gates are actually run.
- Final enforcement layer: **none** — no server-side hook blocks `dev`.

## Out of scope

NAI login/token entry redesign; vibe transfer; character reference; img2img /
inpaint; Anlas cost estimation; V4 / V3 / furry-3 / V2 model families; the
`Max` upscale tier; any git push or release.
