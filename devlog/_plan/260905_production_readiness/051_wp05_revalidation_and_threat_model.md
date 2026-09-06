# WP05 P — measured failures and download threat boundary

Baseline30dc2cb4331ea02ca33fdd0a3d911374f3e40521, codex/prod-wp05-grok.
WP04 closed D: PR203 over202, CI33955372517SUCCESS Node22/24 each2931fail0,
frontend39pass; independentproduction/verification/visualPASS. No WP05 source edits.

## Real route RED observations

Main ran owned `wp05/baseline-repro.mjs` under env-i/native module mocking using
the actual RouteHarness/three routers with valid PNGs, real sidecars and live bus
journal. All provider fetches intercepted; zero external requests/processes.

| Input | Current observed result | Required corrected result |
| --- | --- | --- |
| Classic search off,n2 | search0,planner1,image2 | unchanged |
| Node search off | search1,planner1,image1; reports enabledfalse/calls1 | search0,planner1,image1,calls0 |
| Multimode search off,max2 | search2,planner2,image2 | search0,planner2,image2 |
| Item0fails,item1succeeds | one download,2imageevents/sidecars,returned2 complete | one persisted image,event,returned1 partial |
| Item0fails,item1/2samebytes/prompt/URL | two downloads,3events/sidecars,indices1/2/3 | two events/sidecars,indices2/3,returned2 partial |

First sparse diagnostic fixture mistakenly returned empty search output and hit
the earlier search-error branch. Replaced it with a valid synthetic brief; the
same actual route then reproduced the intended sparse duplication. No production
changes; harness teardown completed. Durable JSON and script live under session
evidence wp05/baseline-repro.*. These are baseline defects, not green acceptance.

## Threat model (SEC-THREAT-01)

Assets: user host/private services, credentials, finite memory, connection slots,
generated artifacts and process uptime. Entry: untrusted image URL in provider
JSON and redirect Location. Attacker may control returned URL, DNS answers,
redirect chains, response headers/body lengths and timing/socket failures.

Trusted: server-owned configured Grok proxy origin, not request body/provider
content. Direct grok-api gets no origin exception. WP03 refuses missing/removed
direct keys before endpoint fallback. Public callable downloader policy object
is an internal-code caller authority, not an HTTP field. No API key/cookie/referrer
is attached to artifact GET. Historical providerUrl metadata remains unchanged.

Controls: HTTPS plus dated conservative IP range policy, every-hop DNS validation
and pinned connect lookup, no pooling, max5redirects, monotone local-origin trust,
single overall timer covering DNS/retries/body, streaming50MiB bound, immediate
idempotent destroy and safe public errors. Underlying OS DNS may complete later
but cannot start a late request or create an unhandled rejection.

Out of scope: video URL policy (WP06m body bounds only), existing MCP resolver
gap, LAN authentication(WP12s), arbitrary local operator compromise, external
service/account health, paid live probing. No blanket claim all network egress
or all special-purpose addresses are covered. No user media migration/deletion.

## Independent security findings accepted

Carson01a070b9-a839-7dc1-a38d-87ca6a21024a found:

- Same policy each redirect could re-enable trusted private origin after public
  hop.050 now activates exception only oninitialmatch and irreversibly drops it
  after leaving. Public→trusted/private and trusted→public→trusted/private reject
  before the forbiddenGET; same-originrelative redirects still work.
- Post-header Node error events outlive the header promise. Keep request/response
  listeners throughclose; handle late reset/response aftercancel. Add uncaught-event
  test, not merely unhandledRejection. Preheader reset identity must reach retry.
- IP literalSNI omitted; DNS Host/SNIpreserved; family/all lookup has no fallback.

### Conservative address policy update from primary sources

Main opened current IANA registries (both show updated2025-10-09):
[IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/),
[IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/).
The old050 list admitted relay192.88.99.2, benchmarking2001:2::1 and
documentation3fff::1. Added192.88.99/24; broadened2001::/32to2001::/23;
added3fff::/20. Intentionally reject some globally reachable protocol-specific
suballocations too; ordinary allowed destinations are not guaranteed reachable.
No claim this is an exhaustive live IANA mirror. This fixes the named false
positives without a new package/universal classifier.

Main Node24 read-only BlockList probe confirms IPv4 CIDRs match dotted/hex mapped
IPv6 forms (::ffff:127.0.0.1,::ffff:7f00:1). Mapped8.8.8.8 stays allowed by IPv4
rules; IPv4-compatible::127.0.0.1 fails the other-IPv6 global-prefix rule.
[Node22 BlockList docs](https://nodejs.org/docs/latest-v22.x/api/net.html#class-netblocklist)
describe numeric CIDR membership; Node22 CI remains mandatory runtime proof.

## Parity and type findings accepted

Mill01a070b9-a8ed-7ec2-a8de-8eddbd33cc2f confirmed search-off omissions and
sparse mapping. Preserve editrawPrompt; classic/node captured key atprepare;
edit/multimode captured perexecute. Keep omitted searchdefaulttrue and planner
evenwhen searchfalse. Generate/edit noURL502 differs from multimode silent skip;
planner/search errorsoutsideitemcatch, callbackfailureafterimagepush retainsimage
and cost; representativeerroronlyzeroimages.050 now makes these explicit.

Add missing operation size-mapper import, remove unused core retry import after
download extraction. Existing originalIndexes canonicalfield already exists.
Legacy must keep OpenAI exclusions while addingGrok exclusions. Reviewer virtual
genericRetryResponse probe: beforeTS2322/2339, afterdiagnostics0 includingexisting
video consumers; transpiled retryJSbyteidentical; nativeResponseidentity/textworks.

## Test isolation findings accepted

Dalton01a070b9-a7b1-76c2-a617-b929c8d712f8 found current harness blocksfetch and
processes only. New pinned node:http/https GET would escape into realDNS/network.
052 must map a shared lower-level fixture installed BEFORE runtimeimports;
never mock production downloader/policy to hide that transition. Existing route,
API parity,planner andAgent fixtures all need safe interception. Existingvideo
fixtures stay ontheir unchangedfetchpath. Canonicalrunnerflag alone mustNOTdisable
executionTestProcess's marker-plusflag sanitizedchildcontract.

## Resource bounds

Onlythisrepo/ownedstack/hostedCI + isolatedtemporaryfixtures. Zero realprovider
requests, credentialreads/changes, publicIPconnects or newdependencies. Mainowns
FSM/goal/git; explicit Astra/high boundedworkers. Four-hourWP reassessment and
72-hour goalbound, no requestednumericaltokenbudget. Fullsuite/51MiBstress cases
use exact-headCI; focusedlocalfixtures/typechecksallowed. No implementation until
complete052 ownershipandindependentA security/test gates.

## Cross-lane agreements

Existing resolveProviderOptions supplies provider/model/size/reasoningEffort/webSearchEnabled; WP03 types its existing output into the execution request. No WP02 backend type is required. WP03 adds GROK_API_KEY_MISSING (401), after verifying no current direct-Grok missing-key validator/code exists: grokImageCore.getGrokEndpoint(:62) chooses proxy on falsy directApiKey. WP03 pre-admission plus execute-time recheck prevents missing/removed keys from reaching that fallback. Add the new code to PASSTHROUGH_CODES/statusForErrorCode; existing 4xx handling is non-retryable. API_KEY_REQUIRED remains OpenAI's current 401. All route error shapes follow WP03's explicit matrix. No second provider resolver or automatic provider choice.

WP03 also owns NAI multimode references: getProviderSurfaceSupport(nai,multimode).references=false plus valid references.length>0 returns NAI_REF_UNSUPPORTED 400 before admission/transport. WP05 preserves this precondition; WP02 has no server auth/refusal ownership.

006_trust_boundaries.md:91/197 grounds the image-download patch above: WP05 owns per-hop/pinned returned-image URL policy and streamed image bound. It does not claim current MCP DNS pinning. WP06m/doc065 owns streamed Grok video bytes and video-specific validation after WP06; it does not reuse image transport policy; video URL restrictions remain an explicitly disclosed unchanged limitation. Existing MCP DNS precheck-versus-connect re-resolution remains disclosed and unchanged, not a pending universal-refactor requirement.

Rollback: parent reverts WP05 family/toggle/download/identity changes together to WP04, including multimodePipeline sweep and canonical runner/tests, then rebuilds runtime. Revert R2-B2's pinned adapter and grokUpstreamRetry type diff together (or retain the additive generic contract); never restore Response-only signature while retaining the structural caller or bypass with a cast. Existing full-Response caller source remains unchanged. WP03's optional unused originalIndexes field can remain harmlessly absent from producers. Partial rollback that drops mapping while retaining sparse producers is forbidden: it restores duplicate persistence. Removing runner flag requires reverting dependent WP06 mock tests first; no skips. Record that rollback restores old search-off, duplicate-output and unsafe/unbounded download behavior, so readiness is unmet. Existing credentials/media/sidecars are never deleted or rewritten; historical duplicates are not migrated. Parent cascades/revalidates upper layers. Import/fixture gates are E7 + CI early warning; bypass=not running them; residual=live upstream unverified; final unbypassable enforcement=none.
