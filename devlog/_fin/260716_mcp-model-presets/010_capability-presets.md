# 010 — 모델별 capability contract + preset UI diff plan

## Scope boundary

IN: enriched model catalog, pure normalization, MCP preset persistence, selected-model Settings controls, Runway ratio/duration/resolution/audio validation+forwarding, tests, MCP SoT 문단.

OUT: Higgsfield generation adapter, paid smoke, core provider controls, end-frame/v2v upload UI, shared Select behavior refactor, App.tsx, 병행 asset-gen/node work.

## File map

| Path | Change | Exact delta |
|---|---|---|
| `lib/mcp/modelCapabilities.ts` | NEW | bounded shared server types/parser helpers: scalar, parameter, input roles, entry capabilities |
| `lib/mcp/adapters/runway.ts` | MODIFY | verified per-model entries; adapter model arrays derive from entries; ratio/parameter validator; duration/resolution/generateAudio forwarding |
| `lib/mcp/modelsCatalog.ts` | MODIFY | rich Higgsfield projection, durations/duration_range synthesis, existing pagination/cache/read-only guard 유지; Runway enriched entries 반환 |
| `lib/mcp/providerAdapter.ts` | MODIFY | `parameters?: Record<string, scalar>` normalized request field + bounded record parser |
| `routes/mcpMedia.ts` | MODIFY | request boundary parses parameters; forwards to execute; records selected presets in sidecar |
| `ui/src/lib/mcpProviders.ts` | MODIFY | mirrored capability types, `/models` enriched response를 Runway/Higgsfield 모두의 canonical catalog로 사용; `McpGenerateInput.parameters` |
| `ui/src/lib/mcpSelection.ts` | MODIFY | syntax-only ratio/scalar persistence sanitizer, capability-based default/reconcile helpers, parameters payload omission |
| `ui/src/store/storeTypes.ts` | MODIFY | generation defaults/AppState에 `mcpParameters` 추가 |
| `ui/src/store/storePersistence.ts` | MODIFY | bounded scalar record parse/write |
| `ui/src/store/storeSettingsImpl.ts` | MODIFY | model change 시 defaults를 ratio+parameters와 atomic set; parameter update/clear/hydrate; generation input forwarding |
| `ui/src/components/GenProviderModelSelect.tsx` | MODIFY | parsed model value를 catalog entry와 연결해 atomic default 적용 |
| `ui/src/components/settings/McpModelPresetControls.tsx` | NEW | core preset rows + Advanced rows + input role tags; no catalog fetch/state owner |
| `ui/src/components/settings/McpGenerationControls.tsx` | MODIFY | duplicate model grid 삭제, selected entry summary + preset component, unknown capability/default state |
| `ui/src/styles/right-panel.css` | MODIFY | selected model summary, 2-col preset layout, chip/grid/detail styles; 기존 model grid 제거 |
| `ui/src/styles/responsive-layout.css` | MODIFY | narrow/mobile one-column + 44px controls only if current selectors do not already satisfy it |
| `ui/src/i18n/{ko,en}.json` | MODIFY | preset/Auto/tool-input/unknown capability labels recursive parity |
| `tests/mcp-models-catalog.test.ts` | MODIFY | rich projection, malformed bound, synthetic duration, Runway matrix, read-only pagination |
| `tests/mcp-provider-adapters.test.ts` | MODIFY | supported forwarding; invalid ratio/parameter rejected before call plan |
| `tests/mcp-selection-helpers.test.ts` | MODIFY | model defaults, switch reconcile, arbitrary stale key removal, payload omission |
| `tests/mcp-media-kind-behavior.test.ts` | MODIFY | persistence migration/round-trip |
| `tests/mcp-generation-integration.test.ts` | MODIFY | route request→adapter parameters and sidecar contract, Higgsfield lock 유지 |
| `tests/mcp-provider-ui-contract.test.js` | MODIFY | duplicate grid 제거, selected-entry preset owner, i18n/lock/source contracts |

`npm run build:server`가 대응 `.js` tracked artifacts를 생성하면 그 파일만 함께 포함한다. 사용자의 기존 dirty files는 stage/commit하지 않는다.

## Data contract

```ts
type McpPresetValue = string | number | boolean;
type McpModelParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "string_array";
  required?: boolean;
  description?: string;
  default?: McpPresetValue;
  options?: McpPresetValue[];
  min?: number;
  max?: number;
};
type McpModelCapabilities = {
  source: "provider-declared" | "verified-contract";
  aspectRatios: string[];
  parameters: McpModelParameter[];
  inputRoles: string[];
};
```

Parser limits: item/array count는 existing 300/100 경계 안, id/name/description/parameter string 길이 제한, parameter name pattern 제한, options scalar-only/최대 50, finite numeric min/max/default만 허용. malformed field는 item 전체가 아니라 그 field만 버린다.

## State and payload

- `mcpParameters`는 selected model의 user intent만 저장한다. capability/catalog는 server state라 Zustand에 저장하지 않는다.
- model change event가 `defaultMcpPresetSelection(entry.capabilities)`을 계산해 model/kind/ratio/parameters를 한 번에 set+persist한다. catalog load effect가 state를 되쓰기 시작하지 않는다.
- hydration은 syntax-only다. `GenProviderModelSelect`가 catalog promise를 resolve한 단 한 번의 completion event에서 현재 selected entry를 찾아 pure reconcile을 실행하고, 실제 delta가 있을 때만 한 번 set+persist한다. Settings의 catalog consumer는 state를 쓰지 않는다. state/capability watch effect는 만들지 않는다.
- `buildMcpGenerationInput`은 scalar parameters만 emit하고 빈 record는 생략한다. 최종 semantic guard는 Runway adapter다.
- Runway adapter는 effective model(default image `nano-banana-pro`, video `seedance-2`)의 aspectRatios/parameters만 허용한다. unknown key/type/option/range는 `MCP_PARAMETER_UNSUPPORTED` 또는 `MCP_PARAMETER_INVALID`로 tool call plan 생성 전 거부한다.
- Higgsfield adapter는 계속 route 409/client pre-block에서 종료한다. rich catalog가 `executable`을 변경하는 코드 경로는 없다.
- UI renderable parameter는 `options`, bounded numeric range, boolean 중 하나를 가진 scalar만이다. free-form id/string_array parameter는 catalog contract에는 남기되 control/payload state에는 넣지 않는다.
- generic `mcpParameters`를 쓰는 이유는 Higgsfield 61모델의 provider-declared enum/range 이름을 보존하기 위해서다. 실행은 generic하지 않다. Runway adapter의 정적 model matrix가 허용한 canonical key만 upstream top-level args로 변환하며 Higgsfield는 0개다.

## Activation scenarios

1. Higgsfield rich parser: fixture/live-shaped item에 resolution/duration/aspect/media roles를 넣고 `/models` projection에서 읽힌다. malformed options는 제거되고 `models_explore` 외 tool call은 0이다.
2. Model switch: Runway seedance-2→veo-3.1에서 15s/480p 저장값이 사라지고 Veo default 8s만 남는다. 같은 model의 valid 값은 event-driven reconcile에서 유지된다.
3. Auto omission: ratio/parameter Auto 클릭 후 HTTP payload key가 없고 adapter args에도 없다.
4. Unsupported injection: stale localStorage 또는 직접 HTTP로 `resolution=16k`, unknown parameter를 보내면 adapter가 upstream `callTool` 전에 typed failure를 낸다.
5. Higgsfield lock: capability가 완전한 모델을 선택해도 Generate는 client에서 request 0건, direct route는 409다.
6. Render: Runway seedance/veo/image 모델과 Higgsfield nano/seedance를 바꿔 각기 다른 rows/options/defaults를 확인한다. catalog error/unknown capability는 provider defaults 상태를 보이고 crash/loop가 없다.

## Acceptance

- Runway 3 image + 6 video, Higgsfield live 31 image + 30 video가 기존 selector에 유지된다.
- 선택 모델의 exact declared ratios와 renderable scalar parameters가 Settings에 나타난다. unsupported field는 숨긴다.
- 우측 Settings에는 모델 전체 grid가 더 이상 중복되지 않는다.
- Runway duration/resolution/generateAudio는 지원 모델에서만 tool args로 전달된다. invalid 조합/값은 upstream call 전 거부된다.
- Higgsfield generation/billing safety contract는 byte-level source/test assertion으로 유지된다.
- focused tests, typecheck, test typecheck, server build, UI build가 exit 0이다. full `npm test`의 기존 baseline 2건 외 신규 failure가 없다.
- browser 1440/1024/768/390/320에서 clipping 없음, keyboard focus/selector path 정상, screenshot이 devlog asset으로 남는다.
