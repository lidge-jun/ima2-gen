# Canvas Continue Prompt Block Diff Plan

## Goal

When the user clicks Continue Here from Canvas Mode, the app should reuse the existing Prompt Library insertion chip system instead of inventing a new hidden prompt path.

The resulting UX should be:

- Regular Continue Here keeps the existing inserted prompt chips.
- Canvas Mode Continue Here keeps existing inserted prompt chips and adds one stable `Canvas Mode` chip.
- The final generation prompt is assembled by the existing `composePrompt(mainPrompt, insertedPrompts)` path.

## Part 1: User-Level Behavior

The user edits or annotates an image in Canvas Mode, then clicks Continue Here.

The app should attach the current canvas-context image as a reference, restore the source prompt into the composer as it already does, and add a visible prompt chip titled `Canvas Mode`. That chip tells the generator how to interpret canvas edits:

- If the image is a blank white canvas or paper with user-drawn strokes, the strokes are source content and should be preserved/completed.
- If the image is an existing picture with circles, arrows, sticky notes, handwritten marks, or memos over it, those marks are edit instructions; apply them, then remove the marks from the final output unless explicitly requested.
- Preserve unrelated image content.

The chip should be removable like any other inserted prompt chip. It should not duplicate if the user clicks Continue Here repeatedly from Canvas Mode.

## Part 2: Diff-Level Plan

### MODIFY `ui/src/components/ResultActions.tsx`

#### Current state

`ResultActions` already accepts `imageOverride`, and Canvas Mode passes `canvasDisplayImage` through that prop:

```tsx
<ResultActions imageOverride={canvasOpen ? canvasDisplayImage : null} />
```

`newFromHere()` currently:

```ts
const newFromHere = async () => {
  const hasPrompt = Boolean(actionImage.prompt);
  if (hasPrompt) setPrompt(actionImage.prompt as string);
  try {
    await useImageAsReference(actionImage);
  } catch {
    // non-fatal - fall back to prompt-only fork
  }
  ...
};
```

#### Change

Add the existing store action:

```ts
const insertPromptToComposer = useAppStore((s) => s.insertPromptToComposer);
```

Add local constants near the component top or above the component:

```ts
const CANVAS_MODE_PROMPT_ID = "canvas-mode-context";
const CANVAS_MODE_PROMPT_NAME = "Canvas Mode";
const CANVAS_MODE_PROMPT_TEXT = [
  "Canvas Mode context:",
  "The user edited or annotated the reference image on a canvas.",
  "If the image is a blank white canvas or paper with user-drawn strokes, treat those strokes as source content and preserve/complete them.",
  "If the image is an existing picture with circles, arrows, sticky notes, handwritten marks, or memo notes over it, treat those marks as edit instructions. Apply the instruction, then remove the marks from the final image unless explicitly asked to keep them.",
  "Infer the intended edit from the canvas marks and memo text. Preserve unrelated image content.",
].join("\n");
```

Update `newFromHere()` after the optional `setPrompt(actionImage.prompt)` line and before focus/toast:

```ts
if (canvasOpen && imageOverride) {
  insertPromptToComposer({
    id: CANVAS_MODE_PROMPT_ID,
    name: CANVAS_MODE_PROMPT_NAME,
    text: CANVAS_MODE_PROMPT_TEXT,
  });
}
```

#### Expected result

For non-canvas Continue Here:

```text
No new Canvas Mode chip is inserted.
Existing insertedPrompts are preserved.
```

For Canvas Mode Continue Here:

```text
Existing insertedPrompts are preserved.
A single Canvas Mode chip is inserted.
Repeated clicks do not duplicate it because insertPromptToComposer dedupes by id.
```

### KEEP `ui/src/store/useAppStore.ts`

#### Current state

The inserted prompt infrastructure already exists:

```ts
type InsertedPrompt = {
  id: string;
  name: string;
  text: string;
};

function composePrompt(mainPrompt: string, insertedPrompts: InsertedPrompt[]): string {
  return [
    ...insertedPrompts.map((prompt) => prompt.text.trim()).filter(Boolean),
    mainPrompt.trim(),
  ].filter(Boolean).join("\n\n");
}
```

`insertPromptToComposer()` already dedupes by `id`:

```ts
const exists = state.insertedPrompts.some((item) => item.id === prompt.id);
const insertedPrompts = exists
  ? state.insertedPrompts
  : [...state.insertedPrompts, prompt];
```

#### Change

No store change is needed for the first implementation.

Do not add a new hidden prompt store field. Do not mutate the main textarea prompt with Canvas Mode policy text.

### KEEP `ui/src/components/PromptComposer.tsx`

#### Current state

`PromptComposer` already renders inserted prompt chips:

```tsx
{insertedPrompts.map((item) => (
  <div key={item.id} className="composer__prompt-chip" title={item.name}>
    <span className="composer__prompt-chip-plus" aria-hidden="true">+</span>
    <span className="composer__prompt-chip-title">{item.name}</span>
    ...
  </div>
))}
```

#### Change

No component change is needed for the first implementation.

The new Canvas Mode block should appear as the existing chip UI:

```text
+ Canvas Mode
```

and be removable through the existing chip remove button.

### MODIFY `tests/canvas-apply-merged-contract.test.js`

#### Current state

The test already checks that Canvas Mode Continue Here uses `imageOverride`, `actionImage`, and `useImageAsReference(actionImage)`.

#### Change

Extend the existing test named `keeps Continue Here on a compressed canvas reference path`.

Add assertions that `ResultActions.tsx` contains:

```js
assert.match(actions, /CANVAS_MODE_PROMPT_ID/);
assert.match(actions, /canvas-mode-context/);
assert.match(actions, /CANVAS_MODE_PROMPT_NAME/);
assert.match(actions, /Canvas Mode/);
assert.match(actions, /insertPromptToComposer/);
assert.match(actions, /canvasOpen && imageOverride/);
assert.match(actions, /source content and preserve\/complete/);
assert.match(actions, /edit instructions/);
```

This pins the integration to the existing prompt-chip system and prevents future regressions back to hidden headers or textarea mutation.

### MODIFY `tests/prompt-library-ui-contract.test.js`

#### Current state

The test already verifies inserted prompt chips from Prompt Library:

```js
assert.match(store, /type InsertedPrompt/);
assert.match(store, /insertedPrompts: InsertedPrompt\[\]/);
assert.match(store, /function composePrompt\(mainPrompt: string, insertedPrompts: InsertedPrompt\[\]\): string/);
assert.match(composer, /className="composer__prompt-chip"/);
```

#### Change

Add a small assertion to the existing prompt insertion test, or add a new test named:

```text
reuses inserted prompt chips for Canvas Mode Continue Here context
```

Read `ui/src/components/ResultActions.tsx` and assert:

```js
assert.match(actions, /insertPromptToComposer/);
assert.match(actions, /id:\s*CANVAS_MODE_PROMPT_ID/);
assert.match(actions, /name:\s*CANVAS_MODE_PROMPT_NAME/);
assert.match(actions, /text:\s*CANVAS_MODE_PROMPT_TEXT/);
```

This makes the Prompt Library ownership clear: Canvas Mode is not adding a parallel prompt-block implementation.

## Non-Goals

- Do not create a new prompt block renderer.
- Do not add a separate hidden prompt array.
- Do not put the Canvas Mode context text directly into `prompt`.
- Do not clear existing `insertedPrompts` during Canvas Mode Continue Here.
- Do not change server routes or `composePrompt()` ordering.
- Do not add OCR or memo extraction in this phase; the image itself carries the visible memo/annotation context.

## Verification

Run focused contracts first:

```bash
npm test -- tests/canvas-apply-merged-contract.test.js tests/prompt-library-ui-contract.test.js
```

Then run the standard project checks:

```bash
npm run ui:build
npm test
```

Optional manual check on `http://127.0.0.1:3333`:

1. Open an existing image.
2. Enter Canvas Mode.
3. Draw a circle or add a memo.
4. Click Continue Here.
5. Confirm the composer has a `+ Canvas Mode` chip.
6. Confirm existing prompt chips remain.
7. Click Continue Here again and confirm the `Canvas Mode` chip does not duplicate.

## Expected Files Changed During Implementation

```text
MODIFY ui/src/components/ResultActions.tsx
MODIFY tests/canvas-apply-merged-contract.test.js
MODIFY tests/prompt-library-ui-contract.test.js
```

No server files should change.

---

## STATUS 2026-04-30 — Partially shipped

Shipped commit on `main`:

- `9dc98a7` `feat: add blank canvas and generation hardening` — covers the
  canvas-side hardening that this plan depends on (paint-only inputs, blank
  canvas creation). The "Continue Here → Canvas Mode chip in Prompt
  Composer" wiring described in this plan is not yet visible in the
  shipped diff.

### Remaining work

1. Verify whether the `+ Canvas Mode` chip is actually wired into the
   Prompt Composer in the shipped code; if it is, link the SHA here and
   move to `_fin/`.
2. If still pending, implement per the existing Part 2 plan (chip +
   `useAppStore` `pendingCanvasContinuation` slice + Continue Here action
   wiring).
3. Add a contract test that the chip is idempotent (repeated Continue Here
   does not duplicate the chip).
