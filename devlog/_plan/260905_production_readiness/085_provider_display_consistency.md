# WP08c — honest Comfy provider status and workflow controls

Current execution: WP08c P at22dfa811; [086_comfy_revalidation.md](086_comfy_revalidation.md)
amends the historical944 plan below. No WP08c production implementation yet.

Status: docs-only roadmap amendment during WP02 P replan; main reports wp08c
registered with c-17 and wp13 provider-display-gate. NOT implemented, independently
audited, or runtime-verified by this leaf; this leaf did not mutate goal/FSM state.
Source baseline: `94489a90`, inspected 2026-09-05. Visual symptoms are parent-supplied
observations of that UI; this worker did not open a browser or reproduce screenshots.
Owning unit: [000_plan.md](000_plan.md). Related contracts:
[010](010_provider_surface_contract.md), [020](020_selection_consistency.md),
[080](080_composer_contract.md), [090](090_user_journeys.md),
[100](100_runtime_diagnostics.md).

## Loop header, dependency order, and authority

- Class C3, bounded frontend integration; archetype: spec-satisfaction repair.
- Trigger: Comfy selection renders a blank right-side provider, DISCONNECTED/MCP
  authentication chrome, and GPT-shaped controls despite being a core local lane.
- Goal: show the named local provider, last catalog observation, selected workflow
  and relevant workflow actions without implying hosted authentication or execution.
- Non-goals: server auth/execution, credentials, new providers, new parameter editor,
  graph inspection in the generation panel, scalar payload changes, static catalog
  expansion, general query/state framework, redesign, or generation certification.
- Verifiers: pure catalog/state tests; independent rendered assertions using the
  existing hosted-only J6 boundary; existing selection/Comfy contracts and UI types.
  Commands and their actual observation limits are recorded below.
- Stop: every activation row has current-head evidence, hosted screenshots inspected,
  no misleading controls/status, existing selection semantics retained. A plan alone
  is not implementation DONE; missing hosted proof remains an open C gate.
- Memory artifact: this document; main attaches future A/C evidence and next direction
  here, without overwriting earlier failures or relabeling WP02 evidence as wp08c proof.
- Expected outcomes: DONE only with those proofs; NOOP only if upstream already fixes
  every row; BLOCKED/UNSAFE/NEEDS_HUMAN for evidenced dependency/authority gaps;
  BUDGET_EXHAUSTED only at an actually stated resource bound.
- Escalation upward: main owns scope changes and reclaims after two distinct failed
  worker packets. Two same-failure repairs require RCA; three require changed P.
  Downward: any new worker/file ownership is a main P amendment, never leaf fan-out.

Semantic inputs: WP01 generated `PROVIDER_SURFACE_SUPPORT` and existing `Provider`
IDs; WP02 `CoreSelectionState`, workflow carriers/setters and effectiveSequence/display
correction; WP08 integrated composer/host geometry. Existing `/api/models` and
`openSettings("providers")` suffice. WP10's distinction between configured, observed,
and working is a semantic constraint, NOT an import or sequencing dependency.
Order: **wp08 → wp08c → wp09**, branch suffix `wp08c-provider-display` when main
authorizes implementation. WP09 consumes this rendered contract and retains ownership
of its future general fixture isolation. No dependency cycle or prerequisite on WP09.

Inherit 000 resource bounds: existing tools/account allowances, no numeric token
budget requested, reassess at four hours/WP and 72 hours overall; no paid calls,
purchases, credential inspection or ambient user services. This leaf's tools are
read-only source/Git inspection and apply_patch; its ENTIRE write authority is this
new Markdown file. No full suite, browser, server, build, FSM/goal/loop commands,
commit or push here. Future full suites stay on exact-head CI/approved remote;
browser/server checks remain on disposable GitHub-hosted runners. Exceeding this
scope returns to main, regardless of broader authority recorded in 000.

Main integration, NOT performed here: wp08c/c-17 and the release gate are registered
per main's update and [027](027_wp02_visual_replan.md). Main owns remaining wp09
predecessor and integrated gate/count alignment. Do not rewrite completed history to pretend this
unit existed at WP00 lock. Main separately owns WP02 effectiveSequence/display and
narrow selector readability; this plan neither duplicates those fixes nor changes
their acceptance values.

## Verified owner baseline and reuse decisions

| Evidence at 94489a90 | Consequence for this diff |
| --- | --- |
| `ui/src/components/settings/ProviderStatusSelect.tsx:20` omits Comfy from CORE_ENTRIES; `:111` cannot find selectedCore; `:124`/`:128` fall back to disconnected and MCP | Add an exhaustive core entry and explicit local-method rendering; this is display fallback, not MCP selection or dispatch. |
| `ui/src/hooks/useProviderAvailability.ts:90` returns `comfy.ok:false` with unfinished comment | Replace only this lane's placeholder with catalog observations; do not reinterpret static support as credentials. |
| `ui/src/components/GenerationControlsPanel.tsx:163` falls through to GPT compatibility; `:181` only special-cases actual mcpProvider; `:348` offers generic format/moderation | Preserve MCP-first priority; insert Comfy return before generic image/video controls. |
| `ui/src/components/GenProviderModelSelect.tsx:124-144` keeps two snapshots: mount-only getLaneCatalog plus provider-change getComfyLaneModels; errors become `{}`/empty | One feature-specific shared catalog observation replaces these two reads, not a new application state system. |
| `ui/src/lib/api-comfy.ts:161` preserves lane status but defaults malformed status to disconnected and absent arrays to empty | Distinguish transport/schema error from valid empty/missing lane; keep URL and server DTO unchanged. |
| `routes/models.ts:295-347` builds runtime workflows; lane ready means ANY origin answered; per-row offline is currently a description suffix | Selected workflow must be checked separately. Never infer all workflows online from lane ready, or parse arbitrary reason prose. |
| `lib/providers/registry.ts:228-247` has local-http credentials descriptor, runtime catalog and deliberately empty static models | Local HTTP is a connection method, not OAuth/API/MCP auth. Generated surface support means supported, not verified. |
| `ui/src/lib/coreSelection.ts:55-78`, `:118-122`; `storeVideoImpl.ts:39-45` | Comfy uses separate image/video IDs; existing image/video request projection is real. No evidence here of GPT/MCP dispatch leakage. |
| `ComfyWorkflowManager.tsx:52-65`, `:132-153`, `:168-170` refresh its own list after mutation | Successful registration/removal invalidates shared catalog; manager remains sole registration/bind/probe UI. |

Source searches: `getLaneCatalog`, `getComfyLaneModels`, `LaneCatalog`,
`useProviderAvailability`, `comfyWorkflow`, `setComfy`, `useSyncExternalStore`,
`GenerationControlsPanel`, `CORE_ENTRIES`. Direct availability consumers are
ProviderStatusSelect, ProviderReadinessPopup and HomeHero → HomePromptComposer.
GenerationControlsPanel is hosted by RightPanel and MobileComposeSheet.

Reuse `api-comfy`/`jsonFetch`, React's existing external-store subscription pattern
(`ui/src/hooks/useTheme.ts:7,59`), existing Select, i18n, model value prefixes,
WP02 setters and J6 capture. Reject doing nothing/config-only: missing branches are
source defects. Reject per-component new fetches: independent snapshots recreate
contradictions and repeated Comfy probes. Reject replacing all provider status hooks:
hosted credential/readiness semantics are independently owned. No registry mutation.

The `/api/models` read is not free of backend activity: it may probe configured Comfy
origins, discover Agy and consult MCP catalogs. Do not call it on the developer host
for this task. UI fixture GETs are synthetic and intercepted before the app receives
them. API success/liveness does not prove GPU execution, balances, valid graph nodes,
or future reachability. Raw origin/reason text is not needed in new status chrome.

## Full future implementation file map

Paths below are repository-relative FUTURE scope, not this leaf's write permission.

| Action | Path | Exact responsibility |
| --- | --- | --- |
| ADD | `ui/src/lib/laneCatalog.ts` | Non-persisted, single-resource catalog snapshot/subscription/refresh lifecycle. |
| ADD | `ui/src/hooks/useLaneCatalog.ts` | Thin React subscription to that resource, no second cache or query framework. |
| ADD | `ui/src/lib/comfyDisplay.ts` | Pure lane/selected-workflow projection and row eligibility, no I/O or store writes. |
| ADD | `ui/src/components/settings/ComfyGenerationControls.tsx` | Workflow selector, observed status/retry/manage actions, bounded explanatory copy. |
| MODIFY | `ui/src/lib/api-comfy.ts` | Strict parseLaneCatalog at existing GET boundary; keep existing exports/signatures. |
| MODIFY | `ui/src/components/GenProviderModelSelect.tsx` | Consume shared snapshot and shared Comfy row predicate; remove two local Comfy/core fetch effects only. |
| MODIFY | `ui/src/hooks/useProviderAvailability.ts` | Replace hardcoded comfy availability with lane-only derived observation; hosted entries unchanged. |
| MODIFY | `ui/src/components/settings/ProviderStatusSelect.tsx` | Exhaustive local core entry, correct local method/status, selectable setup path. |
| MODIFY | `ui/src/components/GenerationControlsPanel.tsx` | MCP-first then Comfy-specific branch, no unrelated hosted branches rewritten. |
| MODIFY | `ui/src/components/ProviderReadinessPopup.tsx` | Comfy workflow facts/status instead of GPT model/reasoning/search/credential claims. |
| MODIFY | `ui/src/components/home/HomePromptComposer.tsx` | Comfy option displays actual observation and permits selecting lane to configure it. |
| MODIFY | `ui/src/components/settings/ComfyWorkflowManager.tsx` | Refresh catalog after successful create/delete only; existing list/probe/form preserved. |
| MODIFY | `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`, `ui/src/i18n/zh-Hans.json`, `ui/src/i18n/zh-Hant.json` | Matching scoped display keys, including local method, loading/error/empty/missing/recovery and workflow scope. |
| ADD | `tests/lane-catalog.test.ts` | Pure boundary and resource lifecycle with fake fetch/deferred promises; no app imports/network. |
| ADD | `tests/comfy-display.test.ts` | Independent literal truth table for lane vs selected workflow and capability limits. |
| MODIFY | `tests/comfy-ui-contract.test.ts` | Update obsolete getComfyLaneModels/inline predicate source assertions; retain routing/bind/i18n protection. |
| MODIFY | `tests/provider-ui-polish-contract.test.js` | Retain existing dropdown/style/a11y assertions; add Comfy local entry and no local authActive assertion. |
| MODIFY | `ui/e2e/fixtures/j6Selection.ts` | Add bounded status/cross-origin/malformed/deferred catalog fixtures, retaining hosted-only routing/preflight. |
| ADD | `ui/e2e/comfy-provider-display.spec.ts` | Independent non-generating status/control/recovery journeys below. |
| MODIFY | `.github/workflows/ci.yml`, `.github/workflows/pr-fast.yml` | Add always-upload of `wp08c-*.png/json` to both E2E jobs; intermediate stacked PRs need dispatchedCI artifacts. No new runner/trigger/isolation/build policy. |
| MODIFY | `structure/04-frontend-architecture.md` | Add the factual ownership/observed-state contract quoted below. |
| MODIFY | `structure/01-file-function-map.md` | Existing generator's line-count/map synchronization for touched frontend owners. |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Existing classifier output for two new root tests. |

DELETE: no whole files. Remove only GenProviderModelSelect's duplicate catalog
state/effects/imports and the obsolete comfy availability TODO. No dependencies,
lockfiles, storeTypes/persistenceRegistry/schema, adapters, routes, config/auth,
eventChannel, general Select styling or generated provider source edits. ui/dist is
a generated build artifact, never a hand-edited source. Existing oversized owners
are not permission to refactor them; new owners stay <400 lines/functions <50.
If map regeneration touches additional tracked files, main must approve that delta.

## Exact types, signatures and lifecycle

Keep `LaneCatalogEntry`, `LaneCatalog`, `ComfyLaneModel`, `ComfyLaneModels` and
`LaneStatus` in api-comfy. Add this export there:

```ts
export function parseLaneCatalog(value: unknown): LaneCatalog;
```

Before: getLaneCatalog reads typed JSON then silently substitutes disconnected/empty.
After: fetch unknown through existing jsonFetch and return parseLaneCatalog(result).
Validate root object, `ok === true`, object/non-array `lanes`; each lane's recognized
status, object models with image/video arrays, and each consumed row's nonempty
string id/label. Optional description/lockReason must be strings and executable a
boolean when present. Invalid consumed fields throw a fixed `MODEL_CATALOG_INVALID`
error with `code: "MODEL_CATALOG_INVALID"`, never echo body/reason/origin. The resource classifies this exact code, not raw exception prose. Unknown extra fields/lane IDs remain allowed.
Valid `lanes:{}` is not a transport error: projection reports unavailable/missing lane.
Do not silently drop malformed rows and call the resulting catalog empty.
Existing `getComfyLaneModels(signal?)` remains exported, using getLaneCatalog and
returning its comfy models or empty arrays when that lane is absent; no new callers.
Neither function changes server HTTP/auth response handling; jsonFetch's 401/403
still rejects. No parser test imports routes/models or app configuration.

New laneCatalog.ts API (all functions feature-specific, no generic factory):

```ts
export type LaneCatalogSnapshot = {
  phase: "idle" | "loading" | "ready" | "error";
  catalog: LaneCatalog | null;
  observedAt: number | null;
  error: "request" | "invalid" | "app-auth" | null;
};
export function getLaneCatalogSnapshot(): LaneCatalogSnapshot;
export function subscribeLaneCatalog(listener: () => void): () => void;
export function refreshLaneCatalog(): Promise<void>;
```

Complete lifecycle: module starts idle/null; imports perform no fetch/window/storage
access. Stable snapshot object changes only on publication. First subscription when
there were zero subscribers starts a fresh request; further subscribers share it.
Last unsubscribe aborts the active request and detaches the single window-focus
listener; no component-local poll. Subsequent first subscription revalidates; focus
revalidates while subscribers exist. Manual refresh supersedes/aborts in-flight work.
Each request captures a monotonic revision plus AbortController; only its current,
non-aborted revision may publish success/error/final state. Finally cannot clear a
newer controller. try/catch contains every asynchronous request; refresh resolves
after publishing a fixed error code, never exposes raw exception text.

Publish loading immediately, retaining last catalog/observedAt ONLY as explicitly
stale display data. On success replace whole catalog, phase ready, observedAt=Date.now,
error null. Failure retains prior catalog but phase error (no green readiness); map
status401/403 to app-auth, parser failure to invalid, other exceptions to request.
Aborted obsolete work publishes nothing. No automatic retry/backoff or polling timer;
Refresh is available even during loading and aborts a stalled read. A loading state
never becomes disconnected merely because time elapsed. Last successful observation
is labelled as such, not continuous monitoring. No durable cache, freshness TTL,
service worker or server invalidation API. Refresh without subscribers invalidates
to idle/null rather than starting background probes; next subscription loads.

`useLaneCatalog(): LaneCatalogSnapshot & { refresh: typeof refreshLaneCatalog }`
uses useSyncExternalStore(subscribeLaneCatalog, getLaneCatalogSnapshot) and the
stable refresh function. No per-consumer useEffect fetch. Caller chain: Gen selector,
availability hook, Comfy panel, right-side status and readiness popup → this hook →
one resource → getLaneCatalog → jsonFetch → unchanged `/api/models`.

New comfyDisplay.ts imports type-only catalog/snapshot/CoreSelectionState and
generated `PROVIDER_SURFACE_SUPPORT` for operation eligibility (never authentication):

```ts
export type ComfyDisplayCode = "loading" | "error" | "unavailable" | "empty"
  | "disconnected" | "choose" | "selected-missing" | "selected-offline"
  | "selected-locked" | "ready";
export type ComfySelection = Partial<Pick<CoreSelectionState,
  "comfyWorkflow" | "comfyVideoWorkflow">>;
export interface ComfyDisplay {
  code: ComfyDisplayCode;
  laneAvailable: boolean;
  selected: { id: string; kind: "image" | "video"; label: string } | null;
  selectedAvailable: boolean;
  imageCount: number;
  videoCount: number;
}
export function isComfyModelAvailable(entry: ComfyLaneModel): boolean;
export function deriveComfyDisplay(
  snapshot: LaneCatalogSnapshot, selection: ComfySelection | null,
): ComfyDisplay;
```

Optional carriers match actual AppState; absent/undefined/null mean no choice, with no casts or new store requirements. Test these three inputs independently.
Predicate: executable !== false AND !description?.endsWith("(offline)"). This
preserves the current server's suffix convention; don't broaden string matching or
pretend this is a typed per-origin health DTO. Counts count registered entries, not
successful generations. laneAvailable requires fresh ready snapshot, comfy.status
ready, and at least one eligible row on a supported generate/video surface. Empty
static registry arrays are irrelevant. Selected kind is video iff comfyVideoWorkflow
is nonempty (WP02 convention); otherwise image. Resolve ID only in that kind's list;
label fallback is the exact ID, never GPT or another workflow. Null selection asks
for lane-only availability; it is not permission to auto-select the first row.

Decision order: idle/loading → loading; error → error; missing lane or unexpected
Comfy key-missing/locked lane status → unavailable; selected ID absent from its kind
→ selected-missing (including both lists empty); empty catalogs with NO retained selection → empty; lane disconnected → disconnected;
selected executable false → selected-locked; selected suffix offline → selected-offline;
no eligible rows → unavailable; no selected ID → choose; else ready. Availability
booleans are false unless their full conditions hold, regardless of displayed code.
When selected-missing wins over disconnected, render lane disconnected separately.
Error/loading takes precedence over interpreting stale absence as deletion.

Field chain: snapshot created by resource, consumed by pure projection/hook/views;
projection created from current WP02 selection and catalog, consumed only by UI/tests.
Serialization/deserialization: NONE for these new in-memory fields. Existing HTTP
data is parsed at api-comfy; persisted selection remains entirely WP02-owned.
No new Provider value, preference, payload field, MCP record field or global AppState.

## Exact UI deltas and caller behavior

ProviderStatusSelect: replace non-exhaustive CoreEntry array declaration with an
exhaustive `Record<Provider, CoreEntry>` metadata table (keep explicit value fields),
then derive CORE_ENTRIES using generated CORE_PROVIDER_IDS. Retain explicit
grok-api/gemini-api values and existing source contracts; test every key equals its
entry.value. Existing labels/methods stay; comfy gets provider `ComfyUI`, method
rendered inside the component with `t("comfy.display.localMethod")`, not a credential term. Keep static metadata outside React and translate Comfy's method at render time so locale changes work. Selection still uses core:comfy
and setProvider, never setMcpProviderImpl. Validate known core id before availability
lookup. Permit selecting Comfy even while unavailable so setup/recovery is reachable;
the action is browsing/configuration, NOT generation. Hosted blocking/modal behavior
and all real MCP record handling remain unchanged.

Before selected Comfy: missing entry → empty Select label, DISCONNECTED, MCP chip.
After: ComfyUI Local provider option; text status from derived selected observation,
warn tone for loading/choose/missing/unavailable and bad for error/offline; green only
for selectedAvailable. Use provider.statusConnected rather than credential-ready
language for a valid selected workflow, accompanied by last-observed help. Local chip
has title/local text, never authActive or an auth-method title. Status line has
role=status/aria-live=polite; no new noisy toast. Catalog 401/403 means app access
required, NEVER “Comfy key missing”; no login/connect/probe action is auto-triggered.

useProviderAvailability retains EXACT existing signature and ProviderAvailability
`{ok,reason,hint?}`. Only comfy changes: derive with selection=null, ok=laneAvailable,
reason always translated local observation (including the available case), hint
guides workflow selection or Settings. Hosted return entries remain byte-for-byte
semantically unchanged, including their existing limitations; no new global claim.
HomePromptComposer's Comfy option uses availability.reason even when ok and is not
disabled just because availability is false; other options unchanged. HomeHero
passes the same Record unchanged. Home submission guards/execution are NOT modified.

GenProviderModelSelect: replace local laneCatalog/comfyLane state and both effects
with useLaneCatalog; comfyLane = snapshot.catalog?.comfy?.models or stable empty pair.
Keep WP02 resolved model/value, missing-ID fallback, setters, prefixes, compact
triggerSub/readability, MCP effects/retry and hosted static options. Replace both
inline offline/executable checks with shared predicate, AND disable Comfy rows when
snapshot not fresh-ready or lane not ready. Error/loading must not make stale rows
actionable. Preserve labels during refresh, add catalog-state text/retry outside
the narrow trigger using existing status/retry classes; do not duplicate WP02 CSS.
Known provider labels remain browseable on absent catalog; unknown server IDs stay
disabled. Catalog refresh NEVER writes selection, chooses first, or clears drafts.

GenerationControlsPanel: after existing `if (mcpProvider) return ...`, insert:

```tsx
if (provider === "comfy") {
  return <div className="right-panel-settings" role="tabpanel">
    <ProviderStatusSelect mcpProviders={mcpProviders} />
    <ComfyGenerationControls />
  </div>;
}
```

All hooks stay unconditional before returns. ComfyGenerationControls has no props;
reads current comfyWorkflow/comfyVideoWorkflow, WP02 setters, openSettings and shared
catalog. Render existing option-group/Select primitives with ReactuseId-derived
control/description IDs per instance; keep `data-testid="comfy-generation-controls"` and scope tests to the visible panel. Image values
are raw IDs; video values use COMFY_VIDEO_VALUE_PREFIX, passed to existing setters.
Groups use existing kindImage/kindVideo translations and generated surface support.
Missing selected ID gets a labelled unavailable row; onChange accepts ONLY an actual
current eligible catalog entry of the decoded kind. It cannot reactivate a ghost row.
Picker remains usable to choose a different eligible row; disabled stale/offline rows
remain listed. No auto-selection or new clear/persistence policy.

Render workflow ID/label and kind, selection-specific status, a Refresh button wired
to refreshLaneCatalog and Manage workflows → openSettings("providers"). Reuse
existing classes/tokens, no new visual framework or CSS owner. At 390px use full
available width; label wraps within the panel, no changes to narrow sidebar triggers.
Use stable status description IDs and aria-describedby; loading is aria-busy,
error has fixed actionable copy; retry preserves focus/draft/current selection.

This is deliberately a WORKFLOW control panel, not a graph-parameter editor. Do not
render GPT compatibility/quality/moderation/format/SizePicker, Grok VideoControlsPanel,
Grok model switch, hosted cost estimate, reasoning/search controls or a multimode
toggle for Comfy. No claim that hidden saved fields are reset or ignored by every
existing route. Image requests currently carry resolved size (`storeGenImpl.ts:291`)
and the adapter writes it only to declared bindings (`comfyImageAdapter.ts:434-445`).
Video requests carry their existing duration/resolution/aspectRatio fields
(`storeVideoImpl.ts:156-158`). Copy must say bindings determine applicable request
settings, NOT “all workflow defaults untouched.” A future binding-aware scalar UI
needs its own mapped consumer contract; it is not silently added here. No CountPicker
or scalar editing is introduced in this panel. Preserve saved count and all WP02
effective-mode/Sequence semantics; hiding a control is not changing dispatch. If main
requires binding-aware size/count/video editing, that is an explicit P scope amendment,
not an unresolved prerequisite for this workflow-selection/status unit.

ProviderReadinessPopup: Comfy-only facts use the same selected projection (raw ID
when missing, chosen media kind); hide its static ImageModel lookup result and
reasoning/webSearch rows for Comfy. Ready copy is “Available at last catalog check,”
not a claim that the workflow executed/responded or generic generation/auth readiness. Account CTA becomes Manage
workflows while still invoking the existing close + openSettings("providers").
Other provider branches and modal focus/close behavior stay unchanged.

ComfyWorkflowManager: after each successful create/delete, request shared refresh
alongside its existing refresh; failed writes must not publish successful catalog
state. Its checkOrigin action remains explicit and isolated from this catalog;
new chrome never calls probeComfyOrigin or fetches a workflow origin in the browser.
Do not fix unrelated manager list-error handling or add workflow mutations here.

Add matching `comfy.display` keys in all four locale JSONs: localMethod, loading,
refreshing, loadFailed, appAccessRequired, unavailable, available, chooseWorkflow,
selectedMissing, selectedOffline, selectedLocked, observedConnected, lastChecked,
refresh, manage, controlsHelp. Reuse comfy.empty/statusOffline/kindImage/kindVideo
where accurate. English meanings are the exact states above; Korean/Simplified/
Traditional Chinese must express the same limits and recovery, not credential
claims. New copy never interpolates raw server reason/origin/error. No hardcoded
translation keys visible and no color-only status; no concept-image generation.

## Independent acceptance / activation matrix

| ID | Constructible activation | Required independent oracle |
| --- | --- | --- |
| D1 | Hold first catalog response; then release ready | ComfyUI + local chip never blank/MCP; loading then selected observed-connected; no early green. |
| D2 | Ready → refresh held → 503/invalid JSON/schema | Prior label stays, refreshing/error shown, no stale ready; retry to ready restores without selection/draft mutation. |
| D3 | Valid comfy empty image/video arrays with NO retained selection (both ready and disconnected statuses) | Empty workflow guidance + Manage action; no automatic first model/GPT fallback. |
| D4 | Valid lanes without comfy; Comfy status key-missing/locked | Unavailable, local method retained; no request to obtain Comfy credentials. |
| D5 | Lane disconnected, registered IDs retained | Rows visible disabled, disconnected text; provider still selectable for setup. |
| D6 | Lane ready, image A online, selected image B description ends `(offline)` | Lane available but selected offline; B cannot be reselected; A selectable. Also cover video list separately. |
| D7 | Lane ready, selected executable=false but no offline suffix | Selected locked distinct from offline, fixed recovery text, no green. |
| D8 | Selected ID deleted (including lastworkflow leaving botharrays empty) or exists only in opposite kind | Exact ID remains visible, selected-missing evenatcounts0, no storage repair/auto-switch; choosing valid row uses existing setter. |
| D9 | First Comfy visit without selection; only video workflow ready | Choose workflow, lane available; image empty is not whole-lane empty; no credential-ready claim; video selection shows video workflow controls, not Grok controls. |
| D10 | Comfy ↔ GPT ↔ Comfy, and real MCP selected with provider field still comfy | WP02 persistence/readability unchanged; GPT controls only on GPT; MCP controls only on actual MCP selection; no Comfy branch wins over MCP. |
| D11 | Successful manager create/delete invalidation; failed write | Success refreshes all mounted catalog consumers; failed write never forges ready. Mock API unit wiring or intercepted synthetic response only, no real workflow writes. |
| D12 | Two subscribers, refresh A delayed, refresh B wins, A later settles, last unsubscribe/re-subscribe | One initial fetch, both see same snapshot; A cannot overwrite B or clear B controller; abort/cleanup observed; remount revalidates; module import does no I/O. |
| D13 | Catalog401/403; static supported=true plus unavailable observation | App-access error distinct from provider credentials; no static-support inference, auth bootstrap stub or forbidden login request. |
| D14 | Right panel desktop 1280×800, mobile Controls tab390×844; en/ko/zh-Hans/zh-Hant | New control/description IDs unique across hiddenRightPanel and visibleSheet instances; scopedqueries, nonempty readable names/status, keyboard/hit tests; irrelevant hostedcontrols absent. |

Root tests use synthetic literal catalogs/deferred fetch and assert literal result
objects/call counts; never calculate expected status using the production helper.
Include two workflows sharing the SAME id across different kinds, malformed rows,
unknown lane IDs and error-vs-empty negatives. Restore mocked globals after every
case; resource tests unsubscribe in finally (no testing switch in production).
Mutation at future C in an isolated checkout: remove Comfy early-return, admit stale
ready, ignore offline suffix, or accept an obsolete response. Corresponding independent
assertions must fail before restoration/green; no mutations or tests were run here.

## Hosted-only fixture proof and honest verifier baseline

J6 ALREADY exists: `ui/e2e/fixtures/j6Selection.ts` exports withJ6/preflightJ6;
`appServer.ts:63-91` requires disposable github-hosted Linux and refuses ambient
overrides. It is NOT WP09's future appProjection/filesystem/process isolation.
Preserve J6 context-wide exact-origin routing, denied unexpected mutations/external
traffic, blocked service workers/WebSockets, once-only storageState and owned teardown.
Existing J6 can capture synthetic generation submissions; wp08c cases never submit
and additionally assert `capture.requests === []`, `unexpected === []`, stub calls0.

Extend J6CatalogState.mode additively with loading/missing/mixed/locked/invalid/
app-auth fixtures; preserve existing ready/empty/offline/error meanings for WP02.
Add optional `lanes?: LaneCatalog` for literal per-case overrides, and to J6Capture
add `releaseCatalog(): void` plus `catalogReads: number`. Loading GET waits on one
fixture-owned release promise; release resumes ALL held catalog routes using the
current mode. Finally must release/abort held requests before unroute, not hang
teardown. Only `/api/models` gets these behaviors. Add synthetic MCP record/model
responses for D10 in existing read-fixture table; never stub login/bootstrap or
rewrite real app auth rejection. Status401 fixture proves client error display only.
No production test switch, live workflow registration, direct origin probe or paid call.

New spec imports existing test/expect convention and withJ6, runs preflight before
browser allocation, selects the real RightPanel settings/Mobile Controls tab and
uses new testids/accessible labels. Use literal expected strings; no helper-driven
oracle, no source-string check masquerading as visual proof. Keep existing J6/core
selection journeys intact. Cross-lane optional fixture fields default to original
responses; if WP02 changes signatures first, rebase this plan at wp08c P, not now.
For D11 use a pure intercepted/mock wiring test; full manager mutation journey belongs
to WP09's future isolation, not an expanded early mutation allowlist.

Future artifact paths: `testInfo.outputPath("wp08c-<case>.png")` plus
`wp08c-<case>.json` containing synthetic state/code, counts, viewport/locale, runner,
SHA/build and teardown evidence (no headers/env/credentials). Existing wp02 output
names remain compatible. Add always-upload steps in ci and pr-fast for `wp08c-*.png/json`
with retention14, using the already pinned upload-artifact action. Exact-head builds
use the then-landed WP08/J6 build path; do NOT require future build:fixture/receipt
scripts from WP09 or introduce a second producer. Main inspects the actual rendered
PNG artifacts before C close and later WP09 consumes these cases.

| Verifier | Existence/target proof | Current baseline status |
| --- | --- | --- |
| `node --import tsx --test tests/comfy-ui-contract.test.ts` | Existing file reads selector/imageModels/manager/locales directly; source-only protection | NOT RUN in this docs-only delegation; existing assertions do not detect right-panel fallthrough. |
| `node --test tests/provider-ui-polish-contract.test.js` | Existing file directly reads both changed right-panel owners, style and Select contracts | NOT RUN; source-shape/a11y wiring only, not rendered Comfy behavior. |
| `node --import tsx --test tests/lane-catalog.test.ts tests/comfy-display.test.ts` | Proposed files import new exact owners directly | FUTURE files, NOT RUN; not a present passing gate. |
| `./ui/node_modules/.bin/tsc -p ui/tsconfig.app.json --noEmit` | Existing UI config include `["src"]`; covers new UI owners | NOT RUN; root typecheck explicitly excludes ui and cannot replace it. |
| `npm --prefix ui run typecheck:e2e` | Existing script/config include e2e and playwright.config.ts | NOT RUN; typing is not browser/render proof. |
| `npm --prefix ui run test:e2e -- comfy-provider-display.spec.ts j6-model-select-label.spec.ts core-selection.spec.ts` | Existing Playwright script/testDir; new named spec is future | HOSTED-ONLY FUTURE gate; NOT RUN here; missing new spec cannot count as pass. |
| `npm run test:inventory` | package.json:26 → scripts/classify-tests.mjs:24 glob of root test filenames | NOT RUN; observes inventory, NOT test behavior or this Markdown. |
| `node scripts/refresh-structure-line-counts.mjs --check` | Existing pr-fast workflow invokes this SoT drift gate | NOT RUN; count drift only, not semantic documentation validation. |

PLAN-VERIFIER-REAL exception is explicit: user prohibits runtime/full-suite/browser/
server work in this delegation. Existence and target inclusion were inspected, not
passed off as executed exits. Parent must execute authorized focused/hosted gates
and record exact output at implementation C; no invented npm test:comfy script,
future WP09 command or historic suite count is current proof.

Fresh read-only baseline proof: `git rev-parse --short HEAD` returned94489a90;
`git diff 94489a90 -- ui/src/components/settings/ProviderStatusSelect.tsx
ui/src/hooks/useProviderAvailability.ts ui/src/components/GenerationControlsPanel.tsx`
returned exit0/empty, confirming the three reported owners remain unchanged.
Source inspection independently confirms the branches above, not runtime outcome.
Main P addendum at94489a90: the two existing focused files ran9+5tests, allpass;
UI noEmit and typecheck:e2e exit0. These observe their listed targets, not this
future implementation or Markdown. Main also repaired capture ownership (ci plus
pr-fast), parser error-code identity, render-time local-method translation and
catalog-observation copy; these require independent A review before adoption.
Docs-only final checks inspect this file's complete add diff and whitespace. Tests,
builds, browser, service and CI results remain NOT RUN by this worker.
`git diff --no-index --check /dev/null devlog/_plan/260905_production_readiness/085_provider_display_consistency.md`
is the actual new-file whitespace check (exit1/new-file difference, no whitespace
diagnostics); ordinary git diff would miss this
ignored new file. `git check-ignore -v` identifies `.gitignore:13:devlog/_plan/*`;
main owns explicit inclusion/staging. No git index change was made by this leaf.

## Compatibility, SoT sync, rollback and residual risks

Compatibility/migration: **NONE** for persisted preferences, HTTP/CLI contracts,
server auth, request payloads, provider IDs and user data. Existing API exports and
WP02 setters remain; new fields live only in memory. Intentional visible changes:
Comfy setup remains selectable when unavailable, and malformed catalogs display
error instead of a fabricated disconnected/empty result. These do not authorize
execution. UI readiness is advisory: enforcement tier=UI early warning, surface=
browser, bypass=direct API/stale clients, residual=server remains authoritative,
wording downgraded=observed availability, final new enforcement layer=none.

Same implementation PR updates structure/04 with: “Comfy is a core local-provider
lane. laneCatalog owns a non-persisted shared `/api/models` observation; comfyDisplay
separates lane availability from the selected image/video workflow. Refresh/error
does not repair selection. Comfy generation settings expose workflow selection,
refresh and existing workflow management, not GPT authentication/quality/cost.
Catalog response is observation, not successful generation certification.” Refresh
structure/01 counts and test inventory through existing tools, inspecting exact
diffs. This SoT prose is future implementation text, not a present capability claim.

Rollback: authorized exact revert of the wp08c production display/resource changes
plus its paired imports/parser change; rebuild UI from that source. Keep WP01/WP02/
WP08 commits, schema/preferences/workflows/history and unrelated work untouched.
Reverting restores the known misleading display: withdraw acceptance claims and
mark the regression open. Do not reset storage to make tests green. Keep valid
regression tests where useful; any temporary test disable must explicitly name the
reverted feature, not weaken hosted isolation. WP09 must revalidate consumers if
wp08c is reverted; no automatic removal of later fixture protections.

Residual risks requiring A/C attention: suffix-based per-workflow liveness is a
legacy server contract, not typed health; catalog observations can become stale
between manual/focus refreshes; malformed unrelated lanes now reject the shared
response; hidden existing scalar request values still have binding-dependent effects;
Home can select a not-yet-configured Comfy lane but submission validation remains
upstream-owned. If any needs a server DTO/auth/execution fix, scalar parameter UI,
new general state architecture or altered WP02 selection semantics, stop and return
the exact seam to main for a separate/amended unit. None is silently implemented
or claimed solved by this document.
