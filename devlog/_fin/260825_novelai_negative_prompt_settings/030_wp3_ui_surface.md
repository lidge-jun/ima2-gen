# 030 — wp3: UI surface

Depends on wp2 (`020`): every control needs a setter that already persists.

Independently verifiable at close: `cd ui && npm run build` = 0 plus a rendered
screenshot showing the NAI panel and the undesired-content field.

## Deliverable

Two visible surfaces: an undesired-content input in both composers, and a
NAI-native right panel replacing the inert GPT controls.

## File change map

| Path | Action |
|---|---|
| `ui/src/components/NegativePromptField.tsx` | **NEW** — shared, provider-gated |
| `ui/src/components/settings/NaiControlsPanel.tsx` | **NEW** — the five control groups from 003 |
| `ui/src/components/GenerationControlsPanel.tsx` | MODIFY — `isNai` flag + branch + hide inert controls |
| `ui/src/components/PromptComposer.tsx` | MODIFY — mount the field under the prompt stack |
| `ui/src/components/home/HomePromptComposer.tsx` | MODIFY — mount between textarea and footer |
| `ui/src/store/storeGenerateEntryImpl.ts` | MODIFY — NAI bypasses the multimode path (`004` §B4) |
| `ui/src/store/storeGenImpl.ts` | MODIFY — force `n: 1` for NAI (`004` §B4) |
| `ui/src/styles/*.css` (or the existing panel stylesheet) | MODIFY — `.nai-controls`, `.negative-prompt-field` |
| `tests/nai-ui-registration-contract.test.ts` | MODIFY — assert the new surfaces |

## `NegativePromptField.tsx` (new)

```tsx
export function NegativePromptField({ variant }: { variant: "classic" | "home" }) {
  const provider = useAppStore((s) => s.provider);
  const value = useAppStore((s) => s.negativePrompt);
  const setValue = useAppStore((s) => s.setNegativePrompt);
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  if (provider !== "nai") return null;
  ...
}
```

Behavior:

- collapsed to one row; expands to three on focus or when non-empty. It is
  secondary to the positive prompt and must not compete for vertical space.
- `aria-label` from `t("nai.negativePrompt.label")`; the visible label is a
  `<label htmlFor>` so the control is reachable, not just readable.
- Enter inserts a newline. It must NOT submit — the positive prompt textarea
  owns the submit shortcut, and two different Enter semantics in adjacent
  fields is a trap.
- Returns `null` for non-nai providers. Value stays in the store (002 §D4), so
  switching provider and back preserves typed text.

## `NaiControlsPanel.tsx` (new)

Renders the five groups from 003 using existing primitives — `OptionGroup`,
`Segmented`, `Toggle`, and the `.option-group` / `.section-title` classes the
Gemini branch already uses (`GenerationControlsPanel.tsx:222-328`). No new
design vocabulary.

```tsx
import { useShallow } from "zustand/react/shallow";

// Reads RESOLVED, writes OVERRIDES (020). There is no s.naiOptions field.
// useShallow is required: the selector builds a new object each call, and
// Zustand 5 passes selector output straight to useSyncExternalStore
// (ui/node_modules/zustand/esm/react.mjs:5-11).
const naiOptions = useAppStore(useShallow(selectResolvedNaiOptions));
const setNaiOption = useAppStore((s) => s.setNaiOption);
const imageModel = useAppStore((s) => s.imageModel);
const isV5 = isNaiV5Model(imageModel);
```

Every control displays the resolved value — the operator's configured default
until the user changes that specific field — and every `onChange` calls
`setNaiOption(key, value)`, which records one override. A "Reset to defaults"
action in the group footer calls `resetNaiOptions()`.

Group order and contents follow 003 exactly. Three implementation notes:

1. **Size presets** reuse `setSizePreset` / `setCustomSize` rather than a
   private size state. Size already flows to the server through `effectiveSize`
   (`lib/providerOptions.ts:59-72`); a parallel NAI-only size would be a second
   source of truth for the same wire field.

2. **Transparent background and quality preset** render only when `isV5`. The
   panel resets both on model change as a convenience so a hidden control's
   value is not silently in effect — but per `005` §R2-B2 that reset is NOT the
   guarantee. `naiPayloadFields` strips both keys for non-V5 models and
   `generateViaNai` gates them again. The callback covers the path the user can
   see; the boundary covers reload and `storeSettingsImpl.ts:485-489`.

   The panel also reads the **resolved** options (`resolveNaiOptions`) and
   writes **overrides** (`setNaiOption`), per `005` §R2-B1 — a control shows
   the operator's configured default until the user changes it, and only then
   does that field stop tracking the server.

3. **Seed** is a text input constrained to digits plus a dice button that
   writes `null`. Empty string maps to `null`, never to `0` — `0` is a valid
   NovelAI seed and would silently pin every generation to the same image.

At roughly 200 lines this stays under the 500-line file limit; if it grows the
split is by group, not by control.

## `GenerationControlsPanel.tsx` diff

Add alongside the existing flags at `:106-111`:

```ts
  const isNai = provider === "nai";
```

Three edits:

1. `hideFormatControls` (`:112`) gains `|| isNai` — format and moderation are
   inert for this lane (003).
2. The `providerCompat` chain (`:159-165`) gains a nai arm; otherwise the panel
   shows GPT compatibility copy for a NovelAI lane.
3. The render branch (`:217-338`) gains `isNai ? <NaiControlsPanel /> : ...`
   ahead of the generic fallback.
4. `CountPicker` (`:373`) and `CostEstimate` (`:374`) are gated with
   `{isAnyGemini || isNai ? null : <CountPicker />}` — the cost model is
   OpenAI-priced, and per §"Count and multimode" below the count is forced.
5. The multimode toggle (`:359-370`) gains `&& !isNai`.

Every edit is an added disjunct or a new branch arm. No existing provider's
path changes, which is how c7 stays provable by reading the diff.

## Count and multimode are BEHAVIOR, not visibility (`004` §B4)

The original plan hid `CountPicker` and the multimode toggle and called it
done. That was the audit's most severe finding, and it was right:

- `n_samples: 1` (`lib/naiImageAdapter.ts:125-126`) caps ONE upstream call.
  The app-level `count` drives `count` **separate** adapter calls —
  `Promise.allSettled(Array.from({ length: count }, generateOne))` at
  `lib/generatePipeline.ts:571`. Hiding the picker leaves a persisted
  `count: 4` firing four NovelAI generations with no visible control.
- `generateImpl` chooses the path from `s.uiMode === "classic" && s.multimode`
  (`ui/src/store/storeGenerateEntryImpl.ts:13-22`). A hidden toggle leaves
  `multimode: true` steering NAI into the multimode pipeline invisibly.

Two behavioral edits, both preserving the user's non-NAI preferences:

```ts
// storeGenerateEntryImpl.ts
const useMultimode = s.uiMode === "classic" && s.multimode && s.provider !== "nai";
```

```ts
// storeGenImpl.ts, classic payload
n: s.provider === "nai" ? 1 : s.count,
```

Persisted `count` and `multimode` are **not** mutated — switching back to GPT
restores exactly what the user had. Hiding the controls is now the consequence
of the behavior being correct rather than a substitute for it.

The wp3 contract test asserts both gates in source: a hidden control with live
behavior behind it is the exact defect class this unit exists to remove.

## Composer diffs

`PromptComposer.tsx`: mount `<NegativePromptField variant="classic" />` after
the prompt stack (`:341-375`) and before the mention menu. Inside the mention
region it would inherit the `@`-mention keydown handling, which is wrong for a
tag list.

`HomePromptComposer.tsx`: mount `<NegativePromptField variant="home" />`
between the textarea and footer (`:101-113`).

Both mounts are unconditional in JSX; the component self-gates on provider. One
gate, one place.

## Styles

`.negative-prompt-field` — same border/radius tokens as the prompt textarea,
one step down in font size, muted placeholder. `.negative-prompt-field--expanded`
sets `min-height: 4.5rem` with a transition.

`.nai-controls` — reuses `.option-group` spacing. `.nai-controls__slider-row`
lays out label / slider / numeric readout in a 3-column grid so the ten controls
read as a single rhythm rather than ten bespoke rows.

No new color tokens. Both themes inherit.

## `tests/nai-ui-registration-contract.test.ts` additions

| Case | Assertion |
|---|---|
| composer mounting | both composers reference `NegativePromptField` |
| provider gate | the component returns null for non-nai (source assertion on the guard) |
| panel branch | `GenerationControlsPanel` renders `NaiControlsPanel` under `isNai` |
| inert controls | `isNai` participates in `hideFormatControls`, CountPicker, CostEstimate, multimode gates |
| control coverage | every `NaiOptions` key has a control in `NaiControlsPanel` |
| V5 gate | `straightAlpha` control is guarded by a V5 model check |
| i18n readiness | every `t("nai.` key used resolves in all four locales (hard-fails until wp4 lands the keys) |

The control-coverage case is the anti-drift guard: adding a field to
`NaiOptions` without a control fails the gate.

## Accept criteria

1. `cd ui && npm run build` = 0.
2. `npm test` = `fail 0` (i18n cases may require wp4 — if so they land
   together in the same commit rather than a red intermediate state).
3. **Render grounding (C-RENDER-GROUNDING-01, C4 = STRICT):** serve the built
   UI, select NovelAI, screenshot the panel and composer at 1280×720, read the
   screenshot back, persist it to `evidence/`.

## Scope boundary

IN: the files above. OUT: server behavior; new i18n keys (wp4); restyling
controls that are not part of this lane.
