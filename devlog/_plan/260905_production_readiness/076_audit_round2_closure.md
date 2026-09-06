# WP07 A — round2 synthesis and main gate judgment

Both same reviewers audited abe7d52b51c2e16fa833e49c36b53f816c318c02 against9c95c41d.
Euclid S1–S4 and Parfit U1–U5 each returned GO-WITH-FIXES (blockers=1), not FAIL.
Original High blockers are closed at plan level. Two Medium boundaries remain;
main accepts both below before B. No production/test implementation has occurred.

## S2-zero-cursor: accept

Cause: new pump treats0 as a valid position, old hasReplayGap rejects <=0. A
heartbeat can block while0 remains current; global ring may evict the first event
before drain. Reviewer's actual pure bus probe published2001 tiny events, observed
oldest2/gapAtZero=false/firstReplayed2. Main inspected eventBus/routes/events.

Replace070's predicate first line with
`if (!Number.isSafeInteger(lastEventId) || lastEventId < 0) return false;`.
Keep future comparison and oldest comparison. Thus0 on empty/retained-first1 is
not a gap;0 with oldest2 is a gap. Absent/invalid external cursor still starts at
latestEventId in074, so existing live-only connection behavior is unchanged.
Exact0 means replay beginning and cannot silently skip evicted data. No epoch.

Transport worker tests actual bus0 boundaries and route: initialempty/live-only,
heartbeat writefalse beforefirstnumberedframe, publish RING_SIZE+1 tiny events,
drain, observe one gap before retained frames and snapshot-resync/recovery trigger.
Retain strict deadline/accepted-chunk/teardown assertions; the few thousand tiny
in-memory objects are not a large-payload or load test. Restoring <=0 must go RED.

## U4-undo-lifetime: accept

Cause: mergeAfterRestore begins with historic node.data then preserves live pending
fields but omits error/errorInfo. Undo is allowed during a new pending request and
schedules saving, so video-writer clearing alone cannot protect that attempt.
Reviewer's actual pure function retained the newpendingID AND oldtrackingerrorInfo.
Main read nodeHistory, useAppStore undo/redo, node-history-contract and graph save.

Additional MODIFY files owned by UI presentation worker:
- ui/src/lib/nodeHistory.ts: add "error" and "errorInfo" to PENDING_FIELDS; both
  values come from live pending/reconciling state, including undefined/null.
  Nonbusy restored nodes keep historical errors; no global error wiping.
- tests/node-history-contract.test.ts: extend GH-04 plus nonbusy controls with
  distinct historic/live error fields, both pending/reconciling and undo/redo.

Add actual-store sequence to job-tracking-timeout-ui.test.ts using072's fixture:
tracking failure -> recordGraphHistory/add-root -> newvideo admission clears ->
undoGraph (also redo control) -> existing scheduled graph save -> captured serialized
body -> actual mapSessionToGraph. Assert current pending ID/state preserved, no old
warning/title/errorInfo and reload breadcrumb correct; nonbusy historical tracking
error survives undo/save/reload. This closes the reachable restoring writer; no
additional sanitizeForSave blanket-clearing patch is needed. The shared fixture
exposes existing storeGraphSave exports for mapSessionToGraph only, not private
sanitizeForSave. Drive actual scheduled save via public action/timer and owned route.
Removing the two pending-field entries must make the busy restore assertion RED.

## Reconciliation and judgment

Neither correction changes terminal schema, queue, provider behavior, numeric epoch,
or the approved ownership model. S2 reconciles an internal valid cursor with the
public absence sentinel; U4 reconciles presentation lifetime with existing Undo.
070/072/074 point here and contain the corrected zero predicate/ownership.075's
native streaming fixture remains unchanged. All prior acceptance rows remain.

Main judges NEAR-PASS: both normalized reviewer verdicts permit concrete fixes,
no unresolved High/Critical, and both Medium residuals are folded into exact source
diffs and independently falsifiable tests above. They are mandatory B/C tasks,
not deferred debt or waived findings. C gets fresh independent reviewers and real
native HTTP/browser proof. Failed original A and WP06 wire records remain intact.

Verbatim reviewer tails:
Euclid: `blocking_issues: [S2-zero-cursor]` / `VERDICT: GO-WITH-FIXES (blockers=1)`.
Parfit: `blocking_issues: [U4]` / `VERDICT: GO-WITH-FIXES (blockers=1)`.
