---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase1]
---

# 010 — wp1 기반: 워크플로 스키마 · 스토어 · 레지스트리 이음매 · tEXt 리더

의존: 없음. 이 phase는 네트워크 호출을 하지 않는다. 순수 스키마/저장/파싱.

## 변경 지도

| 파일 | 동작 |
|---|---|
| `lib/providers/types.ts` | MODIFY — vendor 유니온 확장, credential kind 추가, catalogAccess 필드 |
| `lib/providers/registry.ts` | MODIFY — comfy 레인 추가 (models: []) |
| `lib/comfyWorkflowStore.ts` | NEW — 레코드 CRUD + 영속 |
| `lib/comfyGraphBind.ts` | NEW — 그래프 파싱, class_type 추론, 주입, 파라미터 계약 |
| `lib/comfyPngWorkflow.ts` | NEW — PNG tEXt 청크 리더 |
| `config.ts` | MODIFY — comfy 블록 확장 |
| `lib/configKeys.ts` | MODIFY — 신규 키 등록 |
| `lib/runtimeContext.ts` | MODIFY — `comfyWorkflows` 필드 (§6.6) |
| `bin/lib/doctor-providers.ts` | MODIFY — `inspectLocalHttp` (§6.5) |
| `server.ts` | MODIFY — 부팅 하이드레이션 (§6.6) |
| `tests/provider-adapter-v1-contract.test.ts` | MODIFY — 픽스처 + 분기 (§6.6) |
| `tests/doctor-provider-contract.test.ts` | MODIFY — lane 수 + local-http |
| `ui/src/generated/providers.ts` | REGEN — 스크립트로만 |
| `tests/comfy-workflow-store.test.ts` | NEW |
| `tests/comfy-graph-bind.test.ts` | NEW |
| `tests/provider-registry-contract.test.ts` | MODIFY — 9개 lane |
| `tests/provider-registry-parity.test.ts` | MODIFY — 9개 lane |
| `tests/doctor-provider-contract.test.ts` | MODIFY — length 9 |
| `tests/models-endpoint-contract.test.ts` | MODIFY — lanes 키 |

## 1. lib/providers/types.ts

BEFORE (1-3행):

    export type KeyProviderId = "openai" | "xai" | "gemini" | "atlascloud" | "minimax";

    export type ProviderVendor = "openai" | "xai" | "google" | "atlascloud" | "minimax";

AFTER:

    export type KeyProviderId = "openai" | "xai" | "gemini" | "atlascloud" | "minimax";

    export type ProviderVendor = "openai" | "xai" | "google" | "atlascloud" | "minimax" | "comfy";

KeyProviderId는 **건드리지 않는다**. comfy는 API 키가 없다. byKeyVocabulary
계약(tests/provider-registry-contract.test.ts:33-35)이 openai/xai/gemini에
대해 정확한 배열을 요구하므로 새 vocabulary를 넣으면 그 어서션이 흔들린다.

credential union에 로컬 HTTP 종류를 추가한다. BEFORE (26행):

      | { kind: "local-cli"; envVars: readonly string[]; optionalApiKeyEnv?: string };

AFTER:

      | { kind: "local-cli"; envVars: readonly string[]; optionalApiKeyEnv?: string }
      /**
       * A user-run local HTTP server with no credential of its own. Distinct
       * from "oauth-proxy": ima2 neither spawns nor supervises it. Distinct
       * from "local-cli": it is reached over HTTP, not by executing a binary.
       */
      | { kind: "local-http"; envVars: readonly string[]; configKey?: string };

CoreProviderManifestBase에 카탈로그 성격 플래그를 추가한다:

    export interface CoreProviderManifestBase {
      id: string;
      vendor: ProviderVendor;
      credentials: readonly ProviderCredential[];
      models: readonly CoreProviderModel[];
      /**
       * "static": models[] is the whole truth (every lane before comfy).
       * "runtime": models[] is empty BY CONSTRUCTION and the real list comes
       * from a runtime store. Mirrors lib/mcp/providerRegistry.ts
       * catalogAccess, which already solved the same temporal problem for
       * higgsfield. Absent means "static".
       */
      catalogAccess?: "static" | "runtime";
      referenceLimits: Partial<Record<ProviderReferenceMode, number>>;
      elementTaxonomy: ElementTaxonomy | null;
      limits: { timeoutMs: number; maxInputBytes?: number };
      errorPrefix: string | null;
    }

기존 8개 레인은 catalogAccess를 생략하며 undefined는 static으로 읽는다.

## 2. lib/providers/registry.ts

minimax 항목 뒤, 배열 닫기 전에 삽입:

      {
        id: "comfy",
        vendor: "comfy",
        credentials: [{
          kind: "local-http",
          envVars: ["IMA2_COMFY_URL"],
          configKey: "comfy",
        }],
        // Empty BY CONSTRUCTION, not by omission. A comfy "model" is a
        // workflow the user registered at runtime, so no compile-time list can
        // be correct. The lane builder in routes/models.ts fills this from the
        // workflow store. deriveModelsFrom() returns an empty Set for [] rather
        // than throwing (lib/providers/deriveCore.ts), so the derive layer
        // already tolerates it.
        models: [],
        catalogAccess: "runtime",
        referenceLimits: { image: 4, edit: 4 },
        elementTaxonomy: null,
        limits: { timeoutMs: 1_800_000 },
        errorPrefix: "COMFY_",
      },

timeoutMs 1_800_000(30분): 로컬 GPU는 클라우드 API보다 느리고 큐 대기가
있다. grok video가 같은 이유로 1_800_000을 쓴다(config.ts:353).

referenceLimits 4: LoadImage 노드 수의 실용 상한. 워크플로가 실제로 받는
수는 바인딩에서 결정되며 이건 요청 단계 방어선이다.

## 3. lib/comfyWorkflowStore.ts (NEW)

    /**
     * Workflow registry for the comfy lane.
     *
     * A registered workflow IS a model: it appears in the model selector where
     * grok-imagine-image-2.0 sits in the grok lane. Records live on disk, not
     * in the const provider registry, because the set is user-authored.
     *
     * Each record carries its OWN origin. That single decision makes the
     * one-instance and many-instance (8188 SDXL + 8189 Flux) cases the same
     * code path instead of two: config.comfy.defaultUrl is only what the
     * registration form starts with.
     */
    import { mkdir, readFile } from "node:fs/promises";
    import { join } from "node:path";
    import { config } from "../config.js";
    import { atomicWriteJson } from "./atomicWrite.js";
    import { normalizeComfyOrigin } from "./comfyBridge.js";

    export const COMFY_WORKFLOW_ERROR = {
      ID_INVALID: "COMFY_WORKFLOW_ID_INVALID",
      ID_TAKEN: "COMFY_WORKFLOW_ID_TAKEN",
      NOT_FOUND: "COMFY_WORKFLOW_NOT_FOUND",
      GRAPH_INVALID: "COMFY_WORKFLOW_GRAPH_INVALID",
      BIND_INVALID: "COMFY_WORKFLOW_BIND_INVALID",
      STORE_CORRUPT: "COMFY_WORKFLOW_STORE_CORRUPT",
    } as const;

    /** Where one request field is injected into the graph. */
    export interface ComfyBinding { node: string; input: string; }

    export interface ComfyWorkflowBindings {
      prompt: ComfyBinding;
      negativePrompt?: ComfyBinding;
      width?: ComfyBinding;
      height?: ComfyBinding;
      seed?: ComfyBinding;
      refImage?: ComfyBinding;
      /** SaveImage-like node whose outputs are collected. No input key. */
      output: { node: string };
    }

    export interface ComfyWorkflowParam {
      name: string;
      node: string;
      input: string;
      type: "number" | "string" | "boolean";
      default?: number | string | boolean;
      min?: number;
      max?: number;
      options?: Array<number | string | boolean>;
    }

    export interface ComfyGraphNode {
      class_type: string;
      inputs: Record<string, unknown>;
      _meta?: { title?: string };
    }

    export interface ComfyWorkflowRecord {
      id: string;
      label: string;
      origin: string;
      graph: Record<string, ComfyGraphNode>;
      bind: ComfyWorkflowBindings;
      params: ComfyWorkflowParam[];
      createdAt: number;
      updatedAt: number;
    }

    // Model ids reach filesystem paths and URLs, so the id alphabet is closed
    // rather than merely "not empty".
    const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

    export function validateWorkflowId(id: unknown): string;
    export async function listWorkflows(): Promise<ComfyWorkflowRecord[]>;
    export async function getWorkflow(id: string): Promise<ComfyWorkflowRecord | null>;
    export async function putWorkflow(rec: ComfyWorkflowRecord): Promise<void>;
    export async function deleteWorkflow(id: string): Promise<boolean>;
    /** Distinct origins across all records, for parallel health probing. */
    export async function listOrigins(): Promise<string[]>;

저장 위치: join(config.storage.configDir, "comfy", "workflows.json").
단일 JSON + atomicWriteJson. 레코드 수가 수십 단위라 SQLite는 과하다.

putWorkflow는 normalizeComfyOrigin(rec.origin)을 통과시켜 저장한다 — 기존
검증기를 재사용하므로 http+루프백+포트 규칙이 자동 상속된다.

## 4. lib/comfyGraphBind.ts (NEW)

세 가지 일을 한다.

### (a) 그래프 검증

    /**
     * Accepts the API format only (File > Export (API)): a flat object keyed
     * by node id whose values carry class_type. The UI save format is a
     * LiteGraph serialization with a "nodes" ARRAY and link tables; POST
     * /prompt rejects it, so catching it here gives an actionable error
     * instead of an opaque upstream 400.
     */
    export function parseApiGraph(raw: unknown): Record<string, ComfyGraphNode>;

"nodes" 배열이 보이면 COMFY_WORKFLOW_GRAPH_INVALID와 함께 "이건 UI
저장본입니다. Export (API)로 다시 뽑아주세요" 메시지를 던진다.

### (b) 바인딩 후보 추론

    export interface BindCandidate {
      field: keyof ComfyWorkflowBindings;
      node: string;
      input: string;
      classType: string;
      title?: string;
      /** false when several nodes match and a human must choose. */
      unambiguous: boolean;
    }
    export function inferBindCandidates(graph): BindCandidate[];

class_type 매핑: CLIPTextEncode.text -> prompt/negativePrompt,
EmptyLatentImage.width|height -> width/height, KSampler.seed -> seed,
LoadImage.image -> refImage, SaveImage -> output.

CLIPTextEncode는 거의 항상 2개다. _meta.title에 negative/부정이 들어 있으면
힌트로 쓰되 **unambiguous: false를 유지한다** — 제목은 사용자가 자유롭게
바꾸는 값이라 신뢰 근거가 못 된다. 확정은 사람이 한다.

### (c) 주입

    /**
     * Returns a DEEP COPY with values injected. Mutating the stored graph
     * would make the second generation inherit the first one's prompt.
     */
    export function bindGraph(rec, values: {
      prompt: string; negativePrompt?: string;
      width?: number; height?: number; seed?: number;
      refImageName?: string;
      params?: Record<string, number | string | boolean>;
    }): Record<string, ComfyGraphNode>;

바인딩 대상 노드/입력이 그래프에 없으면 COMFY_WORKFLOW_BIND_INVALID.
등록 후 사용자가 ComfyUI에서 그래프를 바꿔 재export하면 발생한다.

### (d) 파라미터 계약 도출

    /**
     * Every scalar input NOT consumed by a binding and NOT a node link
     * (["nodeId", slot] arrays are wiring, not values) becomes a tunable
     * parameter. The settings UI renders these the way
     * McpModelPresetControls renders MCP model parameters.
     */
    export function deriveParams(graph, bind): ComfyWorkflowParam[];

## 5. lib/comfyPngWorkflow.ts (NEW)

**사전 가정 정정**: lib/pngInfo.ts는 26줄이고 IHDR만 읽는다(width/height/
bitDepth/colorType). tEXt 파서는 없다. 신규 구현이 필요하다.

    /**
     * Reads ComfyUI's embedded graph out of a PNG.
     *
     * ComfyUI writes two text keys (nodes.py SaveImage): "prompt" holds the
     * API-format graph — the one POST /prompt accepts — and "workflow" holds
     * the UI save format. We want "prompt"; "workflow" would need conversion.
     *
     * zTXt/iTXt are read too: PIL promotes long text to compressed chunks, and
     * a large graph is exactly the case that trips that promotion.
     */
    export function readPngTextChunks(buffer: Buffer): Map<string, string>;
    export function extractComfyApiGraph(buffer: Buffer): Record<string, ComfyGraphNode> | null;

청크 순회 상한(텍스트 4MB, 청크 512개)을 둔다. 신뢰할 수 없는 입력이다.

## 6. config.ts / lib/configKeys.ts

comfy 블록(387행) 확장. BEFORE는 defaultUrl/uploadTimeoutMs/maxUploadBytes
3개. AFTER:

      comfy: {
        defaultUrl: pickStr(env.IMA2_COMFY_URL, fileCfg.comfy?.defaultUrl, "http://127.0.0.1:8188"),
        uploadTimeoutMs: pickPositiveInt(env.IMA2_COMFY_UPLOAD_TIMEOUT_MS, fileCfg.comfy?.uploadTimeoutMs, 30_000),
        maxUploadBytes: pickPositiveInt(env.IMA2_COMFY_MAX_UPLOAD_BYTES, fileCfg.comfy?.maxUploadBytes, 50 * 1024 * 1024),
        // --- 010 additions ---
        // Health probe. Short by design: a dead instance must not freeze the
        // settings surface while other instances are alive.
        healthTimeoutMs: pickPositiveInt(env.IMA2_COMFY_HEALTH_TIMEOUT_MS, fileCfg.comfy?.healthTimeoutMs, 2_000),
        pollIntervalMs: pickPositiveInt(env.IMA2_COMFY_POLL_INTERVAL_MS, fileCfg.comfy?.pollIntervalMs, 1_000),
        // Whole-job ceiling incl. queue wait. Local GPU queues run long.
        generationTimeoutMs: pickPositiveInt(env.IMA2_COMFY_GENERATION_TIMEOUT_MS, fileCfg.comfy?.generationTimeoutMs, 1_800_000),
        maxDownloadBytes: pickPositiveInt(env.IMA2_COMFY_MAX_DOWNLOAD_BYTES, fileCfg.comfy?.maxDownloadBytes, 100 * 1024 * 1024),
      },

lib/configKeys.ts WRITABLE_CONFIG_KEYS에 comfy.healthTimeoutMs,
comfy.pollIntervalMs, comfy.generationTimeoutMs, comfy.maxDownloadBytes 추가.

## 6.5 bin/lib/doctor-providers.ts — local-http 분기 (감사 #3)

새 credential kind는 **자동으로 처리되지 않는다.** 현재 디스패처는 switch의
default가 inspectLocalCli다(bin/lib/doctor-providers.ts:81-87):

      if (credential.kind === "api-key") return inspectApiKey(...);
      if (credential.kind === "oauth-proxy") return inspectOauth(...);
      if (credential.kind === "service-account") return inspectServiceAccount(...);
      return inspectLocalCli(provider.id, credential);   // <- comfy가 여기로 떨어진다

inspectLocalCli는 env 값에 existsSync를 부른다(:74). 즉
`IMA2_COMFY_URL=http://127.0.0.1:8188`을 **파일 경로로 보고** "comfy: local
CLI override missing"을 출력한다. 틀렸을 뿐 아니라 사용자가 할 수 있는 일이
없는 메시지다.

추가:

    /**
     * A local-http lane has no binary and no key. Falling through to
     * inspectLocalCli would existsSync() a URL and report a missing file.
     *
     * Synchronous like its siblings — doctor lines are built in one pass — so
     * this reports CONFIGURATION, never liveness. It does not open a socket;
     * reachability belongs to the settings surface, which probes
     * /system_stats. Saying "offline" here would need IO doctor cannot do.
     */
    function inspectLocalHttp(
      lane: string,
      credential: Extract<ProviderCredential, { kind: "local-http" }>,
    ): ProviderDoctorLine {
      const override = firstEnv(credential.envVars);
      const raw = override ?? runtimeConfig.comfy.defaultUrl;
      try {
        const origin = normalizeComfyOrigin(raw);
        return { lane, kind: "pass", text: `${lane}: origin ${origin}` };
      } catch {
        return { lane, kind: "fail", text: `${lane}: invalid origin ${raw}` };
      }
    }

**워크플로 개수는 여기서 보고하지 않는다.** doctor는 동기이고 스토어는
비동기다. `validateAuth`가 쓰는 `ctx.comfyWorkflows`는 런타임 컨텍스트라
CLI doctor 경로에 없다. 개수를 넣으려면 doctor를 async로 바꾸거나 캐시를
또 만들어야 하는데, 둘 다 이 한 줄을 위해 치를 값이 아니다.

디스패처에 `kind === "local-http"` 분기를 **inspectLocalCli 폴백보다 앞에**
넣는다.

## 6.6 provider-adapter-v1 계약 (감사 #4)

tests/provider-adapter-v1-contract.test.ts:85가 listProviderAdapters를
**전수 순회**하며 각 어댑터에 키 있음/없음 2상태를 요구한다:

      assert.deepEqual(adapter.validateAuth(), { ok: true }, "with key");
      const absent = getProviderAdapter(withoutKey, adapter.laneId);
      assert.equal(absent!.validateAuth().ok, false, "without key");
      assert.match(result.reason ?? "", EXPECTED_AUTH_REASON[adapter.laneId]);

comfy에는 키가 없다. 어댑터를 등록하는 순간 이 테스트가 깨진다.

처분: **2상태를 없애지 않고 의미를 바꾼다.** comfy의 "인증됨"은 워크플로가
하나 이상 등록된 상태다. 빈 스토어에서는 모든 생성이 400이 되므로, UI가
알려야 할 것도 정확히 그것이다.

### 주입 경로는 ctx 하나뿐이다 (감사 라운드2 #1)

초안은 "스토어가 갱신하는 캐시된 개수를 읽는다"고 썼다. **작성 불가능하다.**
픽스처가 컨텍스트만 바꾸기 때문이다:

      function contextWith(key: string | undefined): RuntimeContext {
        return { minimaxApiKey: key, atlasCloudApiKey: key } as unknown as RuntimeContext;
      }
      const withKey = contextWith("test-key");
      const withoutKey = contextWith(undefined);

두 호출 사이에 프로세스 전역 캐시가 ≥1이면서 동시에 0일 수는 없다.
따라서 **`validateAuth`는 ctx에서 읽는다.** 다른 어댑터가 ctx에서 키를
읽는 것과 정확히 같은 이유이고(minimax.ts 주석: routes/keys.ts가 실행 중에
ctx를 갱신한다), 같은 형태다.

`lib/runtimeContext.ts`의 `RuntimeContext`에 추가:

    /**
     * Registered comfy workflows, hydrated at boot and refreshed on write.
     *
     * Lives on the context rather than behind a module-global store read
     * because ProviderAdapterV1.validateAuth() and listModels() are BOTH
     * synchronous while the store is async — and because the adapter contract
     * suite injects state exclusively through RuntimeContext
     * (tests/provider-adapter-v1-contract.test.ts:17-25). A module cache
     * cannot be empty and non-empty for the two calls that test makes.
     */
    comfyWorkflows?: readonly ComfyWorkflowRecord[];

`createTestRuntimeContext`(runtimeContext.ts:168)가 이미 오버라이드를
받으므로 테스트 주입은 공짜다.

### 하이드레이션 소유자 (감사 라운드3 #2)

`ctx.comfyWorkflows`를 **누가 채우는지** 명시한다. 소유자가 없으면
프로덕션에서 이 배열이 영원히 비어 있고, 어댑터는 항상 "워크플로 없음"을
보고한다 — 테스트만 초록인 상태가 된다.

| 파일 | 시점 | 동작 |
|---|---|---|
| `server.ts` | 부팅 | `ctx.comfyWorkflows = await listWorkflows()` (기존 ctx 조립 구간) |
| `routes/comfy.ts` | put/delete 성공 직후 | `ctx.comfyWorkflows = await listWorkflows()` |

`routes/keys.ts`가 키를 갱신하는 것과 같은 패턴이다: 스토어가 진실이고
ctx는 동기 소비자를 위한 투영이다. **생성 경로는 ctx를 신뢰하지 않는다** —
`generateViaComfy`는 워크플로를 스토어에서 직접 async로 읽으므로, ctx가
한 틱 뒤처져도 생성이 틀리지 않는다. ctx는 어댑터 계약과 UI 표시용이다.

### 테스트 수정 (실제로 작성 가능한 형태)

`contextWith`를 확장한다:

      // Minimal record: the assertions only read .id and .bind.refImage.
      const FIXTURE_WORKFLOW = {
        id: "fixture-workflow",
        label: "Fixture",
        origin: "http://127.0.0.1:8188",
        graph: {},
        bind: { prompt: { node: "6", input: "text" }, output: { node: "9" } },
        params: [],
        createdAt: 0,
        updatedAt: 0,
      } as unknown as ComfyWorkflowRecord;

      function contextWith(key: string | undefined): RuntimeContext {
        return {
          minimaxApiKey: key,
          atlasCloudApiKey: key,
          // The comfy lane has no key: its two-state is "has a workflow" vs
          // "has none", injected the same way every other lane's credential is.
          comfyWorkflows: key ? [FIXTURE_WORKFLOW] : [],
        } as unknown as RuntimeContext;
      }

`EXPECTED_AUTH_REASON`에 `comfy: /workflow/i` 추가.

### listModels 어서션(:57) 분기

`listModels()`도 동기이므로 같은 ctx 배열을 읽는다 — 이러면 비교가
**작성 가능**하다:

      // A runtime-catalog lane's registry models are [] by construction, so
      // comparing adapter.listModels() to the registry would pass vacuously
      // and assert nothing. Assert the real invariant instead: the adapter
      // projects exactly the workflows the context carries.
      const manifest = getProvider(adapter.laneId);
      if (manifest.catalogAccess === "runtime") {
        assert.deepEqual(
          adapter.listModels().map((m) => m.id),
          (withKey.comfyWorkflows ?? []).map((w) => w.id),
        );
      } else {
        assert.deepEqual(
          adapter.listModels().map((m) => m.id),
          manifest.models.map((m) => m.id),
        );
      }

`catalogAccess`는 §1에서 `CoreProviderManifestBase`에 추가되므로 이 시점에
타입이 존재한다.

**주의**: `:71` "no adapter source hard-codes a model id" 테스트는 comfy에서
**공허하게 통과**한다(레지스트리 모델이 0개라 순회할 게 없다). 해가 되진
않지만 지켜주는 것도 없다는 사실을 기록해 둔다.

## 7. 기존 테스트 수정 (감사 #2로 확장)

000이 처음 센 "4곳"은 `=== "minimax"` 형태의 명시 비교만 grep한 결과였다.
실측 전수 목록:

| 파일:행 | 내용 |
|---|---|
| provider-registry-contract.test.ts:17 | 8-id 배열 → comfy 추가 |
| provider-registry-parity.test.ts:12 | CORE_IDS → comfy 추가 |
| provider-registry-parity.test.ts:55 | 레인별 모델 **개수** 맵 → comfy 0 |
| doctor-provider-contract.test.ts:25 | `lanes.length === 8` → 9 |
| models-endpoint-contract.test.ts:118 | lanes 키 배열 → minimax 뒤, runway 앞 |
| provider-adapter-v1-contract.test.ts:57,87,134 | §6.6 참조 |
| cli-feature-parity-contract.test.js:97 | docs/CLI.md provider 목록 (040에서) |

**ui/src/types.ts는 건드리지 않는다.** comfy는 새 prefix 별칭을 만들지 않아
Extract<>가 never가 되는 함정을 피한다 — 리뷰어가 이 주장을 검증했고
참으로 확인됐다(빈 PROVIDER_MODELS.comfy.image는 ImageModelId 멤버를 추가
하지 않으므로 기존 별칭이 그대로 유지된다).

다만 **UI 런타임은 별개 문제다**: ui/src/lib/imageModels.ts:95의 default가
OPENAI_IMAGE_MODEL_OPTIONS라 comfy가 GPT 모델을 보여준다. 이건 타입이 아니라
동작이며 050에서 처리한다(감사 #6).

## 8. 신규 테스트

tests/comfy-workflow-store.test.ts: 임시 디렉터리 + id 알파벳 거부 + 중복
id + origin 비루프백 거부 + listOrigins 중복 제거 + 손상 JSON 복구.

tests/comfy-graph-bind.test.ts: API 그래프 수용 / UI 그래프 거부 /
CLIPTextEncode 2개일 때 unambiguous false / 주입이 원본 불변 / 누락 노드 시
BIND_INVALID / deriveParams가 링크 배열 제외 / PNG tEXt에서 prompt 키 추출.

## Accept criteria

1. node scripts/generate-provider-types.mjs 실행 후 생성 파일에 "comfy"가
   나타나고 --check 통과. **활성화 시나리오**: PROVIDER_MODELS.comfy가
   {image:[],video:[]}로 등장하는지 grep으로 확인.
2. `cd ui && npx tsc -p tsconfig.app.json --noEmit` exit 0 — Extract<> 별칭이
   never가 되지 않았다는 증거. **서버 `npm run typecheck`로는 증명되지 않는다**
   (감사 #1): 루트 tsconfig.json의 include는 server/config/lib/routes/bin/types
   뿐이고 `ui`가 없다. UI 타입은 ui/tsconfig.app.json이 소유한다. 서버
   typecheck도 돌리되 그것이 증명하는 범위는 lib/routes/bin이다.
3. 신규 테스트 2종 통과, npm run test:inventory 통과.
   (신규 테스트 파일은 docs/migration/runtime-test-inventory.md에 등재해야
   inventory 게이트를 통과한다.)
4. 수정된 기존 테스트 통과 — §7 표의 7개 항목 전부(파일 6개, 그중
   provider-registry-parity는 두 지점).
5. `ima2 doctor`가 comfy 레인에 대해 **origin 기반** 문구를 낸다.
   **활성화 시나리오**: (a) `IMA2_COMFY_URL=http://127.0.0.1:8188`으로
   doctor를 돌려 `comfy: origin http://127.0.0.1:8188` pass를 확인하고
   출력에 "local CLI"가 없음을 검증. (b) `IMA2_COMFY_URL=/tmp/nope`로
   돌려 `invalid origin` fail을 확인 — 이것이 `existsSync` 경로로 다시
   떨어지지 않았다는 증거다.
6. git diff --stat에 docs/grok-video-i2v-research.md 없음.

## Out of scope

네트워크 호출 일절 없음. 라우트/파이프라인/CLI/UI 미변경.
