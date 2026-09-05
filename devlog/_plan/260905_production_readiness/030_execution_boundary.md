# WP03 — one typed, actually used image-execution boundary

Status: P / future implementation design, independently rederived at ecde2bc79.
One PR outcome: classic, node, multimode and edit use one typed execution boundary that rejects missing direct Grok credentials and unsupported NAI multimode references before dispatch. Other observable behavior stays compatible until explicitly named later fixes.
Semantic prerequisite: WP01 getProviderSurfaceSupport and CoreProviderId. WP02 is UI selection/persistence, not server auth or admission ownership.
Stack base: WP02 tip, not “WP02 must already be merged”. WP04–06 can build above this standalone-green extraction.

## Loop-spec / scope

Archetype: behavior-preserving extraction. Trigger: four independently branching execution callers.
Goal: later family migrations change execution ownership through this seam; named behavioral corrections may require a bounded caller edit (WP05 sparse final sweep), not another four-pipeline dispatch rewrite.
Non-goals: new providers, general auth redesign, retry policy changes, streaming features, image persistence, lifecycle redesign, video/agent/sprite migration. Two named server admission fixes below are in scope; Grok search-off and Google reference-loss fixes are owned by WP05/WP06.
Verifier: baseline commands and runtime assertion matrix below.
Stop: all four real callers invoke the seam; import graph and local-fixture runtime assertions pass; parent independently audits.
Memory artifact: this doc + 002 research + parent C receipt. Terminal outcomes: verified extraction / blocked compatibility contract.
Upward escalation: incompatible WP01 surface types, missing wire oracle, or two failed packets goes to main.
Downward: no leaf delegation; any expanded future write scope requires parent P amendment.

Necessity decision: no-op/config cannot remove four dispatch chains. Reusing V1 is rejected: its optional unknown→JobHandle functions do not execute and conflate job admission with an image result. Chosen move: extract existing execution expressions, then migrate families in WP04–06. No universal task framework, DI container, new queue or capability registry.

## Exact change manifest

| Action | Path | Responsibility |
| --- | --- | --- |
| NEW | lib/providers/execution/types.ts | The complete contract below; no runtime imports or side effects |
| NEW | lib/providers/execution/admission.ts | Missing direct-key fail-closed check, NAI multimode reference refusal, exact surface mapping |
| MODIFY | lib/generationErrors.ts | Add GROK_API_KEY_MISSING to PASSTHROUGH_CODES and 401 classification; existing 4xx retry guard applies |
| NEW | lib/providers/execution/index.ts | Public prepareImageExecution function; delegates to currently selected implementation; preserves thrown error identity |
| NEW | lib/providers/execution/legacy.ts | Internal surface dispatcher; no HTTP/file/event state |
| NEW | lib/providers/execution/legacyClassic.ts | Move classic shared Grok preparation + current per-image execution/retry expressions |
| NEW | lib/providers/execution/legacyNode.ts | Move node's one-attempt provider expression, not its retry loop |
| NEW | lib/providers/execution/legacyEdit.ts | Move edit provider expression and native-result assignment |
| NEW | lib/providers/execution/legacyMultimode.ts | Move sequence dispatch and existing single-image sequence projections |
| MODIFY | lib/generatePipeline.ts | Replace preparation and generateOne dispatch at :411-564, remove concrete execution imports |
| MODIFY | lib/nodeGeneration.ts | Replace :300-392 expression inside existing attempt loop; retain retry/log/cancel/save ownership |
| MODIFY | lib/multimodePipeline.ts | Replace :366-487 branch chain; keep all persistence/progress closures and terminal recovery |
| MODIFY | routes/edit.ts | Replace :244-367 execution assignments; leave admission/validation/catch/save ordering intact |
| NEW | tests/provider-execution-boundary.test.ts | Real boundary with fixture transports, activation assertions |
| NEW | tests/provider-execution-routes.test.ts | Four real route registrations, temporary stores, deterministic upstream fixture |
| NEW | tests/provider-execution-imports.test.ts | TypeScript AST direct-import conformance, allowed/forbidden edge fixtures |
| MODIFY | docs/migration/runtime-test-inventory.md | Regenerate for the three new test files |
| MODIFY | structure/03-server-api.md | Current ownership and stream/persistence contracts |
| MODIFY | structure/05-node-mode.md | Node retry/reference policy remains caller-owned |
| MODIFY | structure/01-file-function-map.md | New execution file/function owners, no fictional V1 execution |
| MODIFY | structure/07-devlog-map.md | WP03 receipt and next family migration |

DELETE files: none. DELETE code: concrete provider dispatch chains and now-unused imports at the four callers; relocated bodies exist exactly once.
Generated runtime outputs: NEW the eight matching lib/providers/execution/*.js paths; MODIFY lib/generationErrors.js, lib/generatePipeline.js, lib/nodeGeneration.js, lib/multimodePipeline.js, routes/edit.js through server build only. Baseline git ls-files finds no tracked twins for generatePipeline/responsesImageAdapter, so do not add ignored emitted JS to git. They must nonetheless exist for package/runtime tests. No hand-edited JavaScript.

Approximate extraction size: ~430 existing execution lines relocate plus contract/tests. This one boundary outcome spans four callers by necessity; do not split into dead-interface-only PRs. Keep each new module under 400 lines, helpers under 50 where practical; exact legacy behavior takes precedence over unreviewed cleanup. No expansion into unrelated long caller bodies.

## Canonical contract (full new-file design)

File: lib/providers/execution/types.ts. Names below supersede the earlier ProviderExecutionInput/ProviderProgress draft. Both helpers and family executors import this file directly, never the index barrel.

```ts
import type { RuntimeContext } from "../../runtimeContext.js";
import type { CoreProviderId } from "../registry.js";
import type { validateAndNormalizeRefs } from "../../refs.js";
import type { NaiRequestOptions } from "../../naiOptions.js";
import type { ComfyQueueInfo } from "../../comfyImageAdapter.js";
import type { ResponseDiagnostics } from "../../responsesParse.js";

type CheckedRefs = Extract<
  ReturnType<typeof validateAndNormalizeRefs>, { refs: string[] }
>;
export type ExecutionReference = Pick<
  CheckedRefs["refDetails"][number], "b64" | "declaredMime" | "detectedMime"
>;
export interface ExecutionOptions {
  model: string;
  quality: string;
  size: string;
  moderation: string;
  mode: "auto" | "direct";
  reasoningEffort: string;
  webSearchEnabled: boolean;
}
interface ExecutionBase {
  provider: CoreProviderId; // resolved; never "auto" or an arbitrary string
  requestId: string | undefined;
  signal: AbortSignal;
  prompt: string; // effective prompt, including element/background/size text
  rawPrompt: string; // validated user prompt; non-target lanes currently use it
  references: ExecutionReference[]; // validated, not raw request.references
  options: ExecutionOptions;
}
export type ImageExecutionRequest = ExecutionBase & (
  | { surface: "classic"; providerUrl: string | null;
      background: { background: string; outputFormat?: string | undefined } | null;
      backgroundConstraint: string | undefined;
      nai: NaiRequestOptions;
      comfy: { seed?: number | undefined;
        params?: Record<string, number | string | boolean> | undefined } }
  | { surface: "node"; sourceImage: string | null;
      contextMode: "parent-plus-refs" | "parent-only";
      searchMode: "off" | "auto" | "on";
      partialImages: 0 | 2; nai: NaiRequestOptions }
  | { surface: "edit"; sourceImage: string; mask: string | null }
  | { surface: "multimode"; providerUrl: string | null;
      maxImages: number; nai: NaiRequestOptions }
);
export interface ExecutionImage {
  b64: string;
  revisedPrompt?: string | null | undefined;
  mime?: string | undefined;
  providerUrl?: string | undefined;
}
export interface SingleImageExecutionResult extends ExecutionImage {
  usage: Record<string, number> | null;
  webSearchCalls: number;
  text?: string | null | undefined;
  retryKind?: string | undefined;
  initialEventCount?: number | undefined;
  initialEventTypes?: Record<string, number> | undefined;
  hadReferences?: boolean | undefined;
  referencesDroppedOnRetry?: boolean | undefined;
  developerPromptDroppedOnRetry?: boolean | undefined;
  webSearchDroppedOnRetry?: boolean | undefined;
  promptId?: string | undefined;
  origin?: string | undefined;
  effectiveModel?: string | undefined;
}
export interface SequenceImageExecutionResult {
  images: ExecutionImage[];
  originalIndexes?: number[] | undefined; // aligned with images; absent means dense indices
  usage: Record<string, number> | null;
  webSearchCalls: number;
  extraIgnored?: number | undefined;
  error?: unknown;
  text?: string | null | undefined;
  eventCount?: number | undefined;
  eventTypes?: Record<string, number> | undefined;
  diagnostics?: ResponseDiagnostics | undefined;
}
export interface ExecutionProgress {
  onPartialImage?: (partial: {
    b64: string | undefined; index: number | null | undefined
  }) => void;
  onFinalImage?: (image: ExecutionImage, index: number) => void | Promise<void>;
  onQueue?: (info: ComfyQueueInfo) => void;
}
export type ImageExecutionResult =
  | { kind: "single"; value: SingleImageExecutionResult }
  | { kind: "sequence"; value: SequenceImageExecutionResult };
export type ExecutionSurface = ImageExecutionRequest["surface"];
export type ExecutionResultFor<S extends ExecutionSurface> =
  S extends "multimode"
    ? Extract<ImageExecutionResult, { kind: "sequence" }>
    : Extract<ImageExecutionResult, { kind: "single" }>;
export interface PreparedImageExecution<S extends ExecutionSurface> {
  execute(): Promise<ExecutionResultFor<S>>;
}
export type PrepareImageExecution = <R extends ImageExecutionRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress
) => Promise<PreparedImageExecution<R["surface"]>>;
```

index.ts exports `prepareImageExecution: PrepareImageExecution` and public types.
legacy.ts exposes the same internal signature; it switches the four surface literals and delegates. Helpers each take the narrowed Extract<ImageExecutionRequest,{surface:...}>, RuntimeContext and optional ExecutionProgress, returning the matching PreparedImageExecution.
Use overloads if implementation needs them to preserve result inference; do not solve this with unknown inputs, any refs or erased results.

Requests/results are in-process only. No JSON reviver, wire version, serialized signal or new stored enum is introduced.
Creation chain: existing validated caller values → request object → prepare closure → execute result → existing response/sidecar builders. Reference type comes from refs.ts; no second validator/schema. Consumers are exactly the four callers plus tests. Callback fields are populated from existing closures and never serialized. providerUrl remains separate from b64 refs so non-Grok code never sees a synthetic URL reference.

R1-03 reserved additive result field: `originalIndexes?: number[] | undefined`
belongs to SequenceImageExecutionResult (not ExecutionImage or request/metadata).
WP03 declares it but no legacy producer creates it; absence means current dense
array positions. WP05 creates an aligned array in grokMultimodeOperations at each
successful images.push, forwards the native result through grokExecution unchanged,
and explicitly modifies multimodePipeline's final sweep to consume the original
index (`generated.originalIndexes?.[position] ?? position`). Length equals images
length; entries are unique, increasing zero-based attempt indexes. Callback indexes
are never renumbered. Serialization/deserialization=N/A: in-memory seam only;
existing explicit persistence/SSE builders consume only image fields and the chosen
index, never spread/serialize the sequence result or add this array to sidecars.
Other family producers omit it and retain dense final sweep behavior. WP05 owns
the creation AND consuming correction and its route persistence tests together;
WP03's additive unused field alone does not claim the duplicate-output bug fixed.

## Preparation, retries and migration contract

### WP03 server admission fixes — settled owner contract

NEW admission.ts exports:
```ts
export function checkImageExecutionAdmission(
  ctx: RuntimeContext,
  input: {provider: CoreProviderId; surface: ExecutionSurface; referenceCount: number}
): {status: 400 | 401; code: "GROK_API_KEY_MISSING" | "NAI_REF_UNSUPPORTED";
    message: string} | null;
```
Import getProviderSurfaceSupport from ../derive.js, ProviderSurface from ../types.js. Map classic→generate, otherwise node/edit/multimode unchanged. Do not add classic to registry surface types.

Full decision order: if provider=grok-api and ctx.xaiApiKey missing/blank, return {status:401,code:"GROK_API_KEY_MISSING",message:"Grok API key is required for grok-api image generation"}. If provider=nai, surface=multimode, referenceCount>0 and getProviderSurfaceSupport(provider,"multimode")?.references===false, return {status:400,code:"NAI_REF_UNSUPPORTED",message:"NovelAI image generation does not accept reference images yet"}. Otherwise return null. No credential probe, fallback, logging or token-bearing error.

| Caller | Insertion / count | Rejection shape |
| --- | --- | --- |
| generatePipeline | After existing validation/ref refusals, before startJob; providerRefCount | existing fail(status,{error:message,code,requestId}) |
| nodeGeneration | After inputImageCount/context refusals, before startJob | HTTP status with {error:{code,message},code,parentNodeId,requestId}; update finishStatus/error/status |
| multimodePipeline | After normalized merged refs, before startJob; refCheck.refs.length | existing respondMultimodeValidationError with {error:message,code,status,requestId}; async JSON or legacy error SSE |
| edit route | After provider resolution, before existing startJob; source count 1 if present | HTTP status with {error:message,code,requestId,...errorEnvelopeFields({code,status})} |

These are new error branches; existing refusal envelopes stay unchanged: classic NAI refs 400 flat NAI_REF_UNSUPPORTED; node NAI input 400 nested error plus top-level code,parentNodeId; edit mask NAI_MASK_UNSUPPORTED precedes NAI_EDIT_UNSUPPORTED; Comfy node nested and multimode helper errors remain COMFY_SURFACE_UNSUPPORTED. Provider mask codes/labels unchanged. OpenAI missing key keeps existing API_KEY_REQUIRED 401 from transport, not a new pre-admission rule.

Before: missing direct Grok key becomes undefined and getGrokEndpoint selects proxy; valid NAI multimode refs pass validation then are ignored. After: 401/400 before admission with zero search/planner/image/process calls. E03-8 covers these as fixes, not baseline parity.

Credential race: prepare and each execute recheck only the direct-key invariant immediately before key resolution/capture. Missing now throws an Error with the same status/code/message, never passes undefined to the proxy selector. Classic retains its once-per-batch key capture after a valid check; if current context key becomes absent before execute, refuse instead of using a removed credential. Other key replacement behavior remains current capture semantics. Add GROK_API_KEY_MISSING to generationErrors.PASSTHROUGH_CODES (:6) and statusForErrorCode (:138) returning 401; isNonRetryableGenerationError already rejects finite 4xx status (:134), so test that existing path rather than inventing a nonexistent non-retryable set. Preserve raw code through route normalization. Family migrations keep this wrapper in execution/index, not alternate family gates.

Required proof: RED baseline fixture observes a proxy request for missing grok-api key and NAI transport invoked with ignored refs; GREEN same inputs assert new code/status, no owned job, zero transport. Test absent, whitespace-only and removed-after-prepare keys; positive grok proxy without key and grok-api with invented key prove no overbroad rejection. Reference fixture must be valid bytes so generic ref validation does not mask the target guard. This is WP03's named admission fix; WP02 remains UI-only.

prepare preserves ctx object identity. It must not call validateAuth from V1 or resolveProviderOptions again. No global cache of context/credentials. It performs only the existing classic Grok plan before returning the executable closure; all other work waits for execute. Classic Grok directApiKey is captured at the same preparation point as today. Node/edit/multimode resolve it at their existing execution point.

classic execute = one output, including existing OpenAI-only outer retry (MAX_RETRIES=1). Move that bounded loop verbatim to a classic helper, preserving isNonRetryableGenerationError, normalizeGenerationFailure and retry logs. Non-OpenAI calls receive no new outer retry. The inner OAuth fallback remains in its original transport helper until WP04 relocation.

node prepare = no provider work; execute = one existing provider attempt. Existing maxAttempts=inputImageCount>0?1:2 and catch/log/normalize stay in nodeGeneration. edit execute = one call, no planner for Grok. multimode execute = one existing sequence operation, **not** maxImages parallel single calls.

No new generic error type, retry scheduler or error-normalization adapter. Errors thrown by the wire functions pass through the execution boundary as the same object; outer route code owns status/envelope decisions. Unexpected branch errors are programmer errors, never an OAuth fallback.

Exact generationErrors delta for the new admission code:
```diff
 const PASSTHROUGH_CODES = new Set([
+  "GROK_API_KEY_MISSING",
   "OAUTH_UNAVAILABLE",
```
```diff
 export function statusForErrorCode(code: string, fallback = 500) {
+  if (code === "GROK_API_KEY_MISSING") return 401;
```
No NON_RETRYABLE_CODES constant exists here: isNonRetryableGenerationError already returns true for this error's 401 status. Tests independently assert statusForErrorCode=401, isNonRetryableGenerationError=true, and normalizeGenerationFailure preserves GROK_API_KEY_MISSING rather than collapsing it to a safety error.

Until WP04–06, the legacy module exclusively owns the moved branches. During a family migration index selects that family's prepare function once by resolved provider; the same family branches are removed from all four legacy helpers. Introduce a distributive LegacyExecutionRequest narrowing its provider to the not-yet-migrated set, so removed OpenAI fallback cannot become a catch-all for unsupported lanes. WP06 leaves Atlas/MiniMax/NAI/Comfy in those helpers; this is an explicit scoped remainder, not a claim of full provider migration.

## Caller edits — anchored before/after

### Classic, lib/generatePipeline.ts:411-564

Before: sharedGrokPlan conditional, a generateOne containing all provider ifs and Responses retry.
After, **at the same point after admission/phase/log/mkdir**:

```ts
const execution = await prepareImageExecution(ctx, {
  surface: "classic", provider: activeProvider, requestId,
  signal: cancelController.signal, prompt: generationPrompt, rawPrompt: prompt,
  references: refCheck.refDetails, providerUrl: incomingProviderUrl,
  options: { model: imageModel, quality, size: effectiveSize, moderation,
    mode: normalizedPromptMode, reasoningEffort, webSearchEnabled },
  background: backgroundParams,
  backgroundConstraint: backgroundPreset
    ? backgroundPlannerConstraint(backgroundPreset) : undefined,
  nai: readNaiOptions(req.body),
  comfy: { /* existing conditional seed/params extraction, no new defaults */ },
}, { onQueue: existingQueueCallback });
const generateOne = async () => {
  const { value } = await execution.execute();
  throwIfJobCanceled(requestId);
  return value;
};
const results = await Promise.allSettled(Array.from({ length: count }, generateOne));
```

existingQueueCallback is the extracted existing closure, not a new external symbol.
Move its body unchanged from :509-515. readNaiOptions must remain lazy for the NAI lane: populate nai with `activeProvider === "nai" ? readNaiOptions(req.body) : {}` if eager parsing can throw; apply the same rule at node/multimode. Preserve all pre-admission refsCount checks, size/background validation, alpha-before-any-write, byte-MIME detection, provider-specific filename/sidecar model expressions, result aggregation and idempotency.

### Node, lib/nodeGeneration.ts:278-413

Before: one ternary chain inside the attempt loop.
After: build a node request after parent/ref validation; prepare once without doing network work; inside the same try/attempt log use `const {value:r}=await execution.execute();`, then unchanged throwIfJobCanceled, b64 assignment, MIME logic and break.

Populate references with **all** refCheck.refDetails, sourceImage with parentB64, contextMode with validated non-ancestry value, searchMode with normalized searchMode and partialImages with emitProgress?2:0. legacyNode computes filtered refs for OpenAI/Grok; it deliberately retains baseline Agy/Gemini exceptions documented in 002. Do not pass only refsForRequest and lose information needed to preserve Gemini's baseline behavior.

Keep partial closure at the caller:
```ts
onPartialImage: partial => {
  if (isJobCanceled(requestId)) return;
  const pd = { requestId, image: dataUrlFromB64(format, partial.b64 ?? ""),
    index: partial.index };
  if (streamResponse) writeSse(res, "partial", pd);
  publish(requestId, "partial", pd);
}
```
Only attach that callback when emitProgress is true. EditViaResponses does not acquire partial streaming.

### Multimode, lib/multimodePipeline.ts:366-487

Before: native sequence/one-image provider chain.
After: request surface=multimode, raw/effective prompt, refDetails, providerUrl, maxImages, lazy nai options; `const {value:generated}=await (await prepareImageExecution(ctx, request, progress)).execute();`.
Keep existing callbacks at caller. onPartialImage copies :470-475 byte-for-byte; onFinalImage copies :477-480 and awaits persistAndSendImage. WP03 keeps generated.images sweep, persistedIndexes, latestUsage assignment timing, sparse Grok indexes and timeout-after-partials catch unchanged. This preserves the known sparse callback/compact sweep mismatch until WP05's explicitly mapped caller correction; do not claim sparse no-duplicate parity at WP03. Use inferred canonical SequenceImageExecutionResult from execute, not the old inline generated type which would erase originalIndexes at WP05.

### Edit, routes/edit.ts:244-367

Before: provider branch with repeated result variable assignments.
After: surface=edit, sourceImage=imageB64, mask=maskCheck.mask, references=[], rawPrompt=prompt, prompt=prompt, resolved options and existing signal.
`const {value:r}=await (await prepareImageExecution(ctx, request)).execute();`.
Assign resultB64=r.b64, usage=r.usage, revisedPrompt=r.revisedPrompt??undefined, webSearchCalls=r.webSearchCalls, resultMimeFromProvider=r.mime, providerUrl=r.providerUrl??null.
The original branch already coalesces Responses usage/search; retain these defaults in the result projection, not in arbitrary provider payloads. No partial callback or 202 conversion. Admission remains before validation.

## Full legacy extraction rules

- Classic source span and option values: generatePipeline :411-564. Use supplied backgroundConstraint and background, preserve NAI options and Comfy params/queue.
- Node source: nodeGeneration :300-392. Retain rawPrompt for Atlas/MiniMax/NAI, effective prompt for OpenAI/Grok/Google; parent MIME policy remains current; reuse toGrokReferences rather than copying it.
- Edit source: routes/edit :251-367. Prefix effective prompt only in image-to-image single-call lanes; Grok/OpenAI keep raw prompt and specialized edit entrypoints.
- Multimode source: multimodePipeline :367-487. Google/Atlas/MiniMax/NAI projection still omits mime/providerUrl as today; byte detection remains downstream. Forward native Grok/Responses sequence results without discarding error/diagnostics.
- The seam does not infer “edit” from nonempty references: node Grok generation+refs requires a planner; edit route Grok does not. Surface discriminant prevents this conflation.
- Keep existing transport setJobPhase effects. “Boundary owns no lifecycle” means no **new** start/finish/publish ownership, not pretending low-level parser phase updates do not exist.

## Acceptance activation matrix — independent assertions

New runtime files use node:test, fetch stubs restored in finally/afterEach, temporary generated/log/DB roots, and real route registration. No production injection flags. Existing V1 tests are not execution tests.

| ID | Constructible trigger | Independently asserted outcome |
| --- | --- | --- |
| E03-1 | Each of four real endpoints with provider=api, distinctive model/quality/size/refs fixture, fake Responses SSE | Exactly one matched network route; explicit request fields, unchanged JSON/SSE envelope; sidecar fields compared to literal fixture expectations |
| E03-2 | Classic grok n=3 with fixture search/planner/images/download | Search=1, planner=1, image POST=3; no new plan per image; max search aggregation unchanged |
| E03-3 | Node no-parent/no-refs: first retryable empty then image; child with parent: same empty | Root executes 2 attempts; child 1. Classic non-OpenAI retryable error remains 1; classic API retry stays 2; hard refusal exits early |
| E03-4 | Responses upstream final items A, A, B with distinct image bytes for A and B | Existing parser dedupes repeated A before assigning indices: callbacks exactly [0,1], two returned images and two persisted outputs. Awaited callbacks plus dense sweep create no duplicate files. Do not change Responses b64 dedupe; identical-content distinct outputs are tested only in reachable Grok G05-7. |
| E03-5 | Abort via real inflight cancel while provider promise held, then resolve provider | Signal observed aborted; no final saved file/done; existing GENERATION_CANCELED envelope. Pre-start refusals issue zero provider requests |
| E03-6 | Node partial then final in legacy SSE and async eventbus modes | Exact partial payload including index and MIME; one final; no fabricated search/planner events |
| E03-7 | Classic fake Comfy queued then running callbacks | Exact queued/streaming phases and queuePosition; sync classic does not emit async phase payload |
| E03-8 | NAI refs/edit/mask, Comfy node/multimode, unsupported ancestry | WP01-preserved and WP03-added exact codes/status/envelopes and zero upstream calls; do not activate through an earlier unrelated validation failure |
| E03-9 | Classic transparent batch: first alpha image, second opaque | No persisted output from either; existing transparent failure. Distinct mime header/byte fixture preserves authoritative-byte rule |
| E03-10 | Distinct retries metadata / providerUrl / Comfy promptId+origin / sequence all-failed error | Literal values survive result-to-existing-sidecar/API where currently consumed; thrown object identity preserved at seam |
| E03-11 | Temporary TS snippet imports concrete generate adapter from caller versus from execution | AST guard rejects caller edge, permits internal edge; actual four caller imports clean; not a prose-string test |

Do not copy expectations from execution result or refresh snapshots from DUT. Use hand-authored request/frame/sidecar values. Existing source-text tests that assert old dispatch strings must be reclassified and replaced with behavior checks in their **own named file** after P reinspection; do not delete them wholesale. Exact impacted tests are discovered by the import/string search below and folded into the manifest before B if necessary.

Observed lexical-test migration manifest (MODIFY, not blanket deletion): tests/edit-mask-api-contract.test.js:50 and tests/oauth-proxy-edit-mask-contract.test.js:42 assert route-local editViaResponses; tests/multimode-backend-contract.test.js:40 asserts route-local generateMultimodeViaResponses. In WP03 replace only those direct-dispatch assertions with AST import-edge assertions proving the route calls prepareImageExecution, while tests/provider-execution-routes.test.ts proves actual mask forwarding and sequence behavior. Preserve mask validation/legacy OAuth rejection and sequence metadata assertions. This keeps them source-only JS contracts; runtime assertions live in the new TS files. WP04 subsequently redirects remaining adapter-body assertions to the moved body/transport owners, as specified in 040.

## Commands / baseline / visibility

Baseline: npm run typecheck=0; npm run typecheck:tests=0; npm run test:inventory=0; seven-file command in 002=0 (51/51).
These validate current source/test inventory only; none exercises a new execution seam yet.
WP00 A round1 recompiled this canonical fenced contract (including originalIndexes)
with actual repository imports using a virtual CompilerHost/noEmit: `node
--input-type=module` exited0, diagnostics=[]. No source file or runtime was emitted.

Future C commands (new test files do not exist at WP00, so no fabricated baseline exit):
```sh
node --import tsx --test tests/provider-execution-boundary.test.ts tests/provider-execution-routes.test.ts tests/provider-execution-imports.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
git diff --check
```
New tests are direct command arguments. Compiler includes lib/**/*.ts/routes/**/*.ts; test compiler includes tests/**/*.test.ts. Inventory compares tests to its generated Markdown. Neither compiler proves prose correctness.
Source consistency discovery:
```sh
rg -n 'generateViaResponses|generateViaGrok|generateViaAgy|generateViaGeminiApi|generateMultimodeVia' tests lib routes --glob '*.ts' --glob '*.js'
```

Paired-JS stale risk: implementation C must run npm run build:server (writes generated artifacts; intentionally NOT executed in docs-only WP00) before tests loading .js, or document a verified all-TS loader alternative. Root package script/tsconfig.build.json exist and include new lib/**/*.ts. Full suite and package/release builds belong exact-head CI/authorized remote environment.

## Compatibility, rollback, SoT and enforcement boundary

Existing successful HTTP/CLI/SSE/stored schemas stay unchanged; the two new admission errors are specified above. No fallback provider is introduced. The missing direct-key presence/blank check is the only new auth check; no credential probes, token logging or raw upstream-body logging. Fixture images prove plumbing, not upstream availability.

Before SoT: four pipelines are documented as direct concrete-adapter callers.
After SoT: structure/03-server-api.md records prepare/execute and the split between execution vs admission/persistence/events; structure/05-node-mode.md records parent/refs and retry exceptions; file map names eight execution modules; roadmap links the receipt. Inventory is regenerated, not manually counted. General docs are future implementation writes, outside this leaf's WP00 scope.

Rollback before dependents: parent reverts WP03 source commit and rebuilds emitted runtime. After WP04–06 exist, revert dependent migrations in reverse order or prepare a forward repair; never restore one caller to a mixed duplicate execution path. No files in generated user storage, history, credentials or job DB are deleted; no data downgrade migration exists.

Conformance tier: E7 review + test/CI execution (early warning), executing surface=node test runner/parent CI, bypass=not running checks or untyped external imports, residual=other agent/sprite direct callers intentionally retained, wording=not universal enforcement, final unbypassable layer=none.
