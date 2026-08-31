# 020 — NovelAI React UI and global/node payload parity

Depends on: 010. Work phase: wp2.

## Scope

Expose Auto SMEA and Decrisper beside the existing sampling/output controls. Keep
state sparse and gate by the effective provider/model in classic, multimode, and node
requests. No visual redesign and no reference/edit affordance.

## File changes

### MODIFY `ui/src/lib/naiOptions.ts`

```diff
 export type NaiOptions = {
+  autoSmea: boolean;
+  decrisper: boolean;
 }
 export const COMPILED_FALLBACK = {
+  autoSmea: false,
+  decrisper: false,
 }
```

Extend `coerceNaiOverrides` with strict booleans. Extend server-default coercion.

### MODIFY `ui/src/lib/naiPayload.ts`

No new branching: the two sparse keys ride the existing copied override object. Add
behavior tests proving effective node lane gating and no non-NAI leakage.

### MODIFY `ui/src/components/settings/NaiControlsPanel.tsx`

Add two accessible checkbox rows in the sampling/output groups:

```diff
+<input type="checkbox" checked={options.autoSmea}
+  onChange={(e) => setNaiOption("autoSmea", e.target.checked)} />
+<input type="checkbox" checked={options.decrisper}
+  onChange={(e) => setNaiOption("decrisper", e.target.checked)} />
```

Each has provider-specific help text. Keep the component under 400 lines; extract a
small existing-pattern toggle row only if the finished file would exceed the limit.

### MODIFY four locale dictionaries

`ui/src/i18n/en.json`, `ko.json`, `zh-Hans.json`, `zh-Hant.json` gain matching
`nai.field.autoSmea`, `nai.help.autoSmea`, `nai.field.decrisper`, and
`nai.help.decrisper` leaves.

### MODIFY tests and SoT

- `tests/nai-client-options-contract.test.ts`: sparse coercion, emit/read parity,
  effective node/global disagreement.
- `tests/nai-ui-registration-contract.test.ts`: all locale leaves resolve.
- `structure/04-frontend-architecture.md`: NAI panel field inventory.

## Render activation matrix

1. V5 NAI selected: both checkboxes visible and togglable.
2. V4.5 selected: Auto SMEA and Decrisper remain visible and active. Only the
   V5-native Alpha and Quality Preset controls are absent.
3. GPT selected: NAI panel absent.
4. Node NAI with global GPT: payload includes true values.
5. Node GPT with global NAI: payload contains none.
6. Integrated field-chain test: UI override -> payload -> `readNaiOptions` ->
   captured upstream body, with both new fields true.

## Verification

```text
node --import tsx --test tests/nai-client-options-contract.test.ts tests/nai-ui-registration-contract.test.ts
npm run typecheck
npm run typecheck:tests
cd ui && npm run build
browser screenshot/read-back at 1280x720 plus one narrow viewport
```
