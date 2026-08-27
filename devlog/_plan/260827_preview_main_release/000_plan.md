# ima2-gen v3.12.0 preview/main release

## Loop specification

- Loop archetype: repair-and-promote, one C4 PABCD cycle.
- Trigger: the user explicitly requested deployment through `preview` and `main` after the NovelAI surface-completion work reached `origin/dev`.
- Goal: publish the completed NovelAI surface as the next minor release, with one release SHA aligned across `origin/dev`, `origin/main`, `origin/preview`, `v3.12.0`, npm `preview`, and npm `latest`.
- Non-goals: no product-code changes, dependency updates, unrelated PR merges, force-pushes, direct `npm publish`, or manual GitHub Pages dispatch.
- Verifier: the repository's canonical `release.yml` candidate CI and publish workflows, followed by live Git refs, GitHub run/release metadata, npm dist-tags/gitHead/integrity, provenance verification, and an install smoke of the published tarball.
- Stop condition: release and publish workflows are successful; all three remote branches and the tag resolve to one SHA; npm `preview` and `latest` both report that SHA; the installed package reports v3.12.0 and exposes the NovelAI CLI surface.
- Memory artifact: this unit's `001_live_baseline.md`, `010_execution.md`, and final `090_outcome.md`.
- Expected terminal outcomes: DONE, or BLOCKED before a release mutation if baseline/CI/audit fails.
- Escalation condition: any non-fast-forward ref update, red exact-head gate, moved release baseline, registry/provenance mismatch, or approval gate that cannot be satisfied with the already-authorized release scope.

## Classification and authority

- Work class: C4 because this changes release branches, npm channels, and immutable package versions.
- Authority: the user's current-session instruction authorizes pushes and deployment to `preview` and `main`, including the repository's normal release workflow and its scoped approval gates.
- Release choice: minor bump from 3.11.0 to 3.12.0 because the payload adds and completes a user-visible provider lane across API, UI, CLI, docs, and packaged skills.

## Scope boundary

### In

- Preserve the verified NovelAI implementation at `d14a3094351322c26ecd9b855a40dd8148e78fa8` as the product-code payload.
- Add only this release evidence unit before promotion.
- Fast-forward `origin/dev`, then bootstrap `origin/main` to the audited `dev` head so `release-cut.mjs preflight` can pass.
- Wait for exact-head CI/CodeQL on the bootstrap SHA.
- Dispatch `.github/workflows/release.yml` with `bump=minor`, `dry_run=false`, and the full bootstrap SHA.
- Satisfy the two `npm-stable` environment approvals if GitHub requests them.
- Verify the generated release SHA and every downstream channel.

### Out

- No changes to source, tests, workflow YAML, package metadata by hand, or existing open Dependabot PRs.
- No direct stable/preview publish command.
- No force update or branch deletion.
- No Pages dispatch: the release delta does not touch the path filters in `.github/workflows/pages.yml:6-10`.

## Dependency-ordered execution

1. Freeze live refs, npm tags, open PRs, active release/publish runs, and rollback anchors.
2. Audit this plan independently against the release scripts and live repository state.
3. Commit the evidence unit, push `dev`, and fast-forward `main` to the same bootstrap SHA.
4. Require successful exact-head `CI` and `CodeQL` on `main`.
5. Dispatch the canonical release workflow with the exact bootstrap SHA.
6. Monitor candidate CI, preview artifact/publish, stable approvals, tag/branch atomic alignment, and stable publish.
7. Verify registry provenance/integrity, install the exact stable tarball in an isolated temp prefix, and archive this unit.

## Acceptance criteria

- `git merge-base --is-ancestor <old-main> <bootstrap-sha>` succeeds and both bootstrap pushes are non-force.
- `node scripts/release-cut.mjs preflight` exits 0 after `main`, `dev`, and `preview` are eligible for the cut; if preview remains at the old stable SHA, main must contain it.
- The main bootstrap `CI` and `CodeQL` runs complete successfully at the exact bootstrap SHA.
- The release workflow creates v3.12.0 from that baseline and its candidate CI succeeds at the generated release SHA.
- The preview publish reports a tested tarball, Windows consumer smoke, OIDC publish, registry integrity, and current provenance for the release SHA.
- The stable tag job atomically aligns `main`, `dev`, and `v3.12.0`; `preview` already points at the same release SHA.
- The stable publish succeeds and GitHub Release v3.12.0 targets the release SHA.
- `npm view ima2-gen dist-tags --json`, `npm view ima2-gen@preview gitHead`, and `npm view ima2-gen@latest gitHead` agree with the release SHA.
- An isolated `npm install ima2-gen@3.12.0` succeeds and `ima2 --version` plus `ima2 gen --help` expose the released version and NovelAI options.

## Rollback and recovery

- Pre-release rollback anchor: v3.11.0 and `d18e56caabd03d5019dbfffa8c9686c9be225e4f` remain immutable.
- Before the stable tag is minted, a failure stops the train; do not move refs further.
- After npm publication, do not delete or overwrite package versions. Recovery is a forward patch release; an emergency dist-tag rollback to 3.11.0 requires a separate incident decision.
- A moved remote baseline invalidates all stale checks and requires a new freeze/audit before retry.

## Verifier reality check

- `node scripts/release-cut.mjs preflight` exists and reads `HEAD`, `origin/main`, `origin/dev`, and `origin/preview` in `scripts/release-cut.mjs`; the baseline run exited 1 because main was still at d18e56ca while HEAD/dev was d14a3094. It becomes the post-bootstrap ancestry verifier.
- `CI` checks out `github.event.inputs.sha || github.sha` and asserts a dispatched SHA at `.github/workflows/ci.yml:40-53`; the release workflow dispatches that exact candidate SHA.
- `publish.yml` checks out `PUBLISH_SHA`, validates live refs, verifies artifact digest, and verifies registry/provenance before reporting success.
- `npm view` and `git ls-remote` query the actual registry and remote refs, so they observe the deployed targets rather than only local files.
