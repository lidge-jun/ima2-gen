# 021 — wp2 stale check and implementation notes

## Stale check (P-phase)

Re-verified `020`'s cited sites at `7ef68258` before writing code.

| Claim | Tree | Status |
|---|---|---|
| `GenerationDefaults` at `storeTypes.ts:208-230` | present, 22 members | current |
| `storePersistence.ts:387-390` loader | `parsed.prompt` / `insertedPrompts` | current |
| `useAppStore.ts:264-266` hydration | present | current |
| `persistenceRegistry.ts` index constants | `PERSISTED_KEYS[0..18]`, exported by index | current |
| `storeNodeGenImpl.ts:208-231` posts `NodeGenerateRequest` directly | present | current |
| `storeCapabilitiesImpl.ts` sets only `referenceLimit` | present | current |
| `storeSettingsImpl.ts:565-568` `setPromptImpl` | persist-then-set | current |
| `storeGenerateEntryImpl.ts:13-22` multimode branch | present | current |

## One correction found during implementation

`020` listed `negativePrompt` as both a `GenerationDefaults` member and a state
field, and the first patch put the state members inside the
`GenerationDefaults` shape. `tsc` caught it immediately as a duplicate
identifier. The persisted blob carries `negativePrompt`; the store state block
carries `negativePrompt`, `naiOptionOverrides`, and `naiServerDefaults`.

## structure/01 line counts are script-maintained

`scripts/refresh-structure-line-counts.mjs` (no `--check`) rewrites the drifted
counts. wp1 edited them by hand, which worked but was unnecessary. The script
also tracks `ui/src/**` rows, so the audit-round-4 note that only `lib/*` and
`bin/commands/*` are checked was too narrow — the gate is wider than the test's
own description implies.

New rows still need adding by hand: `ui/src/lib/naiOptions.ts` was appended,
then the script filled in its count.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:tests` | 0 |
| `npm run test:inventory` | 0 after regeneration |
| `cd ui && npm run build` | 0 |
| `node --test tests/nai-client-options-contract.test.ts` | 15 pass, 0 fail |
| `npm test` | 2613 tests, 2611 pass, **0 fail**, 2 skip |

Baseline was 2580 / 0 fail. wp1 added 18 cases, wp2 added 15.

Committed `75597722`.

