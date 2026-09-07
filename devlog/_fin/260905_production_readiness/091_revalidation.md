# WP09 P — current-tree revalidation (in progress)

Baseline `7e2f084d82b8f7852be96636ced65d485c17076c`, branch
`codex/prod-wp09-journeys`, parent PR210. Previous D089_0 directs this phase to
revalidate090 and carry node HUD, composition interruption, Home roster/mobile
navigation and actual-MCP popup residuals. Main read all1325 lines of090. This
document records current evidence and amendments; P is not yet ready for A.

## Loop and boundaries

C4 test execution boundary with C3 UI journeys. Spec-satisfaction: preserve
developer data and credentials while proving real local-fixture state transitions.
No paid/live provider calls, local app/browser startup, auth/home probes, new
dependencies, broad local suite, reset, force-push or unrelated data changes.
Pure synthetic root tests and typechecks are allowed; actual guard/startup and
browser scenarios remain disposable GitHub-hosted only. Reassess at4h/WP and72h
overall, no numeric token budget. All spawns omit model and reasoning_effort.
Upward: main reclaims after two distinct failed packets; downward ownership must
be fixed in this P before B. No leaf orchestration or fan-out.

Stop after the revalidated UIR/I/J/G/T/E/R rows pass, current-head artifacts are
actually inspected, independent audits and teardown checks pass, and the scoped
stack layer is reviewable. Unknown startup transport is a failing test, not a
permission to weaken isolation. Existing source/installed runtime build contracts
remain compatible. No claim of OS sandboxing or malicious-native-code containment.

## Verified source map and stale claims

`cxc map ui/e2e/fixtures` identifies appServer/startApp as the current subprocess
owner, stubUpstream as the upstream owner, J6 as scoped browser routing, and
WP08 component transport as a separate serverless path. Main read these owners,
tsconfig root/build/bin, Vite config and actual compiler inputs. No WP09 receipt
or projection implementation exists yet.

- `appServer.ts:222` still launches `node --import tsx server.ts`; non-J6 starts
  inherit process.env and use a200ms close delay. J6 has a real hosted preflight,
  env allowlist, fallback-port refusal and awaited child shutdown. Preserve these
  protections rather than treating all existing starts as equally unsafe.
- `seedBrowser:164` still reseeds on every document. J6's separate `seedEntries`
  uses context storageState once already. Change the former, preserve the latter.
- Current AppHandle.isolation is optional J6Isolation, consumed by all J6/Comfy/
  composer evidence. New isolation diagnostics cannot silently replace that shape;
  preserve old provenance fields and add a typed guard record/contract explicitly.
- There are179 browser cases in15 files, not11 in7. Existing composerGeometry,
  composerContrast, comfyDisplayEvidence and isolatedComponentTransport already
  own measurements/guarded assets. Reuse them; do not add the old proposed
  composerAssertions duplicate blindly. All179 inherited assertions remain.
- Existing route-test guards cover DNS/TCP/TLS/HTTP2/UDP and custom-promisified
  process paths with sentinels. They are not preload-safe reusable modules: they
  import node:test/provider fixtures and mutate process-global state. Reuse their
  patterns and independent negative cases, not their app/test import graph.
- `codexDetect.ts:14` caches homedir at import; quota reads default homedir and
  tries `grok version` even when auth is absent. Guard-before-import remains
  necessary. `storageMigration.ts:99-145` still contains explicit global and
  home-prefix discovery paths; expected denied metadata is not allowed content.
- Runtime card templates live in cardNewsTemplateStore and sanitized MCP assets
  in mcp/snapshotStore. Preset compiler/motion modules are pure TS; UI imports
  their root emitted JS. Separate these build inputs from runtime data roots.

P baseline executed: Playwright `--list` exit0,179 cases/15files (no browser
allocated); J6 preflight12 cases plus execution-network6 and process2 synthetic
cases passed. The outer isolated-process runner reports14 including2 wrappers;
do not conflate that with the20 leaf cases. These are existing-boundary proofs,
not future WP09 guard/projection implementation proof.

## Build receipt feasibility synthesis

Sidecar Mill's ordinary/fixture separation, prebuild order, explicit ui/dev input,
watcher fail-closed and Git/archive cautions are already specified in090. Retain
them rather than inventing missing decisions. `.gitignore:4` covers node_modules,
`:17` covers ui/dist. No new ignore or release-clean exception is needed.

Main found a stronger concrete gap: `ui/dev/resolveDevApiTarget.mjs:23-29` reads
the advertise file under homedir when the target is absent. Allowing an absent
VITE_IMA2_API_TARGET in the wrapper can therefore read outside the declared build
input inventory. For strict fixture builds, always pass the fixed non-service
`http://127.0.0.1:1` target to compiler/Vite children, before Vite config loads.
The original ordinary build remains unchanged. Add an actual wrapper sentinel
test proving no advertise/home read happens with an absent caller target and
that a caller's different target is rejected without logging its value. This is
build determinism/privacy, not a network request or live-service probe.

Keep declaration/public API from090, but split implementation by responsibilities
if needed before writing: inventory/schema/digest versus exclusive transaction/
watcher lifecycle; no broad generic utilities. Exact module map and safe wrapper
child environment are still being specified. A sidecar's suggested300–380-line
combined module is not evidence that all required negative paths fit that size.

## UI residual synthesis (candidate; main owns final scope)

Main verified NavRail's enabled product items and nav-rail.css:84–130. Seven44px
targets plus minimum16px side padding require324px before label width, exceeding
320px. Actual prior captures also show crowded labels. This is a real narrow-nav
problem; do not remove labels or shrink touch targets as a hidden test concession.

Actual-MCP popup is also a current source bug: it reads mcpProvider but otherwise
falls back to underlying core availability/model facts. Keep the new Comfy arm,
and plan an MCP-specific observation/facts projection using existing MCP owners.
Neither issue justifies duplicating catalog state or rewriting WP08 panes.

Node HUD/default-fit, Home roster destinations and interrupted composition need
hosted behavioral evidence before choosing fixes. Store-backed drafts are not
proof of focus/composition lifetime. Reject the sidecar's effort buckets; phase
ordering follows dependency and independently verifiable outcomes only.

Before A, reconcile these production deltas with090's old test-only scope,
enumerate all current startApp/test consumers, finish the module/file ownership
map, and name explicit activation scenarios and rollback. No B code was written.

## Official API checks (2026-09-05 UTC)

Primary Node docs were opened, not treated as search-snippet proof:
[fs.watch](https://nodejs.org/api/fs.html#fswatchfilename-options-listener),
[built-in ESM modules](https://nodejs.org/api/esm.html#built-in-modules), and
[util.promisify](https://nodejs.org/api/util.html#utilpromisifyoriginal).
These pages currently identify Node26.8.1; their version-history entries and
stable API semantics inform the plan, but do not replace pinned22/24 execution.
The version-specific22.23 URLs could not be opened; no fallback claim of exact
version-document verification is made. HTTP-only agbrowse resolved and returned
strong_ok for the public filesystem page; no local browser was started.

- Recursive fs.watch support on Linux was added in19.1.0. The sidecar's generic
  suggestion of absent Linux support is not a current compatibility conclusion.
  Platform/filesystem caveats still apply. A null callback filename must invalidate
  a strict transaction instead of silently ignoring an unknown change. Parent
  directory watching matters when an input inode is replaced. Unsupported/error
  cases remain fail-closed and are tested on pinned runners.
- Default builtin mutations do not automatically update named ESM exports;
  syncBuiltinESMExports and guard-before-import are part of the actual boundary.
- util.promisify returns a custom symbol implementation when present. Process
  traps must be fresh functions without inherited/copied custom executors; reuse
  existing execution-process-isolation sentinel cases for direct and promisified
  calls. A default-export-only trap is insufficient evidence.

Main current consumer inventory: startApp is called byJ1–J5,
provider-surface-affordance andJ6. J6 feeds Comfy, geometry and tracking specs.
The two serverless composer/Manager fixtures do not need appProjection and must
retain their existing asset/transport guards. All startApp consumers must use
the auto-owned cleanup fixture, including newer specs omitted by old090.
AppHandle.isolation's current J6 provenance fields must remain serializable for
those evidence writers; new guard counters belong in an additive nested record.
Never drop existing hosted preflight because a new JavaScript guard was installed.

## Remaining architecture decisions before A

The old projection design recompiles the entire server and CLI for every start.
That was sized around eleven cases; the current suite starts many independent
apps across179 cases. Do not silently add repeated whole-tree compiles to every
journey. Main will specify one worker-owned verified emitted-source cache with
fresh source/compiler/output binding checks, then a separate per-start runtime
projection and owned home. Cache reuse must reject changed source/compiler/output;
it must not be a stale emitted-JS fallback or a global persistent build service.
No implementation or measured performance claim yet. The existing single-worker
Playwright setting stays unchanged; resource budgeting is not a reason to skip
any activation row.

Guard installers need explicit submodule boundaries rather than squeezing all
filesystem variants into one long module: canonical path/policy checks, descriptor
tracking, filesystem API wrappers, process guard, network guard, and parent-only
ownership/projection construction. Every runtime guard helper must be explicitly
added to the positive source-copy manifest; parent builders must never be copied
as preloads. Define the actual public signatures and file list before assigning B.
Source test fixtures are examples, not permission to import node:test or provider
adapters into the guarded runtime. No generic utils or unbounded module scan.
