---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, catalog, cli, ui, phase3]
---

# 030 — Comfy 비디오 workflow 이름을 ima2에 정직하게 노출

## Contract

IN: workflow media kind 저장·복원, `/api/models` image/video 분리, model-level
execution lock, CLI label 출력, UI 비디오 그룹의 disabled row, H3 workflow 등록.

OUT: Comfy 비디오 다운로드/저장/실행, `routes/video.ts` dispatch, Grok planner
변경, multimode/node/agent 지원. 실행은 후속 unit 전까지 명시적으로 locked다.

Resource bound: 120분, 신규 dependency 0, local repo만 변경. 한 changeset이
500 lines를 넘으면 contract/store와 consumer/UI를 두 atomic commits로 나누되
같은 work-phase 안에서 검증한다.

## Why a patch is needed

`--label`만 쓰면 이름은 보이지만 현재 `/api/models`가 모든 Comfy workflow를
`models.image`에 넣는다(`routes/models.ts:248-277`). H3 SaveVideo graph를 선택하면
이미지 어댑터가 MP4/WebM을 `COMFY_IMAGE_INVALID`로 거부한다
(`lib/comfyImageAdapter.ts:207-247`). 이름만 image 목록에 넣는 것은 거짓 지원이다.

따라서 video 목록에 보이되, 실행 지원 전에는 disabled/locked로 명시한다.

## Field chains

### `ComfyWorkflowRecord.mediaKind`

| Stage | Path | Exact behavior |
|---|---|---|
| creation | `bin/commands/comfy.ts` | `workflow add --kind image|video`; omitted value defaults to inspect inference, then image |
| creation | `ui/src/components/settings/ComfyWorkflowManager.tsx` | registration form sends selected/inferred media kind |
| serialization | `routes/comfy.ts` → `lib/comfyWorkflowStore.ts` | validated value is persisted in `workflows.json` |
| deserialization | `lib/comfyWorkflowStore.ts` | legacy record missing field normalizes to `image`; invalid values are dropped/fail closed |
| API consumer | `routes/comfy.ts` | list/create responses include `mediaKind` |
| catalog consumer | `routes/models.ts` | image and video arrays are partitioned by media kind |
| browser consumer | `ui/src/lib/api-comfy.ts` | workflow/list and `/api/models` types carry media kind |

### `McpModelEntry.executable` / `lockReason`

| Stage | Path | Exact behavior |
|---|---|---|
| creation | `routes/models.ts` | Comfy image workflow: executable true/omitted; Comfy video: false + fixed reason |
| serialization | Express JSON | fields remain optional and secret-free |
| deserialization | `ui/src/lib/api-comfy.ts`, `bin/lib/modelResolver.ts` | optional fields preserve backward compatibility |
| UI consumer | `ui/src/components/GenProviderModelSelect.tsx` | video row rendered disabled with lock reason |
| CLI consumer | `bin/commands/models.ts` | table shows label and model status `ready|locked`; JSON remains additive |

N/A: no request deserialization into a video runtime because dispatch is explicitly out of
scope. The disabled selector proves the value cannot reach `routes/video.ts`.

## Exact file delta

### Store and registration contract

- MODIFY `lib/comfyWorkflowStore.ts`
  - NEW `ComfyMediaKind = "image" | "video"`.
  - ADD `mediaKind` to `ComfyWorkflowRecord`.
  - replace boolean-only raw shape use with a normalizer that returns a record and
    defaults only a missing legacy field to `image`.
  - `putWorkflow` input validates media kind; unknown string gets
    `COMFY_WORKFLOW_MEDIA_KIND_INVALID` 400.
- MODIFY `lib/comfyGraphBind.ts`
  - output candidate accepts both `SaveImage` and core `SaveVideo`.
  - NEW pure `inferComfyMediaKind(graph)` returns `video` only when the bound/output
    node class is SaveVideo; mixed/ambiguous output requires explicit kind.
- MODIFY `routes/comfy.ts`
  - inspect response includes inferred media kind.
  - create forwards validated `mediaKind` to store.
- MODIFY `bin/commands/comfy.ts`
  - help/flag parser adds `--kind image|video`.
  - `workflow inspect` prints inferred kind.
  - `workflow add` forwards explicit or unambiguous inferred kind.
  - success text says `catalog-only` for video and does not print an `ima2 gen`
    execution command.
- MODIFY `ui/src/lib/api-comfy.ts`
  - types and create/inspect payloads carry media kind.
- MODIFY `ui/src/components/settings/ComfyWorkflowManager.tsx`
  - add an image/video select using existing controls.
  - inspection preselects unambiguous media kind; user can override before save.

### Catalog lock and visible name

- MODIFY `lib/mcp/modelCapabilities.ts`
  - optional `executable?: boolean`, `lockReason?: string` on model entries.
- MODIFY `ui/src/lib/mcpProviders.ts`
  - mirror the two optional fields; existing MCP consumers treat omission as executable.
- MODIFY `routes/models.ts`
  - split `workflows` by `mediaKind`.
  - project H3 and every other video workflow into `models.video` with
    `executable:false` and reason `ComfyUI video execution is not supported yet`.
  - keep image workflow defaults and liveness behavior unchanged.
- MODIFY `ui/src/lib/api-comfy.ts`
  - replace image-only `getComfyLaneModels()` return with `{image, video}`.
- MODIFY `ui/src/components/GenProviderModelSelect.tsx`
  - render Comfy image and video groups separately.
  - video rows remain visible but disabled; `title`/subtext exposes lock reason.
  - do not touch `videoModelSelected` or call `storeVideoImpl` for disabled items.
- MODIFY `bin/commands/models.ts`
  - table adds `label` and per-model `model-status` columns.
  - label `MiniMax H3 FL2VA pruned NVFP4` appears in non-JSON output.
- MODIFY `bin/lib/modelResolver.ts`
  - mirror optional model-level `executable` and `lockReason` fields in the catalog
    DTO consumed by `bin/commands/models.ts`; resolution semantics remain unchanged.

### H3 registration artifact

- REUSE `devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/020_t2v_api.json`
  from the successful 020 graph; do not create a second graph copy that can drift.
- Register through the public CLI:

```bash
ima2 comfy workflow add \
  devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/020_t2v_api.json \
  --id minimax-h3-fl2va-pruned-nvfp4 \
  --label "MiniMax H3 FL2VA pruned NVFP4" \
  --kind video \
  --origin http://127.0.0.1:18188 \
  --prompt <verified-node.input> --output <verified-savevideo-node> --yes
```

The 18188 origin is the existing local SSH-tunnel convention. Offline tunnel state must
not hide the row; it adds the existing offline marker in addition to execution lock.

## Tests

- MODIFY `tests/comfy-workflow-store.test.ts`: legacy default, video round-trip,
  invalid kind rejection, replace preservation.
- MODIFY `tests/comfy-graph-bind.test.ts`: SaveVideo inference and image/video ambiguity.
- MODIFY `tests/comfy-routes-contract.test.ts`: inspect/create/list include media kind.
- MODIFY `tests/comfy-cli-contract.test.ts`: `--kind`, video catalog-only success copy,
  label column.
- MODIFY `tests/comfy-ui-contract.test.ts`: separate groups and disabled video row.
- MODIFY `tests/models-endpoint-contract.test.ts` or nearest runtime-catalog test:
  image workflow stays image, video workflow is video + locked.
- MODIFY `tests/cli-model-resolver.test.ts`: additive executable fields do not change
  existing resolution behavior because locked Comfy video is never selected.

## Activation scenarios

| Branch | Trigger | Observable effect |
|---|---|---|
| legacy record | no `mediaKind` | list returns `image`; no record disappears |
| explicit video | valid SaveVideo graph + `--kind video` | models.video row is visible and locked |
| invalid kind | arbitrary string | 400/exit 2 with stable error code |
| offline origin | health probe false | visible row says offline and remains disabled |
| attempted selection | pointer/keyboard on locked row | no state change, no request |
| existing image workflow | `mediaKind:image` or legacy | same image group and execution path |

## Bypass record

- Tier: E3 application contract.
- Executing surface: server projection + React selector.
- Known bypass: a caller can handcraft `/api/video/generate` outside the selector.
- Residual: that route still rejects/ignores Comfy as before; no silent image fallback.
- Wording: this is a catalog lock, not full enforcement. Final runtime layer: existing
  provider validation in `routes/video.ts`.

## Verifiers and target coverage

```bash
node --experimental-strip-types --test \
  tests/comfy-workflow-store.test.ts tests/comfy-graph-bind.test.ts \
  tests/comfy-routes-contract.test.ts tests/comfy-cli-contract.test.ts \
  tests/comfy-ui-contract.test.ts tests/models-endpoint-contract.test.ts \
  tests/cli-model-resolver.test.ts
npm run typecheck
npm run typecheck:tests
cd ui && npm run build
```

Each targeted test imports or text-reads the listed owners. The UI build reads all changed
TSX/types but does not prove rendered disabled behavior; 040 browser QA does.

## Rollback

Revert the atomic contract/UI commits. Legacy records still parse as image both before and
after rollback. Remove only the newly registered H3 workflow via public CLI if needed; do
not edit the workflow store by hand.
