# 13 Codex Planner JSON Output

> 상태: 확정 계획
> 범위: Card News 초안을 deterministic scaffold가 아니라 schema-validated planner JSON으로 만든다.

## 감사 반영

기존 문서는 planner transport를 열어뒀다. 0.21 계획에서는 아래로 확정한다.

```text
Primary: text-only OpenAI Responses adapter with Structured Outputs when available
Fallback: chat-completions JSON mode + local schema validation + one repair pass
Disabled fallback: deterministic scaffold only when config explicitly allows it
```

Codex CLI wrapper는 0.21에서 사용하지 않는다. 이유는 dev server 안에서 timeout, stderr, process lifecycle, install path를 추가로 풀어야 해서 MVP scope를 흐린다.

## 목표

`Draft outline`은 이미지를 만들지 않는다.

```text
Image Template metadata
Role Template
Output size
User brief
Reference role labels
  ↓
Planner text request
  ↓
Strict JSON
  ↓
Local validation/repair
  ↓
CardNewsPlan
```

## JSON Schema

### NEW `lib/cardNewsPlannerSchema.js`

Exports:

```js
export const CARD_NEWS_PLANNER_SCHEMA = { ... };
export function validatePlannerOutput(output, roleTemplate) { ... }
export function repairPlannerOutput(output, input) { ... }
```

Validation result:

```ts
type PlannerValidationResult = {
  ok: boolean;
  plan?: CardNewsPlannerOutput;
  errors: string[];
  repaired: boolean;
};
```

Schema shape:

```ts
type CardNewsPlannerOutput = {
  title: string;
  topic: string;
  audience?: string;
  goal?: string;
  cards: Array<{
    order: number;
    role: string;
    headline: string;
    body: string;
    visualPrompt: string;
    references: string[];
    locked: false;
  }>;
};
```

Rules:

- `cards.length === selected role template.roles.length`
- `order` is 1-based consecutive
- `role` matches the selected role template order
- strings are trimmed
- unknown extra fields are ignored
- missing required card fields are repaired once from deterministic hints

## Backend Diff-Level Plan

### 1. NEW `lib/cardNewsPlannerPrompt.js`

Exports:

```js
export function buildCardNewsPlannerMessages(input) { ... }
```

Prompt rules:

- no `image_generation` instruction
- return JSON only
- preserve Korean copy when user brief is Korean
- keep `headline` and `body` as UI/manifest text, not text-to-render-inside-image instructions
- `visualPrompt` describes the image scene/layout only
- do not change card count or role order
- include selected output size as planning context

### 2. NEW `lib/cardNewsPlannerClient.js`

Exports:

```js
export async function requestCardNewsPlannerJson(input, options = {}) { ... }
```

Primary behavior:

- call local OAuth-compatible Responses endpoint
- request text-only output
- use strict structured output schema where supported
- do not include image tools
- timeout from config

Fallback behavior:

- if structured output is unavailable, use chat-completions JSON mode text request
- parse JSON locally
- no image files are written

Failure mapping:

```text
PLANNER_UPSTREAM_FAILED    -> 502
PLANNER_INVALID_JSON       -> 502
PLANNER_SCHEMA_INVALID     -> 422
PLANNER_UNAVAILABLE        -> 503
```

### 3. MODIFY `lib/cardNewsPlanner.js`

Current deterministic draft becomes fallback helper.

New flow:

```text
createCardNewsDraft(input)
  ↓
load image template + role template
  ↓
requestCardNewsPlannerJson()
  ↓
validatePlannerOutput()
  ↓
repairPlannerOutput() once if needed
  ↓
convert to CardNewsPlan with setId and statuses
```

Return shape:

```ts
{
  plan: CardNewsPlan,
  planner: {
    mode: "structured-output" | "json-mode" | "deterministic-fallback",
    model: string,
    repaired: boolean
  }
}
```

### 4. MODIFY `routes/cardNews.js`

`POST /api/cardnews/draft` returns:

```json
{
  "plan": {},
  "planner": {
    "mode": "structured-output",
    "model": "gpt-5.4-mini",
    "repaired": false
  }
}
```

Error behavior:

- upstream/network/model error: `502 PLANNER_UPSTREAM_FAILED`
- invalid JSON after one repair: `502 PLANNER_INVALID_JSON`
- schema mismatch after one repair: `422 PLANNER_SCHEMA_INVALID`
- deterministic fallback only if config flag is enabled

### 5. MODIFY `config.js`

Add:

```js
cardNewsPlanner: {
  enabled: process.env.IMA2_CARD_NEWS_PLANNER !== "0",
  model: process.env.IMA2_CARD_NEWS_PLANNER_MODEL || "gpt-5.4-mini",
  timeoutMs: Number(process.env.IMA2_CARD_NEWS_PLANNER_TIMEOUT_MS || 60000),
  deterministicFallback: process.env.IMA2_CARD_NEWS_PLANNER_FALLBACK === "1",
}
```

### 6. MODIFY `structure/03-server-api.md`

Document:

- `POST /api/cardnews/draft` response includes `planner`
- planner error codes
- no image generation side effects

## Frontend Diff-Level Plan

### 1. MODIFY `ui/src/lib/cardNewsApi.ts`

Change:

```ts
export type CardNewsPlannerMeta = {
  mode: "structured-output" | "json-mode" | "deterministic-fallback";
  model: string;
  repaired: boolean;
};

export function draftCardNews(...): Promise<{
  plan: CardNewsPlan;
  planner?: CardNewsPlannerMeta;
}>;
```

### 2. MODIFY `ui/src/store/cardNewsStore.ts`

Add state:

```ts
plannerMeta: CardNewsPlannerMeta | null;
draftError: string | null;
```

Draft behavior:

- on success: set `activePlan`, `selectedCardId`, `plannerMeta`
- on failure: set `draftError`, preserve existing `activePlan`
- do not write generated images

### 3. MODIFY `ui/src/components/card-news/CardNewsComposer.tsx`

Keep button copy:

```text
Draft outline / 초안 만들기
```

Add helper:

```text
Draft creates structured JSON only. Images are generated later.
```

### 4. NEW `ui/src/components/card-news/PlannerMetaBadge.tsx`

Display only when `plannerMeta` exists.

Examples:

```text
Structured JSON · gpt-5.4-mini
JSON repaired
Fallback scaffold
```

### 5. MODIFY `ui/src/components/card-news/CardStage.tsx`

Render `PlannerMetaBadge` near set title or empty-state helper.

### 6. MODIFY `ui/src/i18n/ko.json`, `ui/src/i18n/en.json`

Add:

```text
cardNews.planner.structured
cardNews.planner.jsonMode
cardNews.planner.repaired
cardNews.planner.fallback
cardNews.planner.jsonOnlyHelp
cardNews.planner.error
```

### 7. MODIFY `structure/04-frontend-architecture.md`

Add:

- `ui/src/lib/cardNewsApi.ts` to API client table
- `ui/src/store/cardNewsStore.ts` to state model table
- note that Card News mode is separate from Node graph
- note that Card News draft uses planner JSON, not image generation

## Tests

### MODIFY `tests/card-news-contract.test.js`

Add:

- planner request includes no `image_generation` tool.
- draft endpoint writes no PNG files.
- valid structured JSON becomes `CardNewsPlan`.
- role count mismatch repairs once.
- invalid unrepaired JSON returns `PLANNER_INVALID_JSON`.
- schema mismatch after repair returns `PLANNER_SCHEMA_INVALID`.
- deterministic fallback only works when config flag is enabled.

### MODIFY `tests/card-news-frontend-contract.test.js`

Add:

- `draftCardNews()` response type includes optional `planner`.
- `cardNewsStore` has `plannerMeta` and `draftError`.
- draft failure preserves existing `activePlan`.
- output size is included in draft payload.
- `PlannerMetaBadge.tsx` exists.
- old copy `Draft with Codex` does not appear.

## References From Audit

- OpenAI Structured Outputs: schema adherence is stronger than plain JSON mode.
- OpenAI streaming docs are not the planner path; planner is a text JSON request.
- Canva/Adobe template workflows: template-driven content planning should keep layout consistent while copy varies.
