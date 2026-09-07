# WP04 — audited-owner build map and executable oracles

Companion to040/041. This is the same WP04 cycle, no implementation yet.
Source baseline d039b587. Preserve scripts/recording and all unrelated work.

## Exact B write ownership

| Owner | Exclusive writes |
| --- | --- |
| Main | execution/index.ts, execution/legacy.ts; tests/_executionRouteHarness.ts and tests/provider-execution-harness.test.ts for tracked direct work; SoT/inventory/devlog/evidence and all git/FSM/goal operations |
| Transport/types | NEW lib/responsesTransport.ts and lib/providers/adapters/openaiTypes.ts |
| Operations/facade | NEW lib/providers/adapters/openaiOperations.ts; MODIFY lib/responsesImageAdapter.ts |
| Family execution | NEW lib/providers/adapters/openaiExecution.ts; MODIFY execution/legacyClassic.ts, legacyNode.ts, legacyEdit.ts, legacyMultimode.ts |
| Runtime tests | NEW tests/openai-execution-parity.test.ts, tests/openai-transport-parity.test.ts |
| Contract/mock migration | MODIFY tests/_executionBoundaryProbe.ts, _executionImportEdges.mjs, provider-execution-imports.test.ts and exact existing files below |

All source paths above are repo-relative. Existing040 manifest applies too.
Five independent B workers use explicit gpt-6-astra/high, no grandchildren. Main
first lands shared narrowed legacy type/guards; transport and operations workers
read the original source using `git show d039b587:lib/responsesImageAdapter.ts`
if the concurrently replaced facade no longer contains the old bodies. Never
copy from an already truncated working-tree facade or redefine dependencies.
No shared builds/compiler runs by workers; main coordinates aggregate gates.
No new dependency, production injection option, queue or lifecycle mechanism.

### Shared signatures and helper names

`openaiTypes.ts`: exported ReferenceRef/GenerateOptions, exact original optional
fields, type-only FinalImageHandler import. `responsesTransport.ts`: exported
PostResponsesArgs and postResponses; explicit ParsedResponsesResult return;
all other moved helpers remain private.

`openaiExecution.ts` exports OpenaiRequest, isOpenaiRequest(request) and generic
prepareOpenaiExecution per040. Internal named surface helpers:

- prepareOpenaiClassic(ctx, request, progress): captures the same scalar fields
  as legacyClassic at prepare, returns one-output execute closure with original
  retry policy. Its nested generate call exists exactly once.
- executeOpenaiNode(ctx, request, progress): one attempt, sourceImage selects
  edit vs generate. Two operation callsites, each exactly once inside this helper.
- executeOpenaiEdit(ctx, request): one edit call using rawPrompt and mask omission.
- executeOpenaiMultimode(ctx, request, progress): one sequence operation/callback map.

Each takes the appropriate Extract<OpenaiRequest,{surface:...}> and returns a
single/sequence native value or typed prepared result as appropriate. Callback
shape/identity and capture timing follow040, not a fresh eager normalization.
Helpers need not be exported; tests scope AST by their exact declaration name.
Retain original positional operation API; the shared execution request is typed.

`legacy.ts` exports `LegacyExecutionRequest = ImageExecutionRequest & {
provider: Exclude<ImageExecutionRequest["provider"], "oauth" | "api"> }` and
isLegacyExecutionRequest with explicit provider comparisons. Its generic/actual
signatures narrow to this request. Four leaves import that type only and retain
their surface Extract. Remove ONLY OpenAI branches/imports and now-unused fields;
Comfy/NAI programmer-error branches and remaining provider options stay intact.
Index replaces selected preparation with prepareSelected per040; existing
assertDirectGrokKey and same-object execute wrapper remain unchanged.

## P test-impact findings: exact source-oracle migration

Independent Zeno01a0709a-30d4-76c2-967b-1bafa0f9eb6c inspected current mocks,
contracts and no-emit provider-preserving overload. Add these eight MODIFY targets
to040: _executionBoundaryProbe.ts, _executionImportEdges.mjs,
provider-registry-parity.test.ts, node-child-refs-contract.test.js,
node-studio-ui-contract.test.js, prompt-fidelity.test.ts,
inflight-cancel-contract.test.js, generation-limit-unlock-contract.test.js.
The three040-listed mask/sequence files also require precise scope migration.

### Native mock remains below the real family

In _executionBoundaryProbe, change only the mocked Responses module owner to
`providers/adapters/openaiOperations`; retain three exports and existing recorder.
Never mock public prepareImageExecution/openaiExecution. Existing69-case matrix
still runs real family dispatch with literal argument/result/callback assertions.

requestFor receives a provider-preserving overload:

```ts
export function requestFor<P extends CoreProviderId>(surface: ExecutionSurface,
  provider: P, source: string): ImageExecutionRequest & { provider: P };
```

Keep its existing implementation signature/body. P virtual probe demonstrated
this preserves literal Comfy/NAI refusal inputs under the narrowed legacy type.
No changes to provider-execution-boundary.test.ts assertions are needed for this.

### Function-scoped AST, not arbitrary first call

Extend collectCallArguments(source,file,name,scopeName?) in the existing AST helper.
When scopeName is provided, require exactly one named function declaration with
that name, then inspect its body only. Missing/duplicate scope throws, never
returns a vacuous empty match. Retain current no-scope behavior for other tests.
Test scope selection, missing/duplicate function, nested callback call detection,
and comment/string lookalikes. OpenAI's generate and edit each have TWO file-wide
calls, so selecting [0]/[1] or deleting exact-one assertions is not permitted.

| Existing test | Actual new owner/assertion |
| --- | --- |
| edit-mask-api-contract / oauth-proxy-edit-mask-contract | Read openaiOperations for mask-guide/input_image body; inspect executeOpenaiEdit for exactly one editViaResponses and mask forwarding; retain route maskCheck and old OAuth mask rejection |
| provider-registry-parity | Read openaiTypes GenerateOptions for mask declaration; executeOpenaiEdit for real call; retain exact mask lane matrix/route predicate |
| node-child-refs-contract | executeOpenaiNode contains exactly one editViaResponses with actual parent source and filtered refs; existing real ordering fixtures unchanged |
| node-studio-ui-contract | OpenAI generate/edit calls in executeOpenaiNode; six other lane calls in legacyNode; positive effective/raw prompt oracle for every lane remains |
| multimode-backend-contract | executeOpenaiMultimode one call with maxImages and both callbacks; openaiOperations payload/tool_choice; responsesTransport actual parseStream; responsesParse awaited callback/dedupe |
| prompt-fidelity | Move two multimode developer-prompt positives and forbidden-template negative into openaiOperations multimode function, without whole-tree concatenation |
| inflight-cancel-contract | Transport PostResponsesArgs/fetchSignal/cancellation mapping; retain original controller and late-save checks |
| generation-limit-unlock-contract | Add execution/operations/transport owners to existing no-eight-cap scan; one injected cap per new owner must fail the oracle |

Read explicit TS source, not _readTree's incidental one-level emitted-JS reexport.
Keep _readTree itself unchanged. Keep facade imports in runtime safety/route
tests as compatibility coverage, not globally rewrite them to the new module.
Existing node tests mock only Agy; existing sequence tests call actual Responses
with fetch fixtures, so neither requires mock retargeting.

### Import policy extension

The four callers may not import openaiExecution/openaiOperations/responsesTransport
directly; add all three owners to their existing concrete-edge matrix. Internal
family, operations, transport and legacy modules may not import responsesImageAdapter
compatibility facade. Legacy modules also may not import the migrated OpenAI
execution/operation/transport runtime owners. Allowed positive edges:
index→openaiExecution; openaiExecution→openaiOperations;
openaiOperations→responsesTransport; facade→openaiOperations; genuine type-only.
Transport may not depend on execution/index, openaiExecution, operations, routes
or facade. Existing alias/reexport/literal dynamic-import/extension normalization
fixtures remain. Computed imports/arbitrary external barrels remain a documented
E7 residual; do not call it a universal security boundary.

## Runtime verification design

Reuse the finalized032 RouteHarness/executionTestProcess and strict cancellation
reason guard. New parity files gate test registration with executionTestProcess;
no inherited credentials, user proxy launch, provider network or local full suite.
Fixtures match exact endpoints/methods and preserve whole handler/write settlement.
Only read/write owned temporary data. All new tests use explicit independent
payload/frame assertions, no snapshot regeneration from DUT output.

Minimal test-only API addition owned by main: RouteCase gains
`trackWork<T>(work: Promise<T>): Promise<T>`. It registers
`handlers.track(work.then(() => undefined, () => undefined))` and returns the
ORIGINAL work promise. This extends settlement observation to directly invoked
operations, without classifying their expected rejection as harness failure.
Tests assert against the original promise; unmatched upstream violations remain
fatal under the separate unchanged ledger. Add focused harness regressions for
original-promise identity, pending direct work delaying settlement, and cleanup
after a deliberate test-body error with released work.

Every new direct-operation/family test registers work immediately before waits
or assertions. Its finally must (1) release all held callback gates and terminate
owned stream gates, (2) abort its owned controller, (3) boundedly await
Promise.allSettled([work]) before restoring per-case config/leaving harness.run.
Aborting fetch alone cannot settle a promise held inside onFinalImage. Expected
rejection assertions belong in the body, not cleanup. Actual settlement timeout
retains isolation/root as before; never restore real fetch under pending work.

### openai-execution-parity.test.ts

- All four actual routes for both API/OAuth: distinct synthetic auth/URL/model,
  source refs, size/quality/reasoning/search flags; original response/sidecars.
  Keep concrete fetch chain, do not mock family/operations/transport.
- Prepare OAuth then mutate its same ctx readiness to failed: preparation emits
  zero fetch; execute emits OAUTH_UNAVAILABLE503 with zero network. Also mutate
  API key after prepare and assert current key at execute, not cached auth.
- O04-2 one valid PNG ref + webSearch=true, initial empty + two empty fallback
  frames + final image: four calls, exact developer/ref removal metadata and
  background/outputFormat retained. No false native-mask claim.
- O04-3 empty API422 one call, first503 then image two calls, hard400 one call;
  safety retry behavior separately preserved. OAuth node/edit no inner fallback.
- O04-5 parent+refs order/compression and edit PNG mask-guidance mapping use valid
  distinct bytes. ExistingWP03 cases stay unchanged and continue to run.
- O04-6 manually release first sequence callback; second cannot occur earlier,
  A,A,B yields indices[0,1] and original objects, JSON keeps its own behavior.
- O04-9 real sequence route sees image then internal stream timeout WITHOUT caller
  cancellation: its existing callback persists first image; catch emits one partial
  done with warning and retained sidecar. Separately, user cancellation after that
  image preserves already-written image/sidecar but emits499 GENERATION_CANCELED
  error and no successful done. Do not manufacture a successful sequence return
  in the seam or change cancellation policy.
- O04-10 old facade and new operations imports expose identical function objects,
  and one real execution request produces one corresponding transport call.

### openai-transport-parity.test.ts

Import real exported postResponses only after owned isolation. Invoke within a
RouteHarness.run callback with no HTTP request when testing just transport;
its ctx/call recorder remains owned and cleanup safe. Use no requestId for those
direct calls to avoid pretending the harness owns an admitted job.

- API/OAuth endpoint+headers, malformed key redaction, paramless400 wording,
  marked stream error metadata, JSON-vs-SSE parser behavior.
- Caller abort versus internal timer: fixture rejects with actual signal.reason,
  whose name is AbortError; assert499GENERATION_CANCELED vs504RESPONSES_IMAGE_TIMEOUT.
  For the internal timer, temporarily replace ONLY the per-fixture ctx.config
  object with an owned clone having a short generationTimeoutMs, restoring it
  in finally. Never mutate the module's shared nested config or enable a real URL.
- Separately drive classic prepared execution with the same conditions and assert
  its existing INVALID_REQUEST499 / UNKNOWN504 normalization with original cause
  and correct attempt counts. Full canceled-route output is still WP03's code.

Each file <400 lines; if a cohesive fixture helper is necessary, amend its exact
ownership before B rather than adding an unplanned framework during implementation.

## Mutation proof and restoration (main, after workers finish)

After a passing code checkpoint and with no concurrent writers, perform bounded
temporary mutations using apply_patch, run only the selected fixture test, and
restore exact hunks immediately. Record RED and restoredGREEN, then verify no
mutation diff remains. No mutation is committed, pushed or run against real APIs.

- Drop the final callback forwarded by executeOpenaiMultimode: the held callback
  test must fail, not silently wait forever (bounded waiter).
- Enable classic API opt-in AND remove only responsesFallback's provider=api
  early return temporarily: API-empty one-call test must fail due extra requests.
  responsesFallback.ts is authorized only for this transient verification hunk;
  its delivered source is byte-identical to the baseline.
- Import/cap fixtures use in-memory source insertion and must reject new-owner
  direct bypasses and eight-cap strings. They do not mutate production files.

If a RED mutation fails for an unrelated reason, it is not mechanism evidence.
No weakening of test assertions, timeouts or admission guards to obtain green.

## C / delivery

Focused parity/transport + unchangedWP03 and named migrated contracts;
typecheck/tests, build:server, UIbuild, inventory, line counts, diff check.
New exact-head CI runs Node22/24 full suites and existing frontend scenarios,
dispatched from final-head branch with verifiedcheckout. No new UI design;
reuse current app fixture flows as render regressions, inspect current captures
for changed request behavior. Manual real-route curl success/error capture for
both OpenAI lanes plus final source identity and teardown receipts.
Fresh independent C code/transport review; fix only observed deltas.
PR stacks on202; bottom-up merge/release remainsWP13 afterWP12/globalgates.
