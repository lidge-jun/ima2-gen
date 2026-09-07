# WP06 C — verifier integrity repair synthesis

At99b95df0, production lifetime C PASS, semantics no introduced blocker with bounded
SSRF classification pending global triage, fixture verifier FAIL3 reproducible gaps.
No source mutations remain. Do not close C or reuse old-head QA as final evidence.

| ID | Finding/root cause | Accepted repair |
| --- | --- | --- |
| V1 High | Shared isolation guards HTTP/lookup/process but leaves resolve/raw TCP paths; native Gemini fixture inherits this incomplete deny | Add shared test-only network deny with persistent ledger. Preserve the route caller with an exact live owned-server capability scoped by AsyncLocalStorage, not a broad loopback exemption; prove that privilege does not enter DUT handlers. Reuse this guard in native Gemini/Agy by their existing isolation, removing overlapping Agy restores. Sentinel tests prove denied calls never reach original network functions. |
| V2 Medium | Request construction/body normalization occur outside native Gemini violation catch | Move all normalization and wire assertions into the ledger catch, while explicitly installed synthetic responder failures remain outside it. Malformed CONNECT/disturbed body must fail close even when caller catches their errors. |
| V3 Medium | Returned-field extractor walks nested functions and ignores shorthand outer returns | Stop at nested function-like boundaries; include shorthand returned expressions without pretending to resolve aliases. Add nested-function/shorthand counterexamples and preserve actual Google prompt-chain source test. |

Cross-check: V1 cannot break legitimate owned HTTP traffic or let caller context
authorize DUT traffic. Guard restoration must be exact on success and failure;
native Agy's second overlapping restore layer must not reinstall a stale shared
guard. Native process/HTTP traffic stays fixture-owned, no credentials/network
sentinels call external systems. V2 must not flag deliberate native transport
failure responders as unexpected normalization failures. V3 supplements actual
wire tests and does not claim arbitrary alias/dataflow resolution.

Main owns this test-infrastructure repair in C; production unchanged. HTTP worker
has been told to hold final receipt until the new source identity. Same fixture
reviewer rechecks these exact counterexamples after fresh focused verification.

## Implemented repair, awaiting same-reviewer closure

New test-only `_executionNetworkIsolation.ts` supplies shared resolver/TCP/TLS/
HTTP2/UDP/WebSocket guards. Exactly one active fixture owns the ledger; cached
network wrappers consult the current fixture, avoiding stale scopes after restore.
The private HTTP caller accepts an actual live HTTP Server, queries its native
address method, requires127.0.0.1/origin equality and excludes user3333. Async-local
leases expire when the caller settles; server handlers do not inherit them.
Legacy API/Agent fixture clients now pass their actual owned server to this helper;
saved nativeFetch remains only a compatibility identity/reference, not a TCP bypass.
Overlapping Agy guard/restoration code was removed in favor of the shared owner.

Counterexamples now pass: forged server rejected before fetch, two successive
real owned-client scopes succeed while same-port raw handler calls are denied,
11 harmless preinstalled resolver/TCP/TLS/HTTP2/UDP sentinels receive0calls and
fixture close is RED, with exact descriptor restoration. CONNECT and disturbed
Request body failures each independently fail Gemini close. Shared route fetch
normalization also records failures; its explicit regression fails run cleanup.
Nested function, arrow, method and class-method returns are excluded; shorthand
outer returns expose their identifier instead of disappearing from the oracle.

Typecheck tests passed. A25-file expanded regression run and three native32-case
stability rounds passed before the final forged-server/shared-normalization
additions; those additions passed their focused suites (5 network and25 harness
cases). Main will issue a new complete source-bound receipt and exact-head CI.
Production files/config compare unchanged throughout this repair. No kernel-level
sandbox or arbitrary hostile same-process-code isolation is claimed.
