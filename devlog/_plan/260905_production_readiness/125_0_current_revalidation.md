# WP12s P — current integration plan

Class C4, satisfy-spec. Trigger: owner resumed full production delivery after
WP12, explicitly requiring main/preview integration and deployment. Goal:125's
local/LAN authentication, private media and origin-bound CLI/browser access.
Non-goals: accounts/tenants, provider egress changes, token persistence, new test
frameworks, generic guards, paid generation, personal service/account access.
Stop:125's real security/compatibility scenarios and exact-candidate CI/UI proof
pass; this WP is not final release. Evidence stays in this unit and wp12s ledger.
Outcome: verified security layer or concrete unresolved issue; never tests-only
completion. Main reclaims after two distinct failed worker packets; new scope or
external authority escalates. Existing local pure tests/builds/typechecks only;
real app/CLI installation/native UI and full suites use hosted CI. Existing SSH
Windows is available for isolated focused probes, no execution-policy bypass.
No token budget; reassess at4hours WP and72hours total, not an automatic success.

Continuity:124_10 closed WP12 at2f8b4823. Historical MCP cause remains a separately
owner-approved unresolved follow-up; current first-frame repair and all final
gates passed. Consume prewritten125 in full, amended only by this current-source
map. Branch codex/prod-wp12s-lan-security starts at2f8b4823; its PR bases on215's
codex/prod-wp12-readiness. Native216 already exists; no membership rewrite now.
No feature merges before WP12s C and WP13 release gates.

## Current-source findings and decisions

1. server.ts:250/272 already has case-insensitive canonical API matching, GET-only
 callback and API_REQUEST_POLICY admission before parsers. Preserve callback case
 compatibility and existing600requests/120mutations budget. Construct one budget
 per app and pass it to session route registration as middleware after its
 Host/auth checks and before its1KB parser. Ordinary API keeps guard→same budget→
 parser; each request is charged once. Failed-bootstrap throttle is separate.
 Revised signature: registerSessionRoutes(app:Express,budget:RequestHandler):void.
 Preserve unescaped/case canonical endpoints; reject encoded mount aliases before
 static/route fallthrough. Local mode still receives Host/Origin protection.

2. server.ts:282 media policy is literal-sidecar-only, public immutable. New
 generated owner sets LAN private/no-store/Vary/CORP/referrer headers BEFORE auth,
 then authentication BEFORE stat/conditional/range. Check decoded requested path
 AND canonical target for JSON sidecars; apply SVG sandbox policy when either
 identifies SVG. Retain existing exact SVG CSP and no restrictive raster CSP.
 Existing media404 text compatibility stays for sidecars; new access errors use
 the fixed LAN envelope only, not a rewrite of unrelated/admin error contracts.

3. server.ts:553 shutdown insertion precedes shutdownServerAndMcp; also close-event
 fallback after listener creation. Existing SSE close handling owns its timers and
 subscriptions. Access disposer invalidates sessions and active responses; no SSE
 reimplementation. Refuse session issue after disposal so a pending bootstrap
 cannot resurrect it. BuildApp test teardowns invoke the same disposer first.

4. Config import coupling is real: config-store.ts imports runtimeConfig and
 bin/ima2.ts loads it before command dispatch. Use a lazy publicOrigins getter in
 config.server, capturing raw env/file inputs at module initialization. Getter
 strictly parses/normalizes, with fixed error code/message; createLocalAccessPolicy
 reads/copies/freezes it before any listener. This lets config rm remove an invalid
 file-layer value without weakening startup rejection or refactoring all CLI config
 loading. Effective/get may fail safely on invalid input; config set validates
 before save. Do not echo raw publicOrigins env override. No secret writable keys.
 Security bounds are immutable config.security constants, ignoring env/file writes.

5. main.tsx:29 statically imports App. i18n/index.ts:5 also imports useAppStore,
 so the new sign-in shell must not import that module before authorization.
 Move existing unchanged loadLocale/saveLocale and Locale type to a small pure
 ui/src/i18n/locale.ts; index reexports them. LanSignIn imports pure locale and
 JSON dictionaries directly. Add lan-session copy to the four existing dictionaries
 and scoped styles/lan-sign-in.css. Keep current design tokens/compact form, no
 hero/gallery/imagery. Password token clears on submit/failure, never logs/storage.
 App dynamic import/render occurs only after status confirms local or valid cookie.
 Reauth unmounts private UI without clearing drafts; one auth-required event owns
 the gate. Guard asynchronous App loading against a superseding auth-required state.

6. api-core.ts now also exports jsonGetObservation: apply same-origin fixed
 LAN_TOKEN_REQUIRED notification there as well as jsonFetch, preserving ordinary
 provider401/error envelopes. eventChannel.ts must preserve owned-source guards,
 cursor/replay and deadline behavior. Only LAN mode checks status once per failed
 reconnect cycle, then stops reconnect on expired session; normal local/mock clients
 retain existing reconnect timing. No automatic generation replay after login.
 Media error checks confirm session status before locking UI; a404 is not expiry.

7. CLI raw-fetch inventory remains17calls. Follow125's complete table, preserving
 WP12 initialEventId/cursor and error/deadline behavior. readAdvertise remains a
 non-credentialed discovery source. Explicit --server/IMA2_SERVER alone establishes
 an in-process token binding. Credentials omit and redirect:error on first-party
 transport; unrelated external media is credential-free. Auth/forbidden status is
 safe exit4, no failover to an unrelated server. Current ping JSON adds stable code.
 tests/cli-model-resolver.test.ts:197 compiles only sse/mcpJob: include client in that
 existing temp build after imports change. Do not widen I/O/network test allowances.

8. Existing WP10 URL sanitizer/corpus is present (logger.ts:65,logging.test.ts:112).
 Reuse it; bootstrap/logger negatives use synthetic token/cookie/origin markers.
 No second sanitizer, no raw URL/body dump, and no whole-config debug logging.

## Explicit remaining policy details

LAN credential shape validation rejects duplicate/array header/query and duplicate
named cookies; value precedence remains header→query→cookie. A valid header cannot
rescue malformed duplicate encodings. Local no-token compatibility is preserved.
Bootstrap always requires exact same-origin Origin and strict JSON{}; only LAN
requires explicit token. Status missing/expired cookie gives false; bad explicit
LAN header/query gives401. Logout requires same-origin and a presented session
cookie (unknown/expired may clear idempotently); query-only logout cannot act.
Store records digest+origin+absolute8hour expiry, bounded256sessions/4096throttle
buckets/10failures; collision retries bounded, no valid-user eviction. Closers
unregister on response finish/close. Session expiry cannot undo completed downloads
or jobs. HTTP LAN is trusted-network-only, not encryption; TLS/proxy limits stay125.

## Exact file additions to125's manifest

- MODIFY ui/src/i18n/index.ts; NEW ui/src/i18n/locale.ts; MODIFY four locale JSONs;
 NEW ui/src/styles/lan-sign-in.css: preauth import boundary and usable sign-in only.
- MODIFY tests/cli-model-resolver.test.ts: existing emitted fixture dependency list.
- MODIFY ui/e2e/fixtures/appIsolation.ts, appNetworkGuard.mjs, appOwnership.ts in
 addition to appServer.ts: required bounded LAN/TLS/localhost construction below.
- MODIFY .github/workflows/ci.yml and pr-fast.yml ONLY artifact globs for j9 evidence
 if existing wp09 patterns do not include its JSON/PNG. No new job/matrix/workflow.
 Other files and protocol signatures remain125; no new helper/fixture files beyond
 the explicitly named product owners and tests. Generated inventories/SoT updated
 through existing commands, not new checker scripts.

## Existing fixture adaptation, not a new framework

AppStartOptions gains an explicit synthetic LAN option (token,publicOrigins).
makeAppEnv keeps its allowlist and injects only this option, configured host0.0.0.0
and a fixed fixture-LAN marker. Existing network preload maps ONLY that configured
literal's bind lookup to127.0.0.1 when the marker is present; it performs no native
DNS. Outbound connection matching remains fixed to the existing stub. Thus real
server policy sees LAN configuration but actual listener remains loopback, and
the test exercises the requirement that LAN auth applies even to a loopback peer.
server runtimeHostUrl advertises localhost for wildcard; launch accepts localhost
ONLY for this LAN option and its fresh ephemeral port, preserving it for browser
cookie/canonicalization tests. Default fixtures remain unchanged127.0.0.1.

Existing owned-origin validation may recognize http/https plus127.0.0.1/localhost,
but authorization still requires an exact live registered origin, issued home and
owned teardown. Register the in-test synthetic TLS proxy/hostile-page listener via
existing registerOwnedApp; no unregistered localhost allowance, no egress or user
file relaxation. New native TLS key/cert are synthetic in-test constants confined
to j9, no openssl install/process permission. Default isolation negatives must still
reject unowned origins, filesystem/process probes and poisoned setup. Do not modify
appPolicy/appFilesystemGuard/appProcessGuard to make security tests pass.

## Dependency order and delegated write scopes after A

Main first wires config/security bounds and freezes shared signatures. Then:

- Backend worker: four new125lib owners plus local-lan-policy/lan-session/lan-media
 tests; no server.ts/config.ts/docs/CLI/UI writes. Main owns server middleware and
 teardown integration and adjusts only its relevant existing backend/privacy tests.
- CLI worker: bin/lib/client/output/sse/mcpJob/characterResolve/videoMcp and listed
 gen/video/upscale/service/ping callsites; cli-lan-auth test and existing MCP temp
 build list only. No config command/server/UI writes. Main handles config command.
- Main: browser bootstrap/sign-in/locale and API/SSE integration, scoped J9 fixture
 adaptations, config tests, docs/SoT and all external operations. Workers use explicit
 Astra/high, no nested delegation. Each reads125+this amendment and owner skills.
- Independent A reviewer audits this plan before B. C source/security/visual review
 gets fresh evidence, including actual cookie/SSE/media/Range behavior. One WP cycle,
 not parallel implementation of WP13.

## Verifiers and acceptance activation

P baseline commands actually run: npm run typecheck exit0 (tsconfig includes
server/config/lib/routes/bin/**/*.ts); npm --prefix ui run typecheck:e2e exit0;
npm run test:inventory exit0. Previous2f8 fullCI and258E2E are baseline, not evidence
for absent new code. New125test files and J9 are planned/not-run until B exists.
UI build observes UI TS/TSX/CSS and E2Etypes; no local runtime/UI server invocation.
Run focused pure policy/store tests locally only after import/side-effect inspection.
Use smallest existing hosted job for an observed failure; after coherent fixes,
full exact-head CI and PR gate plus currentCodeQL, J9 and cumulative journeys.

125§6 remains acceptance owner: bad/duplicate credentials and hostile origins must
fail before handlers/files; native cookie bootstrap+reload/SSE/Range+logout/expiry
work on HTTP/TLS; no storage/query/header leakage; invalid config safely rejects and
rm repairs; explicit CLI target alone gets secret and redirect cannot move it;
teardown closes admitted streams before server close. Include positive local, CLI,
LAN literal/proxy/Vite compatibility. No source-text-only security verdict.

Enforcement limit: runtime middleware is the final first-party access boundary;
direct filesystem copies, already cached/downloaded media, operator code and trusted
proxy compromise bypass it. CI/agent evidence is review evidence, not an unbypassable
release mechanism. No assertion of distributed tenancy, atomic FS race immunity or
HTTP confidentiality. WP13 must rerun integrated final-head checks and verify actual
main/preview/package/deployment provenance before completing the overall goal.
