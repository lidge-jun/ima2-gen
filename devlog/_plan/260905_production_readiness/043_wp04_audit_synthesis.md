# WP04 A — source-grounded amendment synthesis

Baseline d039b587, source unchanged. No WP04 implementation yet.

## Production audit

Sagan01a0709f-dce6-7893-af36-a7ea8e827b16 read040–042 and production consumers.
No-emit probe over349serverroots:0diagnostics for same-object guards, generic
surface inference, legacy exclusions and native refs/results/callbacks.
Verdict GO-WITH-FIXES(blockers=1).

Accepted Medium:042 incorrectly grouped user cancel with internal timeout after
multimode partial persistence. Actual cancel branch emits499 error and returns;
only subsequent internal timeout branch emits partial done.042 now separates
the two fixtures and preserves previously-written image/sidecar in both cases.
No production policy change is authorized.

Accepted Low: JSON has no callback/SSE dedupe behavior; OAuth fallback has no
callbacks but DOES request stream:true and retain SSE parsing/dedupe.040 wording
now states each separately. Original P finding was overgrouped, not a request
to change responsesFallback.

## Test audit and accepted corrections

Main already aligned O04-3's retryable fixture with an HTTP503 Response, not a
thrown fixture exception (which strict WP03 violation ledger intentionally rejects).
Gauss01a0709f-dd82-78c0-977e-f9111c911647 identified direct-operation promises
outside the real route-handler tracker, plus held callbacks that abort alone
cannot release. Accepted:042 adds main-owned trackWork generic to the test
harness, preserving original promise identity/rejection and observing settlement
only. Direct tests must register immediately and finally release callback/stream
gates, abort their controller, then boundedly drain Promise.allSettled before
config restore or fixture exit. Existing timeout retention/strict violation
ledger stay unchanged. Three focused helper regressions are explicitly mapped.

Final test-lane verdict GO-WITH-FIXES(blockers=1), folded concretely above.
Production-lane closure PASS after cancel/dedupe corrections. Main judges A
near-pass with every reported blocker folded and no unresolved scope question;
runtime efficacy remains C-gated. No production changes happened during A.
