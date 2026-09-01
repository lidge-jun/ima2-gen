# 260902 Studio surfaces — research and roadmap (000)

## Loop specification

- Loop archetype: spec-satisfaction, multi-cycle HOTL goal loop (6 work-phases).
- Trigger: user request (2026-09-02) — audit the packaged skills and UI, give NovelAI
  a two-window (positive/negative) prompt composer, make the right-sidebar Prompt
  Builder backend configurable instead of a silent GPT fallback, surface the shipped
  vectorize capability in Canvas mode as well as the Assets surfaces, upgrade
  README/site/skill docs, then release through preview and main.
- Goal: each of the four product surfaces ships behind fresh verification, then
  one release SHA lands on origin/dev, origin/preview, origin/main, a tag, and npm.
- Non-goals: provider OAuth internals, video pipeline, ComfyUI bridge, sprite
  atlas, dependency upgrades beyond need, any force-push, redesigning the shipped
  vectorize core.
- Verifier: `npm run typecheck`, `npm run typecheck:tests`, `npm test`,
  `npm run test:inventory`, `cd ui && npm run build`, browser screenshots against a
  live `node bin/ima2.js serve`, curl route probes, exact-head CI, npm dist-tags.
- Stop condition: goalplan criteria c-1..c-7 met with captured evidence.
- Memory artifact: this unit (`devlog/_plan/260902_studio_surfaces/`) plus
  `.codexclaw/goalplans/ship-four-coordinated-ima2-gen-studio-improvemen/`.
- Expected terminal outcomes: DONE; BLOCKED only on CI/npm outage or missing
  provider credentials for live builder verification.
- Escalation: upward — main reclaims a slice after two distinct subagents fail its
  packet; downward — pushing a slice to a worker is a P-phase amendment.
- HOTL resource bounds: repo writes inside the FILE SCOPE of the goal objective;
  network to npm/GitHub/provider APIs already configured on this host; subagents
  gpt-5.6-sol high, unlimited by user; no wall-clock bound stated.
- Authority: user pre-approved push to origin/dev, preview/main promotion, and
  release in the 2026-09-02 request.

## Baseline (verified 2026-09-02)

Locale correction: `ui/src/i18n/` holds four locales (en, ko, zh-Hans, zh-Hant),
not five as the goal objective states; every i18n criterion in this unit reads
"all four locales".

| Item | Evidence |
|---|---|
| Release line | v3.12.3 = `9cd60ac1`; origin/dev head `93c2cdc0` (docs-only commit on top); npm latest 3.12.3 |
| Worktree | clean apart from untracked `scripts/recording/` (user-owned, left alone) |
| Live server | `node server.js` pid 84599 on 127.0.0.1:3333 reports version 3.10.0 (stale process; verification uses a fresh serve on a spare port) |
| Open issues | #193 (NAI V5 Opus battery in quota lane), #150 (Provider Adapter RFC) — both out of scope here |

## Audit findings

### 1. Vectorize (shipped in 260831_vectorize_assets)

- Core: `lib/vectorizeImage.ts` wraps `@neplex/vectorizer`.
- Route: `routes/assetDerived.ts` accepts `kind=vector-svg`.
- CLI: `ima2 vectorize` (commit `74b8dcef`).
- GUI: `ui/src/components/assetgen/VectorizePanel.tsx`, mounted from
  `ui/src/components/assetgen/AssetGenWorkspace.tsx` and
  `ui/src/components/assets/AssetsWorkspace.tsx:151` via the store's
  `vectorizeTarget`.
- Gap: Canvas mode has no trace entry. `ui/src/components/canvas-mode/CanvasExportMenu.tsx:5`
  lists `png | svg | pptx` and the `svg` branch in
  `ui/src/lib/canvas/exportRenderer.ts:40` calls `buildCanvasSvg`, which wraps a
  raster `<image>` and never traces. The label "SVG" is therefore misleading next to
  a real vector export. Decade doc: `030_canvas_vectorize.md`.

### 2. NovelAI prompt composer

- `ui/src/components/NegativePromptField.tsx` is a one-row textarea that expands
  on focus, gated on `provider !== "nai" -> null`. Mounted at
  `ui/src/components/PromptComposer.tsx:413` and
  `ui/src/components/home/HomePromptComposer.tsx:114`.
  `ui/src/components/MobileComposeSheet.tsx` does not reference it.
- Store: `negativePrompt` in `ui/src/store/storeSettingsImpl.ts`, persisted via
  `ui/src/store/storePersistence.ts`; payload merge in `ui/src/lib/naiPayload.ts:46`.
- Gap: the user wants two prompt windows of comparable weight when NAI is the
  provider. Decade doc: `010_nai_dual_prompt.md`.

### 3. Right-sidebar "falls back to GPT"

- The right sidebar (`ui/src/components/RightPanel.tsx`) hosts four tabs:
  Prompt Builder, Log, Library, Settings. The Builder tab
  (`ui/src/components/prompt-builder/PromptBuilderPanel.tsx`) posts to
  `POST /api/prompt-builder/chat` (`routes/promptBuilder.ts`).
- `lib/promptBuilder/client.ts:28-40` waits for the OAuth proxy and always calls
  `ctx.oauthUrl` — there is no backend choice.
  `ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx:5` hard codes six
  GPT models. This is the "GPT fallback" the user sees: every builder
  request goes to the GPT OAuth lane regardless of the selected image provider.
- Reusable transports already in the tree: `lib/agentPlannerModel.ts`
  (`requestGrokPlan` via `getGrokEndpoint`, `requestResponsesPlan` for
  `api`/`oauth`), `lib/cardNewsPlannerClient.ts`, `lib/agentQuestionResponder.ts`.
- Config pattern to follow: `routes/capabilities.ts:30-45` (GET/PUT planner model),
  `config.ts` `pickStr`/`pickBool`, `lib/configKeys.ts` env mapping.
- Decade doc: `020_builder_backend.md`.

### 4. Packaged skills, README, site

- `skills/ima2/SKILL.md` gained a vectorize section in `74b8dcef`; the
  `ima2-front` and `ima2-uiux` skills, README "What It Does"/"Workflows"/
  "CLI Commands", and the Astro site under `site/src/pages/docs` and
  `site/src/pages/ko/docs` need an audit for vectorize, the NAI dual prompt, and
  the builder backend setting. Decade doc: `040_docs_skill_site.md`.

## Design Read (cxc-dev-uiux-design)

```yaml
---
name: ima2-gen studio surfaces
colors:
  primary: existing --accent token (ui/src/styles)
  background: existing surface tokens
typography:
  heading: existing composer section-title
  body: existing
iconography:
  system: existing inline SVG set
  domain: none added
---
```

Reading this as: tool UI for a repeated-work image studio; audience is the
maintainer and power users who switch providers many times a session. Vibe:
quiet, dense, keyboard-first. Do: reuse composer tokens, keep every new control
inside an existing section. Don't: decorative motion, new accent hues, modal
wizards for what is a settings row.

Dial setting: DESIGN_VARIANCE 3, MOTION_INTENSITY 1, density D4. Reasoning: all
four surfaces are dashboard-class tool UI; complexity goes into functional depth,
not visual variance. UX-CONCEPT-GEN-01 skip: utility tool surfaces inside a
governing design system, so no concept-image round.

Lazy-user gate (UX-LAZY-01):
- NAI dual pane: do-nothing fails (users miss the collapsed field); absorb — the
  second pane appears only when the provider is NAI, no toggle.
- Builder backend: default stays `auto` (first ready lane) so nobody must choose;
  the choice is demoted to Settings; the badge makes the fallback visible.
- Canvas trace: one extra menu entry in the existing export menu; parameters live
  in the already-shipped modal.

## Dependency-ordered work-phase map (PHASE-SPLIT-01)

| WP | Decade doc | Depends on | Independently verifiable by |
|---|---|---|---|
| wp1 | 000 + 010..050 | — | `node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces`, audit verdict |
| wp2 | 010_nai_dual_prompt.md | wp1 | contract tests + screenshots (nai/non-nai/mobile) |
| wp3 | 020_builder_backend.md | wp2 (shared composer/settings files land first) | router tests, config route probe, badge screenshot, activation of fallback |
| wp4 | 030_canvas_vectorize.md | wp3 | export-menu contract test, live trace via route, SVG rendered back |
| wp5 | 040_docs_skill_site.md | wp4 (docs describe landed behavior) | docs checks, `ima2 skill` output, site build |
| wp6 | 050_release_train.md | wp5 | CI + release.yml + npm evidence |

wp2→wp3 ordering: both touch `ui/src/i18n/*.json` and the settings surface;
serializing them keeps each cycle's i18n diff reviewable and avoids merge churn.

## SoT sync target (SOT-SYNC-01)

`structure/` architecture docs (00-07) — each implementation cycle's C patches the
matching section; `structure/07-devlog-map.md` gets this unit's row.

## Verifier reality check (PLAN-VERIFIER-REAL-01)

Run 2026-09-02 on the baseline tree, before any change:

| Command | Exit | Reads this unit's targets |
|---|---|---|
| `node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces` | see evidence below | yes — directory argument |
| `npm run typecheck` | recorded per cycle | yes — `tsconfig` includes `lib/**`, `routes/**`, `config.ts` |
| `npm test` | recorded per cycle | yes — `tests/` registry (see `npm run test:inventory`) |
| `cd ui && npm run build` | recorded per cycle | yes — Vite compiles `ui/src/**` |
