# WP06 A — round1 synthesis (before repairs)

Audited a286b48c, baseline54543ee0 source unchanged. No B authorization yet.
Hegel/semantics GO-WITH-FIXES0blockers; Volta/lifetime FAIL2; Laplace/security FAIL3.
All reports are read-only source/control-flow audits, not executed implementation.

| ID | Finding / root cause | Decision and bounded repair |
| --- | --- | --- |
| L1 High | Return inside try is queued before awaited ref cleanup in finally; a pre-return check misses abort during cleanup | ACCEPT. Store successful result, await ref cleanup, then final signal check with no following await before return. On primary failure rethrow it after cleanup without an overriding cancellation check. Add exact ref-rm barrier and primary-error preservation cases. |
| L2 Medium blocking | Removing post-read check alone can be masked by later cancellation checks | ACCEPT. Define a compound held-read mutation removing every later masking operation guard, explicitly not a single-line activation claim. Independently remove the post-cleanup guard with a later rm-barrier abort; that mutation must fail alone. |
| S1 High | 066 receipt returned only on success is lost on reader-side cancellation; inherited readFile barriers become stale | ACCEPT. Reader owns validated receipt through descriptor close and cancellation rejection, guarded cleanup for accepted identity, untouched policy-rejected/replaced paths. Add inherited fault helper/cleanup tests to066 and retarget actual handle.read barrier. |
| S2 High | New066 overflow error lacks provider-class consumer mapping | ACCEPT. Add providerMap.ts and direct/normalized envelope tests; map to existing INTERNAL_STATE_ERROR alongside Agy artifact failures. Do not whitelist the emitted code as a lexical exception. |
| S3 High | Future066 requires Windows/macOS exact-tip proof and hosted-heavy execution but has no runnable delivery mechanism | ACCEPT. Define dedicated dispatch-only exact-SHA artifact workflow, platform-light runner and explicit inline child-marker/heavy selector chain. This is066 ownership, not an early WP11/WP12 rewrite. |
| G1 minor | Agy real route cap guard has no explicit worker owner | ACCEPT. Main node-route test: P+A+B allowed; P+A+B+C400 AGY_REF_TOO_MANY, operation/process0. Native seam alone does not prove admission. |
| G2 minor | 060 focused command omits two newly planned suites and existing mask boundary tests | ACCEPT. Add Gemini transport, Agy cleanup and provider-surface-boundary files explicitly. |

Cross-finding synthesis: L1 strengthens the final operation barrier; L2 must not
claim an earlier redundant guard is independently necessary. S1 carries the same
post-read cancellation semantics across the later file-reader extraction, without
moving066 implementation into WP06. S3 supplies standalone066 platform evidence;
it does not replace eventual broader WP11/12 installer/CI coverage. No reviewer
finding is rebutted or waived. Repair docs first, then reuse all three auditors
with this synthesis and the exact diff; proceed to B only after closure.
