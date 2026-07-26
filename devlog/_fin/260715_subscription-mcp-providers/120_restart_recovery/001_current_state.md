# Current-state evidence

Date: 2026-07-17
Purpose: research record only; implementation diffs live in the decade documents.

## Runtime observation

- The local server restarted on port 3333 and returned both providers as `disconnected`.
- The Runway credential record remained present with mode 0600 and contained both access- and refresh-token fields. No values were printed into this document.
- Higgsfield had no token record and remains a separate catalog/entitlement case.

## Causal chain

1. `routes/mcpConnections.ts:43-50` constructs `McpConnectionManager` while routes are registered.
2. `lib/mcp/connectionManager.ts:44-64` keeps sessions only in memory and creates missing sessions as `disconnected`.
3. `lib/mcp/oauthProvider.ts:29` reads persisted credentials only when `connect()` constructs an OAuth provider.
4. `server.ts:448-459` learns the actual port after listen but never invokes an MCP restore operation.
5. The installed SDK 1.29.0 can send a stored access token and refresh after 401, but that code is unreachable until ima2 calls `connect()`.

## Confirmed secondary defects

- `connectionManager.ts:80-110`: concurrent connects are not coalesced and can commit out of intent order.
- `connectionManager.ts:113-121`: a stale callback can delete a newer session and reconnect after Disconnect.
- `oauthProvider.ts:29-36`: each provider closure owns a whole-record snapshot; atomic rename prevents torn JSON, not stale last-writer-wins writes.
- `oauthProvider.ts:30-34`: callback-origin mismatch eagerly deletes client registration, tokens, and verifier before token usability is tested.
- `oauthProvider.ts:6-18`: SDK scoped `invalidateCredentials` is absent, so invalid grant/client retries can reuse stale material.
- `connectionManager.ts:155-177`: post-connect auth/transport errors propagate without correcting `connected` state.
- `server.ts:432-445`: shutdown does not close MCP clients or pending OAuth transports.
- `routes/mcpConnections.ts:102-139`: connect/refresh/callback responses can report success for `error` or repeated `auth_required` outcomes.
- Public error detail currently copies a raw upstream message; SDK OAuth parsing may include raw response text.

## SDK behavior that constrains the design

- Protocol owns transport callbacks after connect and preserves handlers installed before connect.
- `onerror` is nonterminal and is also used during Streamable HTTP SSE retry.
- `onclose` clears Protocol transport ownership and aborts pending work; explicit local close also fires it.
- POST 401 performs one auth/retry cycle with a second-401 circuit breaker.
- SSE reconnection defaults to two retries, but server-provided retry delay can exceed local delay options.
- SDK invalidation scopes are `all|client|tokens|verifier|discovery`.
- PKCE state-to-transport correlation is memory-only; persisting only the verifier does not make a browser flow restart-resumable.

## Hypotheses and disposition

| Hypothesis | Disposition | Evidence |
|---|---|---|
| Token persistence is broken | Rejected | Token file exists; token-store round trip passes; SDK provider saves the complete token object |
| SDK cannot refresh after restart | Rejected | SDK reads stored access token and refreshes after 401 when `connect()` is invoked |
| Only UI status is stale | Rejected | A new process has no live Client because no startup restore is called |
| Atomic rename prevents lifecycle races | Rejected | Independent provider closures can atomically overwrite newer records |
| `onerror` means disconnected | Rejected | SDK uses it for retryable SSE interruption and retry exhaustion without `onclose` |
| Eagerly keeping old tokens across a callback-origin change is always safe | Rejected as a blanket rule | Tokens and dynamic registration are client-bound; startup may preserve the record, but a new interactive flow requires explicit re-registration |

## Design decisions locked for audit

- Startup restore runs only after `serverActualPort` is set.
- Passive startup never deletes a record. Binding mismatch becomes explicit `auth_required` with a safe reason; user-initiated reconnect performs the re-registration transition.
- Current legacy records are accepted only when provider ID and origin match the compiled endpoint context; the next successful save upgrades binding metadata.
- Pending OAuth state and verifier become memory-only. A restart during browser authorization fails cleanly and requires Connect again; full pending-flow persistence is out of scope.
- Lifecycle operations are generation-guarded and connect is single-flight per provider.
- Connection state and transient transport diagnostics are distinct: `onerror` may degrade detail, while unexpected current-generation `onclose` becomes `offline`.
- One bounded reconnect is allowed after terminal close. Arbitrary `callTool` is never replayed.
- Disconnect stays local-only and non-revoking.
- Multi-process token-directory locking remains out of scope and must be documented as unsupported; in-process generation guards still prevent same-process resurrection.

## Baseline gaps

- Existing focused tests cover sequential connect/callback/list/reset/disconnect and token atomicity only.
- No fresh-manager restore, concurrent operation, stale callback, origin binding, scoped invalidation, transport callback, shutdown, or truthful-response activation test exists.
- `structure/03-server-api.md`, `structure/06-infra-operations.md`, and `docs/API.md` do not describe startup restore or terminal recovery semantics.
