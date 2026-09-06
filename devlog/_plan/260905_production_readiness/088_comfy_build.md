# WP08c B — audited execution ownership

087 roundtwo independentlyPASS fromBeauvoir(resource) andCopernicus(UI/fixture).
All six roundoneitems folded explicitly, no remainingblockers. Baseline1f740951
docs over22dfa811 source. Main will attestA→B before productionchanges.

Write ownership: main api-comfy/laneCatalog/useLaneCatalog/comfyDisplay,
tests/_laneCatalogFixture.ts/lane-catalog.test.ts/comfy-display.test.ts/
selector-comfy-admission.test.ts plusSoT/generators. Selectorworker
GenProviderModelSelect, canvas-accordion.css/responsive-layout.css,
tests/comfy-ui-contract.test.ts. Presentationworker ProviderStatusSelect,
GenerationControlsPanel/newComfyGenerationControls, ProviderReadinessPopup,
HomePromptComposer, ComfyWorkflowManager, Select optionaldescriptionprop,
fourlocales andprovider-ui-polish-contract.test.js. Verificationworker J6+CI
andnewComfy specs/managerfixtures/sharedtesttransport extraction (including
composerComponent/Harness imports only). No write overlap; no leafexecution.

Main API contract forworkers:085 types/signatures plus
`comfyDisplayMessageKey(display:ComfyDisplay,snapshot:LaneCatalogSnapshot):string`.
It returnsfixedi18nkeys; availablelane-only hook may chooseavailable key directly
whenlaneAvailabletrue, not use choose-state asnegativeavailability. Addshort
comfy.display.empty. Standardcode tones: readyok; error/disconnected/selected-
offlinebad; othercodeswarn. PlainAPI successfulwrite remainsseparate from
observationalrefresherror. No sourceclaims beforetests/renderedproof.

Main implemented parser/resource/hook/projection and17behavior tests (3rootfiles
+minimalfixture). All17PASS, testtypecheck0. Actualmodule parser rejectsmalformed
root/status/rows andpreservessafeownunknownkeys; resource noimportIO/oneinitialread,
obsolete/finally/reentrant/unsubscribe/remount/focus/error classesverified viafake
fetchonly. Pureprojection covers media-specificsameID/empty/missing/offline/locked/
stale/lane-vs-selection andfixedcopy. ActualSelector publicSelect callback SSR
tests covercurrentstate/latecallbacks/ghosts/MCPreservedvalues/hostedcompatibility.

Workersinitiallymistook explicitlylistedNEWfiles as requiringnewpermission;
mainclarifiedexactpaths andcontinuedthesamepackets. No boundary bypass. Selector
worker partialrepair stillhad JSXmissingparenthesis; mainreclaimed/closedlane,
fixedsyntax, correctrefreshkey andkeptghostdisablingComfy-only (hostedfallback
semantics unchanged). SSRfirstrun caughtsyntax; nextcaughtVMarrayprototype mismatch
forMCPstubcalls, correctedonlycross-realmarrayconversion; literalvalues preserved.

Main reclaimed remainingpresentation andmanagerverification afterpartialreturns.
Presentation hadnon-stableobjectstoreselector, incorrectselectedavailability,
incompletemissing/stale/video switch guards, core-onlyMCPpopupguardmissing and
dynamicnonexistentmessagekeys. Mainremovedobjectselector, useslane-onlyprojection
andfixedkeyhelper; exhaustivecoreguard/localmethodrendering/observedselectedstatus,
bothkindworkflowpicker withcurrentadmission, core-onlypopupselectedID/kind and
observationcopy, HomeComfyreason exception, allfourmatchinglocaleobjects.
Source35focusedPASS andUItypes0; notrenderedproofyet.

Verificationfirstworker produced incomplete13line/10linespecs andplaceholder
managerfixture withnoAPI-modulemock; mainclosedandreclaimed. ReplacementJ6-only
workerRamanujan01a07351-0edc-74d1-89fe-1e35c3e8e70b ownsJ6/spec/evidencehelper,
nootherfiles. Main ownsactualmanagerfixture+sharedtransport. No ongoingcollision.
Sharedtransportextraction retainsoriginalWP08guards, addsunusedcontext/exactorigin
andownedasset checks; replacesoldduplicatedcomposer guardcall, notitsacceptance.

## Main integration checkpoint

Main reclaimed the replacement J6 packet too; no implementation workers remain.
The final fixtures use the actual Manager DOM with one canonical API-module mock,
and shared transport rejects every non-owned request. J6 now drains held catalog
routes before context close and uses the actual MCP catalog envelope. New hosted
cases cover observation/error recovery, workflow media kind, four locales, narrow
controls, management, and successful/failed writes. These cases are not yet run.

Fresh `npm run ui:build && npm run typecheck:tests` exited 0. The build retains its
existing chunk-size/dynamic-import warnings. Direct focused root invocation passed
56 tests, zero failures. Inventory regenerated and check passed; structure line
counts had no drift. Four restored source mutations remain in session evidence
`wp08c/source-mutations.json`. A premature `cxc receipt test` at B was refused before
execution; no receipt or C claim comes from that attempt.

Independent B reviews: Zeno `01a07369-435b-7700-a5b7-10d8f4f17ab4` reviewed resource,
parser, projection and selection admission, PASS with no blockers (18 focused tests
also passed). Ohm `01a07369-43db-7153-bf55-c899cb0ae15d` reviewed hosted fixtures and CI,
PASS with no blockers, no execution. Main corrected duplicate CI retention-days
before that verdict. Their static verdicts do not substitute for hosted execution
or observed screenshots. Next: C exact-head CI, full affected native cases and
independent visual review, then D only after all acceptance rows have proof.
