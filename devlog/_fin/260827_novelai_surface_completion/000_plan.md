# NovelAI surface completion — roadmap lock

Date: 2026-08-27
Class: C4 (cross-surface provider contract plus authorized remote `dev` delivery)
Loop archetype: spec-satisfaction repair

## Objective

Close the remaining NovelAI gaps across server, browser UI, CLI, and the packaged
`ima2` skill. Preserve the already-live V5/V4.5 text-to-image lane and its ZIP/PNG
handling. Deliver the verified result to `origin/dev` without force-pushing or
dropping either side of the current one-commit branch divergence.

## Resource and authority bounds

- Read: this repository, sibling `../CLIsu`, current public NovelAI sources.
- Write: this repository, generated build artifacts through repository scripts,
  Codexclaw evidence, and the installed `ima2` skill through `ima2 skill install`.
- Credentials: existing local NovelAI credential only; at most one free/minimal
  real generation if a contract cannot be proven locally.
- Remote mutation: one non-force `git push origin dev`, already authorized.
- No npm publish, tag, release, account mutation, CLIsu edit, or force-push.
- Wall-clock stop: six hours. Paid generation is not authorized.

## Baseline snapshot

- Worktree: clean.
- Local `dev`: `755fc1c2`, one commit ahead and one behind `origin/dev`.
- Local-only commit: `755fc1c2 docs: record wp2 release evidence`.
- Remote-only commit: `d18e56ca [agent] chore: release v3.11.0`.
- Reconciliation policy: merge `origin/dev` into local `dev` before production
  implementation. A merge commit preserves both commit identities; no rebase or
  history rewrite.
- Focused NAI baseline: `node --import tsx --test tests/nai-*.test.ts` equivalent
  explicit six-file invocation, 76 pass / 0 fail on 2026-08-27.
- Generated CLI baseline: NAI is selectable through `--provider nai`, but `gen`,
  `multimode`, and `node generate` expose no NAI-native options.
- Packaged skill baseline: `skills/ima2/SKILL.md` has no NovelAI/NAI section; the
  installed `/Users/jun/.codex/skills/ima2/SKILL.md` is older and differs from the
  repository copy.

## Necessity gate

- Do nothing: rejected; CLI and skill have observable omissions.
- Delete: rejected; the existing lane is live and tested.
- Configure only: rejected; `autoSmea` and `dynamic_thresholding` are currently
  hardcoded false and cannot be requested by UI/CLI.
- Reuse: selected. Extend `readNaiOptions`, `naiPayloadFields`, and the existing
  CLI command conventions. Do not build a parallel NovelAI client.

## Scope

### In

- Current four models: V5 Full/Curated and V4.5 Full/Curated.
- Existing text-to-image action and ZIP-to-PNG response path.
- Negative prompt; size; sampler; noise schedule; steps; guidance; CFG rescale;
  UC/quality presets; Variety+; seed; V5 alpha.
- Newly reachable official controls: Auto SMEA and Decrisper.
- NAI-native flags on `ima2 gen`, `ima2 multimode`, and `ima2 node generate`.
- Packaged and installed `ima2` skill guidance plus README/API/CLI/structure SoT.

### Out, with explicit support status

- Img2img/reference, inpainting/masks, Character Positioning, Director Reference,
  Vibe Transfer, and Max Enhance. NovelAI supports some of these, but ima2's current
  generic reference/edit contracts do not encode their provider-native roles and
  the public API does not document enough request detail to implement them safely.
- Those paths remain fail-closed with existing `NAI_REF_UNSUPPORTED`,
  `NAI_EDIT_UNSUPPORTED`, and `NAI_MASK_UNSUPPORTED` contracts. Documentation must
  say this directly rather than implying full NovelAI product parity.

## Dependency-ordered work phases

| Work phase | Document | Outcome |
|---|---|---|
| wp0 | 000-002 | Research, source ledger, complete diff-level roadmap |
| wp1 | `010_provider_contract.md` | Config/server contract opens Auto SMEA + Decrisper and hardens model-aware shaping |
| wp2 | `020_ui_payload_parity.md` | Classic/node UI and sparse payloads expose the contract |
| wp3 | `030_cli_surface.md` | Three CLI generation surfaces expose and validate NAI-native flags |
| wp4 | `040_skill_and_sot.md` | Packaged/installed skill and SoT match runtime support boundaries |
| wp5 | `050_integrated_delivery.md` | Full gates, render/CLI QA, archive, push, exact-head/CI proof |

## Loop specification

- Trigger: a planned path or verifier fails.
- Goal: repair only the failing delta, rerun the smallest proving command, then
  resume the phase gate.
- Verifier: focused contract test first; full repository gates in wp5.
- Stop: all criteria met and `origin/dev == HEAD`, or a recorded terminal outcome.
- Memory: this unit plus `.codexclaw/goalplans/bring-ima2-gen-s-novelai-support-to-complete-evi/`.
- Upward escalation: after two failed repairs of one defect, main enters RCA;
  after three, re-plan at P. Downward delegation requires a P amendment.

## Verifier reality check

| Command | Baseline | Reads target |
|---|---|---|
| `node --import tsx --test tests/nai-client-options-contract.test.ts tests/nai-options-contract.test.ts tests/nai-provider-contract.test.ts tests/nai-routing-contract.test.ts tests/nai-ui-registration-contract.test.ts tests/nai-zip-decode.test.ts` | exit 0; 76 pass | Direct target arguments cover server/client/provider/UI/ZIP NAI contracts |
| `npm run typecheck` | script exists: `tsc --noEmit -p tsconfig.json` | `tsconfig.json` includes server/lib/bin-adjacent runtime TypeScript |
| `npm run typecheck:tests` | script exists: `tsc --noEmit -p tsconfig.tests.json` | `tsconfig.tests.json` includes `tests/**/*.test.ts` |
| `npm run build:cli` | script exists: `tsc -p tsconfig.bin.json` | `tsconfig.bin.json` compiles `bin/**/*.ts` into tracked JS |
| `cd ui && npm run build` | script exists | Vite entry imports the changed React/store modules |
| `npm test` | repository runner exists | `scripts/run-tests.mjs` runs the registered test inventory |
| `npm run test:inventory` | repository classifier exists | checks all test files and stale JS-runtime entries |

## SoT sync target

`README.md`, `docs/API.md`, `docs/CLI.md`, `structure/00-structure-hub.md`,
`structure/01-file-function-map.md`, `structure/02-command-reference.md`,
`structure/03-server-api.md`, and `structure/04-frontend-architecture.md`.

## Acceptance criteria

- Every client-emittable NAI field is read and reaches the adapter only on the
  effective NAI lane.
- Model-specific fields are stripped or pinned for V4.5; V5 alpha remains live.
- CLI invalid enum/range and contradictory boolean flags exit 2 before network I/O.
- Non-NAI payloads stay unchanged when no NAI flag is supplied.
- The skill names exact model IDs, setup, examples, supported controls, and explicit
  unsupported paths.
- Fresh full gates, rendered UI observation, built CLI invocation, clean diff, local
  commit history, non-force push, exact remote SHA, and current CI are captured.
