# 020 — Cleanup Execution Record + Git Delivery Architecture (2026-07-14)

## Executed cleanup (WP2, all post-archive)

| Action | Detail | Recovery window |
|--------|--------|-----------------|
| Worktree removed | `/Users/jun/.codex/worktrees/7174/ima2-gen` (`git worktree remove --force` + `prune`) | full dirty state archived in `artifacts/` (status v1/v2, `diff HEAD`, `diff --cached`, untracked tar 94MB, ignored inventory, `.codexclaw` tar) |
| Stashes dropped | `stash@{1}` → `e47a0e5430ff` (v1.1.10-era), `stash@{0}` → `64303f117479` (pre-rebuild WIP, base `d2667ff3`) | patches in `artifacts/`; commits fsck-recoverable ~2 weeks |
| Branches deleted | `docs/structure-refresh-2026-05-06` @ `22505f9b` (all commits patch-equivalent in dev), `ts-strict-followup` @ `3525406c` (landed as squash PR #50; `refs/pull/50/head` retained on GitHub) | reflog-independent: SHAs recorded here |
| Config restored | `core.fsmonitor`/`core.untrackedcache` unset; **`core.worktree = /Users/jun/Developer/new/700_projects/ima2-gen` restored** in `$GIT_COMMON_DIR/config.worktree` (`extensions.worktreeConfig=true` kept — canonical absorbed-submodule + worktree layout) | incident fix had deleted `core.worktree` outright, leaving the main worktree resolving to the git dir |
| Git dir de-polluted | 38 foreign working-tree entries (~35MB: `site/`, `assets/`, `devlog/`, `ui/`, …) materialized inside the module git dir during the incident were archived (tar 보관 종료, 2026-08-13 — `artifacts/README.md` 참조) and removed; `hooks/` (lfs) + `lfs/` preserved | tar in `artifacts/` |
| Rescued unique data | `devlog/_fin/260713_issue110-windows-installer-npm/` existed ONLY in the 7174 worktree (no ref) → copied into this checkout's `devlog/_fin/` | now on disk here |
| Canary | 1-byte append to `LICENSE` → ` M LICENSE` detected; revert byte-identical (shasum `5cd6bf58…` unchanged) | change detection proven healthy |

Dangling release-era chain `36fc4d76 → dbb4bcbf → d2667ff3` remains reflog-reachable (`HEAD@{...}`, `dev@{...}`) ~30 days.

## Git delivery architecture (steady state)

### Branch roles

| Branch | Role | npm channel |
|--------|------|-------------|
| `dev` | integration — all feature work lands here | — |
| `preview` | release-candidate channel; push publishes `X.Y.Z-preview.<date>.<run>.<attempt>` | `preview` |
| `main` | stable; kept fast-forward-aligned with released state | — |
| `v*` tag | stable release trigger | `latest` |

### OIDC trusted-publishing flow (publish.yml + release-contract.mjs)

1. Land on `dev`, fast-forward `main` + `preview` to the same SHA, push all three.
2. `preview` push → Publish workflow: prepare → package (`verify:release:source`) → windows-consumer gates → publish `preview` tag with `gitHead=<SHA>`.
3. Tag `vX.Y.Z` (same SHA) push → prepare verifies npm `preview` gitHead **proves** the tag SHA and `main`/`dev`/`preview`/tag all equal it (`validateRemoteRefs`) → publishes `latest`.
4. Order matters: preview must succeed before the tag run; on a new fix commit, re-align all three branches + re-point the tag.

### Worktree policy (post-incident)

- This repo is an **absorbed submodule** of `/Users/jun/Developer/new`; git dir = `.git/modules/700_projects/ima2-gen`, main checkout wired via `core.worktree` in `$GIT_COMMON_DIR/config.worktree` (never in shared `config` while linked worktrees may exist).
- `git worktree list` displaying the module git dir as the main-worktree path is normal for absorbed submodules; health checks are `git rev-parse --show-toplevel` and `git config core.worktree`.
- Never point `core.worktree` at a linked/ephemeral worktree. If change detection ever "breaks" again, check `git rev-parse --show-toplevel` FIRST.
- Parent-repo gitlink is intentionally stale (`submodule.<path>.ignore=all`); do not "fix" it as part of routine work.
- `devlog/` is gitignored by design (284 legacy tracked files remain); devlog work is local-only and needs no commits.
