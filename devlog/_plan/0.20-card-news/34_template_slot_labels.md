# 34 Template Slot Labels

## Problem

Image template slots currently describe geometry, but not enough semantic placement information for planner/generator/frontend.

Existing slots are roughly:

```json
{ "id": "...", "kind": "...", "x": 0, "y": 0, "w": 100, "h": 100, "required": true }
```

This does not tell the planner:

- this is the top-right headline slot
- this slot should hold a CTA
- this slot has a short max text length
- this slot is safe for text

## Decision

Upgrade template slots into labeled, typed slot metadata.

## Proposed Slot Shape

```ts
type ImageTemplateSlot = {
  id: string;
  kind: "image" | "text" | "mixed" | "safe-area";
  label: string;
  placement: CardNewsTextPlacement;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  textKind?: CardNewsTextKind;
  maxChars?: number;
  safeArea?: boolean;
};
```

## Diff-Level Plan

### MODIFY `assets/card-news/templates/*/template.json`

For every built-in template slot, add:

```json
{
  "label": "Top-right headline",
  "placement": "top-right",
  "textKind": "headline",
  "maxChars": 24,
  "safeArea": true
}
```

For visual-only slots:

```json
{
  "label": "Main visual area",
  "placement": "center",
  "safeArea": false
}
```

Migration rule for existing built-in templates:

```text
old kind "title" -> kind "text", textKind "headline"
old kind "body"  -> kind "text", textKind "body"
old kind "cta"   -> kind "text", textKind "cta"
old kind "image" -> kind "image"
```

Edit the built-in JSON files in place for the dev MVP. Also keep read-time normalization in `lib/cardNewsTemplateStore.js` so older/user templates do not break.

### MODIFY `lib/cardNewsTemplateStore.js`

- Normalize slot shape.
- Normalize legacy slot kinds before public API exposure.
- Validate `placement` enum.
- Validate coordinates remain numbers.
- Fill safe defaults for legacy slots:
  - `label: slot.id`
  - `placement: "free"`
  - `safeArea: false`

Required helper behavior:

```js
function normalizeSlot(slot) {
  const legacy = normalizeLegacySlotKind(slot.kind);
  return {
    ...slot,
    kind: legacy.kind,
    textKind: slot.textKind || legacy.textKind || null,
    label: slot.label || slot.id,
    placement: isPlacement(slot.placement) ? slot.placement : "free",
    maxChars: Number.isFinite(slot.maxChars) ? slot.maxChars : null,
    safeArea: Boolean(slot.safeArea),
  };
}
```

`publicTemplate()` must return normalized slots only. `readTemplateBaseB64()` may keep the full template object but its `template.slots` should also be normalized before prompt assembly.

### MODIFY `ui/src/lib/cardNewsApi.ts`

- Add `ImageTemplateSlot` type.
- Change:

```ts
slots: Array<Record<string, unknown>>;
```

to:

```ts
slots: ImageTemplateSlot[];
```

### MODIFY `ui/src/components/card-news/ImageTemplatePicker.tsx`

- Show template preview.
- Show slot count and key labels.
- Do not expose raw JSON.

### MODIFY `lib/cardNewsPlannerPrompt.js`

Pass labeled slots to planner:

```json
{
  "slots": [
    {
      "id": "headline_top_right",
      "label": "Top-right headline",
      "placement": "top-right",
      "textKind": "headline",
      "maxChars": 24
    }
  ]
}
```

Planner should map `textFields[].slotId` to these slot ids when useful.

`textFields[].slotId` is the canonical new mapping. `templateSlotAssignments` remains optional legacy metadata only.

### MODIFY `tests/card-news-contract.test.js`

Add tests:

- all built-in templates have placement labels
- template store rejects invalid placement
- planner input includes slot labels
- generated text field can reference slot id

## Non-Goals

- No visual safe-area editor yet.
- No template designer yet.
- Only built-in template metadata gets upgraded in this phase.
