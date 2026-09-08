---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, grok, video, wp2, server-contract]
---

# 010 — WP2 서버 계약 반영 (D1, D2, D4, D9)

000_research.md의 실측을 서버가 강제하는 값으로 옮긴다. 이 페이즈는 **서버만**
건드린다. UI/CLI/문서는 WP3/WP4가 받는다.

## 원칙

상한을 바꾸는 게 아니라 **상한의 출처를 바꾼다.** 지금 코드는 7이라는 숫자를
모델과 무관한 상수로 들고 있는데, 실측은 두 종류의 제약이 있다고 말한다.
레퍼런스 장수는 모델 무관(14), ref2v 길이는 모델별(1.5=15, base=10)이다.
이 구분을 타입으로 표현하지 않으면 다음 사양 변경 때 같은 자리에서 또 틀린다.

## MODIFY: lib/imageModels.ts

### 1. 레퍼런스 상한 7 -> 14

```diff
-// reference-to-video (xAI): up to 7 reference images (8 -> 400), 1-15s, 720p max.
-// Verified against api.x.ai on 2026-08-20:
-// devlog/_plan/260820_grok15_multi_reference_video/000_research.md
-export const MAX_REF2V_REFERENCES = 7;
+// reference-to-video (xAI): up to 14 reference images, 720p max.
+// The cap doubled from 7 on the xAI side; 15 returns
+// 400 "Too many reference images: 15. Maximum allowed is 14." and the number
+// is model-independent (both grok-imagine-video and -1.5 answer 14).
+// Re-verified against api.x.ai on 2026-09-08:
+// devlog/_plan/260908_xai_imagine_spec_resync/000_research.md
+export const MAX_REF2V_REFERENCES = 14;
```

### 2. NEW: ref2v 길이 상한을 모델별로 표현

`MAX_VIDEO_DURATION`(15)은 T2V/I2V의 상한으로 그대로 두고, ref2v 전용 상한을
모델에서 유도하는 함수를 추가한다. 상수 두 개를 나란히 두면 호출부가 어느 쪽을
쓸지 매번 판단해야 하므로, 판단을 함수 안에 가둔다.

```diff
+// reference-to-video carries its own ceiling, and it differs by model. The same
+// 16s request answers "maximum allowed ... is 15s" on grok-imagine-video-1.5 and
+// "... is 10s" on grok-imagine-video. Measured 2026-09-08 (000_research.md).
+//
+// This is NOT the 260820 clamp that was removed: that one was invented locally
+// and applied to every model. This one is the upstream's own per-model rule, and
+// omitting it turns a legal-looking base-model request into an upstream 400.
+export const MAX_REF2V_DURATION_15 = 15;
+export const MAX_REF2V_DURATION_BASE = 10;
+
+export function maxRef2vDuration(model: string): number {
+  const canonical = model === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS || model === GROK_VIDEO_MODEL_15_DATED_ALIAS
+    ? GROK_VIDEO_MODEL_15
+    : model;
+  return canonical === GROK_VIDEO_MODEL_15 ? MAX_REF2V_DURATION_15 : MAX_REF2V_DURATION_BASE;
+}
+
+/**
+ * Validates duration against the mode's real ceiling.
+ *
+ * Returns ok for every non-ref2v request: T2V and I2V are already bounded by
+ * normalizeVideoDuration's 1-15, and re-checking there would duplicate a rule
+ * that has only one owner.
+ */
+export function validateVideoDurationForRequest(model: string, duration: number, mode: VideoMode) {
+  if (mode !== "reference-to-video") return { ok: true as const };
+  const ceiling = maxRef2vDuration(model);
+  if (duration <= ceiling) return { ok: true as const };
+  return {
+    error: \`reference-to-video on \${model} allows at most \${ceiling} seconds\`,
+    code: "INVALID_VIDEO_DURATION" as const,
+    status: 400 as const,
+  };
+}
```

### 3. 날짜 별칭 추가 (D4)

```diff
 export const GROK_VIDEO_MODEL_15_PREVIEW_ALIAS = "grok-imagine-video-1.5-preview";
+// GET /v1/video-generation-models lists this alongside -preview. Without it a
+// legal model id is rejected locally with INVALID_GROK_VIDEO_MODEL before the
+// request ever reaches xAI.
+export const GROK_VIDEO_MODEL_15_DATED_ALIAS = "grok-imagine-video-1.5-2026-05-30";
 export const GROK_FALLBACK_VIDEO_MODEL = GROK_VIDEO_MODEL_15;
 export const VALID_GROK_VIDEO_MODELS = new Set([
   ...deriveModels("grok", "video"),
   GROK_VIDEO_MODEL_15_PREVIEW_ALIAS,
+  GROK_VIDEO_MODEL_15_DATED_ALIAS,
 ]);
```

`GrokVideoModel` 타입과 `normalizeGrokVideoModel`, `usesGrokVideo15TextCanvasShim`,
`validateVideoResolutionForRequest`의 정규화 분기에도 새 별칭을 더한다. 정규화가
세 곳에 흩어져 있으므로 `canonicalGrokVideoModel(model)` 헬퍼 하나로 모으고 셋 다
그걸 호출하게 바꾼다 — 별칭이 또 늘 때 고칠 자리를 하나로 만든다.

## MODIFY: lib/grokVideoAdapter.ts

`canonicalVideoModel`을 `imageModels.ts`의 `canonicalGrokVideoModel`로 대체하고,
`buildVideoGenerationPayload`에 길이 검증을 추가한다. 해상도 검증 바로 옆이
자리다 — 둘 다 "모드와 모델이 함께 정하는 제약"이기 때문이다.

```diff
   const resolutionCheck = validateVideoResolutionForRequest(model, plan.resolution, plan.mode);
   if (!("ok" in resolutionCheck)) {
     throw grokError(resolutionCheck.error, resolutionCheck.status, resolutionCheck.code);
   }
+  // Catch the per-model ref2v ceiling here rather than letting xAI answer it. The
+  // start call is deliberately not retried (a retry could bill twice), so a 400 we
+  // could have predicted costs the user a full planning round for nothing.
+  const durationCheck = validateVideoDurationForRequest(model, plan.duration, plan.mode);
+  if (!("ok" in durationCheck)) {
+    throw grokError(durationCheck.error, durationCheck.status, durationCheck.code);
+  }
```

## MODIFY: routes/video.ts

`:359`의 레퍼런스 개수 검사는 `MAX_REF2V_REFERENCES`를 그대로 읽으므로 상수 변경만으로
14가 된다. 추가로 길이 검증을 모드 확정 직후에 넣는다.

```diff
       if (mode === "reference-to-video" && resolved.length === 0) {
         return fail(400, "GROK_VIDEO_INVALID_MODE", "reference-to-video requires at least 1 reference image");
       }
+      const durationCheck = validateVideoDurationForRequest(model, duration, mode);
+      if (!("ok" in durationCheck)) return fail(durationCheck.status, durationCheck.code, durationCheck.error);
```

`:319`의 `ELEMENT_CAPACITY_DEFAULTS.grok.video` 오버라이드도 새 상수를 따라간다.

## MODIFY: lib/capabilities.ts (D9)

광고가 실제와 어긋나면 클라이언트는 틀린 UI를 그린다. 평면 숫자와 모드별 항목을
모두 고친다.

```diff
-        aliases: { "grok-imagine-video-1.5-preview": "grok-imagine-video-1.5" },
+        aliases: {
+          "grok-imagine-video-1.5-preview": "grok-imagine-video-1.5",
+          "grok-imagine-video-1.5-2026-05-30": "grok-imagine-video-1.5",
+        },
         resolutions: ["480p", "720p", "1080p"],
-        maxReferences: 7,
+        maxReferences: MAX_REF2V_REFERENCES,
```

`modes["reference-to-video"]`는 단일 `durationRange`로 진실을 말할 수 없다.
모델별 항목을 더한다.

```diff
           "reference-to-video": {
             maxReferences: MAX_REF2V_REFERENCES,
-            durationRange: [MIN_VIDEO_DURATION, MAX_VIDEO_DURATION],
+            // The widest case. Per-model ceilings below are what a request must obey.
+            durationRange: [MIN_VIDEO_DURATION, MAX_REF2V_DURATION_15],
+            durationRangeByModel: {
+              "grok-imagine-video-1.5": [MIN_VIDEO_DURATION, MAX_REF2V_DURATION_15],
+              "grok-imagine-video": [MIN_VIDEO_DURATION, MAX_REF2V_DURATION_BASE],
+            },
             resolutions: ["480p", "720p"],
-            notes: "References guide the subject without locking the first frame. 1080p is rejected upstream.",
+            notes: "References guide the subject without locking the first frame. 1080p is rejected upstream. Up to 15s on grok-imagine-video-1.5, 10s on grok-imagine-video.",
           },
```

`referenceAudio`에는 커스텀 보이스 경로의 출처를 적는다. 400 본문이
`/v1/custom-voices`를 직접 지목하므로 `presetsAreAuthoritative: false`가 왜
false인지 처음으로 근거를 갖는다.

```diff
           presetsAreAuthoritative: false,
+          customVoiceApi: "/v1/custom-voices",
```

또한 `videoModels`에 편집/연장의 모델 제약을 명시한다. 지금은 어디에도 없다.

```diff
+        videoInputModes: {
+          edit: { models: ["grok-imagine-video"], notes: "grok-imagine-video-1.5 answers 400 'Video editing is not supported for this model.'" },
+          extend: { models: ["grok-imagine-video"], durationRange: [MIN_VIDEO_DURATION, MAX_VIDEO_DURATION], notes: "Measured 1-15s, wider than the documented 2-10." },
+        },
```

## MODIFY: lib/providers/registry.ts

grok과 grok-api 두 항목의 `referenceLimits.video`를 7에서 14로 올린다.
`image`/`edit`은 WP3이 이미지 레인과 함께 다룬다 — 여기서 같이 바꾸면 비디오
회귀와 이미지 회귀가 한 커밋에 섞여 원인 분리가 어려워진다.

```diff
-    referenceLimits: { image: 3, edit: 3, video: 7 },
+    referenceLimits: { image: 3, edit: 3, video: MAX_REF2V_REFERENCES },
```

registry가 `imageModels.ts`를 import할 수 있는지 확인이 필요하다. 순환이 생기면
숫자 14를 registry에 두고 `imageModels.ts`가 그걸 읽는 반대 방향으로 뒤집는다.
어느 쪽이든 **숫자는 한 곳에만 존재해야 한다.**

변경 후 `node scripts/generate-provider-types.mjs`를 돌려 `ui/src/generated/providers.ts`를
재생성한다. 생성 파일을 손으로 고치면 다음 생성에서 되돌아간다.

## MODIFY: tests/video-ref2v-duration-contract.test.ts

이 테스트가 지금 **틀린 사실을 강제하고 있다.** 두 가지를 고친다.

1. `assert.equal(MAX_REF2V_REFERENCES, 7)` -> `14`.
2. "no surface re-introduces a reference-to-video duration clamp" 테스트는 소스에서
   ref2v 길이 상한 언급을 금지하는데, 이제는 **상한이 실재한다.** 금지 대신
   "상한이 있다면 모델별이어야 하고 10/15여야 한다"로 뒤집는다.

```diff
-test("reference-to-video has no duration ceiling of its own", () => {
+test("reference-to-video has a per-model ceiling: 15s on 1.5, 10s on base", () => {
+  assert.equal(maxRef2vDuration("grok-imagine-video-1.5"), 15);
+  assert.equal(maxRef2vDuration("grok-imagine-video-1.5-preview"), 15);
+  assert.equal(maxRef2vDuration("grok-imagine-video-1.5-2026-05-30"), 15);
+  assert.equal(maxRef2vDuration("grok-imagine-video"), 10);
+});
```

주석의 260820 근거 링크는 지우지 않고 **이어붙인다.** 그때의 결론(우리가 발명한
10초 클램프는 근거가 없었다)은 지금도 맞다. 지금 넣는 10초는 성격이 다르다 —
업스트림이 base 모델에 대해 스스로 강제하는 값이다. 그 구분을 주석이 말하지
않으면 다음 사람이 "260820에서 지운 걸 왜 되살렸나"로 읽는다.

## NEW: tests/xai-video-model-alias-contract.test.ts

```
- grok-imagine-video-1.5-2026-05-30 이 VALID_GROK_VIDEO_MODELS 에 있다
- normalizeGrokVideoModel 이 세 별칭을 모두 grok-imagine-video-1.5 로 정규화한다
- canonicalGrokVideoModel 이 해상도/길이/오디오 검증 세 경로에서 동일하게 쓰인다
- 1080p 규칙이 새 별칭에서도 1.5와 동일하게 동작한다
```

## NEW: tests/video-duration-per-model-contract.test.ts

```
- validateVideoDurationForRequest: 1.5 + r2v + 15s -> ok, 16s -> 이미 normalize에서 막힘
- validateVideoDurationForRequest: base + r2v + 11s -> 400 INVALID_VIDEO_DURATION
- validateVideoDurationForRequest: base + i2v + 15s -> ok (r2v가 아니면 통과)
- buildVideoGenerationPayload 가 base + r2v + 11s 를 throw 한다
- capabilities 의 durationRangeByModel 이 maxRef2vDuration 과 일치한다
```

## 검증

```bash
npm run typecheck
npm run typecheck:tests
npm test
```

## 완료 조건

- 14와 모델별 길이가 각각 **한 곳**에서만 정의되고 나머지는 그걸 읽는다.
- 새 별칭이 모든 정규화 경로를 통과한다.
- capabilities 광고와 라우트 검증이 같은 상수를 읽는다.
- 위 테스트가 통과하고, 기존 1094건이 깨지지 않는다.



---

# 감사 반영 (002_wp1_audit.md)

독립 감사가 이 문서의 blocker 3건을 잡았다. 아래가 정정된 계약이다.
**위 본문과 충돌하면 이 절이 이긴다.**

## A3 정정 — `maxRef2vDuration`은 Grok 외에 null을 돌려준다

`routes/video.ts:248`이 comfy 워크플로 id를 `modelCheck.model`에 담아 아래
검증들과 공유한다. "1.5가 아니면 10"은 comfy 요청을 10초로 자른다.

```ts
export function maxRef2vDuration(model: string): number | null {
  if (!isGrokVideoModel(model)) return null;
  return canonicalGrokVideoModel(model) === GROK_VIDEO_MODEL_15
    ? MAX_REF2V_DURATION_15
    : MAX_REF2V_DURATION_BASE;
}

export function validateVideoDurationForRequest(model: string, duration: number, mode: VideoMode) {
  if (mode !== "reference-to-video") return { ok: true as const };
  const ceiling = maxRef2vDuration(model);
  // null = not a Grok video model, so this rule has no jurisdiction. Falling
  // through to a numeric default would clamp a lane xAI does not own.
  if (ceiling === null || duration <= ceiling) return { ok: true as const };
  return {
    error: `reference-to-video on ${model} allows at most ${ceiling} seconds`,
    code: "INVALID_VIDEO_DURATION" as const,
    status: 400 as const,
  };
}
```

**추가 조사 항목**: `validateVideoResolutionForRequest`가 같은 문제를 갖는지
확인한다. comfy 모델 + 1080p + ref2v가 지금도 Grok 규칙으로 거부된다면 이번에
함께 고친다. 확인 결과를 `011_wp2_verification.md`에 남긴다.

## A2 정정 — 라우트 검증 위치를 못박는다

`routes/video.ts`의 `resolutionModeCheck` **직후, `startJob` 이전**이다.

```diff
       if (isNormalizeError(resolutionModeCheck)) return fail(...);
+      const durationModeCheck = validateVideoDurationForRequest(modelCheck.model, duration, mode);
+      if (isNormalizeError(durationModeCheck)) return fail(durationModeCheck.status, durationModeCheck.code, durationModeCheck.error);
       const referenceImages = mode === "reference-to-video" ? resolved.map((r) => r.b64) : undefined;
```

어댑터 검증도 유지한다. 라우트를 거치지 않는 에이전트 경로가 있으므로 두 겹은
중복이 아니라 각자의 방어선이다.

## A8 정정 — 오디오 단독 ref2v

`referenceAudios` 파싱을 모드 유도보다 **앞으로 옮기고**, 모드 유도에 반영한다.

```diff
       const derivedMode: VideoMode = composerRefCount > 0
         ? "reference-to-video"
-        : deriveVideoMode(resolved.length);
+        : referenceAudios.length > 0
+          ? "reference-to-video"   // audio alone selects r2v upstream (OpenAPI)
+          : deriveVideoMode(resolved.length);
```

`mode === "reference-to-video" && resolved.length === 0`의 400은 오디오가 있으면
통과시킨다.

```diff
-      if (mode === "reference-to-video" && resolved.length === 0) {
+      if (mode === "reference-to-video" && resolved.length === 0 && referenceAudios.length === 0) {
```

## A1 정정 — 함께 고쳐야 하는 테스트

`tests/provider-registry-parity.test.ts:60`이 `deepEqual`로 7을 강제한다.
registry만 고치면 즉시 실패한다.

```diff
-    assert.deepEqual(referenceLimits("video"), { grok: 7, "grok-api": 7 });
+    assert.deepEqual(referenceLimits("video"), { grok: 14, "grok-api": 14 });
```

WP3의 이미지 5장 변경 시 같은 파일 `:55-59`의 `image` deepEqual도 함께 바뀐다.

## A4 정정 — capabilities 필드는 스키마 확인 후

`durationRangeByModel`을 추가하기 전에 `lib/contracts/`의 capabilities 스키마를
확인한다. 정식 타입 정의가 가능하면 필드로 추가하고 계약 테스트를 더한다.
불가능하면 **필드를 추가하지 않고** `modes["reference-to-video"].notes` 문자열에
모델별 상한을 서술한다. 광고 형식을 늘리는 것보다 정확한 게 우선이다.

## 추가 테스트

```
tests/video-duration-per-model-contract.test.ts
  - maxRef2vDuration("comfy-workflow-abc") === null
  - validateVideoDurationForRequest(comfy id, 15, r2v) -> ok
  - 오디오만 있는 요청이 ref2v로 판정된다
  - 오디오만 + base + 11초 -> 400
```

