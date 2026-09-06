# WP06m B — checkpoint evidence

Main's actual shared-isolation sentinel regression failed against the old guard:
exec and execFile each reached their harmless custom async function once while
the direct denied function was not reached. No native process ran. After fresh
descriptor-based deny replacements, both direct/promisified paths reject, both
sentinel counts are0, and exact restoration checks pass.

The setup-failure test now injects a one-shot descriptor read at spawnSync and
closes any unexpected successful isolation. Existing25 harness cases pass,
including failure restoration, persistent violations and held write/cleanup.
These are focused B checks, not final-head CI or video acceptance.

Eight disjoint worker lanes are implementing the audited plan. Runtime checks
requiring new emitted modules wait for main graph-ready. Source/codec/stream/
caller completion and any integration findings will be recorded before C.

## Integration observations

Main source typecheck/server emit passed after verifying the extracted IIFE's
three top-level statements match the original printed AST exactly (full try/catch
included). First tests typecheck found Headers iteration incompatibility, a union
Promise inference and now-unused server bindings; owning workers repaired these
without changing assertions or compiler settings. Semantic recheck passed.
Workers report reader72, generator37, Agent15+envelope15, last-frame17 passed;
real FFmpeg8.0.1 tiny create/frame/thumbnail and validation-only negatives passed.
These remain scoped B results, not final C/exact-head CI evidence.

The real oversized-header route case exposed an additional shared-fixture lifetime
gap: native fetch resolves at headers, but Undici may reconnect its owned transport
while a canceled body finishes. The header-scoped lease expired too soon, producing
Forbidden fixture network call:connect from Socket.onHttpSocketClose. Response
and request Connection:close trials failed and were fully reverted.

Main owns the bounded extra writes to _executionNetworkIsolation.ts and
execution-network-isolation.test.ts. One lease now belongs to an exact actual live
owned HTTP Server until its close or fixture restore, not header settlement. No
other destination or automatic DUT handler authority is added. New test proves a
bound owned continuation survives headers, ordinary same-port DUT calls remain
denied, and closed-server continuation is denied. Both previously failing edit/
native-extension oversized-header cases passed; the six network-isolation cases
also passed. Existing raw guards and permanent violations remain in force.

Main independent ten-file replay passed214 substantive tests (the outer runner
reports10 isolated wrappers): reader72, generator37, Agent15, envelope15,
network6, process2, harness25, last-frame17, extended13, generate12. Optional local
FFmpeg cases ran without skips, including real last-frame extraction, frame/analyze
and continuation; the native tool was8.0.1 with owned tiny inputs. Source/tests
typechecks and server/CLI/UI builds all passed. This is pre-C worktree proof.
Final source mutations, current-head receipt, independent C review and CI remain.
