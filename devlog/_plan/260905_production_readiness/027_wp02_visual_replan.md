# WP02 P replan — execution meaning and readable selection

ClassC3 frontend integration; satisfy-spec. Trigger: dual visual review of actual
85e1cfff captures found effective-dispatch/Sequence chrome disagreement and different
workflow choices becoming identical closed-control pixels at390px. Goal: display
the action that will execute, and expose a readable selected provider/model without
changing saved preferences or request routing. Non-goals: new design system,
provider availability/status redesign, arbitrary global control restyling, auth,
graph/history changes, WP08 pane/contrast/IME work, paid generation.
Verifier: shared pure mode matrix + actual transport tests, rendered badge/placeholder
and selection text geometry at desktop/tablet/mobile; exact-head hostedCI and dual
visual review. Stop only after the new regressions pass. Memory:020-027 and current
CI artifacts. Resource/authority bounds inherit000 (4hWP/72hgoal reassess, no budget
expansion). Upward: main reclaims after two packet failures. Downward: only disjoint
assignments written below; new scope requires another amendment.

## Gate and evidence continuity

No WP02 completion was recorded. Main resetC toIDLE then enteredP with its bound
session; wp02 remainsin_progress andc-3open. This is a replan attempt, not a fakeD.
At94489a90, hosted frontendCI33947106997 already passed the repairedfixture:
10scenario records,8expected submissions, unexpected0/stubCalls0, all isolation
and teardown proofs true. Remaining full jobs were pending at capture. This proves
selection/request behavior, not final visual acceptance after the next changes.
Both read-only visual oracles reviewed13PNG frames (1280x800/390x844): accept
Sequence mismatch as WP02 integration blocker; accept closed-label identification
gap as needing explicit repair here. Do not waive because CSS itself is old.

Separate baseline issue: RHS Comfy missing core entry/MCP label/GPT controls and
hardcodedfalse availability. Not a wrong dispatch claim; source owners are unchanged
byWP02. Registeredwp08c/085 plusc-17 and WP13provider-display-gate require its own
audited implementation before merge/release. It is not silently delegated to080,
whose provider-semantics non-goal stays intact. No overall production-ready claim.

## Exact additive write map for this replan

| Action | File | Owner and delta |
|---|---|---|
| NEW | ui/src/lib/coreGenerationMode.ts | MAIN: pure effective image/multimode/video decision below |
| MODIFY | ui/src/store/storeGenerateEntryImpl.ts | MAIN: replace its existing inline decision with the shared helper, preserve pre-guards and pending continuation |
| MODIFY | ui/src/components/PromptComposer.tsx | MAIN: derive rendered multimode from same core helper, preserve existing MCP rendering preference |
| NEW | tests/core-generation-mode.test.ts | MAIN: independent literal mode matrix including unsupported/unknown/stale combinations |
| MODIFY | tests/nai-client-options-contract.test.ts | MAIN: replace obsolete inline NAI predicate assertion with actual helper result; preserve n=1 assertion |
| MODIFY | ui/src/components/MobileAppBar.tsx | layout worker: move selector from icon-action row into own full-width second row, same component/events/ids |
| MODIFY | ui/src/styles/responsive-layout.css | layout worker: two-row mobile header grid and scoped full-width selector allocation, retain sticky/safe-area/footer/focus behavior |
| MODIFY | ui/src/styles/canvas-accordion.css | layout worker: full wrapping selected text within this selector only, preserve colors/fonts and existing widths outside mobile header |
| MODIFY | ui/e2e/fixtures/j6Selection.ts | browser worker: reusable visible-label geometry and effective-badge checks; same strict guards |
| MODIFY | ui/e2e/core-selection.spec.ts | browser worker: mode/label assertions, viewport cases, open-menu/focus path and fresh screenshots |
| MODIFY | ui/e2e/j6-model-select-label.spec.ts | browser worker: exact unknown-id readable checks under new layout |
| MODIFY | structure/01-file-function-map.md, structure/04-frontend-architecture.md, docs/migration/runtime-test-inventory.md | MAIN C: new shared owner, tests and layout responsibility |
| DELETE | none | No persisted-key/schema/data deletion |

New modules<250lines/tests<500. Existing oversized CSS/components get bounded
scoped changes; no unrelated extraction to make a diff larger. No dependencies,
new colors/fonts, static asset generation, shared Select component API change,
changes to MobileComposeSheet focus ownership or beforeunload graph guards.

## Shared effective mode — exact contract

```ts
export type CoreGenerationMode = "image" | "multimode" | "video";
export function effectiveCoreGenerationMode(input: {
  provider: string;
  uiMode: string;
  multimode: boolean;
  videoModelSelected?: string | false | null;
  comfyVideoWorkflow?: string | null;
}): CoreGenerationMode;
```

Import only isCoreProviderId and PROVIDER_SURFACE_SUPPORT from generated/providers.
Order exactly matches the current verified generateImpl decision:
1. Comfy+nonemptyactivevideo workflow, or Grok/GrokAPI+videoModelSelected =>video.
2. uiModeclassic &&multimode &&provider!==nai &&isCoreProviderId(provider)
   &&surface.multimode.supported =>multimode.
3. Otherwiseimage. No map lookup before membership guard; no auth/catalog I/O.

generateImpl keeps composePrompt/empty/missing-element guards first; resolvesmode
once; video calls existingrunVideoGenerate; useMultimode=mode===multimode feeds
the exact same custom-size continuation and image/multimode branches as today.
Node entry functions untouched. No provider/client payload changes in this replan.

PromptComposer replaces rawmultimode subscription with a boolean selector:
`s.mcpProvider ? s.multimode : effectiveCoreGenerationMode(s) === "multimode"`.
Thus every existing use of that local variable (placeholder,class,aria-label,
mode badge) stays synchronized, without five independently maintained predicates.
MCP-specific generation is outside this core helper; its current display remains
unchanged. No stored preference is cleared, written, or mirrored into new state.
HomePromptComposer has no multimode rendering consumer; it needs no change.
The samePromptComposer is reused in sidebar/bottom/mobile sheet.

Field chain: existing AppState fields create the input; existing storage serializes
them unchanged. New mode is ephemeral derived data, never serialized/deserialized.
Consumers are exactlygenerateImpl andPromptComposer. Video ids/capabilities remain
owned by previous WPs. No new Provider/UIMode member or persisted schema.

## Selected-text layout — exact implementation direction

Existing `.gen-provider-model` has max178px, provider82/model92; compactmax92 with
42/46px controls. Existing globalSelect correctly usesellipsis; do not alter it.
At390px this hides xAIAPI/Grokvariant and makes distinct Comfy values identical.

In canvas-accordion.css, scope to `.gen-provider-model .ctl-select__value`:
white-space:normal; overflow:visible; overflow-wrap:anywhere; text-overflow:clip.
Do not use line-clamp/max-height. Buttons already grow with content; widths and
font10.5px/mono stay unchanged on desktop. A label may take additional lines, not
disappear. Keep value-sub reasoning and caret placement; do not hide model identity
with another icon. Unknown workflow IDs remain literal, not shortened aliases.

MobileAppBar: brand and three existing action buttons stay in first row; move the
existingGenProviderModelSelect into a new `.mobile-app-bar__selection` directchild
after the actions div. No duplicate selector. Mobile header becomes grid with
`grid-template-columns:minmax(0,1fr) auto`, selection `grid-column:1/-1;min-width:0`.
Its `.gen-provider-model.is-compact` becomes fullwidth/max-widthnone with nowrap;
provider flex0 0 112px withmax-width40%, model flex1 1 0/min-width0/widthauto.
These overrides are scoped under the new mobile selection wrapper and loaded after
basecompact widths; set both selector buttons min-height44px. Preserve the existing
Use explicit `.mobile-app-bar__selection .gen-provider-model.is-compact` ancestry
for provider/model overrides so the existing three-class compact width rules cannot
win by specificity. The new min-height targets `.ctl-select__trigger`, not the
legacy `.image-model-select__trigger` class absent from these current buttons.
icon button widths and <=430 brand rule. No absolute-positioned second row or
fixed header height. App's auto rows and visibleoverflow adapt to content height.

No downstream64px offset depends on the bar; existing minimum64 is not an exact
height. Verify rather than assume containment at320/390/768/1024/1440, open menu
portal/focus return, and that the generate opener still opens the prompt sheet.

## Acceptance additions (not replacements)

- Literal pure matrix: Comfy image+storedmultimode=>image, Comfy video=>video,
  NAI=>image, GrokAPIvideo=>video, OAuthclassic+multi=>multimode, nodeUI=>image,
  malformed/prototype provider=>image, storedstrayvideo outsideGrok ignored.
- Existing realtransport/custom-size tests remaingreen; none of their actual
  expected requests or count/preferences may change.
- Comfy image/video browser journeys with savedmultimode=true: noSequence badge,
  no composer--multimode class, generic (notsequence) placeholder/aria label;
  storedmultimode stays true and outgoingpayload stillmatchesselectedworkflow.
- Positive control: OAuth/GrokAPI classicmultimode stillrendersSequence when active;
  switching away/back preserves savedtoggle and updates chrome without storageclear.
  Use source/bundled render proof or strict hosted fixture, no paid submission.
- At1440/1024/768/390/320, provider/model fulltext matches actual selectedvalue.
  Compare independent displaylabels (5.6l/Selected image), not raw wireids; only
  unknownworkflow labels must match their literal storedID.
  Capture DOM text/client/scroll bounds and textRange rectangles: no text rectangles
  outside control and scrollWidth<=clientWidth (small rounding tolerance). Merely
  checkingtoHaveText or CSS textOverflow is insufficient. Current42/46 geometry is
  the failing baseline; screenshots must visibly distinguishimage/video and three
  different workflowids. Read every new frame or assign it to the visual oracle.
- Narrow open model menu shows exact selected label/id; Escape returns focus to
  trigger. Generate opener still opens owned prompt sheet. No controls overlap,
  Check mobilebadge/placeholder only AFTER opening that real prompt sheet, never
  inferabsence from a hidden composer. Also verify close returns focus to opener.
  horizontalpage overflow or clipped label; mobiletrigger targets>=44px high.
- Preserve existinghosted guards, expectedPOSTcapture, unexpected0,stub0, true
  teardown; no new exception allowing graphPUT or real server generation.

Existing source verifiers at944:120focused tests0, UI/E2Etypes0, browserCIPASS.
CI33947106997 subsequently completed SUCCESS for bothNode22/24 and frontendE2E;
this is the pre-replan baseline, not approval of the forthcoming render changes.
New core-generation-mode.test.ts is pending/not executable untilB; existing test
transport sees actualentry/helper and namedUIconfigs include changedTSX. New CSS
correctness uses real hosted render/geometry, not static string tests. Local full
suite remains prohibited; final exact-headCI must pass after all edits.

Rollback is code-only: revert this replan's helper/consumer/layout/tests as one
logical patch. No persistent values or user data to restore. SoT files above are
updated inC. Security tierE7 clientconsistency; API callers can bypassUI and server
validation remains final; this is not auth enforcement or upstreamsuccess proof.
