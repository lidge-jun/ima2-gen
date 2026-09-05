# WP07 P — reconciliation and complete supported consumer paths

Mandatory current-tree amendment to070, base f2b60b64. No implementation yet.
Read-only P sidecars revalidated the actual frontend and MCP/CLI owners; main
read the referenced code and reproduced polling's loss of a concurrent addition.
This document retains every070 acceptance row and fills missing consumers/harness
details.074/075 supersede conflicting first-draft mechanisms and extend this manifest.
It does not promise universal Agent-queue/CLI presentation behavior.

## Additional exact file manifest

| Action | Path | Change |
| --- | --- | --- |
| NEW | ui/src/store/inflightReconciliation.ts | request-local snapshot/merge/eligibility shared by reconcile and polling |
| MODIFY | ui/src/store/storeInflightImpl.ts | protect both inflight and history awaits, preserving idle/backoff/history behavior |
| MODIFY | ui/src/store/storeHelpers.ts |070 includeExpired and safe terminalJobError, no new persisted schema |
| MODIFY | ui/src/store/storeVideoImpl.ts | exact tracking warning, no-Retry node errorInfo, animate false on failure/cancel rather than false success |
| MODIFY | ui/src/components/ResultActions.tsx | extension tracking error routes once through localized handleError |
| MODIFY | ui/src/lib/mcpProviders.ts | real parser with ordinary data.message fallback preserved |
| MODIFY | ui/src/store/storeSettingsImpl.ts | exact-code localized warning in callback and submit-catch paths |
| NEW | tests/_jobTrackingUiFixture.ts | real esbuild UI graph, controlled fetch/EventSource/storage/timers and persistent guard ledger |
| NEW | tests/job-tracking-timeout-ui.test.ts | actual parser/resolver/toast and video/MCP error paths |
| NEW | tests/inflight-reconciliation-behavior.test.ts | held-response concurrency through both public actions |
| RENAME/MODIFY | tests/inflight-reload-race.test.js -> .test.ts | replace old implementation-shaped checks with real boot/reload behavior |
| RENAME/MODIFY | tests/inflight-reload-reconcile-contract.test.js -> .test.ts | actual mixed storage/memory/server-only/TTL tests |
| MODIFY | tests/node-pending-recovery-contract.test.js | move only obsolete inflight source-shape assertions into behavioral coverage; retain unrelated route/metadata assertions |
| MODIFY | tests/multimode-ui-contract.test.js | replace only moved inflight implementation-shape assertions with behavior cases; retain unrelated multimode contracts |
| MODIFY | tests/job-terminal-status-contract.test.ts | establish owned config/DB before dynamic producer import, then actual expiry recovery |
| MODIFY | tests/mcp-job-envelope-consumer.test.ts | exact-code live/flat/replay recovery and media-action path controls |
| NEW | ui/e2e/j7b-tracking-timeout.spec.ts | all four locale live/reload warning plus actual video-node no-Retry and extension/animate outcomes |
| MODIFY | .github/workflows/ci.yml | explicit E2E checkout/input SHA guard and always-upload wp07 PNG/JSON evidence |
| NEW | tests/job-tracking-ci-contract.test.ts | parsed E2E checkout/artifact contracts and real SHA guard negatives |

070's errorCodes/errorHandler/sseStreamError/dictionaries/eventChannel/CLI and
source-of-truth changes remain. Search found old currentLocal/nextInflight source
assertions in the four named legacy tests; their runtime replacement is required,
not deletion of behavioral coverage. There is no existing shared snapshot/revision
owner; storeInflightImpl currently duplicates the mutation logic in two paths.

## Shared snapshot contract (no global version/tombstone cache)

New module imports types and the existing scope/storage conversion helpers. Exports:

```ts
export interface InflightSnapshot {
  uiMode: AppState["uiMode"];
  activeSessionId: string | null;
  local: Map<string, PersistedInFlight>;
  revisions: Map<string, string>;
  memory: Map<string, PersistedInFlight>;
  scopes: InflightQueryScope[];
}
export interface InflightMerge {
  inFlight: PersistedInFlight[];
  terminalErrors: Array<Error & { code?: string; status?: number }>;
  eligibleIds: Set<string>;
  serverActiveIds: Set<string>;
}
export function captureInflightSnapshot(state: AppState): InflightSnapshot;
export function mergeInflightSnapshot(snapshot: InflightSnapshot, current: AppState,
  response: { jobs: ServerInFlightJob[]; terminalJobs: ServerTerminalJob[] },
  options: { mode: "poll" | "reconcile"; now: number }): InflightMerge | null;
```

Names/types must match actual exports in both callers/tests; no backend clock is
compared with a local timestamp. Snapshot reads stored includeExpired=true then
memory (memory wins) and copies revision strings immediately. Revision tuple stays
the one in070: startedAt/kind/session/parent/client/phase/prompt/composer fields.
Map values alone are insufficient for in-place mutation; captured strings detect it.

Merge algorithm:

1. Return null before any state/storage/toast write if mode or normalized active
   session changed. Read fresh storage plus current memory after the await.
2. Retain new IDs, changed revision strings, same-ID replacement memory objects
   and out-of-query-scope entries without applying old server results.
3. For unchanged, in-scope entries, apply server/terminal/absence handling. Manual
   reconcile keeps070's server-active-before-terminal precedence and ten-second
   absence grace. Polling retains its terminal-before-active precedence and
   five-second grace. Do not silently unify different existing policies.
4. Manual active merge preserves local prompt and local phase fallback as070.
   Polling updates only phase/kind/session/parent/client metadata as its current
   code does, retaining local startedAt/prompt/composer fields. Reuse the original
   object when those values do not change, avoiding artificial replacement churn.
5. Terminal error adds the real terminalJobError; canceled terminals remove without
   warning. Terminal scope is checked before removal. Error messages remain fixed
   for tracking timeout. Actual store delivery occurs only after commit.
6. Never restore an ID present in the prefetch snapshot but removed from BOTH
   current sources. Restore genuinely server-only active entries only inside the
   queried scope. Do not add terminal-only IDs never locally tracked as spinners.
7. Return eligibleIds for unchanged, in-scope prefetch entries and serverActiveIds
   from the successfully queried response. They are for this request only.

reconcileInflightImpl captures -> fetches -> merges fresh -> save/set -> delivers
terminal warnings through actual handleError -> starts polling if needed. Rejected
fetch or scope switch makes no storage/state/toast writes. Keep public signature.

## Polling: both awaits are mutation boundaries

Keep the existing window timer,1500ms interval and two idle ticks; no new queue.
Capture initial mode/session and snapshot before fetching inflight. On success,
apply the shared merge with poll mode and capture a POST-MERGE snapshot for the
history wait, retaining ONLY eligible IDs from the first request. IDs added while
the first fetch was pending must not become TTL-prune candidates merely because
they are now present in the second snapshot.

After getHistory resolves, recheck mode/session before any history/selection or
inflight write. Preserve current functional-set history deduplication/retention and
current-image preference. TTL prune requires successful inflight reconciliation,
membership in the original eligible set, same local revision/object identity as
the post-merge snapshot, and the original queried scope. Server-active IDs remain
protected regardless of age. A failed inflight fetch followed by successful history
fetch must not prune jobs. Failed history fetch adds no history/TTL mutations.

Overlapping ticks use independent snapshots. Fresh additions/replacements/removals
and scope switches at either await remain protected. This is not a new total-order
protocol for backend responses or history deletion. Existing per-scope discovery
remains; do not claim all unqueried server jobs are discovered.

Main P reproduced old polling behavior through the real bundled graph: after four
inflight requests start, add a current node job, then release an empty response.
Old code removes that newly added job. ui-harness-probe.mjs records the defect and
also proves the real rejected-fetch catch can run with Vite env defined. No provider
or network request left the controlled fetch function.

## Error/presentation completion, exact-code only

Keep070's fixed warning and four dictionary literals. resolveErrorSpec recognizes
exact JOB_TRACKING_TIMEOUT (including its existing rawCode fallback) before priority
class selection and never echoes a poisoned message/class on that branch.
The literal registered UNKNOWN wrapper needs an explicit companion check:
`registered === "JOB_TRACKING_TIMEOUT" || (registered === "UNKNOWN" &&
incomingRawCode === "JOB_TRACKING_TIMEOUT")`, returning the LITERAL tracking code/spec
per074 (never registered UNKNOWN). Other genuinely registered codes
still outrank a conflicting rawCode. Test both an unregistered wrapper and the
literal UNKNOWN wrapper with a poisoned priority class; do not silently assume
the existing registered-code selection already handles the latter.
parseSseErrorPayload canonicalizes tracking wrappers through the pure resolver
after envelope-first selection per074, before constructing Error. Unknown
codes, AGY_TIMEOUT/MCP_JOB_TIMEOUT and ordinary auth/error precedence stay unchanged.

runVideoGenerateImpl's non-cancel catch obtains the exact code, invokes handleError
once for tracking timeout, and uses its localized message. For a current-session
video node set errorInfo to `{ ...buildNodeErrorInfo(error), message }` as well as
error/status/pending cleanup. The existing nodeRetryAction maps this no-CTA code
to fix-input/retryable=false. Never leave errorInfo absent (ImageNode defaults to
Retry), and never leave stale previous errorInfo.074 requires errorInfo:null on
admission/success/cancel/ordinary failure plus save/reload lifetime tests.
Tracking timeout is not inferred from arbitrary timeout text.

animateImageImpl returns false from its catch AFTER the existing error handling
(tracking timeout uses the new localized warning; ordinary errors keep their
current error toast; cancellation stays silent). finally still removes its own
inflight ID/controller/progress. True is returned only after a successful result.
Both actual consumers, ResultActions/resultChaining, interpret true by displaying
"Video ready. Check your history." (ko: 비디오가 준비됐어요. 히스토리를 확인하세요.).
Source search found only those two value-consuming calls. Preserving true after
failure would preserve a demonstrated false-success defect, not compatibility.
Test ordinary failure and cancellation as well as tracking timeout; none can add
animateDone, while successful generation still does. No provider retry change.

ResultActions extension catch retains AbortError cancellation handling. For exact
tracking timeout, call handleError(error,useAppStore.getState()) once and enter074's
source-bound tracking-expired disabled state; otherwise
keep existing error-message fallback. Success toast/history addition remains only
on successful stream completion. Hosted UI verifies localized warning, no success
toast and no Retry action for tracking timeout.

MCP watcher calls parseSseErrorPayload(data, typeof data.message === "string"
? data.message : "MCP generation failed"). This preserves ordinary MCP-only message
payloads which the parser itself does not read. Settings' pure-resolver tracking check
precedes its prefix mappings. Exercise BOTH watch callback and submit rejection
through startMcpGeneration and the generate action installed by setMcpProviderImpl.
Do not export those private message helpers for tests.

## Executable UI test graph and ownership

### Event channel control/data distinction

The existing onerror closes the stream even for a server-named error MessageEvent.
Main's actual-module channel-baseline.mjs supplied a valid MessageEvent to its real
data/error handlers and observed one delivered job error PLUS one unnecessary
close/reconnect timer. This is modeled dispatch, not claimed browser execution.
WHATWG's fully opened server-sent-events specification creates MessageEvent with
the server-specified event name; EventSource also has the ordinary onerror event
handler. Source: https://html.spec.whatwg.org/multipage/server-sent-events.html
(opened2026-09-05 UTC). The evidence supports distinguishing application data from
transport failure, not changing retry budgets.

In connect, capture the newly created EventSource in a local ownedSource. onopen,
data listeners, replay-gap listener and onerror ignore callbacks if source is no
longer ownedSource. The onerror callback returns immediately when its event has
string MessageEvent.data; dispatch already owns application errors. Only a genuine
transport Event closes that owned source and schedules existing backoff. Repeated
or stale errors cannot close a new source or schedule orphan timers. The replay-gap
listener clears cursor and invokes resync only for the current source, never job
dispatch. Tests drive actual MessageEvent and plain Event separately, then stale
callbacks after disconnect/reconnect. In J7b, instrument the native EventSource
onerror/close boundary before app load and attribute explicit close calls to
MessageEvent-with-data versus plain transport Event. A tracking error frame must
not trigger close in its MessageEvent handler.075 keeps the owned stream open
through that assertion; EOF is tested separately, never conflated with app error.

Data listeners ignore events without string data (transport errors have their own
handler). At the wire ingress, dispatch validates parsed JSON is a non-null,
non-array object with a string job/request ID before job delivery. The current
actual-module probe shows a JSON null frame throws TypeError; malformed JSON,
null/array/primitive and missing/non-string ID cases must be ignored without a
crash or job callback. This is input validation at the existing wire boundary,
not duplicated internal defense. These tests use the same in-memory esbuild/Vite
env definition, superseding070's plain-transpile recipe that avoided the invalid
payload branch rather than exercising it.

Reuse the existing core-selection-actions.test.ts esbuild approach: browser-platform
ESM bundle, write:false, explicit import.meta.env definition, production NODE_ENV,
fresh data-URL module instance per case. No new dependency or source rewriting.
Main P compiled and loaded the actual store/MCP/parser graph and exercised a rejected
reconcile fetch successfully; isolated globals were restored. Defining env is a
test/build transform, not a production test-only branch. A mock of devMode alone
does not cover direct import.meta.env accesses in fetch-failure catches.

_jobTrackingUiFixture exports a loader/fresh fixture used by both state/error lanes.
The shared test-only API is fixed before parallel implementation:

```ts
export interface UiRequest {
  url: string; method: string; body: unknown; headers: Headers;
  signal: AbortSignal | null;
}
export interface UiDeferred<T> {
  promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void;
}
export interface JobTrackingUiFixture {
  runtime: JobTrackingUiRuntime;
  requests: UiRequest[];
  storage: Storage & {
    values: Map<string, string>; writes: Array<[string, string]>;
    seed(key: string, value: unknown): void;
  };
  timers: Map<number, { kind: "interval" | "timeout"; delay: number;
    callback: () => void | Promise<void> }>;
  route(method: string, pathname: string,
    handler: (request: UiRequest) => Response | Promise<Response>): void;
  openStream(): void;
  emit(event: string, data: Record<string, unknown>, lastEventId?: string): void;
  transportError(): void;
  runTimer(id: number): Promise<void>;
  setNow(value: number): void;
  defer<T>(): UiDeferred<T>;
  track<T>(work: Promise<T>): Promise<T>;
}
export function withJobTrackingUi<T>(
  run: (fixture: JobTrackingUiFixture) => Promise<T>,
): Promise<T>;
```

JobTrackingUiRuntime is the actual export-type intersection for useAppStore,
storeInflightImpl, storeHelpers, storeVideoImpl, storeSettingsImpl, mcpProviders,
storeAssetGenImpl, storeSpriteRecipeImpl, storeGraphSave (existing public exports),
errorCodes/errorHandler/sseStreamError/nodeErrorInfo and eventChannel. The test
entry exports needed existing functions explicitly; it does not add production
exports. Components remain browser-driven in J7b, not privately exported handlers.
route matches an exact method/path before invoking its handler; query assertions
belong in that handler. Unknown routes persist a violation before any I/O. Expected
handler rejection is a fault injection, not a violation. Deferred rejections and
tracked operations drain before globals restore. Fake timers never create real
wall-clock work; case assertions distinguish allowed polling from leaked watcher
deadlines, and teardown cancels remaining owned timers with a recorded count.
emit models both data listeners and an onerror property for a named error frame;
transportError is a plain Event without data. Each case gets a fresh actual store
instance. End the owned esbuild service after compilation, before test work starts.

The real useAppStore is the state owner; seed locale through its setState so real
i18n.t reads the same value. Use actual showToastImpl/store toastLog, not only a spy.
Bundle real API functions and intercept fetch (including api-core's direct calls),
rather than trusting an API-barrel mock to cover MCP. Controlled EventSource must
model add/remove listeners, readyState, onopen/onerror and close; do not accidentally
turn application error frames into fake transport errors. Record every request,
timer/listener and unexpected operation in a persistent ledger, including failures
the product catches. Deny all unassigned URLs before I/O, never fallback to native
fetch. No provider/token/config lookup is allowed by the harness.

Drive held promises and captured interval/reconnect callbacks, not sleeps. Teardown
releases/aborts pending work, disconnects the real channel, drains promises, verifies
timers/listeners and unexpected-call ledger, then restores globals. Data-URL stack
text may include the bundle; report bounded error messages, not megabytes of source.
Separate tests retain independent literal locale expectations; never derive expected
messages from the same dictionary/translator under test.

State cases: every070 held-response/reload row through reconcile AND polling, at
both polling awaits; concurrent old-timestamp addition, same-ID replacement,
in-place revision edit, removal from both sources, server-only scoped restoration,
scope switch, fetch failure then history success, stored expired plus live current
IDs, duplicate warning prevention and active-ID TTL retention. Runtime replacements
also cover the moved node/multimode source assertions with actual metadata/scope
results. Existing store boot stays []/0 until reconciliation.

Error cases: live flat/envelope/wrapped code and restored actual terminal snapshot,
all four locales, poisoned raw/class metadata, no fallback key/no Retry/success,
video node/animation/extension outcomes, MCP callback/submit errors, ordinary error
messages preserved without false animation success, one POST/watcher settlement and timer cancellation. Transport
reconnect GETs are not extra generation attempts; retain the existing deadline.

## CLI and separate consumer boundaries

runMcpJob signature/McpJobOptions stay unchanged. Keep the three070 exact-code
branches: envelope/legacy live errors and normalized terminal recovery. Preserve
envelope.error.code > data.code > phase fallback; code-less timed_out remains
MCP_JOB_TIMEOUT. Map only tracking timeout to fixed message/status504 with no body.
MCP image, video AND upscale use this helper; retain media-action postPath override.
Tests cover one initial POST, cursor GET/replay-gap GET and the actual persisted
terminal snapshot after producer reload. No new submission on recovery.

Fix job-terminal-status-contract.test.ts isolation BEFORE running it: set owned
config/DB/storage paths before dynamic inflight/commit producer import. Its existing
generated-directory-only fixture is insufficient. Close DB/server/streams and prove
teardown; keep real producer-to-public-runMcpJob coverage, not copied outcome JSON.

Read-only inventory: bin/commands/gen.ts, upscale.ts, bin/lib/videoMcp.ts consume
MCP result/error; native POST-SSE node/multimode/core-video commands and recover-output
are separate formatting/history consumers, not mcpJob. Server-generated live timeout
text is fixed, but this patch does not claim universal CLI recovery formatting or
change manual history recovery. Agent queue owns separate worker/controller/result
state and retry UI; no new common tracking-code-to-queue-error producer is introduced.
Do not claim queue-wide localization/no-Retry from this resolver entry alone.

## B ownership and required sequencing

Canonical E2E currently runs all ui/e2e specs, so J7b is selected without changing
the test command. Existing success uploads only wp01/wp02/wp03 patterns. Main adds
an always-upload artifact named wp07-job-tracking-evidence for
ui/test-results/**/wp07-*.png and wp07-*.json, if-no-files-found:error, using the
existing full upload-action pin. E2E checkout ref becomes the existing root-job
expression `${{ github.event.inputs.sha || github.sha }}` with fetch-depth0 and
persist-credentials:false. Add a step-local expected-SHA environment expression
and shell-neutral Node guard validating40hex and exact git rev-parse HEAD before
install/build. No new privileged trigger, version pin or dependency.
The contract test parses YAML, rejects missing/changed checkout/guard/upload paths
and actually runs the inline SHA guard for valid, malformed and wrong SHA values.
Actionlint checks expression contexts; YAML string shape alone is insufficient.
Current command-selection proof: ui/package.json test:e2e is playwright test and
ui/playwright.config.ts testDir is ./e2e, workers1/retries0.

- Main/server: inflight, terminalStore, ssePublish, spriteJobEvents and their scoped
  DB/terminal/cancel tests, canonical CI evidence wiring/contract plus source-of-truth/devlog/inventory synchronization.
- Event transport worker: eventsPolicy, eventBus, routes/events, eventChannel, backpressure and
  replay-gap tests. No UI state/error-file writes.
- UI state worker: storeHelpers, storeInflightImpl, inflightReconciliation,
  _jobTrackingUiFixture and state/legacy-replacement tests.
- UI presentation worker: errorCodes/errorHandler/sseStreamError, dictionaries,
  storeVideoImpl, ResultActions, mcpProviders/storeSettingsImpl, AssetGen/Sprite,
  video-extend-ui-contract, nodeHistory/node-history-contract per076, timeout UI
  tests and075's hosted J7b/live SSE/media fixtures.
  It consumes the state worker's fixture; no duplicate harness.
- CLI worker: bin/lib/mcpJob and its two existing CLI/producer recovery tests.

Dependencies are explicit: fixed errorCode/message export before UI state tests;
shared UI fixture before presentation tests; terminalStore/expiry before CLI
producer-recovery assertions. Workers may implement disjoint files in parallel,
but report dependency-ready checkpoints before executing a missing peer contract.
No fabricated placeholder exports. New scope changes return to main/P amendment.
Fresh A and C reviewers inspect field chain, source/test oracles, concurrency,
rollback and real visual/wire outcomes. No phase advances on an unexecuted command.
