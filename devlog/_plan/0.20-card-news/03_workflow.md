# 03 Workflow

## 사용자 흐름

```text
1. Card News mode 진입
2. Image Template 선택
3. Role Node Template 선택
4. Content Prompt 작성
5. 참고 이미지 최대 5장 추가
6. Draft with Codex
7. JSON-backed card deck 검토
8. 카드별 수정/lock/reorder
9. Template-guided Batch Generate
10. 실패 카드 retry 또는 카드별 regenerate
11. ZIP export
```

## 첫 화면

입력:

- Topic
- Audience
- Platform: Instagram square / Instagram portrait / Story
- Output size: 2048x2048 / 3840x3840 / 2048x2560 / 2160x3840
- Image Template
- Role Node Template
- Content Prompt
- Reference images up to 5

버튼:

- `Draft with Codex`
- `Generate Set`
- `+ New Image Template` disabled placeholder

0.20 MVP는 `npm run dev` 개발 환경에서만 동작하도록 feature gate를 설정한다. packaged npm runtime, migration, release UX는 이 단계 범위에서 제외한다.

Dev gate:

```text
npm run dev
  -> scripts/dev.mjs sets IMA2_DEV=1
  -> ui build gets VITE_IMA2_DEV=1
  -> config.features.cardNews = true
  -> ENABLE_CARD_NEWS_MODE = true
```

일반 `ima2 serve` 또는 npm global 설치 runtime에서는 Card News tab과 `/api/cardnews/*` route가 노출되지 않아야 한다.

If `ima2.uiMode` in localStorage is `"card-news"` while the gate is off, the app must fall back to Classic mode instead of rendering Node mode by accident.

## Workspace Layout

```text
Left rail            Center stage              Right inspector
──────────────────────────────────────────────────────────────
Template picker      Focused card preview       Card copy
Card list            JSON-backed card view      Visual prompt
Reorder              Generate/regenerate        Lock / status
Lock badges          Batch status               Export options
```

## Codex Planner

Planner는 바로 이미지 생성을 호출하지 않는다. JSON만 만든다.

입력:

```json
{
  "imageTemplate": "...",
  "roleNodeTemplate": "...",
  "contentBrief": "...",
  "references": ["ref1", "ref2"],
  "size": "2048x2048"
}
```

출력:

```json
{
  "title": "...",
  "cards": [
    {
      "order": 1,
      "role": "cover",
      "headline": "...",
      "body": "...",
      "visualPrompt": "...",
      "templateSlotAssignments": {
        "title": "headline",
        "body": "body",
        "image": "visual"
      },
      "references": ["ref1"],
      "locked": false
    }
  ]
}
```

Validation:

- 카드 수가 role node template과 일치해야 한다.
- 모든 required role이 있어야 한다.
- `visualPrompt`는 image template stylePrompt와 합쳐도 4000자 이하로 유지한다.
- `headline`은 한글 24자 정도를 넘으면 warning.
- `body`는 MVP에서 이미지에 직접 넣지 않고 manifest/UI에 보관한다.

## Generation Flow

기본 생성은 순차 i2i가 아니라 병렬 template-guided i2i다.

```text
CardNewsPlan JSON
      ↓
공통 image template base image
      ↓
카드별 role + visualPrompt + short headline hint
      ↓
각 카드 독립 요청
      ↓
동시성 제한 안에서 병렬 생성
```

카드별 요청은 같은 template asset을 참조하지만 서로의 생성 결과에는 의존하지 않는다.

```text
card 1 + template base → generate
card 2 + template base → generate
card 3 + template base → generate
```

기본값으로 피해야 하는 흐름:

```text
card 1 결과 → card 2 입력 → card 3 입력
```

이 순차 chain은 느리고, 앞 카드의 실패나 어색함이 뒤 카드로 전파된다. 0.20에서는 `Continuity mode`라는 고급 옵션 후보로만 남긴다.

## `+ New Image Template`

0.20 MVP에서는 실제 user-created template 저장을 구현하지 않는다. 이 메뉴는 disabled placeholder로 노출하거나 숨긴다. 실제 template generation, metadata 저장, slot editing, overwrite policy는 0.21로 보류한다.

사용자 입력:

```text
템플릿 목적
톤/업종
색감
텍스트 위치
이미지 위치
금지할 스타일
크기
```

생성 결과:

```text
preview image
base image
stylePrompt
negativePrompt
slot preset
recommended role node templates
```
