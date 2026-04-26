# 40 Smoke QA Harness

## Purpose

30~35에서 Card News text field 계약을 고쳤으므로, 다음 단계는 실제 wiring이 깨지지 않는지 확인하는 smoke safety net이다.

40은 production behavior를 바꾸지 않는다. 실제 OAuth/image generation도 호출하지 않는다.

## Scope

- Card News mode wiring
- template hydrate/list wiring
- draft entry wiring
- batch job source wiring
- job polling source wiring
- generated card stage/deck surface wiring
- retry entry wiring
- gallery set reopen wiring
- manual QA checklist

## Hard constraints

- Do not HTTP-call `POST /api/cardnews/jobs`.
- Do not HTTP-call `POST /api/cardnews/generate`.
- Do not HTTP-call `POST /api/cardnews/cards/:cardId/regenerate`.
- Do not use browser automation in 40.
- Use source-contract tests or unit-level tests only.

Reason: the job/generate/regenerate routes can start real generation through `generateViaOAuth` unless a mock seam is explicitly provided.

## Implementation plan

### NEW `tests/card-news-smoke.test.js`

Use the same source-contract pattern as existing frontend contract tests.

Assert current anchors only:

- `ui/src/lib/cardNewsApi.ts`
  - `listCardNewsImageTemplates`
  - `listCardNewsRoleTemplates`
  - `draftCardNews`
  - `startCardNewsJob`
  - `getCardNewsJob`
  - `getCardNewsSet`
  - `regenerateCardNewsCard`
- `ui/src/store/cardNewsStore.ts`
  - `async hydrate()`
  - `async draft()`
  - `generateSet`
  - `applyJobSummary`
  - `retryCard`
  - `loadSet`
- `routes/cardNews.js`
  - `app.post("/api/cardnews/draft"`
  - `app.post("/api/cardnews/jobs"`
  - `app.get("/api/cardnews/jobs/:jobId"`
  - `app.get("/api/cardnews/sets/:setId"`
- `ui/src/components/card-news/CardNewsWorkspace.tsx`
  - `ImageTemplatePicker`
  - `RoleTemplatePicker`
  - `CardStage`
  - `CardInspector`
- `ui/src/components/card-news/CardNewsComposer.tsx`
  - store action `draft`
  - store action `generateSet`
- `ui/src/components/card-news/CardStage.tsx`
  - `card-news-stage-overlay`
  - `renderMode === "in-image"`
  - `card.url`
  - `retryCard(card.id)`
- `ui/src/components/card-news/CardDeckRail.tsx`
  - generated thumbnail through `card.url`
  - `CardStatusBadge`
- `ui/src/components/card-news/CardNewsBatchBar.tsx`
  - `summary.queued`
  - `summary.errors`
  - `summary.skipped`
- `ui/src/components/card-news/CardStatusBadge.tsx`
  - `display === "queued" || display === "generating"`
  - `card-news-spinner`
- `ui/src/components/card-news/CardInspector.tsx`
  - `TextFieldCard`
  - `retryCard(card.id)`
- `ui/src/components/GalleryModal.tsx`
  - `handleOpenCardNewsSet`
  - `loadSet(item.setId)`
  - `setUIMode("card-news")`
  - `item.kind === "card-news-set"`

### MODIFY `tests/card-news-contract.test.js`

Add only missing unit-level smoke assertions if needed:

- skipped cards are represented through `job.cards[].status`
- reopened set plans preserve `textFields`
- manifest contains set-level metadata required by Gallery

Do not call generation routes over HTTP.

### MODIFY `devlog/_plan/0.20-card-news/40_smoke_qa_harness.md`

After implementation, add:

- implemented smoke coverage
- manual QA checklist
- known exclusions
- verification results

## Manual QA checklist

```text
1. npm run dev
2. Card News tab open
3. Draft outline
4. Verify textFields are visible
5. Batch generate
6. Verify queued/generating/generated states
7. Retry failed card
8. Open Gallery
9. Reopen card-news set
```

## Done criteria

- `tests/card-news-smoke.test.js` passes.
- focused Card News tests pass.
- full test suite passes.
- production code remains unchanged unless smoke exposes a real wiring bug.

## Implemented smoke coverage

Implemented in `tests/card-news-smoke.test.js`.

Coverage:

- API client template/draft/job/retry/set wiring
- Card News store hydrate/draft/generate/poll/retry/load wiring
- app-level Card News route anchors
- workspace template picker/stage/inspector surfaces
- composer draft/generate buttons
- stage generated image and text field overlay anchors
- deck thumbnail/status badge anchors
- batch bar queued/error/skipped summary anchors
- queued/generating spinner anchor
- inspector text field and retry anchors
- Gallery set reopen to Card News mode
- manual smoke checklist and no-live-generation constraints

## Known exclusions

- no OAuth call
- no image generation call
- no HTTP call to generation-starting Card News routes
- no browser automation
- no npm package runtime verification

## Verification results

To verify this phase:

```bash
node --test tests/card-news-smoke.test.js
node --test tests/card-news-smoke.test.js tests/card-news-contract.test.js tests/card-news-frontend-contract.test.js tests/config.test.js
npm test
npm run build
git diff --check
```
