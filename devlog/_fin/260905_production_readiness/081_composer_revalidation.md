# WP08 P — current composer, input and verification contract

Baseline e835a5f7ff21198c24386d274f592ba41cf4ba93, branch
`codex/prod-wp08-composer`, parent PR208. This amends080 before A/B; it is not
implementation or visual proof. C3 cross-component UI consolidation, C4 care for
hosted fixture isolation. Goal remains ACTIVE; no merge or release yet.

Loop archetype/trigger/goal/non-goals/stop/verifier/artifact remain080, concretized
below. Resources: useful parallel workers without an arbitrary quota, model and
reasoning_effort both omitted for inheritance; no proof of service priority from
prompt text. Four-hour WP reassessment /72-hour whole-goal reassessment from000;
no numeric token budget, no paid generation, no full local suite. Upward: main
reclaims a packet after two distinct actors fail it; downward: only the following
audited lane map, changes require a plan amendment. Stop only after genuine C/D.

Main immediately owns CSS transfer, AST contracts, radius path migration and SoT.
B sidecars: (input) three components +ElementMentionMenu; (component verification)
composerComponent.tsx/Harness.ts andcomposer-input.spec.ts; (hosted geometry)
j6Selection/appServer/j7/geometry helpers andworkflow upload edits. Disjoint writes;
all tests/builds/CI/FSM/git mutations serialized by main. Workers execute no root
npmtest and no local browser. Input/fixture sidecars hand main their exact diffs.

Prior D handoff,079_3: "WP08 consumes080_composer_contract.md, revalidates current
compositor/provider surfaces, closes spacing/height/contrast criteria with real
viewport/pixel evidence, then continuesremainingWPs." Original source geometry
survives at this parent; WP07 does not replace WP08 acceptance.

## Design Read and boundaries

Reading this as an expert image-studio editor: paired positive/undesired drafts
belong to the same operation, with labels and hints subordinate to editable text
and Generate reachable outside the overflowing pane grid. Reference is the
existing DESIGN.md utility profile and003's measured NAI correction, not a new
marketing composition. Preserve the Sidebar + Content macrostructure, bottom
dock alternative and mobile sheet. The paired grid remains
`repeat(2,minmax(0,1fr))`, collapsing at query-container719px.

DESIGN_VARIANCE:3; MOTION_INTENSITY:2; Product density:D5. Repeat expert editing
needs scan speed and stable targets. No added motion: the generic preserve
redesign +1 motion default would add irrelevant movement to this repair.
Typography/fonts/iconography remain the project's current Satoshi/Pretendard,
IBM Plex machine values and existing icons. Existing focused borders retained.
Utility repair is exempt from concept-image generation; no assets/providers run.
Do preserve72/86–148/160/168–144px independent host floors and scroll access.
Do not increase blank space, merge Home/Classic submit policy or introduce a
second sizing engine. Generic marketing spacing/type hierarchy examples do not
override this expert-tool contract. No new dependencies, theme or public API.

Main read current DESIGN.md, all five CSS owners, main.tsx, NegativePromptField,
PromptComposer input/autoheight/mention callers, HomePromptComposer and
ElementMentionMenu, J6 fixture/preflight,080/003/079_3. Current DESIGN.md light
table has stale values; actual index.css wins. Scoped source pairs below are
verified source, not current rendered RGB. Read-only P actors separately mapped
input callers and executable test seams; their reports are research, not A votes.

## Current transfer manifest and cascade

080 transfer ranges still match the current tree. Move whole rules, including
typography/focus, preserving declaration importance, media/container ancestry
and relevant order. Coalesce only identical declarations under identical scope.

| Owner | Move / retain |
| --- | --- |
| progress-composer.css491–531 | Move wrappers/grid/panel/label/hint/stack. |
| progress-composer.css562–582 | Move textarea/focus. Mirror532–561 stays byte/AST-equivalent. |
| progress-composer.css583–630 | Keep sidebar shell tokens; move descendants and719 query. |
| provider-controls.css199–282 | Move every negative rule; NAI settings stay. |
| home-workspace.css260–323,435–436 | Move labels/panes/hints/input/focus and both480 textarea overrides; shell/CTA untouched. |
| classic-workspace.css118–125,147–158 | Move bottom input/grid descendants. Keep86/148 tokens, dock52dvh/420 cap and toolbar no-shrink. |
| responsive-layout.css209–221 | Move stack and both inputs inside800 media. Keep host160 token, sheet/body/actions/tray. |

New composer-panes.css imported once after Home in main.tsx. index imports old
owners earlier; no stale moved selectors remain there. Form-controls' generic
positive placeholder --text-faint is overridden by the later scoped input rule.
Home negative's low-specificity --r-sm base precedes Home --r-xl; preserve the
effective --r-xl without changing the477-row radius oracle. Retain distinct font
metrics, padding, focus and native resize policy. No sidebar/composer-flow change.

progress-composer starts702lines; transfer alone may leave >500. Allowed response
is whitespace-only reflow of unchanged declarations, with AST equivalence proof
of retained rules, not unrelated module extraction or deleted behavior. New CSS
<400lines. PromptComposer499lines gains only a small guard/ref prop: remove a few
blank lines, not an unrelated component redesign. No giant new function/module.

## Contrast correction, not a global AA claim

Current dark muted#90909d/surface2#1c1c23; light#5d5d68/#ececf1. Enabled positive,
negative and Home placeholders use --text-muted/opacity1. Identifying classic
dual pane boundary and Home input boundary use --text-muted. Disabled styling,
focus tokens and other surfaces unchanged. No new radius declaration inventory.
Update structure04 and a scoped current composer note in DESIGN.md, not unrelated
theme tables. Record that old global tables must not be used as measured colors.

Browser measurement reads computed pseudo color AND opacity and composites all
actual ancestor/background alpha. Home input88%, shell86%, backdrop blur remain;
capture actual flat area/pixels and disclose the flat-fixture background assumption.
Assert placeholder>=4.5 and border against inner/outer adjacent backgrounds>=3
in dark and light. Classic boundary is the pane, not borderless textarea. If
actual blur/gradient makes a flat calculation invalid, inspect/sample the actual
region instead of substituting nominal tokens. Oldopacity0.7 and oldborder
mutations each must fail their own independent predicate then restore GREEN.

## Input amendment — three independent IME signals and listener precedence

All three textareas recognize composingRef OR native.isComposing OR
native.keyCode===229 before handling Ctrl/CmdEnter. Negative/Home gain localrefs
with compositionstart=true/end=false; Negative hook must precede provider return.
Classic retains compositionCommitRef/microtask and closes mention on start.
No submit from compositionend. A229 synthetic activation proves fallback behavior,
not an unobserved claim about a particular native browser/IME implementation.

ElementMentionMenu is an additional explicit owner: its textarea native listener
currently consumes modifiedEnter before React. Pass Classic's composingRef as
optional internal prop (only current caller is Classic). Guard ref/native/229
before menu key actions. Ordinary Enter selects once, modifiedEnter bypasses
selection and reaches Classic once; normal Escape/Tab/arrows stay. Classic skips
already-defaultPrevented events and IME before shortcut handling. No invented
globalSubmit dispatcher: the current app has none. Composing Escape behavior of
the independent mobile modal owner is NOT changed or claimed fixed here.

Direct repetition of the short three-signal predicate is preferable to a generic
new keyboard-hook framework. Home still rejects busy/blank and switches Classic;
Classic still rejects missing elements only. Native mention test must cover
compositionend reopening a query followed by229, not only an already-closed menu.

## Additional file ownership beyond080

| Files | Exact delta |
| --- | --- |
| ElementMentionMenu.tsx | Optional composingRef and guarded native key precedence above. |
| tests/composer-feedback-contract.test.js | Focus assertion reads new owner; retain all other assertions. |
| tests/fixtures/contracts/radius-scale.manifest.json | Move ONLY Home/negative textarea source paths; all477 declarations/values retained. |
| tests/nai-dual-prompt-contract.test.ts | Preserve ten meanings via installed PostCSS AST; check ancestor scopes, declaration important and no retired ownership; new contrast/ownership negatives. |
| ui/e2e/fixtures/j6Selection.ts | Optional viewport/profile/uiMode/theme/evidencePrefix + explicit nonGenerating mode. Defaults preserve all WP02 users. |
| ui/e2e/fixtures/appServer.ts | Hosted-only fallback-port absence probe before startup, metadata evidence; keep actualHOME and existing assertions, no local bypass. |
| ui/e2e/j7-nai-negative-geometry.spec.ts | Existing3 plus Home/provider toggle/long text/dark-light cases, real J6 nonGenerating fixture. |
| ui/e2e/fixtures/composerGeometry.ts | Bounded shared measurement/assertion helpers if needed to keep specs<500. |
| ui/e2e/fixtures/composerComponent.tsx | Test-only public React component entry, store callback counters installed before render; no production private exports. |
| ui/e2e/fixtures/composerComponentHarness.ts | Existing esbuild in-memory browser bundle, ReactDOM mount, fresh context, synthetic routes/denied-transport counters; no app-server startup. |
| ui/e2e/composer-input.spec.ts | Exact component IME/mention/policy/mirror tests; hosted preflight mandatory. |
| .github/workflows/{ci,pr-fast}.yml | Always upload wp08 PNG/JSON outputPath artifacts with head/run metadata, existing pinned upload action. |
| DESIGN.md / structure04 | Scoped contract and current proof only after C. |

New test helper filenames may split by geometry versus contrast if one exceeds
500lines; main must record exact names before delegation, no unbounded harness.
No WP09 projection/build receipt producer pulled backwards. Installed ReactDOM,
esbuild, Playwright and PostCSS reused; no npm installation/additional browser.

Field chain: optional composingRef is created from Classic's existing ref, passed
directly as React prop, read by Menu's native handler; no serialization/reviver.
Optional J6Seed viewport/profile/uiMode/theme/evidencePrefix/nonGenerating originate
only in WP08 specs. viewport goes to newContext; profile/uiMode/theme become the
existing localStorage keys consumed by existing persistence/useTheme; prefix goes
only to evidence filenames; nonGenerating goes only to capture policy. Undefined
retains prior defaults. No production enum, persisted schema or migration.

Bypass record: E4 in-process test routing/preflight; executing surface is hosted
Playwright withJ6/component harness. Known bypass: code outside that BrowserContext,
direct server-side networking, or a manually invoked nonguarded fixture. Residual:
not an OS network/process sandbox. Wording is bounded browser denial plus early
warning preflight, NOT complete isolation enforcement. Final OS layer:none inWP08;
WP09 owns stronger projection guards. This does not authorize using the bypass.

## Hosted verification and isolation

Existing withJ6(browser,info,seed,run) has safe browser routing but defaults1280x800,
classic/default; test.use viewport does not govern its manually-created context.
Add optional seed fields above; set nonGenerating:true +expectedSubmissions:0.
Every generation path is recorded and immediately aborted, including malformed
requests, never returned202 in this mode. Unexpected other writes/external/SW/WS
remain denied, guards stay through page close, assert0 after teardown. Metadata
must preserve prior WP02 semantics and default filenames for existing users.

Existing assertJ6Isolation audits actual GitHub-hosted Linux /home/runner,
credential-store absence/secret env names/dotenv/mounts. Child HOME remains actual
disposable OS home; only config/DB/generated are synthetic owned app-data. Do NOT
call this syntheticHOME or OS sandbox. Add bounded TCP connect-refused checks for
OAuth10531 andGrok18645 on IPv4/IPv6 loopback with no HTTP/payload, ONLY after
hosted preflight. Unexpected open/timeout/error fails, no port killing/repair.
Capture fallback probe results, child exit/stub closure, currentSHA/runner/runID,
build step/outcome and viewport/theme in wp08 outputs. Server process isolation
and exact-input dist receipts remain WP09; no source-backed inference substitutes
for current-head build+hosted UI capture. Never3333 or a shared user browser.

Component harness has NO server/provider execution: preflight then bundle public
components+store in memory; route HTML and bundle from a synthetic owned origin,
block everything else except exact synthetic GET assets responses. SW blocked,
WS closed, fetch/XHR/EventSource attempts recorded even if product catches errors.
Set store.generate async counter before render and synthetic element catalog.
No production handler export and no real generate request. Close every context,
remove handler/bundle references; assert denied unexpected attempts after teardown.

## Constructible acceptance matrix additions

- P08-1/2/3: both textarea floors72/86/160, bottom computedmax148 AND actual<=148,
  dock<=min(52dvh,420). Sequentially reveal label/textarea/hint; clipped offscreen
  pane permitted only with working scroll. Long multiline proves scrollHeight>
  clientHeight and actualscrollTop change. Toolbar actual nested buttons receive
  center hit and enabled trial click after short draft enablesSave. NeverGenerate.
- P08-4: actual NAI→MiniMax→NAI controls, preserve both drafts anddisplaycontents.
- P08-5: Home1440/390 floors168/144, actual container branch719/720 observed,
  nonNAI unchanged. Empty-enabled dark/light placeholder+boundary thresholds above.
- P08-6: eachCtrl/Meta, eachClassic/Home/negative variant: ref-only(start then
  nativefalse13), native-only(true13), fallback-only(end thenfalse229) count0;
  compositionend/microtask alone0; next ordinary chord1 after complete bubbling.
  Popup plainEnter selects/noSubmit; modifiedEnter oneSubmit/noSelection. Home
  busy/blank0, Classicmissing0, Classicbusyvalid1. Preserve normalEscape and plain
  multiline Enter. All callbacks mocked before mount; no generation POST.
- P08-7: public addReferenceDataUrl then removeTrayItem(tokenId) creates actual
  retired tag while prompt literal remains. Test actual DeadTagMirror after
  textarea scroll/resize: alignment and pointer transparency, no negative menu.

Mutation plans: isolated test-only stylesheet overrides or owned source mutations
for72floor, dual gridscroll, placeholderopacity andboundary; independent assertions
must REJECT, then same assertion restoredPASS. IME remove each signal/native-menu
guard must be caught by independently activated case. Never count untouched code
or assertions merely checking finite ratios as mutation success.

## Exact commands and prior observed evidence

P main ran at e835 (direct files, never npm test filters):
`node --import tsx --test --test-reporter=dot tests/nai-dual-prompt-contract.test.ts tests/composer-mention-parity-contract.test.js tests/mobile-compose-sheet-accessibility-contract.test.js tests/model-select-lane-gating.test.ts tests/composer-feedback-contract.test.js tests/ui-radius-scale-contract.test.ts tests/ui-typography-rules-contract.test.ts tests/element-mention-ui-contract.test.js tests/mobile-composer-tray-contract.test.js`
Result88PASS, exit0. Source contracts are NOT rendered/input callback proof.

C main reruns exact direct files through cxc receipt, UI app/E2E typechecks,
`npm run ui:build`, inventory and focused changed contracts. Hosted runner builds
exacthead then `(cd ui && npm run test:e2e -- j7-nai-negative-geometry.spec.ts composer-input.spec.ts)`;
canonical exact-head CI runs full suite remotely and all existing E2E. Capture
baseline failures once on hosted input tests before guards, preserve RED evidence,
then currentGREEN. No local browser run, no full local suite.
Independent C source reviewer plus two real visual oracles inspect actual current
PNG bytes and metrics; old003 captures are reference only. Main synthesizes all
findings before repair, then current proof/D task closure and nextwp08c P.
