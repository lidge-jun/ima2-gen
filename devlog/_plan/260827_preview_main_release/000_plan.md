# ima2-gen preview/main release and v3.12.1 recovery

## Loop specification

- Loop archetype: repair-and-promote, one C4 PABCD cycle.
- Trigger: the user explicitly requested deployment through `preview` and `main` after the NovelAI surface-completion work reached `origin/dev`.
- Goal: publish the completed NovelAI surface. The first v3.12.0 candidate failed before npm/tag publication; the forward-only recovery target is now v3.12.1, with one release SHA aligned across `origin/dev`, `origin/main`, `origin/preview`, `v3.12.1`, npm `preview`, and npm `latest`.
- Non-goals: no product-code changes, dependency updates, unrelated PR merges, force-pushes, direct `npm publish`, or manual GitHub Pages dispatch.
- Verifier: the repository's canonical `release.yml` candidate CI and publish workflows, followed by live Git refs, GitHub run/release metadata, npm dist-tags/gitHead/integrity, provenance verification, and an install smoke of the published tarball.
- Stop condition: release and publish workflows are successful; all three remote branches and the tag resolve to one SHA; npm `preview` and `latest` both report that SHA; the installed package reports v3.12.1 and exposes the NovelAI CLI surface.
- Memory artifact: this unit's `001_live_baseline.md`, `003_incident_rca.md`, `010_execution.md`, `011_recovery_plan.md`, and final `090_outcome.md`.
- Expected terminal outcomes: DONE, or BLOCKED before a release mutation if baseline/CI/audit fails.
- Escalation condition: any non-fast-forward ref update, red exact-head gate, moved release baseline, registry/provenance mismatch, or approval gate that cannot be satisfied with the already-authorized release scope.

## Classification and authority

- Work class: C4 because this changes release branches, npm channels, and immutable package versions.
- Authority: the user's current-session instruction authorizes pushes and deployment to `preview` and `main`, including the repository's normal release workflow and its scoped approval gates.
- Release choice: the initial minor bump from 3.11.0 created an unpublished v3.12.0 candidate. Because main/preview already moved to that descendant and force rollback is out of scope, the canonical forward recovery is a patch bump to v3.12.1 after the release-gate fix.

## Scope boundary

### In

- Preserve the verified NovelAI implementation at `d14a3094351322c26ecd9b855a40dd8148e78fa8` as the product-code payload.
- Preserve the failed but unpublished v3.12.0 candidate at `3d111149b470eb1513648b1fe01fc0858ce223f7` in history; do not tag or publish it.
- Fix the Windows publish consumer's outer timeout contract and add a regression contract test.
- Fast-forward local/dev/main from the v3.12.0 candidate to the audited recovery head; preview may remain at the candidate because main contains it.
- Wait for exact-head CI/CodeQL on the recovery head.
- Dispatch `.github/workflows/release.yml` with `bump=patch`, `dry_run=false`, and the full recovery head SHA.
- Satisfy the two `npm-stable` environment approvals if GitHub requests them.
- Verify the generated release SHA and every downstream channel.

### Out

- No product behavior changes, dependency updates, package-version edits by hand, or existing open Dependabot PR changes.
- No direct stable/preview publish command.
- No force update or branch deletion.
- No Pages dispatch: the release delta does not touch the path filters in `.github/workflows/pages.yml:6-10`.

## Dependency-ordered execution

1. Freeze live refs, npm tags, open PRs, active release/publish runs, and rollback anchors.
2. Audit this plan independently against the release scripts and live repository state.
3. Record the failed v3.12.0 attempt and prove npm/tag remained unchanged.
4. Add a red-then-green contract tying the Windows outer step timeout to the prepacked smoke's internal deadline sequence; update only the preview Windows consumer timeout.
5. Fast-forward `dev` and `main` to the recovery head and require exact-head `CI` and `CodeQL`.
6. Dispatch the canonical release workflow with `bump=patch` and the exact recovery head.
7. Monitor candidate CI, preview artifact/publish, stable approvals, tag/branch atomic alignment, and stable publish.
8. Verify registry provenance/integrity, install the exact stable tarball in an isolated temp prefix, and archive this unit.

## Acceptance criteria

- The failed run is explained by exact logs: run 33073607259, job 98523042246, step 8 timed out after 15 minutes during the second `tarball-install`.
- A regression test fails against the 15-minute workflow value and passes only when the outer Windows timeout is at least the computed internal prepacked-smoke deadline budget.
- `node scripts/release-cut.mjs preflight` exits 0 after `main`, `dev`, and `preview` are eligible for the recovery cut.
- The recovery-head `CI` and `CodeQL` runs complete successfully at the exact SHA.
- The release workflow creates v3.12.1 from that baseline and its candidate CI succeeds at the generated release SHA.
- The preview publish reports a tested tarball, Windows consumer smoke, OIDC publish, registry integrity, and current provenance for the release SHA.
- The stable tag job atomically aligns `main`, `dev`, and `v3.12.1`; `preview` already points at the same release SHA.
- The stable publish succeeds and GitHub Release v3.12.1 targets the release SHA.
- `npm view ima2-gen dist-tags --json`, `npm view ima2-gen@preview gitHead`, and `npm view ima2-gen@latest gitHead` agree with the release SHA.
- An isolated `npm install ima2-gen@3.12.1` succeeds and `ima2 --version` plus `ima2 gen --help` expose the released version and NovelAI options.

## Rollback and recovery

- Pre-release rollback anchor: v3.11.0 and `d18e56caabd03d5019dbfffa8c9686c9be225e4f` remain immutable; v3.12.0 has no npm artifact or tag.
- Before the stable tag is minted, a failure stops the train; do not move refs further.
- After npm publication, do not delete or overwrite package versions. The current recovery is forward-only v3.12.1; an emergency dist-tag rollback to 3.11.0 requires a separate incident decision.
- A moved remote baseline invalidates all stale checks and requires a new freeze/audit before retry.

## Verifier reality check

- `node scripts/release-cut.mjs preflight` exists and reads `HEAD`, `origin/main`, `origin/dev`, and `origin/preview` in `scripts/release-cut.mjs`; the baseline run exited 1 because main was still at d18e56ca while HEAD/dev was d14a3094. It becomes the post-bootstrap ancestry verifier.
- `CI` checks out `github.event.inputs.sha || github.sha` and asserts a dispatched SHA at `.github/workflows/ci.yml:40-53`; the release workflow dispatches that exact candidate SHA.
- `publish.yml` checks out `PUBLISH_SHA`, validates live refs, verifies artifact digest, and verifies registry/provenance before reporting success.
- `npm view` and `git ls-remote` query the actual registry and remote refs, so they observe the deployed targets rather than only local files.
