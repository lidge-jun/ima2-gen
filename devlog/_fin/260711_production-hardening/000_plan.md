---
created: 2026-07-11
tags: [ima2-gen, hardening, agent-mode, video, devlog]
---

# 260711 Production Hardening — 전반 구멍 닫기 + Agent(비디오) 탭 전면 개선

이 레인은 ima2-gen을 프로덕션급으로 하드닝하는 멀티 work-phase 작업의 허브다.
goalplan: `.codexclaw/goalplans/ima2-gen-production-hardening-devlog-fin-closeou/`
(host goal ACTIVE, cxc-loop HOTL, gpt-5.6-sol 서브에이전트 병렬 파견).

## Work Phases

| WP | 내용 | 상태 |
|---|---|---|
| WP0 | devlog `_fin` closeout + README 재작성 | in progress |
| WP1 | Agent 탭 감사 (코드맵/UX 결함/기존 레인 스코프/웹 레퍼런스) | explorer 파견됨 |
| WP2 | Agent 탭 Design Read + 재설계 스펙 | pending |
| WP3 | Agent 탭 구현 (레이아웃/큐/진행/에러/프리뷰) | pending |
| WP4 | 비디오 설정 persistence (260531 레인) | pending |
| WP5 | 비디오 모드 새로고침 persistence + continue-from-video (260601 레인) | pending |
| WP6 | stabilize-split Phase 3 (백엔드 4파일 500줄 분할) | pending |
| WP7 | 캔버스 G1 구워진 노트 revert 경로 | pending |
| WP8 | 하드닝 홀 스캔 (에러/상태/a11y/보안/성능) | explorer 파견됨 |
| WP9 | 상위 우선순위 홀 수정 | pending |
| WP10 | 최종 검증 + 전역 설치본 동기화 + closeout | pending |

## WP0 이동 기록 (2026-07-11)

| 레인 | 이동 | 근거 |
|---|---|---|
| `260711_skill-structured-prompting` | `_fin` | 090_closeout 존재, SKILL.md R1-R11 반영, 계약 테스트 통과 |
| `260711_canvas-i2i-annotation-cleanup` | `_fin` | 090_closeout 존재, 1094 테스트 통과. G1 후속은 본 레인 WP7이 승계 |
| `260707_gpt56-oidc-devlog-hardening` | `_fin` | v2.0.15가 npm 레지스트리에 게시됨(`npm view ima2-gen version` = 2.0.15). publish.yml의 `windows-consumer` 게이트(115행)가 publish 선행 조건이므로 corrective release 검증 통과 증거 |

KEEP: `260515_fork-prompting-modularization-research`(참조 연구, #71 sprint 대기),
`260516`/`260517` Agent 레인(WP1-3이 승계 후 이동 예정), `260531_pr-issue-review-rebase-plan`
(PR #81/#3 상태 미확인 — gh CLI 부재로 보수적 유지), 비디오 persistence 2건(WP4/5),
`260605_stabilize-split`(WP6).
