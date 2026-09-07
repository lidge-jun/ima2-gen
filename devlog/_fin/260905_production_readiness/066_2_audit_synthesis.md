# WP06s A — round 1 synthesis

Reviewed 370cc0b8a666ae1edd43dc57cc46c39bfe37fe51 by independent Astra/high
Godel2 (01a071ce-ed89-75e0-83fd-50be220ec49e). Actual verdict: FAIL, blockers1/2.
No implementation started and no failed verdict spent as approval.

## 1. Windows process expectations — accept High

Root cause: new cross-platform gate selected the complete existing Agy process
file, whose cancellation, timeout and watchdog tests assume a child SIGTERM
handler can run. Node Windows termination does not provide that POSIX behavior.
The Node executable bridge preserves invocation, not signal semantics.
Source: tests/agy-execution-process.test.ts:198,231,352 and fixture:112.
Official source opened by reviewer: https://nodejs.org/api/child_process.html#subprocesskillsignal.
No Windows execution has occurred yet.

Fold-back: operation worker owns platform-specific expectations. POSIX keeps
TERM receipt/grace/SIGKILL assertions. Windows executes abrupt-close cancellation
and first-reason timeout cases, retaining refs through close, rejecting once and
draining listeners/timers/work. Windows watchdog suppresses both DUT signals but
not the fixture's captured native kill. Named replacement cases must pass in its
dedicated hosted row. No production process redesign or skip-based acceptance.

## 2. Test-only export / source-emitted graph — accept Medium

Root cause: proposed tiny-cap helper export added a test-only production API;
the obvious config.js mock would not cover TSX's actual source dependency graph.
Reviewer executed two import-only isolated checks on Node24.17, exit0: native
emitted config mock links, while the TypeScript consumer requires config.ts.
No provider or child launch occurred in those checks. Future reader unimplemented.

Fold-back: only readAgyArtifact and cleanupAgyArtifact are exported. Tests install
a frozen tiny AGY_ARTIFACT_POLICY before source consumer import at config.ts;
emitted tests use config.js and a plain-JS loader, following the existing Gemini
pattern. Supply required exports without reading real user config. Default 50MiB
cases use an unmocked policy in a fresh isolated process. Different policies and
module graphs never share a cached reader. No test-only production flag/API.

## Conflicts and closure request

The amendments are disjoint: operation worker owns Windows lifecycle assertions;
artifact-test worker owns graph/policy fixtures. CI worker requires both sets of
named evidence at the intended SHA/platform. Neither changes runtime artifact
policy or weakens c-18. Main also requires short-read buffer coalescing so tiny
native reads cannot retain a 64KiB allocation per byte. That clarification keeps
the planned allocation bound honest; it adds no new public contract.

Request the SAME auditor to review the amended 066/066_1 and return a closure
verdict. B remains prohibited until genuine pass/accepted near-pass.
