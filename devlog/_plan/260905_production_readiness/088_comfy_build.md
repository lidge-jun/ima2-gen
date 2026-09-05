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
