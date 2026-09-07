# WP09 A round1 — synthesis and required repairs

Audited headcbad8d09. Main accepts all nine findings as concrete plan gaps.
Runtime Dirac: FAIL4; receipt Ptolemy: FAIL2; UI Averroes: GO-WITH-FIXES3.
No A→B transition is permitted until the amended packet is re-audited. No code
implementation has begun. These are static findings, not runtime failures.

## Root causes and dispositions

| Finding | Root cause | Accepted repair |
| --- | --- | --- |
| R1 AGY discovery dirties guard | Blanket home migration-subtree denial catches an actual model-discovery existsSync path not in the expected set. | Add only exact home/.npm-global/bin/agy (agy.cmd on Windows) existsSync as expected refusal; keep content/open/copy denied. Actual models activation proves original metadata/content calls0. |
| R2 empty MCP config is not disabled | config pickStr discards empty joined array and restores defaults. | Preserve current J6 separator override IMA2_MCP_PROVIDERS="," in every child environment, including missing/malformed-config tests. Assert actual config enabledProviders=[] in each case. |
| R3 source poison cannot reach projection | Hosted preflight correctly rejects contaminated checkout before prepareRuntime. | Separate synthetic projection-inventory exclusion, contaminated-checkout preflight rejection and clean-checkout startup with post-projection poison. Do not weaken preflight. |
| R4 unowned existing J6 test | Frozen map missed its synthetic launch harness and old tsx/HOME/write-count expectations. | Main owns migration of tests/j6-isolation-preflight.test.mjs; retain hosted/port/zero-real-startup cases and update only launch/env/projection expectations. |
| B1 Tailwind input hole | Automatic class scanning reads beyond positive receipt inventory and uses ignore metadata. | Constrain strict-build scanning to explicit individually certified inputs; ordinary build unchanged. Add unlisted-candidate/ignore-change and effective dependency tests before certification. |
| B2 receipt modules omitted | New split was not propagated into its own input/watch chain. | Add Schema/Files/Transaction MJS paths to exact inventory/watchers; include the new strict Tailwind helper/declaration through ui/dev. |
| U1 parser sees normalized data | Legacy MCP getters replace malformed/missing arrays with[]. | Add strict observation-only GET exports at existing client/transport owners, returning raw envelopes without legacy normalization. Preserve legacy getters and their compatibility tests. |
| U2 canceled read changes shared cache | jsonFetch swallows body-read rejection; listMcpProviders then assigns[]. | New observation transport propagates body errors/abort and does not touch providerCache. Test after-headers cancellation, unchanged primed cache and no late popup update. |
| U3 build command evidence lies | Workflow command changed but WP08_BUILD_COMMAND did not. | Update both workflow evidence variables to actual build:fixture command and assert emitted command/outcome match the build step. |

Cross-finding conflicts: raw observation reads must not reuse the legacy cache-
mutating normalized path (U1/U2); preserve it for existing callers instead of
breaking their omitted-array contract. Source-poison tests must not defeat the
hosted gate (R3). Strict Tailwind input closure belongs to fixture build only,
not an ordinary-build global restriction (B1). No effort buckets or gate waivers.

## Strict Tailwind source contract

Main confirmed installed Tailwind Vite plugin builds an automatic **/* scanner
from the Vite root when compiler.root is null. Official source-detection docs
confirm automatic/ignore filtering and source(none)/explicit source directives:
[Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).
Only these documented features are used; no new dependency or custom Tailwind
compiler/scanner implementation is introduced.

ADD `ui/dev/fixtureTailwindSources.mjs` and its `.d.mts` declaration; MODIFY
ui/vite.config.ts to install this pre-transform plugin only when the wrapper sets
the private fixed `IMA2_UI_RECEIPT_BUILD=1` flag. Ordinary build configuration,
source CSS and automatic scanning stay unchanged. Both new files are bound by
ui/dev inventory; all three receipt implementation modules are explicit inputs.

The helper exports `fixtureTailwindSources(): import("vite").Plugin`; its
configResolved hook derives repoRoot from the verified Vite ui root, and it keeps
one build-local certified inventory. Vite config inserts it before Tailwind only
for the fixed private flag. Wrapper sets that flag; it is not caller-controlled
receipt metadata. Public receipt facade/declaration adds
`inventoryUiSourceInputs(repoRoot: string): Promise<FileDigest[]>` and source
snapshot reuses that exact implementation. The plugin must observe transformation
of the canonical entry and reject a build that never visits it, rather than issue
a silently unbounded certificate. No filesystem receipt is written by the plugin;
only the original nonce-bound parent transaction publishes after Vite succeeds.

The plugin obtains the same validated source-file inventory used by the receipt
through an additive public `inventoryUiSourceInputs(repoRoot): Promise<FileDigest[]>`
export. It transforms only the canonical ui/src/index.css Tailwind entry in memory:
`@import "tailwindcss" source(none);` followed by individually listed @source paths
from certified UI text inputs (src/public/dev/e2e and index.html). No directory
glob or arbitrary caller-provided source is accepted. Normalize relative POSIX
paths; reject control characters/glob metacharacters rather than creating a
pattern that can match unlisted files. Emit correctly quoted CSS strings.

Before compiler execution, reject custom @source/@config/@plugin declarations in
selected CSS and additional Tailwind entry imports; the current source has none.
This strict test-build restriction fails closed with a fixed code, including a
conservative rejection if such syntax appears in comments. It is not a generic
CSS parser or a restriction on ordinary builds. The plugin checks the canonical
entry form and refuses an unexpected shape instead of silently doing nothing.

Use Vite's final dependency/watch-file inventory as an additional binding check:
every real local input must be in the certified set or trusted installed dependency
roots; virtual IDs/generated outputs have explicitly classified handling, not a
blanket path skip. Unknown real input blocks receipt publication. Tailwind's
explicit file list eliminates ambient ignore selection as a source of candidate
changes; verify that with the installed compiler, not just string inspection.

UIR-4/8 additions: an unlisted ui/receipt-canary.html with a unique class never
changes strict output and cannot enter its dependency/candidate set; ordinary
build still discovers it in a disposable fixture. Ignore-rule edits cannot alter
strict candidate selection; selected-file edits/additions and all helper module
edits still invalidate snapshot/transaction. Explicit forbidden @source or a
foreign CSS/module import fails the strict certificate path. Test normal fixture
output/rendering to ensure restricting unused candidates did not remove required
classes. A changed production source root needs a deliberate inventory update.

## Raw non-mutating MCP observation transport

MODIFY api-core.ts with `jsonGetObservation(url, signal?): Promise<unknown>`:
GET only, existing same-origin fetch defaults, no browser ID/auth invention. Check
signal before/after body parsing. On HTTP error cancel the body and throw a fixed
error with status; cancellation cleanup must not replace that HTTP status. On
success await res.json without catch-to-empty normalization; abort/body/schema
errors propagate. Existing jsonFetch behavior remains unchanged for old callers.

MODIFY mcpProviders.ts with readMcpProviderObservation(signal?) and
readMcpModelObservation(provider,signal?) wrappers around that transport. Reuse
central route path constants/builders with legacy functions, but never assign
providerCache in these exports. Return raw envelopes. parseMcpReadinessData now
requires ok:true and validates providers/models before reducing consumed fields;
legacy getMcpModelCatalog still returns empty missing arrays as its tests require.

UI worker owns these two additional client files and focused observation tests.
Tests begin at fake HTTP/Response bodies, including malformed video:null alongside
a valid selected image; popup must show error, not ready. Prime the real existing
provider cache, return200 headers then hold/error the body and abort; the cache
must remain byte/identity-equivalent and no observation update occurs after close.
Test JSON syntax failure separately from HTTP401/403/503. No real MCP/provider or
local app calls are needed for root tests; actual modal lifetime cases are hosted.
