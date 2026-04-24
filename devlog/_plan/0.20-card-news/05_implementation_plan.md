# 05 Implementation Plan

## 수정된 구현 순서

기존에는 CardSet CRUD를 먼저 생각했지만, 지금은 template model을 먼저 고정하는 편이 맞다.

```text
0.20.1 Research split
0.20.2 Image Template Registry
0.20.3 Role Node Template Registry
0.20.4 Codex Planner JSON Draft
0.20.5 Card News Workspace
0.20.6 Batch Generate
0.20.7 Export
0.30   Text Overlay / Safe Area Editor
```

이유:

- 이미지 템플릿이 먼저 있어야 planner prompt와 card UI가 안정된다.
- CardSet CRUD를 먼저 만들면 template schema 변경으로 다시 흔들린다.
- MVP의 차별점은 "이미지 묶음 생성"이 아니라 "실제 이미지 템플릿 asset + 구조화된 카드 기획"이다.

## 0.20.2 Image Template Registry

파일 후보:

```text
lib/cardNewsImageTemplateStore.js
routes/cardNewsTemplates.js
assets/card-news/templates/*
tests/storage-card-news-template.test.js
```

범위:

- built-in image template seed
- user-created template metadata 저장
- preview/base image path guard
- slots_json CRUD
- 아직 batch generation 없음

## 0.20.3 Role Node Template Registry

파일 후보:

```text
lib/cardNewsRoleTemplateStore.js
routes/cardNewsRoleTemplates.js
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
ui/src/lib/cardNews.ts
ui/src/components/UIModeSwitch.tsx
ui/src/App.tsx
```

범위:

- mode switch
- template picker
- role node picker
- content prompt with refs
- JSON deck review
- lock/reorder/edit

## 0.20.6 Batch Generate

범위:

- unlocked 카드만 생성
- 동시성 2부터 시작
- 실패 카드는 partial complete로 남김
- per-card retry
- prompt 수정 후 regenerate

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
| export 품질 불일치 | 사용자 불신 | 원본 PNG + manifest 우선 |
| Node mode와 개념 혼선 | UX 복잡도 증가 | MVP에서는 완전 별도 mode |

## 열어둘 질문

- 기본 카드 수는 5장이 좋은가, 6장이 좋은가?
- built-in image template을 실제 asset으로 언제 생성할 것인가?
- zip export dependency를 추가할 것인가?
- text overlay를 브라우저 Canvas로 할 것인가, 서버 SVG/sharp로 할 것인가?
- Card News 세트를 Gallery에 섞을 것인가, 별도 set list로 둘 것인가?
