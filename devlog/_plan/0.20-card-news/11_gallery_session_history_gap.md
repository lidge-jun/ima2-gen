# 11 Gallery And Session History

> 상태: 확정 계획
> 범위: Card News 결과를 Gallery/History에서 set 단위로 찾고 다시 여는 기능.

## 감사 반영

기존 문서의 "Gallery에 안 보일 수 있다"는 표현은 너무 넓었다.

현재 `lib/historyList.js`는 재귀 스캔을 하기 때문에 `generated/cardnews/<setId>/card-01.png` 같은 이미지는 flat image row로 일부 발견될 수 있다. 진짜 gap은 아래다.

- `card-01.png`의 sidecar를 `historyList.js`가 `card-01.png.json`으로 찾는데, 생성기는 `card-01.json`을 쓴다.
- card-news set manifest를 Gallery set item으로 읽지 않는다.
- `sessionId`, `setId`, `title`, `cardOrder`, `headline` 같은 metadata가 history 응답에 안정적으로 들어가지 않는다.
- Frontend `GenerateItem.kind`와 Gallery narrowing이 `card-news-card` / `card-news-set`을 모른다.
- Gallery에서 set을 열어 Card News workspace로 hydrate하는 경로가 없다.

## 제품 결정

0.21에서는 두 레벨을 모두 지원한다.

```text
card-news-card
  = 기존 Gallery grid에 호환되는 개별 png row

card-news-set
  = manifest.json 기반 set row
  = 대표 thumbnail + card strip + open set action
```

## Diff-Level Plan

### 1. MODIFY `lib/cardNewsGenerator.js`

생성 payload에서 `sessionId`와 `requestId`를 받도록 확장한다.

Manifest에 추가:

```json
{
  "kind": "card-news-set",
  "setId": "cs_xxx",
  "sessionId": "s_xxx",
  "requestId": "req_xxx",
  "title": "...",
  "cardCount": 5,
  "createdAt": 1770000000000
}
```

Card sidecar에 추가:

```json
{
  "kind": "card-news-card",
  "setId": "cs_xxx",
  "sessionId": "s_xxx",
  "cardId": "card_1",
  "cardOrder": 1,
  "title": "...",
  "headline": "...",
  "body": "...",
  "prompt": "visual prompt"
}
```

Sidecar naming은 기존 `card-01.json`을 유지한다.

### 2. MODIFY `lib/historyList.js`

추가:

- png sidecar lookup 시 `card-01.png.json`이 없으면 basename sibling `card-01.json`도 확인한다.
- `generated/cardnews/*/manifest.json`을 set item으로 읽는다.
- set item과 card item을 구분해서 반환한다.

반환 예:

```ts
type HistoryItemKind =
  | "classic"
  | "edit"
  | "generate"
  | "card-news-card"
  | "card-news-set";
```

### 3. MODIFY `routes/history.js`

History response shape에 card-news metadata를 그대로 보존한다.

필수 fields:

```text
kind
setId
sessionId
cardId?
cardOrder?
title
headline?
body?
prompt?
url
cards?
```

### 4. MODIFY `routes/cardNews.js`

추가 endpoints:

```text
GET /api/cardnews/sets
GET /api/cardnews/sets/:setId
```

`GET /api/cardnews/sets/:setId`는 manifest와 cards를 반환한다.

```json
{
  "plan": {
    "setId": "cs_xxx",
    "title": "...",
    "cards": []
  }
}
```

Backend가 manifest/card sidecars를 읽은 뒤 `CardNewsPlan` shape로 normalize한다. Frontend는 별도 mapper 없이 이 `plan`을 그대로 `activePlan`에 hydrate한다.

### 5. MODIFY `ui/src/lib/cardNewsApi.ts`

추가:

```ts
export function listCardNewsSets(): Promise<{ sets: CardNewsSetSummary[] }>;
export function getCardNewsSet(setId: string): Promise<{ plan: CardNewsPlan }>;
```

`generateCardNews()` payload에 `sessionId?: string` 추가.

### 6. MODIFY `ui/src/store/cardNewsStore.ts`

추가:

```ts
loadSet(setId: string): Promise<void>;
```

동작:

- `getCardNewsSet(setId)` 호출
- `activePlan` hydrate
- `selectedCardId`를 첫 card로 설정
- 기존 Classic/Node state는 건드리지 않음

`generateSet()`는 `useAppStore.getState().activeSessionId`를 payload에 포함한다.

### 7. MODIFY `ui/src/types.ts`, `ui/src/lib/api.ts`

`GenerateItem.kind` 또는 history item kind에 추가:

```text
card-news-card
card-news-set
```

Card News set/card metadata type을 추가한다.

### 8. MODIFY `ui/src/components/GalleryModal.tsx`

추가 UI:

- `card-news-set`이면 representative thumbnail + mini card strip을 표시한다.
- set tile action: "Open set"
- 클릭 시:

```text
useCardNewsStore.getState().loadSet(setId)
useAppStore.getState().setUIMode("card-news")
close Gallery
```

개별 `card-news-card`는 기존 image tile처럼 열 수 있게 두되, set context badge를 표시한다.

### 9. MODIFY `ui/src/i18n/ko.json`, `ui/src/i18n/en.json`, `ui/src/index.css`

추가:

```text
gallery.cardNewsSet
gallery.openCardNewsSet
gallery.cardNewsCard
.gallery-card-news-set
.gallery-card-news-strip
```

## Tests

### MODIFY `tests/card-news-contract.test.js`

추가:

- generator persists `sessionId` in manifest and card sidecars.
- `historyList` reads `card-01.json` for `card-01.png`.
- `historyList` emits `card-news-set` from manifest.
- missing sidecar does not break set discovery.
- `GET /api/cardnews/sets/:setId` returns manifest-derived plan.

### MODIFY `tests/card-news-frontend-contract.test.js`

추가:

- `GenerateItem.kind` includes `card-news-card` and `card-news-set`.
- `GalleryModal.tsx` has a card-news set render path.
- `cardNewsStore.loadSet` exists.
- `generateSet()` sends active `sessionId`.
- Gallery set open path switches to Card News mode.

## References From Audit

- Adobe Express multiple-page projects: carousel media should remain grouped as multi-page output.
- Meta carousel ads: card order and set identity are essential, not incidental filenames.
