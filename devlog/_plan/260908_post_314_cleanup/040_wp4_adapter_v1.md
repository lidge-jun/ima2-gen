# 040 wp4 — issue #150 Provider Adapter v1 disposition (C3)

Audit round 1 (2026-09-08) folded: registration set narrowed to lanes whose auth is a
synchronous context field; every touched test named with its exact amendment.

## Re-measure at P (HEAD 36aa6fce)
| Acceptance item | State | Evidence |
|---|---|---|
| Registry-derived models/features/limits | met | adapters listModels -> getProvider(); tests/provider-adapter-v1-contract.test.ts |
| Adapter owns error normalization | met | 4 adapters implement normalizeError |
| Common contract suite over all adapters | partial | suite auto-iterates registered adapters; 4 of 10 lanes registered (minimax, atlascloud, comfy, nai) |
| New provider touches <= 5 core files | not met | execution dispatch: lib/providers/execution/index.ts + legacy*.ts branch per lane; routes/models, keys, UI |
| No provider switch in UI | not met | 11 provider literals in GenProviderModelSelect.tsx + storeSettingsImpl.ts (was 17 on 08-31) |
| Adapter loadable from outside core | not met | no packages/ |

## IN

### Item 1 — register three more descriptor adapters (api, grok-api, gemini-api)
Only lanes whose readiness is a synchronous RuntimeContext field qualify for the
existing two-state auth test (tests/provider-adapter-v1-contract.test.ts:131-148).
oauth (`ctx.oauthReadyState`, async proxy), grok (proxy health probe) and agy (binary
detection on disk) stay unregistered and are listed as residuals with that reason.

NEW files — the suite reads `lib/providers/adapters/${laneId}.ts` (test line 118), so
file names are the lane ids verbatim:
- `lib/providers/adapters/api.ts`: LANE_ID "api"; validateAuth = `ctx.apiKey ? ok : { ok:false, reason:"OpenAI API key missing" }`; errorPrefix from registry (`getProvider("api").errorPrefix`, verify value at B; if undefined, normalizeError still returns `{ code, message, status?, retryable }` using code as-is or `UNKNOWN`).
- `lib/providers/adapters/grok-api.ts`: LANE_ID "grok-api"; validateAuth = `ctx.xaiApiKey` -> "xAI API key missing".
- `lib/providers/adapters/gemini-api.ts`: LANE_ID "gemini-api"; validateAuth = `ctx.geminiApiKey` -> "Gemini API key missing".
Each copies the minimax.ts normalizeError shape (readStatus/readCode/RETRYABLE_STATUSES) — do NOT call lib/errors/providerMap.ts (it returns an error class, not ProviderError).
MODIFY `lib/providers/adapters/index.ts`: add the three factories to the map; update header comment.
MODIFY `tests/provider-adapter-v1-contract.test.ts`:
- contextWith(): add `apiKey: key, xaiApiKey: key, geminiApiKey: key`.
- EXPECTED_AUTH_REASON: add `api: /OpenAI API key missing/, "grok-api": /xAI API key missing/, "gemini-api": /Gemini API key missing/`.
- test "an unregistered lane returns null" (line 188): lanes list becomes `["oauth", "grok", "agy"]` and the message names the async-readiness reason.
- "no adapter source hard-codes a model id" (line 112): passes as long as new files contain no model literals.
Cycle check: new files import only registry.js, types.js, runtimeContext.js (type). No execution import.

### Item 2 — adapter-owned execution for the four legacy lanes
MODIFY `lib/providers/adapters/types.ts`: add
```ts
prepareImageExecution?<R extends ImageExecutionRequest>(ctx: RuntimeContext, request: R, progress?: ExecutionProgress): Promise<PreparedImageExecution<R["surface"]>>;
```
with `import type { ExecutionProgress, ImageExecutionRequest, PreparedImageExecution } from "../execution/types.js"` (type-only; execution/types.ts imports nothing from adapters, verified).
MODIFY `lib/providers/adapters/{nai,minimax,atlascloud,comfy}.ts`: implement the hook by moving each lane's branch out of legacyClassic.ts (lines 26-54), legacyNode.ts, legacyEdit.ts, legacyMultimode.ts into a per-lane `switch (request.surface)`; unsupported surfaces throw the same Error text the legacy files throw today (verify each message string at B and keep it). Classic keeps prepare-time scalar capture (legacyClassic.ts:64 pattern: capture provider/prompt/requestId/background/model/quality/size before returning execute). Multimode keeps the sequence projection and `onFinalImage` identity. Node keeps `kind: "single"`.
MODIFY `lib/providers/execution/index.ts` prepareSelected (line 12-19): before `isLegacyExecutionRequest`, add
```ts
const adapter = getProviderAdapter(ctx, request.provider);
if (adapter?.prepareImageExecution) return adapter.prepareImageExecution(ctx, request, progress);
```
importing `getProviderAdapter` from `../adapters/index.js` (runtime edge execution -> adapters; adapters never import execution at runtime, so no cycle). The typed openai/grok/google owners keep their existing early returns above this line.
MODIFY `lib/providers/execution/legacy*.ts`: remove the four lane branches and their imports; `prepareLegacyImageExecution` keeps the surface switch and each legacy file reduces to the "Unsupported ... provider" throw (keep files so provider-execution-imports legacyOwners paths still exist).
Tests:
- `tests/nai-routing-contract.test.ts:94` "no nai dispatch forwards references": file list becomes `["lib/providers/adapters/nai.ts", "lib/agentImageVideoGen.ts"]`; the "exactly one call" expectation becomes per-surface calls inside nai.ts (assert >= 3 calls: classic, node, multimode) each with no `references` argument.
- `tests/provider-execution-imports.test.ts:81`: add `adapterExecutionOwners = ["lib/providers/adapters/nai.ts","minimax.ts","atlascloud.ts","comfy.ts"]` to the forbidden-edge loop; run first, then add the four to the loop and fold any real violation (expected none: they import only lib/*ImageAdapter.js, registry, types).
- `tests/provider-execution-classic.test.ts`, `-node`, `-multimode`, `-routes`, `tests/provider-surface-boundary.test.ts`, `tests/mcp-provider-adapters.test.ts`, `tests/nai-*.test.ts`, `tests/comfy-*.test.ts`, `tests/minimax*.test.ts`, `tests/atlascloud*.test.ts`: behavior suites; must pass unchanged.
- `tests/provider-adapter-v1-contract.test.ts`: add a test "legacy lanes own their execution": for nai/minimax/atlascloud/comfy `typeof adapter.prepareImageExecution === "function"`.

## OUT
packages/ split; UI switch removal; oauth/grok/agy descriptors (async readiness).

## Verifiers (all exist; run at P with deps installed — see 000 for the install note)
- `npm run typecheck`, `npm run typecheck:tests`, `npm test`, `node scripts/generate-provider-types.mjs --check`, `node scripts/refresh-structure-line-counts.mjs --check` (refresh first).
- Measurement for the issue comment: `node --import tsx -e 'import("./lib/providers/adapters/index.ts").then(m=>console.log(m.listProviderAdapters({apiKey:"k",xaiApiKey:"k",geminiApiKey:"k",minimaxApiKey:"k",atlasCloudApiKey:"k",naiApiKey:"k",comfyWorkflows:[]}).length))'` -> 7; `rg -c 'provider === "|case "' ui/src/components/GenProviderModelSelect.tsx ui/src/store/storeSettingsImpl.ts`.

## Disposition rule
Close #150 only if all six rows are met. Expected after wp4: rows 1-2 met, row 3 met for
7/10 lanes (3 async lanes documented), row 4 improved (a legacy-style provider now
touches registry + adapter file + keys/UI; measure by listing files a hypothetical
"lane X" needs), rows 5-6 not met -> leave OPEN with the fresh table and residual list.

