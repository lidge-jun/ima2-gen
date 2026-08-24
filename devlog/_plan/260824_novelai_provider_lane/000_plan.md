# 000 — NovelAI (NAI) provider lane: objective, constraints, work-phase map

Unit: `devlog/_plan/260824_novelai_provider_lane/`
Created: 2026-08-24
Work class: C4 (new provider lane crossing registry, adapter, routing, UI, tests)
Loop: HOTL goalplan `deliver-a-complete-production-ready-novelai-nai`

## Objective

Add a first-class NovelAI image provider (`nai`) to ima2-gen, wired end-to-end
through every layer an existing provider occupies, and land it on `origin/dev`.
NAI Diffusion V5 (Full + Curated) and V4.5 must be selectable in the web UI and
generate real images once the user supplies an API token. Token entry and login
are explicitly the user's job after this unit lands.

## Why NAI belongs here

ima2-gen already covers general-purpose (GPT/Gemini), photoreal/mixed (Grok),
and local high-end (ComfyUI/MiniMax H3) generation. It has no dedicated
2D/anime-illustration lane. NAI V5 is the strongest current model in that
niche, and two of its V5 features line up with capabilities ima2-gen already
has plumbing for:

- **Native alpha transparency** (`straight_alpha` + prompt tags) feeds the
  existing sprite/atlas and asset-extraction pipeline.
- **Free-canvas character positioning** (`characterPrompts[].center`) maps onto
  node mode and multi-character composition.

## Constraints

- **Additive only.** No behavior change to oauth/api/grok/grok-api/agy/
  gemini-api/atlascloud/minimax/comfy lanes beyond widening shared unions.
- **No credentialed live call.** Every acceptance gate must pass with no NAI
  token present. The lane is proven by contract tests, synthetic fixtures, and
  a keyless `/api/keys` status row — not by a real generation.
- **No new runtime dependency.** The ZIP response is decoded with `node:zlib`
  plus a local-file-header parser (see `002`). `fflate`/`jszip`/`adm-zip` are
  all absent from server `dependencies` and stay absent.
- **Image only.** NAI has no video product in scope; the lane declares no video
  models.
- **`.ts` only in git.** `/lib/**/*.js` is gitignored and produced by
  `npm run build:server`. Never commit a compiled sibling.
- Branch `dev`, no force-push, no tags.

## Dependency-ordered work-phase map (PHASE-SPLIT-01)

Each phase consumes the verified output of the previous one. This is build
order, not effort order.

| WP | Doc | Deliverable | Depends on |
|----|-----|-------------|------------|
| wp0 | this + 001-003 | Research + diff-level roadmap | — |
| wp1 | `010` | Registry manifest, type unions, config/runtimeContext/keys plumbing | wp0 |
| wp2 | `020` | `naiImageAdapter` (HTTP + ZIP→PNG + `NAI_*` errors) + adapters/nai | wp1 (needs `ctx.naiApiKey`, registry entry) |
| wp3 | `030` | Server routing: model normalization, provider options, pipeline lanes | wp2 (needs a callable adapter) |
| wp4 | `040` | UI + doctor + i18n | wp3 (needs `/api/models` to serve the lane) |
| wp5 | `050` | Full gate sweep, SoT sync, push to origin/dev | wp1-wp4 |

Foundations first because `CoreProviderId` is a derived union: until
`registry.ts` contains `nai`, no other file can reference the lane without a
type error. UI last because `ui/src/generated/providers.ts` is generated from
the registry, so it cannot be written before the registry is correct.

## Accept criteria (goalplan c1-c10)

| id | Criterion | Verifier |
|----|-----------|----------|
| c1 | 000-range research docs exist and cite live sources | file listing |
| c2 | Every implementation phase has a diff-level decade doc | file listing |
| c3 | `nai` registered and recognized by derive + key vocabulary | `node --test` registry/parity/key tests |
| c4 | Adapter decodes ZIP→PNG | `nai-zip-decode` test with synthetic archive |
| c5 | `GET /api/models` includes the nai lane | live curl |
| c6 | Provider selectable in built UI | rendered screenshot |
| c7 | Upstream errors map to `NAI_*` | error-mapping test driving 401/402/429/500 |
| c8 | Full gate sweep green | typecheck, typecheck:tests, test, test:inventory |
| c9 | UI production build green | `cd ui && npm run build` |
| c10 | Landed on origin/dev | push output + SHA parity |

## Verifier reality check (PLAN-VERIFIER-REAL-01)

Commands were run before being written here:

| Command | Exit | Observes this unit's target? |
|---------|------|------------------------------|
| `npm run typecheck` | 0 (pre-change baseline) | YES — `tsconfig.json` includes `lib/**/*.ts`, `routes/**/*.ts` |
| `npm run typecheck:tests` | 0 | YES — `tsconfig.tests.json` includes `tests/**/*.ts` |
| `npm test` | 0 | YES — `scripts/run-tests.mjs` discovers `tests/*.test.ts` |
| `npm run test:inventory` | 0 | YES — registry check over `tests/` |
| `node scripts/generate-provider-types.mjs --check` | 0 | YES — diffs `ui/src/generated/providers.ts` against `lib/providers/registry.ts` |
| `cd ui && npm run build` | 0 | YES — Vite compiles `ui/src/**` including the generated provider module |

`node scripts/generate-provider-types.mjs --check` is the load-bearing one: it
fails the build if the registry and the UI's generated provider list disagree,
so it mechanically protects the wp1↔wp4 seam.

## Bypass disclosure (PLAN-BYPASS-NAMED-01)

This unit adds no new enforcement layer. It consumes existing ones.

- Tier: E2 (repo test gates).
- Executing surface: `npm test` / `tsc` locally and in CI.
- Known bypass: `--no-verify` on commit, or pushing without running gates.
- Residual risk: a stale `ui/src/generated/providers.ts` reaching `dev` if the
  author skips the gates entirely.
- Wording downgrade: none needed; these are early warnings, not unbypassable
  enforcement. Final enforcement layer: **none** (no server-side hook blocks a
  push to `dev`).

## Out of scope

Token entry/login; NAI video (does not exist); img2img/inpaint/vibe transfer
(V5 launch excludes vibe; img2img is a follow-on unit); Anlas cost estimation
UI; the `Max` enhance/upscale tier.
