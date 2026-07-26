# Phase 010 — credential and lifecycle foundations

Consumes: `000_plan.md`, `001_current_state.md`
Work phase: WP1

## Scope

Implement record binding, SDK invalidation, memory-only PKCE, per-provider generation guards, and single-flight connection ownership. Do not wire server startup restore or automatic reconnect in this phase.

## File change map

### MODIFY `lib/mcp/tokenStore.ts`

Before:

- Record contains optional client information, tokens, verifier, and origin.
- Writes replace the full file atomically with 0600 mode.
- Only read/write/delete operations exist.

After:

- Add schema version `1`, a monotonically increasing persistent revision, and non-secret binding metadata: provider ID, normalized endpoint, redirect origin, and credential update timestamp. Normalize endpoints with `new URL(endpoint).toString()` and callback origins with `new URL(origin).origin` before comparing.
- Validate the complete record shape at the file boundary. JSON parse failure, arrays, unsupported schema versions, malformed revisions/bindings, and non-object credential fields inspect as `corrupt` and are never silently overwritten by inspection.
- Add a secret-free inspection result used by startup: `missing|corrupt|pending-only|usable|binding-mismatch` without returning credential values. `usable` requires a token object and a matching current binding. A legacy `{ origin, tokens }` record is usable only when its normalized origin matches the current callback origin and the live endpoint equals a frozen per-provider historical migration endpoint; an endpoint change therefore fails closed. The record upgrades on the next successful credential save. A valid record without usable tokens is `pending-only`.
- Publish each provider lock only by hard-linking a fully written 0600 PID+nonce owner file into the canonical lock path; a crash during owner-file creation cannot leave a partial canonical lock. The canonical hard link is exclusive around read-modify-write, expected-revision compare-and-swap, and field-scoped invalidation for `all|client|tokens|verifier|discovery`. Contention fails closed while that PID is alive. Crash recovery first creates an `O_EXCL` hard-link claim whose path includes the observed dead-owner nonce; this atomically binds the single winning recoverer to the canonical lock inode. Only that winner may unlink the canonical lock after `process.kill(pid, 0)` reports `ESRCH` and canonical/claim still have the same inode, PID, and nonce. Concurrent recoverers fail closed, PID reuse fails closed, malformed legacy/manual canonical locks fail closed, and filesystems without safe hard-link support fail closed. Each live owner releases in `finally` on success, CAS mismatch, and store error only after verifying its nonce still matches.
- `disconnect`/`all` writes a credential-free tombstone with a newer revision instead of physically removing revision history. This prevents an OAuth provider cached by another local process from recreating credentials with an older revision.
- `client` invalidation also clears client-bound tokens; `all` preserves no credential fields.
- Preserve 0600 final mode and path guard for records, temporary files, and lock files; remove owned temporary/lock residue on every exit path. Do not create a new storage module.

### MODIFY `lib/mcp/oauthProvider.ts`

Before:

- Implements a local subset of the SDK provider and is cast through `never`.
- Reads a whole record snapshot, persists PKCE verifier, and deletes the whole record immediately on origin mismatch.

After:

- Implement the SDK `OAuthClientProvider` contract directly, including `invalidateCredentials`.
- Accept endpoint and generation-current guards from the manager and capture the record revision used to construct the provider. Every successful provider mutation adopts the returned next revision before another SDK operation can run, so registration→token save and invalidation→retry remain valid sequential CAS operations.
- Keep state and verifier only in the provider closure; successful token save clears legacy persisted verifier material.
- On stale generation or revision mismatch, reject every credential mutation with a typed code-only internal error. A no-op is forbidden because it can make SDK `finishAuth()` appear successful.
- On stale generation or binding mismatch, `tokens()` and `clientInformation()` return `undefined`; no mismatched Bearer token or client registration reaches the SDK. A legacy credential record with neither binding nor origin is mismatch/fail-closed rather than portable to the current endpoint.
- Never delete during passive construction. Expose a secret-free binding decision to the manager. A user-initiated Connect under mismatch starts clean in memory while preserving the old file until successful registration/token persistence.
- A successful new client registration atomically replaces mismatched client-bound credentials and writes the current binding. A successful token save writes the current binding, advances revision, and removes legacy verifier material.

### MODIFY `lib/mcp/connectionManager.ts`

Before:

- `connect()` starts a new client unless state is already `connected`.
- Pending auth entries have provider/transport/expiry only.
- Callback, reset, and disconnect are not generation-aware.

After:

- Add a monotonic generation and one in-flight connect promise per provider.
- Coalesce connect/restore calls for the current generation.
- Store generation in pending auth and allow at most one current pending flow per provider; close superseded/expired transports.
- Disconnect increments generation before closing candidates and writes the newer credential-free tombstone before returning, so late providers in this or another process cannot persist or reconnect.
- Callback validates state, expiry, provider generation, and current pending ownership before and after async token exchange.
- Add atomic `refresh(provider)` ownership. The first refresh validates the provider, increments generation, closes/removes every current candidate and pending authorization, preserves credentials, publishes `disconnected`, and starts exactly one connect for that new generation. Concurrent refreshes and connects coalesce into that refresh flight. `disconnect()` registers a per-provider disconnect flight and terminal-disconnected intent synchronously before its first await, then increments generation, closes all work, and writes the tombstone. Any connect/refresh/reset entering while that flight exists joins its disconnected result and cannot allocate a newer generation; a disconnect that starts before or during refresh therefore wins in both overlap orders. After the flight is removed, a later explicit Connect may create a fresh generation. Until the route migrates in WP2, `reset()` itself performs the same invalidate/close/preserve prelude without starting connect and returns only after the old generation can no longer publish state.
- Add injected `now()` and pending-auth TTL test seams; production defaults remain `Date.now` and ten minutes.
- Status lookup rejects an unknown ID without creating a session. A known-but-disabled provider returns a stable synthetic `disconnected` status without creating a session so `/api/mcp/providers` can still enumerate it; `connect`, `reset`, `refresh`, and `disconnect` reject disabled IDs.
- Public detail uses allowlisted codes/messages, never raw upstream bodies.

### MODIFY `lib/mcp/types.ts`

- Document state meanings and add only optional secret-free lifecycle metadata required by manager tests.
- Do not expose token presence, account identity, authorization code, verifier, or raw upstream error.

### MODIFY `tests/mcp-token-store.test.ts`

Add RED→GREEN activation cases for:

- binding inspection of missing, corrupt, pending-only, usable, same-binding legacy, and mismatch records;
- exact field invalidation for every SDK scope:
  - `tokens` clears only the access/refresh token bundle;
  - `client` clears client information and every client-bound token, while leaving unrelated binding metadata available for diagnostics;
  - `verifier` clears persisted legacy verifier material and the live provider closure rejects a later verifier read;
  - `discovery` is an explicit no-op while discovery state is not persisted; its test prevents accidental clearing of client/tokens and must change if discovery persistence is later added;
  - `all` clears client, tokens, verifier, and any future discovery state in one atomic write;
- legacy verifier removal;
- cross-process stale revision rejection after a disconnect tombstone;
- sequential registration→token save and invalidation→retry adopt the returned revision and do not self-conflict;
- lock contention fails closed; deterministic dead-PID hard-link recovery succeeds; a live PID and owner nonce prevent a failed/old owner from removing a replacement lock; a two-recoverer/new-owner interleaving proves only the inode-claim winner can unlink;
- 0600 and no temp/lock residue after successful and failing mutations;
- values never appearing in inspection output.

### MODIFY `tests/mcp-connection-manager.test.ts`

Upgrade the fake transport/client to support deferred connect, close/error callbacks, and persistence guards. Add RED→GREEN cases for:

- ten concurrent connects produce one client/transport;
- older connect completion cannot overwrite newer intent;
- disconnect during connect closes/invalidates the candidate and wins terminal state;
- stale callback after disconnect/new connect is rejected;
- pending auth expiry closes transport;
- stale provider mutation rejects callback completion with a code-only error and never reports connected;
- race-safe `reset()` invalidates pending/candidate work while preserving credentials;
- concurrent refresh/refresh/connect calls produce one new-generation candidate and preserve credentials; both `refresh-start → disconnect-start` and `disconnect-start → refresh-start → disconnect-finish → deferred-work-release` leave disconnect terminal;
- SDK token/all invalidation changes the intended record fields;
- SDK client/verifier/discovery invalidation activates the exact semantics above and does not over-clear;
- mismatch Connect exposes neither old tokens nor old client information, preserves disk bytes until successful replacement, then upgrades the binding;
- unknown status rejects without creating a session; known-disabled status is synthetic and session-free;
- raw upstream OAuth body, authorization code, verifier, and token fixtures never appear in public status detail or thrown callback messages.

Every race test uses a test-local temporary directory and a deterministic deferred promise or injected clock. No sleeps, retries, or shared cross-test provider files are allowed.

## Conditional-path activation

| Path | Trigger | Observable proof |
|---|---|---|
| stale provider save | Disconnect while deferred connect/callback is pending, including a provider holding the previous persistent revision | credential-free tombstone remains, stale mutation rejects, and candidate closes |
| invalid grant | Fake SDK calls `invalidateCredentials('tokens')` | token bundle gone, client registration retained |
| invalid client | Fake SDK calls `invalidateCredentials('all')` | complete credential fields gone |
| client invalidation | Fake SDK calls `invalidateCredentials('client')` | client and client-bound tokens gone; binding diagnostic remains |
| verifier invalidation | Provider saves a verifier, then receives `verifier` | verifier read fails; client/tokens unchanged |
| discovery invalidation | Provider receives `discovery` with no persisted discovery field | explicit no-op; client/tokens byte-equivalent |
| origin/endpoint mismatch | Inspect/connect a bound record under changed current binding | status is mismatch; passive read leaves bytes present; SDK sees no old client/tokens; successful new auth atomically replaces and rebinds |
| expired pending state | Advance injected clock past TTL | callback rejected and transport closed |
| reset during connect/auth | Defer current generation, invoke reset, then release it | old transport closes, old generation cannot publish, stored credentials remain |

## Verification

```bash
npm run typecheck
npm run typecheck:tests
node --test --import tsx tests/mcp-token-store.test.ts tests/mcp-connection-manager.test.ts
git diff --check -- lib/mcp/tokenStore.ts lib/mcp/oauthProvider.ts lib/mcp/connectionManager.ts lib/mcp/types.ts tests/mcp-token-store.test.ts tests/mcp-connection-manager.test.ts
```

## Exit criteria

- All activation cases fire and pass.
- No server/route/UI/docs source is modified.
- No credential value appears in output.
- Only WP1 paths are committed locally; no push.
