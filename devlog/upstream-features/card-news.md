# Card News 워크스페이스

> 마스터: [README.md](README.md) — Phase 4.1
> 참조: upstream `5e2194e` (MVP) `c84f1d2` (텍스트 필드 contract) `13ea601` (편집 UI) `8327306` (프롬프트 품질 + 템플릿 레지스트리)

## 배경

마케팅용 카드뉴스(이미지 + 텍스트 오버레이)를 생성하는 별도 워크스페이스. 일반 generate와 분리된 모드로, 템플릿 기반 + 텍스트 필드 편집 UI 제공.

**주의**: 별도 모드는 UI 복잡도를 증가시킴. **사용 빈도가 보장될 때 진행**. Phase 4 = "필요 확인 후 결정" 영역.

## 동작 명세

### 모드 전환

기존 UI에 mode 스위치 추가:
- `mode: 'classic' | 'card-news' | 'node'`
- card-news 선택 시 별도 워크스페이스 표시 (기존 composer/result 영역 숨김)

### 카드뉴스 데이터 모델

**`store/cardNewsStore.ts`**(upstream 415줄 ≈ 우리 200~300줄로 가능):
```ts
interface CardNewsTemplate {
  id: string;
  name: string;
  layout: 'cover' | 'split-text' | 'quote' | 'list-3' | ...;
  imagePrompt: string;          // 이미지 생성용 base prompt
  textFields: TextFieldSpec[];  // 슬롯
}

interface TextFieldSpec {
  key: string;                  // "title", "subtitle", "body" 등
  label: string;                // UI 라벨
  maxLength?: number;
  placeholder?: string;
}

interface CardNewsCard {
  id: string;
  templateId: string;
  imageUrl?: string;
  imageGenerating: boolean;
  textValues: Record<string, string>;  // key → 사용자 입력값
}

interface CardNewsState {
  templates: CardNewsTemplate[];
  cards: CardNewsCard[];
  activeCardId: string | null;
}
```

### 텍스트 필드 생성 contract (`c84f1d2`)

이미지와 별개로 **텍스트도 GPT가 생성**. POST `/api/card-news/text`:
```json
{
  "templateId": "split-text",
  "topic": "신규 학원 오픈 안내",
  "tone": "warm | professional | playful"
}
```
응답: `{ textValues: { title: "...", subtitle: "...", body: "..." } }`

### 템플릿 레지스트리 (`8327306`)

`lib/cardNewsTemplates.js` 또는 JSON 파일에 5~10개 기본 템플릿:
- 표지(`cover`): 큰 제목 + 부제
- 분할 텍스트(`split-text`): 좌측 이미지 + 우측 텍스트
- 인용(`quote`): 큰 따옴표 + 출처
- 3단 리스트(`list-3`): 제목 + 3 항목
- 통계(`stat`): 큰 숫자 + 설명

각 템플릿이 `imagePrompt` 포함 → 이미지 생성 시 사용. 사용자가 추가 prompt 입력 가능.

### API

```
GET  /api/card-news/templates                  → 템플릿 목록
POST /api/card-news/text                       → 텍스트 생성
POST /api/card-news/image  {templateId, ...}  → 이미지 생성 (기존 /api/generate 래핑)
```

### UI 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `CardNewsWorkspace` | 모드 전환 시 표시되는 root |
| `TemplateGallery` | 템플릿 5~10개 카드 그리드 |
| `CardEditor` | 선택된 카드의 텍스트 필드 편집 + 이미지 미리보기 |
| `CardPreview` | 최종 카드 렌더 (이미지 + 텍스트 오버레이, html2canvas 등으로 export 가능) |

## 영향 파일

| 파일 | 변경 종류 |
|------|----------|
| `lib/cardNewsTemplates.js` | 신규 — 템플릿 레지스트리 |
| `server.js` | 3 라우트 추가 |
| `ui/src/store/cardNewsStore.ts` | 신규 |
| `ui/src/lib/cardNewsApi.ts` | 신규 |
| `ui/src/components/CardNews/*` | 신규 (4 컴포넌트) |
| `ui/src/components/UIModeSwitch.tsx` | 모드 스위치 추가 |
| `ui/src/types.ts` | `CardNewsTemplate`, `CardNewsCard` 등 타입 |

## 검증

1. **MVP**: 1개 템플릿(cover)으로 텍스트 생성 + 이미지 생성 + 미리보기
2. **확장**: 5개 템플릿
3. **export**: 카드 PNG 다운로드 (html2canvas 또는 서버 사이드 합성)

## 의존성 / 순서

- Phase 1·2 완료 후 시작 권장 (에러 처리 / config 기반 위에서)
- Phase 3.1 Direct mode와 직교 (card-news는 prompt 직접 제어 영역)

## 진행 게이트

**구현 시작 전 사용자 확인**: 카드뉴스 기능을 실제로 쓸 빈도. 안 쓰면 시간 낭비. 기획 단계에서 5분 짚고 가는 게 안전.

## 분량 예측

upstream 4커밋이지만 415줄 store + 275줄 API + 5+ 컴포넌트라 **3~5일** 소요 예상.
