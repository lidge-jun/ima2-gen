# 013 — wp1 execution record

## Baseline reconciliation

- `da79e6d0` committed the wp1 plan/stale-check/audit docs.
- `3ad682e1` merged `origin/dev` without conflict.
- Both `755fc1c2` and `d18e56ca` are ancestors of the merge result.
- Package runtime baseline is now v3.11.0.

## RED

Focused command:

```text
node --import tsx --test tests/nai-options-contract.test.ts tests/nai-client-options-contract.test.ts tests/nai-provider-contract.test.ts tests/capabilities-lane-contract.test.ts tests/nai-built-runtime-contract.test.ts
```

Result before implementation: 52 tests, 47 pass, 5 fail. Failures were exactly the
missing capability defaults, generated config/defaults, client fallback schema, server
normalizer fields, and adapter true path. The built explicit-false test happened to pass
against the old hardcoded false body, so the paired explicit-true assertion is the
load-bearing activation proof.

## Implementation

- `config.ts`: operator defaults `defaultAutoSmea` and `defaultDecrisper` via `pickBool`.
- `lib/naiOptions.ts`: strict request booleans.
- `lib/naiImageAdapter.ts`: option fields and `??` consumption into `autoSmea` /
  `dynamic_thresholding`.
- `lib/capabilities.ts`: display defaults.
- `ui/src/lib/naiOptions.ts`: hidden shared-contract schema/fallback/coercion only;
  no visible control is introduced until wp2. This small foundation is required so
  server defaults survive client hydration and the server/client key parity test can
  stay green.
- Tests: TypeScript source chain plus generated JavaScript runtime contract.

## GREEN

- Focused source suite: 50 pass / 0 fail.
- `npm run typecheck`: exit 0.
- `npm run typecheck:tests`: exit 0.
- `npm run build:server`: exit 0.
- `node --import tsx --test tests/nai-built-runtime-contract.test.ts`: 2 pass / 0 fail.
- `git diff --check`: exit 0.

No real token or upstream generation was used.
