# 020 wp2 — dependabot PR closure (C2, external-state)

## Facts (P)
| PR | Head | Base merge-base | Red check | Cause |
|---|---|---|---|---|
| #194 @xyflow/react 12.11.5 (ui) | c4179208 | d39f9ea2 | PR fast gate | `release provenance guard (wp9)` asserts wp9 SHA 86bf4590 is an ancestor of HEAD via git merge-base; the pr-fast.yml revision those PRs ran used `fetch-depth: 2` (f6d43771:.github/workflows/pr-fast.yml:25), so the shallow clone could not see it. 86bf4590 IS an ancestor of both bases (verified locally, exit 0). Current pr-fast.yml:24 uses `fetch-depth: 0`; a rebase picks up the fixed workflow. |
| #195 @openai/codex 0.152.0, openai, sharp, zod | f6d43771 | d2afe6b2 | same | same |
| #196 tsx 4.23.13 | 45797a21 | d39f9ea2 | same | same |
| #220 codeql-action 4.37.9, deploy-pages | 98328a62 | 03514fe3 | none (all green) | base current enough |

Root cause is the shallow checkout in the workflow revision those PRs were tested with,
not missing ancestry. Rebasing onto current main brings the `fetch-depth: 0` workflow and
fixes it without code change.

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
   package-install smoke covers it in ci.yml (job at .github/workflows/ci.yml:102), not on PR fast.
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

## wp2 P revalidation (2026-09-08, after wp1 merge 9ebd765e)
Quoting wp1 D: PR #221 merged into dev; direction unchanged.
Live state: `@dependabot rebase` was posted on #194/#195/#196 at wp0 D. #194 (head 33a10fe7)
and #195 (head 8cc599af) rebased onto main 36aa6fce and the provenance guard now passes
(full ci.yml matrix green on the new heads, confirming the shallow-fetch root cause).
Dependabot closed #196 as superseded ("tsx is updatable in another way") and opened #222
(development-npm group) in its place. Set to close: #220, #194, #195, #222.
Merge order: #220 (actions) -> #194 (ui) -> #195 (root prod) -> #222 (root dev); each
after PR fast gate + CodeQL on its exact head, `--merge --match-head-commit`, serial.
After all four: main -> dev sync PR so wp5's promotion carries them.

