# Discovered prerequisite CI history defect — merge blocker
Observed while WP01 C runs, not caused by provider-surface source changes.
PR199 Fast Gate run33941317762 fails one of2790 tests:
tests/release-pipeline-contract.test.ts:672 cannot prove recorded wp9 SHA
86bf459088ee03f12c2702c0391deb1c27b93043 is an ancestor of HEAD.
Full exact-head CI33941316446 at the same ecde2bc7 succeeds, as does docs
CI33941317918 at8c403872. No retry/flake assumption and no waived merge gate.

## Causal proof
H1 missing ancestor in the source history: falsified by actual
git merge-base --is-ancestor 86bf459... ecde2bc7 ->exit0.
H2 different code/test behavior: full same-head tests pass; PR checkout limits
graph depth while full ci.yml checkout uses0.
H3 shallow graph prevents ancestry query: reproduced with an owned four-empty-
commit Git fixture /tmp/ima2-history-proof.PbE84M. Clone --depth2 cannot resolve
the oldest commit, merge-base exit128; fetch --unshallow then same query exit0.
No production/user source changed by the probe; no test suite ran locally.

## Assigned correction and sequencing
WP12 owns pipeline integrity, so add full-history PR checkout and a real shallow/
full graph negative test there. Keep the ancestry guard unchanged and HEAD^1 blob
budget unchanged; fetch-depth0 still contains the merge first parent. No gate skip,
provenance-map alteration, or acceptance of a red PR199.

Before WP13 can merge the stack, WP12 must supply a narrow CI-history prerequisite
PR based on current dev: checkout depth0, its standalone test and inventory only.
This is a delivery prerequisite, NOT another counted production feature WP.
It is built/tested in the WP12-governed scope and copied to an owned isolated branch;
the main tracked checkout also contains the same source delta, avoiding detached
work masquerading as FSM progress. Require that prerequisite PR's own full checks,
then merge it normally to dev under existing user authority.

Cascade updated dev into task-owned prerequisite/head branches bottom-up using
explicit merge-up commits (not forced shared refs), then cascade each updated
parent into its next child. This preserves existing implementation commit ancestry.
Verify each current parent is ancestor of child and diff contains only intended
layer; rerun exact-head CI/PR checks where heads changed. No blind update-refs that
could move the user's local dev ref, no top-layer-first feature merge.
Only after PR199's original Fast Gate succeeds on refreshed valid history and all
layer receipts agree may WP13 merge features and release.

WP01's declared per-layer verifier is matching-ref exact-head ci.yml, because
mid-stack PR Fast Gate does not trigger before WP12. Its source scope can finish
on its own green exact-head check/visual/review; this is NOT a replacement or
waiver of PR199's failed gate. The unresolved global merge blocker is retained
in WP12 and WP13 tasks/criterion and must not disappear at WP01 D.
