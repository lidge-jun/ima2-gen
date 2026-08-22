---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase3]
---

# 030 — wp3 배선: 파이프라인 · 라우트 · inflight meta

의존: 020(어댑터). 여기서 comfy가 처음으로 `POST /api/generate`로 닿는다.

## 변경 지도

| 파일 | 동작 |
|---|---|
| `lib/providerOptions.ts` | MODIFY — comfy 분기 |
| `lib/imageModels.ts` | MODIFY — normalizeComfyWorkflowModel |
| `lib/generatePipeline.ts` | MODIFY — generateViaComfy 디스패치 + meta |
| `routes/models.ts` | MODIFY — comfyLane |
| `routes/comfy.ts` | MODIFY — 워크플로 CRUD |
| `routes/edit.ts` | MODIFY — 마스크 제외 목록 + i2i |
| `lib/runtimeContext.ts` | MODIFY — 워크플로 스토어 핸들 |
| `tests/comfy-routes-contract.test.ts` | NEW |
| `tests/models-endpoint-contract.test.ts` | MODIFY |

## 1. lib/providerOptions.ts

minimax 분기 뒤에 삽입:

      if (provider === "comfy") {
        // The "model" is a workflow id. Unlike every other lane there is no
        // compile-time valid set, so validation is existence in the store —
        // done in the pipeline where async IO is allowed. This function is
        // synchronous, so it only normalizes shape.
        const check = normalizeComfyWorkflowModel(rawModel);
        if (check.error) return { error: check.error, code: check.code, status: check.status };
        return {
          provider: "comfy" as const,
          model: check.model,
          reasoningEffort: "none",
          size: rawSize || "1024x1024",
          webSearchEnabled: false,
        };
      }

`resolveProviderOptions`가 동기 함수라는 점이 제약이다. 스토어 조회는
비동기라 여기서 못 한다. 따라서 **형식 검증(여기) + 존재 검증(파이프라인)**
2단으로 나눈다.

## 2. lib/imageModels.ts

    /**
     * The comfy lane has no compile-time model set: a "model" is a workflow
     * the user registered. Every other normalizeX checks membership in a Set
     * derived from the const registry; that Set is empty here BY DESIGN, so
     * membership would reject everything.
     *
     * This validates SHAPE ONLY — the same id alphabet the store enforces —
     * and existence is checked in the pipeline against the store. Splitting it
     * keeps this module synchronous and dependency-free.
     */
    const COMFY_WORKFLOW_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

    export function normalizeComfyWorkflowModel(rawModel: unknown) {
      if (typeof rawModel !== "string" || rawModel.length === 0) {
        return {
          error: "provider 'comfy' requires an explicit workflow id as model",
          code: "COMFY_WORKFLOW_REQUIRED",
          status: 400,
        };
      }
      if (!COMFY_WORKFLOW_ID_RE.test(rawModel)) {
        return { error: "...", code: "INVALID_COMFY_WORKFLOW_ID", status: 400 };
      }
      return { model: rawModel };
    }

**기본값을 만들지 않는다.** 다른 레인은 빈 입력에 fallback 모델을 주지만
comfy에는 "첫 번째 워크플로"라는 합리적 기본이 없다 — 사용자가 등록한
순서는 의미를 담지 않는다. 명시를 요구하는 편이 정직하다.

## 3. lib/generatePipeline.ts

### (a) JPEG 강제 목록에서 제외

BEFORE (383행):

      const providerForcesJpeg = activeProvider === "grok" || ... || activeProvider === "minimax";

comfy는 **추가하지 않는다**. ComfyUI SaveImage는 PNG를 쓰고, 알파를 가진
워크플로(배경 제거 노드 등)가 흔하다. JPEG 강제는 그 알파를 파괴한다.

같은 이유로 `providerReportsMime` 목록에는 **추가한다**(556행) — 어댑터가
매직바이트로 판정한 mime을 신뢰해야 PNG가 PNG로 저장된다.

### (b) 투명 배경 지원 여부

`validateTransparentProvider`(lib/imageBackgroundParam.ts)는 알파를 못 내는
레인을 사전 거부한다. comfy는 **거부 목록에 넣지 않는다.**

근거 둘. 첫째, 알파 산출 여부가 레인이 아니라 워크플로의 성질이다. 배경
제거 노드를 가진 워크플로는 알파를 내고 없는 워크플로는 못 낸다 — 레인
단위 사전 거부는 정상 워크플로를 막는 거짓 양성이 된다. 둘째, 파이프라인에
이미 사후 검증기가 있다: `verifyBufferAlpha`(generatePipeline.ts:514-523)가
"투명을 요청했는데 불투명이 왔다"를 **파일을 쓰기 전에** 잡아
`makeTransparentResultError`를 던진다. 사전 거부 없이도 잘못된 결과가
디스크에 남는 일은 없다.

### (c) 디스패치

minimax 분기 뒤:

        if (activeProvider === "comfy") {
          const r = await generateViaComfy(generationPrompt, requireRuntimeContext(ctx), {
            model: imageModel,          // workflow id
            size: effectiveSize,
            signal: cancelController.signal,
            requestId,
            references: refCheck.refDetails,
            ...(req.body?.comfyParams ? { params: req.body.comfyParams } : {}),
            ...(typeof req.body?.seed === "number" ? { seed: req.body.seed } : {}),
            onQueue: (info) => {
              // Comfy queue depth is real user-visible waiting; without this
              // the UI shows "streaming" while the job sits behind three
              // other prompts.
              setJobPhase(requestId, info.running ? "streaming" : "queued");
              if (asyncMode) publish(requestId, "phase", {
                requestId, phase: info.running ? "streaming" : "queued",
                queuePosition: info.position,
              });
            },
          });
          throwIfJobCanceled(requestId);
          return r;
        }

### (d) inflight meta — origin과 쌍으로

어댑터가 돌려준 `promptId`/`origin`을 사이드카 meta에 넣는다:

      ...(activeProvider === "comfy" ? {
        // Paired deliberately: a prompt_id is only meaningful inside the
        // instance that issued it. Asking 8189 about an id from 8188 returns
        // "not found", which would read as a vanished job.
        comfyPromptId: r.value.promptId,
        comfyOrigin: r.value.origin,
        comfyWorkflow: r.value.effectiveModel,
      } : {}),

### (e) TTL 상호작용 — 실측 후 처분

`purgeStaleJobs`(lib/inflight.ts:438)는 TTL 초과 행을 DELETE만 하고 워커를
중단시키지 않는다. 로컬 GPU 큐가 90분을 넘길 수 있다.

**wp3의 조사 항목**: 90분 초과 시 실제로 무엇이 깨지는지 확인한다.
- 행이 사라지면 `isJobCanceled`는 여전히 false(터미널 기록이 없으므로)
- `setJobPhase`는 no-op이 된다(getJob이 null)
- 어댑터는 계속 폴링하다 성공하면 파일을 쓴다 — 고아 파일이 아니라
  정상 저장이지만 UI는 그 잡을 잊은 상태

처분 후보: (i) comfy 레인만 TTL을 늘린다, (ii) 폴링 루프가 주기적으로
`setJobPhase`를 호출해 `started_at` 대신 `phase_at`을 갱신 — **불가**,
purge는 `started_at` 기준이다. (iii) 그대로 두고 문서화.

결론은 실측 후 090에 기록한다. **지금 추측으로 코드를 바꾸지 않는다.**

## 4. routes/models.ts — comfyLane

    async function comfyLane(ctx: RuntimeContext): Promise<ModelLaneDto> {
      const workflows = await listWorkflows();
      if (workflows.length === 0) {
        return lane({ status: "disconnected", reason: "No ComfyUI workflow registered" },
                    {}, { image: [], video: [] });
      }
      const health = await probeComfyOrigins([...new Set(workflows.map(w => w.origin))]);
      const anyLive = [...health.values()].some(h => h.ok);
      const allLive = [...health.values()].every(h => h.ok);
      /**
       * The lane folds to one status the way grokLaneState does, while each
       * workflow carries its own liveness. Partial availability is normal
       * here: 8188 can be up while 8189 is down, and marking the whole lane
       * disconnected would hide four usable workflows because of one dead box.
       */
      const state = anyLive
        ? { status: "ready" as const, ...(allLive ? {} : { reason: "Some ComfyUI instances are offline" }) }
        : { status: "disconnected" as const, reason: "No ComfyUI instance responded" };
      return lane(state, { image: workflows[0]!.id }, {
        image: workflows.map(w => ({
          id: w.id,
          label: w.label,
          description: health.get(w.origin)?.ok ? w.origin : `${w.origin} (offline)`,
          capabilities: { source: "verified-contract", aspectRatios: [], parameters: w.params, inputRoles: ["text", "image_references"] },
        })),
        video: [],
      });
    }

**`buildCoreLanes`가 async가 된다** — 현재 comfyLane만 IO를 한다.
호출부(routes/models.ts:391)는 이미 async 컨텍스트다(mcp 레인이 await됨).

`defaults.image`는 첫 워크플로다. 임의적이지만 DTO가 요구하고, UI는
사용자의 마지막 선택을 우선한다.

## 5. routes/comfy.ts — 워크플로 CRUD

기존 `POST /api/comfy/export-image`는 유지. 추가:

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/api/comfy/workflows` | 목록 + origin별 헬스 |
| POST | `/api/comfy/workflows` | 등록 (graph JSON 또는 PNG base64) |
| POST | `/api/comfy/workflows/:id/bind` | 바인딩 확정 |
| DELETE | `/api/comfy/workflows/:id` | 삭제 |
| POST | `/api/comfy/inspect` | 그래프 파싱 + 바인딩 후보 (저장 없음) |
| POST | `/api/comfy/probe` | origin 도달성 확인 (저장 없음) |

`/probe`는 050의 등록 폼이 부르는 라우트다(감사 라운드2 #2: 초안은 UI에만
적고 서버 소유자를 지정하지 않았다).

    /**
     * The browser must never fetch a user-typed URL directly. This route runs
     * normalizeComfyOrigin FIRST — the same http + loopback + explicit-port
     * rule the store enforces — and only then probes /system_stats.
     *
     * Two failure shapes, deliberately distinct: a malformed origin is 400
     * (the user typed something impossible), an unreachable one is 200 with
     * ok:false (the address is fine, the server is not running). Collapsing
     * them would tell someone to start ComfyUI when their URL has no port.
     */
    POST /api/comfy/probe { origin: string }
      -> 400 { ok: false, error: { code: "COMFY_URL_NOT_LOCAL", message } }
      -> 200 { ok: true,  version, queueRemaining }
      -> 200 { ok: false, reason: "unreachable" }

`docs/API.md`에 **신규 6개 + 기존 `export-image` 1개**를 전부 등재한다 —
`api-docs-contract`가 `routes/*.ts`의 `app.get/post/delete(...)`를 grep해
문서와 대조하므로 하나라도 누락되면 실패한다.

`/inspect`가 UX의 핵심이다: 사용자가 파일을 올리면 저장 전에 후보를
보여주고 확정을 받는다. `unambiguous: false`인 필드는 UI가 반드시 물어야
한다.

기존 라우트의 `hasExactBodyShape` 엄격 검증 스타일을 유지한다.

## 6. routes/edit.ts

마스크 제외 목록(185행)에 comfy 추가:

      if ((activeProvider === "grok" || ... || activeProvider === "comfy") && rawMask) {

마스크는 인페인팅 워크플로의 `LoadImageMask` 노드를 요구하는데, 이는
바인딩 스키마의 확장이다. 후속 유닛으로 미룬다.

i2i는 generate와 같은 경로다 — `references`가 `bind.refImage`로 간다.
워크플로에 `refImage` 바인딩이 없으면 `COMFY_WORKFLOW_BIND_INVALID`로
"이 워크플로는 참조 이미지를 받지 않습니다"를 낸다.

## 7. 테스트

## 6.5 다른 생성 표면은 이번 범위가 아니다 (감사 #10)

`lib/multimodePipeline.ts`, `lib/nodeGeneration.ts`,
`lib/agentImageVideoGen.ts`도 provider별 if-체인을 갖는다. 이번 유닛은
**classic generate + edit만** 지원한다.

문제는 "지원하지 않음"이 조용한 오작동으로 나타난다는 점이다.

### 왜 가드가 필요한가 — 정확한 이유 (감사 라운드2 #3)

초안은 "providerOptions의 폴백이 comfy를 oauth로 무너뜨린다"고 적었다.
§1이 comfy 분기를 추가하면 **그 이유는 사라진다** —
`resolveProviderOptions`는 네 표면이 공유하므로 comfy 분기도 공유된다.

진짜 위험은 그 다음이다. `activeProvider === "comfy"`가 되어도 세 파이프
라인에 comfy 디스패치가 없으면 **마지막 else인 `generateViaResponses`로
떨어진다**:

    // lib/responsesImageAdapter.ts:324-326
    provider,
    scope: provider === "api" ? "api-generate" : "oauth",

즉 OAuth 프록시로 요청이 나간다. 사용자는 ComfyUI를 골랐는데 GPT가 만든
이미지를 받고, **다른 provider에 과금된다.** 에러는 없다.

### 세 표면의 에러 API가 각각 다르다

`fail(400, ...)`은 generatePipeline의 지역 헬퍼다. 복붙되지 않는다.

**multimode** (`lib/multimodePipeline.ts`, 패턴은 :168):

    if (provider === "comfy") {
      return respondMultimodeValidationError(res, requestId, asyncMode, 400, {
        error: "provider 'comfy' is not supported on this surface yet",
        code: "COMFY_SURFACE_UNSUPPORTED",
      });
    }

**node** (`lib/nodeGeneration.ts`) — 이 파일의 에러 봉투는 **중첩**이고
`parentNodeId`를 함께 낸다(:77-83). 형태를 맞춘다:

    if (provider === "comfy") {
      return res.status(400).json({
        error: { code: "COMFY_SURFACE_UNSUPPORTED", message: "provider 'comfy' is not supported on this surface yet" },
        parentNodeId,
      });
    }

**agent** (`lib/agentImageVideoGen.ts`는 res를 갖지 않고 **throw**한다,
패턴은 :88):

    if ((options.provider ?? "oauth") === "comfy") {
      const err = new Error("provider 'comfy' is not supported on this surface yet") as Error & { code?: string; status?: number };
      err.code = "COMFY_SURFACE_UNSUPPORTED";
      err.status = 400;
      throw err;
    }

### 위치

**`resolveProviderOptions` 호출 전**, 원시 `provider` 값으로 판정한다.
그래야 이 표면에서 워크플로 id를 요구하지 않고 거부할 수 있다
(comfy는 모델 기본값이 없어서 resolve가 먼저 `COMFY_WORKFLOW_REQUIRED`를
내면 사용자에게 엉뚱한 에러가 간다).

### UI 쪽 — 숨기지 않는다

초안은 "UI도 해당 표면에서 comfy를 숨긴다(050)"고 적었으나, 050은
`CORE_PROVIDER_OPTIONS`를 공유 목록에 추가할 뿐 표면별 필터를 두지 않는다.
**모순이므로 주장을 철회한다.**

이번 유닛에서는 서버 400이 유일한 방어선이다. 사용자가 노드 모드에서
comfy를 고르면 명확한 에러를 본다 — 이상적이진 않지만 조용한 대체보다
낫고, 070에서 실제 지원으로 해소된다.

후속 지원은 **070**으로 work-phase를 추가한다.

`tests/comfy-routes-contract.test.ts`: CRUD 왕복, /inspect가 저장하지 않음,
빈 스토어에서 lane이 disconnected, 워크플로 2개 중 1개 origin 죽었을 때
lane이 ready + reason, generate가 미등록 workflow id에 404.

`tests/models-endpoint-contract.test.ts`: lanes 키 배열에 comfy 추가.

## Accept criteria

1. `POST /api/generate {provider:"comfy", model:"<id>"}`가 stub 어댑터로
   전 경로를 통과하고 사이드카 meta에 comfyPromptId/comfyOrigin이 **쌍으로**
   기록된다. **활성화 시나리오**: meta 어서션이 두 필드를 함께 본다.
2. onQueue 콜백이 phase를 queued↔streaming으로 전환한다 —
   테스트가 phase 전환 순서를 어서션.
3. 미등록 workflow id → 404 COMFY_WORKFLOW_NOT_FOUND.
3.5. multimode/node/agent에서 comfy 선택 시 COMFY_SURFACE_UNSUPPORTED 400.
   **활성화 시나리오**: 세 라우트 각각에 provider:"comfy" 요청을 보내
   400과 코드를 어서션 — 조용한 oauth 대체가 아님을 증명한다.
4. TTL 상호작용 실측 결과가 090에 기록된다(코드 변경 여부 무관).
5. 전체 테스트 + typecheck exit 0.
