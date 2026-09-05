# WP06 P — current-tree revalidation and bounded lifetime correction

Baseline54543ee0, after WP05 D at2026-09-05T10:00:15Z; branch
codex/prod-wp06-google. This is a plan amendment, not implemented acceptance.
060 remains the family/reference contract; this companion overrides its relocation-
only wording for the three explicitly named Agy lifetime defects below.

## Current executed evidence

Main `wp06/baseline-references.mjs` ran actual Node registrations with an isolated
Gemini HTTP response and an Agy operation spy (no actual process). Eight cases:

| Lane/mode | Root expected→observed | Child expected→observed |
| --- | --- | --- |
| Agy parent-only | []→[] | [P]→[P] |
| Agy parent-plus-refs | [A,B]→[] | [P,A,B]→[P] |
| Gemini parent-only | []→[A,B] | [P]→[P,A,B] |
| Gemini parent-plus-refs | [A,B]→[A,B] | [P,A,B]→[P,A,B] |

Distinct red/green/blue pixels identify P/A/B independently. All8 returned200,
refsCount followed selected mode while the four mismatching native inputs did not.
All fixture storage and listeners closed. This is input-mapping proof, not Agy
process assurance. The current outer guard counts parent + context-filtered refs
at nodeGeneration144–159; both providers' reference cap is3. Gemini over-cap still
uses the historical GROK_REF_TOO_MANY code; preserve that vocabulary here.

Main `wp06/staging-baseline.mjs` loaded the actual Agy operation with exact owned
filesystem hooks and an in-memory child substitute. Second staged-reference write
EIO left one directory/ref_0.png, with spawn0. Harness explicitly removed the leak.
A deferred artifact read followed by abort returned successful native bytes after
abort; this does not prove route persistence, because callers have separate guards.
Both defects reproduced, exit0, no native/provider call; evidence JSON is retained.

## Accepted lifetime corrections (within WP06)

Owners remain the newly planned agyProcess.ts and adapters/agyOperations.ts.
No shell launch, native process-tree manager, new config API or auth change.

1. `spawnAgy` checks pre-abort before resolve/spawn. Once cancellation or the
   existing360000ms deadline wins, pin that reason: cancel499 GENERATION_CANCELED,
   timeout504 AGY_TIMEOUT. Request SIGTERM; after1000ms grace, if no close, request
   SIGKILL. Settle after observing child close, not immediately after sending TERM.
   A single finish helper clears timeout/grace timers and removes abort listeners.
   Error/close races settle once; startup error keeps AGY_PROCESS_ERROR and the
   existing ENOENT hint. Preserve argv/stdin/environment/output collection semantics.
   The bound applies to the direct owned child; descendant-tree termination is not
   claimed. If the OS does not deliver close after KILL, retain the pending state
   rather than claim teardown; the enclosing fixture watchdog must fail/reap it.
2. `writeRefsToTempFiles` owns cleanup from mkdir onward. Wrap its write loop in
   try/catch, remove its exact generated directory on failure, and rethrow the
   original error. After acquiring its cleanup handle, place prompt/logging under
   the operation's try/finally. Cleanup remains best-effort and never masks the
   primary failure; no broad temp-directory sweep.
3. Check signal before staging, after process settlement, before and after artifact
   read, and before return. A late read abort must not return a successful result.
   If a validated known artifact was successfully read, run the existing exact-path
   cleanup before throwing499. Do not search or delete unknown abort-time artifacts.
   Store the successful result instead of returning inside try: after awaited
   reference cleanup finishes, check cancellation once more and return synchronously
   with no subsequent await. A primary exception must keep its identity/status after
   cleanup; do not throw cancellation unconditionally inside finally.

MODIFY config.ts: export a readonly named `AGY_PROCESS_POLICY` object containing
timeoutMs=360000, terminateGraceMs=1000 and maxOutputBytes=1048576. agyProcess imports
this central policy, preserving the inherited deadline/output values and adding
only the grace interval. No new persisted/user config key or environment override.
This follows the repository's centralized-config convention without scattering
new caller literals or making provider code own configurable defaults.
Keep Gemini token/fetch/error behavior unchanged in this extraction: actual
TimeoutError maps502 GEMINI_API_NETWORK_FAILED; AbortError with external abort maps
499 GENERATION_CANCELED, otherwise504 GENERATION_TIMEOUT. Token errors occur before
the fetch catch and propagate unchanged. Tests must state these bounded legacy
semantics, not mislabel TimeoutError handling as fixed.

## Mandatory independent activation/ablation

- Pre-aborted Agy: process count0, no staged refs. Cooperative abort: child close
  precedes operation rejection and cleanup. TERM-ignoring owned executable: TERM
  receipt, then KILL, then close, then499; no real Agy. Timer-controlled timeout
  gets504 without a six-minute local wait. A test watchdog always kills only its
  retained native child handle and awaits close if the DUT is mutated to omit KILL.
- Inject EIO only on owned ref_1: first write succeeded, process0, no ref directory
  after rejection. Remove the new catch in a real mutation: the test must fail.
- Hold only the exact known artifact read; observe entry, abort, release, expect499
  with refs removed and known artifact cleanup. The explicit compound mutation
  removes every operation guard after that read (including the final post-cleanup
  guard), so later guards cannot mask the mutation. Claim whole late-cancel
  protection, not independent necessity of one redundant post-read line.
- Independently hold removal of the exact staged-ref directory on a success path,
  abort while cleanup awaits, release, expect499. Remove only the final post-cleanup
  check: this later-window test must fail. Also inject a primary EIO, hold cleanup,
  abort and release: original EIO remains the result, not cancellation. Preserve
  caller no-persistence checks and always release the exact owned-rm barrier.
- Concurrent close/error/abort and already-closed child: one settlement, timers and
  listeners drained. Uncooperative-process proof is distinct from fake cooperative
  event-emitter coverage. No timeout sleeps or leaked fixture processes.

## Test and import revalidation additions

Expand060 manifest: MODIFY provider-execution-node.test.ts, _executionBoundaryProbe.ts,
provider-execution-boundary.test.ts, _executionImportEdges.mjs,
prompt-fidelity.test.ts and gemini-api-wire-contract.test.ts. Retarget old facades to
actual operation owners, update only Google reference expectations; retain Atlas/
MiniMax's separately documented legacy behavior. The parent-only Agy root's
undefined→empty-reference-array is an intentional equivalent-input normalization,
not an excuse to weaken other option/prompt/native-result assertions.

Use separate Google wire and native Agy process fixtures. Shared isolateExecution
must keep all process operations default-denied and clear IMA2_AGY_BIN. A dedicated
Agy harness pins one test-owned executable, child home/config/temp roots and input
control file; no ambient credentials or nonfixture executable fallback. Stage
native module mocks before importing the DUT. Source and emitted module graphs
are tested separately, never accidentally mixed to bypass an import.

C still requires its own exact-head Node22/24 CI, focused local proof, independent
review, mutation restoration, actual route/curl evidence and current UI regression.
No single fixture, baseline green suite or scanner silence proves this entire list.

## Unresolved artifact-containment boundary

Current scanner skips symlink directory recursion, but a matching file symlink is
stat/read-followed; direct RESULT paths use a lexical allowlist. This is not fixed
by the three lifetime changes and is not claimed safe. Its synthetic reproduction
and separate source-grounded containment plan must be registered before WP06 A;
the overall release remains blocked until that corrective outcome is verified.
