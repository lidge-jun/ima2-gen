# wp12s — Local/LAN authentication and private generated media

Status: P design; C4 security contract, not implementation or A approval.
User/main decision, 2026-09-05: protect generated user media in LAN mode; preserve
loopback single-user behavior and documented remote token flow. No further product
decision is deferred. Stack: **WP12 → wp12s → WP13**. Semantic dependencies: WP09
isolated fixture and WP10 safe diagnostics; WP12 provides cumulative UI acceptance
to rerun after this layer. Parent owns registration/release criterion/PR sequencing.
Baseline source: `ecde2bc79cddc50ff0da38091c1ce0590383090c`; refresh callsites in B.

## Scope, before/after and exclusions

`006_trust_boundaries.md` contains observed guards and test receipts. Currently
`server.ts:249` only guards `/api`, ignores tokens on loopback, accepts header/query,
and exempts MCP callback. `server.ts:280` serves generated media without auth with
one-year immutable default (`config.ts:296`). `ui/src/main.tsx:30` redirects localhost
to 127.0.0.1; API fetch (`ui/src/lib/api-core.ts:1`), native SSE
(`ui/src/lib/eventChannel.ts:37`) and CLI health (`bin/lib/client.ts:25`) lack LAN
credential propagation. `docs/DOCKER.md:23` advertises a page query-token flow.

After: one trusted operator, shared server token, origin-bound browser sessions,
private LAN media, same-origin mutations, authenticated CLI transport. No tenants,
accounts, OAuth replacement, token localStorage, new dependency, filesystem/data
migration, provider calls or generation spend. Reuse Express cookie serialization,
Node crypto, existing config/CLI/SSE owners and WP09 fixtures. Do-nothing/docs-only
implementation cannot satisfy private media; removing LAN support is rejected.

Main's ownership agreement: **WP10** expands the shared logger URL sanitizer and
synthetic corpus, without provider-code changes. This is a required upstream receipt,
not a fix already delivered by this draft. Adapter/download changes stay WP05/06 **only where those owners explicitly
accept them**. Unassigned cross-provider/MCP DNS pinning remains in 006, not solved
or silently folded here. This WP changes first-party inbound access and CLI credential
destination safety, not generic provider egress or TLS deployment infrastructure.

## 1. Threat assumptions and chosen policy

Assets: user media/prompts/DB, host mutations, shared LAN token, browser session and
safe issue/CI artifacts. Attacker: anonymous LAN peer or hostile browser origin;
not an actor already executing code as the operator or controlling the configured
reverse proxy. Token holders share operator authority. Session IDs are capabilities,
not roles. No per-session data ownership is invented.

- Local mode means **configured loopback bind**, not a request arriving from a
  loopback peer. LAN-configured servers require auth even from localhost/proxy.
- LAN auth covers every `/api` route except precisely defined status/bootstrap and
  MCP callback below, plus every `/generated` method/path before filesystem lookup.
- UI/static shell/fonts remain public but contain no user data. Root response and
  bootstrap receive `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and
  CSP `frame-ancestors 'none'` (do not add a blanket script CSP breaking theme code).
- HTTP LAN remains supported, explicitly a trusted-network transport: no Secure
  attribute on HTTP because that would break real LAN browsers. It does **not**
  protect tokens/cookies against network interception. HTTPS external origin uses
  Secure cookies; operators use TLS proxy/VPN for untrusted networks. No automatic
  HSTS on HTTP, no pretending SameSite/HttpOnly encrypt traffic.
- Cookies are host-scoped, not a security boundary against other malicious services
  on that host. Bind sessions to origin and use per-origin cookie names to avoid
  accidental cross-port collisions; do not claim protection from a compromised host.

## 2. Exact HTTP/session contract

All JSON errors have `{error:{code:string,message:string}}` with fixed safe messages.
Auth responses never include token, cookie, supplied Host/Origin, URL or config dump.
For status, absent/expired cookie yields authenticated:false; an explicitly supplied
invalid header/query yields 401 rather than falsely reporting authenticated from a
different credential. Cookie-only status never exposes the session identifier.

| Method/path | Request and authorization | Response |
|---|---|---|
| `GET /api/auth/lan/session` | Valid Host/origin policy; no credential needed to learn mode. No upstream/storage/queue operation. | 200 `{mode:"local"|"lan", authenticated:boolean, expiresAt:number|null}`; local is true/null. LAN true only for a valid session cookie or explicit API credential. no-store. |
| `POST /api/auth/lan/session` | Browser bootstrap only: exact same-origin `Origin` required, JSON `{}` only (1KB limit, no unknown fields), **valid `x-ima2-token` required in LAN**. Query/cookie alone cannot mint a session. Local returns 204 without a cookie. | LAN 204 plus session Set-Cookie; bad/missing token 401 `LAN_TOKEN_REQUIRED`; malformed body 400; wrong content type 415; origin violation 403; throttle 429 + Retry-After. |
| `DELETE /api/auth/lan/session` | Same-origin Origin plus valid session cookie; local is no-op. No query-token-only logout. | 204 revoke presented session, expire same cookie; unknown/expired cookie may idempotently clear and return 204, but never bypass Origin/Host checks. |
| Other `/api` | LAN: explicit header, otherwise query token, otherwise session cookie; local: no auth required. Explicit invalid credential **must fail**, not fall back to a valid cookie. | Existing success contracts; 401 `LAN_TOKEN_REQUIRED` for missing/invalid/expired auth, 403 for origin/host. |
| `/generated` | Same LAN credential precedence; GET/HEAD + Range/conditional requests authenticate **before** any stat/304/206. Local retains no-token behavior. | Authorized existing bytes/type/Range behavior; unauthorized 401 no-store, no Location/ETag/file information. |
| `GET /api/mcp/oauth/callback` | Host checked, exempt from cookie/token and cross-origin rejection **only for this exact path/method**; existing state/PKCE processing unchanged. | Existing callback response. Missing/invalid/replayed state still rejected by MCP owner. Non-GET does not inherit exemption. |

Reject duplicate/array header/query token encodings and ambiguous duplicate session
cookies. Bound incoming credential length to 4096 UTF-8 bytes before comparison;
configured LAN token over that limit fails startup with a fixed safe config error.
Existing short tokens continue to work; docs replace `change-me` with a clearly
synthetic placeholder and recommend operator-generated strong secrets. No auto
rotation or secret printing. Header remains authoritative over legacy query token;
cookie parser recognizes only the exact expected name, no cookie-parser dependency.

### Session lifetime, serialization and revocation

One `LanSessionStore` per `buildApp` instance. On successful bootstrap create
`randomBytes(32).toString("base64url")`; store **SHA-256 digest only**, normalized
origin, issuedAt, expiresAt, and open-response closers. Never store the LAN token
in cookie/session records. Compare token using current length/timing-safe logic.
Cookie name: HTTP `ima2_lan_<sha256(origin).slice(0,12)>`, HTTPS
`__Host-ima2_lan_<same suffix>`; `Path=/; HttpOnly; SameSite=Strict`, Secure only HTTPS,
no Domain. Omit Max-Age/Expires for browser-session persistence; server TTL is
absolute **8 hours**, not sliding. Status may return only that expiration timestamp.

TTL/limits live as immutable named values under `config.security` (not user-writable):
`lanSessionTtlMs=28800000`, `lanMaxSessions=256`, `lanAuthWindowMs=60000`,
`lanAuthMaxFailures=10`, `lanAuthMaxBuckets=4096`, `lanTokenMaxBytes=4096`.
These fields have no env mapping/file override; they are protocol/resource bounds,
not a new generic configuration API. Inject clock/random into store factory for tests.
Expire records lazily and use one scheduled nearest-expiry timer (unref/clear on close),
not one permanent interval per request. At session capacity return 503
`LAN_SESSION_CAPACITY` rather than evicting valid users. Rebootstrap revokes a valid
old cookie only **after** token validation, then issues a fresh ID.

Logout, expiration, store disposal and restart invalidate sessions. Token is startup
config as today: rotation requires restart, which clears sessions/streams. Track
responses admitted by session cookie; revoke/expiry closes active SSE/media responses
and drops their references on finish/close. This does not undo already accepted
generation or retract downloaded bytes; jobs retain WP07 lifecycle semantics.
No DB/config/advertise/session-file persistence or export of session records.

Failed bootstrap attempts are limited by actual socket peer (not forwarded IP):
10 failures/60s, bounded 4096-entry map with expired bucket pruning; deny new
untracked attempts with 429 when saturated, not unbounded allocations. Successful
validation does not clear an attacker's failure history; valid requests are also
subject to an already-active cooldown. No IP/token/raw Origin logging. One operator
behind NAT shares this bounded cooldown; document Retry-After.

## 3. Host/Origin and reverse-proxy contract

New optional **`server.publicOrigins: string[]`**, default `[]`, env
`IMA2_PUBLIC_ORIGINS` encoded as JSON array, env > JSON file > default. Max 16 exact
http/https origins, no credentials/query/hash/path except `/`; normalize with URL,
deduplicate; reject wildcards, `null`, malformed/opaque origins and non-array input
with `INVALID_PUBLIC_ORIGINS` before listen. This is a set of trusted serving origins,
not permission for cross-origin CORS. No `trust proxy` enablement or trust in
`Forwarded`, `X-Forwarded-Host` or `X-Forwarded-Proto` is added.
Keep default `publicOrigins=[]` and public shell unchanged. Freeze normalized config
at startup; request headers, query, Referer, cookies and DNS results cannot add entries.
Host/Origin are comparison inputs only, never fallback defaults or persisted values.

For each request calculate candidate origins independently of its Host:

1. HTTP literal `req.socket.localAddress` + **actual socket localPort**, with IPv4-
   mapped IPv6 normalized; add localhost/127.0.0.1/[::1] aliases at that actual port
   when configured loopback or wildcard bind; add an explicit configured bind hostname
   at that port. Wildcard `0.0.0.0`/`::` itself is not a public host wildcard.
2. Add configured publicOrigins verbatim. This covers LAN DNS names, Docker NAT
   ports differing from container port, and TLS reverse proxies. Literal IP LAN
   access to the actual listener works without a manual LAN-IP allowlist.
3. Strictly parse Host (one value, no whitespace/userinfo/path/comma); it must match
   an allowed origin authority. For Origin-bearing requests select an allowed origin
   whose origin equals Origin **and** authority equals Host. Reject scheme/port
   mismatch, `Origin: null`, duplicate or foreign Origin. For no-Origin requests choose
   matching origin from that independent set. An explicit public origin overrides an
   inferred socket origin for the same authority, including scheme; do not retain an
   inferred HTTP downgrade beside configured HTTPS. Without an explicit override,
   scheme comes from socket TLS state, never a forwarded header. Reject ambiguous
   same-authority HTTP+HTTPS config entries. Invalid Host → 403 `LOCAL_HOST_REJECTED`.

Except exact MCP GET callback, reject `Sec-Fetch-Site: cross-site` or `same-site`
on protected routes (same-site sibling origins are not same-origin). A present
Origin must pass exact equality for **all** protected methods, even with a correct
token. Unsafe methods (anything except GET/HEAD/OPTIONS) using only cookies require
Origin. No-Origin CLI remains allowed: in LAN it must present header/query credential;
local no-Origin/no-browser-cross-site requests preserve current CLI behavior.
Reject hostile-origin bodyless POSTs before any handler, including storage open,
MCP connect/refresh, auth switch and admin stop. OPTIONS does not manufacture CORS
permission. Admin stop's stricter no-Origin + admin nonce remains unchanged, and
in LAN still additionally needs LAN auth. No same-origin cookie substitutes for nonce.

Vite is a verified exception to plan explicitly, not to bypass: current
`ui/vite.config.ts:14` rewrites Host via changeOrigin while retaining browser Origin.
Set changeOrigin:false for both `/api` and `/generated`; dev backend must explicitly
include its actual browser origin (e.g. `http://127.0.0.1:5173`) in publicOrigins.
Document this alongside `VITE_IMA2_API_TARGET`; no automatic any-localhost-port or
`*.local` exemption. Production localhost canonicalization cannot apply to the Vite
proxy once a LAN session is active. Reverse proxies must preserve external Host,
forward Origin, exclude access-query logging, avoid caching protected routes, and
forward Set-Cookie. A loopback backend behind an external proxy is **not** LAN-auth
mode: use non-loopback bind + token with network isolation for that deployment.

## 4. Browser bootstrap and media contract

New `ui/src/lib/lanSession.ts` is dependency-light, imports no store/App. Entry calls
`bootstrapLanSession(): Promise<{mode:"local"|"lan";authenticated:boolean}>` before
dynamic-importing/rendering App. First synchronously capture at most one page `token`,
remove **all** token query values with `history.replaceState` preserving other query
and hash, before awaits/API calls. Duplicate token is a safe login error, not last-wins.
On supplied token: POST exact same-origin bootstrap with header, JSON `{}` and
`credentials:"same-origin"`; keep token only in local variable and clear reference
on completion/failure. No URL echo, console output, analytics, local/sessionStorage,
cross-origin redirect, request retries with the token, or token passed into App props.
After 204, GET session status to learn mode and confirm the browser actually stored
the cookie; if LAN remains unauthenticated, show cookie/transport guidance rather
than rendering App. Add a no-cookie-storage browser acceptance case.
On no token: GET session status. Local: keep existing localhost→127.0.0.1 canonical
redirect **after** token removal/mode discovery. LAN: preserve entered origin so
cookie is not stranded by canonicalization. Only then load App/theme/store.

Unauthenticated LAN shows a small accessible sign-in shell (password input, explicit
submit, safe error, retry/cooldown); no gallery/providers/job requests behind it.
Use `createLanSession(token:string): Promise<void>` and same endpoint; no new auth
framework. Server auth status/errors are fixed codes, not provider-login errors.
Expiry on normal API 401 clears UI user-data view and returns to sign-in without
discarding persisted drafts; notify via one auth-required event from api-core.
EventSource cannot inspect 401: on failure check session status once per reconnect
cycle; if unauthenticated, stop reconnecting and trigger same sign-in event. No polling
storm, no auto-generation replay after reauth. Media errors alone are not proof of
auth failure; status check distinguishes 404/network from expiration.

Existing relative API/EventSource/img/video URLs remain token-free. Native same-origin
cookie behavior supplies auth including Range, thumbnails, poster, download and SVG.
LanSession owns status/bootstrap/logout only, not a duplicate API client. `api-core`
keeps custom RequestInit compatibility; never attach credentials to external URLs.

Move generated middleware into `lib/generatedMediaAccess.ts`. Authenticate at mount
boundary **before** static middleware and conditional response evaluation. In LAN,
always `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie, X-Ima2-Token`,
`Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`; disable
static ETag/Last-Modified/immutable/cacheControl overrides. This includes 401/403/404,
HEAD and 206. Keep Express range serving; auth cannot be bypassed with If-None-Match,
If-Modified-Since or Range. Local keeps existing static cache settings/no-token path.

Retain JSON sidecar exclusion and SVG CSP/nosniff in both modes; inspect single-decoded
case-normalized path, reject malformed escapes/NUL/backslash and encoded separators,
deny `.json` regardless of encoded dot/case. Verify resolved file is inside real
generated root, permitting normal nested media but rejecting symlinks outside it;
no user path in errors. Reuse the realpath-containment pattern in
`lib/videoFrameExtract.ts:30` without imposing its basename/MP4-only contract on images.
Do not claim this stops a malicious local filesystem writer's TOCTOU race.
Previously cached public immutable media may remain readable for its old TTL; new
headers cannot revoke copies already stored by clients/proxies. Upgrade notes require
cache purge at operator-controlled proxies and explain logout/restart cannot recall
downloads. Never automatically delete/rename user files or claim retroactive privacy.

## 5. Exact implementation signatures and diff manifest

Proposed signatures (not present yet):

```ts
// lib/localAccessPolicy.ts — pure parsing/decision; no DNS/network lookup
export function parsePublicOrigins(value: unknown): readonly string[];
export function createLocalAccessPolicy(config: AppConfig): {
  resolveOrigin(req: Request): string; // fixed-code error on rejection
  checkBrowserRequest(req: Request, origin: string, viaCookie: boolean): void;
};
// lib/lanSessionStore.ts
export function createLanSessionStore(options: {
  ttlMs: number; maxSessions: number; now?: () => number;
  randomBytes?: (size: number) => Buffer;
}): {
  issue(origin: string): { value: string; expiresAt: number };
  validate(value: string, origin: string): { expiresAt: number } | null;
  track(value: string, close: () => void): () => void;
  revoke(value: string): void;
  dispose(): void;
};
// lib/localLanAccess.ts — shared instance for routes + guard + media
export function createLocalLanAccess(ctx: RuntimeContext): {
  guard: RequestHandler;
  registerSessionRoutes(app: Express): void;
  dispose(): void;
};
// bin/lib/client.ts — additive transport, existing public exports preserved
export async function fetchServer(base: string, pathOrUrl: string,
  init?: RequestInit): Promise<Response>;
export async function fetchServerUrl(url: string, init?: RequestInit): Promise<Response>;
// ui/src/lib/lanSession.ts
export function bootstrapLanSession(): Promise<{mode:"local"|"lan";authenticated:boolean}>;
export function createLanSession(token: string): Promise<void>;
export function endLanSession(): Promise<void>;
```

| Action / exact path | Diff-level implementation |
|---|---|
| NEW `lib/localAccessPolicy.ts`, `lib/lanSessionStore.ts`, `lib/localLanAccess.ts`, `lib/generatedMediaAccess.ts` | Implement policies above as focused owners, each <400 lines/functions <50; no new auth framework. Auth instance owns finite throttle/store and parsed cookie, mounted once. |
| MODIFY `server.ts` | Replace live inline guard with shared access instance; register session endpoints before general auth/body parser, with their own policy and 1KB parser. Then general guard → existing body parsers → UI/generated/routes. Guard every canonical API/media mount; reject encoded mount aliases instead of falling through static. Retain exported isLoopbackHost/assertLanAccessConfiguration/createLanApiGuard compatibility wrappers; wrapper delegates token-only guard policy, production uses shared instance. Wire dispose to server close, not a singleton across apps. Root security headers precede static. |
| MODIFY `config.ts`, `lib/configKeys.ts`, `bin/commands/config.ts` | Add publicOrigins and fixed security bounds. Add only publicOrigins to writable keys/KEY_TO_ENV; validate set before save with shared pure parser, same validation on startup. No LAN-token file persistence/write support is added. |
| MODIFY `ui/src/main.tsx`, NEW `ui/src/lib/lanSession.ts`, `ui/src/components/LanSignIn.tsx` | Await bootstrap before App dynamic import; conditional canonicalization; safe accessible sign-in and reauth boundary. Keep theme startup and no layout redesign. |
| MODIFY `ui/src/lib/api-core.ts`, `ui/src/lib/eventChannel.ts`, `ui/index.html`, `ui/vite.config.ts` | Fixed-code reauth dispatch; native SSE status/reconnect handling; referrer meta before resource preload; explicit dev Host preservation. No query-token appending to media. |
| MODIFY `bin/lib/client.ts`, `bin/lib/output.ts`, `bin/commands/ping.ts` | Destination-scoped token transport and auth-aware discovery; auth error exit 4 and JSON code; sanitized target validation errors, no cookie jar. |
| MODIFY `bin/lib/sse.ts`, `bin/lib/mcpJob.ts`, `bin/lib/characterResolve.ts`, `bin/lib/videoMcp.ts` | Replace first-party raw fetch with fetchServer/fetchServerUrl; no change to SSE parsing/cursor/job behavior. |
| MODIFY `bin/commands/gen.ts`, `bin/commands/video.ts`, `bin/commands/upscale.ts`, `bin/commands/service.ts` | Auth for first-party downloads, video raw POST/GET and service health. External returned-media URLs, if retained, use separate credential-free fetch; never prefix/forward server token to them. |
| NEW `tests/local-lan-policy.test.ts`, `tests/lan-session.test.ts`, `tests/lan-media-access.test.ts`, `tests/cli-lan-auth.test.ts`, `tests/lan-config.test.ts` | Complete backend/CLI negative and compatibility gates in §6. |
| MODIFY `tests/backend-input-lan-hardening.test.ts`, `tests/generated-static-privacy.test.ts`, `tests/cli-config-keys-contract.test.js` | Retain baseline token wrappers/local contracts; add cumulative guards. |
| NEW `ui/e2e/j9-lan-security.spec.ts`; MODIFY `ui/e2e/fixtures/appServer.ts` | Reuse WP09 isolation, add LAN options and in-test synthetic TLS proxy; no unnamed new fixture/helper file. All new test paths are explicitly mapped here. |
| MODIFY `.env.example`, `docs/DOCKER.md`, `docs/API.md`, `docs/CLI.md`, `docs/FAQ.md` | Public origins/env examples, browser/CLI auth, HTTP/TLS and cache-revocation limits, expiry/rotation, Vite setup; coordinate WP11, preserve localized advertised contracts with matching doc updates. |
| MODIFY `structure/01-file-function-map.md`, `structure/04-frontend-architecture.md`, `structure/06-infra-operations.md`, `docs/migration/runtime-test-inventory.md` | New owner/flow/verification inventory only. Emit JS through existing build commands; no hand-edited JS. |

Config chain: config parser creates normalized publicOrigins → file JSON stores
`server.publicOrigins` array through existing setNestedKey/saveFileCfg → startup
parses again → AppConfig inference/runtime context → policy → request origin and
cookie attributes. Config ls/get serialize array normally (it contains no secret);
invalid inputs must not be echoed because a rejected URL may contain credentials.
No field in UI settings/health/advertise is needed. Tests cover env precedence,
round-trip/rm/default and invalid file/env startup rejection. Security bounds appear
in effective config only; cannot be written via config CLI or overridden by file.
`localAccessPolicy.ts` must use type-only AppConfig imports (no config singleton
import) so config.ts can reuse its pure parser without a runtime import cycle.
Lifecycle wiring (R1-11): put the idempotent access disposer in a typed
`app.locals.disposeLocalLanAccess` slot. In startServer's existing onShutdown
callback, invoke it BEFORE awaiting shutdownServerAndMcp/HTTP server.close, after
stopping owned worker/proxy timers. It revokes cookie sessions, closes their active
responses and clears its own expiry timer. Also register HTTP close-event disposal
as an idempotent fallback, NOT the primary trigger: an open SSE response can prevent
the close event that was supposed to dispose it.
BuildApp-only fixture teardown likewise invokes this callback BEFORE server.close;
no change to buildApp's Express return signature or new process-global store.

Exact source insertion in server.ts's onShutdown before `await shutdownServerAndMcp`:
```ts
app.locals.disposeLocalLanAccess();
```
The slot is initialized for local and LAN app instances (local disposer is safe
and idempotent), so no optional-chain silent omission. Existing DB/MCP/proxy shutdown
order and grace deadline otherwise remain. Normal generation is not retried/aborted
merely because browser sessions are revoked; WP07 lifecycle remains its owner.

Add integration case in tests/lan-session.test.ts: bootstrap a valid session on an
isolated app, open its authenticated SSE and receive a heartbeat/event, begin the
real app teardown path, assert disposer closes that response BEFORE server close
callback resolves, no grace-timeout fallback required. Repeat disposal safely and
assert timer/response registry empty. A store.dispose spy alone is insufficient.
Localized existing token-start instructions to update explicitly:
`docs/DOCKER.zh-CN.md`, `docs/DOCKER.zh-TW.md`; cross-link canonical API/CLI additions
instead of inventing untranslated claims of full LAN confidentiality in other files.

### CLI target binding, signatures and migration details

Use **existing `IMA2_LAN_TOKEN` env only**, paired with explicit `--server` or
`IMA2_SERVER`. No new token flag (argv/shell history) or writable secret config key.
Resolve precedence: --server then IMA2_SERVER; explicit target must be a normalized
HTTP(S) origin without userinfo/query/hash/non-root path, else safe
`SERVER_URL_INVALID` before network. This intentionally refuses secret-bearing
`--server` URLs; legacy API `?token` is still supported at HTTP boundary, not CLI base.

`resolveServer({serverFlag})` and `findRunningServer({includeEnv})` retain signatures.
Internally select one authorized origin before health probe; retain only in-process
origin→env-token binding, never include token in returned `{base,health}`. Reset binding
when resolving a different target. Auto-discovery (advertise/default ports) probes
**without** the env token unless it is the explicitly selected origin; do not send
one secret to arbitrary advertise-file origins/port fallbacks. If discovery meets
401, report `LAN_TOKEN_REQUIRED`/exit 4 with instruction to specify known server and
env token; do not continue to a different healthy instance or say offline. Explicit
target network failure stays `SERVER_UNREACHABLE`/exit 3, no fallback. HTTP 403 reports
`LOCAL_ORIGIN_REJECTED` or `LOCAL_HOST_REJECTED`, not server offline; unknown forbidden
body maps safe `SERVER_ACCESS_DENIED`, exit 4. `ping --json` adds stable code.

`request(base,path,options)` delegates fetchServer; fetchServer canonicalizes URL and
requires URL.origin === base.origin. fetchServerUrl (SSE absolute URL convenience)
adds env token only for the currently bound origin; unrelated origins receive none.
Both force redirect:error (a 3xx yields safe `SERVER_REDIRECT_REJECTED`), credentials:
omit, preserve signal/body/normal headers, and reject caller-supplied cookie/token
conflicts rather than forwarding ambiguous auth. When no binding exists, no env
credential is attached. CLI code must never use query tokens for these helpers.
Neither helper may establish a binding from its url/base argument or discover an
env target implicitly. Only explicit target selection in resolveServer/findRunningServer
may do that; `includeEnv:false` clears any previous binding. Before binding, and
after selection fails or changes, arbitrary fetchServerUrl remains credential-free.
All first-party raw callsites listed above require tests; optional external artifact
download branch is credential-free and not “secured egress” proof.
Long-lived stream responses terminate on server rejection; distinguish auth error
from parse failure/retry; never automatically repeat a generation POST on reauth.

Raw-fetch audit (`rg -n '\bfetch\s*\(' bin --glob '*.ts'`, baseline: 17 calls):

| Baseline callsites | Exact disposition / assertion in cli-lan-auth.test.ts |
|---|---|
| `bin/lib/client.ts:29`, `:97` | Selected health and request use fetchServer; auth rejection never erased into offline. |
| `bin/lib/sse.ts:101` | GET/POST stream opener uses fetchServerUrl; fresh/unbound URL cannot inherit secret; preserve abort/headers. |
| `bin/lib/mcpJob.ts:85`, `:213` | Submit and inflight recovery use fetchServer; reconnects use existing SSE owner; no re-submit on 401. |
| `bin/lib/characterResolve.ts:18` | Asset lookup uses fetchServer with the resolved origin. |
| `bin/commands/video.ts:254`, `:275`, `:369`, `:375`, `:400` | edit/extend/frame POST/frame GET/analyze use fetchServer; preserve methods/bodies/file-position query/abort. |
| `bin/commands/gen.ts:254`, `bin/commands/upscale.ts:107`, `bin/lib/videoMcp.ts:208`, `:332` | First-party media uses fetchServer; normalize returned URL before origin comparison, never blindly concatenate or forward auth cross-origin. |
| `bin/commands/video.ts:87` | Same-origin returned media uses fetchServer; existing absolute external branch stays token/cookie-free with redirect:error, no inherited init headers. Preserve non-auth signed query parameters; never add LAN query token. |
| `bin/commands/service.ts:115` | Advertise-only polling uses credential-free fetchServerUrl. With explicit IMA2_SERVER, select/validate once before polling and bind only that origin; unrelated advertised origin never gets token. On 401 return actionable auth error immediately, not timeout/offline. |

Also inspected indirect `bin/lib/doctor-providers.ts:150` fetchImpl: provider key
verification stays WP10 and **never** calls first-party token transport. Repeat raw
and indirect fetch inventory on the cumulative B tip; any new first-party call must
have a disposition/test before C. This is not permission to edit provider code.
Public-media **query compatibility** means `/generated/file?token=valid` still works
without cookie/header, with private no-store, while missing/invalid/duplicate token
fails and an explicit bad token cannot fall back to a valid cookie. This is manual
HTTP compatibility, not anonymous publication: UI/CLI emit token-free media URLs.

## 6. Behavioral acceptance and bounded verification

New tests must fail on baseline for their intended behavior; no source-grep-only
security oracle. Every fixture uses synthetic values, per-process temporary DB/config/
generated paths, cleared credential env and WP09 fail-closed egress. No production
boot, key detection, actual OS open/stop or real provider calls. Existing 006 receipts
are baseline only (23 serial tests and 1 LAN privacy test), not wp12s evidence.

| Test file / scenario | Independent behavioral oracle |
|---|---|
| NEW `tests/local-lan-policy.test.ts` | Host: direct loopback/LAN IPv4/IPv6 and actual fallback port accepted; hostile domain/malformed/duplicates/wrong port rejected. Exact publicOrigin supports HTTPS proxy/Docker NAT; forwarded headers cannot grant trust. Same-origin works, sibling/null/foreign Origin and bodyless hostile POST denied before spy handler. Vite preserved Host+explicit origin works; undeclared Vite origin fails clearly. |
| NEW `tests/lan-session.test.ts` | POST without token, wrong token with valid cookie, cookie-only/query-only bootstrap, duplicates, oversize and form body denied; correct token returns opaque non-token cookie with exact flags/no body. HTTP vs HTTPS flags differ as designed. Clock-driven expiry/revoke/restart fail; session capacity/throttle bounded; active response close spies called on revoke/expiry; malformed cookies fail closed. |
| MODIFY `tests/backend-input-lan-hardening.test.ts` | Original token/loopback/startup negatives stay; LAN loopback peer still requires auth; narrow callback exception with state rejection, all other API routes denied. Session status has no side effects/config values. General guard denies encoded mount aliases. |
| MODIFY `tests/generated-static-privacy.test.ts`; NEW `tests/lan-media-access.test.ts` | Synthetic png/mp4/svg + nested media: anon GET/HEAD/Range/conditional all 401; valid cookie/header produces bytes, HEAD and 206. Cache headers never public/immutable; no unauthenticated 304/existence leakage. Literal/encoded/case JSON, traversal, symlink-outside and SVG script policy assertions. Local media/cache behavior retained. |
| NEW `tests/cli-lan-auth.test.ts` | Two fake servers: only explicitly selected origin gets token for health/API/SSE/download. Wrong/missing auth yields exit4/code vs refused socket exit3; do not probe fallback after auth denial. 302 to second server is not followed. Explicit external artifact request receives no token/cookie. stdout/stderr/JSON/errors exclude exact synthetic bearer. Exercise raw CLI callsites, not only helper. |
| NEW `tests/lan-config.test.ts`; MODIFY `tests/cli-config-keys-contract.test.js` | publicOrigins env/file/default, strict invalid rejection/CLI round-trip, config rm; immutable security bounds ignore override. No newly writable secret key. Test config CLI with malicious URL userinfo sentinel; no value printed on rejection. |
| NEW `ui/e2e/j9-lan-security.spec.ts` | Isolated LAN-config app + page ?token: token removed before first app request, no local/sessionStorage token, document.cookie excludes session. Native fetch/EventSource/img/video/Range work after bootstrap; reload works, localhost stays same in LAN; local canonical behavior preserved. Bad token/login/expiry/logout stop SSE and show accessible sign-in; reauth never resubmits a job. Hostile-origin page fails bodyless mutation; direct media without cookie fails. |
| Same e2e plus TLS proxy fixture | Synthetic local TLS origin verifies Secure/Strict cookie and browser media/SSE; no SSL-ignore production code. Proxy Host preservation and Docker changed-port origin tested. Native range behavior and negative cookie tests cannot be replaced by mocked browser headers alone. |
| WP10 shared log/diagnostic corpus | Auth requests, failed token, cookie, URL bootstrap and rejected Origin/config inputs never emit exact sentinels; request logs stay path-only. Use WP10 sanitizer, do not add a second generic scrubber. |

Adversarial cases are mandatory in the named suites: cooldown exactly 10 failures,
window expiry/Retry-After, map saturation/pruning, concurrent issuance at capacity,
duplicate random session IDs (retry boundedly; never overwrite), and disposal timers.
Policy tests add default-port normalization, mapped IPv6, duplicate raw Host/Origin,
explicit HTTPS overriding inferred HTTP, same-authority scheme conflict and spoofed
forwarded headers. Media tests add valid query auth and invalid-query+valid-cookie.
CLI tests assert zero token on unbound/switch-failed origins and fresh service polling.

Future C commands: `npm run typecheck`, `npm run typecheck:tests`, `npm run
test:inventory`; focused `node --import tsx --test --test-concurrency=1` with above
new/modified backend tests after implementation. `npm run ui:build`, existing
build:server/build:cli and the installed/generated-CLI counterparts run on isolated
CI/approved remote host. Existing Playwright runner from WP09 runs j9 plus cumulative
WP12 journeys; screenshots must show synthetic data and never token URL/input.
CI/full suite remains parent-owned, exact-tip required. A must reject missing native
browser cookie/Range/SSE, CLI raw-callsite or hostile-origin negative evidence.

P verification this turn: re-read current source owners/callsites and neighboring
WP09/10 contracts, checked document paths/whitespace; no implementation test was
created or run, no runtime fix/security completion is claimed. Main coordinates the
agreed WP10 shared-redaction expansion; require its synthetic corpus receipt before
claiming URL-secret safety. Download residuals remain separately tracked, not fixed here.

## 7. Rollback and release/migration contract

No user schema/media migration. New sessions exist only in memory and expire on
rollback/restart. Optional publicOrigins is ignored by old versions; rolling back
the protection **re-exposes LAN media**, so rollback deployment must first disable
external ingress or bind loopback. Never offer an insecure media-public feature flag
as rollback. Restore previous app artifacts only with matching docs/security warning;
old browser cached media remains outside revocation control. Keep token env unchanged
unless operator explicitly rotates it; no secret copies in rollback artifacts.

Observable compatibility changes: LAN media now needs cookie/header/query auth;
shared naked URLs no longer publish private outputs; bootstrap adds short session
lifetime; known-target CLI env token is recognized; auth failures are distinct from
offline; hostile origins denied; named/NAT/proxy origins need exact configuration;
Vite Host behavior and required explicit origin are documented. No blanket loss of
LAN IP, localhost, CLI, Docker or remote token support. Existing token API semantics,
local single-user operation, MCP OAuth state callback and admin nonce survive.

WP13 release gate consumes **post-wp12s** exact-tip cumulative tests and visual
receipts, not pre-security WP12 screenshots alone. This document supplies the design;
parent registers/enforces the release criterion and controls merge/release actions.
