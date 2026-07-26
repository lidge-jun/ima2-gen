---
created: 2026-07-26
updated: 2026-07-26
tags: [model-catalog, grok-4.5, gpt-5.6, frontend-cleaning, pabcd]
---

# 모델 기본값·UI 클리닝 계획

## 목표

xAI 공식 문서에 2026-07-08 출시가 기록된 `grok-4.5`를 Grok 플래너 기본값으로
올리고, 저장소 안에서 이미 검증된 `gpt-5.6-luna` 기본값을 설정·런타임·UI·문서에
일치시킨다. 이전 UI 감사에서 남은 empty state, 줄바꿈, 한국어 문구, dropdown skin,
gradient·색·radius 드리프트도 실제 렌더 기준으로 닫는다.

## 제외

- 기존 `grok-4.3`, GPT-5.4/5.5 선택지 삭제
- 새 UI 프레임워크·아이콘·headless dropdown 의존성
- 유료 이미지·비디오·MCP provider 호출
- 릴리스 버전·태그·npm 배포
- Runway/MCP Tier 2/Canvas masked edit 차단 항목
- force-push와 새 브랜치

## Necessity gate

| 선택 | 판단 |
|---|---|
| 아무것도 하지 않기 | `config.ts`와 생성 `config.js`, Grok 실행 경로와 공개 문서가 서로 달라 거부 |
| 오래된 모델 삭제 | 저장된 사용자 설정과 명시 override 호환성을 깨므로 거부 |
| 설정만 바꾸기 | adapter·route에 로컬 fallback literal과 공개 문서 drift가 남아 불충분 |
| 기존 소유자 재사용 | `lib/imageModels.ts`, `controls/Select.tsx`, 기존 CSS token을 소유자로 채택 |

## Design Read

```yaml
name: ima2-gen
surface: 반복 작업용 AI 이미지·비디오 도구
locale: global i18n, Korean-first QA
colors: 기존 dark neutral + 단일 밝은 accent 유지
typography: 기존 Satoshi/Pretendard/Clash 계층 유지
iconography: 기존 SVG 체계 유지
signature: 모델·provider 상태를 짧고 정확하게 읽는 dense control surface
```

- DESIGN_VARIANCE: 3
- MOTION_INTENSITY: 2
- Product density profile: D5
- 이유: 새 시각 방향이 아니라 반복 작업 속도와 상태 명료성을 고치는 보존형 클리닝이다.
- 새 page/layout이 아니므로 image-first concept generation은 생략한다.

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: 공식 모델 ID와 저장소 기본값·문서·UI 드리프트
- Verifier: 모델 계약 테스트, typecheck/build/full test, browser render, GitHub CI
- Stop: CR0~CR7 증거 확보, `_fin` 이동, origin/dev SHA parity, issue/PR 0/0
- Memory: 이 폴더와 session-bound goalplan/ledger
- Resource: 로컬 repo, git, gh, 공식 xAI 문서만. 유료 호출 0회, work-phase당 1 PABCD
- Terminal: DONE/NOOP/BLOCKED/UNSAFE/NEEDS_HUMAN/BUDGET_EXHAUSTED
- Escalation: 동일 실패 2회는 RCA, 3회는 P 재진입. 안전한 범위가 모호하면 main이 slice 회수

## dependency-ordered work-phase map

| WP | 문서 | 산출물 |
|---|---|---|
| WP0 | `000`, `001`, `010`~`050` | docs-only diff-level roadmap |
| WP1 | `010_model_contract.md` | 서버·CLI·생성 JS·계약 테스트의 모델 기본값 통합 |
| WP2 | `020_model_ux_docs.md` | 모델 선택 UI·i18n·README/docs/site/structure 동기화 |
| WP3 | `030_empty_typography_korean.md` | Home empty state·text-wrap·한국어 문구 |
| WP4 | `040_dropdown_tokens_gradients.md` | Select 재사용·menu skin·token·gradient 클리닝 |
| WP5 | `050_closeout.md` | 전체 게이트·렌더·아카이브·push·CI·0/0 |

## success criteria

| ID | 기준 |
|---|---|
| CR0 | 000/001/010~050 문서가 실제 path와 검증 명령을 가진다 |
| CR1 | Grok planner 미지정 시 4.5, explicit 4.3은 호환된다 |
| CR2 | OpenAI 이미지·보조 planner 기본값이 Luna로 일치한다 |
| CR3 | UI·i18n·README/docs/site/structure가 런타임 모델 계약과 일치한다 |
| CR4 | Home empty·text-wrap·한국어 문구·visible glyph/i18n gap이 닫힌다 |
| CR5 | dropdown skin·token·gradient 예산을 고치고 keyboard 회귀가 없다 |
| CR6 | 전체 로컬 gate와 multi-viewport render가 fresh pass다 |
| CR7 | _fin 이동, origin/dev parity, CI success, issue 0, PR 0이다 |

## 기준선

- 시작 SHA: `ff366adec0ad01f3c3a6deff796ce1d74dd38f2e`
- 시작 CI: run `30192977963`, success
- 시작 GitHub: open issue 0, open PR 0
- 시작 FSM: session `019f9a25-273e-7603-b73d-9bc44e8f9d46`, WP0 P

## 연속성 기록

- WP0 P: 공식 `grok-4.5` ID와 aliases를 확인했다. `config.ts`와 현재 생성
  `config.js`의 GPT 이미지 기본값은 Luna지만 공개 문서 일부가 오래됐고,
  Grok planner literal은 실행 경로에
  분산됐다. 다음 방향은 호환 선택지를 유지한 중앙 기본값 계약이다.
