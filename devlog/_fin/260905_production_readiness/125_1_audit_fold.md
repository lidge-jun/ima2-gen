# WP12s A fold-back — concrete client lifecycle and legacy recovery

This amends125/125_0 without changing the product/threat boundary. Audit at5c1e0289:
Hooke backend GO-WITH-FIXES(B1medium); Bohr clients FAIL(B1high,B2medium). Main
checked actual loaders, poll/retry/waiter ownership and overriding CLI catches.
Accept all three findings; do not add an auth/test framework or reopen prior MCP.

## Backend B1: recover the actually selected legacy configuration

config.ts loadConfigJson selects primary then package/.ima2/config.json, but
config-store.ts loadFileCfg reads only the primary. Lazy publicOrigins alone does
not repair invalid legacy-only data. MODIFY config.ts to expose the selected
file-layer source path as a named export (metadata, never content); preserve the
existing primary storage.configFile destination. MODIFY bin/lib/config-store.ts
loadFileCfg to read that selected source when primary is not the active valid
source. Existing saveFileCfg still writes the full edited object to the primary
destination, preserving all other settings/credentials and the legacy original.
This matches the CLI's documented first-write migration; never shadow the legacy
configuration with an empty replacement or delete its file. Capture raw inputs
for the getter at module initialization; do not read a later mutated env value.
Main owns these edits, not the CLI transport worker.

Second-round B2 is accepted: copying credentials through the old unspecified-mode
writer could create a0644 primary on POSIX. Keep saveFileCfg synchronous, but reuse
the repository's private temporary-write/rename pattern (configFileStore/tokenStore):
create a nonce-named sibling exclusively with0600 BEFORE writing any bytes, then
rename that private file over the primary. Creation of missing config directories
uses0700. A pre-existing0644 destination is replaced by the private file, not written
then chmodded. Track ownership so cleanup removes only a temporary actually created
by this invocation; a failed exclusive open must not remove someone else's file.
Preserve original target on write/rename failure and keep the legacy source intact.
No new persistence helper or public async signature, no unrelated writer edits.
The existing synthetic migration case asserts POSIX group/other bits absent for
both new and pre-existing permissive destinations. Windows retains inherited
operator-directory ACL behavior; POSIX mode bits are not claimed as Windows DACL
enforcement, and no global ACL/security-policy command is introduced.

lan-config.test.ts covers primary-invalid and legacy-only-invalid origins: config
rm removes only publicOrigins, retains another synthetic setting/credential, a fresh
load gets default[], and the original legacy file remains recoverable. Invalid env
still needs operator unset/correction and must not print its raw value. No new test
helper file. No real user configuration is used in execution.

## Client B1: auth epoch separates not-yet-submitted work from accepted jobs

lanSession remains the sole dependency-light auth state owner, without App/store/
errorHandler imports. Add a monotone auth-loss epoch and locked/mode state; repeated
notifications while already locked do not repeatedly advance the epoch. Successful
reauth does not undo the increment. API401 with exact LAN_TOKEN_REQUIRED, confirmed
SSE/media expiry and explicit logout enter this state through the same event.

Freeze browser integration exports before delegated work:

```ts
export function isLanSessionLocked(): boolean;
export function getLanAuthEpoch(): number;
export function requireLanAuthentication(): void;
export function createLanAuthError(): Error & { code: "LAN_TOKEN_REQUIRED"; status: 401 };
export function getLanSessionState(): { mode: "local" | "lan"; authenticated: boolean; expiresAt: number | null } | null;
export const LAN_AUTH_REQUIRED_EVENT = "ima2:lan-auth-required";
// api-core remains the HTTP owner; no global fetch patch or new client framework.
export async function fetchApi(url: string, init?: RequestInit): Promise<Response>;
```

fetchApi applies only the auth observation/locked guard to same-origin /api and
/generated paths; it does not attach tokens or alter unrelated external/data/blob
fetches. Preserve RequestInit, caller body/signal/headers, ordinary status/error
behavior. Exact same-origin401+LAN_TOKEN_REQUIRED becomes a fixed typed error and
the shared auth-required event before provider/caller parsers. Non-LAN401 remains
ordinary. A locked session rejects new protected requests before network; session
status/bootstrap/logout in lanSession use their own token-free direct fetch to
avoid a circular dependency. Response body inspection must preserve ordinary
caller reads; no caller-derived URL/body is logged or placed in errors.

- MODIFY asyncJobSubmit.ts: capture epoch at invocation; check it BEFORE every
 POST and after capacity delay. Changed epoch permanently rejects this invocation,
 even if login already succeeded. Raw submission uses fetchApi so nested LAN401
 cannot become a flat-parser/provider error. Keep capacity/backoff/abort semantics
 for ordinary work. Do not abort accepted server jobs as logout cleanup.
- MODIFY eventChannel.ts: pause only owned source/reconnect timer while locked;
 retain accepted subscriptions, lastEventId and original deadlines. No generic
 disconnect() on auth lock. Stale async status results cannot reopen or close a
 later authorized source. subscribe/ensureConnected honor locked state; authenticated
 App mount resumes through existing ensureConnected/reconciliation. whenConnected
 captures epoch and rejects a pre-lock waiter BEFORE checking a later OPEN source,
 preventing videoExtendStream's old waiter from submitting after reauth.
- MODIFY storeInflightImpl.ts and App.tsx: expose a narrow stop function for the
 existing poll timer, remove its auth listener on idle/stop, stop it at auth loss/
 App unmount without deleting inflight/drafts, and resume via existing mount path.
- MODIFY errorCodes.ts/errorHandler.ts: add typed LAN_TOKEN_REQUIRED recognition
 ahead of message heuristics. handleError routes it only to the auth gate, not a
 provider/generation toast/card. Server creates fixed code→JSON envelope→fetchApi
 typed Error→registry/handler/gate; no new ErrorSurface or provider-auth semantics.
- Root media error capture confirms session status only for same-origin generated
 img/video. Coalesce checks;404/network error alone does not lock the UI. Preserve
 the already planned asynchronous App-load/auth-state revision check.
- MODIFY SettingsWorkspace.tsx: render a small LAN-only sign-out control exported
 from LanSignIn.tsx, using endLanSession; local mode has no extra control. Use current
 tokens/spacing. No forced logout on failed request and no claim of server revocation
 without response; errors remain safe/actionable. This makes native logout reachable.

All first-party raw browser fetch sites use the existing api-core HTTP owner so
401 behavior is consistent. Exact MODIFY list beyond125_0:

ui/src/store/storeGraphSave.ts, ui/src/store/storeHelpers.ts;
ui/src/lib/cardNewsApi.ts, api-assets.ts, agentApi.ts, nodeApi.ts,
videoExtendStream.ts, resultChaining.ts, image.ts, frameExtraction.ts,
api-generation.ts, asyncJobSubmit.ts;
ui/src/hooks/useAgyStatus.ts, useKeyStatus.ts, useGrokStatus.ts;
ui/src/components/settings/GrokPlannerSelect.tsx, QuotaCard.tsx;
ui/src/components/VertexJsonInput.tsx, GeminiKeySection.tsx, ApiKeyInput.tsx,
VideoControlsPanel.tsx. ResultActions.tsx's dataUrl-only conversion remains native
fetch (not server access). Preserve mixed media URL behavior in image/frame helpers;
transport itself never adds LAN credentials to external requests. This is a bounded
callsite migration, not replacement APIs. No unrelated state/render refactoring.

Existing test owners additionally permitted: tests/job-tracking-timeout-ui.test.ts,
tests/inflight-reconciliation-behavior.test.ts, tests/ui-error-code-contract.test.ts,
tests/e2e-app-environment.test.ts and ui/e2e/fixture-isolation.spec.ts, only for this
auth/poll/bind behavior. Reuse _jobTrackingUiFixture unchanged where possible; no
new framework or broad filesystem/process/egress allowances.

Activation in existing planned J9/focused owners: capacity wait→auth loss→explicit
login→release old delay produces no secondPOST; same for pre-lock whenConnected
waiter. Accepted job survives transport pause, retains cursor/subscription/deadline,
reauth reconciles without POST/DELETE. No repeated inflight/history calls while
locked. Nested LAN401 opens sign-in without generic failure, ordinary provider401
does not. Native cookie/HTTP/TLS/Range/logout/expiry and cleanup remain125§6.

## Client B2: preserve transport errors through direct CLI consumers

Add MODIFY bin/commands/models.ts, defaults.ts and capabilities.ts to CLI worker's
write scope. Their current catches erase code or return local data; preserve safe
LAN/forbidden errors and exit4, including explicit IMA2_SERVER target, and never
report successful local fallback after selected-server auth denial. Explicit --local
still works. Genuine unreachable explicit target stays exit3; intended auto-discovery
offline fallback stays only for genuinely unreachable/no-server, not auth failure.
Apply this same narrow correction to mapped gen/videoMcp/upscale catch paths that
currently force offline/exit1. Preserve typed original errors; no message matching
or new helper framework. cli-lan-auth.test.ts invokes these command entrypoints
against synthetic servers and verifies code/exit/sentinel absence, not only helpers.

## Revised disjoint B ownership

Backend worker and CLI worker keep125_0 scopes, with config-store owned by main.
A third UI transport worker may own api-core fetchApi, the enumerated raw-callsite
migration, asyncJobSubmit, errorCodes/errorHandler, App/storeInflight poll integration
and their existing focused test owners. Main owns lanSession, main bootstrap,
LanSignIn/SettingsWorkspace/locale/style, eventChannel, config/server/media wiring,
J9/fixture deltas and docs. Shared exports above are frozen first. No shared source
writes; main verifies source/diffs/results before integration. Each worker uses
Astra/high and cannot spawn/advance phases. No WP13 implementation before this C/D.

Assurance wording: runtime origin/auth/media middleware is the first-party server
access boundary; browser gating prevents accidental presentation/replay, not a
trust boundary against operator/devtools. Exact registered fixture origins are E7
test isolation, not production security. Known bypasses and residuals remain125_0:
trusted host/proxy compromise, filesystem copies and old caches/downloads. No
unbypassable or global confidentiality claim. Re-audit these amendments before B.
