# 021 — wp2 stale check and Design Read

Date: 2026-08-27. Prior D direction: wp1 proved the server/default/normalizer/adapter
contract and left the two UI fields hidden but type-safe.

## Design Read

```yaml
name: ima2 NovelAI native controls
colors: existing application tokens only
typography: existing 12px setting rows and 11px help copy
iconography: none; native checkbox semantics
```

Reading: a dense expert settings panel for repeated image-generation work, not a new
marketing surface. Reuse the existing row/toggle/help grammar.

Do: place Auto SMEA with sampling controls and Decrisper next to CFG Rescale; preserve
visible V4.5 behavior and sparse overrides. Don't: add cards, illustrations, animation,
new color tokens, or a second settings abstraction.

- DESIGN_VARIANCE: 2/10
- MOTION_INTENSITY: 1/10
- Product density: D5
- Concept/image generation skipped: this is a bounded extension of a finished,
  governed control panel with no unresolved visual direction.

## Current path check

- `ui/src/components/settings/NaiControlsPanel.tsx:92-154` is the sampling group.
- Existing toggle grammar is
  `ui/src/components/settings/NaiControlsPanel.tsx:187-209`; no new CSS is needed.
- `ui/src/lib/naiOptions.ts:26-62,90-137` already contains both fields from wp1.
- `ui/src/lib/naiPayload.ts:23-48` spreads sparse overrides and strips only
  `straightAlpha` / `qualityPresetId` for V4.5. Auto SMEA and Decrisper intentionally
  remain model-family compatible.
- Four locale dictionaries already have matching `nai.field` and `nai.help` trees;
  add four identical leaf names per locale.
- `tests/nai-client-options-contract.test.ts` already proves emitted/read key parity
  and effective node lane. Extend values in the disagreement cases so both booleans
  are behaviorally covered, not only discovered through `Object.keys`.
- `tests/nai-ui-registration-contract.test.ts` must enumerate the new field/help keys
  for all four dictionaries and assert both labels are rendered by the panel.

## Exact implementation

1. Add Auto SMEA checkbox and help after Noise Schedule.
2. Add Decrisper checkbox and help after CFG Rescale.
3. Add `field.autoSmea`, `help.autoSmea`, `field.decrisper`, `help.decrisper` in
   `en`, `ko`, `zh-Hans`, `zh-Hant`.
4. Add RED behavior/i18n/render-source tests first.
5. Keep `NaiControlsPanel.tsx` under 300 lines; no extraction is needed unless the
   finished file crosses that local soft limit.

## Activation and render cases

- V5 NAI: both visible and toggles write sparse true values.
- V4.5 NAI: both visible; Alpha and Quality remain absent.
- Global GPT + NAI node: both values reach node payload.
- Global NAI + GPT node: neither value leaks.
- Narrow settings sheet: labels/help wrap without horizontal overflow.

## Verification

```text
node --import tsx --test tests/nai-client-options-contract.test.ts tests/nai-ui-registration-contract.test.ts
npm run typecheck
npm run typecheck:tests
cd ui && npm run build
native browser QA: desktop and narrow screenshots, inspect -> toggle -> re-inspect
git diff --check
```

The RED test additions happen before the component/locale edits:

- assert panel source contains `setNaiOption("autoSmea"` and
  `setNaiOption("decrisper"` plus both field/help translation calls;
- enumerate the four new dictionary leaves across all four locales;
- extend both effective-node disagreement cases with true values and assert the exact
  payload. The pre-implementation targeted command must fail on panel/i18n absence.

Browser QA uses an isolated config and generated directory:

```text
IMA2_CONFIG_DIR=<mktemp-dir>/config IMA2_GENERATED_DIR=<mktemp-dir>/generated \
IMA2_PORT=3347 node bin/ima2.js serve --force
```

Then use the native in-app browser at `http://127.0.0.1:3347`: inspect desktop ->
toggle both controls -> re-inspect checked state; switch to V4.5 and confirm Alpha /
Quality absent while both new controls remain; switch off NAI and confirm panel absent;
repeat a narrow screenshot with overflow inspection; finally stop the isolated server.
