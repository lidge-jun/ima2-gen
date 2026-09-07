# WP00 — Trust boundaries and security assumptions

Status: P research, not an A verdict or security certification. Independently
inspected 2026-09-05 on `codex/prod-wp00-roadmap`, baseline
`ecde2bc79cddc50ff0da38091c1ce0590383090c`. Only this file is owned by this lane.
Classification: docs-only work with C4-level care for security assumptions; parent
owns orchestration, WP registration and approval. No implementation, commit,
credential-content reads, production-server requests or paid upstream calls.

### Superseding production design decision (2026-09-05)

Main/user selected **private generated media in LAN mode**, preserving loopback
single-user access and documented remote token flow. New **wp12s**, after WP12 and
before WP13, is specified in `125_local_lan_security.md`: token-validated same-origin
HttpOnly cookie bootstrap, media auth/non-public caching, CLI token propagation and
bounded Host/Origin policy. The undecided-policy language and provisional new-WP
assignments below are historical P research, superseded by that concrete design;
they are not a renewed user-decision request. Current-source observations and test
receipts remain unchanged. Generic redaction stays WP10; download/DNS residuals
are not declared solved by wp12s and require explicit owning-WP acceptance.

## 1. Supported deployment and attacker model

- **Local-first, one trusted operator:** default bind is `127.0.0.1`
  (`config.ts:115`). Local processes able to contact that listener can call the
  API without a LAN token, even when a token is configured (`server.ts:249`).
  Browser IDs and session IDs are organization/correlation, not user identities:
  `ui/src/lib/api-core.ts:55`, `routes/health.ts:75`, `routes/events.ts:61`.
  The SSE bus broadcasts and replays all jobs to admitted clients; it is not a
  tenant-isolation mechanism. Do not introduce SaaS accounts/RBAC as a prerequisite.
- **Token-enabled LAN/container access is real scope:** `docs/DOCKER.md:23`
  advertises a token-bearing browser URL; `docs/DOCKER.md:28` requires non-loopback
  binding. `docs/API.md:90` and `docs/FAQ.md:206` explicitly describe remote/VM/
  container/network use. A LAN-token holder is effectively the same operator,
  not a less-privileged collaborator. Unauthenticated LAN peers are not trusted.
- **Browser origin is a separate boundary from TCP loopback:** malicious pages
  can attempt requests to local services. No global Origin/Host policy is visible
  in `server.ts:266`; CORS read restrictions alone are not a mutation policy.
  Browser/private-network protections vary and were not browser-tested here.
  Do not claim a proven cross-origin exploit solely from missing middleware.
- **Trusted configuration, untrusted provider output:** the operator chooses
  config/env endpoints; a provider response or reference is data, not permission
  to fetch any host or execute local commands. Attacker capabilities considered:
  anonymous LAN reachability, leaked bearer token, hostile browser page, poisoned
  provider/CDN response, malicious imported media and inherited test credentials.
  Arbitrary local filesystem/code execution already compromises the operator;
  that is not an anonymous-remote attacker assumption.
- **Assets/blast radius:** local generated/imported media and embedded metadata,
  prompts/history/session DB, provider credentials and billed generation authority,
  host filesystem/availability, diagnostics exported to issue trackers, test and
  release evidence. Images are sensitive user data, not disposable public assets
  (`005_delivery_baseline.md:74`). A shared LAN token does not create per-person
  ownership. Public internet hosting/TLS termination requires an explicit deployment
  contract; current examples use HTTP, not end-to-end encrypted LAN transport.

## 2. Verified guards and their exact limits

| Boundary | Current source behavior | Counterevidence / limit on the claim |
|---|---|---|
| Bind → API | `server.ts:235` refuses non-loopback without a token; `server.ts:486` calls it before listen at `server.ts:561`. `server.ts:242` uses equal-length timing-safe comparison. Guard precedes JSON parsing/routes (`server.ts:270`). | `buildApp` alone does not enforce startup refusal. The guard is disabled on loopback and covers `/api` paths, not the whole site. LAN tests pass, but are HTTP tests listening on loopback with LAN configuration, not a firewall/LAN network test. |
| API credential → admitted client | Header `x-ima2-token`, otherwise query `token`, at `server.ts:258`. Missing/wrong value yields 401. | No TTL, per-client revocation or token-strength check in this guard. Do not impose OAuth/JWT requirements on this shared secret by analogy. Query acceptance is compatibility behavior that needs leakage-aware handling. |
| OAuth callback exception | Only `/api/mcp/oauth/callback` is exempt (`server.ts:257`); missing state/code is 400 (`routes/mcpConnections.ts:130`). Pending state is deleted before validation/exchange; expiry and generation are checked (`lib/mcp/connectionManager.ts:234`); verifier plumbing exists in `lib/mcp/oauthProvider.ts:139`. | This is not evidence that every MCP path bypasses auth. State/PKCE is the documented alternate boundary (`docs/API.md:1018`); its full tests were not run in this lane. Preserve the narrow exception. |
| Administrative stop | Origin-bearing requests rejected; separate boot nonce and timing-safe match required (`routes/admin.ts:29`). Advertise file is created/re-chmodded 0600 (`server.ts:363`). | Disproves “any unauthenticated local browser can stop the server.” These checks are specific to stop, not inherited by all mutations. Do not copy/share the advertise file: it contains a kill-switch credential. |
| Media → browser | `/generated` is outside token guard. Literal `.json` suffix gets 404; SVG gets restrictive CSP and `nosniff`; static files are otherwise served (`server.ts:280`). Default cache age is one year (`config.ts:296`). | Existing privacy test positively expects MP4/SVG 200, sidecar 404 (`tests/generated-static-privacy.test.ts:15`). That test also passed with LAN configuration and no request token here. SVG mitigation prevents the specific active-document concern; it does not make media confidential. |
| Input → work/storage | Bounded request IDs, prompt/count rejection in `tests/backend-input-lan-hardening.test.ts:20`; Card News traversal/concurrency limits and realpath-aware asset deletion in `tests/backend-hardening.test.ts:26`. JSON limit defaults to 50mb (`config.ts:117`). | These are per-input controls, not comprehensive anonymous rate limits or aggregate memory limits. The deletion symlink test does not prove static serving rejects symlinks. SSE has its own capacity ceiling (`routes/events.ts:32`). |
| Health/diagnostics → caller | `/api/health` returns version/PID/ports and `ok: true`; `/api/providers` uses key presence/source rather than key bytes (`routes/health.ts:27`). LAN API guard applies. | `ok: true` is liveness, not provider readiness; runtime URLs are returned verbatim (`routes/health.ts:8`). `/api/oauth/status` actively fetches configured proxy models (`routes/health.ts:53`), unlike passive health. Do not silently add billable probes to readiness. |

### LAN/media contract decisions that block a broad readiness claim

1. **Token bootstrap is not implemented by a page URL alone.** Docker says open
   `/?token=…`, but `ui/src/lib/api-core.ts:1` forwards fetch arguments unchanged;
   `ui/src/lib/eventChannel.ts:37` builds only `/api/events` plus lastEventId.
   Repository search for `x-ima2-token`/`IMA2_LAN_TOKEN` found no UI/CLI transport
   implementation. `bin/lib/client.ts:25` probes health without auth, and its request
   helper only merges explicitly supplied headers (`bin/lib/client.ts:79`). Thus
   standard UI fetch/SSE and CLI discovery do not inherit the advertised page token.
   Source-confirmed compatibility gap; actual browser/installed-CLI reproduction
   remains a future acceptance test. Manual header-bearing API use does work, as
   the LAN test proves. Never “fix” this by bypassing API authentication.
2. **Generated-media confidentiality needs a product decision.** Any reachable
   client knowing a generated path can fetch it without a token, including LAN
   mode (fresh test below). No directory-listing/enumeration or arbitrary-file-read
   exploit is claimed. Filename unpredictability is not authorization. Preserving
   public media is an explicit risk acceptance requiring accurate documentation;
   protecting it requires a compatible image/video/SVG/Range/download flow rather
   than attaching an API header that `<img>` cannot send. Cache behavior and
   previously cached copies must be accounted for. Do not silently declare generated
   media public or remove LAN support to avoid the decision.
3. **Local browser policy remains unresolved:** other side-effect endpoints such as
   `routes/storage.ts:18` do not share admin-stop's Origin/nonce boundary. Scope an
   Origin/Host and bodyless-mutation negative matrix before claiming local HTTP
   endpoints safe against hostile pages. This is an open boundary question, not
   a verified High exploit. Keep same-origin UI, CLI and documented remote use working.

## 3. Configured endpoints, returned URLs and references

| Source of URL/data | Verified policy and ownership consequence |
|---|---|
| Operator config/env | Config loads environment then JSON at module import, including a package-local fallback (`config.ts:43`). NovelAI `IMA2_NAI_BASE_URL` is configurable (`config.ts:398`); adapter sends its Bearer key to that origin (`lib/naiImageAdapter.ts:182`). This is operator-granted endpoint authority, not proof of an anonymous SSRF parameter. Endpoint validation/documentation must preserve intentional local proxy and deterministic fixture use, and explicitly address credential forwarding/redirects. |
| ComfyUI local origin | `lib/comfyBridge.ts:33` restricts origin to HTTP local-host allowlist with explicit port and no userinfo/path/query/hash; rejects ambiguous numeric hosts. `lib/comfyImageAdapter.ts:148` bounds returned filename/subfolder/type. Do not replace this with a public-HTTPS-only policy that breaks local ComfyUI, or silently expand it to arbitrary remote Comfy hosts. |
| MCP endpoint / media | Provider IDs resolve via compiled registry (`lib/mcp/providerRegistry.ts`, `tests/mcp-security-regression.test.ts:35`); enabled IDs are not arbitrary endpoints (`config.ts:263`). Downloads check HTTPS and resolved private IPs at each redirect, bound hop count/stream bytes/type, and strip query from saved origin (`lib/mcp/downloadMediaResult.ts:21`, `:92`, `:107`, `:132`). |
| MCP residual | DNS precheck and actual fetch/IPv4 fallback perform separate resolution (`lib/mcp/downloadMediaResult.ts:35`, `:142`, `:157`); connected-address pinning is not evident. The private-address classifier is hand-maintained (`:24`). Existing “private target” regression uses HTTP inputs, so it can pass on scheme rejection without exercising IP logic (`tests/mcp-security-regression.test.ts:16`). A synthetic HTTPS IPv4-loopback rejection was separately confirmed here; DNS rebinding/IPv6 variants were not exploited or exhaustively tested. |
| Grok returned media | Image URLs come from upstream response (`lib/grokImageAdapter.ts:408`), then accept HTTP(S), default fetch redirects and a streamed 50MB cap (`lib/grokImageCore.ts:146`). Video accepts HTTPS or HTTP loopback, checks content type and MP4 signature, but checks actual byte length after `arrayBuffer` (`lib/grokVideoDownload.ts:23`). The image cap test intentionally uses a loopback upstream. No parity with MCP's private-IP/per-hop policy or streamed video cap may be claimed. |
| Image references / video sources | `lib/refs.ts:119` bounds count/base64 size/format and exposes summaries without base64 (`:72`). MIME mismatch is a warning, not strict rejection (`:146`); plain HTTP URL strings fail the base64 grammar, so do not invent a general reference-URL fetch. Extended video source IDs must be local MP4 filenames (`routes/videoExtended.ts:49`, `:282`; `lib/videoFrameExtract.ts:39`). `docs/CLI.md:266` distinguishes edit/extend URL support from local-only continue/analyze/frame: preserve that distinction. |

Priorities depend on attacker control: an operator intentionally configuring a local
upstream is not equivalent to a poisoned provider URL reaching host-internal services.
Per-hop policy and byte-limit gaps are meaningful work, but no anonymous SSRF exploit,
credential theft incident or CVE is asserted from source alone. Shared policy should
distinguish configured local services, public provider artifacts and input references;
never globally ban private IPs and break documented local operation.

## 4. Diagnostics, logs and safe evidence

Existing protections are substantial but not universal:

- `lib/logger.ts:48` redacts known secret fields; objects/arrays are summarized,
  Bearer strings and image data URLs are scrubbed and strings bounded (`:65`).
  `lib/requestLogger.ts:12` drops query strings and logs no request body. Therefore
  accepting `?token=` does not by itself prove the application request logger leaks it.
- Generic `sanitizeError` retains an opaque query token embedded in `error.message`
  (`lib/logger.ts:82`); fresh synthetic boolean probe returned true. This is a
  sanitizer coverage gap, not evidence that a real credential appeared in a log.
  Upstream errors can become error messages: Grok parses upstream error text
  (`lib/grokImageAdapter.ts:249`); Gemini embeds a 200-character upstream body prefix
  (`lib/geminiApiImageAdapter.ts:192`). Length truncation is not redaction.
- In contrast MCP scrubs nested signed query values and email/token patterns
  (`tests/mcp-security-regression.test.ts:46`); Responses diagnostics constrain labels
  (`lib/responsesParse.ts:151`), and image doctor scrubs URL userinfo/query keys/Bearer
  values (`lib/responsesDoctor.ts:258`). Do not regress these during unification.
- General doctor bundle protection is only a prefix regex on provider line text
  (`bin/lib/doctor-bundle.ts:5`, `:33`), not a proof all outputs are safe to publish.
  Health's runtime URLs and provider messages must be classified/sanitized at export.
  `docs/API.md:101` is the target privacy promise, not proof all paths meet it.
  WP10 should use structured safe-field projection and synthetic opaque-token,
  signed-URL, prompt/body, userinfo, email and nested-error fixtures. WP04–06 preserve
  error codes/status and coordinate safe messages; they must not silently change
  capability/auth-fallback semantics under a logging fix.

## 5. Fixture isolation and executed evidence

Do not boot production context merely to inspect health. `server.ts:395` loads
provider keys; several loaders do not depend on a fake primary API key override.
Config import itself reads JSON (`config.ts:48`). `createTestRuntimeContext`
does not load keys (`lib/runtimeContext.ts:190`), but `buildApp` registers the agent
queue, which recovers state and starts a tick (`routes/agent.ts:59`,
`lib/agentQueueWorker.ts:36`); its DB is the global config DB (`lib/db.ts:8`).

`tests/health.test.js:63` launches the real server with inherited process.env and
home overrides, not an environment allowlist. Browser fixture similarly inherits
process.env and only overrides the OAuth proxy port for oauth-expired mode
(`ui/e2e/fixtures/appServer.ts:96`); its `assertStubOnlyCalls` checks records at the
stub, not every app egress socket (`:15`). A fake storage directory alone does not
prevent real keys, fallback config, token restore or background work. These tests
were inspected, not run here. WP09 must own per-process config/DB/generated/auth
isolation, blank credential environment, no package fallback reads, stub-only
egress enforcement and awaited child/worker teardown. WP12 consumes that fixture.

### Commands and results (fresh local focused checks only)

Preflight checked existence only: repo `.env` and `.ima2/config.json` were absent.
No credential files or inherited environment values were printed. Empty temporary
config roots and `env -i` prevent real settings/keys from being loaded in these
selected in-process tests; actual runtime startup was not called.

```sh
wp00_test_dir=$(mktemp -d /tmp/ima2-wp00-trust-serial-XXXXXX)
env -i PATH="$PATH" IMA2_CONFIG_DIR="$wp00_test_dir" \
  IMA2_GENERATED_DIR="$wp00_test_dir/generated" DOTENV_CONFIG_PATH=/dev/null \
  node --import tsx --test --test-concurrency=1 \
  tests/backend-input-lan-hardening.test.ts tests/backend-hardening.test.ts \
  tests/generated-static-privacy.test.ts tests/logging.test.ts \
  tests/mcp-security-regression.test.ts
```

- **23 tests passed, 0 failed**, exit 0 (1.45s). Covers input rejection, LAN guard,
  Card News traversal/limits, deletion symlink rejection, chunked image cap,
  generated media/sidecar/SVG behavior, generic logging and MCP negative contracts.
- Initial otherwise equivalent command without `--test-concurrency=1`: **22 pass,
  1 fail**, exit 1. Exact failure: `SQLITE_BUSY: database is locked` at `lib/db.ts:19`
  while privacy test constructed `buildApp`, through agent-queue recovery. Shared
  temporary DB plus concurrent test processes is consistent with the trace;
  serial rerun passes. This is not a proven production bug or a dismissed flake.
  Per-process fixture isolation, not hiding the failure, belongs to WP09.
- Same privacy test alone under a fresh empty root with `IMA2_HOST=0.0.0.0` and
  `IMA2_LAN_TOKEN=synthetic-wp00-token`: **1 pass, 0 fail**, exit 0 (0.74s).
  No request token is sent by that test. Confirms anonymous MP4/SVG reads and
  sidecar blocking with the LAN guard configured; socket still binds loopback.
- In-memory `node --import tsx --input-type=module -e` probe imported
  `sanitizeError` from `lib/logger.ts` and `assertPublicHttps` from MCP downloader.
  Input was `https://example.invalid/media?token=WP00_SYNTHETIC_VALUE` in an Error;
  output only `genericLoggerQuerySentinelSurvives: true`. Separately passed
  `https://127.0.0.1/media` to the validator: `mcpHttpsLoopbackRejected: true`.
  No fetch, DNS to a public name, real credential or media was involved.

Tests use the repository's tsx invocation/import graph; the failure trace resolves
to TypeScript sources. No rebuild or installed-package equivalence is claimed.
No full suite, audit/CVE lookup, secret-content scan, browser test or live provider
probe ran. Temporary test roots are synthetic only; no user data was removed.

## 6. Risk ownership and meaningful additional WP

These are proposed assignments against `000_plan.md`'s current draft, not newly
registered WPs. The main agent must fold them into owned decade docs before A.

| Risk / remaining acceptance | Proposed owner | Required relationship |
|---|---|---|
| API/CLI/UI/SSE LAN-token propagation; token bootstrap/redaction, local browser Origin/Host policy; anonymous media/cache policy | **New bounded security WP**, provisional name “local/LAN access and media boundary” | Existing WP03 is a provider execution seam, WP08 composer UX, WP11 docs: none owns this cross-cutting executed security contract. Register before integrated acceptance/release; parent chooses number/order, this lane does not write another file. |
| Provider result URL redirects/private targets and streamed video cap | WP05 for Grok changes; new security WP for cross-provider policy/MCP residual negatives | Preserve intentional local proxy/Comfy/fixture paths. WP03 execution seam must not erase existing checks or silently add provider fallback. |
| Sensitive messages, diagnostic exports, raw upstream-body handling | WP10; WP04/05/06 adapter owners | Shared synthetic redaction corpus; preserve machine-readable error/status contract; healthy diagnostics must remain non-billable. |
| Credential/config inheritance, queue/DB state, outgoing-network and teardown isolation | WP09; WP07 for worker lifecycle seams if needed | Must precede WP12 natural-runtime/visual evidence. Existing isolated focused checks are not proof browser fixture is isolated. |
| Accurate local/LAN/Docker/remote compatibility, TLS/reverse-proxy caveat, token/media instructions | WP11 after new security WP decision | Documentation must reflect behavior, not remove advertised support without explicit approval. |
| Release evidence avoids user media/credentials, fresh negative acceptance | WP12 then WP13 | Do not turn this P research or stub success into “globally secure” or “live upstream verified.” |

The additional WP is meaningful because it changes a coherent user-visible trust
contract and closes ownership gaps, rather than adding generic security checklist
tasks. It needs these **before/after acceptance cases**:

1. Preserve default local CLI/UI behavior, non-loopback no-token startup refusal,
   missing/wrong-token API denial, state/PKCE callback exception and admin nonce.
2. Prove token-authenticated UI bootstrap, ordinary fetch, SSE initial/reconnect,
   CLI health/discovery and normal request path against an isolated LAN-configured
   server. Token must not appear in safe logs, exported diagnostics or copied URLs.
3. Decide private versus deliberately public generated media; prove raster/SVG/video,
   Range/HEAD/download behavior, missing-token negatives where intended, and cache
   semantics. Add canonicalized/encoded/case-variant sidecar, traversal and static
   symlink tests; current lowercase-suffix and deletion tests do not settle them.
4. Probe hostile-origin/bodyless mutations and Host handling without invoking real
   OS side effects. Preserve supported same-origin UI/CLI and explicitly document
   reverse-proxy assumptions; loopback binding must not be presented as proxy auth.
5. Separate trusted local-upstream exceptions from untrusted returned-media fetches;
   test redirect hops, DNS/address classification and bounded streaming with fake
   transports. No live internal probing or provider-generating calls are required.

No finding is labelled High here: media sensitivity/LAN reachability is an explicit
decision, browser exploitability is untested, URL risks depend on control of a
configured upstream or returned artifact, and logger probes use synthetic values.
Absence of a High label does not waive these risks. Parent must resolve the
LAN/media contract, assign security ownership, and enforce fixture isolation before
locking a production-readiness claim. No scope expansion was implemented.
