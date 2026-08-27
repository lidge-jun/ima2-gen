# 035 — wp3 execution record

## RED

`tests/nai-cli-options-contract.test.ts` was authored first. The initial run failed
with `ERR_MODULE_NOT_FOUND` for `bin/lib/nai-options.js`, proving the shared contract
did not exist.

## Implementation

- New `bin/lib/nai-options.ts`: 17 shared flags, help text, exact registry model
  derivation, enum/number/string/boolean validation, target/V5 policy, pure results,
  and one shared result-to-`fail({json})` adapter.
- `gen`: preflight before catalog, finalize after resolved target, supports persisted
  NAI default, spreads the typed payload before `/api/generate`.
- `multimode` and `node generate`: require explicit NAI target and preflight before
  server/ref work; spread the same payload.
- `gen.ts` ended at exactly 400 lines. Moving the repeated error adapter into the
  shared helper avoided exceeding the dev-family split threshold.
- Runtime test inventory regenerated: 188 runtime / 211 contract.

## GREEN and built-runtime proof

- Focused helper/built/parity suite: 20 pass / 0 fail.
- Built recorder invoked all three commands. `gen` used persisted
  `defaults.image=nai/nai-diffusion-5-full`; multimode/node used explicit target. All
  three captured identical 13-field NAI payloads without an upstream token.
- Built help showed the shared vocabulary in all three commands.
- Built preflight failures against `127.0.0.1:1` returned exit 2 in text/JSON modes,
  proving no server attempt replaced them with exit 3.
- `npm run build:cli`, source/test typechecks, inventory, and diff check: exit 0.

No paid or live NovelAI request was made.
