# WP12 C — remaining concrete repairs before the next candidate

H1–H4 same-reviewer source/test closure PASS, blocking_issues=[] after main removed
the unnecessary new node-ID character allowlist. Format validation and full
media/sidecar path checks remain; legacy in-bound `legacy id.v1` saves/reads work.
Main reran the isolated node owner:30inner route tests plus9direct metadata/save
cases passed (outer wrapper count is separate, not an extra30tests). Invalid
format reaches neither provider nor mkdir/embed/write. H2 hosted runtime pending.

H3/H4 tests7pass and existing history source contracts5pass. New pure fixture
config/DB/trash mocks precede production import; rejected mutations never call real
OS trash. No source test can replace the pending final exact-SHA runtime gate.

## Windows history teardown failure — separate from MCP tracking

Atd20b0cb2, CI34026768048 Windows24/npm12 job101469017471 failed only the history
suite after-hook: ENOTEMPTY removing owned ima2-b9-home-5ikH1x at
tests/history-tombstone.test.ts:97. Test assertions passed. This is not the historical
MCP timeout and is not cleared by the previous cc304e80 Windows success.

Source inspection: this fixture spawns a real server with OAuth proxy disabled,
but leaves Grok autostart at its defaulttrue (config.ts; server.ts515). The launcher
starts progrok through a child shell on Windows. The fixture kills only the direct
server and waits for its exit, which is not proof that descendants stopped. Exact
late writer was not logged, so do not claim an observed process attribution.

Minimal scope correction: add existing IMA2_NO_GROK_PROXY=1 only to this fixture's
owned child env. History assertions need no provider process; removing unrelated
autostart preserves every assertion and improves the intended isolation boundary.
No timeout/retry increase, cleanup suppression, global kill, account access,
production launcher change or reusable fixture framework. Runtime verification is
hosted-only; no local real server launched. If the same error persists, inspect
the surviving owned writer instead of adding more allowances or blind retries.
