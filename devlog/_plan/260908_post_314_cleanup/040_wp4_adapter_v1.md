# 040 wp4 — issue #150 Provider Adapter v1 disposition (C3)

## Re-measure at P (HEAD 36aa6fce)
| Acceptance item | State | Evidence |
|---|---|---|
| Registry-derived models/features/limits | met | adapters listModels -> getProvider(); tests/provider-adapter-v1-contract.test.ts |
| Adapter owns error normalization | met | 4 adapters implement normalizeError |
| Common contract suite over all adapters | partial | suite auto-iterates registered adapters; 4 of 10 lanes registered (minimax, atlascloud, comfy, nai) |
| New provider touches <= 5 core files | not met | execution dispatch: lib/providers/execution/index.ts + legacy*.ts branch per lane; routes/models, keys, UI |
| No provider switch in UI | not met | 11 provider literals in GenProviderModelSelect.tsx + storeSettingsImpl.ts (was 17 on 08-31) |
| Adapter loadable from outside core | not met | no packages/ |

What changed since 08-31: `lib/providers/execution` now gives one typed
`prepareImageExecution(ctx, request)` entry for classic/node/edit/multimode, with
openai/grok/google as typed owners and the rest under `legacy*.ts` lane switches.

## Feasible in this loop (IN)
1. Register adapters for the six unregistered lanes (oauth, api, grok, grok-api, agy,
   gemini-api) as thin descriptors (validateAuth from ctx, listModels from registry,
   normalizeError delegating to lib/errors/providerMap.ts). Files: NEW
   lib/providers/adapters/{oauth,api,grok,grokApi,agy,geminiApi}.ts (~40 lines each),
   MODIFY adapters/index.ts factory map, tests: EXPECTED_AUTH_REASON rows. This makes
   "contract suite over all lanes" fully met (10/10).
2. Give ProviderAdapterV1 an optional `prepareImageExecution` hook and route
   `prepareSelected` (execution/index.ts:12-19) through it first:
   `getProviderAdapter(ctx, request.provider)?.prepareImageExecution?.(ctx, request, progress) ?? <existing chain>`.
   Implement it for the four legacy lanes (nai, minimax, atlascloud, comfy) by moving
   each lane's branch out of legacyClassic/legacyNode/legacyEdit/legacyMultimode into
   its adapter file (the branches are 8-15 lines each). legacy*.ts keep only the
   "unsupported" throw. Result: adding a provider = registry entry + one adapter
   file + UI/keys wiring; core execution untouched.
3. Leave UI switch count and packages/ as explicit residuals with numbers.

## OUT
packages/ split; UI switch removal (needs capability-driven picker redesign; separate unit).

## Verifiers
- tests/provider-adapter-v1-contract.test.ts (auto-iterates), tests/provider-execution-*.test.ts (classic/node/edit/multimode/routes/imports), tests/nai-*.test.ts, tests/mcp-provider-adapters.test.ts, tests/provider-surface-boundary.test.ts; `npm run typecheck`; `node scripts/generate-provider-types.mjs --check` (ui/src/generated/providers.ts drift).
- Measurement command for the issue comment: `rg -c 'provider === "|case "' ui/src/components/GenProviderModelSelect.tsx ui/src/store/storeSettingsImpl.ts`; `node -e` listing listProviderAdapters length.

## Disposition rule
Close #150 only if all six rows are met. Expected: 4 met, 2 not met -> leave OPEN with
the fresh table, a "what remains" list (UI picker capability-driven refactor; packages/
extraction) and the reason each is its own unit. c-5 accepts either outcome with the table.

