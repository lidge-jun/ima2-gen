# WP12s C — observed failures and bounded repairs

Candidate: `10ede1046d104f6c30be64d95c45c8f7ab886884`, PR217.
Full CI34041144664 Linux22/24 reports the same ten failing cases. No
current-head pass, merge or release is claimed. Keep the existing WP12s scope;
these repairs close existing product and verification contracts, not a new
testing framework. Original MCP follow-up approval does not waive these errors.

## Main hypotheses / discriminating evidence

- Idle polling H1: idle shutdown changes the observation revision before the
  second history read; H2: fixture timer does not await the callback; H3: network
  or auth state suppresses requests. Falsifiers: moving only idle shutdown after
  the read restores two reads; runTimer awaits the returned promise; fixture
  trace shows local mode and no violations. Original test reproduced 2 pass/1
  fail, `1 !== 2`, one history request, both locally and in both Linux CI rows.
  Source `idleTick -> stopInFlightPollingImpl -> pollingRevision++` invalidates
  `isCurrent` synchronously. Preserve auth/unmount invalidation and stop only
  after the final idle observation completes.
- Bundle H1: feature is eagerly bundled; H2: new preauth entry adds an App dynamic
  boundary; H3: stale dist. Falsifiers: manifest static graph contains feature;
  entry dynamically reaches App which dynamically reaches feature; fresh CI
  build reproduces. Keep static exclusion and named lazy chunks, follow actual
  reachable graph rather than requiring a one-edge entry import.
- Radius H1: wrong token; H2: three new sign-in declarations absent from frozen
  manifest; H3: duplicate declarations. CSS has panel xl, input md and button md;
  existing token-value checks pass, count482 versus479. Add only those three
  explicitly inspected declarations, not a regenerated expectation snapshot.
- HTTPS fixture H1: policy rejects a configured public origin; H2: fetch does not
  send the synthetic Host as intended; H3: unexpected credential failure. CI
  reports403 not204; raw request header observation is still needed. Use the
  existing native HTTP fixture boundary to transmit/observe exact authority;
  never broaden host/origin admission to satisfy the fixture.
- Startup message is an exact source/assertion mismatch (old host-echo regex
  versus fixed safe error); no competing runtime hypothesis fits both strings.
  Preserve refusal and safe message, align the existing assertion.
- Comma token: raw duplicate detection already exists; one literal configured
  comma token is rejected by an extra comma ban, unlike the parent contract.
  Preserve duplicate/raw cardinality rejection and exact constant-time match.

## Independent review disposition

Main verified the actual ResultActions unmount -> abort -> unsubscribe/deadline
cleanup path (browser H1). Browser worker repairs accepted-work ownership and
the existing J9 refused-cookie/TLS cleanup fixtures. CLI worker repairs the
source-confirmed health timeout/startup polling findings and diagnoses existing
CLI exit-contract failures. Disjoint write sets; no local native app, account,
provider, service or full-suite execution. Hosted CI owns native integration.

Windows24 job101508007918 and AgY job101507921545 fail during npm/node-gyp
header download in Undici Parser.finish, `assert(!this.paused)`, before product
tests. Cause/disposition remains open; no blind rerun or package-policy waiver.

## Focused evidence

- Native fetch dispatch interception (no delegation/socket): a request supplying
  `host: studio.example`, `origin: https://studio.example` reached the dispatcher
  with Origin but **without Host**. This discriminates HTTPS fixture H2 from
  policy/credential failure. Replace only that synthetic proxy request with
  node:http; keep exact host/origin checks and Secure-cookie assertion. Native
  hosted execution remains pending.
- Comma-token direct middleware regression: RED `0 !== 1`; remove only comma
  rejection, GREEN15/15 pure store/policy/middleware tests, including duplicate
  raw-header401. No personal app/network.
- Fresh UI build succeeds. Manifest entry dynamically imports App, which has
  the four named feature dynamic imports. Updated existing test additionally
  excludes their files from App's static graph;6/6 pass. Initial static graph
  exclusion is retained. This is boundary relocation, not an eager-load waiver.
- Existing polling/reconciliation/radius tests:61/61 pass,0fail0skip. Original
  idle polling now performs two history reads and then removes the timer; auth
  loss/explicit-stop stale-response cases still pass.
- SSH desktop-c795oh4, Node24.19.0:14/14 pure policy/store tests,0fail0skip,
  compiled current sources in owned `C:/Temp/ima2-wp12s-win-8iH0lZ`. No app,
  service, credentials, native dependency install or provider call. This is
  supplemental Windows semantics proof, not pinned CI/install acceptance.

## Integrated worker repairs

- CLI fresh-source mock repro confirmed unintended ordinary MCP exit5 rather
  than legacy1. Keep ordinary gen/upscale/video MCP errors at1 and only auth
  errors at4. Original native character/upscale assertions stay unchanged.
  Native AbortError20 and aborted healthy response bodies now classify as
  unreachable3; known401/403 retain access classification. Explicit service
  startup retries only its chosen target and reports its URL. Main re-ran the
  existing mock file:49/49 pass0fail0skip. See ignored `c-cli-repair.md` for
  individual red signatures; no OS service operation was executed.
- ResultActions now observes the extension snapshot/controller in the existing
  transport module, so its accepted promise, cursor and original deadline
  survive auth-gate unmount/remount. No new timer or automatic POST was added.
  Explicit cancel and same-epoch ordinary teardown still abort; obsolete unsent
  work rejects by auth epoch. Main read the diff and re-ran the two existing
  pure/contract files:18/18 pass0fail0skip. Independent worker toggled cleanup
  to unconditional abort: deadline assertion failed, restored condition passed.
- J9 no longer uses route.fetch to model refused cookie storage, because its
  context client populates the same cookie jar. A separate owned native client
  observes real204/Set-Cookie without storing it in the browser, then returns
  a cookie-free response; browser status must still refuse App. TLS context
  creation is now inside proxy cleanup. Added accepted-extension UI remount
  scenario explicitly uses synthetic202/terminal with native LAN auth/SSE and
  actual React consumer, not a paid provider request. Hosted run still pending.

## Full UI failure, then focused CI

PR Fast34041113105 frontend hit its existing25-minute job limit. Downloaded
wp09/wp02 artifacts under ignored `wp12s/10ede-pr-ui` and `10ede-selection`.
Core selection records show `GET unexpected-api`, zero catalog reads and zero
submissions; filesystem/process/connection denials are empty. Competing causes:
H1 missing preauth fixture response; H2 App/module crash; H3 isolation denial.
The exact-origin J6 route table lacks the new GET session endpoint and aborts
unknown APIs before App import; captured request/zero catalog and clean guards
support H1, not H2/H3. Add only the local-mode session status literal to the
existing table. Mutation and foreign-origin denials are unchanged; this mock
is not claimed as native auth proof (J9 owns that).

Repurpose the existing focused diagnostic workflow's fixed selector to the
original WP02 Grok API reload flow plus J9, with line reporter. Include the
already-failing native HTTPS session case after the existing builds. No new
workflow/runner, retry, timeout increase or validation weakening. Full CI will
run after the coherent fixes and focused checks converge.

The first diagnostic dispatch was rejected because the colon-bearing command
was an unquoted YAML scalar. Commit3d8c2227 uses a folded scalar; the installed
YAML parser confirms workflow_dispatch and GitHub accepted run34042635661.
This failed dispatch is not a test result. At3d8c2227 the native HTTPS session
step completed successfully; UI scenarios remain in progress.

## Windows build-tool correction proposal (pending review/execution)

Primary source review: npm12.0.0 bundles gyp13.0.0/Undici6.27.0;
`nodejs/undici#5474` repairs paused-parser FIN completion including truncated
body errors. The exact305/758 stack matches both CI failures. A one-line
assertion removal, unchanged rerun, script-policy bypass or matrix downgrade
is not a fix. Newest npm12.0.2 still bundles the affected pair.

Propose exact **development-only node-gyp13.0.1**, lock its resolved
Undici8.10.2, to select the fixed project-local binary during source npm ci.
Registry engine ranges include the pinned22.23.0/24.17.0 build matrix; no
runtime engine or dependency change is proposed. Published consumers and
--omit=dev do not receive this tool: their original install/smoke gates remain
mandatory and cannot be certified from source-CI green. This is a bounded
build-tool defect correction, not general dependency refresh. Do not update
unrelated versions, allowScripts or npm/Node pins. Rollback is the exact two
manifest/lock changes, not an environment mutation.

Remote one-shot SDK comparison retained at `c-windows-sdk.md`: old and new both
passed target24.17.0 checksums on Windows Node24.19.0 (different OS/endpoint than
CI). Main read the new-root receipt directly. No causal closure is claimed from
these samples. Independent C reviewer is assessing the proposed dependency
scope before adoption. Exact-runner lifecycle bin selection and final Windows
install/full tests will be required if adopted.

Independent proposed-edit review returned PASS, explicitly not execution or
consumer-install proof. Applied node-gyp13.0.1 as dev-only: lock adds19 development
entries including Undici8.10.2; **zero existing dependency versions changed**.
Both inspected registry manifests include signed-provenance links and supported
engine ranges. Lock-only generation ran no lifecycle scripts; actual CI npm ci
still runs all existing approved scripts. `npm audit --package-lock-only
--audit-level=high` exits0: three existing moderate advisories, no High/Critical;
no audit-fix or unrelated upgrade was run.

New PR frontend job101512082670 (3d8c2227) independently hit the same parser
assertion during Linux22/npm11.18 installation (bundled gyp12.4.0), confirming
this is not Windows/npm12-only. To observe the corrected executable in actual
lifecycle output, enable foreground-script logging on the existing Windows CI
install step and focused Linux diagnostic install step only. This changes log
visibility, not scripts, checks, timeout, matrix or approval policy.

## Focused native/browser result at3d8c2227

Diagnostic34042635661:32pass/1fail in3.5minutes. Native HTTPS session test,
WP02 reload flow and six J9 scenarios pass. Sole failure: TLS EventSource never
observes OPEN within the unchanged5-second predicate. H1 cookie/host admission,
H2 proxy buffers response headers, H3 connection saturation. TLS App/bootstrap
and Secure cookie checks passed; direct HTTP SSE passed; only two owned SSEs
are used. Source `routes/events.ts:44` flushes headers immediately and sends its
first heartbeat at15seconds, while J9's proxy only calls writeHead/pipe, delaying
the browser's headers until body data. Preserve upstream behavior with an
immediate proxy flushHeaders; no timeout increase, fake OPEN or auth allowance.
Native recheck remains required; H2 is source-supported, not yet closed.

PR backend101512082825: all previous ten failures resolved; sole new failure
is the old #93 source substring `__ima2StopTicks >= 2`, now expressed with
`?? 0` after moving shutdown below the final history read. Update only that
substring to the actual two-tick predicate; the existing runtime test still
asserts two real history reads, timer present after first and absent after
second. Do not change the two-tick behavior to satisfy an obsolete string.
