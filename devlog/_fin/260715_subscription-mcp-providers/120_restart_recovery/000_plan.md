# MCP connection recovery roadmap

Date: 2026-07-17
Class: C4 auth and credential lifecycle
Status: completed — DONE (logical completion inside the active parent initiative)

## Objective

Make an authenticated MCP provider recover after an ima2 server restart without a manual Connect click when the stored credential is still bound to the same provider endpoint and callback origin. Keep public status truthful across refresh, transport degradation, terminal close, disconnect, and shutdown. Prevent stale OAuth or connect work from overwriting newer intent or recreating credentials after disconnect.

## Loop specification

- Archetype: spec-satisfaction repair.
- Trigger: a restarted server reports Runway as `disconnected` although a valid 0600 token record exists.
- Goal: same-origin completed sessions restore automatically; unrecoverable or mismatched records become explicit `auth_required` or `error` without silent credential deletion.
- Non-goals: billed generation, provider-side revocation, arbitrary endpoints, UI redesign, dependency upgrades, release, publish, or push.
- Verifier: focused MCP activation tests, server/type test typechecks, inventory, full suite, secret scan, and independent review.
- Stop: all criteria below have fresh evidence and no High/Critical review blocker remains.
- Memory: this folder, the session goalplan, and its ledger.
- Terminal outcomes: `DONE`, `BLOCKED`, `UNSAFE`, `NEEDS_HUMAN`, or `BUDGET_EXHAUSTED` under the bound goal contract.
- Escalation up: main session reclaims a slice after two distinct worker packets fail.
- Delegation down: only at a P amendment with a disjoint write set.
- Tool/credential scope: local code/tests/docs and non-billed secret-free status probes; never print credential values.
- Write scope: files named in 010/020/030 only; preserve every unrelated dirty file.
- Cost bound: zero provider generation calls.
- Time bound: 90 minutes.

## Threat model

- Protected assets: OAuth access/refresh tokens, dynamic client registration, PKCE verifier/state, account-bound provider session, and secret-free diagnostics.
- Adversaries/failures: stale concurrent callbacks, a second local process sharing the token directory, malformed OAuth errors, endpoint or callback-origin changes, remote transport interruption, and accidental log exposure.
- Trust boundaries: local browser ↔ callback route; ima2 ↔ remote MCP endpoint; token file ↔ in-memory OAuth provider; server lifecycle ↔ MCP Client/transport.
- Blast radius: one provider account per local config directory; stale writes can restore access after the user chose Disconnect.

## Dependency-ordered work phases

| Work phase | Document | Outcome |
|---|---|---|
| WP0 | `000_plan.md`, `001_current_state.md`, `010_credential_lifecycle.md`, `020_runtime_recovery.md`, `030_verification_sot.md` | Whole roadmap locked without code edits |
| WP1 | `010_credential_lifecycle.md` | Versioned/bound credentials, SDK invalidation, generation guards, and single-flight lifecycle |
| WP2 | `020_runtime_recovery.md` | Post-listen startup restore, truthful transport/runtime state, atomic refresh, and shutdown ownership |
| WP3 | `030_verification_sot.md` | Full activation matrix, source-of-truth sync, adversarial review, and archive |

Each work phase runs one full PABCD cycle. WP1 must land before WP2; WP2 consumes the generation and credential contracts from WP1. WP3 verifies the integrated result.

## Acceptance criteria

1. A same-origin record with a completed token bundle causes exactly one startup connection attempt after the actual server port is known.
2. Missing, corrupt, disabled, endpoint-mismatched, or callback-origin-mismatched records never trigger an unsafe Bearer request or silent disk deletion.
3. Concurrent connect/restore calls coalesce; disconnect or shutdown always wins against older work.
4. SDK `invalidateCredentials` scopes mutate only the intended client/token/verifier fields and remain atomic/0600.
5. An unexpected current-generation close becomes `offline` and gets at most one bounded reconnect; ordinary `onerror` does not falsely end an otherwise usable POST connection.
6. Post-connect auth failure cannot leave public state at `connected`.
7. Connect, refresh, and callback HTTP responses match the actual terminal state.
8. No status, log, error, devlog, test output, or source diff exposes token/code/verifier/account values.
9. No billed image/video call occurs.
10. Relevant typechecks, tests, inventory, full suite, docs consistency, and final independent review pass.

## Dirty-worktree guard

- Do not touch `.gitignore`, `tests/mcp-models-catalog.test.ts`, UI/store files, generated `config.js`/`bin/ima2.js`/`lib/capabilities.js`, or unrelated asset/video work.
- Extend existing clean MCP test files instead of adding a top-level test file; this avoids rewriting the already-modified generated inventory.
- Server/lib/routes JavaScript outputs are ignored in the current checkout. Verify TypeScript sources directly; do not stage ignored build products.
- Stage and commit only explicit path manifests from the active decade document. Never use broad `git add`.

## Evidence inputs

- Baseline focused suite: 10 tests passed, 0 failed on 2026-07-17 (`mcp-token-store` 5 + `mcp-connection-manager` 5).
- Read-only explorer: restart activation, lifecycle races, stale status, origin deletion, SDK invalidation, and shutdown gaps confirmed.
- Three `gpt-5.6-sol/high/priority` audits independently confirmed credential persistence, missing startup restore, generation races, `onerror`/`onclose` separation, missing security tests, and unsynchronized source-of-truth docs.

## Implementation receipts

- WP1 `716fdbb`: versioned endpoint/origin binding, revision/tombstone CAS, PID+nonce recovery lock, memory-only PKCE, scoped SDK invalidation, and generation-safe single-flight lifecycle.
- WP2 `53656b5`: post-listen restore, generation+epoch transport ownership, truthful state transitions and route status, one bounded terminal reconnect, stale snapshot/tool suppression, and coordinated shutdown.
- WP3 blocker correction `4b15ec7`: explicit post-listen activation helper and regression proving restore is inert until `serverActualPort` is published.
- WP3 SOT `d4cc5bc`, `f7d24a7`: API, architecture, operations, parent roadmap, devlog map, and committed-tree line counts synchronized.
- Final adversarial correction `a9b70e1`: malformed token bundles fail closed as corrupt; a post-connect Unauthorized/closed `tools/list` invalidates only the current epoch and produces truthful `offline`/503 instead of 200 connected.
- Detached committed-tree evidence: MCP 138 passed, 0 failed; focused lifecycle/port matrix 55/55; API/structure contracts 3/3; scoped whitespace exit 0; recovery-range gitleaks exit 0 with 0 leaks.
- Integrated worktree evidence: server and test typechecks exit 0, inventory exit 0, full suite 1659 passed, 0 failed after a temporary mechanical line-count refresh for unrelated in-progress files; the committed-tree line-count SOT was restored immediately afterward.
- Final `gpt-5.6-sol/high/priority` review first found two blockers, then re-audited `a9b70e1` and returned `VERDICT: PASS`; no High/Critical finding remains.
- Provider generation calls: 0. No publish or push is part of this unit.
- Archive policy: keep `120_restart_recovery/` under the active `260715_subscription-mcp-providers` parent; move it only when the parent initiative closes.
