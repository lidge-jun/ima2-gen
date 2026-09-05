# WP01 C repair synthesis
Current source60e36bb3; docs-only follow-up6a87ce22. Independent C reviewer
McClintock01a06fa7-55c1-7db0-89d7-474f270ed54d ran77 focusedtests/type/drift0
but found one verified Medium actual regression.

## Runtime cause
Saved graph data preserves provider stringauto through sessionStore.saveGraph/
getSession and mapSessionToGraph. storeNodeGenImpl passes it to effectiveReferenceLimit
after taking a node lock but before its try/finally. New direct generated-map
lookup assumes a core key and throws; correcting provider afterward still sees
the leaked lock. Reviewer toggled baseline/current helper with same actual
consumer: baseline fallback5 and retry, current exception and stucklock.
Accepted fix: canonical isCoreProviderId membership before generated-map lookup;
only an explicit core references:false disables attachment. Optional lookup alone
still reached inherited constructor/__proto__/toString entries, so those persisted
values were reproduced and added to the real recovery tests before finalization.
Keep unknown provider fallback to numeric server limit exactly as before. Do not
add new provider routing, auth, or broad node pipeline changes. Add durable real
save/restore->consumer retry regression plus direct fallback assertion.

## Separate CI failure
Both Node22/24 fullCI at60e36bb3 fail tests/nai-ui-registration-contract.test.ts:117,
which searches source for removed LANES_WITHOUT_REFERENCE_SUPPORT. New metadata
correctly replaces that constant; putting its name in a comment would forge green.
Replace obsolete lexical checks with real effectiveReferenceLimit expectations:
NAI0, OAuth/API serverdefault, MCP precedence; retain unrelated UI/settings checks.
This is not waiver of a failing behavioral assertion.

The3976ce46 full run exposed two further obsolete lexical assertions in
nai-routing-contract.test.ts (exact NAI if-condition and textOnlyCapabilities name).
Impact search across tests for every removed identifier/predicate found only these
remaining cases. They now execute the actual policy getter and injected lane-map
builder. Actual HTTP refusals/order/zero calls remain covered by the new boundary
suite; alpha/MIME/routing tests elsewhere in the same file are retained unchanged.
Queued8a46771f CI was canceled as known-obsolete, not relabeled a success.

## Verification
Run new consumer test RED before optional fix, then GREEN; rerun named old failed
test and focused matrix, fresh UI/type/build plus exact-headCI. Reuse same C
reviewer for closure. Existing cleanCI visual artifacts already show correct
core NAI/OAuth affordances, but do not prove restored non-core node behavior.
Global PR199 shallow-history failure remains separately owned by013/WP12; no merge.
