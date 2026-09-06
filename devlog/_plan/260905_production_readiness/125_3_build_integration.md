# WP12s B integration record

Main wired immutable bounds, lazy/fixed-input publicOrigins, selected config source
and private atomic writes; server uses one access instance and API budget, media
headers before rejection and disposal before close. Browser session state, token
removal, deferred App render, pure locale and localized sign-in/out are implemented.
SSE retains accepted subscriptions/cursor; epochs invalidate unsent work. Not C proof.

CLI lane36focused tests and destination mutation passed. Three indirect consumers
outside its packet were verified by main: recover-output swallowed auth during
recovery; prompt import sources returned empty data on auth; tools allowed explicit
env offline fallback and lacked an auth exit envelope. Main owns narrow corrections
in bin/lib/recover-output.ts, bin/commands/prompt.ts, bin/commands/tools.ts and the
existing cli-lan-auth.test.ts. No new feature/helper framework or OS/network scope.

LAN_TOKEN_REQUIRED needs one row in the existing exhaustive node-error-info test:
fix-input, since the global LAN gate owns reauth, not provider settings/automatic retry.
Main added two exports to _jobTrackingUiFixture so tests drive the same bundled
lanSession instance. No fixture permissions changed. Early locked whenConnected
rejection is stamped with the invalidated epoch so late handling cannot relock login.

UI worker disclosed an accidental synthetic HTTP test execution despite its
no-network packet. Owned listeners were closed; no personal app/account/3333 or
provider access. The87-test run is excluded from pure/no-network acceptance. Final
59pure results and incident are in b-ui-transport.md; native integration remains C.

J9 uses the existing hosted-only app and ownership/egress guards. No new time-control
framework or IPC command was added: the native real-app backend test captures a
clock only during synchronous construction, then restores global Date before I/O;
advancing that captured clock proves expired cookies close actual SSE. J9 separately
revokes a session using an independent native client so the browser retains a stale
cookie, exercising the same EOF→unauthenticated-status UI path. These are distinct
evidence claims, not a claim that the browser waited eight wall-clock hours.

TLS fixture implementation refines125_0's proposed in-source key constants: use the
existing hosted runner OpenSSL binary to create an ephemeral self-signed key/cert
only inside an issued test home, avoiding committed private-key material. No install,
child-process permission relaxation or global settings; fail clearly if unavailable.
Only J9's isolated context ignores this synthetic cert trust error. Native HTTPS,
Secure/Strict/HttpOnly cookies and media still execute; production TLS checks unchanged.
Artifacts use existing wp12-* globs, so no new CI job/workflow was introduced.

Selected-source migration also makes legacy contents visible to config ls. Main
therefore reuses the existing redactValue display owner recursively for ls/get;
nested credentials and invalid origin URLs are not echoed. Effective config remains
raw internally for existing consumers; only display paths redact. Public numeric
security.lanTokenMaxBytes stays visible. New synthetic config listing checks cover
legacy/file/effective/nested output without using any actual credential.
