# 050 — wp5: verification, render grounding, close-out

Depends on wp1-wp4. This phase adds no feature; it proves the four that landed.

## Gate sweep

Every command run from the repo root, exit code recorded to `evidence/`:

| Command | Required | Notes |
|---|---|---|
| `npm run typecheck` | 0 | server + lib + routes |
| `npm run typecheck:tests` | 0 | `tests/**/*.test.ts` |
| `npm test` | `fail 0` | baseline was 2580 / 2578 pass / 0 fail / 2 skip |
| `npm run test:inventory` | 0 | regenerate first — **two** new test files make it stale (`004` §B8) |
| `node scripts/generate-provider-types.mjs --check` | 0 | should be a no-op; this unit adds no model |
| `cd ui && npm run build` | 0 | Vite production build |

**c9 is the strict form.** The baseline for this unit is clean (000
§Verifier reality check), so "no new failures" means `fail 0`, with no
carve-out available.

## Render grounding (C-RENDER-GROUNDING-01, C4 = STRICT)

Serve the built UI, then capture and **read back** — a screenshot that is never
looked at is not evidence.

| Shot | Content | File |
|---|---|---|
| AC1 | Right panel with provider NovelAI: all five groups visible | `evidence/nai-panel-1280.png` |
| AC2 | Composer with the undesired-content field, non-empty | `evidence/nai-negative-field.png` |
| AC3 | V4.5 model selected — transparent-background control absent | `evidence/nai-v45-no-alpha.png` |
| AC4 | Provider switched to GPT — neither surface present | `evidence/nai-off-lane.png` |

AC4 is the visual half of c7: the regression this unit could most plausibly
cause is leaking a NAI control into another lane, and reading the diff proves
intent while the shot proves behavior.

## End-to-end payload proof (c5)

A live NovelAI call needs a token this environment does not have, so the proof
is a local intercept rather than an upstream generation:

1. Start the server with `IMA2_NAI_BASE_URL` pointed at a local recorder.
2. Set an undesired-content string and non-default sampler/steps/Variety+ in
   the UI.
3. Generate; the upstream call fails (no token) but the recorder captures the
   body.
4. Assert the captured `parameters` carry `negative_prompt`,
   `v4_negative_prompt.caption.base_caption`, the chosen sampler,
   `skip_cfg_above_sigma`, and `cfg_rescale`.

Recorded transcript to `evidence/nai-wire-body.json`. This closes c5 without a
credential: the criterion is "the value reaches the adapter", not "NovelAI
returned an image".

## Adversarial audit (c10)

A fresh read-only reviewer — not one that saw the implementation — with the
staged diff and these instructions:

- Does any non-nai lane's payload or render path change? (c7)
- Is any `NaiOptions` key emitted but not read by `readNaiOptions`, or read but
  never settable? (the original defect, re-introduced)
- Do the UI alphabets still match the server's after wp1-wp4?
- Are all four locales complete under `nai`?
- Does any new file exceed 500 lines or any function exceed 50?
- Is `straightAlpha` reachable for a V4.5 model through persisted state?

A FAIL re-enters the audit loop with the same reviewer (AUDIT-LOOP-01); the
synthesis is recorded before any re-patch (REVIEW-SYNTHESIS-01).

## Structure doc sync

`tests/structure-line-counts-contract.test.js:5-17` checks
`structure/01-file-function-map.md` only, against `lib/*` and
`bin/commands/*` (corrected by `004` §B8 — the original claim that both docs
are gate-checked was false).

So: `structure/01-file-function-map.md` **must** be updated in the same commit
as `lib/naiOptions.ts` or the gate goes red.
`structure/04-frontend-architecture.md` is updated because it should be
accurate about the two new UI components, not because a test demands it.

## Close-out

- `090_outcome.md` records the terminal outcome (`DONE` / other) with the
  measured evidence per criterion.
- The goalplan's ten criteria each get `capturedEvidence` — a criterion marked
  `met` with empty evidence fails `cxc loop validate` (E8).
- Local commits per B step; **no push, no tag** (LOOP-GIT-01, and the user's
  objective states it explicitly).

## Scope boundary

IN: verification, evidence, structure sync, close-out docs. OUT: any new
feature; any fix beyond what the gates surface. A defect found here re-enters
the owning work-phase rather than being patched inline.
