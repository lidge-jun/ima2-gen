# 05 Implementation Plan

## 수정된 구현 순서

기존에는 CardSet CRUD를 먼저 생각했지만, 지금은 template model을 먼저 고정하는 편이 맞다.

```text
0.20.1 Research split
0.20.2 Image Template Registry
0.20.3 Role Node Template Registry
0.20.4 Codex Planner JSON Draft
0.20.5 Card News Workspace
0.20.6 Template-guided Parallel i2i Generate
0.20.7 Export
0.30   Text Overlay / Safe Area Editor
```

이유:

- 이미지 템플릿이 먼저 있어야 planner prompt와 card UI가 안정된다.
- CardSet CRUD를 먼저 만들면 template schema 변경으로 다시 흔들린다.
- MVP의 차별점은 "이미지 묶음 생성"이 아니라 "실제 이미지 템플릿 asset + 구조화된 카드 기획"이다.
- 생성 기본값은 순차 i2i가 아니라 template-guided parallel i2i다.

## Runtime / Feature Gate

0.20 MVP는 `npm run dev`에서만 실행되도록 설정까지 구현한다.

포함:

- local dev server
- local SQLite/config/generated storage
- 개발용 built-in template seed
- 브라우저 수동 QA
- `config.features.cardNews`
- `ENABLE_CARD_NEWS_MODE`
- `/api/cardnews/*` dev-only route gate
- persisted `uiMode` fallback guard

제외:

- npm global installed runtime 호환성
- 기존 사용자 migration
- published package asset path 보장
- Windows installer/update UX

파일 후보:

```text
MODIFY config.js
MODIFY scripts/dev.mjs
MODIFY ui/src/lib/devMode.ts
MODIFY ui/src/types.ts
MODIFY ui/src/store/useAppStore.ts
MODIFY ui/src/components/UIModeSwitch.tsx
MODIFY ui/src/App.tsx
MODIFY ui/src/components/Sidebar.tsx
MODIFY ui/src/lib/api.ts
MODIFY ui/src/i18n/en.json
MODIFY ui/src/i18n/ko.json
MODIFY routes/index.js
MODIFY tests/config.test.js
```

구현 규칙:

```text
npm run dev -> Card News enabled
ima2 serve -> Card News disabled by default
IMA2_CARD_NEWS=1 -> explicit opt-in
VITE_IMA2_CARD_NEWS=1 -> explicit UI opt-in
```

`scripts/dev.mjs`는 명시적으로 아래 env를 넣는다.

```text
UI build: VITE_IMA2_DEV=1, VITE_IMA2_CARD_NEWS=1
server:   IMA2_DEV=1, IMA2_CARD_NEWS=1
```

Frontend gate는 production build에서도 dev script가 주입한 env를 보도록 한다.

```ts
export const ENABLE_CARD_NEWS_MODE =
  import.meta.env.VITE_IMA2_CARD_NEWS === "1" ||
  import.meta.env.VITE_IMA2_DEV === "1";
```

`import.meta.env.DEV`만 믿지 않는다. 이 repo의 `npm run dev`는 Vite dev server가 아니라 dev env로 `ui:build` 후 watched server를 띄우는 구조다.

## 0.20.2 Image Template Registry

파일 후보:

```text
lib/cardNewsTemplateStore.js
routes/cardNews.js
assets/card-news/templates/*
tests/storage-card-news-template.test.js
```

범위:

- built-in image template seed
- preview/base image path guard
- read-only slots_json from built-in template bundle
- `+ New Image Template` disabled placeholder only
- 아직 batch generation 없음

0.20에서 제외:

- user-created template metadata 저장
- template CRUD
- slot editor
- generated template asset persistence

## 0.20.3 Role Node Template Registry

파일 후보:

```text
lib/cardNewsRoleTemplateStore.js
routes/cardNews.js
prompts/card-news/roles/*.md
```

범위:

- short/mid/long preset
- role chips
- 역할 추가/삭제
- required role validation

## 0.20.4 Codex Planner JSON Draft

파일 후보:

```text
lib/cardNewsPlanner.js
prompts/card-news/planner.md
tests/card-news-planner-contract.test.js
```

범위:

- 이미지 생성 호출 없음
- Codex CLI wrapper에 prompt injection
- JSON schema validation
- repair prompt 1회
- card outline 저장

## 0.20.5 Frontend Workspace

파일 후보:

```text
ui/src/components/card-news/*
ui/src/store/cardNewsStore.ts
ui/src/lib/cardNewsApi.ts
ui/src/types.ts
ui/src/index.css
ui/src/components/UIModeSwitch.tsx
ui/src/components/Sidebar.tsx
ui/src/App.tsx
```

범위:

- mode switch
- template picker
- role node picker
- content prompt with refs
- JSON deck review
- lock/reorder/edit
- `UIMode = "classic" | "node" | "card-news"`
- persisted `"card-news"` falls back to `"classic"` when gate is off
- Card News mode does not fall through to Node sidebar
- central workspace uses three-way branch, not top-level early return
- i18n keys for `uiMode.cardNews` and `cardNews.*`
- Card News API wrapper is isolated in `ui/src/lib/cardNewsApi.ts`

## 0.20.6 Template-guided Parallel i2i Generate

범위:

- unlocked 카드만 생성
- 각 카드 요청에 같은 image template base asset을 input/reference로 포함
- 이전 카드 결과를 다음 카드 입력으로 넘기지 않음
- 동시성 2부터 시작
- 실패 카드는 partial complete로 남김
- per-card retry
- prompt 수정 후 selected-card i2i regenerate

기본 생성:

```text
template base + card 1 prompt → card-01.png
template base + card 2 prompt → card-02.png
template base + card 3 prompt → card-03.png
```

보류:

- `card-01.png → card-02.png → card-03.png` 순차 continuity chain
- 세트 전체를 단일 long context i2i로 생성

파일 후보:

```text
lib/cardNewsGenerator.js
lib/cardNewsManifestStore.js
routes/cardNews.js
tests/card-news-generation-strategy.test.js
```

저장 계약:

```text
generated/cardnews/<setId>/
  manifest.json
  card-01.png
  card-01.json
```

`manifest.json`과 카드별 sidecar에는 `headline`, `body`, `visualPrompt`, `role`, `cardOrder`, `imageFilename`, `sidecarFilename`, `locked`, `status`를 포함해서, 이미지에 직접 넣지 않은 본문 copy도 나중에 복원 가능해야 한다.

0.20에서는 DB 테이블을 만들지 않는다. CardSet CRUD와 DB schema migration은 0.21 이후로 보류한다.

## 0.20.7 Export

범위:

- ZIP export
- `manifest.json`
- `copy.md`
- normalized card file names

## 0.30 Text Overlay

MVP 이후로 미룬다.

이유:

- 한국어 텍스트 합성 품질은 별도 엔진이 필요하다.
- safe area editor가 없으면 overlay 품질이 흔들린다.
- 이미지 생성 모델에 긴 한국어 본문을 맡기면 실패율이 높다.

## 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 한글 텍스트가 이미지 안에서 깨짐 | 카드뉴스 품질 저하 | MVP는 텍스트를 manifest/UI 데이터로 보관 |
| `useAppStore.ts` 비대화 | 유지보수 악화 | `cardNewsStore.ts`로 분리 |
| 세트 생성 중 rate-limit | 긴 대기/실패 | 동시성 2, partial complete, per-card retry |
| 순차 i2i 오류 전파 | 뒤 카드까지 품질 저하 | 기본값은 parallel template i2i, continuity는 고급 옵션 |
| export 품질 불일치 | 사용자 불신 | 원본 PNG + manifest 우선 |
| Node mode와 개념 혼선 | UX 복잡도 증가 | MVP에서는 완전 별도 mode |

## 열어둘 질문

- 기본 카드 수는 5장이 좋은가, 6장이 좋은가?
- built-in image template을 실제 asset으로 언제 생성할 것인가?
- zip export dependency를 추가할 것인가?
- text overlay를 브라우저 Canvas로 할 것인가, 서버 SVG/sharp로 할 것인가?
- Card News 세트를 Gallery에 섞을 것인가, 별도 set list로 둘 것인가?
- sequential continuity mode를 언제 활성화할 것인가?

## B 구현 메모

2026-04-25 B phase에서는 0.20 MVP를 dev-server 전용 흐름으로 구현했다.

구현 범위:

- `npm run dev`가 `IMA2_DEV=1`, `IMA2_CARD_NEWS=1`, `VITE_IMA2_DEV=1`, `VITE_IMA2_CARD_NEWS=1`을 주입한다.
- published/global package path, 기존 사용자 migration, Windows update UX, 릴리즈 패키징은 풀지 않는다.
- Card News mode는 feature gate가 켜진 dev 환경에서만 보인다.
- backend는 built-in image template registry, role template registry, JSON draft, parallel template-guided i2i generation, export placeholder route를 제공한다.
- frontend는 Card News workspace, composer, template picker, role picker, deck rail, focused stage, card inspector를 제공한다.
- generation은 각 카드가 같은 template base asset을 reference로 받아 병렬 생성되고, 이전 카드 결과를 다음 카드 입력으로 넘기지 않는다.

검증:

```text
node --test tests/card-news-contract.test.js tests/card-news-frontend-contract.test.js tests/config.test.js
npm run build
npm test
```
