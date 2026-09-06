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
