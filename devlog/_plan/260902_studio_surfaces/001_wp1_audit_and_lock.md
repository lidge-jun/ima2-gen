# 001 — wp1 audit synthesis and roadmap lock

## Audit loop record (AUDIT-LOOP-01)

One reviewer (gpt-5.6-sol, high) across four rounds; a first Anthropic-routed
reviewer died on a 429 after 26 minutes with no verdict and was retired
(DISPATCH-RETIRE-01).

| Round | Verdict | Findings | Disposition |
|---|---|---|---|
| 1 | FAIL | 9 (6 High, 3 Medium) | all folded |
| 2 | FAIL | 5 open (4 closed) | all folded at diff level |
| 3 | FAIL | 2 High in 020 | folded: strict persisted validator split from permissive request validator; backend-only override takes the override lane's default |
| 4 | GO-WITH-FIXES (2 Medium) | stale function name; empty-string backend override | folded; main judged near-pass |

Nothing was rebutted. Root causes clustered in three places: diff-in-markdown
context lines that were not real insertions (010 CSS), the auto-backend model
contract being stated in prose but not carried into the executable diff (020),
and cancellation identity guards that depended on passive-effect timing (030).

## Roadmap lock (LOOP-DOCS-FIRST-01)

The goalplan work-phase map is confirmed 1:1 with the decade docs:

| WP | Doc | Status |
|---|---|---|
| wp1 | 000, 001, 050 (docs) | this cycle |
| wp2 | 010_nai_dual_prompt.md | next |
| wp3 | 020_builder_backend.md | after wp2 |
| wp4 | 030_canvas_vectorize.md | after wp3 |
| wp5 | 040_docs_skill_site.md | after wp4 |
| wp6 | 050_release_train.md | after wp5 |

Locked decisions carried forward:
- Locale contract is the four runtime locales; Japanese is a non-goal.
- Builder auto order: oauth -> grok -> api -> grok-api; explicit backend never falls back.
- Canvas trace reuses the shared VectorizePanel via a hidden canvas-versions save.
- Release bump: minor (3.13.0).

## LOOP-PESSIMIST-01

What did not improve: the first reviewer dispatch produced nothing; time cost ~26 min.
Hypothesis that died: "a single audit round suffices for a 3900-line roadmap" — it took four.
What would show this direction is wrong: wp2's P stale-check finding that 010's
container-query approach cannot coexist with the existing composer CSS.

