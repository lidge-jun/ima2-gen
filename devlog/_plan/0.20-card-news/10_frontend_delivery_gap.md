# 10 Frontend Delivery Surface

> 상태: 확정 계획
> 범위: Card News 생성 결과가 화면 안에서 "생성됐다"는 감각을 주는 delivery surface.

## 감사 반영

Frontend/Backend 웹서치 감사 결과, 기존 문서의 전제가 일부 오래됐다.

이미 구현된 것:

- `ui/src/store/cardNewsStore.ts`는 생성 응답 카드를 `id` 기준으로 `activePlan.cards`에 merge한다.
- `ui/src/components/card-news/CardStage.tsx`는 선택 카드에 `url`이 있으면 생성 이미지를 preview로 보여준다.

남은 문제는 merge 자체가 아니라 아래 surface다.

- 카드별 상태가 raw text에 가깝고 눈에 잘 안 들어온다.
- generated/error/locked/skipped 상태별 액션이 없다.
- Classic `ResultActions`는 `useAppStore.currentImage`에 묶여 있어 Card News에 직접 재사용하면 안 된다.
- Card News는 set/card scope라서 0.20에서는 Classic `selectedFilename`을 건드리지 않는다.

## 제품 결정

0.21에서는 Card News 결과 전달을 기존 Classic state에 섞지 않는다.

```text
Card News result delivery
  = cardNewsStore 내부 activePlan 기준
  = Card News workspace 전용 액션
  = Gallery/History 통합은 11번 문서에서 처리
```

## Diff-Level Plan

### 1. MODIFY `ui/src/lib/cardNewsApi.ts`

현재:

```ts
status: "draft" | "queued" | "generated" | "error";
```

변경:

```ts
export type CardNewsCardStatus =
  | "draft"
  | "queued"
  | "generating"
  | "generated"
  | "error"
  | "skipped";

status: CardNewsCardStatus;
error?: string;
generatedAt?: number;
```

`locked`는 status가 아니라 기존 boolean으로 유지한다.

### 2. NEW `ui/src/components/card-news/CardStatusBadge.tsx`

역할:

- `locked`면 상태 표시를 `locked`로 override한다.
- `generated`, `error`, `queued`, `generating`, `draft`, `skipped`를 localized badge로 렌더한다.

입력:

```ts
type Props = {
  status: CardNewsCard["status"];
  locked: boolean;
};
```

### 3. MODIFY `ui/src/components/card-news/CardDeckRail.tsx`

현재 raw status text를 표시하는 부분을 제거하고 `CardStatusBadge`를 사용한다.

추가 UX:

- generated card는 thumbnail이 있으면 thumbnail을 우선 표시한다.
- error card는 deck rail에서 눈에 띄는 error badge를 보여준다.
- locked card는 generation 대상이 아님을 badge로 표시한다.

### 4. MODIFY `ui/src/components/card-news/CardStage.tsx`

기존 preview는 유지하고, generated card일 때 전용 action strip을 추가한다.

액션:

- copy image prompt
- copy headline/body
- open card image in new tab
- download selected card
- open set folder는 11번에서 backend path가 확정된 뒤 연결

Classic `ResultActions`는 재사용하지 않는다. CSS class만 참고한다.

### 5. MODIFY `ui/src/components/card-news/CardInspector.tsx`

추가:

- generated metadata 영역: filename, order, status, error message
- locked card는 "generation에서 제외됨" helper copy 표시
- generated card도 copy/headline/body는 manifest 데이터로 수정 가능하되, locked면 명시적으로 disabled 처리

### 6. MODIFY `ui/src/store/cardNewsStore.ts`

`generateSet()` 응답 merge 규칙을 문서화하고 테스트 가능하게 고정한다.

규칙:

- merge key는 `card.id`
- 응답에 없는 locked/skipped card는 기존 card 유지
- selected card id는 변경하지 않음
- Classic `useAppStore.currentImage`, `selectedFilename`은 변경하지 않음
- toast는 set-level 완료만 알림

### 7. MODIFY `ui/src/i18n/ko.json`, `ui/src/i18n/en.json`

추가 key:

```text
cardNews.status.draft
cardNews.status.queued
cardNews.status.generating
cardNews.status.generated
cardNews.status.error
cardNews.status.skipped
cardNews.status.locked
cardNews.actions.copyPrompt
cardNews.actions.copyCopy
cardNews.actions.openImage
cardNews.actions.downloadCard
cardNews.generatedMeta
cardNews.lockedHelp
```

### 8. MODIFY `ui/src/index.css`

추가 selector:

```text
.card-news-status-badge
.card-news-status-badge--generated
.card-news-status-badge--error
.card-news-status-badge--locked
.card-news-result-actions
.card-news-generated-meta
```

## Tests

### MODIFY `tests/card-news-frontend-contract.test.js`

추가 계약:

- `CardStatusBadge.tsx` exists.
- `CardDeckRail.tsx` imports/uses `CardStatusBadge`.
- generated preview remains in `CardStage.tsx`.
- `CardStage.tsx` does not import Classic `ResultActions`.
- `cardNewsStore.generateSet()` merges by `id`.
- `generateSet()` does not mutate `currentImage` or `selectedFilename`.
- i18n has generated/error/locked/skipped/action keys.

## References From Audit

- Meta carousel ads: card order and set context are product-level concepts.
- Adobe Express multi-page/carousel workflows: generated pages need per-page review/actions.
- Canva bulk/template workflows: template consistency should coexist with per-card data changes.
