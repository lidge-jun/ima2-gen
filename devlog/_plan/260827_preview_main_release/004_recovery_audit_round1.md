# Recovery audit round 1 synthesis

## Reviewer verdict

The independent reviewer returned FAIL with two blockers:

1. The local recovery sequence named `origin/main` but did not explicitly fetch the candidate ref/object before `--ff-only`.
2. The 40-minute Windows step sat inside a 60-minute preview wait and 90-minute cut job; those outer envelopes could preempt a valid nested workflow and strand main/preview again.

## Disposition

- Blocker 1 accepted: `011_recovery_plan.md` now starts with explicit fetch and live-SHA proof.
- Blocker 2 accepted: the change surface now includes `release.yml`; the regression contract checks all three envelopes and plans 40-minute Windows, 100-minute preview wait, and 240-minute cut timeout.
- No rebuttals.
- Re-audit is required before Build.
