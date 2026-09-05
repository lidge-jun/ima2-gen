# WP08c P — current catalog and display integration

Baseline22dfa8110d9930d2673d9bfeeacbd95ec1d4570f, branch
codex/prod-wp08c-provider-display, parentPR209. CurrentFSM P; c-17.085 remains
the full unit specification except amendments here. No production change yet.
Prior084_4 D directs this unit to revalidate085, implement truthfulComfy status
and relevantworkflow controls, then continueWP09. WP08source/IME/geometry/nav
fixes andall144native protections are retained, not reopened or rewritten.

## Loop, design and resource contract

C3 frontend integration with C4 care for catalog/auth-error boundaries andtest
isolation. Spec-satisfaction: replace known display fallthrough/shared-observation
drift; no server execution/auth/scalar/registry/persistence changes. Stop only
after085D1–D14 plus amendments pass actualsource/hosted/native/visual checks.
Artifacts085–089 andsessionevidence/wp08c. Reassess4h/WP,72h/wholegoal; no numeric
token budget, model ANDreasoning_effort omitted onallspawns, usefulparallelism
without arbitraryquota. No paidcalls, newdeps, localbrowser, user3333 requests,
operatorconfig/auth reads, full local suite or runtimeprovider probes.

Design Read: an existingexpert studio settings panel, not a newlandingpage. Show
local connection method, last catalog observation, selectedworkflow identity and
one nextaction appropriate toloading/empty/error. V3/M2/D5 asDESIGN.md; no added
motion orconceptimages. ReuseSelect, OptionGroup/status/button styling andfonts.
Selection, observedavailability andsuccessfulgeneration are different facts.
Do not show GPT scalar controls or credential-active badges for coreComfy.

Mainowns parser/resource/hook/pureprojection +root tests, immediatecriticalpath.
B sidecars: (selector) GenProviderModelSelect andits scopedstatusCSS; (presentation)
ProviderStatusSelect/GenerationControls/ComfyControls/Popup/Home/Manager +fourlocales;
(verification) existingJ6+CI/specs andsharedcomponenttransport/managerwiring fixture.
Writesdisjoint, main serializes tests/builds/git/FSM. Upwardmainreclaims aftertwo
distinctfailedpackets; downwardchanges requireexplicitplanamendment, no leafspawn.
FreshindependentA andC; reviewersread-only/no projectexecution, mainrunsverifiers.

## Current evidence, not inherited assumptions

- api-comfy129/161 remain permissive; GenSelector124–144 stillhas twoindependent
  catalog effects. Mainread wholeapi-comfy/api-core/GenSelector/useTheme andserver
  models DTO/projection. OnlyGenSelector currentlycalls the two catalogexports.
- Actual routeModels returnsoktrue+lanes; each entryhas status/defaults/models
  andoptional surfaces/capabilities. Comfy per-row offline is description suffix
  `(offline)`, lane ready meansANYorigin replied. No route/probeexecuted here.
- Actual generatedComfy VIDEO.supported is TRUE, as aregenerate/edit; node and
  multimode false. OnePsidecar loosely describedvideolimited; source wins. Do not
  accidentally remove video fromthis unit. Static support is notauthentication.
- P baseline14tests passed viaexactcomfy-ui/provider-ui-polish paths; app andE2E
  noEmit both0. Mainpure isolated APIprobe bundled actualapi-comfy, fakefetchonly:
  import0requests; malformedroot became{}, badstatus became disconnected,
  malformedrow passedthrough, unknown`__proto__` lost ownkey/changedresultprototype.
  Evidencewp08c/catalog-baseline.json. No globalprototype ornetworkclaim.
- ExistingJ6 net-modulemock gap was FIXED byWP08; test12PASS. Sidecar's proposed
  currentgap is stale. Keep this test inaffectedchecks if fixture importschange.
- CurrentGenSelector514lines; removingtwofetch effects andobsoleteComfycomments
  provides room, keep<=500. canvas-accordion429lines canfit scopedstatusrules.

## Parser and sharedresource refinements

085parseLaneCatalog contract stands: validateunknown JSON boundary, fixedcoded
MODEL_CATALOG_INVALID, no rawbody/origin inerrors; preserveknownexports/signals.
Validate optional reason/description/lockReason strings andexecutableboolean;
nonblankid/label validation doesnottrim/renamevalidvalues. Unknownextra fields
andlaneIDs accepted, but create the output map withObject.fromEntries orsafeown
property definition, NOTcatalog[id] on{}. Test`__proto__`/constructor asownunknown
IDs without changedprototype. No genericvalidator package or newerrorframework.
getComfyLaneModels delegatesgetLaneCatalog thenprojectscomfy models; absence is
validempty, malformednever silentlyempty. ServerDTO/HTTPstatus behavior unchanged.

Resource085API remains module-private state +exportedget/subscribe/refresh. Each
request storescontroller+revision BEFOREpublishingloading. Re-check revision,
signal andsubscriber presence afterpublication beforefetch: a synchronouslistener
can triggerrefresh/unsubscribe. Activationtest one listener refreshesonloading
once; onlynewrequest reaches fakefetch andobsolete work cannotpublish/clearnewer
controller. Lastunsubscribe incrementsrevision, aborts, removesfocuslistener and
publishesidle (retaining lastcatalog/time as stale isallowed). This prevents a
remount initially painting oldready before its subscription revalidates. A public
refreshwith0subscribers explicitlyinvalidatesidle/null anddoesnotfetch.

No storage/window access ornetwork atimport. Focuslistener exists onlywhileatleast
one subscriber; typeofwindow guard permitsNode tests. Newmountalwaysrevalidates;
manualrefresh supersedes evenloading. No timer, TTL, poll, backoff or automatic
generation. Ready meanslastsuccessfulobservation, not realtimecontinuity. Error
retainsidentityasstale butavailabilityfalse.401/403→app-auth; parsercode→invalid;
other→request. Allasyncpaths caught, obsoleteabort outcomes inert.

Rootunitfixture: compileonlyapi-comfy/laneCatalog/comfyDisplay withexistingesbuild
write:false, importfreshdataURL percase (pattern _jobTrackingUiFixture, notwhole
appstorebundle). Fakefetch assertsGET/api/models; fakeWindowFocusEventTarget and
storage-access trap prove0importIO. Deferredresolvers ignoreabort innegativecases;
check actualsignals, currentSnap, subscriber/focuscounts andlastunsubscribe.
No productionreset/exportprivatecontroller or realconfig/routes import.

085ComfyDisplay shape/codeorder preserved. Optionalcarriers absent/undefined/null
alltested; selectedkind beforeIDlookup; sameID image/video independent. Counts are
registeredrows. Available booleans require freshready phase, lane ready, supported
operation andeligible row. Add a small pure exportedmessage-key resolver beside
the projection ifneeded by3views; it mapscode/error tofixedi18nkeys, neverrawtext.
Addshortcomfy.display.empty so statuslines do not reuse the manager's long Export
(API) paragraph; allfourlocale keysets stayequal. No new AppState orwirefield.

## Selector and mobile status correction

Current coreLaneIds usescatalogkeys wheneverANYlane exists. A validmissingComfy
response therefore makes activecore:comfy blank. Alwaysinclude the knownComfy setup
entry alongsidethe catalogids; whenwholecatalogempty keep theexistingknownfallback.
Other known/unknownhostedlisting semantics remain, MCP-owned IDs still excluded.
No auto-selection orsetters onrefresh. Missingselectedworkflow getslabelled,
disabledghost row; neverreactivated byclick. DecodeComfyvideo only inactualComfy
core context (`!mcpProvider`), validate decodedkind/id against currenteligible
snapshot beforecalling existing setter. Preserve MCP-first, effort/Grok paths.

Do NOTreuse image-model-select__trigger-effort fornewComfycatalogstate: it isgreen
andresponsive-layout374 hidesitat<=430. Add gen-provider-model__catalog-state in
existingcanvas-accordion.css: fullwidthflex-basis100%, min-width0, font12px/1.4
var(--font), muted text, wrap; loading/error text+existing retrybutton asappropriate.
Parentgen-provider-model alreadywraps; mobile-app-bar__selection overridesnowrap,
so add narrow:has(.gen-provider-model__catalog-state) wrap override inresponsive-
layout.css. OnlyComfy state usesnewclass; oldMCP/effort stylingunchanged. Native
390/320 loading/error assertionsmust showtext+button andbothselectionlabels/hits.
No newCSSowner, globalSelect primitive ortrigger-width redesign.

## Presentation boundaries and explicit residual

085rightpanel/availability/Home rulesstand. Allhookscalledbeforereturns, MCPbranch
beforeComfy. NewComfy controlsuseReactuseId forlabel/description IDs acrosshidden
RightPanel/visibleMobile; supportimage ANDvideo. Ghosts/offline/locked remain
named butunselectable; viablealternatives select viaWP02setter. Bindings, notnew
scalarUI, decide which retainedrequestsettings apply. Count/size/duration unchanged.

Popup's newComfybranch requiresprovidercomfy ANDnoactualmcpProvider. ExistingMCP
popupcurrentlyreadscore facts evenwhenMCPselected (GenerateButton's ? opensit
unconditionally). Do notaddanotherMCPpollinghook orremodelMCPpopup inthis slice.
RegisterWP09followthrough forthat existingidentity/status issue. D10 herechecks
actualMCP precedence in selectors/generation panel andabsenceofnewlocalComfyfacts;
it is NOT a claim that all pre-existingMCPpopup facts were corrected.

## D11 executable unitwiring, not phantom private handlers

CurrentManagerpublicDOM: input#comfy-file, conditionalRegisterbutton, tableRemove
buttons. RealReact event handlers stay private. A serverlesshostedcomponent test
importsactualComfyWorkflowManager +two useLaneCatalog consumers. Its esbuildplugin
replaces ONLYapi-comfy's import ofapi-core with a test-owned jsonFetch module.
Allowedfake calls: GET/models, GET/comfy/workflows, POST/inspect, expectedcreateor
delete. Anyotherpath, includingprobe/connect, recordsviolationandthrows. These are
modulefunctioncalls intoin-memory data, NEVER browserHTTP POST/DELETE orserver
workflow writes. Productionapi/resource/parser/manager code isexecuted unchanged.

Createcases uploadsmallsyntheticJSON viaactual#comfy-file; fakeinspection returns
unambiguousprompt1.text/output2, thenclickactualRegister. Deletecases seedone
syntheticworkflow andclickRemove. Fourfreshcontexts: create success/failure and
delete success/failure. Success updatesfakeworkflow data, manager'sownlist and
one sharedcatalogread for BOTHmountedconsumers; failure doesnotrefresh catalog or
change observedAt/catalog snapshot. Avoid mixing this with unrelatedexisting
manager stale-error/list-empty behavior. No privatehandlerexport orprodtestflag.

Reuse WP08component transport rather than duplicateit: extract unchangedcontext
guard/transportattempt type fromcomposerComponentHarness into test-only
isolatedComponentTransport.ts. Keep its exact-origin/syntheticasset allowlist,
deniedfetch/XHR/beacon/SW/WS/worker behavior andguards throughclose. API accepts
ownedasset map +allowedfetchURL list (allkeys MUSTexactsyntheticorigin); existing
composer caller passesits singlecatalogGET unchanged; manager passesemptylist
becauseallAPIcalls aremodulemocks. Preserve oldTransportAttempt type export and
wp08 globalbindingnames forcompatibility. No generalized appprojection/framework.

AddcomfyManagerComponent.tsx testentry, comfyManagerHarness.ts wrapper and
comfy-manager-wiring.spec.ts. Harness uses existingUIbuilt CSS/fonts, hosted
preflightBEFOREbrowserallocation, newcontext, fixedsource/bundle hashes, actual
DOM observations andcleanup JSON; no applicationserver starts. Existing77WP08
component testsmust remain unchanged andgreen aftertransport extraction.

## Additional exact file map and verification

Beyond085: MODIFYcanvas-accordion.css/responsive-layout.css (newstatusrow only);
ADDtests/_laneCatalogFixture.ts (minimalpuremodule loader); ADDtest-only
isolatedComponentTransport.ts/comfyManagerComponent.tsx/comfyManagerHarness.ts/
comfy-manager-wiring.spec.ts; MODIFYcomposerComponentHarness.ts/composerComponent.tsx
ONLYsharedtransporttype/guardimports. Newfiles<400lines/functions<50; no deps.
Existing085two root testsremain lane-catalog.test.ts andcomfy-display.test.ts.

J6 extendscurrentnonGenerating true/deniedGeneration/once-seed/defaultviewport
contract, notold944shape. Addlocale zh-Hans/zh-Hant toexistingseedunion; defaults
unchanged. Deferredcatalogroutes must be released/abortedBEFOREcontext.close,
then guards remain THROUGHclose (WP08 deliberatelyremovedprecloseunroute).
Do notrestoreunroute-before-close. Addexactfixed syntheticGET/comfy/workflows
response forManageSettings mount; allservermutations/probes remainblocked. Literal
MCP readfixtures onlyforD10; noConnect/login/bootstrap/auth bypass. New mode/lanes
fields test-only; creation=spec/capture, serialization=route JSON, consumer=parser+
resource+UI; heldrelease function isprocess-local, notserialized.

Manager API-module testmock isseparatefromJ6 anddoesnotexpandits mutationallowlist.
Always-upload wp08c PNG/JSON in bothworkflows (pinnedaction,14days). Include actual
DOMtext, ranges/hits, snapshot/code, subscriber/read/abort counts, deniedtraffic,
sourceSHA/build andteardown. No produced-but-unviewedvisualPASS; dualoracles.

P observed: exacttwoexistingtests14PASS, app/E2Etypes0; pureAPIprobe4mockcalls above.
FutureCdirect invocations: node --import tsx --test tests/lane-catalog.test.ts
tests/comfy-display.test.ts tests/comfy-ui-contract.test.ts
tests/provider-ui-polish-contract.test.js plus discoveredaffectedfiles; newfiles
currentlyabsent, NOTpresentpassedgates. Main wrapsactualCcommand incxc receipt.
UI/E2Etypes/build/inventory/map generators retained. Hostedonly exactspec invocation:
npm --prefix ui run test:e2e -- comfy-provider-display.spec.ts comfy-manager-wiring.spec.ts
j6-model-select-label.spec.ts core-selection.spec.ts composer-input.spec.ts
j7-nai-negative-geometry.spec.ts. CanonicalCI runsfullsuite remotely, no localsuite.

Bypassrecord085 remains: UIobservations areadvisory/E4browserguard+preflight,
knownbypass directAPI/outsidecontext/server-sideI/O, residualserverenforcement,
no finalOSlayer here. These are notpermission to usebypass. WP09 ownsprojection.
SoT04/inventory/linecountsync atC; rollbackwholeunit withoutclearing userselections.

### Accessible Select description seam

CurrentSelectProps hasariaLabel/id butno descriptionprop. Addoptional
`ariaDescribedBy?:string` inexistingcontrols/Select.tsx, destructureandforwardONLY
toactualtrigger's `aria-describedby`; oldcallers omitit, behavior/styleunchanged.
ComfyGenerationControls createsstatusId withuseId andpassesit; nativeD14 checks
attribute→existingdescriptionelement anduniqueIDs acrossbothpanelinstances.
This is an explicitminimalaccessibilityprop extension, NOT aSelect redesign.
Fieldchain: ReactuseId→panelstatusDOMid +Selectprop→triggerDOMattribute;
serialization/persistence:N/A. Presentationworker ownsSelect.tsx onlythisprop;
existingSelect contracts remainincluded. No other primitive behaviorchanges.
