# WP02 replan027 C repair synthesis

Atcc16c85e /CI33948530252, both Node legs failed five named source contracts:
PromptComposer split-line budget, whole-file MCP identifier exclusion, old inline
dispatch predicate (multimode and custom-size files), and old rawmode subscription.
Actual123focused behavior tests and UI types passed. Preserve all semantic checks
and the existing500-line guard; never raise budgets or add obsolete code/comments.

Repair: extract the current MCP-compatible pure display selector into the existing
coreGenerationMode owner (`composerUsesMultimode`), independently test core andMCP
inputs, then subscribe to it directly inPromptComposer. This removes UI branching
from the nearly-full component, not mention/caret behavior or preference support.
The component returns below500lines. Update only the three superseded wiring
assertions in multimode-ui-contract.test.js and size-custom-input-contract.test.js
to the actual shared helper/selector calls; existing dispatch/custom-size behavior
tests and their independent expectations remain. No alias string planted incomments.

Browser:5cases failed hitTestable at768;16passed. Investigate before CSS edits:
- H1 actual controls hidden/broken: falsified by samecapture pageBounds showing
  correct mobile controls at12..124 and128..756, plus directly observed PNGs.
- H2 stale desktop element held across responsive/font await: predicts zero boxes
  only for capturedlabel handles while the currentheader has nonzero mobilebuttons.
  All fivefailedmetrics show precisely that; failures follow1024->768 transitions.
- H3 overlay blocks legitimate target: falsified by zero-size handles, rather than
  positive boxes with a hit target elsewhere; no sheet had opened beforefirst768.

Source: App data-mobile changes after useIsMobile's matchMedia subscription. The
`:visible` locator can resolve a desktop control before React updates it, then
labelGeometry awaitedfonts while holding that element. Main observed finalPNG
showing fullComfyUI/Selectedvideo, while capturedcontrolRect wasall0. Thus this is
a measurement race, not evidence to weaken the hit/size/text checks.

Repair fixture sequencing only: after each viewport change wait for actual App
data-mobile and appropriate MobileAppBar presence/absence, then visiblecontrols.
Await fonts at page level before resolving element; evaluategeometry synchronously
without holding a handle acrossawait. Do the same onviewportrestore. Keep every
geometry/hit/overflow assertion and timeout; no sleeps/retries/threshold increases.
Also await open-sheet settledtransform and closed-sheet hiddenvisibility before
captures/nextviewport, because an observed390 frame caught the existing180ms close
transition. Do not change productionmotion or screenshot over a moving sheet.
No network guard relaxations, added mutation routes, sourceCSS or generation changes.

After selector extraction/wiring repairs:60focused testsPASS, including all five
previously failed contracts, actualtransport/custom-size cases and newpure MCP/core
selector assertions. PromptComposer is499lines (500 including trailing splitrow),
so its original guard remains unchanged and green. No mention/caret code changed.
UI/E2E/test typechecks are rerun before commit; hosted measurement closure pending.
