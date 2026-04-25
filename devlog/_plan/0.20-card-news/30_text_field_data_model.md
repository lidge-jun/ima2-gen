# 30 Text Field Data Model

## Problem

The current Card News card model has only:

```text
headline
body
visualPrompt
```

This is not enough. `headline` and `body` are review/manifest copy, while the image model needs a separate list of text items that should actually appear inside the generated card.

Current risk:

- role labels such as `cta` can leak into visible design text
- title/body copy is mixed with visual design instructions
- there is no way to say "put this text at top-right"
- the frontend can only show raw textareas

## Decision

Add a structured `textFields` model. `headline` and `body` remain for UI summary and gallery/search.

Precise semantics:

```text
textFields = card text-box objects
textFields with renderMode="in-image" = the only readable text intended inside the generated image
textFields with renderMode="ui-only" = planner/user notes for UI review, not rendered into the image
headline/body = summary copy for inspector, gallery, search, and quick review
role = structural label only, never visible image text
```

## Proposed Types

```ts
type CardNewsTextPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "free";

type CardNewsTextKind =
  | "headline"
  | "body"
  | "caption"
  | "cta"
  | "badge"
  | "number";

type CardNewsRenderMode = "in-image" | "ui-only";

type CardNewsTextField = {
  id: string;
  kind: CardNewsTextKind;
  text: string;
  renderMode: CardNewsRenderMode;
  placement: CardNewsTextPlacement;
  slotId: string | null;
  hierarchy: "primary" | "secondary" | "supporting";
  maxChars: number | null;
  language: string | null;
  source: "planner" | "user";
};
```

`CardNewsCard` becomes:

```ts
type CardNewsCard = {
  id: string;
  order: number;
  role: string;
  headline: string;
  body: string;
  visualPrompt: string;
  textFields: CardNewsTextField[];
  templateSlotAssignments?: Record<string, string>;
  references: string[];
  locked: boolean;
  status: CardNewsCardStatus;
};
```

`templateSlotAssignments` remains an optional legacy field for stored plans. New text placement uses `textFields[].slotId` as the canonical mapping.

## Diff-Level Plan

### MODIFY `lib/cardNewsPlannerSchema.js`

- Add `textFields` to each card in `CARD_NEWS_PLANNER_SCHEMA`.
- Keep `additionalProperties: false`.
- Allow `textFields` to be an empty array.
- Use Structured Outputs-compatible strict schema. Optional text field values are represented as required nullable properties, not omitted properties.
- Validate:
  - `id` string
  - `kind` enum
  - `text` string
  - `renderMode` enum
  - `placement` enum
  - `slotId` string or null
  - `hierarchy` enum
  - `maxChars` number or null
  - `language` string or null
  - `source` enum

Required schema shape for each text field:

```js
required: [
  "id",
  "kind",
  "text",
  "renderMode",
  "placement",
  "slotId",
  "hierarchy",
  "maxChars",
  "language",
  "source",
]
```

`validatePlannerOutput()` must use the same contract. `repairPlannerOutput()` must normalize malformed or missing arrays to `textFields: []`.

### MODIFY `ui/src/lib/cardNewsApi.ts`

- Add exported `CardNewsTextField` type.
- Add `textFields: CardNewsTextField[]` to `CardNewsCard`.
- Replace `ImageTemplate.slots: Array<Record<string, unknown>>` later in doc 34.

Add frontend normalizers:

```ts
export function normalizeCardNewsCard(card: CardNewsCard): CardNewsCard {
  return {
    ...card,
    textFields: Array.isArray(card.textFields) ? card.textFields : [],
  };
}

export function normalizeCardNewsPlan(plan: CardNewsPlan): CardNewsPlan {
  return {
    ...plan,
    cards: plan.cards.map(normalizeCardNewsCard),
  };
}
```

Use `normalizeCardNewsPlan()` on every full-plan ingress:

```text
draftCardNews response
getCardNewsSet/loadSet response
```

Use conservative card merge for partial job/retry cards:

```ts
textFields: Array.isArray(next.textFields) ? next.textFields : previous.textFields
```

### MODIFY `lib/cardNewsPlanner.js`

- Ensure `CardNewsPlan.cards[].textFields` always exists.
- For legacy/fallback planner output, create `textFields: []`.
- Do not derive visible text from role ids.
- Keep optional legacy `templateSlotAssignments` only when already present; do not create new visible text from it.

### MODIFY `lib/cardNewsManifestStore.js`

- Persist `textFields` in sidecar and set manifest.
- Hydrate legacy sets without `textFields` as `textFields: []`.

### MODIFY `routes/cardNews.js`

- Include `textFields` in job summary card patches.
- `onCardDone` must pass `textFields: Array.isArray(card.textFields) ? card.textFields : []`.

### MODIFY `lib/cardNewsJobStore.js`

- Preserve `textFields` if a patch includes it.
- Never replace an existing card's `textFields` with `undefined` from a partial patch.

### MODIFY `tests/card-news-contract.test.js`

Add coverage:

- planner schema accepts valid `textFields`
- invalid placement is rejected/repaired
- legacy card without `textFields` hydrates with `[]`
- job polling summary preserves `cards[].textFields`
- role ids such as `cta` are never auto-promoted into `textFields`

## Non-Goals

- This does not implement a full Canva-style drag editor.
- This does not guarantee perfect OCR-quality text rendering.
- This is a planner/generator/frontend contract so the next UI can reason about text boxes.
