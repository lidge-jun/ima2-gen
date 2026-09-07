# 020 wp2 — dependabot PR closure (C2, external-state)

## Facts (P)
| PR | Head | Base merge-base | Red check | Cause |
|---|---|---|---|---|
| #194 @xyflow/react 12.11.5 (ui) | c4179208 | d39f9ea2 | PR fast gate | `release provenance guard (wp9)` test: required-units wp9 SHA 86bf4590 not an ancestor of the PR merge commit built on a stale base |
| #195 @openai/codex 0.152.0, openai, sharp, zod | f6d43771 | d2afe6b2 | same | same |
| #196 tsx 4.23.13 | 45797a21 | d39f9ea2 | same | same |
| #220 codeql-action 4.37.9, deploy-pages | 98328a62 | 03514fe3 | none (all green) | base current enough |

The failing test reads .release/required-units.json and runs `git merge-base
--is-ancestor` against HEAD; on a PR merge ref whose base predates 86bf4590 it must fail.
Rebasing onto current main fixes it without code change.

## Procedure per PR (bottom = #220 first since already green)
1. `gh pr view N --json headRefOid,mergeStateStatus,statusCheckRollup` refresh.
2. For #194/#195/#196: `gh pr comment N --body "@dependabot rebase"`; poll
   `gh pr view N --json headRefOid` until it changes; then wait for PR Fast Gate,
   CodeQL on the new head (`gh pr checks N --watch`).
3. Read the #195 bumps for breakage risk: @openai/codex 0.149.1 -> 0.152.0 is pinned
   exactly in package.json:95 and referenced by release toolchain
   (`scripts/release-contract.mjs assert-toolchain` and CHANGELOG "pin @openai/codex
   0.144.1"). Verify `rg -n '0.149.1|codex' scripts/release-contract.mjs
   .github/workflows/*.yml` before merging; if the toolchain assert pins the version,
   the bump needs the pin updated in the same PR (push a commit to the dependabot
   branch is allowed for the repo owner; dependabot keeps the PR) or close with reason.
   zod 4.4.3 is pinned exactly (package.json:106) and is a peer of openai-oauth; the
   package smoke covers it in CI (`filesystem` matrix on ci.yml, not on PR fast).
   Therefore for #195 additionally dispatch `gh workflow run ci.yml --ref <branch> -f sha=<head>`
   and require green before merge.
4. Merge: `gh pr merge N --merge --match-head-commit <head>`. Serial, re-refresh between.
5. After each merge into main, `git fetch`; when all four are in, open/merge a
   main -> dev sync if main has commits dev lacks (`git log origin/dev..origin/main`),
   so wp5's dev -> main promotion carries everything. Prefer merging main into dev via a
   PR `codex/p314-sync-main-into-dev` (merge commit, no rebase).

## Verifiers
- `gh pr list --state open --json number` -> only our own WP PRs remain.
- `git merge-base --is-ancestor <merge-sha> origin/main` for each.

## Accept: c-3.

