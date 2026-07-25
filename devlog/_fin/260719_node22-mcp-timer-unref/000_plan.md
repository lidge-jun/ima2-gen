# 000 — node22-mcp-timer-unref: Plan

## Observed failure

CI run 29671698258 (first matrix run of the v3 lane): 6 subtests in
`tests/mcp-connection-manager.test.ts` fail on Node 22 (ubuntu + windows)
with "Promise resolution is still pending but the event loop has already
resolved" (cancelledByParent). Reproduced locally with
`~/.nvm/versions/node/v22.22.3/bin/node --test` at HEAD~4 (9954d36,
pre-dating the 260718 mcp hardening) — same 6 failures. Node 24 passes
everywhere.

## Root cause

`lib/mcp/connectionManager.ts` calls `timer.unref?.()` on two timers:

- line ~183: reconnect timer (`reconnectDelayMs ?? 250`)
- line ~399: restore-timeout timer (`restoreTimeoutMs ?? 15_000`)

Tests await promises that only resolve via these timers. On Node 22 the
test runner does not keep the event loop alive while a test promise is
pending, so the loop "resolves" and the pending test is cancelled. Node
24's runner keeps the loop alive, which is why it passes there.

Both timers are already lifecycle-managed: `shutdown()` clears
`reconnectTimers` (clearTimeout) and aborts `restoreControllers`; the
restore timer is also `clearTimeout`'d on its success path (line ~407).
The `unref` is redundant hygiene — removing it cannot leak past shutdown.

## Objective

Remove both `timer.unref?.()` calls so the connection-manager contract
holds on Node 22 and Node 24 alike.

## Loop-spec

- Loop archetype: verifier-defined (spec-satisfaction repair).
- Write scope: `lib/mcp/connectionManager.ts` (2 lines), plan docs.
- Out-of-scope: Windows CLI live-server failures (separate work-phase),
  pushing (user approval required).
- Budget: one work-phase, offline verification only (local node 22 + 24).

## Work-phase map

| WP | Doc | Slice |
|----|-----|-------|
| 1 | 010_phase1.md | remove 2 unref calls, verify node22+node24 |

## Accept criteria

- C1: `node22 --test tests/mcp-connection-manager.test.ts` -> 25/25 pass.
- C2: `node24 --test tests/mcp-connection-manager.test.ts` -> 25/25 pass.
- C3: full `npm test` on node24 stays green; `npm run typecheck` clean.
