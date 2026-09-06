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
