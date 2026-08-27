# 010 — NovelAI provider contract and server foundation

Depends on: 000-002. Work phase: wp1.

## Scope

Open Auto SMEA and Decrisper through the existing sparse option chain. Preserve the
four-model generate-only contract, ZIP decoder, auth validation, error mapping, and
all explicit reference/edit refusals.

## File changes

### MODIFY `config.ts`

Before: `naiProvider` supplies model, size, steps, scale, sampler, noise schedule,
timeout, and base/account URLs.

After:

```diff
 naiProvider: {
   defaultNoiseSchedule: env(...),
+  defaultAutoSmea: envBool("IMA2_NAI_DEFAULT_AUTO_SMEA", false),
+  defaultDecrisper: envBool("IMA2_NAI_DEFAULT_DECRISPER", false),
 }
```

The generated `config.js` is produced only by `npm run build:server`.

### MODIFY `lib/naiOptions.ts`

```diff
 export type NaiRequestOptions = {
+  autoSmea?: boolean;
+  decrisper?: boolean;
 }
 ...
+ const autoSmea = pickBoolean(raw.autoSmea);
+ const decrisper = pickBoolean(raw.decrisper);
```

Both keys use the existing strict boolean picker. Wrong types disappear and fall
back to operator defaults.

### MODIFY `lib/naiImageAdapter.ts`

```diff
 export type NaiGenerateOptions = {
+  autoSmea?: boolean;
+  decrisper?: boolean;
 }
 ...
-autoSmea: false,
-dynamic_thresholding: false,
+autoSmea: options.autoSmea ?? cfg.defaultAutoSmea,
+dynamic_thresholding: options.decrisper ?? cfg.defaultDecrisper,
```

Keep `straight_alpha` and `qualityPresetId` V5-gated. Do not add references or edit
actions. Add model-aware assertions/tests for V4.5 rather than changing its proven
request body from memory.

### MODIFY `lib/capabilities.ts`

Project `autoSmea` and `decrisper` under the existing NAI defaults object so the UI
can display operator defaults without freezing compiled values.

### MODIFY tests

- `tests/nai-options-contract.test.ts`: valid/wrong-type round trips for both fields.
- `tests/nai-provider-contract.test.ts`: default false, explicit true, and config true
  overridden false; captured upstream body is the activation evidence.
- `tests/nai-client-options-contract.test.ts`: field-chain parity remains exact.
- `tests/nai-client-options-contract.test.ts`: one integrated activation test builds
  sparse UI overrides with both booleans true, passes the emitted body through
  `readNaiOptions`, invokes the adapter against a fetch recorder, and asserts the
  final upstream `autoSmea` / `dynamic_thresholding` fields. This proves the whole
  creation -> serialization -> normalization -> consumer chain, not just adjacent
  regex parity.
- `tests/capabilities-lane-contract.test.ts`: NAI defaults projection.

## Verification

```text
node --import tsx --test tests/nai-options-contract.test.ts tests/nai-provider-contract.test.ts tests/nai-client-options-contract.test.ts tests/capabilities-lane-contract.test.ts
npm run typecheck
npm run typecheck:tests
git diff --check
```

## Non-goals and rollback

No request action changes, no new model, no credential changes. Rollback is one
commit reverting the two fields and tests; existing defaults return to hardcoded false.
