# WP13 A — audit synthesis

Main judgment: PASS for the bounded release-prep plan. This is not execution GO
for native merging, publishing or deployment; their live authority/check gates stay.

## Accepted and resolved

1. Both release and UI auditors found that published3.13.1 cannot satisfy the
   current installation-doctor smoke before reaching the UI hook. Removed that
   preflight claim. Explicit candidate acquisition exercises the same new driver
   using a packed current checkout; published acquisition remains mandatory after
   actual release. No skipped doctor or historical compatibility fallback.
2. UI auditor found missing NovelAI activation. Added exact existing persistence
   keys, pure fixture-data reuse, actual mobile sheet sequence/locators, native
   health/auth/static exceptions, no generation/account mutation, two viewports,
   output outside cleanup root and distinct driver/product identities.
3. Late PR217 comment3944573198 is a real Medium CLI identity regression. Status-
   only401/403 is replaced by one body parse and typed known-domain errors, while
   reserved access errors retain fixed text and unknown/unreadable responses stay
   neutral/safe. Both flat and nested shapes are real producers. Both sides'
   reserved codes must take priority in a mixed envelope. No prefix whitelist.
4. Direct generationErrors import would pull responsesParse/inflight/logger into
   the transport. Move its pure status function unchanged to existing providerMap;
   import and re-export it from generationErrors for internal/public consumers.
   responsesErrors' parsed-response import is type-only. Existing CLI emitters
   include both pure modules; model-resolver also creates lib/errors directory.

## Independent final outputs

- Release/topology reviewer: plan PASS; execution still needs bounded CLI
  implementation/independent verification, new cumulative HEAD checks and native
  authorization. Prior b143 CI is not proof of new changes.
- Published UI reviewer, fold-only re-audit: `blocking_issues: 0; VERDICT: PASS`.
- CLI reviewer, fold-only re-audit: flat producer anchors generatePipeline.ts:330
  and edit.ts:155, pure import closure and emitter paths verified; no extra
  blocker; `VERDICT: PASS`.

Reports and exact source anchors are under ignored wp13/a-release.md,
a-published-ui.md and a-cli-provider-auth.md. Latest CLI/release follow-up replies
are recorded above without claiming runtime execution by either reviewer.
Main ran the34-case release contract and toolchain check during P. Future
artifact/helper commands remain B/C work, not existing pass evidence.

Native stack216 opt-in is still a separate pending owner answer. No membership
or merge write may be inferred from this plan PASS. No heartbeat automation.
No source implementation was performed in A. B is limited to the revalidated
map and late CLI compatibility correction, with independent final C review.
