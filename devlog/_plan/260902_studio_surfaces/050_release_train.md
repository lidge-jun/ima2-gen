# 050 — Release train (wp6)

Depends on: wp2-wp5 landed on `dev` with green C receipts. This phase changes no
product code; its diff is release evidence only.

## Loop specification

- Loop archetype: repair-and-promote (spec-satisfaction).
- Goal: one release SHA on `origin/dev`, `origin/preview`, `origin/main`, a
  `vX.Y.Z` tag, npm `preview` and `latest` with matching `gitHead`.
- Verifier: exact-head CI + CodeQL on the promoted head, `release.yml`
  (`workflow_dispatch`, `bump=minor`, `dry_run=true` then `false`,
  `expected_sha=<40-char head>`), `publish.yml` runs, `git ls-remote`,
  `npm view ima2-gen dist-tags gitHead`.
- Stop condition: ref convergence + npm gitHead match + GitHub Release present.
- Escalation: any non-fast-forward requirement -> UNSAFE, stop.

## Order of operations (forced by `scripts/release-cut.mjs:53-58`)

`assertBaseline` requires `origin/main` to EQUAL the checkout and already contain
`dev` and `preview`, so promotion precedes the cut.

## Workflow contract the steps rely on (read 2026-09-02)

| Claim | Source |
|---|---|
| Cut runs `release-cut.mjs preflight` after fetching `main dev preview --tags` | `.github/workflows/release.yml:66-69` |
| `expected_sha` refuses a moved `origin/main` | `.github/workflows/release.yml:70-79` |
| Real cut pushes the version commit to `main` then the exact SHA to `preview` | `.github/workflows/release.yml:142-146` |
| Cut waits for the preview publish run, then `assert-preview-proof` before tagging | `.github/workflows/release.yml:163-172` |
| Tag job is gated by the `npm-stable` environment BEFORE the atomic main+dev+tag push | `.github/workflows/release.yml:174-190` |
| Publish classifies the trusted event via `release-contract.mjs prepare` | `.github/workflows/publish.yml:64-69` |
| Publish verifies immutable package + signed provenance via `release-contract.mjs verify-channel` | `.github/workflows/publish.yml:137-143` |
| Stable publish job also sits behind `npm-stable` | `.github/workflows/publish.yml:280-283` |
| Required-unit provenance list lives in code, not JSON | `scripts/release-cut.mjs:61-66` |

Consequence for approvals: exactly two `npm-stable` approvals are expected per real
cut (release tag job, then stable publish job). Approve only when the pending
deployment's run id and candidate SHA match the values recorded in step 7.

| Step | Command | Proof to capture |
|---|---|---|
| 1 | `git fetch origin && git status -sb` | clean tree, `dev` == `origin/dev` |
| 2 | `git push origin dev` (non-force) | push line `<old>..<new> dev -> dev` |
| 3 | `gh run list --commit <head> --json databaseId,name,conclusion` and `gh run watch` | CI + CodeQL success on the exact head |
| 4 | `git merge-base --is-ancestor origin/main dev` and same for preview | exit 0 for both (fast-forward safe) |
| 5 | `git push origin dev:main dev:preview` | both `Fast-forward`-shaped lines |
| 6 | `gh workflow run release.yml -f bump=minor -f dry_run=true -f expected_sha=<head>` | dry-run success, tag job skipped |
| 7 | same with `dry_run=false` | run id, candidate version, candidate SHA |
| 8 | `gh run list --workflow publish.yml` and approve `npm-stable` environment for the exact run | preview + stable publish success |
| 9 | `git fetch --tags && git rev-parse origin/dev origin/main origin/preview vX.Y.Z` | four identical SHAs |
| 10 | `npm view ima2-gen dist-tags gitHead version` | latest = X.Y.Z, gitHead = release SHA |
| 11 | clean-prefix install: `npm i -g ima2-gen@X.Y.Z --prefix $(mktemp -d)` then `ima2 --version`, grep shipped bytes for `vector-svg`, `promptBuilder` backend key, dual-prompt class | installed artifact proof |

Bump choice: `minor` (3.13.0) — three user-visible features and a new config key.

## Required-unit provenance

`scripts/release-cut.mjs:66` `REQUIRED_UNITS = ["wp9"]` reads SHAs from the
release JSON; wp6's P re-verifies whether this line's release JSON needs an entry
for this unit (it did not for v3.12.x; treat as N/A unless the file changed).

## Evidence file

`devlog/_plan/260902_studio_surfaces/090_release_evidence.md` (written in wp6 C/D)
with every run id, SHA, and npm field above, then this unit moves to `_fin/`.
