---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase2]
---

# 020 — wp2 런타임: comfyImageAdapter 제출/폴링/수신/취소/헬스

의존: 010(스키마·스토어·바인딩). 이 phase가 처음으로 네트워크를 탄다.

모든 계약은 001의 실기 검증에 근거한다. 추측 항목은 그렇다고 표시했다.

## 변경 지도

| 파일 | 동작 |
|---|---|
| `lib/comfyImageAdapter.ts` | NEW — generateViaComfy + 취소 + 헬스 |
| `lib/providers/adapters/comfy.ts` | NEW — ProviderAdapterV1 |
| `lib/providers/adapters/index.ts` | MODIFY — 팩토리 등록 |
| `lib/comfyBridge.ts` | MODIFY — uploadImageToComfy 추출 |
| `tests/comfy-provider-contract.test.ts` | NEW |

## 1. lib/comfyImageAdapter.ts (NEW)

### 결과 타입 — 파이프라인 계약 준수

공유 어댑터 결과 타입은 저장소에 **존재하지 않는다**. 파이프라인은
구조적으로 `r.b64`만 요구하고 나머지는 있으면 읽는다
(lib/generatePipeline.ts:526-651). minimax/atlascloud 형태를 따른다.

    type ComfyImageResult = {
      b64: string;
      revisedPrompt?: string | null | undefined;
      usage: Record<string, number> | null;
      webSearchCalls: number;
      mime?: string | undefined;
      providerUrl?: string | null | undefined;
      /** Workflow id actually executed. Mirrors minimax effectiveModel. */
      effectiveModel: string;
      /** Instance-local. Paired with origin because it means nothing elsewhere. */
      promptId: string;
      origin: string;
    };

`usage`는 항상 null, `webSearchCalls`는 0이다 — 로컬 GPU에는 과금도
웹검색도 없다. minimax/atlas도 같은 값을 낸다.

### 옵션

    type ComfyGenerateOptions = {
      /** Workflow id. This is what "model" means in the comfy lane. */
      model?: string | undefined;
      size?: string | undefined;
      seed?: number | undefined;
      negativePrompt?: string | undefined;
      params?: Record<string, number | string | boolean> | undefined;
      references?: Array<{ b64: string; declaredMime?: string | null; detectedMime?: string | null }> | undefined;
      signal?: AbortSignal | undefined;
      requestId?: string | undefined;
      /** Reports Comfy queue position so the SSE layer can surface a real wait. */
      onQueue?: (info: { position: number; running: boolean }) => void;
    };

### 에러 규약

    const COMFY_ERR = {
      WORKFLOW_NOT_FOUND: "COMFY_WORKFLOW_NOT_FOUND",
      WORKFLOW_BIND_INVALID: "COMFY_WORKFLOW_BIND_INVALID",
      OFFLINE: "COMFY_OFFLINE",
      SUBMIT_REJECTED: "COMFY_SUBMIT_REJECTED",
      EXECUTION_FAILED: "COMFY_EXECUTION_FAILED",
      NO_IMAGE: "COMFY_NO_IMAGE",
      DOWNLOAD_FAILED: "COMFY_DOWNLOAD_FAILED",
      TIMEOUT: "COMFY_TIMEOUT",
      IMAGE_INVALID: "COMFY_IMAGE_INVALID",
    };

`WORKFLOW_BIND_INVALID`는 010의 `bindGraph`가 던지는 코드다(감사 #9).
어댑터가 자기 어휘에 갖고 있지 않으면 030이 i2i 실패를 이 코드로 보고할
수 없다. `bindGraph` throw를 그대로 통과시키고 `normalizeError`가
접두사를 유지하도록 한다.

registry의 `errorPrefix: "COMFY_"`와 정렬된다. 스캐너 규칙
`/^[A-Z][A-Z0-9_]*_$/`(provider-registry-contract.test.ts:24)을 만족한다.

### 제출

    /**
     * ComfyUI accepts a client-chosen prompt_id when it is a canonical UUID
     * (verified live 2026-08-23; a non-UUID gets 400 invalid_prompt_id). We
     * pass ima2's requestId ONLY when it already has that shape, and otherwise
     * take the server-generated id. Forcing a rewrite of requestId would
     * ripple into inflight, SSE, and idempotency for no gain.
     */
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    body = {
      prompt: boundGraph,
      client_id: "ima2",
      ...(UUID_RE.test(requestId ?? "") ? { prompt_id: requestId } : {}),
    };

실측 응답: `{"prompt_id": "...", "number": 0, "node_errors": {}}`.

**`node_errors`가 비어있지 않으면 실패로 취급한다.** 200을 받아도 그렇다 —
ComfyUI는 부분 검증 실패를 200 본문에 담는다.

### 폴링

    /**
     * /history/{id} returns {} until the job finishes — "absent" cannot
     * distinguish running from never-queued. So absence is cross-checked
     * against /queue: if the id is in neither history nor queue, the job
     * vanished (server restart, queue clear) and we fail fast instead of
     * polling for 30 minutes.
     */

루프(간격 `config.comfy.pollIntervalMs`, 상한 `generationTimeoutMs`):

1. `GET /history/{id}` — 키 있으면 종료 판정으로.
2. 없으면 `GET /queue` 조회. running/pending에 있으면 `onQueue` 보고 후 계속.
3. 둘 다 없으면 연속 3회까지 관용(제출 직후 레이스), 초과 시
   `COMFY_EXECUTION_FAILED` "job disappeared from queue and history".

종료 판정 — **`completed === true` 필수**:

    /**
     * An interrupted job also lands in history, with status_str "error" and
     * completed false (verified live). Treating mere presence as success would
     * report a canceled generation as done.
     */
    if (entry.status?.completed !== true) throw COMFY_EXECUTION_FAILED with status.messages tail

### 이미지 수집

실측 구조: `outputs -> node_id -> images -> [{filename, subfolder, type}]`.

바인딩된 output 노드를 1순위로 읽고, 없으면 `images`를 가진 아무 노드나
훑는다(사용자가 SaveImage를 바꿔 끼웠을 수 있다). 하나도 없으면
`COMFY_NO_IMAGE`.

`type: "temp"`(PreviewImage)도 받는다 — `/view`의 type 파라미터로 그대로
넘기면 읽힌다.

### 다운로드

    GET /view?filename=<f>&subfolder=<s>&type=<t>

**파라미터를 경계한다(감사 #11).** 이 값들은 ComfyUI 응답에서 온 것이지
우리가 만든 게 아니다. 커스텀 SaveImage 노드가 무엇을 넣을지 알 수 없다.

    /**
     * The filename/subfolder/type triple comes from a /history response, not
     * from us — a custom SaveImage node decides what goes there. Bound all
     * three before they reach a URL: type against the folder-class allowlist,
     * subfolder against traversal, filename to a basename. Then encode.
     */
    const VIEW_TYPES = new Set(["output", "input", "temp"]);

    function viewUrl(origin: string, img: { filename: string; subfolder?: string; type?: string }) {
      const type = VIEW_TYPES.has(img.type ?? "") ? img.type! : "output";
      const sub = String(img.subfolder ?? "");
      if (sub.includes("..") || sub.startsWith("/") || /^[a-z]:/i.test(sub)) {
        throw comfyError(COMFY_ERR.IMAGE_INVALID, "unsafe subfolder in ComfyUI output");
      }
      const file = basename(String(img.filename ?? ""));
      if (!file) throw comfyError(COMFY_ERR.IMAGE_INVALID, "empty filename");
      const q = new URLSearchParams({ filename: file, subfolder: sub, type });
      return `${origin}/view?${q}`;
    }

같은 이유로 `GET /history/${promptId}`도 `encodeURIComponent`를 거친다 —
클라이언트 지정 UUID 경로는 안전하지만 서버 생성 id를 그대로 보간하지
않는다.

`URLSearchParams`를 쓰므로 인코딩은 자동이다. 수동 문자열 연결을 하지 않는다.

`config.comfy.maxDownloadBytes` 상한. `lib/comfyBridge.ts`의
`sniffImage()`를 재사용해 매직바이트로 MIME을 판정한다 —
**Content-Type을 믿지 않는다**(generatePipeline이 alpha 요청 시 바이트를
신뢰하는 것과 같은 이유).

### 취소

    /**
     * Split by state, and never trust the HTTP code.
     *
     * POST /queue {delete:[id]} returns 200 for a RUNNING job and does
     * nothing (verified live 2026-08-23) — it only touches the pending heap.
     * /interrupt is what stops a running job.
     *
     * Both are idempotent and side-effect-free on a miss, so we fire delete
     * then interrupt rather than reading /queue first: a read-then-act
     * sequence has a race where the job starts between the two calls.
     */
    async function cancelComfyJob(origin, promptId) {
      await post(origin, "/queue", { delete: [promptId] }).catch(() => {});
      await post(origin, "/interrupt", { prompt_id: promptId }).catch(() => {});
    }

`options.signal`의 abort 이벤트에 연결한다. 폴링 루프도 매 회차
`signal.aborted`를 확인하고 `GENERATION_CANCELED`(499)를 던진다 —
atlascloud의 `sleep(ms, signal)` 패턴과 동일한 코드로.

### 헬스

    /**
     * One probe per DISTINCT origin, in parallel, with a short timeout. A
     * settings surface listing five workflows across two instances must not
     * take 5 x timeout, and one dead instance must not stall the live one.
     */
    export async function probeComfyOrigins(origins: string[]): Promise<Map<string, ComfyHealth>>
    type ComfyHealth = { ok: boolean; version?: string; queueRemaining?: number; reason?: string };

**근거 등급(감사 #13)**: 단일 인스턴스 프로브는 001에서 실측했다.
**여러 origin에 대한 동작은 2차 근거다** — 8189가 ComfyUI가 아니라
`comfyui_hooking_server`라서 N대 시나리오를 실기로 못 돌렸다. 같은 이유로
"prompt_id는 인스턴스 로컬"이라는 전제도 2차 근거다. origin 페어링은
보수적으로 옳은 설계지만 **실증됐다고 적지 않는다.**

`GET /system_stats`. 실측 응답에 `system.comfyui_version`("0.27.0")과
`devices[]`가 있다. 큐 부작용이 없어 헬스 프로브로 안전하다.
`Promise.allSettled` + `AbortSignal.timeout(config.comfy.healthTimeoutMs)`.

### i2i 업로드

`lib/comfyBridge.ts`의 `postToComfy()`는 현재 파일명 반환까지 하지만
`exportImageToComfy` 안에 갇혀 있다. 버퍼를 받는 함수로 추출한다:

    export async function uploadBufferToComfy(
      origin: string, buffer: Buffer, baseName: string, timeoutMs: number,
    ): Promise<string>   // returns the uploaded filename

`exportImageToComfy`는 이 함수를 호출하도록 리팩터링한다 — **동작 변경
없음**. 기존 `tests/comfy-bridge-contract.test.ts`가 회귀 감시자다.

참조 이미지가 있으면 업로드 후 파일명을 `bind.refImage` 노드에 주입한다.

## 2. lib/providers/adapters/comfy.ts (NEW)

minimax.ts를 템플릿으로 하되 두 곳이 다르다.

    export function createComfyAdapter(ctx: RuntimeContext): ProviderAdapterV1 {
      return {
        laneId: LANE_ID,
        validateAuth(): AuthResult {
          /**
           * There is no credential. "Authenticated" for this lane means at
           * least one workflow is registered — an empty store makes every
           * generation a guaranteed 400, which is what the UI needs to say.
           *
           * Reads ctx.comfyWorkflows, never the store directly: this method is
           * synchronous by interface contract while the store is async, and
           * the contract suite injects state exclusively through
           * RuntimeContext (tests/provider-adapter-v1-contract.test.ts:17-25).
           * A module-level cache could not be empty and non-empty for the two
           * calls that test makes. See 010 §6.6.
           */
          const workflows = ctx.comfyWorkflows ?? [];
          return workflows.length > 0
            ? { ok: true }
            : { ok: false, reason: "No ComfyUI workflow registered" };
        },
        listModels(): readonly CoreProviderModel[] {
          /**
           * NOT getProvider(LANE_ID).models — that is [] by construction for a
           * runtime-catalog lane. Workflows are the models, so this projects
           * ctx.comfyWorkflows into CoreProviderModel shape — same source as
           * validateAuth, for the same synchronous-interface reason.
           */
          return (ctx.comfyWorkflows ?? []).map((w) => ({
            id: w.id,
            kind: "image" as const,
            supports: { edit: Boolean(w.bind.refImage), mask: false, streaming: false },
          }));
        },
        normalizeError(error) { /* COMFY_ prefix, same retryable-status set */ },
      };
    }

**주의**: `tests/provider-adapter-v1-contract.test.ts:57` "listModels comes
from the registry"가 어댑터 목록과 레지스트리 목록의 일치를 본다. comfy는
런타임 레인이라 이 어서션에서 **면제**되어야 한다 — 테스트에
`catalogAccess !== "runtime"` 가드를 추가한다. 가드 없이 통과시키면
빈 배열끼리 우연히 같아 **테스트가 아무것도 지키지 않는 상태**가 된다.

## 3. 계약 테스트

`tests/comfy-provider-contract.test.ts` — minimax 테스트의 stub fetch
패턴을 따른다(originalFetch 저장 → globalThis.fetch 교체 → afterEach 복원,
URL suffix로 분기).

실기에서 얻은 실제 페이로드를 픽스처로 쓴다:

| 케이스 | 검증 |
|---|---|
| 제출 성공 | 요청 본문의 bound graph, prompt_id 전달 조건, number/node_errors 파싱 |
| node_errors 비어있지 않음 | 200이어도 SUBMIT_REJECTED |
| history completed:true | b64/mime/effectiveModel/promptId/origin 반환 |
| history completed:false | EXECUTION_FAILED, messages 꼬리 포함 |
| history 부재 + queue 존재 | 계속 폴링, onQueue 호출 |
| history 부재 + queue 부재 3회 | EXECUTION_FAILED "disappeared" |
| abort signal | GENERATION_CANCELED 499, delete와 interrupt 둘 다 호출 |
| /view가 HTML 반환 | IMAGE_INVALID (매직바이트 불일치) |
| 다운로드 초과 | DOWNLOAD_FAILED |
| 헬스 2개 origin, 1개 죽음 | 살아있는 쪽 ok, 죽은 쪽 reason, 총 소요 < 2x timeout |

마지막 항목이 병렬성의 **활성화 시나리오**다: 순차 구현이면 이 테스트가
시간 상한에서 실패한다.

## Accept criteria

1. 위 10개 케이스 통과, 각각 명명된 테스트 출력으로 증거.
2. `npm run typecheck` + `typecheck:tests` exit 0.
3. `tests/comfy-bridge-contract.test.ts` 여전히 통과 — 업로드 추출이
   기존 동작을 바꾸지 않았다는 회귀 증거.
4. **라이브 재현(선택, 가능할 때)**: lidge ComfyUI가 떠 있으면
   generateViaComfy를 실제 origin에 대고 1회 돌려 이미지를 받는다.
   불가하면 stub 증거만 있음을 D에 명시한다.

## Out of scope

파이프라인/라우트 배선(030). WS 진행률 스트림 — 폴링으로 충분하고
WS는 origin당 연결을 하나 더 만든다. 후속 유닛으로 미룬다.
