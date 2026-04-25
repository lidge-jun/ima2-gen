# 32 Rendered Text Prompting

## Problem

Current generation prompt assembly does this:

```js
template.stylePrompt
card.visualPrompt
Rendered headline: ${card.headline}
```

This makes `headline` automatically visible in the image. It also leaves no clear way to specify multiple text boxes, placement, hierarchy, or body/CTA rendering.

## Decision

Visible image text must come only from `textFields` with `renderMode: "in-image"`.

`headline` and `body` are UI/manifest summary fields. They are not automatically rendered.

## Diff-Level Plan

### MODIFY `lib/cardNewsGenerator.js`

Replace `assemblePrompt()` with a prompt builder that separates:

```text
1. template style
2. visual scene/layout prompt
3. explicit text fields
4. negative prompt
```

Proposed helper:

```js
function formatRenderedTextInstruction(textFields = []) {
  const visible = textFields.filter((field) => field.renderMode === "in-image" && field.text);
  if (!visible.length) {
    return [
      "Do not render readable text unless explicitly listed.",
      "Do not render role labels, schema keys, placeholder labels, or untranslated summaries.",
    ].join("\\n");
  }

  return [
    "Render only the following readable text items exactly as written:",
    ...visible.map((field) =>
      `- ${field.kind} at ${field.placement}${field.slotId ? ` in slot ${field.slotId}` : ""}: \"${field.text}\"`
    ),
    "Preserve the language and spelling of every listed text item.",
    "Do not render role labels, schema keys, placeholder labels, or extra text.",
  ].join("\\n");
}
```

New `assemblePrompt()`:

```js
function assemblePrompt(template, card) {
  return [
    template.stylePrompt,
    card.visualPrompt,
    formatRenderedTextInstruction(card.textFields),
    template.negativePrompt ? `Avoid: ${template.negativePrompt}` : "",
  ].filter(Boolean).join("\\n");
}
```

### MODIFY sidecar write in `lib/cardNewsGenerator.js`

Persist:

```js
textFields: Array.isArray(card.textFields) ? card.textFields : []
```

### MODIFY `tests/card-news-contract.test.js`

Replace current assertion:

```js
assert.match(calls[0].prompt, /Rendered headline:/);
```

with:

```js
assert.doesNotMatch(calls[0].prompt, /Rendered headline:/);
assert.match(calls[0].prompt, /Render only the following readable text items exactly as written/);
assert.match(calls[0].prompt, /top-right/);
assert.match(calls[0].prompt, /중간고사/);
```

The test must inject an explicit text-field fixture before generation. Do not rely on the default deterministic draft to contain visible text:

```js
plan.cards[0] = {
  ...plan.cards[0],
  textFields: [{
    id: "tf_1",
    kind: "headline",
    text: "중간고사 역전 플랜",
    renderMode: "in-image",
    placement: "top-right",
    slotId: null,
    hierarchy: "primary",
    maxChars: 24,
    language: "ko",
    source: "planner",
  }],
};
```

Add tests:

- no `textFields` means no readable text instruction
- empty `textFields: []` emits "Do not render readable text" and no visible text list
- `renderMode: "ui-only"` is not rendered
- role `cta` is not rendered unless a text field explicitly contains `cta`
- exact Korean text is preserved
- exact English text is preserved

## Prompt Contract

Generator prompt must not say:

```text
Rendered headline
Rendered body
CTA card
Use the role as text
```

Generator prompt may say:

```text
headline at top-right: "..."
cta at bottom-center: "..."
badge at top-left: "..."
```

## Non-Goals

- This is not a guarantee that the image model renders every character perfectly.
- Real deterministic text overlay remains a later phase.
- This phase only makes intent explicit and testable.
