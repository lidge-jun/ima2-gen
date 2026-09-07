# WP04 C — verifier activation and restored baseline

Code/test checkpoint27693229. All five B workers were finished/closed before
main ran temporary source mutations. Only named fixture tests ran; all network
calls were intercepted by the owned harness and no user credentials were loaded.

## Callback removal

Temporary exact hunk: executeOpenaiMultimode supplied undefined instead of
progress.onFinalImage. Rebuilt server outputs, then ran only
`O04-6 held sequence` through the sanitized native-mock child.

Observed RED exit1: first callback never arrived, the named2s bounded callback
gate failed. The operation's other work settled; test finally released owned
gates/controller. Restored exact hunk, rebuilt and reran same selected test:
GREEN exit0, one test passed. No assertion or timeout changed.

## API fallback permission removal

Temporary exact hunks: classic fallback opt-in=true, plus removed the fallback
helper's separate provider=api early return. Rebuilt server outputs and ran only
`O04-3 API empty one call` in the same sanitized mechanism.

Observed RED exit1 at the explicit call-count oracle:4actual vs1expected.
This proves real extra transport activation, not merely a flag mutation that the
second guard would still reject. Restored BOTH hunks, rebuilt and reran:
GREEN exit0, one test passed. No other code or test semantics changed.

## Restoration proof and scope

`git diff -- lib/providers/adapters/openaiExecution.ts lib/responsesFallback.ts`
was empty after each restoration. Worktree contained only the user's untracked
scripts/recording at that checkpoint. No mutation was committed or pushed.
responsesFallback.ts remains byte-identical to its baseline in the delivered diff.
RED command output lives under session evidence wp04/callback-red.txt and
wp04/api-fallback-red.txt. Full current-head regression/CI/QA remains pending;
these two targeted negative checks alone are not a completion claim.
