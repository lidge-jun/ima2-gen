# WP09 P — current journey and UI correction contract (draft)

Consumes090/091/092 and verified WP08c. Original179 native cases remain; do not
replace their controls, expectations or cleanup with source-string tests. This
document adds scoped production corrections for actual residuals, resolving090's
old test-only scope. Main has not entered A or B yet.

## Narrow mobile navigation

Source: NavRail's seven product destinations and nav-rail.css:84–130; prior320
captures show label crowding. Required outcome: readable labels,44px targets and
reachable destinations without document overflow. Keep all destinations and hash
semantics; do not remove labels, shrink targets or add a new navigation hierarchy.

MODIFY `ui/src/styles/nav-rail.css`: mobile rail becomes an internally scrollable
horizontal row with non-shrinking buttons, explicit gap and start alignment when
content exceeds available width. Keep opaque background, fixed safe-area position,
z-index and desktop hover labels. Use a visible thin scrollbar/overflow affordance
instead of hiding offscreen navigation without a cue. No whole-document scrolling.

MODIFY `ui/src/components/NavRail.tsx`: add a mobile nav ref and an effect keyed by
mobile state, uiMode and settingsOpen that reveals the active button within that
nav's horizontal scrollport only. Compute left/right overflow against nav client
rect and adjust nav.scrollLeft; do not call document scrollIntoView, change focus,
or animate regardless of reduced-motion preference. Native keyboard focus must
also scroll into view. Existing navigate/hash/default-profile logic is unchanged.

Activation:320 and390 en/ko/zh-Hans/zh-Hant, all seven items enabled. Record every
button width/height>=44, text rectangle containment, no sibling label overlap,
nav scrollWidth/clientWidth and document overflow<=1px. Scroll to Settings, activate
it, close and activate Home/Create/Node/Assets with real controls. Assert actual
workspace/hash and active-item visibility, not just clickability. Test forward/back
keyboard focus through overflow. At801/1280 desktop rail behavior remains unchanged.

## Actual MCP readiness facts

Current popup uses core fields while an MCP lane is selected. Main verified the
call chain and MCP client/store owners. Important compatibility: a null mcpModel
is allowed by buildMcpGenerationInput and is omitted from the payload; do NOT make
this popup introduce a new required-model validation or change generation policy.

NEW `ui/src/lib/mcpReadiness.ts`: pure projection for local popup observation.
NEW `ui/src/components/McpReadinessDetails.tsx`: mounted ONLY while popup is open
and mcpProvider is nonempty; owns bounded read-on-open/manual-refresh state.
MODIFY `ProviderReadinessPopup.tsx`: MCP arm precedes core Comfy/core facts; the
new child renders MCP status/facts, common modal close/focus remains unchanged.
MCP footer's action opens existing Providers settings, never connects/logs in.

Proposed pure contract:

```ts
type McpReadinessSelection = { provider: string; model: string | null; kind: McpMediaKind };
type McpReadinessObservation = {
  selection: McpReadinessSelection;
  phase: "loading" | "ready" | "error";
  observedAt: number | null;
  providers: readonly McpProviderRecord[];
  catalog: McpModelCatalog | null;
};
type McpReadinessCode = "loading" | "error" | "missing" | "disabled" |
  "disconnected" | "locked" | "default" | "model-missing" | "model-locked" | "ready";
type McpReadiness = { code: McpReadinessCode; provider: string; kind: McpMediaKind;
  model: string | null; modelLabel: string | null; observedAt: number | null };
export function deriveMcpReadiness(observation: McpReadinessObservation,
  selection: McpReadinessSelection): McpReadiness;
```

Field chain: store provider/model/kind → component selection snapshot → existing
listMcpProviders/getMcpModelCatalog GET clients → local observation → pure display.
No new persisted state, provider IDs, request payloads or server endpoints.

Read providers first using an AbortController. Only an enabled, connected,
non-provider-locked selected record with an explicit model needs a catalog read.
Null model displays the provider default without claiming a particular model was
verified. At provider/model/kind change or manual refresh, mark loading; old data
must not describe a different selection. Cleanup aborts; check signal before any
state update. No timer, background poll, new shared cache or automatic generation.
Use existing API clients rather than copying URLs. Errors become fixed local copy,
not raw server text/endpoints. Show last observation, not successful generation.

Projection order: selection mismatch/loading; error; missing record; disabled;
not connected; provider locked; null-model default; missing selected model in the
current kind; selected executable=false; ready. Exact kind distinguishes same-ID
image/video rows. Label fallback is current raw model ID, never a core model.
No GPT reasoning/search/account facts appear in this arm. Selection setters are
not called by observation or refresh. Static connected status alone does not
certify an explicit missing/locked model.

Add matching `readiness.mcp` keys in four dictionaries for observed connection,
provider default, selected model missing/locked and refresh/error guidance. Prefer
existing labels where meanings match. Any dynamic key helper gets a finite
i18n-dictionary-contract registration; do not add a wildcard scanner exemption.
No claim that the existing global MCP cache/polling implementation is rewritten.

Pure tests `tests/mcp-readiness.test.ts` use independent literal observations:
all codes, default-null, same-ID different kind, stale selection, error with stale
data, model label fallback and provider/model execution locks. Native cases use
actual selector→popup, explicit image/video/default, disconnected/error/retry,
and coreComfy/GPT transitions with a deliberately different core model. Observe
zero generation/connect/login calls and close/unmount cancellation. Extend current
J6 synthetic MCP response fields additively; preserve WP08c fixtures.

## Existing journey coverage and remaining hypotheses

Reuse composerGeometry/composerContrast/reveal helpers where they already express
the required measurement. Do not add090's duplicate composerAssertions module.
New j8 cases own independent expected literals and actual interactions. Retain
current J6 true-reload cases and all16 WP08 geometry cases plus77 native input cases.
T5 already has strong component handler evidence; new full-app cases prove mounting
and request-boundary behavior, not a second identical77-case component suite.

Node HUD/default-fit and interrupted composition are hypotheses requiring actual
hosted failure evidence. J8 adds narrow/default-fit overlap and provider/focus/
remount interruption scenarios without preemptive production patches. If either
fails, record the causal activation and amend this file's exact production targets
before repair; no blind toolbar or composition-state redesign. Home roster cases
exercise every requested destination after scrolling above fixed navigation,
checking actual mode/hash and draft retention. Existing settings-overlay handling
is not assumed broken merely because the roster uses setUIMode.

J2 retains the actual401 path and proves edited draft/focus after Settings closes;
J3 adds a second real local-stub request with a different literal prompt after
billing recovery; J5 enters Create before editing and verifies same-home restart.
No real login, paid generation, user asset or live endpoint is used. All run behind
the verified092 isolation boundary. Preserve no-retry single-worker configuration.

## P completion still required

Main must finish exact guard/ownership APIs, integrate these targets into090,
assign non-overlapping B packets and independent A reviewers, and record current
type/list/baseline evidence. No production changes have been made in this WP.
