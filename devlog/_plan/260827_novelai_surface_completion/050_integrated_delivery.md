# 050 — Integrated verification, dev reconciliation, archive, and push

Depends on: 010-040. Work phase: wp5.

## Git reconciliation

Before wp1 implementation, fetch `origin` and merge `origin/dev` into local `dev`.
Acceptance:

- merge base and both unique commits recorded;
- `755fc1c2` and `d18e56ca` are ancestors of the result;
- no force/rebase/reset;
- worktree clean before feature commits.

Before push, fetch again. If remote moved, merge/retest rather than overwriting.

## Full gate

Run fresh from final source head:

```text
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm run build:server
npm run build:cli
npm run test:provider-registry
npm test
cd ui && npm run build
git diff --check
```

## User-facing QA matrix

### Built CLI

- `gen --help`, `multimode --help`, `node generate --help` show identical NAI fields.
- One local recorder/smoke captures all true/value fields without paid generation.
- Invalid sampler, range, contradictory toggles, and explicit non-NAI/conflicting
  targets exit 2 before network I/O. `gen` may perform one catalog GET only for an
  omitted target; a mismatched resolved default still exits before generation POST.
- `multimode` and `node generate` reject NAI flags with an unknown target before
  server resolution and accept provider-only/model-only explicit NAI targets.
- `models`, `capabilities`, and `defaults` JSON continue to expose the NAI lane.

### Browser

Serve the built UI in an isolated process. Observe and read back screenshots:

- NAI V5 panel with Auto SMEA and Decrisper visible;
- V4.5 selection with Auto SMEA/Decrisper visible and V5-only Alpha/Quality absent;
- non-NAI selection with the entire panel absent;
- narrow viewport has no clipped controls or horizontal overflow.

Use the native browser QA ladder; record process teardown and screenshot paths.

### Optional live generation

Only if the existing credential is valid and the request is covered by a no-Anlas/free
allowance, make one 1024x1024-or-smaller, <=28-step, single-image call. Otherwise the
local wire recorder is sufficient and the skip reason is recorded.

## Independent final review

A fresh reviewer checks the base-to-head diff, field creation-to-consumer chain,
non-NAI regression risk, CLI validation, docs/runtime agreement, secret handling, and
every changed file. Any High/Critical finding blocks delivery.

## Closeout and delivery

1. Write numbered evidence/outcome docs and fill all goalplan criteria.
2. Move this whole unit from `_plan` to `_fin` with `git mv`.
3. Commit the archive only after full gates pass.
4. Fetch and verify remote ancestry; merge/retest if needed.
5. `git push origin dev` (non-force).
6. Prove `git rev-parse HEAD == git rev-parse origin/dev` and clean status.
7. Inspect the current GitHub run for the exact SHA; wait for success or report a
   real external blocker.

## Terminal outcomes

- DONE: every criterion has fresh evidence, archive is committed, exact-head push and
  CI proof are complete.
- NOOP: impossible after baseline gaps were confirmed.
- BLOCKED: only external GitHub/provider/credential state after safe alternatives.
- UNSAFE/NEEDS_HUMAN: only an unapproved destructive/account choice.
- BUDGET_EXHAUSTED: six-hour bound reached.
