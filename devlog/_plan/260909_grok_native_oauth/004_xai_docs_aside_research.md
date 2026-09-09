---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, docs-x-ai, aside, research]
---

# 004 — xAI 공식 문서·progrok 원본 조사 (Aside exec, 2026-09-09)

# xAI OAuth access to `api.x.ai` for CLI tools — research notes

Read-only research. No logins, no form submissions, no site-state changes.
Compiled 2026-09-09 (Asia/Seoul).

**Method:** `https://docs.x.ai/sitemap.xml` lists 183 pages; every page is available as
Markdown by appending `.md` (stated at `https://docs.x.ai/llms.txt`). All 183 `.md` pages
were fetched and grepped for `oauth`, `grok-cli`, `device code`, `refresh_token`,
`expires_in`, `SuperGrok`, and `Bearer`. The progrok repo was read via raw.githubusercontent.com.

---

## 0. Headline finding

**xAI's public developer documentation does not document OAuth as an access path to
`https://api.x.ai`.** It documents OAuth only for signing in to the *Grok Build CLI*, whose
inference traffic goes to a different host (`cli-chat-proxy.grok.com`). Every `api.x.ai`
example in the docs authenticates with `Bearer $XAI_API_KEY`.

The OAuth-to-`api.x.ai` behavior described in the task (client `grok-cli`, scope
`grok-cli:access api:access`, device grant at `https://auth.x.ai/oauth2/device/code`) is
**verifiable from xAI's live OIDC discovery document and from the progrok source**, but is
**not described in prose anywhere on docs.x.ai**. Treat it as undocumented-but-real
infrastructure, not a supported public contract.

---

## 1. What xAI's OIDC discovery document actually exposes

Source: <https://auth.x.ai/.well-known/openid-configuration> (HTTP 200, fetched read-only)

| Field | Value |
| --- | --- |
| `issuer` | `https://auth.x.ai` |
| `authorization_endpoint` | `https://auth.x.ai/oauth2/authorize` |
| `token_endpoint` | `https://auth.x.ai/oauth2/token` |
| `device_authorization_endpoint` | `https://auth.x.ai/oauth2/device/code` |
| `revocation_endpoint` | `https://auth.x.ai/oauth2/revoke` |
| `userinfo_endpoint` | `https://auth.x.ai/oauth2/userinfo` |
| `grant_types_supported` | `authorization_code`, `refresh_token`, `urn:ietf:params:oauth:grant-type:device_code` |
| `token_endpoint_auth_methods_supported` | `client_secret_basic`, `client_secret_post`, `none` (public client OK) |

`scopes_supported` includes both scopes named in the task, plus many more:

```
openid, profile, email, offline_access, grok-cli:access, team:read, teams:read,
teams:write, org:read, orgs:read, orgs:write, api:access, grok-plugins:access,
conversations:read, conversations:write, workspaces:read, workspaces:write,
api-keys:read, api-keys:write, logs:read, billing:read, billing:write
```

This confirms, from xAI's own server:
- the device code grant exists at exactly `https://auth.x.ai/oauth2/device/code`;
- `refresh_token` is a supported grant;
- `grok-cli:access` and `api:access` are both real, advertised scopes;
- `none` auth method means a public client with no secret is supported (which is what a CLI needs).

The discovery document does **not** state token lifetimes, rotation policy, which
`api.x.ai` routes accept the token, or which subscription tier is required. Those are not
published.

---

## 2. What docs.x.ai says about OAuth (and what it does not)

### 2.1 The only substantive OAuth-for-CLI page

Source: <https://docs.x.ai/build/enterprise.md> (rendered: <https://docs.x.ai/build/enterprise>)

Network requirements table lists `auth.x.ai` as **required**, purpose "OAuth2/OIDC
authentication", and `cli-chat-proxy.grok.com` as **required**, purpose "Inference proxy,
settings".

Critically, `api.x.ai` is listed under **Additional** hosts, i.e. optional:

> | `api.x.ai` | xAI API (direct API-key path) | Only needed when using `api_key` auth instead of the inference proxy |

This is the strongest statement in the docs on the question: xAI frames `api.x.ai` as the
**API-key path**, and routes its own OAuth-authenticated CLI to `cli-chat-proxy.grok.com`
instead. It does not say OAuth tokens are rejected at `api.x.ai`; it says the CLI does not
need that host when using session auth.

Same page, four supported session authentication methods:

> | Method | Trigger | Refreshable | Best for |
> | Browser OIDC | `grok login` (default) | Yes | Interactive terminals with a browser |
> | Device code | `grok login --device-auth` | Yes | SSH sessions, containers, headless hosts |
> | External auth provider | `auth_provider_command` in config | Yes | Corporate IdPs, custom token brokers |
> | API key | `XAI_API_KEY` env var or `model.api_key` in config | No | Scripts, CI/CD, headless automation |

Device code section (same page):

> For environments without a browser (SSH, containers, cloud devboxes), device code login
> follows **RFC 8628**: `grok login --device-auth`. Grok prints a URL and a short user
> code. Complete login on any device with a browser.

Enterprise OIDC section (same page):

> The flow uses PKCE and supports `refresh_token` grants for automatic renewal.

Note this sentence is about *enterprise/customer IdP* configuration (`GROK_OIDC_ISSUER`,
`GROK_OIDC_CLIENT_ID`), not about xAI's own `auth.x.ai` client.

The `expires_in` mention on this page is likewise **not** about xAI's token lifetime. It
specifies the contract for a customer-supplied external auth binary:

> The command must print either a bare token string or JSON:
> `{"access_token": "...", "refresh_token": "...", "expires_in": 3600}`
> (`refresh_token` and `expires_in` are optional).

The `3600` there is an illustrative example in a config schema for a *third-party* token
broker. **It is not a documented xAI access-token lifetime.** Do not cite it as one.

### 2.2 CLI reference

Source: <https://docs.x.ai/build/cli/reference.md>

> `grok login` | Sign in. `--device-auth` uses device-code authentication for headless or remote environments

> `--oauth` | Use OAuth when the welcome screen starts authentication

### 2.3 The single place docs.x.ai admits OAuth tokens work on `api.x.ai`

Source: <https://docs.x.ai/developers/rest-api-reference/inference/other.md>

> ## GET /v1/me
> Get information about the currently authenticated caller.
> **Works with both API keys and OAuth tokens.** Returns identity, team, and ZDR status.

The response schema carries a dedicated OAuth object:

> * `oauth` (object)
>   * `client_id` (string, required) — The OAuth `client_id` of the application.

This is the only endpoint on the entire docs site explicitly documented as accepting an
OAuth token. It proves the `api.x.ai` gateway understands OAuth bearer tokens and can
attribute them to an OAuth `client_id` — but the statement is scoped to `/v1/me` only.

### 2.4 Searches that returned nothing

- **`grok-cli`** — 1 hit across 183 pages, and it is a false positive: a Voximplant product
  link `grok-client` on <https://docs.x.ai/developers/model-capabilities/audio/voice.md>.
  The OAuth client name `grok-cli` and the scope string `grok-cli:access` appear **nowhere**
  on docs.x.ai.
- **`auth.x.ai`** — appears on exactly one page, `build/enterprise.md` (§2.1).
- **device code / device_authorization** — only `build/enterprise.md` and
  `build/cli/reference.md`, both about the `grok` CLI, neither giving the endpoint URL.
- **`refresh_token`** — only `build/enterprise.md` (enterprise IdP + external provider
  contract) and `grok/connectors/salesforce.md` (unrelated: Salesforce connector OAuth).
- **`expires_in`** — only `build/enterprise.md`, in the external-provider JSON example.
- **No page** states a refresh token lifetime, rotation policy, or reuse-detection behavior
  for `auth.x.ai`.
- **No page** states that OAuth tokens are restricted to SuperGrok subscribers.

---

## 3. Per-endpoint: are OAuth access tokens accepted as Bearer on `api.x.ai`?

**Documented answer from xAI: only `/v1/me` is stated to accept OAuth tokens.** For every
other endpoint asked about, the docs are silent on OAuth and show only API-key examples.

| Endpoint | What docs.x.ai says | Source |
| --- | --- | --- |
| `POST /v1/images/generations` | No OAuth mention. All examples `Authorization: Bearer $XAI_API_KEY` | <https://docs.x.ai/developers/rest-api-reference/inference/images.md> |
| `POST /v1/videos/generations`, `/edits`, `/extensions`, `GET /v1/videos/{request_id}` | No OAuth mention. All examples `Bearer $XAI_API_KEY` | <https://docs.x.ai/developers/rest-api-reference/inference/videos.md> |
| `GET /v1/models` | No OAuth mention. Described as "List all models available to **the authenticating API key**" | <https://docs.x.ai/developers/rest-api-reference/inference/models.md> |
| `POST /v1/responses` (+ `/compact`, `GET`/`DELETE` by id) | No OAuth mention. All examples `Bearer $XAI_API_KEY` | <https://docs.x.ai/developers/rest-api-reference/inference/responses.md> |
| `GET /v1/me` | **"Works with both API keys and OAuth tokens."** | <https://docs.x.ai/developers/rest-api-reference/inference/other.md> |

The global auth statement covering all of the above:

> | Inference (responses, chat completions, embeddings, images, videos, voice, files, batches, models) | `https://api.x.ai` | `Authorization: Bearer <xAI API key>` |

Source: <https://docs.x.ai/developers/rest-api-reference/inference.md>

And the error table:

> **401 Unauthorized** | All endpoints | No authorization header or an invalid authorization
> token was provided. | Supply an `Authorization: Bearer <XAI_API_KEY>` header.

Source: <https://docs.x.ai/developers/debugging.md>

**Empirical counter-evidence (third party, not xAI):** progrok's README reports live
requests to `/v1/videos/generations`, `/v1/videos/edits`, `/v1/videos/extensions` and image
endpoints succeeding with an OAuth session — e.g. "T2V, I2V, R2V on `grok-imagine-video` |
Passed, `status: done`" and "live OAuth smoke returned `Text-to-video is not supported for
this model`" (a model-capability error, not an auth error), at
<https://github.com/lidge-jun/progrok/blob/main/README.md>. That is observed runtime
behavior of an undocumented path, not a documented guarantee.

---

## 4. Token expiry, refresh lifetime, rotation

**Not documented by xAI.** No page on docs.x.ai states an `expires_in` value for
`auth.x.ai` tokens, a refresh-token lifetime, or whether refresh tokens rotate.

What can be said:

- `offline_access` is an advertised scope and `refresh_token` an advertised grant type, so
  long-lived refresh is intended by design. Source:
  <https://auth.x.ai/.well-known/openid-configuration>
- The only concrete `3600` in xAI's docs is the external-auth-provider JSON example
  (<https://docs.x.ai/build/enterprise.md>), which describes a **customer's** token broker,
  not xAI's issuer. Citing it as "xAI access tokens last 1 hour" would be wrong.
- progrok's client code **handles rotation defensively**: it persists a new
  `refresh_token` if the refresh response returns one, and otherwise keeps the existing
  one — implying rotation is possible but not guaranteed. See §7.4.
- progrok's test suite uses `expiresIn: 3600` as fixture data only
  (<https://github.com/lidge-jun/progrok/blob/main/tests/auth.test.ts>, lines 92-97). This
  is a test constant, not an observation of xAI's real value.

**Conclusion: the typical `expires_in` is unverified.** I found no authoritative source for
it; the plausible-looking `3600` figures both come from non-authoritative contexts.

---

## 5. Rate limits: OAuth session vs API key

**xAI documents two entirely separate quota systems, and never reconciles them.**

**API-key path — per-team tiers by cumulative spend.** Source:
<https://docs.x.ai/developers/rate-limits.md>

> Every xAI API team has per-model rate limits on two dimensions: **requests per second
> (RPS)** and **tokens per minute (TPM)** … These limits scale with your team's **tier**,
> which is determined by cumulative spend on the API.

Tiers: Tier 0 ($0) → Tier 1 ($50) → Tier 2 ($250) → Tier 3 ($1,000) → Tier 4 ($5,000) →
Enterprise. Example per-model caps: `grok-4.6` T0 150 RPS / 50M TPM up to T4 500 RPS / 100M
TPM; `grok-imagine-image` T0 6 RPS → T4 100 RPS; `grok-imagine-video` T0 10 RPS → T4 158 RPS.
Exceeding returns `429 Too Many Requests`.

> Rate limit tiers apply to text and embedding models. For increases to Voice and Imagine
> API limits, contact sales@x.ai.

**Subscription path — one shared weekly usage pool.** Source:
<https://docs.x.ai/grok/faq.md>

> Instead of separate daily limits for each product (like Chat, Imagine, Voice, or Build),
> you get one shared weekly usage pool that you can spend however you like across any Grok
> product.

> A percentage breakdown by product (**API**, Build, Chat, Imagine, Voice).

That parenthetical is the most relevant line in the whole docs set for this question: the
subscription usage meter has an **"API"** category alongside Build/Chat/Imagine/Voice,
which is consistent with account-session-authenticated API usage being metered against the
weekly subscription pool rather than against the spend-based API tier ladder. xAI does not
say this explicitly, so treat it as a strong hint, not a documented rule.

> Different products cost different amounts depending on how much compute that product
> requires… The usage pool limit resets every week on a schedule shown in the Usage tab in
> Settings.

**No page compares OAuth-session limits to API-key limits directly.**

Third-party corroboration that OAuth is subject to account-side limits rather than API
tiers, from progrok's README:

> These commands call xAI directly with OAuth and may be subject to product access, rate
> limits, quota, and account capability.

and a live rejection tied to account entitlement, not tier:

> `1080p` | Failed for this team: `1080p video resolution is not available for your team`

Source: <https://github.com/lidge-jun/progrok/blob/main/README.md>

---

## 6. Statements that OAuth tokens require a SuperGrok subscription

**xAI: no such statement exists.** The string "SuperGrok" appears on 9 docs pages, all in
consumer product context (billing, cancellation, refunds, weekly usage limits, Grok Bot,
mobile) — never in connection with OAuth, `auth.x.ai`, or `api.x.ai`. Sources:
<https://docs.x.ai/grok/faq.md>, <https://docs.x.ai/grok/overview.md>,
<https://docs.x.ai/grok/user-guide.md>, <https://docs.x.ai/grok/management.md>,
<https://docs.x.ai/grok-bot/get-started.md>, <https://docs.x.ai/grok-bot/faq.md>,
<https://docs.x.ai/grok-bot/mobile.md>, <https://docs.x.ai/grok-bot/teams-and-enterprises.md>,
<https://docs.x.ai/integrations/hubspot-mcp-setup.md>.

**The SuperGrok requirement is asserted only by progrok, not by xAI:**

> Requires an active SuperGrok subscription. progrok does not bypass xAI account access,
> quotas, pricing, or product limits.

Source: <https://github.com/lidge-jun/progrok/blob/main/README.md>

> Log in to xAI via OAuth (SuperGrok subscription required).

Source: <https://github.com/lidge-jun/progrok/blob/main/src/commands/login.ts> (the `login`
command's `.description(...)` string)

> Log in with your xAI account (SuperGrok subscription required).

Source: <https://github.com/lidge-jun/progrok/blob/main/docs/api.md>

---

## 7. progrok implementation details

Repo: <https://github.com/lidge-jun/progrok> — "Use Grok models for free via OAuth proxy.
No API key needed.", public, default branch `main`, MIT.

### 7.1 Client ID constant

Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/constants.ts>

```ts
// xAI shared OAuth Client (same as hermes-agent & openclaw — MIT licensed)
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
```

**Client ID: `b1a00492-073a-47ea-816f-4c329264a828`** — a UUID, not the literal string
`grok-cli`. The `grok-cli` identity enters through the **scope** `grok-cli:access`, which
progrok requests together with `api:access`. The comment attributes the client to
hermes-agent and openclaw; the README elaborates:

> progrok's OAuth client attribution comes from Hermes Agent and OpenClaw under their MIT
> licenses.

Other constants from the same file:

| Constant | Value |
| --- | --- |
| `XAI_OAUTH_CALLBACK_HOST` / `PORT` / `PATH` | `127.0.0.1` / `56121` / `/callback` |
| `XAI_OAUTH_REDIRECT_URI` | `http://127.0.0.1:56121/callback` (comment: "MUST match registered redirect URI") |
| `XAI_OAUTH_CORS_ORIGINS` | `["auth.x.ai", "accounts.x.ai"]` |
| `XAI_OAUTH_TIMEOUT_MS` | `5 * 60 * 1000` (5 min) |
| `XAI_OAUTH_FETCH_TIMEOUT_MS` | `30 * 1000` |
| `XAI_DEVICE_CODE_POLL_INTERVAL_MS` | `5 * 1000` |
| `XAI_API_BASE_URL` | `https://api.x.ai/v1` |
| `CONFIG_DIR` / `AUTH_FILE` | `~/.progrok` / `~/.progrok/auth.json` |
| `PROXY_DEFAULT_HOST` / `PORT` | `127.0.0.1` / `18645` |

### 7.2 Refresh skew

Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/constants.ts>

```ts
// Token refresh
export const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;
```

**Refresh skew = 2 minutes (120,000 ms).** Applied in `getValidBearer()`:

```ts
if (
  tokens.expiresAt &&
  Date.now() + TOKEN_REFRESH_SKEW_MS >= tokens.expiresAt
) { /* refresh */ }
```

Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/token-store.ts>

Documented as: "The token is auto-refreshed ~2 minutes before expiry."
Source: <https://github.com/lidge-jun/progrok/blob/main/docs/api.md>

### 7.3 Exact `auth.json` fields

On-disk shape written by `saveTokens()`, file mode `0o600`, at `~/.progrok/auth.json`.
Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/token-store.ts>

```ts
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenEndpoint?: string;
  email?: string;
  idToken?: string;
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `accessToken` | string (required) | The OAuth bearer token |
| `refreshToken` | string, optional | From `refresh_token` |
| `expiresAt` | number, optional | Absolute epoch ms, computed as `Date.now() + expiresIn * 1000` — **not** the raw `expires_in` |
| `tokenEndpoint` | string, optional | Persisted from OIDC discovery, e.g. `https://auth.x.ai/oauth2/token` |
| `email` | string, optional | Decoded from the `id_token` JWT payload's `email` claim (base64url, second segment); malformed JWTs silently ignored |
| `idToken` | string, optional | Raw OIDC ID token |

Matching documented example (note: docs sample omits `idToken`):

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "expiresAt": 1780152218787,
  "tokenEndpoint": "https://auth.x.ai/oauth2/token",
  "email": "user@example.com"
}
```

Source: <https://github.com/lidge-jun/progrok/blob/main/docs/api.md>

The wire-format interface is kept separate from the on-disk one:

```ts
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  token_type?: string;
}
```

### 7.4 Refresh request and rotation handling

Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/token-store.ts>

```ts
body: new URLSearchParams({
  grant_type: "refresh_token",
  client_id: XAI_OAUTH_CLIENT_ID,
  refresh_token: tokens.refreshToken,
}),
```

Public-client refresh: `client_id` in the body, **no client secret**, posted as
`application/x-www-form-urlencoded` to the stored `tokenEndpoint` with a 30s timeout.

Rotation handling — keep the new refresh token if one comes back, otherwise reuse the old:

```ts
refreshToken:
  (typeof refreshed.refresh_token === "string"
    ? refreshed.refresh_token
    : undefined) || tokens.refreshToken,
```

Failure modes: non-OK response → `"Token refresh failed. Run \`progrok login\` again."`;
missing/non-string `access_token` → `"Token refresh returned invalid access_token…"`;
expired with no refresh token or no token endpoint → `"Token expired and no refresh token
available…"`. Note `saveTokens` on the refresh path does **not** pass `idToken`, so a
previously stored `idToken`/`email` is dropped after the first refresh.

### 7.5 Device code flow

Source: <https://github.com/lidge-jun/progrok/blob/main/src/auth/device-code.ts>

- Endpoint is **not hardcoded**: it comes from `fetchOIDCDiscovery()` →
  `device_authorization_endpoint`, which xAI's live discovery doc resolves to
  `https://auth.x.ai/oauth2/device/code`. If absent, it throws "xAI does not support device
  code flow via OIDC discovery".
- Device code request POSTs `client_id` + `scope` (form-encoded).
- Poll interval: `Math.max((dc.interval || 5) * 1000, XAI_DEVICE_CODE_POLL_INTERVAL_MS)` —
  server hint, floored at 5s.
- Deadline: `Date.now() + dc.expires_in * 1000`.
- Poll body: `grant_type: "urn:ietf:params:oauth:grant-type:device_code"` + `client_id` +
  `device_code`.
- RFC 8628 error handling: `authorization_pending` → continue; `slow_down` → extra 5s sleep
  then continue; anything else → throw. Timeout → "Device code expired. Please try again."

Endpoint trust is pinned in <https://github.com/lidge-jun/progrok/blob/main/src/auth/discovery.ts>:
every discovered endpoint must be HTTPS and its hostname must be `x.ai` or end in `.x.ai`,
else "OIDC discovery returned untrusted …".

### 7.6 How 401 is handled in the proxy

`src/commands/proxy.ts` is a thin commander wrapper — it only checks `loadTokens()?.accessToken`
exists before starting the server, then delegates to `startProxy()`.
Source: <https://github.com/lidge-jun/progrok/blob/main/src/commands/proxy.ts>

The actual handling is in `handleProxy()`.
Source: <https://github.com/lidge-jun/progrok/blob/main/src/proxy/server.ts>

**There is exactly one 401 in the proxy, and it is generated locally — never propagated
from upstream and never retried.**

```ts
let bearer: string;
try {
  bearer = await getValidBearer();
} catch (err) {
  res.status(401).json({
    error: { message: (err as Error).message, type: "auth_error" },
  });
  return;
}
```

Behavior, precisely:

1. **Local 401 only.** The proxy returns 401 solely when `getValidBearer()` throws — i.e.
   not logged in, token expired with no refresh token, or refresh failed. Body shape:
   `{ error: { message, type: "auth_error" } }`.
2. **Refresh is proactive, not reactive.** Renewal is driven entirely by the 2-minute skew
   check *before* the request goes out. There is no "upstream said 401 → refresh → replay"
   path anywhere in the file.
3. **Upstream 401s pass straight through.** `res.status(upstream.status)` forwards whatever
   `api.x.ai` returned verbatim. A 401 from xAI (e.g. a token revoked mid-session, or a
   route that rejects OAuth) reaches the client unmodified and untranslated.
4. **Client credentials are discarded.** `authorization` is in the `HOP_BY_HOP` deny set, so
   the caller's header is stripped, then `fwdHeaders["Authorization"] = \`Bearer ${bearer}\``
   is set. Confirmed by docs: "the proxy strips any `Authorization` header you send and
   replaces it with the stored OAuth bearer token."
5. Other statuses the proxy originates itself: **413** when the body exceeds
   `MAX_BODY_BYTES` (100 MB), and **502** `type: "upstream_error"` when `fetch` throws and
   headers were not yet sent.

Routing: `app.all("/v1/*")` → upstream `${XAI_API_BASE_URL}${relPath}${qs}`, i.e. every
`/v1/*` path including `/v1/images/generations`, `/v1/videos/*`, `/v1/models`, and
`/v1/responses`. Response body is streamed chunk-by-chunk (SSE-capable);
`content-encoding` and `content-length` are dropped from forwarded response headers. A
`/health` route returns `{"status":"ok","upstream":"xAI Grok","proxy":"progrok"}`. Binding
to `0.0.0.0`/`::` logs "⚠ Bound to all interfaces — your OAuth token is accessible on the
local network!".

---

## 8. Bottom line

| Question | Answer | Basis |
| --- | --- | --- |
| Does docs.x.ai document OAuth access to `api.x.ai`? | **No** — only `/v1/me` is stated to accept OAuth tokens | <https://docs.x.ai/developers/rest-api-reference/inference/other.md> |
| Does docs.x.ai mention `grok-cli` or `grok-cli:access`? | **No** (0 real hits in 183 pages) | full-site `.md` grep |
| Is the device endpoint real? | **Yes**, `https://auth.x.ai/oauth2/device/code` | <https://auth.x.ai/.well-known/openid-configuration> |
| Are `grok-cli:access` + `api:access` real scopes? | **Yes**, both in `scopes_supported` | same discovery doc |
| Is `refresh_token` supported? | **Yes**, in `grant_types_supported` | same discovery doc |
| Typical `expires_in`? | **Unverified.** Both `3600` sightings are non-authoritative | §4 |
| Refresh rotation policy? | **Undocumented.** progrok codes defensively for either case | §7.4 |
| OAuth Bearer on `/v1/images/generations`, `/v1/videos`, `/v1/models`, `/v1/responses`? | **Not documented by xAI**; all examples use `$XAI_API_KEY`. progrok reports live OAuth success on image/video endpoints | §3 |
| OAuth rate limits vs API key? | **Never compared.** API keys → spend-based tiers w/ RPS+TPM; subscriptions → one weekly pool with an "API" category | §5 |
| "OAuth is for SuperGrok subscribers" — does xAI say this? | **No.** Only progrok asserts it | §6 |
| Client ID constant | `b1a00492-073a-47ea-816f-4c329264a828` | `src/auth/constants.ts` |
| Refresh skew | **2 minutes** (`TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000`) | `src/auth/constants.ts` |
| `auth.json` fields | `accessToken`, `refreshToken?`, `expiresAt?`, `tokenEndpoint?`, `email?`, `idToken?` | `src/auth/token-store.ts` |
| Proxy 401 handling | Local-only 401 on `getValidBearer()` failure; **no retry-on-upstream-401**; upstream 401 passed through | `src/proxy/server.ts` |

**Risk note for ima2:** the OAuth→`api.x.ai` path is undocumented by the vendor. xAI's own
CLI deliberately sends OAuth-authenticated inference to `cli-chat-proxy.grok.com` and
describes `api.x.ai` as "the direct API-key path". An undocumented path carries no
compatibility promise and can be changed or closed without a release note. Also note that
because progrok never retries on an upstream 401, a token revoked mid-session surfaces as a
raw 401 to the calling client rather than triggering re-auth.
