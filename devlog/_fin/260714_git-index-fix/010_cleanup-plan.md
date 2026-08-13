# 010 — Git Delivery Architecture Cleanup Plan

## Loop-spec

- **Archetype**: spec-satisfaction repair (verifier defines done)
- **Trigger**: residue from the 2026-07-14 `core.worktree` incident (see README.md)
- **Goal**: local + remote git state is clean, self-consistent, and documented; no incident residue
- **Non-goals**: source code edits, npm publishes, force pushes, touching user WIP in main checkout
- **Verifier**: `git worktree list`, `git stash list`, `git branch -vv`, `git config --list --local`, `git ls-remote`, `npm view ima2-gen dist-tags`, change-detection canary
- **Stop condition**: all 6 goalplan criteria carry fresh captured evidence
- **Memory artifact**: goalplan `ima2-gen-git-delivery-architecture-cleanup-after` + this devlog folder (finalized to `_fin`)
- **Terminal outcomes**: DONE | NEEDS_HUMAN (unarchivable unique work found in 7174) | BLOCKED
- **Escalation**: any step that would require mutating user WIP → stop, report
- **HOTL bounds**: ~45 min wall-clock, session tokens; write scope = git metadata + devlog markdown + archive artifacts only

## Current state (explored 2026-07-14, post-release d66a75d)

- Branches `dev`/`main`/`preview` + tag `v2.0.18` all at `d66a75d` local and origin; npm `latest=2.0.18`.
- Stale Codex worktree `/Users/jun/.codex/worktrees/7174/ima2-gen` (checkout of `main`): 82 MM + 96 D + 2 AD + 1 M + 24 `??` entries — a mix of pre-release main-era file content and confused-git-period edits. Source of the original `core.worktree` incident.
- Stashes: `stash@{0}` "On dev: WIP: pre-rebuild stash" (content already restored to the main checkout working tree during the release run); `stash@{1}` "WIP on main: 8855ef0 v1.1.10" (ancient: +73 lines in `tests/node-ui-contract.test.js`, `ui/src/store/useAppStore.ts`).
- Config leftovers in submodule-local config: `core.fsmonitor=false`, `core.untrackedcache=false` (both set while firefighting), `extensions.worktreeconfig=true`.
- Gone-upstream local branches: `docs/structure-refresh-2026-05-06` @ `22505f9b`, `ts-strict-followup` @ `3525406c`. Kept branches: `pr-74` @ `88a9ee2f`, `feat/grok-video-i2v` @ `33088970`, `feat/websocket` @ `864963ea` (has live upstream).
- Dangling release-era commits (reachable only via stash/reflog): `36fc4d76`, `dbb4bcbf`, `d2667ff3`.

## WP1 — Forensic audit + safety capture (read-only + archive writes)

| Step | Command | Output artifact |
|------|---------|-----------------|
| 1 | `git -C <wt> status --porcelain` full listing | `devlog/_plan/git-index-fix/artifacts/wt7174-status.txt` |
| 2 | `git -C <wt> diff HEAD` (staged+unstaged vs d66a75d) | `artifacts/wt7174-full.patch` |
| 2b | `git -C <wt> diff --cached` (staged-only blobs: 2 AD entries incl. 117-line ThemeToggle.tsx, MM staged intermediates) + `git status --porcelain=v2` | `artifacts/wt7174-staged.patch`, `artifacts/wt7174-status-v2.txt` (audit fold-back, blocker 1) |
| 3 | tar of the 24 untracked files in 7174 | 보관 종료 (2026-08-13) — `artifacts/README.md` 참조 |
| 3b | `git -C <wt> status --porcelain --ignored=matching` inventory; rescue ignored uniques — verified: `devlog/_fin/260713_issue110-windows-installer-npm/` exists in NO ref and only in 7174 → copy into this checkout's `devlog/_fin/`; archive 7174-unique `.codexclaw/{evidence,sessions}` into artifacts tar (audit fold-back, blocker 2) | `artifacts/wt7174-ignored-inventory.txt`, `artifacts/wt7174-codexclaw.tar.gz`, rescued devlog dir |
| 4 | `git stash show -p stash@{0}` / `stash@{1}` — headers record base SHAs (stash@{0} base = dangling d2667ff3) and the stash-commit SHAs printed by later drops | `artifacts/stash0-pre-rebuild.patch`, `artifacts/stash1-v1110.patch` |
| 5 | Snapshot of main-checkout WIP status (byte-identity baseline) | `artifacts/wip-baseline.txt` (status + hashes) |

Accept: every artifact exists and is non-empty (or provably empty); crit-1 evidence captured.

## WP2 — Local cleanup execution

| Step | Command | Guard |
|------|---------|-------|
| 1 | `git worktree remove --force /Users/jun/.codex/worktrees/7174/ima2-gen` + `git worktree prune` | only after WP1 artifacts verified |
| 2 | `git stash drop stash@{1}` then `git stash drop stash@{0}` | only after patch artifacts verified |
| 3 | `git branch -D docs/structure-refresh-2026-05-06 ts-strict-followup` | SHAs recorded above + in incident report. Merge evidence: docs branch = all 5 commits patch-equivalent in dev (`git cherry` `-`); ts-strict-followup landed as squash PR #50 (cherry inconclusive by construction; GitHub retains refs/pull/50/head) |
| 4 | `git config --unset core.fsmonitor; git config --unset core.untrackedcache`; **restore** `core.worktree=/Users/jun/Developer/new/700_projects/ima2-gen` in `$GIT_COMMON_DIR/config.worktree` (keep `extensions.worktreeConfig=true` — canonical absorbed-submodule + worktree layout); verify `git worktree list` names this checkout as the main worktree (audit fold-back, blocker 3) | incident fix had DELETED core.worktree instead of repointing it; main worktree currently resolves to the git dir itself |
| 4b | Inventory foreign working-tree files materialized INSIDE the git dir (`/Users/jun/Developer/new/.git/modules/700_projects/ima2-gen`) and remove them; PRESERVE legit entries: standard git files/dirs, `hooks/` (incl. lfs hooks), `lfs/`, `worktrees/`, `modules/` | archive inventory to `artifacts/gitdir-foreign-files.txt` before deletion (audit fold-back, blocker 3) |
| 5 | Canary: append char to a tracked file, `git status` must show it, revert byte-identical | proves change detection healthy |

Accept: worktree list = main checkout only; stash list empty; branch -vv has no `: gone]` rows; config clean; canary passes (crit-2/3/4).

## WP3 — Remote hygiene + devlog finalization

1. `git fetch --prune origin`; `git ls-remote origin main dev preview refs/tags/v2.0.18` — all `d66a75d...`; `npm view ima2-gen dist-tags` fresh.
2. Extend README.md incident report with: branch roles (dev=integration, preview=release-candidate channel → npm `preview`, main=stable, tag `v*`=npm `latest`), OIDC trusted-publishing flow (preview publish proves gitHead → tag publish), worktree policy (never share `core.worktree`; per-worktree config only), cleanup record (this plan's executed steps + archived artifact index).
3. Move folder `devlog/_plan/git-index-fix/` → `devlog/_fin/260714_git-index-fix/`.
4. Verify user WIP byte-identical vs `artifacts/wip-baseline.txt`, whitelisting this cleanup's own writes (devlog/_plan/git-index-fix/*, rescued devlog/_fin/260713_*, the _plan→_fin move).
5. Out-of-scope note: parent-repo gitlink at /Users/jun/Developer/new is stale (c1673e0b vs d66a75d5) and masked by `submodule.<path>.ignore=all` — intentionally NOT touched in this cleanup; a later `git submodule absorbgitdirs`/`update` from the parent may rewrite core.worktree consistently with WP2-4.
6. Recovery windows recorded: dangling release-era chain (36fc4d76→dbb4bcbf→d2667ff3) reachable via HEAD@{9..12}/dev@{5..7} reflog ~30 days; dropped stash commits fsck-only ~2 weeks.

Accept: crit-5/6 evidence captured; `cxc loop validate` E8 gate passes.

## Activation scenarios (C-ACTIVATION-GROUNDING-01)

- Canary (WP2-5): trigger = 1-byte append to tracked file; observable = file appears in `git status --short`; teardown = revert, `git status` clean for that file.
- NEEDS_HUMAN guard (WP2-1): trigger = WP1 finds 7174 content that is neither in d66a75d nor in main-checkout WIP nor archivable; observable = plan halts before `worktree remove`, report names the files.
