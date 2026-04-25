# 31 Language Preservation Policy

## Problem

The current planner prompt only says:

```text
Keep Korean copy in Korean when the user brief is Korean.
```

That is too narrow. The user wants the card news planner to preserve whatever language the user used, not force English and not rely on Korean-only special cases.

Important constraint:

```text
System/developer-level prompts must stay in English.
```

Language preservation applies to user-facing card copy and visible text, not to the internal system/developer prompt language.

The deterministic fallback also has Korean hardcoded phrases such as:

```text
다음 행동
왜 중요한가
핵심 인사이트
예시로 보기
숫자로 확인
요약
```

This can produce Korean fallback copy even when the user wrote in English or another language.

## Decision

Use English for system/developer-level instructions, and input-language preservation for generated card copy.

```text
Write system/developer planner instructions in English.
Preserve the user's original language for visible copy.
Do not translate unless the user explicitly asks.
Keep brand names, product names, quoted text, and mixed-language phrases unchanged.
```

## Diff-Level Plan

### MODIFY `lib/cardNewsPlannerPrompt.js`

Keep the prompt body itself in English. Replace the Korean-only rule with English system-level instructions:

```text
Preserve the user's original language for headline, body, and textFields.
Do not translate to English unless explicitly requested.
Role names such as cover/problem/cta are structural labels, not visible design text.
Only textFields[].text with renderMode="in-image" is intended to appear inside the image.
visualPrompt must describe scene, layout, style, and spatial composition only.
visualPrompt must not duplicate visible text unless referencing text box placement.
```

Add input guidance:

```text
If the user writes in Korean, write Korean copy.
If the user writes in English, write English copy.
If the user mixes languages, preserve the mix.
If the user provides exact text, preserve it exactly.
```

### MODIFY `lib/cardNewsPlanner.js`

- Remove Korean-only fallback strings from `headlineFor()` and `bodyFor()`.
- Add a small language hint helper:

```js
function detectBriefLanguage(input) {
  const text = [input.topic, input.audience, input.goal, input.contentBrief].filter(Boolean).join(" ");
  if (/[가-힣]/.test(text)) return "ko";
  if (/[A-Za-z]/.test(text)) return "en";
  return "und";
}
```

- Use language-aware fallback packs:
  - `ko`: Korean fallback labels
  - `en`: English fallback labels
  - `und`: neutral short labels from the user topic, not role ids

### MODIFY `lib/cardNewsPlannerSchema.js`

The repair path must follow the same language policy. It currently repairs missing fields from `role.role` and `role.promptHint`, but role hints are internal English planning hints.

Rules:

```text
role.role and role.promptHint may be used for role and visualPrompt only.
role.role and role.promptHint must not become user-facing headline/body/textFields[].text.
repairPlannerOutput() must create textFields: [] when visible text cannot be repaired safely.
normalizeCard() fallback headline/body must come from input topic/goal/content brief or a language-aware fallback pack.
```

Required repair behavior:

```text
Korean input + missing body -> Korean fallback or brief-derived Korean text
English input + missing body -> English fallback or brief-derived English text
unknown language + missing body -> topic-derived neutral copy, not role.promptHint
missing textFields -> []
invalid textFields -> repaired valid fields or []
```

### MODIFY `ui/src/store/cardNewsStore.ts`

- Optionally pass `languageHint` from the brief to `/api/cardnews/draft`.
- If omitted, backend detects language.

### MODIFY `ui/src/lib/cardNewsApi.ts`

- Add optional `languageHint?: string` to `draftCardNews()` payload only if backend needs explicit UI control.

### MODIFY `tests/card-news-contract.test.js`

Add tests:

- planner system/developer prompt remains English
- Korean brief returns Korean `headline/body/textFields`.
- English brief does not return Korean fallback labels.
- Mixed-language brand terms are preserved.
- `visualPrompt` is not forced to English.
- exact user-provided quoted text remains unchanged.
- repair path never promotes English `role.promptHint` into `headline/body/textFields[].text`
- missing or invalid `textFields` repairs to `[]` rather than generated English filler

## UX Copy Rule

Frontend labels can remain localized through i18n. Planner-produced card copy must follow the user's brief language, not the app UI language.
