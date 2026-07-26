---
title: "070 — WP7: 공통 VideoGenerationRequest (#84)"
lane: "260726_zero-backlog-frontend-qa"
wp: 7
created: 2026-07-26
depends_on: [WP6]
issue: 84
criteria: [C7]
---

# WP7 — 공통 VideoGenerationRequest (#84)

## 이슈 범위 축소 근거

이슈는 "Node/Agent/CLI가 각자 다른 경로로 비디오 요청을 만든다. 공통
`submitVideoGeneration(request)`를 도입하자"고 한다. 실제 코드를 보면 두 가지가 다르다.

**첫째, 공통 타입은 이미 있다.** `ui/src/lib/api-generation.ts:245-267`의
`VideoGenerateRequest`가 prompt/provider/model/mode/source/reference/continuity/
duration/resolution/aspectRatio/topic/storyboard/세션 메타를 전부 담는다.

**둘째, CLI는 이미 이 경로를 쓴다.** `bin/commands/video.js:181-187`은
`{ provider: "grok", ...body }`로 서버 라우트를 호출한다. UI도 같은 라우트를 쓴다.

진짜 이탈자는 하나다 — **Agent가 라우트를 우회한다.**
`lib/agentImageVideoGen.ts:265-280`은 `generateVideoViaGrok`를 직접 부른다.

```ts
  const result = await generateVideoViaGrok(prompt, ctx, {
    model: videoModel,
    mode,
    sourceImage,
    duration: videoParams.duration ?? 5,
    resolution: videoParams.resolution ?? "480p",
    aspectRatio: (videoParams.aspectRatio ?? "auto") as ...,
    requestId,
    signal: options.signal ?? undefined,
    plannerModel: ...,
```

그래서 Agent에는 `referenceImages`, `continuityLineage`, `topic`, `storyboard`,
`elementIds`, `presetIds`가 없다. 기능 차이가 아니라 경로 차이다.

**따라서 이 WP는 "공통 타입 신설"이 아니라 "요청 형태 통일 + Agent 필드 격차 해소"다.**

## 통합하지 않을 것

`/api/video/extend`와 `/api/video/edit`는 제외한다. `routes/videoExtended.ts:202-244`가
`videoUrl`, `operation`, `sourceVideoId`를 쓰는데 generate 계약과 근본적으로 다르다.
억지로 하나의 타입에 합치면 모든 필드가 optional이 되고, 타입이 아무것도 보장하지
않게 된다. 이건 통합이 아니라 타입 포기다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/videoGenerationRequest.ts` | NEW | 서버/CLI 공유 타입 + 정규화 |
| `ui/src/lib/api-generation.ts` | MODIFY | `VideoGenerateRequest`를 공유 타입 alias로 |
| `lib/agentImageVideoGen.ts` | MODIFY | 요청 빌더 경유 |
| `routes/video.ts` | MODIFY | 정규화 함수 사용 |
| `bin/commands/video.ts` | MODIFY | 빌더 경유 |
| `tests/video-request-contract.test.ts` | NEW | 세 표면 동형성 |

## 070-1. 공유 타입 (NEW)

```ts
export type VideoGenerationMode = "text-to-video" | "image-to-video" | "reference-to-video";

export type VideoGenerationRequest = {
  prompt: string;
  provider?: "grok" | "grok-api";
  model?: string;
  mode?: VideoGenerationMode;
  sourceImage?: string;
  sourceFilename?: string;
  referenceImages?: string[];
  referenceFilenames?: string[];
  continueFromVideo?: string;
  continuityLineage?: VideoContinuityLineage | null;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  topic?: string;
  storyboard?: boolean;
  plannerModel?: string;
  presetIds?: string[];
  elementIds?: string[];
  providerUrl?: string;
  sessionId?: string | null;
  clientNodeId?: string | null;
  clientRequestId?: string;
  requestId?: string;
  backgroundPreset?: AssetGenBackgroundPreset;
};

export function normalizeVideoGenerationRequest(
  input: Partial<VideoGenerationRequest>,
): { request: VideoGenerationRequest } | { error: string; code: string };
```

정규화 함수가 담당할 규칙:

- `sourceImage`와 `sourceFilename`은 **상호 배타**다. 현재 타입은 둘 다 optional이라
  동시 지정이 통과하고, 서버는 하나만 쓴다. 조용한 무시 대신 명시적 오류를 낸다.
- `mode`가 없으면 소스 유무로 유도한다. 지금은 각 호출자가 따로 계산한다.
- `aspectRatio: "auto"`를 정식 값으로 인정한다. Agent만 허용하던 값이다.
- `duration`/`resolution` 기본값은 정규화 함수 한 곳에서만 정한다. 현재 Agent는
  `?? 5` / `?? "480p"`를 인라인으로 갖고 있다.

## 070-2. UI 타입 재배선

```ts
-export type VideoGenerateRequest = { /* 23 fields */ };
+export type { VideoGenerationRequest as VideoGenerateRequest } from "../../../lib/videoGenerationRequest";
```

**경로 문제 주의.** `ui/`는 별도 Vite 프로젝트이고 자체 tsconfig를 쓴다. 서버
`lib/`를 직접 import할 수 있는지 먼저 확인해야 한다. 불가능하면 두 가지 선택지가 있다.

1. 타입 정의를 `ui/src/types/videoGeneration.ts`에 두고 서버가 그것을 참조.
2. 타입만 담은 공유 파일을 만들고 양쪽 tsconfig의 `include`에 넣기.

B 단계 첫 작업은 이 확인이다. 빌드 경계를 깨면서까지 파일을 하나로 만들 필요는 없다 —
**계약 테스트로 두 정의의 동형성을 강제하는 것**이 더 안전할 수 있다. 실제 tsconfig를
보고 결정한다.

## 070-3. Agent 경로

```ts
-  const result = await generateVideoViaGrok(prompt, ctx, {
-    model: videoModel,
-    mode,
-    sourceImage,
-    duration: videoParams.duration ?? 5,
-    resolution: videoParams.resolution ?? "480p",
-    aspectRatio: (videoParams.aspectRatio ?? "auto") as ...,
-    requestId,
-    ...
-  });
+  const normalized = normalizeVideoGenerationRequest({
+    prompt, model: videoModel, mode, sourceImage,
+    duration: videoParams.duration,
+    resolution: videoParams.resolution,
+    aspectRatio: videoParams.aspectRatio,
+    plannerModel: isAgentGrokPlannerModel(options.model) ? options.model : undefined,
+    requestId,
+  });
+  if ("error" in normalized) throw new Error(normalized.error);
+  const result = await generateVideoViaGrok(prompt, ctx, {
+    ...toGrokVideoOptions(normalized.request),
+    signal: options.signal ?? undefined,
+    onEvent: (event) => { /* 기존 그대로 */ },
+  });
```

**Agent를 HTTP 라우트로 옮기지 않는다.** Agent는 같은 프로세스 안에서 돌고,
자기 자신에게 HTTP 요청을 보내는 건 불필요한 왕복이다. 취소 시그널과 진행 콜백도
직접 호출이 더 정확하다. 통일하는 것은 **요청 형태와 기본값**이지 전송 방식이 아니다.

`signal`과 `onEvent`는 요청 데이터가 아니라 실행 옵션이므로 타입에 넣지 않는다.
직렬화되지 않는 것을 요청 타입에 섞으면 그 타입은 네트워크로 못 보낸다.

## 070-4. 서버·CLI

`routes/video.ts:220-270`의 인라인 구조 분해를 `normalizeVideoGenerationRequest`
호출로 교체한다. 기존 검증 로직(파일 경로 안전성 등)은 그대로 둔다 — 정규화는
형태를 맞추는 것이지 보안 검증을 대체하지 않는다.

CLI는 `provider: "grok"` 하드코딩을 유지한다. CLI가 Grok 전용인 것은 의도된 제약이고,
이 WP에서 바꿀 일이 아니다.

## 계약 테스트

```ts
test("source image and filename are mutually exclusive", () => {
  const result = normalizeVideoGenerationRequest({
    prompt: "x", sourceImage: "data:...", sourceFilename: "a.png",
  });
  assert.ok("error" in result);
  assert.equal(result.code, "VIDEO_SOURCE_CONFLICT");
});

test("mode is derived from source presence", () => {
  assert.equal(norm({ prompt: "x" }).request.mode, "text-to-video");
  assert.equal(norm({ prompt: "x", sourceFilename: "a.png" }).request.mode, "image-to-video");
});

test("all three surfaces produce the same defaults", () => {
  // UI/Agent/CLI 각각의 최소 입력이 같은 duration/resolution/aspectRatio를 낳는다
});
```

마지막 테스트가 이 WP의 핵심이다. "통합했다"는 주장은 세 경로의 출력이 실제로
같을 때만 참이다.

## Accept criteria (C7)

1. 세 표면이 같은 정규화 함수를 거친다.
2. 최소 입력에서 세 경로의 기본값이 동일하다 — 테스트로 증명.
3. source 충돌이 조용히 무시되지 않고 오류가 된다 — **활성화 증거**: 충돌 입력으로
   실제 오류 코드가 반환되는 것을 관찰한다.
4. Agent가 `topic`/`storyboard`/`continuityLineage`를 전달할 수 있다.
5. extend/edit 계약은 건드리지 않는다.
6. 전 게이트 green.

## 범위 경계

IN: generate 경로 요청 정규화, Agent 필드 격차, 세 표면 동형성 테스트.
OUT: extend/edit 통합, Agent를 HTTP로 전환, provider 폴백 체인, 작업 추적/취소 재설계.
