# WP07 — Recoverable tracker termination and bounded event delivery

Status: WP00 design, not implemented. Baseline and executed command results:
[004_lifecycle_operations_research.md](004_lifecycle_operations_research.md).

## Execution contract

- Class: C4 affected persistence/cancellation boundary; docs-only in WP00.
- Archetype: repair. Trigger: four reproduced lifecycle gaps in research.
- Goal: a canceled/expired tracked job cannot silently resume, and a disconnected
  client can reconcile an explicit terminal outcome without an unbounded SSE sink.
- Non-goals: new envelope, idempotency, job queue, provider retry, cross-process
  controller ownership, total-order terminal arbitration, or shutdown redesign.
- Verifier: targeted SQLite/transport/browser-channel tests and exact-tip CI.
- Stop: every activation row below passes, including mutation negatives and review.
- Memory artifact: this decade plus the research ledger; main owns FSM/goal/git.
- Terminal: DONE only for this behavior; BLOCKED on incompatible WP03 seam or
  inability to prove durable transition. Escalate scope changes to main; no leaf fanout.

## Dependencies and boundary decision

Semantic: existing envelope v1, terminal_jobs schema v7, WP03 preserving execution
entry signatures. WP03 owns selected-provider authentication/reference refusal and
proposed `lib/providers/execution/types.ts`; WP02 is pure UI state, not pre-dispatch
authentication. Callers keep startJob/finishJob/persistence. WP07 does not move those
responsibilities into adapters. WP04–06 are regression consumers, not imports of this WP.
Stack: base WP06m (065 bounded video downloads after WP06); next WP08 integrates
cumulative behavior. WP06m adds no semantic job API dependency; it is the verified
transport baseline immediately below this layer.

Current: routes/pipelines → inflight → db/eventBus; ssePublish → inflight/eventBus;
events route → eventBus only; browser eventChannel → server and resync callback.
Keep eventBus free of inflight/database imports. Extract ONLY terminal disk I/O from
the already 499-line inflight.ts to `lib/jobs/terminalStore.ts`; keep controller and
in-memory ownership in inflight. Rejected: a universal job manager or a new schema.
The extraction supplies the durable write needed before expiry deletion, not a
generic persistence abstraction. App-level blast radius; no dependency added.

## File change manifest

| Action | Exact path | Change |
|---|---|---|
| NEW | `lib/jobs/terminalStore.ts` | TerminalJob/row type and existing disk read/write/reap behavior |
| MODIFY | `lib/inflight.ts` | Reuse terminal store, expired terminal transition, late-controller guard |
| MODIFY | `lib/ssePublish.ts` | Suppress done for tracking-expired jobs as for canceled jobs |
| MODIFY | `lib/eventBus.ts` | Detect future process cursor, including empty new ring |
| MODIFY | `routes/events.ts` | Idempotent cleanup before replay; disconnect write(false) |
| MODIFY | `ui/src/lib/eventChannel.ts` | Handle replay-gap as control event, clear cursor, resync |
| MODIFY | `ui/src/lib/errorCodes.ts` | Register JOB_TRACKING_TIMEOUT, fixed safe fallback, explicit resolver precedence with no retry CTA |
| MODIFY | `ui/src/lib/sseStreamError.ts` | Normalize recognized tracking-timeout text before raw-message consumers |
| MODIFY | `ui/src/lib/errorHandler.ts` | Return localized tracking warning as well as dispatching the real toast |
| MODIFY | `ui/src/store/storeHelpers.ts` | Safe terminalJobError and opt-in expired-ID read for reconciliation only |
| MODIFY | `ui/src/store/storeInflightImpl.ts` | Snapshot IDs for scopes, reread after await; preserve concurrent additions/replacements/removals while restoring aged terminals |
| MODIFY | `ui/src/store/storeVideoImpl.ts` | Both video catch paths route tracking timeout through real localized handler |
| MODIFY | `ui/src/lib/mcpProviders.ts` | Existing watcher consumes canonical SSE error parser |
| MODIFY | `ui/src/store/storeSettingsImpl.ts` | MCP error-message mapper recognizes tracking timeout and uses same localized warning |
| MODIFY | `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`, `ui/src/i18n/zh-Hans.json`, `ui/src/i18n/zh-Hant.json` | Add toast.jobTrackingTimeout to all four shipped dictionaries |
| MODIFY | `bin/lib/mcpJob.ts` | Fixed tracking warning for live envelope/legacy SSE and restored terminal result |
| MODIFY | `tests/inflight-persistence.test.ts` | Extend TTL assertion to durable terminal and metadata |
| MODIFY | `tests/inflight.test.ts` | Cancellation-before-registration and completed compatibility |
| MODIFY | `tests/terminal-jobs-restart.test.ts` | Expired snapshot restore with a fresh module |
| MODIFY | `tests/event-bus.test.ts` | Future/empty/retained cursor boundary cases |
| NEW | `tests/events-backpressure.test.ts` | Route lifecycle behavior with deterministic writable/close stubs |
| NEW | `tests/event-channel-replay-gap.test.ts` | Real channel module, fake EventSource, cursor/resync behavior |
| NEW | `tests/job-tracking-timeout-ui.test.ts` | Real resolver/handler, raw parser, terminal restore and reconciliation with intercepted transport |
| MODIFY | `tests/node-error-info-contract.test.ts` | Exhaustive ImaErrorCode expectation adds JOB_TRACKING_TIMEOUT: fix-input, retryable=false |
| MODIFY | `tests/mcp-job-envelope-consumer.test.ts`, `tests/job-terminal-status-contract.test.ts` | Public runMcpJob live and replay-gap timeout recovery, no resubmit or message echo |
| NEW | `ui/e2e/j7b-tracking-timeout.spec.ts` | Standalone WP07 live/reload toast render; existing fixture only on clean disposable hosted runner |
| MODIFY | `structure/03-server-api.md` | TTL terminal recovery and replay-gap protocol |
| MODIFY | `structure/04-frontend-architecture.md` | Gap control event invokes existing resync callback |
| MODIFY | `structure/01-file-function-map.md` | New owner and regenerated counts |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Regenerate inventory for new tests |

DELETE: none. Generated .js is emitted by existing build commands, never hand-edited
or newly tracked. No .db migration or config deadline change.
Read-only consumers: api-generation.ts/nodeApi.ts/videoExtendStream.ts parse SSE;
storeGenImpl.ts/storeNodeGenImpl.ts/storeAssetGenImpl.ts dispatch handleError;
nodeErrorInfo.ts/agentQueueError.ts/Toast.tsx consume its resolver/spec. storeTypes.ts/api-inflight.ts
accept string errorCode/numeric httpStatus. No new terminal field/status or retry framework.

## Diff-level implementation

### Terminal disk owner: complete new-file design

`lib/jobs/terminalStore.ts` imports `getDb` and no inflight/eventBus/logger. Export:

```ts
export interface TerminalJob {
  requestId: string; kind: string; status: string;
  startedAt: number; finishedAt: number; durationMs: number;
  phase: string; phaseAt: number;
  httpStatus?: number | undefined; errorCode?: string | undefined;
  prompt?: string | null; meta: Record<string, unknown>;
}
export function readTerminalJobs(cutoff: number): TerminalJob[];
export function writeTerminalJob(job: TerminalJob): void;
export function deleteExpiredTerminalJobs(cutoff: number): void;
```

Move the existing `TerminalJobRow`, column mapping and INSERT OR REPLACE SQL verbatim
from inflight.ts:98-134. `readTerminalJobs` selects `finished_at > cutoff`, parses
meta at the SQLite boundary (invalid/non-object JSON → {}), derives duration from
timestamps, and preserves optional nullable HTTP/code fields. `writeTerminalJob`
throws on SQLite failure, never swallows it. `deleteExpiredTerminalJobs` uses the
existing `<= cutoff` predicate. No singleton map or new initialization at import.
Existing inflight restoration/reap/normal finish call sites catch/log with their
existing scopes, preserving their current non-fatal semantics. The expiry path
below intentionally requires the write to succeed transactionally.

### Inflight expiry and cancellation

Before (`lib/inflight.ts:438`):

```ts
export function purgeStaleJobs(now = Date.now()) {
  getDb().prepare("DELETE FROM inflight WHERE started_at < ?")
    .run(now - config.inflight.ttlMs);
}
```

After: retain public signature; select only rows matching the SAME strict `<`
cutoff inside one synchronous SQLite transaction. For each row, build a
TerminalJob preserving requestId/kind/phase/phaseAt/meta/startedAt, omitting prompt:

```ts
const terminal = {
  requestId: row.request_id, kind: row.kind,
  status: "error", startedAt: Number(row.started_at), finishedAt: now,
  durationMs: now - Number(row.started_at), phase: row.phase || "queued",
  phaseAt: Number(row.phase_at || row.started_at),
  httpStatus: 504, errorCode: "JOB_TRACKING_TIMEOUT", meta: parseMeta(row.meta),
};
writeTerminalJob(terminal); // transaction must roll back on failure
db.prepare("DELETE FROM inflight WHERE request_id = ?").run(row.request_id);
```

Transaction returns terminal snapshots. Only after commit, insert snapshots into
terminalJobs, abort/delete any local controllers and registration timestamps, and
publish one `error` per newly expired row using eventBus + buildEnvelope (the same
cycle-free path already used by abortJob). Data:

```ts
{
  requestId, code: "JOB_TRACKING_TIMEOUT", status: 504,
  error: "Job tracking expired; upstream completion is unknown. Inspect history before retrying."
}
```

Catch at purge boundary, log `inflight/expire:error`, leave row and controller intact
if disk transaction fails; do not publish success or expiry for an uncommitted row.
Repeated purge finds no matching row and emits nothing. Do not call listJobs from
purge or finishJob from within purge (recursive purge/indirect reaping hazards).
In-memory additions and abort happen before publishing; listeners never see an
expiry while the corresponding local controller remains usable.

Add `export function isJobTrackingExpired(requestId: string | null | undefined):
boolean`: lazy restore, then compare snapshot.errorCode to JOB_TRACKING_TIMEOUT.
No new public raw terminal status. Before registration's map write:

```ts
if (isJobCanceled(requestId) || isJobTrackingExpired(requestId)) {
  controller.abort();
  return;
}
```

Ordinary `startJob` still clears fresh in-memory terminal state on successful new
admission; respectCanceledTombstone remains opt-in. Prevent disk resurrection on
reuse by deleting that requestId's old terminal_jobs row in the SAME transaction
as new inflight INSERT (only after insert succeeds). This is targeted per-ID
admission cleanup, not a boot-wide sweep. Existing retry reuse remains valid.
Honor restored cancel tombstones before opt-in check: call lazy restore before
reading terminalJobs in `startJob` when respectCanceledTombstone is true.

Before ssePublish: `if (event === "done" && isJobCanceled(requestId)) return false;`
After: same condition with `(isJobCanceled(requestId) || isJobTrackingExpired(requestId))`.
Preserve return boolean, data/envelope shape, sequence allocation and sync adapters.
This suppresses late success, not every possible duplicate provider failure event.

### Tracking-timeout consumer repair (R1-08)

Before: unknown code falls through resolveErrorSpec; terminalJobError uses generic failure text;
mcpJob terminalResult uses meta.message/"MCP job failed". Safe SSE text alone cannot repair them.

In `ui/src/lib/errorCodes.ts`, extend ImaErrorCode and its exhaustive registry:

```ts
// additional union member: | "JOB_TRACKING_TIMEOUT"
export const JOB_TRACKING_TIMEOUT_MESSAGE =
  "Job tracking expired; upstream completion is unknown. Inspect history before retrying.";
// additional errorCodes entry (no cta):
JOB_TRACKING_TIMEOUT: { surface: "toast", toastKey: "toast.jobTrackingTimeout" },
```

In resolveErrorSpec, AFTER computing registered but BEFORE priority/fallback class
selection, return the fixed spec for this exact recognized code (including the
existing unknown-wrapper/rawCode path). Preserve priority behavior for every other
code. Return no rawCode/errorClass or caller-supplied message on this branch:

```ts
if (registered === "JOB_TRACKING_TIMEOUT") {
  return { code: registered, spec: errorCodes[registered],
    message: JOB_TRACKING_TIMEOUT_MESSAGE };
}
```

Do not classify arbitrary "timeout" text as tracking expiry: AGY_TIMEOUT/MCP_JOB_TIMEOUT stay distinct.
No retry CTA, auto-resubmit, success inference or billing/refund promise is introduced.

`sseStreamError.ts` imports the constant, keeps envelope-first code selection and
sets `message = JOB_TRACKING_TIMEOUT_MESSAGE` immediately before constructing Error
when final code is JOB_TRACKING_TIMEOUT. All existing raw-message consumers then
receive safe fixed text even if wire error/message contains synthetic secrets.
`storeHelpers.ts` imports the same constant; retain terminalJobError's signature,
code and status assignment, replacing ONLY its message selection:

```ts
const e = new Error(code === "JOB_TRACKING_TIMEOUT"
  ? JOB_TRACKING_TIMEOUT_MESSAGE
  : code === "EMPTY_RESPONSE" ? "No image data returned from the image backend."
  : "Generation failed on the server.") as Error & { code?: string; status?: number };
```

`errorHandler.ts` keeps its public signature; in the toast branch, after showToast,
return `{ code, message: toastMsg }` for JOB_TRACKING_TIMEOUT only. Existing return
behavior remains for other codes. In BOTH non-cancel video catches, resolve the code;
for tracking timeout obtain message from `handleError(error, get()).message` and
do not subsequently call showToast again. Other errors retain the original message
and toast path. Existing graph/pending cleanup remains unchanged. This fixes video's
direct showToast bypass without changing unrelated error semantics.

`mcpProviders.ts` replaces watchMcpJob's hand-built Error/code with
`callbacks.onError?.(parseSseErrorPayload(data, "MCP generation failed"))`, importing
the existing parser. Keep finish/unsubscribe/timer behavior. `storeSettingsImpl.ts`
adds `if (candidate.code === "JOB_TRACKING_TIMEOUT") return t("toast.jobTrackingTimeout");`
before its MCP-specific branches. Both existing callback and catch callers reuse it.

Dictionary values for `toast.jobTrackingTimeout` are fixed, with no interpolation:

| File locale | Exact warning |
|---|---|
| en | Job tracking expired; upstream completion is unknown. Inspect history before retrying. |
| ko | 작업 추적 시간이 만료되어 제공자 측 완료 여부를 알 수 없습니다. 다시 시도하기 전에 기록을 확인하세요. |
| zh-Hans | 任务跟踪已超时，无法确认服务提供方是否已完成。重试前请先检查历史记录。 |
| zh-Hant | 工作追蹤已逾時，無法確認服務提供方是否已完成。重試前請先檢查歷史紀錄。 |

No prompt, credential, provider reply, requestId, metadata or raw message enters UI/CLI warning text.
Node ErrorInfo uses the fixed fallback and existing non-retryable fix-input action; no Retry action.
Toast is localized in all locales.

Reload reachability: loadInFlight currently discards records older than 180s before
reconcileInflight can match a much older server TTL terminal. Preserve its default
for normal storage sync; add this optional argument in storeHelpers:

```ts
export function loadInFlight(
  { includeExpired = false }: { includeExpired?: boolean } = {},
): PersistedInFlight[];
// existing shape checks retained; replace only the age predicate with:
// (includeExpired || now - x.startedAt < INFLIGHT_TTL_MS)
```

R2-U1: baseline reads local state AFTER await; preserve that property. Snapshot raw-storage/memory IDs
only for scopes/comparison; fresh memory wins. Add private storeInflightImpl helpers (import type PersistedInFlight):

```ts
function readReconcileLocal(state: AppState): Map<string, PersistedInFlight> {
  return new Map([...loadInFlight({ includeExpired: true }), ...state.inFlight]
    .map(job => [job.id, job] as const));
}
function inflightRevision(job: PersistedInFlight): string {
  return JSON.stringify([job.startedAt, job.kind ?? "classic", job.sessionId ?? null,
    job.parentNodeId ?? null, job.clientNodeId ?? null, job.phase ?? null,
    job.prompt, job.composerPrompt ?? null, job.composerInsertedPrompts ?? null]);
}
```

Complete replacement; captured revision strings plus memory identity protect same-ID replacements.
No persisted version, global counter, tombstone cache or extra POST is added.

```ts
export async function reconcileInflightImpl(set: StoreSet, get: StoreGet): Promise<void> {
  try {
    const initial = get();
    const initialMode = initial.uiMode, initialSession = initial.activeSessionId;
    const before = readReconcileLocal(initial);
    const revisions = new Map([...before].map(([id, job]) => [id, inflightRevision(job)]));
    const memory = new Map(initial.inFlight.map(job => [job.id, job]));
    const scopes = getInflightQueryScopes({ ...initial, inFlight: [...before.values()] });
    const { jobs, terminalJobs = [] } = await fetchInflightScopes(scopes);
    const latest = get();
    if (latest.uiMode !== initialMode || latest.activeSessionId !== initialSession) return;
    const fresh = readReconcileLocal(latest);
    const latestMemory = new Map(latest.inFlight.map(job => [job.id, job]));
    const serverById = new Map(jobs.map(job => [job.requestId, job]));
    const terminalById = new Map(terminalJobs.map(job => [job.requestId, job]));
    const terminalErrors: ReturnType<typeof terminalJobError>[] = [];
    const now = Date.now();
    const merged = [...fresh.values()].flatMap(f => {
      const replaced = memory.has(f.id) && latestMemory.has(f.id) && memory.get(f.id) !== latestMemory.get(f.id);
      if (!before.has(f.id) || revisions.get(f.id) !== inflightRevision(f) || replaced) return [f];
      if (!matchesInflightScope(f, scopes)) return [f];
      const serverJob = serverById.get(f.id);
      if (serverJob) {
        const restored = toPersistedInFlightJob(serverJob);
        if (!matchesInflightScope(restored, scopes)) return [f];
        return [{ ...f, ...restored, prompt: f.prompt || restored.prompt, phase: f.phase || restored.phase }];
      }
      const terminal = terminalById.get(f.id);
      if (terminal) {
        if (!matchesInflightScope(toPersistedInFlightJob(terminal), scopes)) return [f];
        if (terminal.status === "error") terminalErrors.push(terminalJobError(terminal));
        return [];
      }
      return now - f.startedAt < 10_000 ? [f] : [];
    });
    for (const job of jobs) {
      if (before.has(job.requestId) || fresh.has(job.requestId)) continue;
      const restored = toPersistedInFlightJob(job);
      if (matchesInflightScope(restored, scopes)) { merged.push(restored); fresh.set(job.requestId, restored); }
    }
    saveInFlight(merged);
    set({ inFlight: merged, activeGenerations: merged.length });
    for (const err of terminalErrors) handleError(err, get());
    if (merged.length > 0) get().startInFlightPolling();
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[inflight] reconcile failed", e);
  }
}
```

Prefetch IDs absent from BOTH current sources never re-enter through stale server jobs.
Unchanged canceled terminals remove their ID without a toast. Scope switches discard the response
without writes/toasts; next normal reconcile handles the new scope. Unknown old IDs retain the grace rule;
matching expired terminals still emit the R1 localized warning once. Fetch failure keeps state/storage intact.
Server correlation remains requestId-based: client/server startedAt clocks differ and MUST NOT be compared.
Revisions compare local snapshots only. Stored-only identical remove/readd between reads remains unobservable.

CLI `bin/lib/mcpJob.ts` defines a local constant with the SAME fixed English warning
(no browser import). In terminalResult's normalized error branch, handle exact
job.errorCode JOB_TRACKING_TIMEOUT before reading meta.message: return
`new McpJobError("JOB_TRACKING_TIMEOUT", JOB_TRACKING_TIMEOUT_MESSAGE, { status: 504 })`.
In matchingOutcome's envelope-error and legacy-error branches, first compute the
existing selected code; for this code return the same error/message/status without
body metadata, otherwise keep current behavior. No resubmit/retry changes to
runMcpJob/recoverReplayGap; code-less timed_out remains MCP_JOB_TIMEOUT. JSON/human
CLI consumers receive the fixed message through the existing McpJobError contract.

### Replay and bounded delivery

Before `hasReplayGap`: returns false for empty ring and any future cursor.
After full predicate:

```ts
if (!Number.isSafeInteger(lastEventId) || lastEventId <= 0) return false;
if (lastEventId > seq) return true;
const oldest = replayOldestId();
return oldest !== null && lastEventId < oldest - 1;
```

Keep numeric SSE IDs and existing gap payload, including nullable oldestAvailableId.
Do not claim equal/lower cursor collision after restart is detected: numeric cursors
have no epoch. Existing reconnect resync covers that case; adding an epoch is outside
this WP's compatibility budget.

Before safeWrite: ignores `res.write` boolean. After: `return res.write(chunk);`
false means disconnect subscriber, not retry chunk (Node already accepted it).
In registerEventsRoute initialize `cleaned`, no-op `unsub`, and optional heartbeat
BEFORE replay; register req/res close/error listeners before first write. Cleanup
unsubscribes once, clears timer if allocated, decrements activeConnections once,
removes installed listeners, and closes/destroys only this response. On false write
destroy the response to discard its buffered pending writes; no custom queue.
Every replay write failure calls cleanup and RETURNS from handler, so no subscription
or heartbeat is created afterward. Live and heartbeat failure use same cleanup.
Capacity rejection remains 503 SSE_CAPACITY; successful capacity is reusable.

Browser addition after regular event listeners:

```ts
source.addEventListener("replay-gap", () => {
  lastEventId = "";
  resyncCallback?.();
});
```

This control event has no jobId and must NOT pass through dispatch. It does not
close/reset subscriptions or pretend to be a failed generation. Subsequent valid
frames advance lastEventId normally. Retain reconnect backoff and one EventSource.

## Contract chain and activation acceptance

`JOB_TRACKING_TIMEOUT`: creation purge → terminal_jobs.error_code + event data →
terminal restore and SSE JSON → buildEnvelope maps TIMEOUT to timed_out →
SSE parser/terminalJobError → explicit ImaErrorCode registry/resolver → handleError
and four dictionaries → existing toast store/Toast; MCP/video bypasses are mapped
above. CLI mcpJob live/recovery maps errorCode to the same fixed warning. Server
status vocabulary/envelope v1 is unchanged; UI code union is extended explicitly.
Local-ID deserialization preserves expired IDs only for reconciliation. No new
wire field or idempotency-key completion is implied by a tracking timeout.

| Trigger | Independent assertions / negative oracle |
|---|---|
| TTL+1 with active local controller and metadata | active empty; controller aborted; disk terminal status exactly error/code JOB_TRACKING_TIMEOUT; request/session/client IDs retained; no prompt; event envelope phase timed_out/terminal=true |
| exactly cutoff, then cutoff+1 | strict boundary preserves first, expires second; expected literals independent of helper under test |
| repeat purge | no second terminal insert/event; terminal finishedAt unchanged |
| inject SQLite terminal insert failure via temporary DB trigger | row survives, controller not aborted, no expiry event; removing trigger permits transition |
| cancel before register | newly registered signal already aborted; no controller retained; late done through REAL publishJobEvent returns false |
| restart after cancellation then opt-in start | start returns GENERATION_CANCELED; no new active row |
| intentional ordinary reuse of canceled ID, fresh module restore | new admission allowed; obsolete disk cancel absent; new controller not spuriously aborted |
| completed job / unknown job | registration behavior preserved; no inferred cancellation of unknown pre-admission work |
| future cursor on empty and one-event ring | gap true; oldestAvailableId null/1; retained cursor false, evicted cursor true |
| response.write(false) during replay, live, heartbeat | stream destroyed; no further writes/subscriptions; capacity slot released once across close+error |
| replay-gap without jobId | existing resync called, cursor cleared; next reconnect URL lacks previous cursor; unrelated job subscriptions retained |
| live SSE tracking expiry, envelope and legacy flat variants | real parser → resolver → handleError calls showToast with exact locale warning; code stays JOB_TRACKING_TIMEOUT; no generic unknown/card/CTA; video and MCP paths same warning |
| restored status=error/errorCode=JOB_TRACKING_TIMEOUT/httpStatus=504 with poisoned meta.message | terminalJobError and real reconciliation emit exact safe warning; persisted ID removed; activeGenerations=0; subsequent reconcile no second warning |
| reload with a >180s local ID PLUS a recent current ID | old ID reaches correct scope query and terminal match; recent active ID remains; unknown old ID drops without warning/retry; failed fetch preserves storage |
| held response; add new job to current memory/storage, response lacks it | new job survives even after >10s wait, memory wins conflicting storage; saved IDs and activeGenerations agree |
| held response; remove prefetch job from BOTH sources, stale response lists it active | no resurrection, toast or auto-POST; memory/storage/count remain empty |
| held response; replace same ID with new startedAt or same-timestamp new memory object | new attempt survives stale active/terminal/absent results; no old timeout warning; changed phase/prompt in-place is caught by captured revision |
| unchanged same ID, client startedAt=1000/server=1010 or arbitrary clock skew | active result reconciles and terminal removes/warns normally by ID; no cross-clock equality gate |
| held response; unchanged raw expired ID plus concurrently added recent ID | old terminal warns once and is removed, new job survives; second reconcile does not repeat warning |
| held response; switch node session A to B (also test node to classic) | old-scope response makes zero writes/toasts; new scope's memory/storage/count unchanged; next explicit reconcile queries B/classic |
| same temporary DB after fresh server module restore | actual persisted timeout snapshot still code/error/504; feed snapshot through UI restore and public CLI replay-gap recovery; completion unknown warning retained |
| hostile raw message + AUTH_EXPIRED class with exact tracking code | fixed tracking spec/message wins; no echoed secret/ID/prompt or auth/retry CTA; unrelated AUTH_EXPIRED and unknown timeout code preserve baseline behavior |
| all four locales, live then restored browser state | observed alert text equals independently hardcoded localized literal, no raw-key fallback; dismiss/reload triggers zero generation POSTs beyond initial live submission |
| runMcpJob receives live expiry or replay-gap with restored expiry | public promise rejects code JOB_TRACKING_TIMEOUT/status504/fixed warning; POST count exactly one, no retry timer/new submission, no raw meta/body echo |

Tests must run real modules, not the local replica of publishJobEvent currently in
tests/inflight.test.ts. Use direct import after temporary config env setup. EventSource
test transpiles the import-free `ui/src/lib/eventChannel.ts` with installed TypeScript
transpileModule (ESNext target/module), imports its output as a unique data URL, and
sets a fake global EventSource before connect. Valid gap/phase events avoid the
import.meta.env.DEV invalid-payload logging branches; do not rewrite production code
to expose testing internals. Restore global EventSource and call disconnect in finally.
This directly exercises channel behavior without browser or source-regex assertions.

`job-tracking-timeout-ui.test.ts` dynamically imports real errorCodes/parser/
terminalJobError/handleError/reconcileInflightImpl after node:test mock.module
replaces only the existing API barrel (getInflight/getHistory deterministic replies)
and useAppStore export (getState returns selected locale) at their resolved module
paths. The real i18n t/translate and dictionaries stay loaded. Supply memory
localStorage and a window.setInterval callback capture; restore all globals/mocks
in finally. WP05's earlier runner flag enables these mocks; the focused command
below carries that flag too. Drive actual showToast sink, not an imitation resolver.
Iterate real dictionaries with separately hardcoded
expected literals above (not expected=t(actualKey)). Capture fetch/POST counts;
use controlled tick callback for polling, not elapsed wall-clock waits. Exhaustive
node error test adds the new key; existing i18n-dictionary test checks key coverage.
CLI tests use their existing synthetic loopback HTTP/SSE harness through runMcpJob;
DB-restart tests separately prove durable snapshot creation, not copied JSON alone.

`j7b-tracking-timeout.spec.ts` uses existing startApp/seedBrowser ONLY on a disposable,
credential/media-free hosted runner until WP09 proves fixture isolation. No local
server/browser run in WP00/WP07 on a credentialed workstation, no new fixture API
or dependency on future WP09 changes. Before navigation install route intercepts
for generation (202 with captured requestId), SSE (terminal timeout frame), and
inflight (scoped terminal snapshot). Coordinate SSE fulfillment with the observed
submission promise; no upstream generation request is forwarded. Use real composer
submission and real EventSource/parser/store/Toast. For reload, seed an aged local
inflight record only ONCE, serve terminal JSON, reload without reseeding and assert
the alert plus removal, then reload again and assert no alert/no POST. Parameterize
all four locales. Server restart durability stays in SQLite/fresh-module tests;
browser tests prove consumer/rendering, not real upstream timeout. Finally close
fixture/context, attach screenshots and read them at C; WP09 later reruns J7b with
its hardened existing fixture. No bypass routes in production or paid canary.

## Verification, compatibility and rollback

Baseline commands/exits are in research: 28 targeted tests and both typechecks pass
while fault probes demonstrate defects. Future tests do not exist at WP00.
Implementation C runs the same 28 plus new exact test paths, real ssePublish tests,
`npm run typecheck`, `npm run typecheck:tests`, focused UI channel test; full suites
only exact-tip CI. Build server/CLI and UI in CI; refresh counts/inventory in same PR.
Mutation proof: remove late-register guard, restore DELETE-only purge, ignore
write(false), remove gap listener, remove resolver registration/priority branch,
delete one dictionary key, restore generic terminal text, remove includeExpired,
restore CLI meta.message branch; each corresponding assertion must fail.
Held-response tests mutate state/storage before releasing deferred fetch; assert IDs/counts/no POST.
Removing fresh reread, revision guard, removed-ID filter or scope-switch discard must fail the respective scenario.
Additional future targeted commands (not executed/passed in WP00):

```sh
node --experimental-test-module-mocks --import tsx --test tests/job-tracking-timeout-ui.test.ts tests/node-error-info-contract.test.ts tests/mcp-job-envelope-consumer.test.ts tests/job-terminal-status-contract.test.ts tests/i18n-dictionary-contract.test.ts
npm --prefix ui run test:e2e -- e2e/j7b-tracking-timeout.spec.ts
```

Browser command is hosted-only; root typecheck excludes UI, so retain CI's full UI build.

No schema migration. Legacy consumers see existing error status/code fields and
additive envelope; original status spellings retained. Existing TTL and terminal TTL
unchanged. Slow SSE peers may reconnect sooner by design; replay/snapshot recovery
must pass before delivery. Multiple processes still cannot abort each other's fetch;
only local controllers are aborted and completion remains explicitly unknown.
Rollback is source revert of this layer plus rebuild, preserving SQLite tables and
user files. New error snapshots are readable by old clients as ordinary failures.
Old clients may lose the explicit unknown-completion warning; that is a rollback
limitation, not evidence of safe retry. Revert parser/resolver/dictionaries and CLI
mapping together; do not strand a new registry key without localized text.
No automatic retry during rollback. Current-architecture docs synchronize in the same implementation PR.
