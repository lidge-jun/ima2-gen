# WP06m A — round1 synthesis

At6eec9c51: stream lane PASS; fixture lane GO-WITH-FIXES3blockers; caller lane
FAIL3. All are source/plan audits, no future execution claim. No B permission yet.

| ID | Finding | Decision / bounded correction |
| --- | --- | --- |
| F1 | FFmpeg -y can follow an existing output-leaf link despite owned parent | ACCEPT: require absent output or owned regular nonlink target; reject input/output identity alias and concurrent canonical output writers. Tiny validation tests use0native delegation. |
| F2 | Registration after ordinary listen does not provide protected loopback bind | ACCEPT: owned bind helper enrolls close/error ownership before listen, wraps synchronous listenOwnedLoopback, awaits readiness with cleanup. |
| F3 | Child close/tracked image writes miss detached video-thumbnail cleanup | ACCEPT: wrap actual videoThumb.generateVideoThumbnail before SUT imports, preserve original Promise and track through cleanup; only exact approved codec-failure receipts explain ordinary rejection. Unexpected failures remain fatal. |
| C1 | Existing setup-failure injection targets removed mock.method path | ACCEPT: main retargets a one-shot exact descriptor-read failure; retains restoration assertions and closes any unexpected successful isolation. |
| C2 | Last-frame IIFE lacks observable whole-work Promise; empty inflight is not completion | ACCEPT with narrow production-scope amendment: move its unchanged body to an internal Promise-returning operation; retain route void-call semantics. A test-only wrapper observes full actual work. No fake generator/persistence or runtime test flag. |
| C3 | Unified fixture lacks Agent pinned-image capability | Resolve by retained ownership: Agent keeps existing isolateExecution/imageTransport/owned-app fixture and uses only the standalone stream spy. It must not nest openVideoFixture; all image transport/count assertions stay. |

Whole-operation/thumbnail promises are independent of inflight bookkeeping and
child close. finishCase stops new test admission but accepts already-owned cleanup.
Unsettled timeout retains guards; settled verification failures clean up then fail.
F1 protects fixture writes only, not production artifact policy. C2's mechanical
business-operation extraction is main-approved for this WP, with no request fields
or test-only product API. Same reviewers recheck before B. No066 work or blocked
auxiliary probe is added.

## Round2 closure

At65cca6ef plus the sole IIFE anchor correction, all three same auditors PASS.
Stream contract unchanged; fixture F1–F3 and caller C1–C3 closed. Caller reviewer
hit a transient Astra capacity error, then completed the same-model retry; no
different model or fabricated verdict was used. This is plan approval only.
IIFE324–382/body325–381 excludes the following native-extension route. Main now
owns the B decision and later source-equivalence/fixture/runtime evidence.
