# 33 Frontend Text Box UX

## Problem

The current Card News frontend still looks like raw data editing:

```text
headline input
body textarea
visualPrompt textarea
```

The stage also shows a simple copy block, not editable card text boxes. This makes it hard to understand what will be visible inside the generated card.

## Decision

Card News needs a text-box editing surface, not just raw prompt fields.

The UI should separate:

```text
Card copy summary
Visible text fields
Visual/design prompt
Generated result actions
```

## Diff-Level Plan

### NEW `ui/src/components/card-news/TextFieldCard.tsx`

Displays one `CardNewsTextField`.

Required UI:

- kind chip: headline/body/cta/badge/number
- placement chip: top-right, bottom-center, etc.
- render mode badge: in-image / ui-only
- editable text input or compact textarea
- character count against `maxChars`
- lock/read-only state

Props:

```ts
type TextFieldCardProps = {
  field: CardNewsTextField;
  locked: boolean;
  onChange: (patch: Partial<CardNewsTextField>) => void;
  onRemove?: () => void;
};
```

Interaction rules:

```text
kind: select/menu from CardNewsTextKind
placement: select/menu using localized placement labels
renderMode: segmented toggle, in-image/ui-only
text: input for short text, textarea when maxChars is null or above 80
on any user edit: source becomes "user"
locked card: all controls disabled
maxChars exceeded: show warning, do not silently truncate
```

### NEW `ui/src/components/card-news/PlacementBadge.tsx`

Small presentational component for placement labels.

Example labels:

```text
좌측 상단
상단 중앙
우측 상단
중앙
하단 중앙
```

English i18n:

```text
Top-left
Top-center
Top-right
Center
Bottom-center
```

### MODIFY `ui/src/components/card-news/CardInspector.tsx`

Current structure:

```text
Headline
Body copy
Image prompt
```

New structure:

```text
Card summary
  headline
  body

Visible text boxes
  TextFieldCard[]

Scene / design prompt
  visualPrompt

Generation metadata
  filename/status/revised prompt if any
```

Rules:

- `headline/body` are not labeled as image-rendered text.
- visible image text lives in `textFields`.
- users can change `placement`, `kind`, `renderMode`, and `text`.

### MODIFY `ui/src/store/cardNewsStore.ts`

Add explicit nested text field actions instead of making every component rebuild arrays:

```ts
updateTextField: (
  cardId: string,
  fieldId: string,
  patch: Partial<CardNewsTextField>,
) => void;

addTextField: (
  cardId: string,
  field: CardNewsTextField,
) => void;

removeTextField: (
  cardId: string,
  fieldId: string,
) => void;
```

Rules:

```text
updateTextField sets source="user" for user edits unless patch.source is explicitly provided.
locked cards ignore edit actions.
partial job summaries must preserve existing textFields when omitted.
retry/generated card merges must preserve existing textFields when omitted.
```

Add a stable empty array constant for selectors that need fallback arrays:

```ts
const EMPTY_TEXT_FIELDS: CardNewsTextField[] = [];
```

Do not use fresh `?? []` arrays inside Zustand selectors.

### MODIFY `ui/src/components/card-news/CardStage.tsx`

Add overlay guide when no generated image or when reviewing draft:

```text
[top-right] headline text
[bottom-center] CTA text
```

For generated images:

- show generated image as primary
- show text field list below or beside it
- preserve result actions: copy prompt, copy copy, open, download

Positioning rules:

```text
CardStage reads templates from useCardNewsStore.
If textField.slotId matches selectedTemplate.slots[].id, position by normalized slot x/y/w/h.
If no matching slot exists, position by placement enum with CSS classes.
Generated image remains primary.
Overlay guide is shown for draft/no-url cards by default.
For generated cards, overlay guide is hidden by default and can be enabled later by a text guide toggle.
```

Copy action behavior:

```text
Copy prompt: copies visualPrompt only.
Copy copy: copies headline/body plus visible in-image textFields grouped by placement.
Copy visible text: optional follow-up; not required in this phase.
```

### MODIFY `ui/src/components/card-news/CardDeckRail.tsx`

Avoid raw role-only display.

Use:

```text
01 Cover
중간고사 역전 플랜
status badge
```

Role labels should be localized display labels, not raw schema strings.

Add role label helper:

```ts
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function roleLabel(role: string, t: TranslateFn): string {
  const key = `cardNews.roles.${role}`;
  const label = t(key);
  return label === key ? role : label;
}

function placementLabel(placement: CardNewsTextPlacement, t: TranslateFn): string {
  const key = `cardNews.placements.${placement}`;
  const label = t(key);
  return label === key ? placement : label;
}
```

Deck item display:

```text
01 Localized role label
headline snippet or first in-image text field snippet
status badge
```

### MODIFY `ui/src/index.css`

Add styles:

```css
.card-news-text-field-card
.card-news-placement-chip
.card-news-render-mode
.card-news-stage-overlay
.card-news-copy-panel
.card-news-field-list
.card-news-stage-overlay__field
.card-news-stage-overlay__field--top-left
.card-news-stage-overlay__field--top-center
.card-news-stage-overlay__field--top-right
.card-news-stage-overlay__field--center-left
.card-news-stage-overlay__field--center
.card-news-stage-overlay__field--center-right
.card-news-stage-overlay__field--bottom-left
.card-news-stage-overlay__field--bottom-center
.card-news-stage-overlay__field--bottom-right
```

Constraints:

- no nested cards inside cards
- compact dense tool UI, not landing-page layout
- text must fit in inspector and narrow sidebar
- touch targets at least 44px where interactive

### MODIFY `ui/src/i18n/ko.json`

Add:

```json
{
  "cardNews": {
    "textFields": "텍스트 박스",
    "textKinds": {
      "headline": "제목",
      "body": "본문",
      "caption": "캡션",
      "cta": "행동 유도",
      "badge": "배지",
      "number": "숫자"
    },
    "renderModes": {
      "in-image": "이미지에 표시",
      "ui-only": "메모만"
    },
    "hierarchy": {
      "primary": "주요",
      "secondary": "보조",
      "supporting": "부가"
    },
    "placements": {
      "top-left": "좌측 상단",
      "top-center": "상단 중앙",
      "top-right": "우측 상단",
      "center-left": "좌측 중앙",
      "center": "중앙",
      "center-right": "우측 중앙",
      "bottom-left": "좌측 하단",
      "bottom-center": "하단 중앙",
      "bottom-right": "우측 하단",
      "free": "직접 지정"
    },
    "roles": {
      "cover": "표지",
      "hook": "후킹",
      "problem": "문제",
      "insight": "인사이트",
      "example": "예시",
      "data": "데이터",
      "summary": "요약",
      "cta": "행동 유도"
    }
  }
}
```

Add equivalent English `cardNews.textKinds.*`, `cardNews.renderModes.*`, `cardNews.hierarchy.*`, `cardNews.placements.*`, and `cardNews.roles.*` labels.

### MODIFY `tests/card-news-frontend-contract.test.js`

Add contract checks:

- `TextFieldCard.tsx` exists
- `CardInspector` renders text field editor
- `CardStage` renders overlay guide from `textFields`
- raw-only `headline/body/visualPrompt` stack is no longer the whole inspector
- placement i18n keys exist
- store exposes `updateTextField`, `addTextField`, and `removeTextField`
- user edits set `source: "user"`
- locked cards disable text field controls
- role i18n keys exist in `ko.json` and `en.json`

## Screenshot Diagnosis

The current screenshot shows the left composer and template picker working, but the main workspace remains empty/raw until draft. The next UI phase should make text boxes visible as first-class objects immediately after draft generation.
