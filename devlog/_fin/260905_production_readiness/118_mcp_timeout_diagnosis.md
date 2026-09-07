# WP11 C — remaining Windows22 MCP timeout

Candidate a574e4f8 full CI34016128661 passed Linux22/24, Windows24 (including
packed install), and UI E2E. Windows22 failed one case: cli-model-resolver.test.ts
"opens SSE before POST, reports progress, and resolves done" at20026ms with
MCP_JOB_TIMEOUT. Previous41 failures are absent. No merge/release acceptance yet.

This is unresolved, not declared environmental. No timeout increase, retry-as-fix,
skip, assertion weakening or speculative production change. The existing diagnostic
workflow is reduced to this one file on pinned Node22; obsolete watcher/environment
instrumentation, UI dependency install and server/CLI builds are removed from that
diagnostic only. Full CI is unchanged. Failure-only fixture tracing records owned
loopback requests/emits and received phases, with no user input or credentials.

H1: initial fetch/header/POST handshake stalls. Falsifier: POST and terminal emit
appear promptly before the deadline. H2: terminal read/iterator cleanup stalls.
Falsifier: no progress/terminal frame reaches the client, or failure precedes POST.
H3: fixture sharing/scheduling interferes. Falsifier: recorded event order shows
no other job/close before terminal handling. CI test durations sum sequentially,
so test concurrency is not presently supported as the explanation.

SSH diagnosis on desktop-c795oh4 uses only owned C:/Temp/ima2-wp11-01a06e88-ViFXzI.
Portable Node22.23.0 came from the official nodejs.org distribution; transfer
SHA256 matched and extracted node.exe has Valid OpenJS Foundation Authenticode.
No official SHASUMS-file verification is claimed (that fetch was blocked, not
retried). No PATH/global install changes or personal PowerShell policy changes.
Minimum native HTTP/SSE probe passed40 sequential jobs. Bundled original18-case
test then passed6/6 fresh processes with original timeouts/assertions, inherited
environment restricted to OS/path/temp/locale keys. This is diagnostic rate data,
not a fix or replacement for same-candidate CI. Module loading differs (bundle
plus original TS transpilation) from CI's tsx entry and is explicitly not identical.

At the four-hour reassessment the implementation is complete and only this
isolated candidate failure remains. Continue bounded diagnosis within the existing
goal bound; do not add a new test platform or start WP12 implementation early.

Diagnostic34017574526 atfeece594 passed allfour MCP cases in180ms; its unrelated
loadCliDefaults failed because the reduced setup omitted emitted config.js.
Restore only build:server, which owns that direct dependency. Do not patch the
test or pretend this setup failure reproduces the original timeout. Next bounded
measurement is30 fresh file processes,3 at a time on the hosted runner to observe
contention-sensitive frequency. Stop the batches at the first failure and retain
its full trace. Passing measurements are not accepted as remediation. No timeout
change, retries inside a test, new harness file or whole-CI rerun for diagnosis.

The30-process hosted measurement34017741917 atecb12032 passed30/30 (each18 cases).
SSH contention measurements separately failed1/21 and1/12 processes; the second
captured listening=true, port6665, fetch cause="bad port", zero server requests,
and immediate failures in allfour MCP cases. That is NOT the20s CI signature.
Record this fixture-port finding for integrated follow-up; do not weaken fetch's
port protection, change the workstation port range, or grow WP11 to repair it.

Next minimal CI context is one Windows22 root-suite job, where the original
failure occurred. Restore its actual build prerequisites and remove the temporary
30-process loop. No Linux/UI-e2e/package matrix is run during this diagnosis.
The first-case trace additionally observes native fetch start/headers/error cause
without replacing transport/body or changing assertions/timeouts. Test-context
mock restoration prevents cross-case mutation. Passing this context remains rate
data until cause is known; no blind green-on-retry acceptance.

External lead reviewed2026-09-06: nodejs/undici issue5524 describes HTTP/2-only
SSE/POST starvation and explicitly excludes HTTP/1.1. Our node:http fixture is
HTTP/1.1, so it does not justify an Agent/dependency/transport change here.
Source: https://github.com/nodejs/undici/issues/5524 (original issue opened/read;
agbrowse returned repo metadata instead of issue content, so that was not proof).
