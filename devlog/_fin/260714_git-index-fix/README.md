# Git Index Fix — 2026-07-14

## Summary

Git change detection was completely broken in the ima2-gen repo. `git diff`,
`git status`, and `git add` could not detect file changes — including a version
bump from 2.0.17→2.0.18 and an 80-line deletion in `routes/assets.ts`. This
blocked the npm release deployment pipeline entirely.

## Root Cause

The submodule's shared git config (`../../.git/modules/700_projects/ima2-gen/config`)
had `core.worktree` set to `/Users/jun/.codex/worktrees/7174/ima2-gen` — a
Codex-created worktree path. This made **all** git commands in the main checkout
at `/Users/jun/Developer/new/700_projects/ima2-gen` read files from the Codex
worktree instead of the actual working directory.

Confirmed by `git rev-parse --show-toplevel` returning the worktree path, not
the actual repo path.

## Fix Applied

```bash
git config --unset core.worktree
```

Removed the stale worktree override. This is shared config between the main
checkout and linked worktrees; Git should resolve each checkout from its own
`.git`/worktree metadata without a global override.

## Collateral Damage

- Multiple failed CI runs (`publish.yml`) due to commits containing wrong file
  content (inventory generated from the wrong directory).
- Version bump commit required a `git commit-tree` plumbing workaround before
  the root cause was found.
- Stash operations conflicted with the wrong worktree state.

## Prevention

- Codex worktree creation should not set `core.worktree` in shared submodule
  config.
- When git change detection fails inexplicably, check
  `git rev-parse --show-toplevel` first.
- Canary test: `diff <(git show HEAD:package.json) package.json` should always
  reflect real changes.

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-07-14T10:00Z | Started branch sync + npm deploy |
| 2026-07-14T10:07Z | First CI failure — typecheck error in `routes/assets.ts` |
| 2026-07-14T10:12Z | Discovered git can't detect file changes |
| 2026-07-14T10:30Z | Darwin (sol explorer) identified `core.worktree` as root cause |
| 2026-07-14T10:32Z | Fix applied, git restored to normal operation |
| 2026-07-14T10:35Z | Clean commit created with correct inventory, pushed for CI |
