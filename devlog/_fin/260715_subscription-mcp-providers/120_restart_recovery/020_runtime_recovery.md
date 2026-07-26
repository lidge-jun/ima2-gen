# Phase 020 — startup and transport recovery integration

Consumes: completed Phase 010
Work phase: WP2

## Scope

Use the verified credential/generation contract to restore same-binding providers after listen, map terminal transport events truthfully, provide one bounded reconnect, and close MCP resources on shutdown. Do not replay billed or mutating tools.

## File change map

### MODIFY `lib/mcp/connectionManager.ts`

- Add `restoreStoredConnections()` that inspects only enabled providers and starts at most two same-binding usable restores concurrently.
- Use one attempt per provider and a 15-second initialization bound; missing/corrupt/pending-only records remain disconnected or explicit auth-required according to Phase 010 inspection.
- Binding mismatch becomes `auth_required` with a safe reason and no authorization URL during passive startup; the disk record remains until user-initiated Connect.
- Add current-generation client `onerror`/`onclose` handlers before SDK connect.
- `onerror`: keep connection state, set a safe degraded diagnostic, and let SDK retries run.
- Unexpected current-generation `onclose`: set `offline`, then schedule at most one generation-scoped reconnect. Expected close during refresh/disconnect/shutdown is suppressed.
- Wrap `listTools` and `callTool` failures so post-connect Unauthorized or terminal connection errors cannot leave state `connected`; never auto-replay arbitrary `callTool`.
- Add `shutdown()` that rejects new work, invalidates generations, clears timers/pending auth, best-effort terminates live sessions within two seconds, closes clients/candidates exactly once, and retains token records.
- Add internal `connectionIdentity(provider): number | null`; it returns the current generation only while connected and is not included in public JSON.
- Change snapshot attachment to `attachSnapshotDiff(provider, connectionIdentity, diff)` and ignore the write unless the identity still matches the current connected generation.

### MODIFY `routes/mcpConnections.ts`

- Replace route-owned `reset()+connect()` with atomic `manager.refresh()`.
- Centralize state→HTTP mapping: connected 200; auth_required 202; error/offline non-2xx with `ok:false` and a safe code.
- Callback renders completion HTML only for connected. Repeated auth_required/error renders a truthful non-success page/status.
- Unknown/disabled provider status returns canonical 404/409 rather than a phantom disconnected session.
- Snapshot ingest captures connection identity and discards stale completion.

### MODIFY `server.ts`

- After `serverActualPort` and `serverUrl` are assigned, start non-blocking `restoreStoredConnections()`; do not attempt provider network before listen.
- Log provider ID plus terminal state/code only. Never log authorization URL, token presence, account data, or upstream body.
- Await `mcpConnectionManager.shutdown()` in the existing shutdown owner before database close; preserve unrelated sidecar behavior.

### NO CHANGE `routes/models.ts`

- Preserve the existing lane contract: every MCP runtime state other than `connected` intentionally maps to lane-level `disconnected`, while the specific safe reason remains in `reason`.
- Do not widen `LaneStatus`; the connection API remains the detailed state source.
- Add behavior coverage in `tests/models-endpoint-contract.test.ts` so `offline`, `auth_required`, and `error` all remain non-ready with their safe reason and never trigger a connected-only catalog call.

### NO CHANGE `routes/mcpMedia.ts`, `lib/mcp/executeMediaJob.ts`, `lib/mcp/adapters/runwayUpload.ts`

- These callers keep their current preflight and error propagation contracts.
- Manager owns the status correction after Unauthorized/terminal failure; callers must not retry because generation, media actions, polling, upload initialization, and upload completion may be billed or non-idempotent.
- Extend existing integration tests to prove a manager failure produces one terminal error path and each tool call is attempted once.

### MODIFY `tests/mcp-connection-manager.test.ts`

Add activation cases for:

- fresh manager + same-binding token record restores without browser redirect;
- disabled/missing/corrupt/pending-only/mismatch records do not call network;
- restore uses a mutable `getOrigin` value set after fallback port selection;
- restore concurrency and timeout bounds;
- transient `onerror` leaves connected state and sets only safe degraded detail;
- stale callback events are ignored;
- unexpected current close becomes offline and causes exactly one reconnect;
- expected refresh/disconnect/shutdown close does not reconnect;
- post-connect Unauthorized corrects state;
- shutdown closes live and pending resources exactly once while keeping tokens.

### MODIFY `tests/mcp-connection-routes.test.ts`

- Extend fake manager with `refresh`, connection identity, and truthful terminal states.
- Assert connect/refresh/callback HTTP mapping for connected, auth_required, error, offline, unknown, and disabled providers.
- Assert every response and rendered page stays secret-free.
- Assert stale snapshot ingest cannot annotate a newer connection.

### MODIFY `tests/models-endpoint-contract.test.ts`

- Drive `offline`, `auth_required`, and `error` manager statuses through the real `/api/models` route.
- Assert lane status remains `disconnected`, safe reason is preserved, and connected-only dynamic catalog access is not attempted.

### MODIFY `tests/mcp-generation-integration.test.ts`

- Inject a manager that fails the first submit with Unauthorized/terminal connection error.
- Assert one manager call, one error terminal event, no retry, and no saved result.

### MODIFY `tests/mcp-media-action.test.ts`

- Inject failure in native upload/action execution and assert no route-level retry or fallback-to-billed-tool behavior.
- Keep local ffmpeg fallback behavior unchanged.

### MODIFY `tests/runtime-ports.test.ts`

- Add only a narrow callback-origin/fallback sequencing assertion if manager tests cannot prove post-listen origin activation without duplicating server bootstrap.

## Conditional-path activation

| Path | Trigger | Observable proof |
|---|---|---|
| startup restore | New manager with same-binding stored token after actual port set | one connect, connected/auth_required terminal state, no popup side effect |
| passive mismatch | Actual port differs from record origin | zero provider request, record preserved, auth_required reason |
| SDK transient error | Invoke current client `onerror` | state remains connected; degraded detail contains no raw error |
| terminal close | Invoke current client `onclose` unexpectedly | offline then one reconnect attempt |
| expected close | Refresh/disconnect/shutdown closes current client | no reconnect timer |
| post-connect 401 | Fake call throws UnauthorizedError | state no longer connected; user action can reconnect |
| shutdown race | Shutdown while connect/auth pending | shutdown wins, candidates close, no token resurrection |
| model-lane consumer | `/api/models` sees offline/auth_required/error | lane stays disconnected with safe reason; no connected catalog call |
| generation consumer | first submit call fails terminally | exactly one tool call and one error event; no replay/save |
| action/upload consumer | init/upload/action call fails | exactly one failing tool call path; no automatic retry or billed fallback |

## A-gate SDK 1.29 corrections (authoritative)

These corrections override any broader wording above:

- Bind runtime handlers and expected-close suppression to an exact published client/transport epoch, not only provider generation. Initialization candidates, callback transports, and replaced sessions cannot publish events.
- SDK 1.29 retry exhaustion may emit terminal `onerror` without `onclose`; initialization failure may internally close. Tests must distinguish transient current-epoch error, terminal/retry-exhausted error, terminal close, and expected initialization/callback/refresh/disconnect/shutdown close.
- Every published or reconnected session receives a new `{ generation, epoch }` opaque identity. `listTools` toolCount and snapshot attachment require the captured identity to remain exact-current.
- One reconnect budget belongs to the exact epoch/transport. Consume it before one unref'd bounded-delay attempt; failed reconnect never recursively schedules. Explicit later Connect/Refresh starts a new epoch/budget.
- Restore timeout is cancellation, not `Promise.race`: pass SDK timeout/max-total-timeout/AbortSignal where supported, invalidate generation, close transport, await settlement, then release one of two semaphore slots. User lifecycle intent and shutdown always win late restore completion.
- Interactive mismatch keeps the old file byte-for-byte through registration and redirect. Stage new client registration in memory and atomically replace binding/client/tokens only after successful token exchange.
- Complete final state mapping after snapshot ingest and a fresh `status()` read: connected 200/ok, auth_required 202, connecting 202, disconnected 409, offline 503, error 502; non-connected terminal responses use `ok:false`. Callback HTML follows the same mapping and only connected says success.
- Start `server.close()` and `mcpConnectionManager.shutdown()` together, await both within the existing global three-second grace, give MCP two seconds internally, then close DB. Add bootstrap proof with active MCP work.
- No billed replay means one ima2 host-level manager invocation. SDK's documented bounded 401/403 authentication resend may occur inside that call; transport/fetch tests distinguish the two layers.
- Add activation tests for terminal `onerror` without close, initialization close suppression, stale epoch toolCount/snapshot rejection, restore versus user/shutdown races, both mismatch replacement stages, complete HTTP mapping, and active-request shutdown.
- Pinned SDK 1.29 terminal-error rule is an exact version-owned allowlist: only `error.message.startsWith("Maximum reconnection attempts (")` is retry-exhausted terminal; other transport `onerror` events remain transient until `onclose` or a manager operation proves terminal. A contract test pins this SDK string so an upgrade fails visibly instead of silently changing state semantics.
- Split epoch/event/reconnect primitives into new `lib/mcp/connectionRuntime.ts` and shutdown grace coordination into new `lib/mcp/shutdown.ts`; keep `connectionManager.ts` below 500 lines. Add both modules to scoped diff checks.
- Add `lib/mcp/oauthProvider.ts` and `tests/mcp-token-store.test.ts` to WP2 write/verification scope for staged-registration and token-exchange-only mismatch replacement.
- Export a small `shutdownServerAndMcp()` coordinator from `lib/mcp/shutdown.ts`; `server.ts` calls it, and `tests/runtime-ports.test.ts` proves server accept-stop and MCP close start concurrently and both settle before DB-close continuation.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
node --test --import tsx tests/mcp-token-store.test.ts tests/mcp-connection-manager.test.ts tests/mcp-connection-routes.test.ts tests/models-endpoint-contract.test.ts tests/mcp-generation-integration.test.ts tests/mcp-media-action.test.ts tests/runtime-ports.test.ts tests/runtime-context-normalize.test.ts
npm run test:inventory
git diff --check -- lib/mcp/connectionManager.ts lib/mcp/connectionRuntime.ts lib/mcp/shutdown.ts lib/mcp/oauthProvider.ts routes/mcpConnections.ts server.ts tests/mcp-token-store.test.ts tests/mcp-connection-manager.test.ts tests/mcp-connection-routes.test.ts tests/models-endpoint-contract.test.ts tests/mcp-generation-integration.test.ts tests/mcp-media-action.test.ts tests/runtime-ports.test.ts
```

## Exit criteria

- Restart, mismatch, error/close, reconnect, response, and shutdown activation paths pass.
- No UI or billed provider call is needed.
- No new top-level test file or inventory rewrite is introduced.
- Only WP2 paths are committed locally; no push.
