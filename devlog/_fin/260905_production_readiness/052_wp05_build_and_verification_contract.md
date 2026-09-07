# WP05 — bounded owners, network fixtures and verifier activation

Companion050/051 at30dc2cb4. No implementation yet. One WP/stack layer combines
Grok family ownership with the named search/index/download corrections; video,
MCP and global lifecycle redesign remain excluded.

## Exact disjoint B ownership

| Owner | Exclusive files |
| --- | --- |
| Main | execution/index.ts, execution/legacy.ts; lib/multimodePipeline.ts final sweep; lib/grokUpstreamRetry.ts type-only generic; scripts/run-tests.mjs; .github/workflows/codeql.yml exact-head dispatch; SoT/inventory/devlog/evidence/commits/FSM |
| Planner/facade | NEW lib/grokImagePlanner.ts; MODIFY lib/grokImageAdapter.ts |
| Operations/sequence | NEW lib/providers/adapters/grokOperations.ts,grokMultimodeOperations.ts; MODIFY lib/grokMultimodeAdapter.ts |
| Family | NEW lib/providers/adapters/grokExecution.ts; MODIFY execution/legacyClassic.ts,legacyNode.ts,legacyEdit.ts,legacyMultimode.ts |
| Download policy | NEW lib/grokImageDownloadPolicy.ts; NEW tests/grok-image-address-policy.test.ts |
| Download transport/wrapper | NEW lib/grokImageDownload.ts; MODIFY lib/grokImageCore.ts |
| Shared network fixture | NEW tests/_grokImageTransportFixture.ts, tests/_grokImageFixtureStreams.ts; MODIFY tests/_executionRouteIsolation.ts,_executionRouteHarness.ts,provider-execution-harness.test.ts |
| Download tests | NEW tests/grok-image-download-policy.test.ts, tests/grok-image-download-pinning.test.ts |
| Runtime Grok tests | NEW tests/grok-execution-parity.test.ts; MODIFY tests/provider-execution-routes.test.ts,provider-execution-node.test.ts,provider-execution-multimode.test.ts |
| Legacy fixture migration | MODIFY tests/grok-planner-adapter.test.ts,api-provider-parity.test.ts,agent-mode-runtime-contract.test.ts,backend-hardening.test.ts |
| Contract/runner/retry tests | MODIFY tests/_executionBoundaryProbe.ts,provider-execution-boundary.test.ts,_executionImportEdges.mjs,provider-execution-imports.test.ts,prompt-fidelity.test.ts,model-default-projection-contract.test.ts,agent-mode-right-sidebar-contract.test.js,node-studio-ui-contract.test.js,generation-limit-unlock-contract.test.js,grok-upstream-retry.test.ts; NEW tests/test-runner-invocation.test.ts |

All paths repo-relative. Explicit Astra/high workers, no grandchildren. Main
does not start runtime Grok tests until the fixture safety layer is installed
and independently smoke-tested. Workers read original operation/planner bodies
from immutable `git show 30dc2cb4:<path>` if another worker has replaced a facade.
No worker runs full suite/global compiler/builds; main coordinates these.

### Stable production symbols

GrokExecution exports GrokRequest, isGrokRequest(request), prepareGrokExecution
with the same generic surface result inference as OpenAI. Named internal helpers:
prepareGrokClassic, prepareGrokNode, executeGrokEdit, executeGrokMultimode.
Main selector checks OpenAI then Grok then remaining legacy, retaining the outer
credential wrapper. Legacy Exclude/runtime guard remove all four migrated IDs.
No changes to OpenAI family/operation/transport modules.

Planner/operations/facade symbols remain050. Keep all actual current public
exports, including type names not in an illustrative snippet; verify export-name
set against immutable source before replacing it. No circular facade imports.
Operations use getGrokProxyBaseUrl(ctx) to provide an optional server-owned origin;
directApiKey set means NO local trust, and current direct-key checks remain.

Policy exports only GrokImageDownloadPolicy, PinnedImageTarget and
resolveImageDownloadTarget(url,policy,signal). Its optional trust parameter is
interpreted per-hop; monotone trust-chain state is the wrapper's responsibility.
Every address must be syntactically valid and have matching numeric family4/6;
empty/mixed invalid answer sets reject before opening a socket.

The wrapper exports downloadGrokImageUrl with the old three positional arguments
and optional policy fourth argument. Private helper names/types match050.
Body failure tags become a private ImageBodyFailure reason `too-large | empty`,
not new GROK_MEDIA_* public error codes. The body reader creates them, wrapper
maps them to existing GROK_IMAGE_DOWNLOAD_FAILED502; they never serialize.
Existing cancellation499/timeout504 codes remain. This avoids an unused public
error-map expansion merely for private control flow. Preserve safe size wording
including `50MB limit` so the existing real cap oracle still observes overflow.

## Shared fixture contract: intercept actual Node transport

New test-only API, implemented before any migrated runtime tests execute:

```ts
export interface ImageFixtureRequest {
  url: string;
  method: "GET";
  headers: Headers;
  body: string; // always empty for artifact GET
  signal: AbortSignal | undefined;
}
export interface ImageTransportFixture {
  calls: readonly ImageFixtureRequest[];
  resolutions: readonly { hostname: string; addresses: readonly { address: string; family: 4 | 6 }[] }[];
  violations: readonly unknown[];
  activate(options: {
    hosts: Readonly<Record<string, readonly { address: string; family: 4 | 6 }[]>>;
    respond(call: ImageFixtureRequest): Response | Promise<Response>;
  }): void;
  deactivate(): Promise<void>;
  drain(timeoutMs?: number): Promise<void>;
  restore(): Promise<void>;
}
export function installGrokImageTransportFixture(): ImageTransportFixture;
```

Installation patches node:dns/promises.lookup and node:http.request/https.request
BEFORE production dynamic import; restore exact original descriptors/bindings with
syncBuiltinESMExports. No native network delegation in this fake transport. Default
inactive state denies/records every DNS or request attempt, not a success fallback.
Only explicit host map answers are synthesized; no suffix-wide allowlist. Mapped
IP literals are interpreted by real policy without DNS. Route fixture host map
uses exact known synthetic artifact hosts found in existing fixtures, e.g.
cdn.x.ai,fixture.invalid,artifact.fixture.invalid, each→8.8.8.8/family4. Hostnames
are fictional test destinations despite some resembling public CDNs; no socket
connects to those addresses. Any additional expected host requires a literal map
entry in its test packet, never arbitrary resolver passthrough.

Fake request/response mechanics live in _grokImageFixtureStreams.ts so each helper
remains under400lines. Use actual Node Writable/Readable/EventEmitter primitives
and structural types for the subset consumed by downloader, no production fake
flag. `.end()` invokes the actual passed custom lookup; verify callback's single
and all forms/family matching and absence of fallback. Then pass one GET record
to the existing upstream fixture callback, turn its Response.body into incremental
Node-readable chunks without arrayBuffer/prebuffering, and emit normal header/
body/end/close behavior. `.destroy()` is idempotent, cancels underlying Response
reader and emits controlled error/close as appropriate. Fake header/body errors
and delayed streams must be observable, not silently converted to success.
The helper records pending callback/stream work and drains it; expected abort is
only the actual signal.reason. Unexpected exceptions remain fatal evenafterabort.

RouteHarness keeps `calls` as total provider calls so existing payload/count
assertions remain meaningful. Its fetch handler and pinnedGET handler share the
same per-case `upstream` callback and strict violation ledger. Add read-only
`imageTransportCalls` and `imageResolutions` to RouteCase, distinguishing activation
of pinned GET from fetch. The artifact request has methodGET/bodyempty; raw body
options may be adapted for legacy JSON parsers only through an explicit fixture
conversion, never fake a POST or conceal the transport in production.
waitSettled drains tracked handler/direct work, detached writes AND pinned fixture
streams before restore/removal. No untracked transport can outlive a case.

_executionRouteIsolation owns installation/restoration handles, or returns them
to the harness with explicit failed-setup rollback. Capture tests that inject a
module-mock failure preserve whether mock.module originally had its own property;
restore the original descriptor or delete only a test-created own shadow after
restoring the function. Do not call global mock.restoreAll on unrelated fixtures.

Required helper regressions: inactiveDNS/request denied; unknownhost denied with
GET0; GET is recorded separately while totalcallsincludeit; actualcustomlookup
invoked and wrong/no lookup rejected; streaming body notprebuffered; abort+late
error/close; setupfailure restoresdescriptors/env; cleanupwaitsforheldGET/pump;
unexpectedpostabortexception remainsfatal. Test existing OpenAI behavior unchanged.

## Legacy fixture migration (necessary to keep canonical tests safe)

The three independent test files currently statically import production and stub
only globalfetch. Move production imports to dynamic initialization after owned
emptyconfig/DB/storage and transport fixture installation. Import-only types
remain erased. Retain original behavioral assertions/caller code; do not rewrite
entire tests to a mock of downloader or family.

- grok-planner-adapter: three image/download fixtures install/activate exactcdn.x.ai
  transport; new option omitted/true/false cases cover old public APIs. Keep planner
  payload/default/model behavior tests and all existing exports.
- api-provider-parity: six existing CDN download branches receive pinnedGET records
  through the same fixture response logic. Keep returnedURLs/auth/mask/metadata
  assertions unchanged. Do not conflate new node/multimode searchfalse correction
  with cases that omit the option and intentionally retain defaultsearchon.
- agent-mode-runtime-contract: only Grok image/download fixture migrates; agent
  search-default policy and video/fetch paths remain unchanged.
- backend-hardening: realchunked51MiBfixture supplies exactownedloopbackorigin in
  argument4, so it reaches sizeguard ratherthanpassing ondestinationrejection.
  This real-socket case mustNOT run underthefakeNodeHTTPfixture; it alreadyowns
  a literal loopbackserver. RunthisheavycaseinCI, not a newfull/localstresssuite.

Use per-file ownedsetup+after teardown for config/modules, per-case activate/
deactivate for synthetichosts/responses. No inheritedcredentials or userstore
reads during local focused commands (env-i). Full canonical CI is disposable.
No provider-service bootstrap, realpublicDNS or publicsocket tests.

## Existing assertion and import migration

_executionBoundaryProbe mocks planner and generate/edit/sequence at their NEW
owners separately. Do not mock grokExecution or public prepare. Keepnativeobject
identity; addexplicitfalse forwarding in node/multimode, preserving classic
preparedsearch0 and direct-key capture semantics. Retain providerliteral factory
overload introducedWP04. provider-execution-boundary retainsfullmatrix plus new
searchforward assertions; OpenAIunchanged.

CurrentWP03 tests intentionally record oldsearchbehavior. Change ONLY:

- provider-execution-node searchoff child expects0search not1, still1planner/image.
- provider-execution-multimode directfalse expectssearch0/originalIndexes[0] and
  totalcalls3 not4 when GET is included. Its subsequent omitted-option route
  stillsearcheson. OpenAI originalIndexes remainsundefined.
- provider-execution-routes gains real sparse final-sweep cases includingsame
  contentatdifferentindexes andnooriginalIndexes inpublic/sidecarJSON.

Also migrate BOTH direct native sequence cases in provider-execution-multimode:
register prepare/execute work with fixture.trackWork immediately, hold an owned
AbortController, and finally release callback/stream gates, abort, then boundedly
await Promise.allSettled([work]) before fixture restoration. Existing Responses
assertions remain unchanged; no callback can outlive test failure. Add an actual
held-callback regression that deliberately fails an assertion/body and proves
execution settlement precedes pinned transport deactivation. This is mandatory
test lifecycle repair, not a production sequence semantic change.

Source contracts: prompt-fidelity/model-default-projection readactualplanner;
agent-mode-right-sidebar splits plannerModel declaration/selection betweenplanner
andoperations; node-studio uses executeGrokNode/prepareGrokNode's actual node helper
scope (choose inner executeGrokNode as stable name if needed); generation-limit
includesrealgrokMultimodeOperations. No whole-tree emitted-JS concatenation.

Extend _executionImportEdges policy, not just its tests: four callers cannotbypass
index via newGrokexecution/ops/sequence/planner/download/policy. Allmigratedfamily/
planner/ops/legacy cannotimportcompatibilityfacades; legacycannotimportmigratedGrok
runtimeowners. Allowededges index→family→operations/planner/core; operations→planner/
core/download; planner→core/retry; core→downloadreexport; facades→realowners.
No cycle download→core or planner/operations→facade. Preserve OpenAIguardmatrix.
Retain alias/dynamicliteral/reexports/types/scope-existence negative fixtures.

## Security test matrix (public wrapper, no fake security success)

grok-image-address-policy.test.ts: pureactualpolicy withcontrolledDNSbeforeimport,
exact050CIDRs including192.88.99/24,2001::/23,3fff::/20, mappedprivate dotted/hex,
mappedpublic,compatibleIPv6, empty/mixed/familymismatch andvalidIPv4/IPv6. Reject
userinfo, zoneid, wrongscheme, wrongport trust. Trustedinitial namedprivate allowed
only explicit origin. DNSheld abort/timeout waitsettlement belongswrapper tests.

grok-image-download-policy.test.ts exercisesactualpublicdownloader+actualretry;
controlled low-levelDNS/HTTP only. Reuse shared stream primitives if useful but
do not share active routefixture or cachedmock with nativepinningfile. Cover:

- HTTPS public redirects0..5; missingLocation/sixthhop refusal, relativetrustedsame
  origin allowed; public→trustedprivate and trusted→public→trustedprivate refused.
  Everyattempt/hopresolves/revalidates; priorbodydestroy precedesnexthop.
- Preheaderreset→200 retainsrawclassifier andresolvesagain; policyerrorsneverretry.
  503Retry-After0/2→200 andthird503exhaustion withactualhelper; discardedbodynever
  read, eachrequest/responseclosed. Advisorycancelpromise reject/never/throw cannot
  delayretry orleakunhandledRejection; actualdestroy/closeevidence stillrequired.
- RealNodeeventemissionbeforeheaders/afterheaders/afterabort/late response remains
  handled. Monitor uncaughtExceptionMonitor/unhandledRejection without swallowing
  them; the owning test child mustexitnonzero on anunhandlederror.
- Headersabsent/lying/oversized,exact50MiB/limit+1,empty/nullbody. At leastone test
  observes no Buffer.concat onoverflow; fake incrementalchunks avoid prebuffering.
- HeldDNS: abort publicpromisebeforeDNSrelease, GET0; separaterealwrapperdeadline
  viafaketimerbeforeDNSrelease gives504, latefulfill/reject neverGET/unhandled.
  Preaborted skipsDNS/GET. Hop/retryconsumestime before nextheldDNS provesonebudget.
- Callerabortduringheaders/body/retrydelay→499, timer→504, no returnedbytes; listener/
  timer/streams cleanup. Wrongfamily/alllookupoptions failwithoutDNSfallback.
- Safe error/logexports have no signedquery/userinfo/key sentinel; onlyexisting
  publiccodes/status, notrawNodeerror/inputURL. Host/SNI distinguishDNS/IP literals.

grok-image-download-pinning.test.ts is its OWN testprocess/modulecache: realnative
HTTPserver127.0.0.1 ephemeral; URLhttp://pinning.fixture.invalid:port/image and
exacttrustednamedorigin. Mockonly promiseDNSanswer127.0.0.1 anddefaultdns.lookup
throwingsentinel. NativeHTTP/HTTPS/connectremainrealbutrequestspyrefusesanything
outsideexactownedtarget. Verifylookup1/defaultDNS0/server1/Host/remoteAddress/port/
bytes/socketclose. Removalofcustomlookup mustfail sentinel. No globalhostsedit,
publicconnection or IP-literal shortcut. Node22/24 canonicalCI runsallcases.

### Test-file size and helper scope

Advisory cleanup-return injection is a PRIVATE-adapter source-unit layer, because
the actual PinnedImageResponse factory/cancel are private. In _grokDownloadRetryCases,
extract exactly the named toRetryResponse/cancelPinnedImageResponse function ASTs
from current grokImageDownload.ts, transpile unchanged bodies in an isolated
test VM with only Headers/Promise, and pair them with actual grokFetchWithRetry.
Supply controlled structural pinned responses whose cancel initiates destruction
then returns reject/never/throw. Assert source extraction names/counts and preserve
body text; no production exports/hooks or replacement downloader. This proves
that defensive adapter mechanism only. Separate actual-public-wrapper tests with
intercepted Node events prove transport policy, destroy and socket-close behavior.
Do not call the extracted unit a public-wrapper integration test.

Large verification is split by mechanism, not skipped: tests may add exactly
`tests/_grokDownloadPolicyCases.ts` and `tests/_grokDownloadRetryCases.ts` ownedby
Downloadtestsworker for grouped fixturebuilders/assertions. Keep eachsource/test
module<500lines, preferred<400; no genericnetworktestframework. Main canreclaim
a slice aftertwofailedworkers, not silentlyexpand production scope.

## Runner and retry contracts

Main addsnative-module-mocks flag once inactualscripts/run-tests.mjs. No change
to package script, NODE_OPTIONS, discovery or exit semantics. Newrunner-invocation
test launchesabsoluteactualrunner inownedtiny-discoveryrootwithnode_moduleslink,
sanitized envwhitelist (not copyallambientsecrets); removesNODE_OPTIONS/NODE_TEST_CONTEXT,
no inheritedexecArgv. ExistingexecutionTestProcess continuesrequiringmarkerANDflag;
canonicalflagalone cannotbypassits sanitizednestedchild.

grokUpstreamRetry generics aretype-only; compareallfunctiontranspiledJSidentity
before/after. TestsconfirmnativeResponse retainsjson/text andstructuralsubtype
marker, cancel-before-retry ordering/no wait foradvisorycleanup, Retry-Afterdelay,
abortandattemptbudgets. Keep imagePOST outsideautomaticretries.

## Main mutation and C gates

Afterpassingcodecheckpointandallwritersclosed: temporarilyrevertONLYmultimode
sweepindexexpression, rebuild, actualsparse-one-success fixturemustfail2vs1;
restoreexacthunkandrerunGREEN. Pinnedlookup removal inownednativepinningtest must
failwithoutrealDNS/network; generic/rawresponseadapter mutation mustfailtypecheck
or explicitdestroy-before-retry oracle. Recordfailurereson, restoreimmediately,
no mutationcommitted/pushed. Scope oftemporarymutationsonlytheimplementedhelper
lines; no runner/protection/authbypass.

Focusedfixture/newsource tests; compilers/builds/inventory/linecounts/diff;
secret/static-analysis checks and theirverifiedcommands are specified in053
(existinggitleaks/CodeQL, no newscannerdependency). Exact-headCI fullNode22/24 plus
canonicalrunneractivation andexistingUIregressions; publicDNS/IPneverreal.
Freshindependentsecurity/production/testC audits and actualcurl routeevidence.
UIunchangedunless separatelyobservednecessaryintegrationdefect; finalcaptures
mayusehash-basedregressionreview withsourceidentity, notoldcaptureclaim.
PRbase203; merge/releasependingremainingphases andglobalhistory/securitygates.
