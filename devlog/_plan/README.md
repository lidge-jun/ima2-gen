---
created: 2026-04-23
updated: 2026-07-26
tags: [ima2-gen, devlog, roadmap]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 앞으로 구현하거나 검증할 일이 남은 항목만 둔다. 구현 근거와
테스트가 확인된 항목은 `_fin`으로 이동한다. 완료 여부는 폴더 위치만이 아니라
현재 코드, 테스트, GitHub issue 상태, closeout 증거를 같이 본다.

## Naming Standard

`_plan/` 직속 active 폴더는 다음 두 패턴 중 하나를 따른다.

- `YYMMDD_issue<NN>-<kebab-slug>`: 단일 GitHub 이슈가 canonical scope일 때.
- `YYMMDD_<kebab-slug>`: 단일 이슈가 없는 연구, triage, 다중 이슈 map일 때.

Deferred / 미래 항목은 `_plan/` 직속이 아니라 `_plan/_future/`에 둔다.

## 현재 Active Lane

| 경로 | 상태 |
|---|---|
| `260726_zero-backlog-frontend-qa/` | 진행 중 — 12 work-phase 중 11 완료. 마지막 closeout 사이클 |

2026-07-26 zero-backlog 사이클로 GitHub open issue와 open PR이 **0건**이 됐고,
직전까지 active였던 lane 3개를 모두 `_fin`으로 옮겼다.

## 외부 차단으로 미완료인 항목

여기 있는 것들은 코드를 더 써서 해결되지 않는다. 외부 승인이나 제공자 상태
회복이 선행 조건이다.

| 항목 | 사유 | 재개 조건 | 근거 문서 |
|---|---|---|---|
| MCP Tier 2 authenticated smoke | 실제 OAuth + 유료 `tools/call` + billing delta | 사용자 비용 승인 | `_fin/260715_subscription-mcp-providers/140_closeout.md` |
| MCP 100 provider expansion (Recraft, Magnific) | Tier 2 이후 순서 | Tier 2 완료 | 같은 문서 |
| Runway `edit_video` 라이브 full-flow | stage-2가 workspace limit 반환 | 제공자 한도 회복 | `_fin/260716_cli-entry-routing/070_closeout.md` |
| `bin/commands/editVideo.ts`, multishot CLI 플래그 | 라이브 검증 불가 상태에서 표면만 추가하면 확인 못 하는 코드가 남음 | 위와 동일 | 같은 문서 |
| Canvas provider-backed masked edit (#31) | 업스트림 마스크 계약 미검증. 추측 payload는 조용한 열화 위험 | 계약 문서화 또는 탐침 승인 | `_fin/260430_issue31-provider-masked-edit/` |

## Deferred (`_plan/_future/`)

| 유닛 | 사유 |
|---|---|
| `260715_icon_pipeline/` | 대응 GitHub 이슈 없음, 구현 0건 handoff |
| `260719_higgsfield-open-ledger.md` | 업스트림 이월 원장 |

이 둘은 숫자를 맞추려고 `_fin`으로 옮기지 않았다. 대응 이슈가 없고 구현 착수도
없어서, 옮기면 그건 정리가 아니라 은폐다.

## 2026-07-26 아카이브 기록

`_fin`으로 이동:

- `260715_subscription-mcp-providers/` — Tier 1 golden harness 4종 구현(`c3fa674`), Tier 2는 NEEDS_HUMAN
- `260716_cli-entry-routing/` — WP1~WP4 완료, WP5 잔여는 Runway 한도 차단
- `260718_closeout-sweep/` — historical audit로서 완결
- `_future/260430_issue27-canvas-svg-export/` — `f0815f5`로 구현
- `_future/260430_issue28-canvas-pptx-export/` — `f0815f5`로 구현
- `_future/260430_issue31-provider-masked-edit/` — BLOCKED 근거 기록 후 이슈 close
- `_future/260529_issue80-batch-comparison-matrix/` — `d8bb7c6`로 코어 구현
- `_future/260602_storyboard-planner-skill/` — 4라운드 중 3라운드 기랜딩 확인 후 이슈 close

## 이전 기록

2026-07-25 archival sweep과 그 이전 이력은
`_fin/260725_devlog_archival/000_archival_record.md`에 있다.
