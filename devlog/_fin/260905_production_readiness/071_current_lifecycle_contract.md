# WP07 P — current lifecycle contract and cancellation handoff

Base f2b60b647640ebbd8c35ded16e55d700ef1c806e / PR207.
Branch codex/prod-wp07-jobs; session01a06e88-aa93-77b2-a99a-fc10f8458eb2.
Class C4. Loop archetype: spec satisfaction. Trigger: actual tracker/cursor defects
and retained WP06m/WP06s duplicate-cancellation captures. Goal: durable expiration,
single cancellation/expiry terminal outcome, recoverable bounded event delivery.
Non-goals: new schema/queue/provider retry/epoch protocol, cross-process abort,
universal ordering of unrelated completed/error producers. 070 remains binding
except amendments here and072–075.074 replaces residual expiry/transport;
075 replaces finite SSE fixtures. No production implementation yet.
Stop: c-8 plus both explicit duplicate tasks pass; otherwise record exact failures.
Memory:070–075, goalplan and ledger, session wp07 evidence.
Expected outcome: DONE for this layer; all later WPs and release remain required.

## Authority, resource bounds and prior D

Existing repository/origin CI, isolated temporary test homes/DBs and owned loopback
fixtures only. No user3333 access/restart, auth stores, real provider/Agy/paid
generation, full local suite, large local bodies, new dependencies or subscriptions.
Preserve user scripts/recording/, all stashes and unrelated branches. Main owns
FSM/goal, commits, stack and remote actions. New subagent spawns omit model and
reasoning_effort per the active goal's inheritance instruction; no model identity
is inferred from a worker's self-description. No numeric token budget requested;
account allowances apply. Reassess four hours/WP and72hours overall.
Upward: main reclaims a packet after two distinct failed workers. Downward: changing
ownership requires a documented P amendment, not ad-hoc B delegation.

Prior D accepted c-18 artifact safety at f2b60b64, not all-wire correctness:
HTTP14 remains10PASS/4FAIL. Node read/EOF/close/ref-rm cancel captures show seq2
cancelled499 then seq3 failed499; artifact/descriptor/ref cleanup and no persistence
pass. Earlier video cancel has two499 terminals too. WP07 tasks
node-cancel-terminal-duplicate/video-cancel-terminal-duplicate and WP13's explicit
node-cancel-wire-gate remain OPEN. Original failures are never overwritten.
Raw evidence: wp06s/http-qa-f2b60b64/cancel-{read,eof,close,ref-rm}/ and
wp06m/http-status.md under the main session evidence directory.

## Grounding, necessity and executable baseline

Ran ranked map for inflight/eventBus/ssePublish/events. Main read each owner,
nodeHelpers/nodeGeneration/video callers, sprite emitter, and existing tracker tests.
Search: abortJob, finishJob, registerJobAbortController, publishJobEvent, direct
eventBus imports, TerminalJob/terminal store, replay gap and related test assertions.
Do-nothing leaves observed defects; changing deadlines only hides them; deleting
tracking/replay breaks supported clients. Reuse current DB schema7/envelope1,
eventBus ring and registry; extract only terminal disk I/O for the existing500-line
owner. No alternate tracker or generic event framework.

Executed baseline: env-cleared native-mock/tsx --test --test-concurrency=1 over
tests/inflight.test.ts, inflight-persistence.test.ts, terminal-jobs-restart.test.ts,
event-bus.test.ts ->24PASS/0FAIL. Tests create own config/DB roots; package-local
.ima2/config.json is absent. Baseline inflight.test has a fake publishJobEvent,
so its success is not proof for the real publisher. Replace that replica in B.

Main actual-owner probe lifecycle-baseline.mjs (owned DB/no provider) reproduced:
reentrant abort listener sees isJobCanceled=false; error/cancel/late-error phases
are failed,cancelled,failed; late controller remains unaborted. TTL purge leaves
no terminal, does not abort a registered controller, and permits late done.
Future cursor on empty/populated ring reports no gap. Evidence is
wp07/lifecycle-baseline.json, explicitly a defect reproduction, not PASS of desired
behavior. Existing bindings/signatures in070 are still current.

## Exact server additions to070's manifest

| Action | Path | Required change |
| --- | --- | --- |
| NEW | lib/jobs/terminalStore.ts | 070 read/write/reap, plus deleteTerminalJob(requestId) for same-transaction admission cleanup |
| MODIFY | lib/inflight.ts | terminal I/O extraction, expiry transaction, cancel-before-abort state ordering, late controller guard, per-ID reuse cleanup |
| MODIFY | lib/ssePublish.ts | suppress done/error after canceled OR tracking-expired state before sequence allocation |
| MODIFY | lib/spriteJobEvents.ts | route both done/error through actual publishJobEvent; retain raw nonterminal/legacy response behavior |
| NEW | tests/job-cancellation-terminal.test.ts | actual registry/publisher, synchronous abort listener, late error/done, repeated cancel, expiry and new-admission controls |
| MODIFY | tests/inflight.test.ts | import real publisher, preserve purposes while updating expiry's terminal precedence |
| MODIFY | tests/video-download-cancellation.test.ts | retain original held-download/no-persistence assertions and add exact one-terminal replay proof |
| MODIFY | tests/agy-execution-cleanup.test.ts | retain read/EOF/close/ref-rm resource proof; add real bus-terminal assertions without changing raw499 expectations |
| NEW | tests/sprite-job-events.test.ts | real emitter canceled error/done suppression and nonterminal/legacy compatibility; no existing owner found by createSpriteJobEmitter/sprite event search |

Read-only but mandatory caller verification: lib/nodeHelpers.ts:73,
lib/nodeGeneration.ts:355-375/460/502, routes/video.ts:61-67/650, routes/nodes.ts,
lib/videoExtendI2vOperation.ts, MCP tracked publishers. Their terminal calls already
reach the shared publisher; do not rewrite normalization/retry or add per-provider
special cases. Direct raw nonterminal publish paths stay outside terminal dominance.
routes/videoKeying.ts uses untracked keying-* events, not generic tracked terminals;
this unit does not claim cancellation control over that custom protocol.

## Cancellation ordering — exact behavior

1. Restore terminal cache before classifying a cancellation. Capture the existing
   controller reference, active row/phase and whether the controller needs abort.
   Canceled/expired retained terminal state is authoritative for that request ID.
2. Record canceled state through existing finishJob before invoking the captured
   controller's abort listeners. The active row/controller-map entry may be removed;
   the captured controller must still be aborted exactly once.
3. Publish the existing canonical canceled error once only if the request was
   active or had a live controller and was not already canceled/expired. Capture
   the original phase before row removal. Unknown cancellations retain the existing
   tombstone-without-event behavior. Return requestId/active/aborted as before.
4. If finish cleanup throws after classification, still abort the captured
   controller and preserve the observable cancel event, then propagate the original
   failure. Do not regress the old physical-abort behavior because state recording
   moved earlier. Keep original best-effort persistence/logging semantics outside
   the new atomic TTL transaction; do not claim durability when SQLite failed.
5. Late finishJob with no active row cannot overwrite an existing canceled/expired
   snapshot. Repeated abort emits no extra terminal. Restored completed/expired
   records are not replaced by an unknown cancel tombstone.

Replacement abortJob control skeleton (existing cancel payload/envelope block
becomes private publishCanceled(requestId, inflightPhase), unchanged in shape):

```ts
if (!requestId) return { requestId: "", active: false, aborted: false };
const alreadyTerminal = isJobCanceled(requestId) || isJobTrackingExpired(requestId);
const controller = abortControllers.get(requestId);
const active = Boolean(getJob(requestId));
const aborted = Boolean(controller && !controller.signal.aborted);
const inflightPhase = getJobPhase(requestId);
let failed: { error: unknown } | undefined;
try {
  finishJob(requestId, { canceled: true, httpStatus: 499, errorCode: "GENERATION_CANCELED" });
} catch (error) { failed = { error }; }
if (aborted) controller!.abort();
if (!alreadyTerminal && (active || aborted)) publishCanceled(requestId, inflightPhase);
if (failed) throw failed.error;
return { requestId, active, aborted };
```

finishJob first lazily restores retained terminals. If that ID already has a
canceled or tracking-expired snapshot, keep its status/timestamp rather than
rebuilding it even when an earlier failed cleanup left an active row. Still attempt
the existing row/controller cleanup and propagate its failure normally. New
admission clears the retained state first. No generation-token protocol is added:
simultaneous reuse of one ID while an old producer is still running remains outside
the existing request-ID ownership contract; tests for intentional reuse settle the
old attempt before admission and do not imply cross-attempt total ordering.

At publishJobEvent entry:

```ts
if ((event === "done" || event === "error") &&
    (isJobCanceled(requestId) || isJobTrackingExpired(requestId))) return false;
```

This intentionally does not order all success/error pairs or suppress every raw
nonterminal publisher. Canceled/expired terminal dominance is the narrow observed
repair. Event names/data/envelope versions and legacy HTTP response semantics stay
unchanged. Suppressed events allocate no global/per-job sequence. Direct inflight
cancel/expiry emissions keep the cycle-free eventBus path.

Terminal state is the existing per-ID snapshot, not a new unbounded seen-events
set. Ordinary successful startJob admission deletes the old terminal row inside
the same DB transaction as INSERT, then clears memory. A denied/failed admission
must not delete it. Opt-in canceled-tombstone admission restores before checking.
The original retained-terminal lifetime still bounds recognition; no forever or
cross-process controller guarantee is introduced.

## Expiry and storage refinements

Keep070's strict cutoff transaction and post-commit ordering, with074's retained
terminal precedence, rowToJob metadata and single-row repair/rollback. Only new
expiry publishes; residual cleanup never rewrites timestamps. readTerminalJobs,
writeTerminalJob, deleteExpiredTerminalJobs and deleteTerminalJob share getDb but
never import inflight/eventBus. Move existing row mapping/serialization without
silently changing malformed-meta/default/status handling. Expiry preserves IDs,
phase and metadata, omits top-level prompt, emits fixed unknown-completion text,
and aborts only locally registered controllers. ErrorCode is JOB_TRACKING_TIMEOUT,
status remains error/http504; no new DB column or public raw status.

After successful expiry, cancel/late done/late error do not replace or duplicate
the timeout terminal. A synchronous abort listener must observe expired state and
cannot publish a late terminal. Failed terminal insertion rolls back active-row
deletion; no controller abort/expiry event occurs. Repeated purge is inert.

Agent queue owns a separate scheduler/controller and queue-result table. It does
not consume common tracking errorCode into its queue failure record. This unit
does not claim queue-wide warning/Retry changes, termination of unregistered
controllers or a new scheduler; common /api/inflight snapshots still report expiry
as completion unknown. 072 enumerates that separate presentation boundary.

## Added exact activation matrix

- Actual synchronous abort listener calls real publishJobEvent(error/done): it
  sees canceled=true; neither late event is published; one cancelled terminal,
  stable per-job sequence, preserved metadata, aborted controller.
- Repeated cancel and late finish/error: same terminal timestamp/status, no second
  event. Unknown and completed IDs preserve their documented behavior. Intentional
  new admission of same ID clears stale disk+memory and permits new events.
- SQLite failure during cancel cleanup: captured controller still aborts; original
  failure remains observable. No claim that a failed durable write succeeded.
- Expiry with synchronous abort listener and repeated cancel: one timed_out
  terminal; late registration is aborted; late error/done rejected. Existing
  completed/unknown registration compatibility remains.
- Original four Agy HTTP holds plus video cancel replay: exactly one cancelled499
  terminal, no later failed transition/image/done/persistence, descriptor/ref/child
  cleanup preserved. Keep original f2/ef0 failures as baseline evidence.
- Sprite real emitter follows shared terminal guard while its direct legacy
  response and raw nonterminal behavior remain compatible.

All070 TTL/restart/cursor/backpressure/localization/reconciliation rows remain.
Mutate cancel-before-abort ordering, broaden guard back to done-only, omit old
terminal deletion, remove expiry late-register guard: exact behavioral oracles
must go RED then restore GREEN. No source-prose tests as sole proof.

## Verification and bypass record

Baseline24 tests and actual-owner probe executed above. New commands/tests are
planned artifacts, not claimed runnable until B creates them. C runs exact root
test paths, both typechecks, server/CLI/UI builds, actionlint on changed workflows,
inventory, source maps, security checks, current-tip CI and observed browser QA.
Reuse current owned Agy/video fixtures; no real provider or large local payload.
Fresh C must replay the original four HTTP FAIL cases as actual PASS, not alter
their terminal-count expectation. All release gates stay open until those pass.

E1: common tracked terminal guard; raw eventBus/custom nontracked events are a
known bypass boundary and no universal event-order guarantee is claimed. E7:
tests/manual wire; E8: receipts/ledger. Skipping verification yields unverified
code, not permission for DONE. Rollback as one coherent layer with matching UI/CLI
warning consumers, preserving schema7 and user data; reopen c-8 and duplicate gates.
