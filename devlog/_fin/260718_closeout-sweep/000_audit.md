# 000 — closeout-sweep: 9-lane 감사 + closeout 결정 매트릭스

created: 2026-07-18
session: 019f7463-a967-7f00-a53e-5bb3111d8445
class: C3 (multi-lane bookkeeping + integration delivery)

## Objective

`devlog/_plan/` active lane 9개를 현재 코드/테스트/커밋 상태와 대조해,
마무리 가능한 lane은 closeout(`_fin` 이동)까지 완료하고, 잔여 작업이 큰
lane은 상태를 실제와 일치시킨다. push/배포/원격 통합은 범위 밖.

## Audit provenance

terra-high explorer 4개 병렬 감사(읽기 전용) + terra-high reviewer 1개
A-gate(GO-WITH-FIXES, blockers=3, 전부 plan에 fold).

## 결정 매트릭스 (A-gate 수정 반영)

| # | Lane | 판정 | 근거 |
|---|------|------|------|
| 1 | 260515_fork-prompting-modularization-research | CLOSE (단, 수용 문서 정정 후) | 구현 전부 HEAD 커밋(86806a2a=backend+CLI, 6af9b988=UI + 후속). 단 04_risks_acceptance.md:124(복원)와 issue75 계약(미복원) 모순 → 의도된 Prompt Studio product change로 supersede 기록 후 close |
| 2 | 260715_icon_pipeline | `_plan/_future/` 이동 | 구현 0건의 handoff 문서. `_future` 관례상 open 유지 |
| 3 | 260717_element-library-fixes | CLOSE (통합 delivery 후) | 기준 1-3은 HEAD 5b4bf02에 구현. 기준 4 build 증거 필요. HEAD가 untracked(FavoriteStarButton/favoriteState/ElementRefGrid/assetPreview)에 의존 → 통합 delivery 후 build |
| 4 | 260716_composer-tray | CLOSE (080 전달 + QA 후) | 080 favorite-star 번들 커밋 + inventory/typecheck/build + 1440/390 QA + closeout ledger |
| 5 | 260715_spritegen-adoption | CLOSE (문서 정정 + 증거 후) | WP2-6 커밋·green. 021 계획 매트릭스를 en/ko-only + 통합 계약 테스트로 정정(ja locale 부재), build 증거, closeout. 원격 통합은 documented non-goal |
| 6 | 260712_higgsfield-ux-studio | KEEP ACTIVE | last-frame→I2V orchestration 미구현(routes/videoExtended.ts:191-216), UI 계약 테스트 2종 부재, 수동 QA/성능 증거 부재. untracked 070/080 구현은 WIP 체크포인트로 커밋 |
| 7 | 260715_assetgen_ux_overhaul | KEEP ACTIVE (NEEDS_HUMAN) | 030 실화상·픽셀 시각 수용은 사람 판단. untracked keying 구현은 WIP 체크포인트로 커밋 |
| 8 | 260715_subscription-mcp-providers | KEEP ACTIVE | Tier1 golden harness/Tier2 authenticated smoke genuinely absent (090_verification_rollout.md:35) |
| 9 | 260716_cli-entry-routing | KEEP ACTIVE | WP4 character persistence/WP5 derivative diversity 미구현. stale runtime JS는 build:server 재생성으로 해결(수동 패치 금지 — A-gate blocker3) |

## 실행 순서 (B)

1. **lane WIP 체크포인트 커밋** (non-bisectable WIP로 명시 — A-gate blocker1):
   higgsfield 070/080 → assetgen keying → composer-tray 080 →
   cli-entry-routing(WP1 bin/ima2.js, WP3 mcpProviders/catalog) →
   subscription-mcp(capabilities.js + config.js MCP hunk) →
   spritegen(config.js default-model hunk) → skills docs refresh
2. **통합 delivery**: `npm run build:server`(JS 재생성) + 신규 .js force-add +
   `npm run test:inventory` 재생성 + 잔여 wiring 파일
3. **Full gate**: typecheck, typecheck:tests, npm test, cd ui && npm run build
4. **lane closeout**: fork-prompting(수용 정정+closeout doc) →
   element-library-fixes(closeout doc) → composer-tray(080 ledger + QA) →
   spritegen(021 정정 + closeout doc) → icon_pipeline(`_future` 이동)
5. **README 갱신**: active = higgsfield/assetgen/subscription-mcp/cli-entry-routing
   + `_future` icon_pipeline, 각 상태를 감사 증거와 일치화

## Accept criteria

- 각 closeout lane: closeout 문서 + `_fin` 위치 + README 반영 + 커밋 해시
- Full gate 4종 exit 0
- KEEP ACTIVE lane: 잔여 작업이 README와 일치, WIP 체크포인트 커밋 해시
- git push 없음
