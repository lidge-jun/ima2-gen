# Audit round 1 synthesis

Reviewer: `gpt-5.6-luna`, read-only. Verdict: FAIL.

## Dispatch history

Two earlier independent reviewers produced no artifact after three bounded waits each
and were retired under DISPATCH-RETIRE-01. The third reviewer returned a complete
roadmap audit. No reviewer edited the worktree.

## Findings and dispositions

### H1 — CLI pre-network claim contradicted current command order

- Evidence: `bin/commands/gen.ts:378-379` fetches the catalog before target
  resolution; `multimode.ts:93-100` and `node.ts:73-75` resolve the server first.
- Root cause: the roadmap described payload insertion but did not distinguish pure
  explicit-target validation from persisted-default resolution.
- Accepted. `030` now defines pure target states and exact validation order. Explicit
  conflicts and malformed values fail before network. Only `gen` may read the catalog
  for an omitted target, then fails before generation POST. Multimode/node require an
  explicit NAI target when NAI flags are present.

### H2 — full field-chain activation verifier was not explicit

- Evidence: adjacent tests were listed, but no single test proved UI -> payload ->
  server normalizer -> adapter body.
- Accepted. `010` and `020` now require one integrated fetch-recorder activation test.

### M1 — V4.5 visibility wording was ambiguous

- Accepted. Auto SMEA and Decrisper are visible for V4.5; only Alpha and Quality
  Preset are V5-only and hidden there.

### M2 — multimode/node target hints were nondeterministic

- Same root cause as H1. Accepted with explicit NAI requirement and a complete test
  matrix for provider-only, model-only, conflict, and unknown states.

## Cross-blocker conflict check

Supporting a persisted default without a catalog lookup conflicts with pre-network
proof on commands that do not fetch the catalog. The resolution deliberately differs
by command: `gen` retains default-target convenience because it already has catalog
truth; multimode/node choose deterministic explicitness. This is visible in help copy
and behavior tests rather than hidden as a server-side fallback.
