---
created: 2026-04-23
updated: 2026-08-31
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
| `260819c_grok_proxy_supervision/` | 조사 + 로드맵 완료 (000-030), 구현 미착수. Grok 프록시 수명주기 재설계 — ensure 진입점, 로그인 재기동, 프로브 기반 상태. |

## 열린 이슈

| 이슈 | 상태 | 사유 |
|---|---|---|
| #150 Provider Adapter v1 RFC | **OPEN** | 2026-08-31 재확인. 수용 조건 6개 중 3개 미충족 + 1개 부분. registry 10 lane 중 어댑터 4개(minimax, atlascloud, comfy, nai), `generateImage`/`editImage` 구현 0건, UI provider 분기 17곳, `packages/` 미존재. 근거 코멘트를 이슈에 기록. |

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

## 2026-08-31 아카이브 기록

`_fin`으로 이동 (1개 유닛):

- `260831_dependabot_issue_triage/` — dependabot 4건 머지 + #150 유지 판정으로 완료.
  게이트 리터럴 SHA 재발(#162 -> #178)을 YAML AST 기반 핀 검사로 교체. 감사 6라운드.
  종료 시점에 열린 PR 0건, `origin/main` = `origin/dev` = `d950b605`, 릴리스 preflight 통과.

## 2026-08-26 아카이브 기록

`_fin`으로 이동 (17개 유닛):

- `260814_issue_pr_zeroing_release/` — v3.1.0으로 완료. 이슈/PR 제로화 + 릴리스
- `260814b_maturity_ops_measurement/` → `_fin/260814_maturity_ops_measurement/` — v3.2.0으로 완료. 성숙도 P0 실행
- `260815_home_hero_preset_removal/` — v3.3.0으로 완료. 홈 히어로 재구성 + 프리셋 제거
- `260815_open_issues_platform/` — v3.5.0으로 완료. 열린 이슈 6건 처분
- `260817_grok_video_planner_timeout/` — v3.6.0으로 완료. Grok 비디오 타임아웃 복원력
- `260818_platform_contracts_closeout/` — v3.6.0으로 완료. 플랫폼 계약 closeout
- `260819_kling_provider_feasibility/` — 조사 완료 (구현은 별도)
- `260819_log_detail_modal/` — v3.7.0으로 완료. 로그 상세 모달
- `260819b_release_speed/` → `_fin/260819_release_speed/` — v3.7.1로 완료. 릴리스 속도 69% 개선
- `260820_grok15_multi_reference_video/` — v3.8.0으로 완료. Grok 1.5 다중 참조 비디오
- `260821_260821d-release-train/` → `_fin/260821_release_train/` — v3.10.0으로 완료
- `260823_comfy_provider_lane/` — 완료. ComfyUI 프로바이더 레인 전체 구현
- `260823_minimax_h3/` — 완료. MiniMax H3 NVFP4 설치 + 실기 검증
- `260824_minimax_h3_pruned_nvfp4/` — 완료. lidge pruned NVFP4 + ima2 Comfy 비디오 연결
- `260825_comfy_video_provider_ux/` — 완료. Comfy 비디오 실행 + 12-lane provider UX
- `260825_issue_batch_170_173/` — 완료. 이슈 4건 수정 + PR 3건 처리
- `260825_novelai_negative_prompt_settings/` — 완료. NovelAI 네거티브 프롬프트 + 설정 패널

`260819c_grok_proxy_supervision/`은 조사와 로드맵만 완료됐고 구현은 없으므로 `_plan`에 남겼다.

## 이전 기록

2026-08-25까지의 아카이브 기록은 이전 버전 히스토리에 있다.
2026-07-25 archival sweep과 그 이전 이력은
`_fin/260725_devlog_archival/000_archival_record.md`에 있다.
