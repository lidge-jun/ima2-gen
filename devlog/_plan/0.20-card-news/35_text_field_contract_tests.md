# 35 Text Field Contract Tests

## Purpose

The 30-series changes affect planner schema, generator prompt assembly, manifest persistence, frontend editing, and template metadata. They need explicit contract tests before implementation is considered done.

## Backend Tests

### MODIFY `tests/card-news-contract.test.js`

Add tests for planner schema:

```text
planner accepts textFields with valid placement/renderMode/kind
planner rejects or repairs invalid placement
planner repairs missing textFields to []
planner does not promote role ids into visible text
strict JSON schema uses required nullable slotId/maxChars/language fields
repair path does not use role.promptHint as headline/body/textFields text
```

Add tests for language policy:

```text
Korean brief preserves Korean copy
English brief does not produce Korean fallback copy
Mixed-language brand names are preserved
visualPrompt is not forced to English
```

Add tests for generator prompt:

```text
assemblePrompt no longer emits "Rendered headline:"
assemblePrompt emits exact textFields text and placement
assemblePrompt test injects an explicit textFields fixture before generation
empty textFields emits "Do not render readable text"
ui-only text fields are not rendered
role labels are not rendered unless explicitly listed in textFields
```

Add tests for persistence:

```text
sidecar stores textFields
manifest stores textFields
GET /api/cardnews/sets/:setId returns plan.cards[].textFields
legacy card without textFields hydrates with []
job polling summary preserves cards[].textFields
onCardDone includes textFields in generated card patch
```

## Frontend Tests

### MODIFY `tests/card-news-frontend-contract.test.js`

Add tests:

```text
TextFieldCard component exists
CardInspector imports/renders TextFieldCard
CardStage renders draft overlay guide from textFields
CardDeckRail shows localized role label and headline snippet
CardNewsCard type includes textFields
placement/renderMode i18n keys exist in ko/en
all placement enum values have ko/en labels
all text kind enum values have ko/en labels
all render mode enum values have ko/en labels
all hierarchy enum values have ko/en labels
roleLabel helper matches current i18n API and does not use unsupported defaultValue option
normalizeCardNewsPlan exists
draft() stores normalizeCardNewsPlan(plan)
loadSet() stores normalizeCardNewsPlan(plan)
applyJobSummary preserves card.textFields when summary card omits textFields
mergeGeneratedCard preserves card.textFields when generated card omits textFields
store exposes updateTextField/addTextField/removeTextField
TextFieldCard user edit sets source to "user"
locked TextFieldCard controls are disabled
TextFieldCard selectors avoid fresh [] or object literals in Zustand selectors
copy-copy action includes headline/body plus in-image textFields
```

## Template Tests

### MODIFY `tests/card-news-contract.test.js`

Add tests:

```text
all built-in image templates include labeled slots
legacy slot kind title/body/cta/image migrates to normalized slot kind/textKind
slot placement values are valid enum values
text slots define maxChars
public template API exposes typed slot metadata
template store normalizes slots before publicTemplate and template base usage
```

## Regression Tests To Remove Or Replace

Replace any test that expects:

```text
Rendered headline:
```

Reason: automatic headline rendering is the current bug. Visible text must come from `textFields`.

## Required Verification

After implementation:

```bash
node --test tests/card-news-contract.test.js tests/card-news-frontend-contract.test.js
npm run build
npm test
```

If CI is run, Windows matrix must pass because previous CI failures appeared only on Windows.
