# 12 Generation Progress And Retry

> 상태: 확정 계획
> 범위: Card News batch generation 중 set/card progress, spinner, partial error, retry UI.

## 감사 반영

기존 문서는 polling과 SSE를 선택지로 남겼다. 0.21 구현 계획에서는 순서를 확정한다.

결정:

```text
0.21A = frontend optimistic progress state
0.21B = backend job polling
0.21C = optional SSE event stream
```

이 문서는 0.21A와 0.21B까지 diff-level로 고정한다. SSE는 job model이 안정된 뒤 붙인다.

## 제품 결정

Card News progress는 Classic/Node `InFlightList`를 직접 재사용하지 않는다.

이유:

- Classic/Node inflight는 단일 이미지 또는 node generation 중심이다.
- Card News는 set + multiple cards + locked/skipped semantics가 있다.

재사용할 것은 시각 언어뿐이다.

## State Model

### Card

`locked`는 status가 아니라 별도 boolean이다.

```ts
export type CardNewsCardStatus =
  | "draft"
  | "queued"
  | "generating"
  | "generated"
  | "error"
  | "skipped";

type CardNewsCard = {
  locked: boolean;
  status: CardNewsCardStatus;
  error?: string;
};
```

Display state:

```ts
const displayState = card.locked ? "locked" : card.status;
```

### Set

Set status는 selector로 계산한다.

```text
draft       모든 카드 draft/locked
generating  queued/generating 존재
partial     generated와 error가 섞임
generated   모든 unlocked 카드 generated
error       unlocked 카드가 모두 error이거나 요청 실패
```

## 0.21A Diff-Level Plan: Optimistic Frontend State

### 1. MODIFY `ui/src/lib/cardNewsApi.ts`

`CardNewsCard.status`에 `generating`과 `skipped` 추가. `error?: string` 추가.

추가 API wrapper:

```ts
export function regenerateCardNewsCard(payload: {
  setId: string;
  card: CardNewsCard;
  quality: string;
  moderation: "low" | "auto";
  model?: string;
}): Promise<{ card: CardNewsCard }>;
```

현재 backend regenerate route는 set-level result를 반환한다.

```ts
type RegenerateRouteResult = {
  setId: string;
  manifest: Record<string, unknown>;
  cards: CardNewsCard[];
};
```

0.21A에서는 backend route shape를 즉시 바꾸지 않고, frontend wrapper가 `cards`에서 요청한 `card.id`를 찾아 `{ card }`로 normalize한다. 찾지 못하면 wrapper는 error를 throw한다.

### 2. MODIFY `ui/src/store/cardNewsStore.ts`

추가 derived helper 또는 selector 함수:

```ts
getGenerationSummary(): {
  total: number;
  done: number;
  queued: number;
  generating: number;
  errors: number;
  skipped: number;
};
```

`generateSet()` 변경:

1. 요청 직전 unlocked cards를 `queued`로 변경.
2. locked cards는 `skipped`로 표시하거나 locked display override로 제외.
3. current sync request 중에는 set-level `generating=true`.
4. 응답 후 generated cards merge.
5. 응답에 없는 queued cards는 `error`로 바꾸고 message를 남긴다.
6. 실패 시 queued/generating cards를 `error`로 변경한다.

추가 action:

```ts
retryCard(cardId: string): Promise<void>;
```

규칙:

- selected/error/draft card만 retry 가능.
- successful cards는 재생성하지 않음.
- locked card는 retry하지 않음.

### 3. NEW `ui/src/components/card-news/CardNewsBatchBar.tsx`

표시:

```text
Generating 2 / 5
3 queued · 1 error · 1 locked
```

버튼:

- retry failed
- cancel은 job model 이후 검토. 0.21A에서는 표시하지 않음.

### 4. NEW `ui/src/components/card-news/CardStatusBadge.tsx`

10번 문서와 공유한다.

역할:

- badge label
- spinner class for `generating`
- error visual state
- locked override

### 5. MODIFY `ui/src/components/card-news/CardNewsComposer.tsx`

Batch button copy 변경:

```text
Batch generate
Generating 2 / 5
```

버튼 disabled 조건:

- `generating === true`
- `activePlan === null`
- unlocked card count is 0

### 6. MODIFY `ui/src/components/card-news/CardStage.tsx`

선택 카드가 `queued`/`generating`이면 preview 영역에 inline spinner를 표시한다.

generated이면 image preview.

error이면 error panel + retry button.

### 7. MODIFY `ui/src/components/card-news/CardDeckRail.tsx`

각 카드:

- status badge
- generated thumbnail
- error marker
- locked marker

### 8. MODIFY `ui/src/components/card-news/CardInspector.tsx`

선택 카드에 retry button 추가.

Retry 가능 조건:

```text
!locked && (status === "error" || status === "draft")
```

### 9. MODIFY `ui/src/i18n/ko.json`, `ui/src/i18n/en.json`, `ui/src/index.css`

추가:

```text
cardNews.progress.generating
cardNews.progress.queued
cardNews.progress.error
cardNews.progress.locked
cardNews.retryCard
cardNews.retryFailed
.card-news-batch-bar
.card-news-spinner
.card-news-status-badge--generating
```

## 0.21B Diff-Level Plan: Job Polling

### 1. NEW `lib/cardNewsJobStore.js`

In-memory dev server job store.

```ts
type CardNewsJob = {
  jobId: string;
  setId: string;
  status: "queued" | "running" | "partial" | "done" | "error";
  cards: Array<{
    id: string;
    order: number;
    status: CardNewsCardStatus;
    url?: string;
    error?: string;
  }>;
  createdAt: number;
  updatedAt: number;
};
```

0.20/0.21 MVP는 `npm run dev` 전제라 process memory store로 충분하다.

### 2. MODIFY `routes/cardNews.js`

추가 endpoints:

```text
POST /api/cardnews/jobs
GET /api/cardnews/jobs/:jobId
POST /api/cardnews/jobs/:jobId/retry
```

`POST /api/cardnews/generate`는 당장 유지하되, frontend는 0.21B에서 jobs API로 전환한다.

### 3. MODIFY `lib/cardNewsGenerator.js`

내부 card generation을 per-card try/catch로 바꾼다.

규칙:

- 한 카드 실패가 전체 batch를 reject하지 않음.
- 성공 카드는 즉시 sidecar/manifest에 반영.
- 실패 카드는 job state와 manifest에 error 기록.

## Tests

### MODIFY `tests/card-news-frontend-contract.test.js`

추가:

- status type includes `generating` and `skipped`.
- `locked` remains boolean, not a status.
- `CardNewsBatchBar.tsx` exists.
- `CardStatusBadge.tsx` exists.
- `regenerateCardNewsCard()` normalizes set-level route response to `{ card }`.
- `generateSet()` sets unlocked cards to queued before request.
- retry action does not regenerate successful cards.
- locked cards are counted separately.

### MODIFY `tests/card-news-contract.test.js`

추가:

- per-card failure returns partial result.
- generated card sidecars persist even if another card fails.
- job endpoint returns generated/error counts.
- retry endpoint only targets failed selected cards.

## SSE Later

SSE는 0.21C 이후에만 추가한다.

Native `EventSource`를 쓸 경우:

```text
POST /api/cardnews/jobs
GET /api/cardnews/jobs/:jobId/events
```

Fetch streaming을 쓸 경우에는 별도 client 구현을 명시한다. 0.21A/B에서는 선택하지 않는다.

## References From Audit

- Apple HIG progress indicators: 긴 작업은 진행 위치와 상태를 일관되게 보여야 한다.
- Material progress/activity: batch 작업은 전체 진행과 개별 작업 상태를 구분해야 한다.
- MDN SSE: EventSource는 GET stream 중심이므로 POST stream과 구분해야 한다.
