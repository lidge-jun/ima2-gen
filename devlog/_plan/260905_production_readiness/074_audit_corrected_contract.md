# WP07 A — corrected server and presentation contract

Supersedes conflicting070–072 clauses; round1 synthesis is073. No production
implementation until the same auditors approve. All original positive/negative
acceptance rows remain unless their old mechanism is replaced explicitly below.
075 specifies the native browser fixture;076 folds round2 zero-cursor/Undo residuals.

## Added/changed ownership

| Action | Path | Owner / purpose |
| --- | --- | --- |
| NEW | lib/eventsPolicy.ts | pure fixed SSE drain policy, no filesystem/config imports |
| MODIFY | config.ts | re-export pure SSE_STREAM_POLICY for central configuration reference; preserve existing values/import behavior |
| MODIFY | lib/eventBus.ts | pure latestEventId() getter plus future-cursor correction |
| MODIFY | lib/jobs/terminalStore.ts (new in071) | add readTerminalJob(requestId,cutoff) for transaction-local residual cleanup |
| MODIFY | routes/events.ts | bounded drain-driven replay/live catch-up, not immediate destroy on false |
| MODIFY | ui/src/store/storeAssetGenImpl.ts | store localized safe tracking warning rather than poisoned raw error text |
| MODIFY | ui/src/store/storeSpriteRecipeImpl.ts | tracked error parser/localization and terminal/admission-failure unsubscribe |
| MODIFY | tests/video-extend-ui-contract.test.js | preserve ordinary Retry contract but account for tracking-expired disabled state |
| MODIFY | ui/src/store/storeVideoImpl.ts | clear errorInfo on all nontracking transitions, preserve fresh settled tracking error |
| NEW | ui/e2e/fixtures/jobTrackingStream.ts | owned live HTTP SSE test fixture with real native EventSource |

Transport worker owns eventsPolicy/eventBus/events and transport tests. Main owns
config's re-export and terminal store/residual logic. UI presentation worker owns
AssetGen/Sprite/video/extension and J7b streaming fixture; UI state worker keeps
shared runtime fixture ownership and exposes needed existing module exports.
No existing drain/terminal-single-row policy owner was found in the pre-write search.

## S1/S3 — residual active rows and authoritative terminal snapshots

Before expiry transaction, lazily restore the terminal cache. Within the transaction,
read each matching active row and any retained disk terminal for that request ID.
Retained means within the same terminal TTL policy used by restore/reap.

Precedence: a retained process-local terminal snapshot wins; otherwise a retained
disk terminal wins. The existing terminal table is an outcome record, including
completed/error/canceled spellings—not an invitation to replace known completion
with a new timeout. Cross-process simultaneous ownership/epochs are not introduced.

For an existing retained terminal:

1. Preserve its status, finishedAt, phase, error code and metadata exactly. If the
   memory snapshot was not persisted because an earlier write failed, write that
   same snapshot inside this transaction before deleting the residual active row.
2. Delete only this stale active row. Any write/delete failure rolls back the row
   cleanup. Do not emit a new expiry or cancellation, or refresh terminal timestamps.
3. After commit, adopt the preserved snapshot in memory if absent and remove local
   controller/registration entries. Abort a remaining controller only for a canceled
   or tracking-expired outcome; ordinary completed/error cleanup keeps normal finish
   semantics. No event is published for residual cleanup.

For an active row without a retained outcome, create the070 tracking-timeout
snapshot inside the same transaction. Use the existing rowToJob(row) result for
requestId/kind/startedAt/phase/phaseAt/meta, preserving column-first sessionId,
parentNodeId and clientNodeId. Omit top-level prompt; metadata preservation is not
a claim to strip all user-origin metadata. Fixed warning text never embeds it.
Only after commit update memory, abort/delete local controllers and publish one
timed_out terminal. Repeat purge is inert.

TerminalStore's additional exact signature:
`readTerminalJob(requestId:string,cutoff:number):TerminalJob|null` selects the same
retention predicate as readTerminalJobs and uses the same row converter. No DB
restore side effect at import, no inflight/eventBus import, no schema change.

Required oracle: make an already-stale active job, inject DELETE failure, cancel
it while retaining the canceled snapshot, remove the fault, purge, and assert the
original timestamp/status/metadata and one original cancel event. Repeat after a
fresh module restores from the same owned DB. Also cover completed residual cleanup,
memory-only snapshot persistence repair, failed repair rollback, column-only IDs
and conflicting JSON IDs before/after restore and scoped lookup. This tests a
retained terminal, not one deliberately aged beyond terminal TTL.

## S2 — bounded backpressure without replay livelock

Main's native Node24 small-HWM probe wrote the same170-byte frame: write(false)
followed by destroy yielded ECONNRESET/0 received bytes; waiting for drain delivered
all170 bytes. Both owned listeners closed. This validates the mechanism gap without
claiming a completed application fix (wp07/backpressure-baseline.mjs).

Pure policy: `lib/eventsPolicy.ts` exports
`SSE_STREAM_POLICY = Object.freeze({ drainTimeoutMs: 15_000 })`.
config.ts re-exports it; routes/events imports the pure module directly so importing
the route does not read user configuration or open a database. No duplicate numeric
literal, env knob or normal request-deadline change. Replace config's inaccurate
dependency-free comment with one accurate line to keep the file below500 lines;
do not split/rewrite runtime configuration. lib files are already emitted/packaged;
add the policy to paired-generated manifest and source map if required by their gates.

Keep registerEventsRoute(app,ctx)'s public signature and partial-context support.
Use a private connection owner (class or focused helpers, methods below50 lines)
for cursor, closed/pumping/blocked flags, unsubscribe, heartbeat and drain deadline.
No per-client event queue. The global bounded ring is the catch-up buffer.

Connection sequence:

1. Set/flush existing headers; reserve the capacity slot. Install close/error/drain
   listeners and a no-op unsubscribe before any write. Subscribe before replay so
   events arriving while paused are observable without a second queue.
2. No supplied cursor starts at latestEventId(), preserving live-only subscription.
   Explicit0 replays from0; nonpositive parsed cursors normalize to0. Invalid/unsafe
   parsed values are ignored as a cursor. Valid future cursors retain the new gap
   behavior.076 allows valid0 through eviction detection. No numeric epoch is added.
3. Replay pump calls hasReplayGap(cursor). On a gap, emit the existing id-less gap
   control and rebase to oldestAvailableId-1, or current latest ID for an empty ring.
   Then read replaySince(cursor) and write in ascending ID order. Advance queued
   cursor for an accepted write, even when its result is false. Never resend that
   accepted chunk on drain. A throw/closed response cleans up immediately.
4. write(false) pauses all further writes and starts one15s drain deadline. Do not
   destroy immediately. Skip heartbeats while blocked; they cannot extend the
   deadline. On drain cancel that deadline, resume from the cursor using a fresh
   ring read, and check for eviction/gap again. Do not retain a replay array across
   the wait. A permanent stall times out and closes only this response.
5. Healthy live path writes the actual BusEvent (full current image fields) directly
   when not pumping/blocked and its ID follows the cursor. While blocked/pumping,
   live callbacks only request catch-up; no unbounded queue. Catch-up uses existing
   ring omission semantics and gap/snapshot recovery. Do not promise all live partial
   image bytes survive a slow-client replay or a global process RSS cap.
6. Cleanup unsubscribes once, cancels heartbeat/deadline, removes every installed
   listener, releases capacity once, and closes/destroys the owned response. No
   heartbeat/subscriber may be created after failed setup. Stale drain/close/error
   callbacks are inert. Preserve MAX_SSE_LISTENERS and SSE_CAPACITY503.

New pure eventBus export: `latestEventId():number` returns seq without allocating
an event. It has no DB dependency. Tests pin0/reset/monotone behavior.

Replace old write(false)->destroy acceptance rows with: pause/no extra writes;
drain resumes exactly once; accepted chunk is not duplicated; missing drain times
out with full cleanup/capacity reuse; ring eviction while paused emits gap; live
fast path preserves full payload while catch-up uses documented replay metadata.

Real progress oracle uses owned http.createServer({highWaterMark:64}) and the
actual events route. A controlled initial stream gives the public runMcpJob client
one cursor, then closes. Its one POST seeds a retained burst+terminal; reconnect
must traverse the real backpressured replay and eventually return terminal result
or explicit snapshot recovery, with POST count1. The initial seed may be a test
middleware; the replay under test must be the real route. Keep total data tiny.
Record native false/drain, received IDs, reconnect cursor, result and teardown.
Immediate-destroy mutation must fail this progress oracle, not merely a cleanup
counter. Separate controlled-writable tests cover the stalled deadline/reentrancy.

## U1/U2 — canonical tracking identity at every relevant boundary

The full resolver block returns literal canonical values, never registered UNKNOWN:

```ts
if (registered === "JOB_TRACKING_TIMEOUT" ||
    (registered === "UNKNOWN" && incomingRawCode === "JOB_TRACKING_TIMEOUT")) {
  return { code: "JOB_TRACKING_TIMEOUT", spec: errorCodes.JOB_TRACKING_TIMEOUT,
    message: JOB_TRACKING_TIMEOUT_MESSAGE };
}
```

Existing unregistered-wrapper rawCode fallback already yields registered tracking.
A genuinely registered nontracking code still wins over conflicting rawCode.
Tests assert code/spec/message, localized handler return and nodeRetryAction.

parseSseErrorPayload reuses resolveErrorSpec on its selected code/rawCode/message/
class record. If that resolves to tracking timeout, set code to the literal tracking
code, message to the fixed warning, status504 and canonical timed_out phase, and
omit caller-supplied rawCode/errorClass. Do this before constructing the Error seen
by raw-message consumers. Other parsed errors keep their existing precedence/fields.
There is no parser->handler side effect or duplicate toast.

MCP settings uses the same pure resolver for tracking recognition before its legacy
prefix branches, covering direct JSON rejection as well as canonicalized SSE.
storeAssetGenImpl captures handleError's result once and stores its localized
message for tracking timeout; ordinary errors retain their existing displayed
message. Tests inspect actual assetGenLastError AND the rendered alert, not only
toastLog. Include UNKNOWN/raw and unregistered wrappers, hostile message/class,
canonical-envelope precedence, and genuine known-code conflict controls.

## U3/U4 — presentation state lifetime

Video node writes set `errorInfo:null` on admission, success, cancellation and
ordinary failure. Tracking failure sets fresh buildNodeErrorInfo plus the localized
message. Clear stale information at each writer, not globally in mapSessionToGraph:
legitimate settled historical error details must survive. Test tracking->admit->
ordinary failure, tracking->success->ordinary failure, cancel and same-node retry.
Drive the existing save serialization and reload mapper: pending/reconciling becomes
empty+recoveryRequestId, and must not retain stale tracking information after its
admission reset.076 identifies Undo as the reachable restoring writer and adds
live error/errorInfo to pending merge fields; no blanket serialization reset.

Extension UI state is source-bound:

```ts
type ExtendState = "idle" | "pending" | "error" | "tracking-expired";
type ExtendUiState = { source: string | null; status: ExtendState };
```

Capture source filename on submission. While any request is pending retain the
existing serialized-action disablement. Otherwise render the state's status only
when its source equals the current image filename; a different source is idle.
An explicit filename change resets nonpending advisory state (not an automatic
same-source metadata refresh). Completion from an old source must not block the
currently selected different source.

On tracking failure, emit one localized warning and store tracking-expired for the
captured source. Its submission button is disabled, shows no Retry label and has
the localized unknown-completion title. Ordinary error still offers Retry; cancel
remains idle; success alone adds history/success toast. No generation is triggered
by a state reset. Source change/remount is an explicit escape from this local
advisory state, not a new backend/permanent retry ban. Hosted tests cover tracking,
ordinary error after deliberate source change, pending source changes and no false
success/automatic POST; the existing source contract must not demand Retry for the
tracking-expired state.

## S4 — Sprite live terminal consumer

The actual sprite-row pipeline emits its error only at aggregate termination;
per-row failure is rethrown to that outer error. Both error and done unsubscribe.
Use parseSseErrorPayload for tracking recognition, with the legacy data.message
fallback. For tracking store a localized warning (via the real handler once);
ordinary error retains the old display behavior. Always remove the owned request's
subscription at terminal settlement. Public anchor/rows submission catch also
removes its owned watcher; await existing whenConnected before POST so cold
subscription cannot miss an immediate outcome. No private watch export for tests.

SpriteJobEmitter's canonical error publication flattens the existing nested
error.code/message for the envelope, as nodeHelpers does; direct legacy response
payload stays unchanged. Nonterminal Sprite events remain raw. Actual subscriber
tests cover expiry, ordinary error, cold readiness, repeated/late frames and failed
admission without leaks or another POST. Sprite recipe reload uses its separate
recipe/row state; this unit adds no persisted Sprite warning/reconciliation system
and does not claim one. UI upscale remains a separate non-watching media-action
presentation path; CLI media-action tests do not certify it.

## Re-audit and C evidence

All original node/video raw wire failures must be replayed unchanged and pass,
alongside the new residual-transaction, drain-progress and consumer tests. No
source-only or modeled fixture result is called native browser/Windows proof.
Retain failed A verdicts, synthesis and the actual backpressure probe. Same auditors
must inspect this full replacement plus075 before B; no scope drops or success
claim from fixing only one of the listed boundaries.
