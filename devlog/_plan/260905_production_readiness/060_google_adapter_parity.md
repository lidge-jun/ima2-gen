# WP06 — Google execution ownership and lossless node references

Status: WP06 P, revalidating the locked roadmap at54543ee0 (WP05 verified tip).
One PR outcome: agy and gemini-api use actual family-owned operations, and node input-image policy is faithfully executed instead of silently dropping/overriding selected references.
Semantic dependency: WP03 typed request/progress/result contract + WP01 supported-reference contract. WP02 is UI selection/persistence only.
Stack base: WP05 tip. Test prerequisite: WP05's canonical scripts/run-tests.mjs module-mock activation and Node22/24 child-invocation proof (R1-01). No source-level dependency on OpenAI or Grok implementation details.

## Loop-spec / explicit fixes

Archetype=family extraction with bounded reference-policy correction. Trigger=Google branches in four legacy helpers plus baseline node/Agy input loss.
Goal=all promised input images reach the selected Google lane, with exact public/Vertex wire format and safe cancellation boundaries.
Non-goals=provider catalog expansion, prompts redesign, real agy launch, paid generation, native mask editing, making multimode issue N billed calls, universal transport framework.
Verifier=real new execution owner with fixture transports and local fake process; acceptance below.
Stop=both Google lanes/all four surfaces covered, original exports preserved, no unexplained input loss; parent independently reviews.
Artifact=this doc + 002 + parent C receipt. Outcomes=verified migration / blocked contract or test isolation.
Main owns scope escalation and two-failed-packet reclaim; no leaf subagents/state/git.
Resource bound: existing repository/GitHub credentials and fixture-only local
process/HTTP scope; no real Agy executable, Vertex token, provider request or paid
generation. Local focused tests/typechecks/builds only, canonical suites on exact
head hosted CI. Reassess this WP at4hours and the whole goal at72hours; no numeric
token budget was requested. Parallel workers use the current Astra/high convention;
the tool has no service-tier override, so priority is not independently asserted.

Authorized corrections, not accidental parity drift:
1. Node Agy root now receives context-filtered supplementary refs; child receives parent first plus those refs.
2. Node Gemini honors parent-only by excluding supplementary refs, while parent-plus-refs sends parent first plus selected refs.
3. Required image-count preflight must match actual sent list; no clipping a valid parent+refs request after a different count was admitted.
All non-node prompt/reference behavior and provider wire defaults remain unchanged.
The additional Agy cancellation/staging exception-safety corrections are explicitly
defined in061; they supersede relocation-only lifetime wording below. Artifact
symlink/canonical containment is a separately registered066/wp06s outcome, not
claimed fixed by this WP. Current before evidence is061 and its actual-route probe.

## Exact change manifest

| Action | Path | Design |
| --- | --- | --- |
| NEW | lib/providers/adapters/googleExecution.ts | prepareGoogleExecution; bounded surface/reference mapping shared by agy/gemini-api |
| NEW | lib/providers/adapters/geminiOperations.ts | Move actual Gemini endpoint/auth/wire/parse body and helpers |
| NEW | lib/providers/adapters/agyOperations.ts | Move actual generation orchestration, prompt builder, temp reference staging and cleanup |
| NEW | lib/agyArtifact.ts | Move parseAgyOutput and findRecentAgyArtifact implementations |
| NEW | lib/agyProcess.ts | Move spawnAgy + timeout/output-limit/error handling |
| MODIFY | lib/agyImageAdapter.ts | Compatibility re-export generateViaAgy, AgyGenerateResult, findRecentAgyArtifact |
| MODIFY | lib/geminiApiImageAdapter.ts | Compatibility re-export generateViaGeminiApi and GeminiApiGenerateResult |
| MODIFY | lib/providers/execution/index.ts | Select googleExecution for agy/gemini-api |
| MODIFY | lib/providers/execution/legacy.ts | Exclude both Google lanes from remaining provider set |
| MODIFY | lib/providers/execution/legacyClassic.ts | DELETE Google branches |
| MODIFY | lib/providers/execution/legacyNode.ts | DELETE Google branches; replaced reference fix lives in googleExecution |
| MODIFY | lib/providers/execution/legacyEdit.ts | DELETE Google branches |
| MODIFY | lib/providers/execution/legacyMultimode.ts | DELETE Google branches |
| MODIFY | config.ts | Central AGY_PROCESS_POLICY constants defined in061 |
| NEW | tests/google-execution-parity.test.ts | Request/reference/result/error cases through actual boundary |
| NEW | tests/agy-execution-process.test.ts | Fake local executable lifecycle, refs, cancel and cleanup |
| NEW | tests/fixtures/agy-fixture.mjs | Deterministic fixture process, no provider/network/credential access |
| MODIFY | tests/provider-execution-imports.test.ts | Google imports real operations, not facades; legacy Google arms absent |
| MODIFY | docs/migration/runtime-test-inventory.md | Two new runtime tests |
| MODIFY | structure/03-server-api.md | Google ownership and single-result sequence behavior |
| MODIFY | structure/05-node-mode.md | Parent-only/parent-plus-refs now matches actual transport |
| MODIFY | structure/01-file-function-map.md | Moved operation/artifact/process owners |
| MODIFY | structure/07-devlog-map.md | WP06 evidence and remaining legacy lanes |

DELETE files: none. Four callers stay on the integrated seam, including WP05's explicit original-index final-sweep correction; reference fix consumes existing node contextMode/sourceImage/references fields. Google emits dense one-image sequences without originalIndexes, so final sweep still uses position 0. Do not revert the WP05 caller fix.
Generated runtime: NEW five JS twins; MODIFY facades, index and five legacy JS modules only by build. Do not commit ignored generated files. No dependency, auth store, persisted schema or general UI edit.

## Full new-file designs

### googleExecution.ts

```ts
type GoogleRequest = ImageExecutionRequest & { provider: "agy" | "gemini-api" };
export function prepareGoogleExecution<R extends GoogleRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress
): Promise<PreparedImageExecution<R["surface"]>>;
```

Prepare never starts a CLI/token lookup/network request. Execute dispatches to **moved operation bodies**, not old facade imports.
Preserve capture timing: classic snapshots effective prompt/model/size/requestId
at prepare, while signal/references and credentials are read at execution as in
legacyClassic. Node/edit/multimode derive prompt/options/refs at each execution.
Tests mutate distinguishable request fields between prepare/execute to observe
this distinction; do not eagerly copy credentials or tokens into a prepared object.
Progress is accepted for the common contract but these single-result operations emit no partial/final callback themselves. Multimode still returns one image and caller final sweep persists it; don't invent stage=request/decode events.
Helpers are private, bounded functions: `googleInput(request):{prompt:string;references:ExecutionReference[]}`, `runGoogleImage(ctx,request,input):Promise<SingleImageExecutionResult>`, and single-to-sequence projection.
Edit source descriptors use the existing MIME detector. Node parent descriptors
retain declaredMime=null/detectedMime=null; the operation detects MIME as before.
Do not add duplicate schema validation or change metadata merely during relocation.

| Surface | Prompt | References |
| --- | --- | --- |
| classic | request.prompt (effective) | request.references |
| edit | "Edit this image: " + request.prompt | One source image, detected MIME or null, declaredMime=null |
| node root | request.prompt | contextMode=parent-only ? [] : request.references |
| node child | "Edit this image: " + request.prompt | Parent first with nullable MIME metadata, then context-filtered references |
| multimode | request.prompt | request.references; one native call, not maxImages calls |

Gemini options: model, size, signal, requestId, references. Agy options: references, signal, requestId; no invented model/size knobs (providerOptions currently resolves fixed Agy defaults).
For node, filtered count must equal caller inputImageCount so admitted refs are not silently sliced. Route's existing deriveReferenceLimit guard remains; lower-level slice remains a compatibility fallback for direct API callers but does not hide an admission mismatch in migrated routes.
Return single native fields unmodified. For multimode retain the existing projection `images:[{b64,...revisedPrompt}],usage,webSearchCalls`; deliberately do not add a metadata format change during this extraction.

### geminiOperations.ts

Move the entire existing lib/geminiApiImageAdapter.ts (all ~268 lines) with imports rebased to ../../. Export names and signatures preserved:
```ts
export interface GeminiApiGenerateResult {
  b64: string; revisedPrompt?: string;
  usage: Record<string, number> | null; webSearchCalls: number; mime?: string;
}
export async function generateViaGeminiApi(
  prompt: string, ctx: RuntimeContext,
  options: {model?:string;size?:string;signal?:AbortSignal;
    requestId?:string;references?:GeminiApiRefDetail[]} = {}
): Promise<GeminiApiGenerateResult>;
```
GeminiApiRefDetail and model/enum tables, parseGeminiImageParams, toV1BetaImageFormat,
resolveGeminiModelId, buildContents, geminiApiError stay private in this module.
No import from googleExecution or compatibility facade.

Preserve API key versus initialized Vertex choice at execution time; do not copy token/project into seam request/result.
Public: generativelanguage v1beta, x-goog-api-key, generation_config.response_modalities and response_format.image aspect_ratio/image_size enums.
Vertex: aiplatform v1 global project URL, Bearer access token, generationConfig.responseModalities and imageConfig plain strings.
size=auto omits image config; aliases and image part extraction/usage names remain exact.

### agyProcess.ts

Move spawnAgy from :165-239; centralize inherited deadline/output policy and new
termination grace as specified in061.
Export `spawnAgy(prompt:string,signal?:AbortSignal):Promise<{stdout:string;stderr:string}>`.
Preserve resolveAgyBin/buildAgyPathEnv, spawn argv [-p,-], restricted environment
shape, stdin delivery and output collection. Replace early cancel rejection with
061's pre-abort/TERM→KILL/close-observed settlement and shared timer/listener cleanup.
Move the existing agyError constructor to this module and export it for artifact/operations (same status/code contract, no new normalization).
This module imports neither agyOperations nor googleExecution, so no cycle.

### agyArtifact.ts

Move parseAgyOutput :69-120 and findRecentAgyArtifact :122-162. Export both with unchanged signatures; import agyError from agyProcess for its error shape, filesystem/path/os helpers as before.
No credential discovery; default scan roots remain original operation behavior. Tests always pass explicit temporary roots.
No claim that existing lexical allowlist/path scan is symlink-proof; security improvements require a separately named patch, not relocation.

### agyOperations.ts

Move AgyGenerateResult, buildAgyPrompt and AGY_OUTPUT_RESOLUTION, RefDetail/MIME_TO_EXT,
writeRefsToTempFiles, cleanupAgyArtifact and generateViaAgy :287-403.
Import spawnAgy/agyError from ../../agyProcess, parseAgyOutput/findRecentAgyArtifact from ../../agyArtifact, remaining helpers from their existing canonical modules.
Signature unchanged:
```ts
export async function generateViaAgy(
  prompt: string,
  options: {references?:RefDetail[]|undefined;signal?:AbortSignal|undefined;
    requestId?:string|undefined} = {}
): Promise<AgyGenerateResult>;
```
Preserve artifact fallback only on AGY_PARSE_FAILED, lexical path checks and result
vocabulary. Add061's exception-safe staging and cancellation barriers;066 later owns
canonical artifact confinement. AGY_MALFORMED_RESULT is not a fallback trigger.
Splitting process/artifact owners keeps new files below 400 lines rather than moving a >400-line monolith.

### fixtures/agy-fixture.mjs

Full fixture behavior: read stdin to end; parse staged reference paths from expected prompt payload, fail if a listed file cannot be read; emit `RESULT|<absolute-test-artifact-path>|png` for a synthetic PNG inside the test-owned temporary root. Accept controlled test scenario through a fixture-owned JSON file in its temporary home (spawn filters environment), not new production flags: success, no-artifact, malformed-output, wait-for-abort. In wait scenario, signal readiness over stdout then await SIGTERM; never call real agy or network. Child environment points all HOME/USERPROFILE/TMPDIR/TEMP values to the test's temporary root. Test harness selects fixture with existing IMA2_AGY_BIN; no new production configuration switch.
Use a tiny executable launcher generated in the test temp directory if needed on Windows; test fixture source is checked in, runtime files are test-owned and cleaned up.

## Before/after patches

Node before, from nodeGeneration.ts:311:
```ts
await generateViaAgy(parentB64 ? `Edit this image: ${generationPrompt}` : generationPrompt, {
  ...(parentB64 ? { references: [{ b64: parentB64, declaredMime: null, detectedMime: null }] } : {}),
  signal: cancelController.signal, requestId,
});
```
After, in googleExecution's node mapper:
```ts
const selectedRefs = request.contextMode === "parent-only" ? [] : request.references;
const refs = request.sourceImage
  ? [{ b64: request.sourceImage, declaredMime: null, detectedMime: null }, ...selectedRefs]
  : selectedRefs;
const prompt = request.sourceImage ? `Edit this image: ${request.prompt}` : request.prompt;
```
Both Agy/Gemini consume this same effective ref list. Node caller keeps its outer retry and saveNode/MIME policy; only actual transmitted refs are corrected.

Facades after:
```ts
// lib/agyImageAdapter.ts
export { generateViaAgy, type AgyGenerateResult } from "./providers/adapters/agyOperations.js";
export { findRecentAgyArtifact } from "./agyArtifact.js";
// lib/geminiApiImageAdapter.ts
export { generateViaGeminiApi, type GeminiApiGenerateResult } from "./providers/adapters/geminiOperations.js";
```
Index selects two exact lane ids. Remove Google arms from legacy and narrow the remainder to Atlas/MiniMax/NAI/Comfy. V1 remains a separate control-plane catalog, not newly generating through unknown→JobHandle.

## Acceptance activations and independent assertions

| ID | Constructible activation | Required observable assertion |
| --- | --- | --- |
| Q06-1 | agy node root with distinct ref A; child parent P + refs A/B | Fake process observes A, then P/A/B in correct order; bytes read equal independent fixture bytes, not just path count |
| Q06-2 | Both lanes parent-only with parent P and supplied refs A/B; root parent-only | Child gets only P; root gets none; inputImageCount/refsCount policy remains consistent, no silent selected-image loss |
| Q06-3 | Parent+refs at accepted cap and one over cap | Exact accepted refs all reach transport; over-cap rejected before process/token/fetch; existing AGY_REF_TOO_MANY / baseline Gemini route code preserved unless parent separately changes public vocabulary |
| Q06-4 | Public Gemini key with 1024x1024 and auto-size | Explicit v1beta URL, header, enum values; auto omits response_format; no Vertex token read |
| Q06-5 | Initialized fake Vertex state and explicit vertex mode, distinct public key sentinel | Vertex URL/project/auth and camelCase config; no key in URL/result; auth reads stub state only, not real service-account files |
| Q06-6 | Gemini inline images with distinct mime/text/usage, safety finishReason, no image, HTTP429/403 | Exact returned bytes/mime/usage and GEMINI_API_SAFETY_BLOCKED/NO_IMAGE/RATE_LIMITED/BAD_REQUEST; unchanged caller error envelope |
| Q06-7 | Gemini fetch rejects AbortError after external abort; controlled TimeoutError fixture | Cancel becomes 499; timeout classification is observed explicitly. If timeout contract is corrected, amend exact expected code before implementation, never claim existing AbortError check handles TimeoutError |
| Q06-8 | Agy success/malformed output/missing artifact/path rejected/abort | Only owned fake executable, never real Agy; exact AGY_MALFORMED_RESULT/AGY_PARSE_FAILED/AGY_ARTIFACT_NOT_FOUND/AGY_PATH_REJECTED or GENERATION_CANCELED;061 adds native child-close, stubborn termination, partial-staging and late-read barriers |
| Q06-9 | Agy parsed-output fails but recent fixture artifact exists in explicit temp root | Fallback only on AGY_PARSE_FAILED, not malformed RESULT or other failures; matching file consumed; existing directory-symlink negative retained, file-symlink residual belongs066 |
| Q06-10 | Multimode maxImages=3 for each lane | Exactly one native execution, one output, existing partial sequence status; no fabricated partial-image callbacks or extra billed calls |
| Q06-11 | Existing mask and NAI/Comfy refusals through real routes | Zero Google execution on rejected requests, exact established code/envelope; no capability reinterpretation by executor |
| Q06-12 | Imports through old facade versus new owner | Same function identity in built graph; real body not duplicated; no family source imports facade |

Use valid small image fixtures for filesystem/metadata tests, invented keys, isolated auth objects. Vertex branch testing uses node:test mock.module on the emitted lib/vertexAuth.js URL before dynamic import of emitted geminiOperations.js: isVertexInitialized=()=>true, getVertexAccessToken=async()=>"fixture-token", getVertexProjectId=()=>"fixture-project". Restore mocks afterward; no real initialization/token/credential read. Both focused commands and canonical npm test must enable --experimental-test-module-mocks through WP05's scripts/run-tests.mjs change. Local Node v24.17.0 preflight proves only capability; it is not Node22/24 CI or Q06-5 proof. tests/test-runner-invocation.test.ts from WP05 must pass on both existing CI runtime legs with the flag not inherited from NODE_OPTIONS/parent execArgv. Fail rather than skip when mock.module is unavailable. Baseline existing wire test only covers public API, so Q06-5 is **new required coverage**, not already proved.

Agy fixture isolation must be established before spawn; no inherited credential/config roots. On success/failure/cancel, wait for child close and cleanup receipts, not a sleep. Existing agy-artifact tests prove only search behavior, not process cleanup.

## Observed baseline and future commands

Observed in WP00: typecheck=0, typecheck:tests=0, test:inventory=0; seven-file focused command in 002=0 (51/51).
That includes gemini-api-wire-contract (public wire only), agy-artifact-fallback (explicit temporary roots) and agy-cli path tests. No real agy generation or Vertex token call was made.
Future files are unavailable at WP00, so these commands have no invented success exit:
```sh
node --experimental-test-module-mocks --import tsx --test tests/google-execution-parity.test.ts tests/agy-execution-process.test.ts tests/gemini-api-wire-contract.test.ts tests/agy-artifact-fallback.test.ts tests/agy-cli.test.ts tests/provider-execution-routes.test.ts tests/provider-execution-imports.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
git diff --check
```
Direct args observe new test modules; production compiler includes lib/**/*.ts and route wrappers; no tool claims prose tested. Build matched server JS before runtime imports; build:server exists but was not run in docs-only WP00. Parent owns exact-head full suites/CI.
WP06 closure additionally requires canonical `npm test` on its own exact-tip
Node22.23.0 and Node24.17.0 CI legs, with Q06-5 executed (no skip), plus inherited
runner child-invocation test. No WP12 runner repair or later cumulative pass can
substitute for this standalone WP06 gate. Runner implementation remains WP05's
owner; no duplicate runner patch is introduced here.

## Field chain, compatibility, SoT and rollback

No new wire/persisted fields. Existing references/contextMode creation in node route → canonical typed request → googleInput → temp image files or Gemini inlineData → native result → caller saveNode/sidecar/API. Body-reference validation remains HTTP boundary; provider native formats remain transport boundary. Effective input list is the deliberate bug fix; stored user prompt, element notes/ids, filenames, usage vocabulary and error envelopes are unchanged.
Single-result sequence projection remains current behavior, not an assertion that Google supports true streamed multi-image output.

SoT before: Agy node can discard references; Gemini ignores parent-only in actual payload.
After: structure/05-node-mode.md documents matched input-image policy for both lanes; structure/03 documents actual owner/one-output sequence behavior; file map and 07 update function ownership/receipt. Do not label API/Vertex/Agy availability live-verified from fixtures.

Rollback restores WP05 legacy Google arms, original body locations and rebuilds runtime together. Parent records restoration of the input-loss defect, so readiness gate becomes unmet; no data migration or user-file deletion. Context/auth remains unchanged. Upper layers revalidate through parent.
Import/fixture checks are E7/CI early warning; bypass=skipped tests; residual=live provider entitlement and process behavior outside fixture unverified; wording=bounded local contract proof; final unbypassable enforcement=none.
