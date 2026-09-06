# WP07 C — independent findings and dispositions

Initial freeze84dbca6390c552775a95528db131dc04ad7353fe / draft PR208 over207.
Source/test/UI/E2E types and builds pass; exact24-path receipt229outerPASS/0FAIL.
Original manualHTTP, nativebrowser screenshot and currentCI remain pending.

## C1 — native close oracle attribution (Carson): accept

Root cause: native instrumentation labels close context only while onerror runs;
an addEventListener error subscriber may call close while labeled none. Assertion
rejects only application-labeled close, leaving that path unobserved.
The observed source has no other legitimate close during this live terminal scenario:
stream remains open, one native OPEN before POST, and fixture teardown is later.
Amend assertNativeError to require ZERO explicit closes at that checkpoint, regardless
of the instrumentation label. This covers both property and listener call paths
without replacing native event dispatch. Keep attribution for diagnostics only.
Add assertion of exactly one native OPEN to rule out a silent reconnect before the
check. Native browser run must exercise it; source-only approval is not proof.

No production change or relaxed assertion. This strengthens075's oracle and does
not change transport policy, watcher settlement or cleanup. Same C reviewer checks
closure after the edit; remaining test-file coverage must be accounted for too.

## C2/C3 — Hegel UI findings: falsification requested before patch

C2 alleges a same-ID replacement between merge and commit. Both calls execute
synchronously in one JS turn after the await, with no intervening await. Main
requests a concrete reachable synchronous reentrant callback; another network/UI
callback cannot interleave by itself. No speculative defensive rewrite accepted.

C3 alleges Sprite cancel while whenConnected waits. Main requests a real caller
able to obtain that private generated requestId before submission. Existing cancel
action is request-scoped unsubscription, not backend abort; distinguish introduced
reachable behavior from existing private/unused presentation boundaries. Do not
call source speculation verified. Await actual caller/runtime proof or retraction.

Same reviewer retracted BOTH after falsification: no reentrant replacement callback
exists between the synchronous merge/commit; SpriteRowList renders cancel only for
server-provided row.requestId, unavailable during initial OPEN wait. No production
patch was made for either finding. Scoped UI verdict PASS,96focusedPASS.

Carson reverified C1's stronger no-close/one-OPEN oracle and completed the full test
coverage ledger. E2E typecheck0,225focusedPASS plusCIcontract3PASS, scoped PASS.
Avicenna server/CLI/transport review PASS with no findings. All three leave real
browser/manualHTTP/currentCI as pending, not waived. Main keeps those gates open.
