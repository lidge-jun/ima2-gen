# WP07 C — first full-CI failure synthesis

Run33978375030 at84dbca63: Node22/24 each fail5; E2E51PASS/2FAIL. Retain failed
run and downloaded artifacts in wp07/ci-84dbca63-{wp07,failures}. No green-on-retry.
Manual HTTP captures at9f15e6a4 completed before any repair: Agy14PASS,video27PASS,
including originalcancelterminal1. They stay bound to9f, never relabeled newHEAD.

## Root gates: accept five specific repairs

1. job-tracking-ci-contract froze one upload-action SHA, contradicting existing
   action-pin-contract's Dependabot-safe pin policy. Reuse _actionPins.mjs's
   assertActionPinned against the actual step; require the correct action and full
   immutable commit without freezing a specific version in executable test source.
   Add mutable/wrong-action negatives; do not weaken the pin gate.
2. frontend-connection-state-contract matches source.onopen, renamed ownedSource.
   Replace that one source-shape assertion with actual eventChannel callback proof
   using the existing runtime fixture; keep unrelated tests unchanged.
3. history-strip-duplicate-contract matches local variable s and old empty-array
   guard spelling. Replace only those implementation-shaped assertions with actual
   concurrent-history dedup/no-op behavior. Preserve unchanged metadata/upsert/UI
   contracts; no source rename solely to satisfy regex.
4. ui-error-code-contract's one-level source scanner misses the extracted terminal
   match and expects handleError(err,...) spelling. Replace those two assertions
   with actual polling terminal delivery/removal/no-repeat behavior, preserving
   unrelated API/error-map/i18n assertions.
5. openai-execution-parity O04-9 intentionally recorded baseline duplicate cancel
   errors. CI now observes one error; update this exact expected event list to the
   new single terminal contract, retaining499/code, partialimagebytes, sidecar and
   sequenceStatus assertions. This is the requested sharedguard behavior, not a
   production parity regression or permission to discard partial output.

## Native E2E failures

6. animation cancel is silent by contract, but negated toContainText on .toast
   still requires an element. CI says element notfound. Assert zero matching
   success toasts, then existing zero-total-toast assertion for cancel; retain
   positive warning/error/success controls. No product toast added for the test.
7. video-node times out before any POST. Captured JSON: requests[], native[],
   one closed SSE connection withframes0, graph autosave correct, no console or
   unexpected-route errors. DOM snapshot contains real visible named Gen control
   and empty node. Cause is not yet proven. Inspect viewport/control reachability,
   load/open barriers and teardown masking. Add named bounded steps plus pre-action
   screenshot/geometry and trace-on-failure if needed; do not lengthen timeout,
   force-click an occluded control, fake nativeOPEN, or change production speculatively.

Main owns root-test corrections; original presentation worker may repair only its
J7b test/harness after explicit packet. All resource checks finished/held before
tracked writes. Subsequent freshheadcompilers/receipt/CI/manualproof required.
