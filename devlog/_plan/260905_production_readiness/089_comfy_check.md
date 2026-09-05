# WP08c C — exact-head verification in progress

Freeze: `077890351a426b6f1a22796a57daab6865159e8f`.
PR #210 targets WP08 branch `codex/prod-wp08-composer` at `22dfa811`.
No merge or release yet. CI `33992397993`, CodeQL `33992399150` were dispatched
against this exact SHA; their first observed state was queued without a runner.

## Local evidence

- UI/E2E typechecks and Vite build: exit 0; existing size/dynamic-import warnings.
- Root typecheck and test typecheck: exit 0.
- `cxc receipt test` with the eleven actual affected test paths: 88 passed,
  zero failures. Receipt lives under this session's evidence directory.
- The earlier 56-test run passed its seven existing targets, but four requested
  paths had incorrect suffixes. Node ignored those nonexistent arguments. Main
  resolved them with `rg --files tests` and reran all eleven exact files: NAI
  registration `.ts`, current-image-actions and mobile-composer `-contract.test.js`,
  J6 isolation `.test.mjs`. Only the 88-test run certifies all eleven targets.
- Inventory regenerated/check passed; structure line-count check had no drift.
- Blob budget against parent: 50 blobs, largest 116102 bytes, exit 0.
- Source mutation evidence is `wp08c/source-mutations.json`: obsolete response,
  stale ready, offline row and stale context each failed when broken and passed
  after byte-exact restoration. Those checks are not native-screen proof.

C reviewer Boole `01a0736b-6d3e-7b11-8545-267afda91a62` returned VERDICT: PASS,
no verified High/Critical blockers in the production consumers, locales and CSS.
The reviewer performed source inspection only, explicitly not visual/runtime proof.

## Remaining gates

Hosted current-head suites and teardown receipts; D1–D14 native artifacts;
manual screenshot inspection plus two independent visual rubric passes;
fresh C production-consumer review; exact PR-head/CI binding. Any failure remains
open until its causal repair is verified. Existing deferred MCP popup work stays
with WP09, not silently certified here. User scripts/recording remain untouched.

## First hosted failure synthesis

CI Node22: 3149 tests, 3143 passed, 2 failed, 4 skipped. Both failures concern
i18n contracts: the popup duplicated the literal ComfyUI brand instead of using
its existing provider-label table; six dynamic `t(comfyDisplayMessageKey(...))`
call sites were absent from the finite-key resolver registry. No dictionary key
was actually missing, but the source scanner correctly refused unreviewed dynamic
translation expressions. Repair: reuse the existing brand table and register each
exact call signature with an independently enumerated finite set of message keys.
Keep all scanner assertions and missing-key checks unchanged; rerun both original
i18n contracts before the next candidate. Native CI is still running on the first
freeze; its result remains useful negative evidence, not final proof after edits.

Node24 had the same two i18n failures (3149 total / 3143 pass / 4 skip). Commit
`25b48541` applies the causal repair without relaxing assertions. Both original
i18n files passed all12 tests; the expanded 13-file C receipt now records100 PASS,
0 failures, and test typecheck exited0. First-freeze CodeQL succeeded (analysis
1730235019, 93 findings; count alone does not prove no new findings). First-freeze
frontend job101376830078 succeeded and uploaded WP08c and existing-suite evidence.
Main is downloading screenshots; neither artifact existence nor native pass is yet
a visual verdict. A new exact-head run is required after the repair.

## Pixel-grounded correction

First native run passed179 cases. Main viewed en1280, ko390 and320error PNGs.
The desktop ProviderStatusSelect trigger had no visible ComfyUI identity; mobile
clipped Local HTTP. Its long selected-item `sub` reserves flex width and displaces
the main label, despite the status also being shown immediately below. Existing
tests inspected status/chip/workflow controls, not this provider-label geometry.
Repair the Comfy caller only using Select's existing `triggerSub=""` override;
keep full status in menu rows and the live status line, and all other provider
triggers unchanged. Add exact full provider-label and rendered-range checks in
every D14 locale/viewport case. No primitive redesign or status deletion.
Two candidate visual reviewers inspect all40 first-run captures for other issues.

Main also viewed selected-video-popup/manage-workflows/Home captures. The selected
video popup wrongly included the lane-only availability hint "Choose a workflow".
Hide that generic hint only in core-Comfy; the selected-specific status and facts
already supply guidance. Assert no generic hint in that native case. The management
capture showed the top of Settings, not the below-fold manager: scroll the actual
manager title into the viewport before taking its screenshot. These are separate
display/capture defects, not a reason to change generation or navigation contracts.
