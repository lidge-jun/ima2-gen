---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, audit, wp1]
---

# 002 — WP1 감사 결과와 로드맵 정정

독립 감사자(별도 컨텍스트)가 000/001과 010-050을 코드·증거와 대조했다.
blocker 3, should-fix 6, note 2. **전부 수용한다.** 아래는 각 지적의 검증과
로드맵 정정이다.

## A1 (blocker) — stale 사본을 로드맵이 놓쳤다

감사가 찾아준 목록을 코드로 확인했다. 전부 실재한다.

```
tests/provider-registry-parity.test.ts:60   referenceLimits("video") === { grok: 7, "grok-api": 7 }
routes/videoExtended.ts:394                 dur < 2 || dur > 10  (연장 클램프)
bin/commands/video.ts:271                   duration < 2 || duration > 10
docs/API.md:404, docs/CLI.md:245            2-7, 1-10s
docs/README.{zh-CN,zh-TW,ja}.md             구 ref2v 범위
docs/grok-video-i2v-research.md:120-128     1-10s ref2v, 2-10s 연장
site/.../providers.astro:177, modes.astro:56 (+ 한국어판)
skills/ima2/SKILL.md:879, 908, 1239-1245
```

특히 `provider-registry-parity.test.ts:60`은 `deepEqual`로 7을 **강제한다.**
registry만 고치면 이 테스트가 즉시 빨간불이 된다. 010이 이 파일을 언급하지
않았던 건 실제 누락이다.

`routes/videoExtended.ts:394`도 중요하다. 020은 CLI만 고치려 했는데, 라우트가
2-10을 강제하므로 CLI만 넓히면 서버가 막는다. **두 곳을 함께 고쳐야 한다.**

### 정정

- 010에 `tests/provider-registry-parity.test.ts` 추가.
- 020에 `routes/videoExtended.ts:394` 연장 클램프 1-15 확장 추가.
- 040에 위 문서/사이트/스킬 파일을 **명시적 인벤토리**로 등재.
- 050에 다음 그렙을 종료 게이트로 추가:

```bash
rg -n "Maximum allowed is 7|max 7 ref|2-7|2–7" docs site skills tests lib ui routes
rg -n "2-10|2–10" bin/commands/video.ts routes/videoExtended.ts docs site skills
```

무관한 7이 많으므로 문맥 있는 패턴만 쓴다.

## A2 (blocker) — 라우트 검증 위치

`routes/video.ts:382`가 해상도를 검증하고 바로 `startJob`으로 간다. 010이
"모드 확정 직후"라고만 적어 위치가 모호했다. 어댑터에만 넣으면 라우트는 이미
잡을 수 있었던 요청을 큐에 넣고, 사용자는 비동기 에러를 받는다.

### 정정

길이 검증을 `resolutionModeCheck` **바로 다음, `startJob` 이전**에 둔다.
같은 자리에 두 검증이 나란히 서면 다음에 제약이 늘어도 자리를 찾을 필요가 없다.
어댑터 검증은 그대로 유지한다 — 라우트를 우회하는 호출자(에이전트 경로)가 있고,
두 겹은 중복이 아니라 방어선이다.

## A3 (blocker) — Comfy가 Grok 상한을 상속한다

확인했다. `routes/video.ts:248`에서 comfy면 `modelCheck = { model: comfyWorkflowId }`가
되고, 그 아래 검증들이 `modelCheck.model`을 공유한다. 010의 `maxRef2vDuration`은
"1.5가 아니면 10"이므로 **comfy 워크플로가 10초로 잘린다.** 실제 회귀다.

### 정정

```diff
-export function maxRef2vDuration(model: string): number {
-  return canonical === GROK_VIDEO_MODEL_15 ? 15 : 10;
-}
+// Returns null for anything that is not a Grok video model. A comfy workflow id
+// arrives here as `model` (routes/video.ts:248 hands the workflow id through the
+// same field), and answering 10 for it would clamp a lane whose ceiling xAI does
+// not own. Null means "this rule does not apply", which the caller must handle
+// explicitly rather than by falling through to a default.
+export function maxRef2vDuration(model: string): number | null {
+  if (!isGrokVideoModel(model)) return null;
+  return canonicalGrokVideoModel(model) === GROK_VIDEO_MODEL_15
+    ? MAX_REF2V_DURATION_15
+    : MAX_REF2V_DURATION_BASE;
+}
```

`validateVideoDurationForRequest`도 `ceiling === null`이면 `{ ok: true }`를
돌려준다. `validateVideoResolutionForRequest`가 이미 같은 문제를 갖는지 확인이
필요하다 — comfy 모델로 1080p ref2v를 요청하면 지금도 Grok 규칙으로 거부될
수 있다. 확인해서 같은 문제면 **이번에 함께 고친다.**

## A4 (should-fix) — capabilities에 타입 없는 필드

`durationRangeByModel`을 그냥 추가하면 계약 테스트가 잡거나 조용히 누락된다.

### 정정

`lib/contracts/` 아래 capabilities 스키마를 확인하고, 응답 타입에 필드를
정식으로 정의한 뒤 계약 테스트를 더한다. 스키마가 없다면 필드를 추가하지 않고
`modes["reference-to-video"].notes` 문자열에 모델별 상한을 적는 것으로 대체한다.
**광고 형식을 늘리는 것보다 정확한 게 우선이다.**

## A5, A6 (should-fix) — UI 헬퍼와 clamp

`maxVideoDurationUI`는 신설 함수인데 020이 파일을 지정하지 않았다.
`ui/src/lib/imageModels.ts`에 둔다 — `supportsVideoResolutionUI`가 이미 거기 있고,
같은 성격의 함수다. 날짜 별칭과 비-Grok 처리는 서버와 동일 규칙(null이면 15)으로.

clamp 지적도 맞다. 정정한다.

- clamp 시 토스트 + i18n 키 `video.durationClampedToModel` (4개 언어).
- **원래 값을 복원하지 않는다.** 사용자가 1.5로 되돌렸을 때 11초를 되살리면
  "내가 10으로 바꿨는데 왜 11이 됐지"가 된다. 잘린 사실을 알리는 것으로 충분하다.
- effect 루프 위험: `setDuration(maxDuration)` 후 `duration === maxDuration`이
  되어 조건이 거짓이 되므로 한 번만 실행된다. 다만 토스트를 effect 안에서 띄우면
  StrictMode 이중 실행으로 두 번 보일 수 있다. 토스트는 **모델 변경 핸들러**에서
  띄우고 effect는 clamp만 한다.
- 회귀 테스트: 11-15초 선택 상태에서 base로 전환하는 케이스를 명시적으로 추가.

## A7 (should-fix) — 이미지 5장의 범위

실측은 `grok-imagine-image-2.0` 한 모델, 프록시(oauth) 경로 하나만 확인했다.
`grok-api`(직접 키)와 다른 이미지 모델은 확인하지 않았다.

### 정정

두 가지 중 하나를 고른다.

1. `grok-api`도 실측한다. `XAI_API_KEY`가 있으면 프록시 없이 직접 확인 가능하다.
2. 실측 못 하면 **grok(프록시)만 5로 올리고 grok-api는 3으로 둔다**는 건
   이상하다. 두 레인은 같은 업스트림을 부른다. 대신 registry 주석에
   "grok-imagine-image-2.0 실측 기준, 동일 업스트림이므로 grok-api에도 적용"이라고
   **가정을 명시**한다.

가정을 적어두면 틀렸을 때 어디를 볼지 알 수 있다. 숫자만 바꾸고 침묵하면 못 찾는다.
WP3 실행 시 1번을 먼저 시도한다.

## A8 (should-fix) — 오디오 단독 ref2v 경로가 없다

`routes/video.ts:370`의 `derivedMode`는 이미지 참조 개수만 본다.
`referenceAudios`만 있으면 `text-to-video`가 되고, 서버가 `reference_audios`를
실어 보내면 xAI가 ref2v로 해석해 **길이 상한이 어긋난다.**

### 정정 (010에 추가)

```diff
+      // Audio alone selects reference-to-video upstream: "at least one reference of
+      // either kind selects the reference-to-video mode" (OpenAPI GenerateVideoRequest).
+      // Without this the mode says text-to-video while xAI applies the r2v ceiling,
+      // and a 15s base-model request fails with a message naming a mode we never chose.
       const derivedMode: VideoMode = composerRefCount > 0
         ? "reference-to-video"
-        : deriveVideoMode(resolved.length);
+        : referenceAudios.length > 0
+          ? "reference-to-video"
+          : deriveVideoMode(resolved.length);
```

`referenceAudios`가 현재 `:523`에서 파싱되므로 모드 유도보다 **앞으로 옮겨야
한다.** 그리고 `mode === "reference-to-video" && resolved.length === 0`의 400은
오디오가 있으면 통과시켜야 한다.

테스트: 오디오만 1개 + 이미지 0장 -> ref2v로 판정, base면 10초 상한 적용.

## A9 (should-fix) — 숨은 엔드포인트 결론이 과하다

맞다. POST 405 + GET "Malformed request ID"는 **그 두 메서드에 대한 라우팅
동작**을 보여줄 뿐, 모든 메서드·인증 형태에서의 부재를 증명하지 않는다.

### 정정

001의 해당 단락을 "숨은 비디오 엔드포인트는 없다"에서 "이 프로브들로는
독립 호출 가능한 엔드포인트를 확인하지 못했다"로 고친다. 아래에서 실행한다.

## A10, A11 (note) — 근거가 뒷받침되는 항목

ref2v 이중 상한과 연장 1-15초는 증거와 일치한다고 확인됐다. 변경 없음.

## 감사 판정

"as written으로는 안전하지 않다." 위 정정을 010/020/030/040/050에 반영한 뒤
B 페이즈로 간다. 감사가 잡은 것 중 **A1과 A3이 특히 값지다** — 전자는 고쳐도
테스트가 깨질 지점, 후자는 다른 provider를 조용히 망가뜨릴 지점이었다.

