---
created: 2026-08-25
tags: [ima2-gen, devlog, phase1, comfyui, video, diff-level]
---

# 010 — wp1: Comfy video 실행 경로

## 목표

`provider: "comfy"` + video workflow id 조합이 서버에서 수락되고, ComfyUI가 낸
mp4/webm을 검증해 저장하고, UI에서 H3 row가 선택된다. lock은 실행이 실제로
존재하는 곳에서만 걷는다.

## Scope boundary

IN: `lib/comfyWorkflowStore.ts`, `lib/comfyGraphBind.ts`, `lib/comfyImageAdapter.ts`
(또는 신설 `lib/comfyVideoAdapter.ts`), `lib/providerOptions.ts`, `routes/video.ts`,
`routes/models.ts`, `ui/src/components/GenProviderModelSelect.tsx`,
`ui/src/components/settings/ComfyWorkflowManager.tsx`, `ui/src/store/storeVideoImpl.ts`,
`ui/src/lib/api-comfy.ts`, `bin/commands/comfy.ts`, `bin/commands/video.ts`, `tests/`.

> A 감사 반영 (001_wp0_audit_synthesis.md, blockers=6). scope에 providerOptions,
> ComfyWorkflowManager, bin/commands/{comfy,video}가 추가됐다.

OUT: Grok/Runway/Higgsfield video 경로 수정, 새 provider, Comfy 이미지 경로의
동작 변경, R2V/ref2va, 원격 GPU 튜닝.

## File change map

### 1. `lib/comfyWorkflowStore.ts` — MODIFY

video 축 바인딩을 스키마에 추가한다. `ComfyWorkflowBindings`에 optional 필드:

```ts
export interface ComfyWorkflowBindings {
  prompt: ComfyBinding;
  negativePrompt?: ComfyBinding;
  width?: ComfyBinding;
  height?: ComfyBinding;
  seed?: ComfyBinding;
  refImage?: ComfyBinding;
+ /** Frame count for video graphs. H3 uses the 17n+5 grid at 24fps. */
+ length?: ComfyBinding;
+ /** Frames per second, when the graph exposes it as a scalar. */
+ fps?: ComfyBinding;
  output: { node: string };
}
```

`normalizeWorkflowRecord` (lib/comfyWorkflowStore.ts:124, 현행 역직렬화 shape check)에
두 필드를 optional `ComfyBinding`으로 통과시키는 분기를 추가한다. 기존 레코드는 필드
부재로 그대로 유효하다 — 마이그레이션 불필요. (A 감사 B7: `validateBindings`라는
심볼은 존재하지 않는다.)

**필드 체인 (PLAN-FIELD-CHAIN-01):**

| 단계 | 위치 | 조치 |
|---|---|---|
| 생성 | `inferBindCandidates` (아래 2번); `routes/comfy.ts:151` register/update 본문 | 규칙 추가 |
| 생성 (CLI) | `bin/commands/comfy.ts:190-197` 플래그 맵, `:228-231` `flagFor` | `--length`, `--fps` 플래그 추가 |
| 생성 (UI) | `ui/src/components/settings/ComfyWorkflowManager.tsx:36` `BIND_FIELDS`, `:128-133` 제출 루프 | 배열에 두 필드 추가 — 누락 시 등록에서 **조용히 버려진다** |
| 타입 복제 | `ui/src/lib/api-comfy.ts:17-25` 별도 `ComfyWorkflowBindings`, `:50` `ComfyBindField` | lib 타입을 import하지 않으므로 **함께** 수정 |
| 직렬화 | `saveWorkflow` → `workflows.json` (기존 JSON.stringify 경로) | 조치 없음 |
| 역직렬화 | `normalizeWorkflowRecord` (`:124`) | optional 통과 분기 |
| 소비자 | `bindGraph` (아래 2번), `generateVideoViaComfy` (아래 3번) | 값 주입 |

A 감사 B2: 위 표의 CLI/UI/타입복제 3행은 최초 계획에서 누락돼 있었다. 특히
`BIND_FIELDS`는 하드코딩 배열이라 새 바인딩이 등록 단계에서 소리 없이 사라진다.

**Binding vs param 우선순위 (A 감사 B8):** `MiniMaxH3ImageToVideo.length`는 현재
미바인딩 스칼라라 `deriveParams`가 param으로 노출한다. `length` 바인딩 추가 후
같은 입력을 param과 binding이 동시에 쓰게 되므로, `bindGraph`에서 **바인딩 대상
입력은 params 적용에서 제외**한다 (바인딩이 이긴다). 저장된 레코드의 params 재유도는
불필요하다 — 적용 시점에 배제하므로.

### 2. `lib/comfyGraphBind.ts` — MODIFY

`FIELD_RULES`에 video 규칙을 추가한다:

```ts
const FIELD_RULES = [
  ...기존...
+ { field: "length", classType: "MiniMaxH3ImageToVideo", input: "length" },
+ { field: "fps",    classType: "CreateVideo", input: "fps" },
];
```

A 감사 B4 반영: 등록된 그래프를 실측한 결과는 다음과 같다.

    92  SaveVideo               [video, filename_prefix, format, codec]
    130 CreateVideo             [images, audio, fps, bit_depth]
    131 MiniMaxH3ImageToVideo   [clip, vae, prompt, width, height, length]

따라서 `SaveVideo.fps` 규칙은 **발화 불가**였다 (`inferBindCandidates`는
`rule.input in node.inputs`를 요구한다). `EmptyMiniMaxH3LatentVideo`도 그래프에
없으므로 삭제했다. 위 규칙은 실측에 맞춰 교정된 것이다.

추가 class_type/input은 B에서 등록된 workflow graph를 직접 읽어 확정한다
(추정 금지). `~/.ima2/comfy/workflows.json`의 `minimax-h3-fl2va-pruned-nvfp4`가
ground truth다.

`BindValues`에 `length?: number`, `fps?: number`를 추가하고 `bindGraph`의
`assign` 호출에 두 줄을 더한다.

`inferComfyMediaKind`는 이미 `SaveVideo`를 인식하므로 변경 없음.

### 3. `lib/comfyImageAdapter.ts` — MODIFY (video 수집/검증 분기)

**핵심 발견:** ComfyUI core는 video를 `outputs[node].images`에 넣는다
(`PreviewVideo.as_dict()` → `{"images": [...], "animated": (True,)}`). 그래서
`collectImages`는 이미 video 서술자를 반환하고 있다. 실패는 `downloadImage`의
`detectImageMimeFromB64` 실패에서 발생한다.

변경:

```ts
 interface HistoryEntry {
   status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
-  outputs?: Record<string, { images?: Array<Record<string, unknown>> }>;
+  outputs?: Record<string, {
+    images?: Array<Record<string, unknown>>;
+    gifs?: Array<Record<string, unknown>>;
+    videos?: Array<Record<string, unknown>>;
+    animated?: unknown;
+  }>;
 }
```

`collectImages`를 `collectOutputs(entry, outputNode, kind)`로 일반화한다.
`kind === "video"`면 `images`, `gifs`, `videos` 세 키를 순서대로 훑는다
(`gifs`는 VHS, `videos`는 버전별 호환 키 — core 계약이 아니라는 점을 주석에 남긴다).
`kind === "image"`면 현행 `images`만 본다 — 이미지 경로 동작을 바꾸지 않는다.

`downloadImage`를 `downloadArtifact(url, maxBytes, kind, ...)`로 일반화:
`kind === "video"`일 때 `detectImageMimeFromB64` 대신 새 `detectVideoMimeFromB64`를
쓴다. video magic bytes:

| 컨테이너 | 시그니처 |
|---|---|
| MP4/MOV | offset 4에 `ftyp` (`66 74 79 70`) |
| WebM/MKV | `1A 45 DF A3` (EBML) |

실패 시 새 에러 코드 `COMFY_ERR.VIDEO_INVALID`로 "ComfyUI returned something that
is not a video."를 던진다. `NO_IMAGE` 메시지도 kind별로 갈라 "produced no video"를
낸다.

**History persistence race (Tier 2 lead):** 완료 직후 `outputs`가 빌 수 있다.
현행 폴링 루프에 이미 `missing` 카운터가 있으므로, video일 때 이 허용치를
상향(예: 3 → 6 tick)하고 그 이유를 주석으로 남긴다. 새 sleep 도입 대신 기존
폴링 예산을 재사용한다.

**신규 export:** `generateVideoViaComfy(prompt, ctx, options)` — `generateViaComfy`와
제출/폴링을 공유하고 수집/검증 kind만 다르다. 파일이 500줄 관례를 넘으면
공통 부분을 `lib/comfyRunCore.ts`로 분리한다 (현재 449줄이므로 분리 가능성 높음).

### 4. `routes/video.ts` — MODIFY

`:188`의 provider 게이트를 넓힌다:

```ts
-if (provider !== "grok" && provider !== "grok-api") return fail(400, ...);
+if (provider === "comfy") {
+  return handleComfyVideo(req, res, ctx, { prompt, model: rawModel, ... });
+}
+if (provider !== "grok" && provider !== "grok-api") return fail(400, ...);
```

`handleComfyVideo`는 Grok 전용 축(storyboard, continuity, planner, topic)을 타지
않는다. Comfy가 지원하지 않는 축이 들어오면 조용히 무시하지 말고 400으로 거절한다
— 목표 문서의 "정직한 lock" 원칙이 여기에도 적용된다.

비동기 계약은 기존 video route와 동일: 202 + SSE dual-emit. 기존 `inflight`,
`ssePublish`, `videoArtifactPersistence` 경로를 그대로 재사용한다.

### 5. `routes/models.ts` — MODIFY

`:316-321`에서 video workflow에 무조건 붙던 lock을 조건부로 바꾼다:

```ts
-video: videoWorkflows.map((workflow) => ({
-  ...projectWorkflow(workflow),
-  executable: false,
-  lockReason: COMFY_VIDEO_LOCK_REASON,
-})),
+video: videoWorkflows.map((workflow) => projectWorkflow(workflow)),
```

offline 판정은 이미 `description`의 `(offline)` 접미로 전달되고 UI가 그걸로
disable한다. 실행 경로가 생긴 뒤에도 남는 정직한 lock이 있다면 (예: 필수 바인딩
미설정 workflow) 그 조건에서만 lockReason을 붙인다. `COMFY_VIDEO_LOCK_REASON`
상수는 삭제하거나 조건부 사유로 재정의한다.

**PLAN-BYPASS-NAMED-01:** 이 lock은 enforcement가 아니라 UI 표시용 신호다.
tier E2, 실행 표면 = `/api/models` 프로젝션, 알려진 우회 = CLI/HTTP 직접 호출,
잔여 위험 = 바인딩이 불완전한 workflow가 제출돼 ComfyUI 400을 받는 것,
문구 격하 = 없음. **최종 집행 계층은 `generateVideoViaComfy`의 바인딩 검증**이며
UI lock은 early warning이다.

### 5b. `lib/providerOptions.ts` — MODIFY (A 감사 B3, 세 번째 lock 계층)

`:75-87`이 provider comfy + `mediaKind === "video"` 조합에서
`COMFY_VIDEO_EXECUTION_LOCKED` / "ComfyUI video execution is not supported yet"를
**실제로 거절**한다. 이건 표시용 신호가 아니라 집행 계층이다. 이 계층을 그대로 두면
routes/models.ts와 routes/video.ts의 lock을 걷어도 comfy video는 계속 400을 받는다.

단 이 가드는 **이미지 경로**의 가드다: video workflow를 이미지 파이프라인에 밀어넣는
요청을 막는 역할은 wp1 이후에도 유효하다. 그러므로 삭제가 아니라 **사유 교정**이다.

    - error: "ComfyUI video execution is not supported yet"
    - code:  "COMFY_VIDEO_EXECUTION_LOCKED"
    + error: "This ComfyUI workflow produces video. Use the video endpoint."
    + code:  "COMFY_VIDEO_WRONG_ENDPOINT"

동반 갱신 대상: `tests/comfy-routes-contract.test.ts:176` (사유 고정),
`tests/comfy-cli-contract.test.ts:51` ("catalog-only: ComfyUI video execution is not
supported yet" 산문 고정), `bin/commands/comfy.ts`의 해당 출력 문구,
`structure/03-server-api.md:266`.

### 5c. `bin/commands/video.ts` — MODIFY (A 감사 B5)

`:130`이 `--provider <grok|grok-api|runway|higgsfield>`로 열거하고 `:201`이
`body: { provider: "grok", ... }`로 하드코딩한다. lock 제거 후 `modelResolver`는
comfy 타깃을 통과시키지만 커맨드는 여전히 grok으로 제출한다 — 사용자가 CLI에서
comfy video를 고르면 조용히 엉뚱한 lane으로 간다.

열거에 comfy를 추가하고, 하드코딩 대신 해석된 lane을 전달한다.

### 6. `ui/src/components/GenProviderModelSelect.tsx` — MODIFY

`:195` — 사용자가 실제로 부딪힌 지점:

```ts
 const onModelChange = (value: string) => {
-  if (value.startsWith(COMFY_VIDEO_PREFIX)) return;
+  if (value.startsWith(COMFY_VIDEO_PREFIX)) {
+    selectVideoModel(value.slice(COMFY_VIDEO_PREFIX.length));
+    return;
+  }
```

`comfyVideoWorkflows` 매핑의 `reason: ... ?? t("comfy.videoCatalogOnly")` 기본값을
제거한다 — 서버가 사유를 주지 않으면 사유는 없다. offline일 때만 disabled를 유지한다.

### 7. `ui/src/store/storeVideoImpl.ts` — MODIFY

`:129`의 강제 캐스팅을 실제 provider로 바꾼다:

```ts
-provider: (get().provider === "grok-api" ? "grok-api" : "grok") as "grok" | "grok-api",
+provider: resolveVideoProvider(get().provider),
```

`resolveVideoProvider`는 `comfy`를 그대로 통과시키고, video를 못 하는 lane은
기존대로 grok으로 접는다. comfy일 때 storyboard/continuity 필드는 payload에서 뺀다.

**A 감사 B6:** 동일한 강제 캐스팅이 `:297`의 image-to-video 경로에도 있다. 같은
헬퍼로 함께 교체한다 — 한 곳만 고치면 "첫 프레임에서 애니메이트" 흐름이 계속
grok으로 샌다.

### 8. `tests/` — NEW/MODIFY

- `tests/comfy-video-adapter.test.ts` (NEW): `images`+`animated`, `gifs`,
  `videos` 세 history 모양에서 각각 서술자를 수집하는지; mp4/webm 매직바이트를
  통과시키고 PNG를 `VIDEO_INVALID`로 거절하는지; outputs 지연을 폴링이 견디는지.
- `tests/video-route-contract.test.ts` (MODIFY 또는 NEW): `provider: "comfy"`가
  더 이상 400이 아니고, 미등록 workflow id는 404, storyboard 동반 요청은 400.

**반드시 깨지는 기존 테스트 (전수, A 감사 B1/B3 반영):**

| 파일 | 단언 | 이유 |
|---|---|---|
| `tests/models-endpoint-contract.test.ts:186-187` | `executable === false`, `/video execution is not supported/` | lock 제거 |
| `tests/comfy-ui-contract.test.ts:49-57` | 소스 정규식 `disabled: true`, `entry.lockReason`, `videoCatalogShort`, `title: entry.reason`, `stacked: true` | §6이 그 소스 hunk를 재작성 |
| `tests/comfy-routes-contract.test.ts:176` | `COMFY_VIDEO_EXECUTION_LOCKED` 사유 | §5b 사유 교정 |
| `tests/comfy-cli-contract.test.ts:51` | "catalog-only: ComfyUI video execution is not supported yet" 산문 | §5b 문구 교정 |

이 네 파일을 새 계약으로 교체하지 않으면 C는 실패한다. comfy-ui-contract는 소스
문자열 단언이라 §6 편집 즉시 깨진다 — 최초 계획이 놓쳤던 High 블로커다.

## Activation scenario (C-ACTIVATION-GROUNDING-01)

| 조건부 경로 | 트리거 방법 | 관측 증거 |
|---|---|---|
| video 수집 분기 (`kind === "video"`) | `gifs` 전용 history fixture로 어댑터 호출 | 반환된 서술자 개수 assert |
| video 매직바이트 검증 | PNG 바이트를 video kind로 흘림 | `VIDEO_INVALID` throw assert |
| route의 comfy 분기 | `provider: "comfy"` POST | 202 응답 + `logEvent("comfy", ...)` 라인 |
| lock 제거 | 라이브 `/api/models` 호출 | H3 항목에 lockReason 부재 |
| UI 선택 수용 | 브라우저에서 H3 클릭 | 선택 상태가 남은 스크린샷 |
| history race 허용치 | 첫 tick에 빈 outputs를 주는 fixture | 재시도 후 성공 assert |

## Verifier 사전 실행 (PLAN-VERIFIER-REAL-01)

B 진입 전에 각 명령을 실제로 돌려 exit code와 대상 관측 여부를 이 문서에 append한다.
`npm test`는 `tests/`를 직접 읽으므로 신규 테스트를 관측한다. `npm run typecheck`는
server+lib tsconfig 범위이므로 `ui/src` 변경을 관측하지 **않는다** — UI 변경은
`cd ui && npm run build`가 관측한다. 이 구분을 accept 표에 명시한다.

## Accept criteria

1. `provider: "comfy"` video 요청이 202로 수락된다 (c-2).
2. mp4/webm 매직바이트 검증이 통과하고 PNG는 거절된다 (c-2).
3. 라이브 `/api/models`의 H3 항목에 lockReason이 없다 (c-3).
4. 브라우저에서 H3를 클릭하면 선택이 유지된다 (c-3).
5. 전체 게이트 green, 기존 lock 단언 테스트가 새 계약으로 교체됨.

## SoT sync target (SOT-SYNC-01)

C에서 `structure/03-server-api.md` (video route provider 계약),
`structure/04-frontend-architecture.md` (selector 동작),
`structure/01-file-function-map.md` (신규 모듈)을 갱신한다.
