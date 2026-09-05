# WP04 — OpenAI execution ownership, OAuth/API parity

Status: P / future implementation, independently rederived at ecde2bc79.
One PR outcome: OAuth/API use an actual typed OpenAI execution owner, with operation bodies extracted from responsesImageAdapter and all OpenAI branches removed from WP03's legacy execution helpers.
Semantic dependency: WP03 prepareImageExecution/types, server admission and four caller integration. Existing resolveProviderOptions supplies resolved fields; WP02 is UI selection/persistence only.
Stack base: WP03 tip. No requirement to merge WP03 before creating this stacked PR.

## Loop-spec and exclusions

Archetype=contract-preserving family extraction. Trigger=two OpenAI lanes sharing three operations.
Goal=one owner for OpenAI execution semantics across four surfaces.
Non-goals=new prompt/tool semantics, image API replacement, fallback/retry change, native mask claims, auth/model V1 expansion, new UI, wire-envelope redesign.
Verifier=focused transport+execution tests below, typechecks and structural import assertions.
Stop=family branches removed, real operation bodies moved, both old imports and new seam produce the expected fixture wire contract.
Artifact=this plan, 002 evidence, parent C receipt. Outcomes=verified migration / blocked parity.
Main owns escalation, including two failed packets; leaf has no subordinate workers or state commands.

Current anchors: responsesImageAdapter.ts :37-161 error/auth/endpoint helpers; :163-177 reference conversion;
:179-277 post/abort/parse; :279-302 options; :304-382 generate; :384-429 multimode; :431-496 edit.
Retries: generatePipeline :530-564 and responsesFallback :69-155.
This is a relocation of production operation bodies, not a new adapter that merely wraps the unchanged old adapter.

## Exact change manifest

| Action | Path | Design |
| --- | --- | --- |
| NEW | lib/providers/adapters/openaiExecution.ts | prepareOpenaiExecution, surface mapping, classic-only bounded retry policy moved from legacyClassic |
| NEW | lib/providers/adapters/openaiOperations.ts | Three existing operation bodies plus normalizeRef; preserves exported positional APIs |
| NEW | lib/providers/adapters/openaiTypes.ts | Existing ReferenceRef and GenerateOptions definitions, made exportable for operation signatures; no changed option defaults |
| NEW | lib/responsesTransport.ts | Existing postResponses and its auth/error/endpoint/abort helpers, no generation orchestration |
| MODIFY | lib/responsesImageAdapter.ts | Compatibility re-exports only; no residual execution implementation |
| MODIFY | lib/providers/execution/index.ts | Select prepareOpenaiExecution for oauth/api before legacy dispatch |
| MODIFY | lib/providers/execution/legacy.ts | Narrow legacy provider set excluding oauth/api |
| MODIFY | lib/providers/execution/legacyClassic.ts | DELETE Responses retry/call branch; its exact policy moves to openaiExecution |
| MODIFY | lib/providers/execution/legacyNode.ts | DELETE OpenAI generate/edit branches |
| MODIFY | lib/providers/execution/legacyEdit.ts | DELETE editViaResponses branch |
| MODIFY | lib/providers/execution/legacyMultimode.ts | DELETE generateMultimodeViaResponses branch |
| NEW | tests/openai-execution-parity.test.ts | Activate all four surface mappings and both lane endpoints via real new execution owner |
| MODIFY | tests/provider-execution-imports.test.ts | Family implementation may not import compatibility facade; legacy may not dispatch oauth/api |
| MODIFY | docs/migration/runtime-test-inventory.md | New runtime test inventory |
| MODIFY | structure/03-server-api.md | Actual OpenAI execution/transport/facade split |
| MODIFY | structure/01-file-function-map.md | Moved function owners |
| MODIFY | structure/07-devlog-map.md | WP04 receipt and WP05 transition |

DELETE files: none. Four pipelines/routes are unchanged after WP03. Generated outputs: NEW JS twins for four new source modules, MODIFY JS twins for facade, index and five legacy modules via build only. Do not add ignored output to git. No package dependency/config/auth/credential changes.

Additional exact MODIFY targets from baseline lexical-test inspection: tests/edit-mask-api-contract.test.js:48 and tests/oauth-proxy-edit-mask-contract.test.js:41 read responsesImageAdapter's mask-guide body; change that source path to lib/providers/adapters/openaiOperations.ts. tests/multimode-backend-contract.test.js:46 reads operation payload and transport parser in one file; split its source variables into openaiOperations.ts (tool_choice/callback mapping) and lib/responsesTransport.ts (parseStream). Keep parser assertions on responsesParse.ts. WP03 already replaces obsolete route-local dispatch assertions; do not restore them or concatenate whole source trees just to keep an old regex green. New O04-5/6 runtime assertions are the behavior proof.

## Full new-module design and dependency contracts

### openaiTypes.ts

Move ReferenceRef exactly from responsesImageAdapter:163 and GenerateOptions :279-302, adding export.
ReferenceRef remains string | {b64?:string;detectedMime?:string|null;declaredMime?:string|null}, including explicit undefined allowances needed by exactOptionalPropertyTypes. GenerateOptions keeps every existing optional field:
webSearchEnabled, searchMode, onPartialImage, onFinalImage, model, partialImages, reasoningEffort, maxImages, references, mask, signal, forceImageToolChoice, allowPromptOnlyOAuthFallback, background, outputFormat.
Import FinalImageHandler from ../../responsesParse.js. No runtime code or new schema.

### responsesTransport.ts

Move MakeErrorOptions, ResponsesError, RESPONSES_ERROR_MARKER, makeError, parseOpenAIErrorBody, normalizedCode, safeUpstreamClientMessage, safeBaseUrl, apiAuthorizationHeader, isKnownResponsesError, getEndpoint, PostResponsesArgs, combineAbortSignals and postResponses, preserving bodies/defaults.
Public runtime export is `postResponses(args: PostResponsesArgs): Promise<ParsedResponsesResult>`; export PostResponsesArgs for typed callers. Other helpers remain private.
Dependencies: logger, errorClassify, errInfo, inflight.setJobPhase, runtimeContext type, oauthProxy.waitForOAuthReady, responsesParse parseJson/parseStream/safeDiagnosticLabel.
It must not import openaiExecution, execution/index, routes or any compatibility facade.
No change to provider==="api" direct URL/header selection, OAuth waitReady, safeBaseUrl, 400/401/429 diagnostics or 499-versus-504 mapping.

### openaiOperations.ts

Move normalizeRef and these exact public function signatures and bodies. Imports are rebased from "./" to "../../"; postResponses comes from ../../responsesTransport.js and types from ./openaiTypes.js.
- generateViaResponses(provider:string|undefined,prompt:string|undefined,quality:string|undefined,size:string|undefined,moderation="low",references:ReferenceRef[]=[],requestId:string|null=null,mode="auto",ctxRaw:RouteRuntimeContext={},options:GenerateOptions={})
- generateMultimodeViaResponses: same signature.
- editViaResponses(provider:string|undefined,prompt:string|undefined,imageB64:string|undefined,quality:string|undefined,size:string|undefined,moderation="low",mode="auto",ctxRaw:RouteRuntimeContext={},requestId:string|null=null,options:GenerateOptions={})

Bodies continue using responsesTools, responsesErrors, responsesFallback, oauthProxy prompt builders, referenceImageCompress and requireRuntimeContext. No duplication of those helpers.
Existing >5 positional parameters are retained strictly for compatibility; the new execution entry uses a single typed request.

### openaiExecution.ts

Concrete signatures:
```ts
type OpenaiRequest = ImageExecutionRequest & { provider: "oauth" | "api" };
export function prepareOpenaiExecution<R extends OpenaiRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress
): Promise<PreparedImageExecution<R["surface"]>>;
```
Import canonical types from ../execution/types.js, operations from ./openaiOperations.js, and the existing generationErrors/logger/cancel helpers required by the classic retry extraction.
Prepare does no fetch/readiness probe; execute selects one of four surface-specific helpers. Those helpers map the request to the three operation functions and return {kind,value}, retaining all successful retry metadata by spreading the native result, not reconstructing only b64/usage.

| Request surface | Exact operation/options |
| --- | --- |
| classic | generateViaResponses with request.prompt/references/options; signal; allowPromptOnlyOAuthFallback=provider!=="api"; background/outputFormat only when present. Preserve original two-attempt outer loop and error normalization. |
| node, sourceImage=null | generateViaResponses with context-filtered references; model/reasoning/webSearch/signal; partialImages=request.partialImages; progress.onPartialImage only if enabled. Do NOT enable allowPromptOnlyOAuthFallback. |
| node, sourceImage present | editViaResponses with sourceImage, context-filtered refs and searchMode; no mask, partial callback or fallback flag. |
| edit | editViaResponses with sourceImage and mask when non-null; model/reasoning/webSearch/signal; no references not previously supplied. |
| multimode | generateMultimodeViaResponses with maxImages, refs, model/reasoning/webSearch/signal and both callbacks; do not add partial_images merely because a callback exists. |

Node outer attempts remain nodeGeneration's responsibility. Classic retry logs stay scope=generate, with unchanged attempt/code fields. Caller cancellation check remains; retaining the classic per-attempt throwIfJobCanceled prevents a canceled result from entering a retry. Do not add a new global abort check that changes transport failure ordering.

## Before / after patches

Compatibility facade:
```diff
- export async function generateViaResponses(...) { /* original body */ }
- export async function generateMultimodeViaResponses(...) { /* original body */ }
- export async function editViaResponses(...) { /* original body */ }
+ export {
+   generateViaResponses, generateMultimodeViaResponses, editViaResponses,
+ } from "./providers/adapters/openaiOperations.js";
```
Move, do not copy, the private helpers and bodies according to the module map above.
Existing agentImageVideoGen and spriteRowPipeline imports keep working through this facade.

Execution selector after WP03:
```diff
- return prepareLegacyExecution(ctx, request, progress);
+ if (request.provider === "oauth" || request.provider === "api") {
+   return prepareOpenaiExecution(ctx, narrowedOpenaiRequest, progress);
+ }
+ return prepareLegacyExecution(ctx, narrowedLegacyRequest, progress);
```
narrowedOpenaiRequest/narrowedLegacyRequest describe type-guard results, not new data copies. Implement an explicit provider type guard or overload so the same request and ctx object cross the boundary; no `as any`.
Remove the matching branches/imports from each legacy helper and narrow its input provider set in the same patch. Preserve remaining provider behavior, including refusal paths preserved by WP01 and added by WP03.

## Acceptance: reachable fixtures and independent expectations

| ID | Activation | Assertion |
| --- | --- | --- |
| O04-1 | Two contexts with distinctive fake API key vs OAuth loopback URL/readiness, same request | API uses https://api.openai.com/v1/responses + fake Bearer; OAuth uses loopback /v1/responses without API auth; no fallback to other lane; mutate live ctx readiness before execute and observe current state |
| O04-2 | Classic oauth first stream empty, next two fallback streams empty, third fallback returns image | 4 transport calls for one outer attempt; first two fallback requests retain refs/developer, last drops them; retryKind and all drop/event metadata literal values survive to classic response |
| O04-3 | Classic api empty stream, then retryable empty; node oauth empty and edit oauth empty | API never calls oauth-fallback; classic outer request count matches two; node no inner fallback; edit exactly one; non-retryable safety exits early |
| O04-4 | Generate with webSearch=false and distinct size/model/reasoning/background/outputFormat | Request tools/choice, developer/user content, reasoning and image options equal explicit fixture fields; fallback retains background/outputFormat |
| O04-5 | Node child parent+ref and PNG mask on edit route, using valid small image bytes | Node compresses parent+filtered refs as before; edit mask appended as guidance image/text; no claim of pixel-exact native masked editing |
| O04-6 | Node partial followed by final; multimode two final items and duplicate bytes | Partial wire payload unchanged; final callback awaited before next item; duplicate bytes ignored by parser, caller persisted index remains once |
| O04-7 | SSE error with rate_limit_exceeded, malformed key, 400 param absent, no-image edit | Exact RESPONSES_STREAM_ERROR/upstreamCode/eventCount; malformed key redacted; paramless error wording preserved; empty edit 422 diagnostics retained |
| O04-8 | Held fetch rejected with AbortError after caller abort vs internal timeout | 499 GENERATION_CANCELED versus 504 RESPONSES_IMAGE_TIMEOUT; no successful persistence/done; same error diagnostics traverse seam |
| O04-9 | Multimode final image then stream timeout | Already saved images retained by existing caller partial-timeout path, one terminal outcome; seam must not convert to an empty successful sequence |
| O04-10 | Import both old facade and new operation in the same built graph | Exported function identity equal; real operation called once; legacy branches gone, no new module imports the facade |

Safety fixture keys are invented strings. Do not read credentials or boot the user's proxy. Mock URL requests prove lane selection locally, not account validity.
Complete strings/builders are not re-derived from DUT in assertions: expected request fields and event order come from hand-authored fixtures. Include red/green mutation evidence that re-enabling fallback on API or dropping one callback breaks a test.

## Verification and baseline exits

Observed WP00: npm run typecheck=0; npm run typecheck:tests=0; npm run test:inventory=0.
The seven-file command in 002=0, 51/51; it includes responses-adapter-safety and V1 tests, **not** this future execution owner.
New test file does not exist yet; its future command has no baseline success claim:
```sh
node --import tsx --test tests/openai-execution-parity.test.ts tests/provider-execution-boundary.test.ts tests/provider-execution-routes.test.ts tests/provider-execution-imports.test.ts tests/responses-adapter-safety.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
git diff --check
```
Runtime tests directly import actual execution/operation modules, not mock prepareImageExecution. Matched emitted JS must be regenerated via npm run build:server before .js-import tests; this script exists but was not executed in WP00 because it writes outside docs scope. Full suites/CI/release remain parent-owned.

Existing tests/api-provider-parity.test.ts and tests/node-streaming-sse.test.ts are additional future integration gates after temporary storage/log/DB isolation is verified. They were inspected as patterns, not run here; do not claim their baseline pass. Compiler config includes every new lib/**/*.ts; test config includes new tests/**/*.test.ts. Prose/SoT still needs human review.

## Field chain, compatibility and rollback

No new persisted field or public enum. canonical request creation at four callers; serialize/deserialize=N/A (in-process). operation produces image/retry/sequence fields → seam preserves → existing classic/edit/node/multimode response and sidecar functions serialize; history/session/CLI readers remain untouched. ResponseDiagnostics type continues to come from responsesParse, not a parallel definition.

Before SoT: responsesImageAdapter owns endpoint plus payload construction.
After SoT: structure/03-server-api.md documents execution owner, operation bodies, transport and compatibility facade; file map names each function's actual location; 07 links receipt. Keep existing mask wording as guidance, not native-mask support.

Rollback: parent reverts WP04 as one layer (restore WP03 legacy branches and original operation owner together), rebuilds emitted outputs and reruns original focused gates. No stored files/data/auth state are deleted or rewritten. With upper stack descendants, parent cascades/revalidates them or repairs forward; no mixed routing.

Import gate is an E7/CI early warning, not an unbypassable boundary. Executing surface=node test runner/parent CI; bypass=not running tests or external imports; residual=compatibility facade intentionally remains public; wording=local routing parity only; final enforcement layer=none.
