# 000 — devlog archival sweep record (2026-07-25)

Goalplan WP3: move completed-but-unmoved `devlog/_plan` units to `_fin`.
Completion is judged by folder evidence + landed commits + README lane table
(per `devlog/_plan/README.md`: "완료 여부는 폴드 위치만이 아니라 현재 코드,
테스트, GitHub issue 상태, closeout 증거를 같이 본다").

## Moved to `_fin` (7 units + this unit at D)

| Unit | Completion evidence |
|------|---------------------|
| `260718_260718-runway-mcp-loss-hardening` | `routes/mcpRecover.ts` landed; live recover proven 2026-07-23 (higgsfield 042: `/api/mcp/tasks/:id/recover` × 2 → files in `~/.ima2/generated`) |
| `260719_node22-mcp-timer-unref` | `ac7ed6c` fix(mcp): drop redundant timer.unref landed; 010 verification all green |
| `260719_windows-ci-matrix-repair` | `778336c` + `d066ab3` + `fdc8759` + `35a703b` CI/exit-path fixes landed |
| `260722_higgsfield-hardening` | All WPs landed (`f4576bf`, `c933128`); terminal BLOCKED (upstream submit) documented in 042 — closed with evidence, not abandoned |
| `260723_docker-pr115-release301` | Closeout commit `c84fd4f`: v3.0.1 shipped, #114/#115 closed |
| `260723_release-train-3.0.0` | `1cfdbcd`: v3.0.0 published at `bf67a5b`, dist-tags verified |
| `260724_node-mode-hardening` | All 3 phases landed: `58aacf4` (010 cycle detection), `7e42545` (020 error structure), `ae4e584` (030 undo/redo) |
| `260725_structured_filename` | Squash-merged `08796ac` on dev; 1907/1907 tests; PR #116 closed |

## Kept in `_plan` (active / not clearly complete)

| Unit | Reason |
|------|--------|
| `260715_subscription-mcp-providers` | README lane 1: WP 090 Tier1 golden harness, Tier2 auth smoke, 100 provider expansion remain |
| `260716_cli-entry-routing` | README lane 2: WP4 character persistence, WP5 derivative diversity remain |
| `260718_closeout-sweep` | README lane 3: self-described "sweep 진행 중"; its own closeout gate not recorded |
| `README.md`, `_future/` | hub + deferred items, by definition |

## Actions

1. `git mv` tracked units; plain `mv` for untracked ones (260718_runway,
   260719_node22, 260719_windows were never force-added).
2. Update `devlog/_plan/README.md` lane table (drop completed lanes).
3. This unit moves to `_fin` at its own D.
