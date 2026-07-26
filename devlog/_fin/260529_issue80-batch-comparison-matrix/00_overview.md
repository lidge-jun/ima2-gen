---
created: 2026-05-29
issue: 80
reporter: PARKJONGMlN
title: "Prompt-locked Batch Comparison Matrix"
tags: [enhancement, feature, batch, comparison, p2]
---

# Issue #80: Prompt-locked Batch Comparison Matrix

## 요약

같은 프롬프트 + 동일 입력 이미지를 기준으로, 모델 / 추론 / 품질 / 해상도 조합을 한 번에 선택해서 자동으로 여러 이미지를 생성하고 그리드로 비교하는 기능 제안.

## 제안 내용

### 입력
- 프롬프트 1회 입력
- Reference image (있으면) 모든 조합에 동일 적용
- 체크박스로 다중 선택:
  - **Model**: GPT-5.5 Thinking, GPT-5.5 Pro, GPT-5.4, GPT-5.4 Mini
  - **Reasoning**: off, low, medium, high, xhigh
  - **Quality**: low, medium, high
  - **Resolution**: 1024×1024, 1536×2048, 2048×2048, 3840×2160

### 출력
- 선택된 옵션의 모든 조합을 자동 배치 생성
- 결과를 그리드 형태로 비교 표시
- 각 결과에 메타데이터: model, reasoning, quality, resolution, seed, elapsed, token/cost
- 결과별 개별 액션: prompt copy, image download, retry, continue

### 예시
3 reasoning × 3 quality = 9개 이미지 자동 생성 → 3×3 그리드

## 기존 시스템과의 관계

### Agent Mode 연결 가능성
현재 Agent Mode에 이미 queue/parallel fanout 인프라가 있음:
- `AgentQueue` — 생성 요청 대기열
- bounded parallel fanout — 동시 생성 제한
- inflight mirroring — 진행 중 상태 추적

Batch Comparison을 Agent Mode의 확장으로 구현하면 인프라를 재사용할 수 있음.

### Multimode 연결 가능성
multimode sequence도 여러 이미지를 순차/병렬 생성하는 구조라, UI 패턴 참고 가능.

## 구현 규모 평가

**대형 기능 — 별도 마일스톤 필요**

| 영역 | 작업량 |
|---|---|
| UI | 새 모드/패널 (Matrix Builder), 결과 그리드 뷰어, 메타데이터 비교 테이블 |
| Store | 배치 요청 생성, 조합 계산, 진행 상태 추적 |
| Server | 배치 라우팅, rate limit 관리, 비용 계산 |
| 인프라 | 기존 Agent Queue 재사용 or 별도 batch executor |

MVP로 접근한다면:
1. 현재 Agent Mode queue에 matrix preset 기능 추가
2. 그리드 비교는 갤러리 모달의 확장으로
3. 메타데이터 비교는 #79의 reasoning 표시 위에 구현

## 인프라 검증 상태

| 시스템 | 검증 | 재사용 가능 여부 |
|---|---|---|
| AgentQueueStore (SQLite, 270줄) | ✅ 확인 | DB column + store insert/select/row/projection plumbing 필요 |
| AgentQueueWorker (polling) | ✅ 확인 | 그대로 사용 |
| AgentGenerationPlanner | ✅ 확인 | prompts만 vary → per-cell 설정 오버라이드 추가 필요 |
| mapWithLimit (bounded concurrency) | ✅ 확인 | 그대로 사용 |
| MultimodeSequencePreview 그리드 | ✅ 확인 | 축 라벨 + 비교 UI 확장 필요 |

### 선행 의존
- **#79 Phase 1** — reasoningEffort per-item 저장 필요 (비교 메타데이터)
- **#78 Phase 2** — `decoding="async"` 없으면 4장+ 동시 표시 시 렉

## Phase 계획

| Phase | 문서 | 내용 | 우선순위 |
|---|---|---|---|
| Phase 1 | `01_phase1_mvp_design.md` | MVP 설계: DB/타입/API/UI 컴포넌트 | P2 |

## 권장 우선순위

P2 — #78(버그), #79(UX개선) 이후에 기능 기획. Agent Mode queue 안정화 후 MVP 접근.
