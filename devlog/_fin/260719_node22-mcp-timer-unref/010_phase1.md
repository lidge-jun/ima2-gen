# 010 — Phase 1: drop redundant timer.unref in connectionManager

## MODIFY / NEW / DELETE map

### MODIFY `lib/mcp/connectionManager.ts` (2 deletions)

1. In `markOffline` (~line 183): delete `timer.unref?.();` after the
   reconnect `setTimeout`. Timer stays tracked in `reconnectTimers` and is
   cleared in `shutdown()`.
2. In `restoreSession` (~line 399): delete `timer.unref?.();` after the
   restore-timeout `setTimeout`. Timer is `clearTimeout`'d on success
   (~line 407) and its controller is aborted in `shutdown()`.

No other changes. No test changes — the tests are the correct contract.

## TESTS

Existing file is the verifier: `tests/mcp-connection-manager.test.ts`
(25 subtests) under both runtimes. No new tests.

## Verification (C)

- `~/.nvm/versions/node/v22.22.3/bin/node --test tests/mcp-connection-manager.test.ts` — 25 pass.
- `node --test tests/mcp-connection-manager.test.ts` (v24) — 25 pass.
- `npm run typecheck` — 0 errors.
- `npm test` — full suite green.
