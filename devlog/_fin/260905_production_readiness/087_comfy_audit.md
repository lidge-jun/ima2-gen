# WP08c A — round-one synthesis and exact contracts

At69713211, independentresourceBeauvoir returnedGO-WITH-FIXES3 P1 items;
presentation/verificationCopernicus returnedGO-WITH-FIXES0blockers with2Medium/1Low.
Main keeps A untilsameactorre-audit. No productionchange. Allfindingsgrounded in
085/086 +actual22source, not proof of a runtimefailure inunwrittenimplementation.

## Root cause and disposition

| Item | Main synthesis |
| --- | --- |
| R1DTOextras | Accept explicitprojectionboundary. CurrentLaneCatalog hasstatus/reason/models ONLY; currentgetLaneCatalog alreadydropsdefaults/surfaces. Newparser doesnotintroducealostconsumer. Specifyknownmetadata handling andtestdeliberateignore, notnewdynamiccapabilitysystem. |
| R2mutation/refresherror | Existing085 saysrefreshresolves afterpublishingerror; actualwrite error muststayseparate. Accept explicitmanagerordering +additionalrenderedcase provingcatalog503 after successfulmutation. |
| R3Comfyvideoingress | 086 alreadyrequires!mcpProvider &&providercomfy, but explicitbranchorder preventsworkerambiguity. Accept exactalgorithm andpublichandleractivation throughcapturedSelectcallback, no privatehandlerexport. |
| U1sharedmoduleidentity | Accept fixturebundleidentityproof, no productionresourceID/testreset. |
| U2exactmockrequests | Accept literalmethod/path/body/order assertions; rejectunlistedcalls andno genericJSON success. |
| U3descriptionomission | Accept actuallegacytrigger absenceassertion. |

No conflictbetweenlanes; noHigh waived orruntimeproofclaimed. Readonlyreviewers
may inspect exactfuturecodecontracts and testseams, neverrunlocalbrowser.

## R1 — typed projection, intentional metadata treatment

parseLaneCatalog returns theEXISTINGLaneCatalog API: laneobjects containstatus,
optionalreason andmodels. defaults/surfaces atlanelevel aredeliberatelynotprojected,
asbefore; unsupportedextraJSONmetadata doesnotmakeinvalidconsumedfieldsvalid.
Perrow validatedid/label +optionaldescription/executable/lockReason arecopied into
freshobjects; arbitrary rowcapabilities/extrafields areignored bythis narrowUI
projection. ExistingComfyLaneModel type hasno capabilities consumer; searches
getLaneCatalog/getComfyLaneModels findonlyGenSelector. NewComfyDisplay explicitly
uses generatedPROVIDER_SURFACE_SUPPORT forsurfaceeligibility andcatalogstatus/
rowexecutable/offlineforobservation. Noauto modeldefault selection fromserver.

Tests: validDTOcontainingconflictingdefaults/surfaces/capabilities stillprojects
onlydeclaredfields, exactexpectedobject; outputhasno default/surface/capability
keys. Displayeligibility unaffected byignoredmetadata anddoesnotauto-pickdefault.
UnknownlaneIDs including__proto__ remainOWNkeys safely; no DTOschemachange or
servercapabilityauthority claim. A laterconsumer needingtheseextras mustamend
the type/parser/wholechain explicitly. Do not addunusedfields toplacateaudit.

## R2 — successful writes and observational failures

Manager submit/remove continuesawaitingactualcreate/delete inits existingtrycatch.
ONLYafterthat resolves: resetcreationform ascurrently, then await
Promise.all([refresh(), refreshLaneCatalog()]). Existingrefresh catchesits ownlist
error; newrefreshLaneCatalog's documentedpublicPromise alwaysresolves after
publishingfixedphaseerror forfetch/schema/authfailure. It mustnotrejectonnetwork
orparseerror; verifyunitawaitdoesnotreject for401/403/503/badJSON/schema.
No catalog failure reclassifiedasregisterFailed/removeFailed. No fake readiness.

D11 adds5thfreshcontext: actualRegistersuccess thenmodelrefresh503. Assertfake
workflowcreatedonce, formreset, managerlist refreshed, bothsharedconsumers show
phaseerror (retainedoldcatalog explicitlystale), no registerFailed text, no retry
create/write. Samecreationpayloadnotresent. Failurebeforecreate/delete success
hasno catalogrefresh. The APIstub onlymodelsresponses; actualresource handles503.

## R3 — explicit Comfy value admission

In GenSelectoronModelChange, handle actualmcpProvider FIRST (existingparseMcp+
applyMcp functions), thenreturn. NoComfysetterreachablefromthat branch.
Nextactualprovidercomfy: decodevalueCOMFY_VIDEO_PREFIX→videokind, otherwiseimage;
findexactID inCURRENTsnapshotcatalogkind; requirephase ready, lane ready and
isComfyModelAvailable plus generatedsurface support. Unknown/ghost/locked/offline/
loading/errorvalue returnswithoutsetter. CallonlycorrespondingWP02setterandreturn.
Onlythenhandledhostedeffort/VIDEO_PREFIX/setImageModel branches. This explicitly
rejectsComfy-lookingvalues onothercoreproviders too: addguardreturn for
COMFY_VIDEO_PREFIX outsidecoreComfy (nevercasttoImageModel).

No legitimateMCPmodelid is decodedasComfy; existingMCPparserownsvalues. Preserve
validMCPbehavior whenbaseprovider happenscomfy, andvalidGrok/effortsemantics.
Do not use disabledrowaloneasprotection; runtime callbackrevalidateseligibility.

Exactnegativeactivationseam forD10: test-onlyesbuildSelectimportstub captures the
publiconChange prop while actualGenProviderModelSelect renders. Invoke captured
modelcallback withcomfy-video:kept whilemcpProvider set; storeComfy setterscount0,
existingMCPcallbackpath observed. Othercoreprovider rejects samevalue without
setImageModel; actualComfyreadyvideo accepts1, held/stale/ghostreject0. No private
productionhandlerexport, no bypassaddedtoruntimeSelect. Addtests/selector-comfy-
admission.test.ts usingin-memoryReactDOMServerrender+hook/context stubs ifneeded;
hooks must beactualpubliccomponentprops withfakeuseAppStore API, notregexbodyeval.
Main owns this narrowroot test, can reuseplanned_laneCatalogFixture compiler.

## U1/U2 — manager fakeAPI and sharedresource evidence

One esbuildbrowserentry imports actualComfyWorkflowManager andactualuseLaneCatalog
twice. NormalresolveDir repo/ui, no aliases/copies/querystrings forlaneCatalog.
Bundlermetafile MUSTcontain exactlyonecanonical ui/src/lib/laneCatalog.ts input
andoneapi-comfy.ts input. API-coremock isresolvedonlywhenimporter iscanonical
api-comfy.ts andspecifier./api-core; everyothermodule getsrealoriginalresolution.
No mockedresource/hook/snapshot. Twoobservations compare referenceequality of
getLaneCatalogSnapshot outputs captured inentry plus matchingobservedAt/catalog;
singleinitialGET andsinglepost-successGET proveonesharedresource. Count allreads.

Stub allowlist EXACTmethod/path/body: GET/api/models andGET/api/comfy/workflows
haveundefinedbody. POST/api/comfy/inspect hasonlysyntheticgraph; createPOST has
exactid,label(ifnonempty),origin,mediaKind,bindprompt1.text/output2 andsamegraph.
DeleteIDfixture containsreservedcharacter (e.g. synthetic id `cedar/a`) ONLYfor
adapter-encodingtest, assertedURL/api/comfy/workflows/cedar%2Fa; it isnotclaimed
acceptedbyrealserverregistration. Ordinarymanagerdeletecase usesvalidcedar-a.
CapturesemanticJSONdeepEqual andexactmethod/URL; rejectunexpectedkey/path/method.
Queue expectedcalls byphase, allowinginitial independentGET order butrequiring
inspectbeforecreate andcreate/delete successBEFORElist/catalogrefresh. Deferred
response cases show noearlierrefresh. Failedmutation hasno postwriteGET.

No HTTP POST/DELETE issued: stub jsonFetch callsresolve/rejectinmemory; transport
guardreports0attempts. Existingnative77WP08inputs must remainunchanged aftershared
transport extraction. Moduleidentity proof usesmetafile/reference identity, not
productiontestexport orrefreshcounter.

## U3 — accessibility omission

SelectwithoutariaDescribedBy continuesnoaria-describedbyattribute. InhostedD14
assertnewComfyworkflowtriggerdescription resolves toinstance-specificstatusDOM,
andexistingprovidertrigger(no prop) hasnoattribute. Hidden/visiblepanelsdistinct.
Allotherwidgetkeyboard/mouse/focus behavior coveredbyexistingSelect/J6 regressions.

## Main ingress/fixture precision before B

Clarify R3: an unencoded reserved comfy-video:value underMCP is REJECTED withALL
setters0, not treatedasan arbitraryrawMCPmodel. ValidencodeMcpModelValue input
stillhits theexistingMCPsetteronce. Read currentuseAppStore.getState in bothComfy
picker callbacks; drop a callbackwhose capturedprovider/MCPcontext no longer
matchescurrentstate. ReadgetLaneCatalogSnapshot atactivation, notonlythe render's
closed-over snapshot, so a ready→loading transition beforeReactcommits cannot
reactivate anoldrow. Tests renderready thenchangefakecurrentcontext/snapshot
without rerender andinvoke theprevious publiconChange: expect0setters.

Selector admission fixture is concreteNode-only wiring: esbuildtheactual
GenProviderModelSelect toCJS withReact/react-jsx-runtime external, resolvedfrom
ui/package.json withcreateRequire; renderToStaticMarkup uses thatSAMEReactinstance.
Testmodule stubs supply useAppStoreselector/getState/actions, useLaneCatalog/
getLaneCatalogSnapshot, useMcpProviders andi18n; realComfyDisplay/projection/value
parsers remain. StubSelect capturespublicprops byexistingid, returnsnull. No
effects/fetch/server/DOMbrowser run, no productionhandlers exported. This tests
valueadmission only, NOTsubscription lifecycle orvisuals. Resource tests andD11
actualtwohooks remainunmocked in their distinct fixtures. Executein a freshVM
context/mockedmodulemap percase; missingdependencies fail, neverfallthroughI/O.

Newcatalogstatus retry controls use a scopedmin-height44px/fontinherit rule under
gen-provider-model__catalog-state. OldMCPretry styling isunchanged. Native320/390
statuscases verifyhit/focus/label fit; do notshrinkrecoverytargets tofittext.
