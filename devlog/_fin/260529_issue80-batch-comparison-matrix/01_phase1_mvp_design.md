---
created: 2026-05-29
status: plan
depends_on:
  - 00_overview.md
tags: [feature, batch, comparison, agent-queue, mvp, p2]
---

# Phase 1: Batch Comparison Matrix MVP 설계

## 기존 인프라 분석 (검증 완료)

### Agent Queue 시스템

| 파일 | 역할 |
|---|---|
| `lib/agentTypes.ts:11,57-84` | 타입 정의: `AgentQueueItem`, `AgentGenerationPlan` |
| `lib/agentQueueStore.ts` (271줄) | SQLite 기반 큐: enqueue, claim, complete, fail, cancel, retry |
| `lib/agentQueueWorker.ts` (89줄) | 폴링 워커: 1.5초 간격, claim → execute → complete/fail |
| `lib/agentGenerationPlanner.ts` | 생성 계획: single/fanout/question 모드 |
| `lib/agentRuntime.ts` | 실행: `mapWithLimit()` bounded concurrency |
| `lib/db.ts:145-161` | `agent_queue_items` 테이블 스키마 |

**Queue API 인터페이스:**

```typescript
createAgentQueueItem({ sessionId, prompt, options, plan, command })
claimNextAgentQueueItem({ maxGlobalRunning: 2, maxSessionRunning: 1 })
completeAgentQueueItem(id, imageIds)
failAgentQueueItem(id, { code, message })
cancelAgentQueueItem(id)
retryAgentQueueItem(id)
getAgentQueueProjection(sessionIds) // → { queueBySession, runSummaryBySession }
```

**Concurrency:**
- `maxGlobalRunning: 2` — 서버 전체
- `maxSessionRunning: 1` — 세션당

### Agent Generation Plan

```typescript
interface AgentGenerationPlan {
  mode: "single" | "fanout" | "question";
  prompts: string[];           // 프롬프트 배열 (fanout 시 N개)
  requestedVariants: number;
  plannedVariants: number;
  plannedParallelism: number;
  source: string;
}
```

**현재 한계**: `prompts[]`만 vary 가능. 모델/품질/해상도 등 per-variant 설정 오버라이드 불가.

### Multimode Sequence

| 파일 | 역할 |
|---|---|
| `routes/multimode.ts` | SSE 기반 다중 이미지 생성 (max 8) |
| `MultimodeSequencePreview.tsx` | 그리드 표시 (slot A/B/C/D 배지) |

### 관련 UI 컴포넌트

- `GalleryModal.tsx` — 전체 갤러리 (날짜/세션 그룹)
- `GalleryDateGrid.tsx`, `GallerySessionGroups.tsx` — 그리드 레이아웃
- `GalleryImageTile.tsx` — 개별 타일
- `AgentQueuePanel.tsx` — 큐 상태 패널
- `AgentQueueRow.tsx` — 큐 아이템 행

## MVP 설계

### 접근 방식: N개 독립 Queue Item

**Backend 변경 최소화**. 각 비교 셀을 독립 `AgentQueueItem`으로 enqueue.

```
User: "이 프롬프트로 GPT-5.5 Thinking / GPT-5.4 / quality high/low 비교해줘"
→ 4개 QueueItem 생성 (2 model × 2 quality)
→ 같은 comparisonId로 묶임
→ 기존 Worker가 순차 실행
→ UI에서 그리드 비교
```

### DB 변경

이 프로젝트는 `addColumnIfMissing` 패턴으로 기존 DB를 마이그레이션함 (`lib/db.ts:203-215`).
신규 DB는 `CREATE TABLE`에 포함, 기존 DB는 `addColumnIfMissing`으로 추가.

**`lib/db.ts` — `agent_queue_items` 테이블:**
```diff
  // CREATE TABLE 부분 (신규 DB)
  CREATE TABLE IF NOT EXISTS agent_queue_items (
    // ...existing columns...
+   comparison_id TEXT
  )

  // addColumnIfMissing 부분 (기존 DB 마이그레이션)
+ addColumnIfMissing(db, "agent_queue_items", "comparison_id", "TEXT");
```

**`lib/agentQueueStore.ts` — 전체 plumbing 변경 필요:**
- `createAgentQueueItem()` insert문에 `comparison_id` 추가 (`:55-59`)
- `listAgentQueueItems()` select문에 포함 (`:63-83`)
- `queueItemFromRow()` 변환에 포함 (`:208-225`)
- `getAgentQueueProjection()` 에서 comparison 기준 그룹핑 지원

같은 comparison batch의 모든 아이템이 같은 `comparison_id`를 공유.

### 타입 변경

**`lib/agentTypes.ts`:**
```diff
  export interface AgentQueueItem {
    // ...existing fields...
+   comparisonId?: string;
  }
```

**새 타입:**
```typescript
export interface ComparisonAxis {
  models?: string[];
  reasoningEfforts?: ("none" | "low" | "medium" | "high" | "xhigh")[];
  qualities?: ("low" | "medium" | "high")[];
  sizes?: string[];
}

export interface ComparisonRequest {
  prompt: string;
  referenceImages?: string[];
  axes: ComparisonAxis;
  comparisonId: string;
}
```

### API

**`POST /api/agent/sessions/:sessionId/comparison`**

```typescript
// Request:
{
  prompt: "A serene mountain landscape",
  axes: {
    models: ["gpt-5.5-thinking", "gpt-5.4"],
    qualities: ["high", "low"]
  }
}

// Response (202):
{
  comparisonId: "cmp_xxx",
  cells: 4,        // 2 × 2
  queueItems: ["qi_1", "qi_2", "qi_3", "qi_4"]
}
```

서버는 조합을 계산하고, 각 셀을 **single-variant** 독립 `AgentQueueItem`으로 생성.
각 cell의 plan은 `mode: "single"`, `prompts: [prompt]` — `AgentGenerationPlanner`의 fanout cap 8을 우회.
(planner fanout cap은 `lib/agentGenerationPlanner.ts:8,84-90`이지만, comparison은 N개 독립 item이라 cap 무관)

enqueue 후 `tickAgentQueueWorker(ctx)` 호출 필요 (`routes/agent.ts:159-202` 참조).
기존 `AgentQueueWorker`가 자동으로 drain.

### UI 컴포넌트 (새로 필요)

#### ComparisonComposer
- 프롬프트 입력 (기존 PromptComposer 재사용)
- 축 선택 UI: 모델 체크박스, reasoning 체크박스, quality 체크박스, size 체크박스
- 조합 수 미리보기: "4 images will be generated"
- 상한 경고: max 16 셀 (4 × 4)

#### ComparisonGrid
- `MultimodeSequencePreview`의 확장
- 행/열 축 라벨 (e.g., 행=model, 열=quality)
- 셀 상태: queued / running / done / failed
- done 셀은 이미지 + 메타데이터 (elapsed, tokens, model, reasoning, quality, size)

#### ComparisonResultActions
- 셀별: copy prompt, download, retry
- 전체: export grid, share

### 제약 사항

**maxSessionRunning: 1** → 4셀 비교 시 순차 실행 (~40초). 허용 가능하지만:
- 비교 모드에서는 `maxSessionRunning: 2`로 올리는 옵션 고려
- 또는 비교 전용 세션으로 분리

## 구현 순서 (제안)

| 단계 | 내용 | 규모 |
|---|---|---|
| 1 | DB 컬럼 + 타입 + API endpoint | S |
| 2 | 조합 계산 + N개 큐 아이템 생성 로직 | S |
| 3 | ComparisonComposer UI | M |
| 4 | ComparisonGrid UI | M |
| 5 | 결과 액션 (download, retry, export) | S |

총 예상: 중형 기능 (Agent Mode 자체보다는 작음)

## 선행 의존

- **#79 Phase 1** — reasoningEffort per-item 저장이 먼저 있어야 비교 메타데이터 표시 가능
- **#78 Phase 2** — 고해상도 이미지 `decoding="async"` 없으면 4장 동시 표시 시 렉

## Acceptance Criteria (MVP)

1. 2축 이상 선택 → 조합 자동 계산 → N개 큐 아이템 생성
2. 큐 아이템이 순차 실행되며 진행 상태 표시
3. 완료된 셀에 이미지 + 메타데이터 그리드 표시
4. 행/열 축 라벨로 어떤 설정인지 식별 가능
5. 최대 16셀 상한

## 비고

이 문서는 MVP 설계안입니다. 구현 시 PABCD를 별도로 돌려야 합니다.
issue #80은 P2이므로 #78, #79 완료 후 착수.
