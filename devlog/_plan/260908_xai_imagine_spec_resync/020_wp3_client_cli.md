---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, grok, video, wp3, client, cli]
---

# 020 — WP3 클라이언트/CLI 반영 (D1, D2, D4, D5, D6, D11)

WP2가 서버를 진실로 만들었다면, WP3은 클라이언트가 그 진실을 그대로 말하게 한다.
GUI 신규 입력(오디오/동영상/드롭존)은 분량이 커서 030(WP3.5)이 따로 받는다.

## MODIFY: ui/src/lib/imageModels.ts

```diff
 export function isVideoModelValue(v: unknown): v is VideoModel {
-  return v === GROK_VIDEO_MODEL_BASE || v === GROK_VIDEO_MODEL_15 || v === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS;
+  return v === GROK_VIDEO_MODEL_BASE || v === GROK_VIDEO_MODEL_15
+    || v === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS || v === GROK_VIDEO_MODEL_15_DATED_ALIAS;
 }
```

`normalizeVideoModelValue`도 새 별칭을 1.5로 접는다. UI 상수는 서버와 물리적으로
분리돼 있으므로(빌드 경계), **값을 복제하되 회귀 테스트로 묶는다** —
`tests/xai-video-model-alias-contract.test.ts`가 서버/UI 양쪽 집합의 동일성을 검사한다.

## MODIFY: ui/src/components/VideoControlsPanel.tsx

`:49`의 `const maxDuration = 15;`가 모드/모델과 무관한 상수다. base + ref2v에서
사용자가 11초를 고르면 GUI는 허용하고 서버가 400을 낸다.

```diff
-  const maxDuration = 15;
   const mode = deriveVideoModeUI(refCount, singleRefMode);
+  // ref2v carries a per-model ceiling: 15s on 1.5, 10s on base. Outside ref2v the
+  // bound is the generation limit. Letting the slider offer a value the server
+  // rejects turns a user choice into a 400 they cannot explain.
+  const maxDuration = maxVideoDurationUI(videoModelSelected, mode);
```

`maxDuration`이 줄어들 때 현재 `duration`이 그 위에 있으면 clamp하는 `useEffect`를
1080p 처리와 같은 자리에 둔다. 해상도 쪽이 이미 같은 패턴을 쓰고 있으므로 형태를
맞춘다.

```diff
+  useEffect(() => {
+    if (duration > maxDuration) setDuration(maxDuration);
+  }, [duration, maxDuration, setDuration]);
```

모델을 base로 바꿔 길이가 잘리는 건 사용자가 요청하지 않은 변경이므로, clamp가
발생하면 토스트로 알린다. 조용히 줄이면 "왜 10초가 됐지"가 된다.

## MODIFY: ui/src/lib/referenceLimits.ts

`GROK_VIDEO_REF_LIMIT`은 `PROVIDER_REFERENCE_LIMITS.grok.video`에서 오므로
WP2의 registry 변경 + 재생성만으로 14가 된다. **파일 자체는 수정하지 않는다.**
주석의 `routes/video.ts: grok ref2v <= MAX_REF2V_REFERENCES (7)`만 14로 고친다 —
주석이 틀린 숫자를 들고 있으면 다음 사람이 그걸 근거로 삼는다.

## MODIFY: lib/providers/registry.ts (D5, 이미지 레인)

```diff
-    referenceLimits: { image: 3, edit: 3, video: MAX_REF2V_REFERENCES },
+    referenceLimits: { image: 5, edit: 5, video: MAX_REF2V_REFERENCES },
```

grok과 grok-api 둘 다. 근거는 실측 400
(`This model supports at most 5 input image(s), but 6 were provided.`)과
릴리스 노트('was 3')다. `lib/generatePipeline.ts`가 3을 별도로 들고 있으면 같이
올리고, 없으면 registry 하나로 끝난다. 재생성을 잊지 않는다.

**주의**: `image: 5`는 grok 계열에만 해당한다. agy/gemini-api의 3은 그 벤더의
제약이므로 건드리지 않는다. 값이 같다고 함께 바꾸면 260821에 Atlas가 당한
value-matching 사고를 반복한다(`referenceLimits.ts` 주석 참조).

## MODIFY: ui/src/lib/size.ts (D6)

`5:2`를 종횡비 목록에 추가한다. `21:9`는 이미 있다.

```diff
   { id: "21:9", label: "21:9", w: 21, h: 9 },
+  { id: "5:2", label: "5:2", w: 5, h: 2 },
```

타입 유니온과 i18n 4개 언어 파일(`ratio5x2`)에도 더한다. 이건 grok 이미지 레인
전용 비율이므로, 다른 provider가 선택했을 때 거부되지 않는지 확인이 필요하다.
확인 전에는 grok 계열에서만 노출한다.

## MODIFY: bin/commands/video.ts (D11)

```diff
-  ima2 video extend <prompt> --video <url|file_id|generated-file> [--duration 6]
+  ima2 video extend <prompt> --video <url|file_id|generated-file> [--duration 6]
...
-  Model: grok-imagine-video only. Extension: 2-10s.
+  Model: grok-imagine-video only (1.5 rejects extensions). Extension: 1-15s.
+  duration is the length of the ADDED segment, not the total output.
-        --duration <2-10> Extension duration (default: 6)
+        --duration <1-15> Added-segment duration (default: 6)
```

'2-10'은 xAI 문서의 값인데 **실측이 반증한다**: 1초와 11초가 200, 0초와 16초가
400이다. 우리 도움말은 실측을 따른다.

`edit` 도움말의 'Input: mp4, max 8.7s'도 성격을 명시한다.

```diff
-  Model: grok-imagine-video only (1.5 rejects edits). Input: mp4, max 8.7s.
+  Model: grok-imagine-video only (1.5 rejects edits). Input: mp4.
+  ~8.7s is our own measured practical ceiling, not an upstream-enforced limit.
```

`ima2 video` 생성 도움말에는 ref2v 상한 14와 모델별 길이를 반영한다.

## MODIFY: 서버측 extend duration 검증

CLI만 고치면 라우트가 여전히 2-10으로 막을 수 있다. `routes/videoExtended.ts`의
연장 길이 검증을 확인하고, 2-10 클램프가 있으면 1-15로 넓힌다. 없으면
`normalizeVideoDuration`이 이미 1-15이므로 변경 없다.

## 테스트

### MODIFY: tests/reference-limits.test.ts

```diff
-test("grok video mode allows ref2v up to min(server, 7)", () => {
+test("grok video mode allows ref2v up to min(server, 14)", () => {
```

이미지 레인 5장 케이스도 더한다.

### NEW: tests/video-duration-ui-bound-contract.test.ts

```
- maxVideoDurationUI(1.5, r2v) === 15
- maxVideoDurationUI(base, r2v) === 10
- maxVideoDurationUI(base, i2v) === 15
- UI와 서버의 maxRef2vDuration 이 같은 답을 낸다 (값 복제 방지)
```

### NEW: tests/cli-video-extend-help-contract.test.ts

```
- extend 도움말이 "2-10"을 포함하지 않는다
- extend 도움말이 1-15와 "added segment" 취지를 말한다
- edit 도움말이 8.7s를 업스트림 제약으로 서술하지 않는다
```

## 검증

```bash
node scripts/generate-provider-types.mjs
npm run typecheck && npm run typecheck:tests && npm test
cd ui && npm run build
```

## 완료 조건

- GUI 슬라이더가 서버가 거부할 길이를 제안하지 않는다.
- 레퍼런스 트레이가 비디오 14장, grok 이미지 5장을 받는다.
- CLI 도움말의 모든 숫자가 실측과 일치한다.
- 값 복제 지점마다 동일성 회귀가 있다.



---

# 감사 반영 (002_wp1_audit.md)

## A1 정정 — 연장 클램프는 서버에도 있다

CLI만 고치면 라우트가 막는다. `routes/videoExtended.ts:394`:

```diff
-      if (!Number.isInteger(dur) || dur < 2 || dur > 10) return res.status(400).json({ error: "duration must be an integer between 2 and 10" });
+      // Live probing accepts 1 and 11 and rejects 0 and 16, so the real bound is the
+      // same 1-15 as generation. xAI's own docs say 2-10; the measurement wins.
+      // devlog/_plan/260908_xai_imagine_spec_resync/000_research.md (D11)
+      if (!Number.isInteger(dur) || dur < MIN_VIDEO_DURATION || dur > MAX_VIDEO_DURATION) {
+        return res.status(400).json({ error: `duration must be an integer between ${MIN_VIDEO_DURATION} and ${MAX_VIDEO_DURATION}` });
+      }
```

`bin/commands/video.ts:271`의 `if (duration < 2 || duration > 10)`도 같이.
`/api/video/extend`(비-native) 경로에도 같은 클램프가 있는지 확인한다.

## A5 정정 — `maxVideoDurationUI`의 거처

`ui/src/lib/imageModels.ts`에 둔다. `supportsVideoResolutionUI`가 이미 거기 있고
같은 성격(모델+모드로 제약을 답하는 순수 함수)이다. 서버와 동일 규칙:
Grok 비디오 모델이 아니면 `MAX_VIDEO_DURATION`(15)을 돌려준다.

```ts
export function maxVideoDurationUI(model: string | false, mode: string): number {
  if (mode !== "reference-to-video") return 15;
  const normalized = normalizeVideoModelValue(model);
  if (!normalized) return 15;              // comfy/unknown: not our rule
  return normalized === GROK_VIDEO_MODEL_15 ? 15 : 10;
}
```

## A6 정정 — clamp의 사용자 경험

- clamp는 effect에서, **토스트는 모델 변경 핸들러에서** 띄운다.
  effect 안에서 띄우면 StrictMode 이중 실행으로 두 번 보인다.
- 원래 길이를 복원하지 않는다. 1.5로 되돌렸을 때 11초를 되살리면 사용자가
  직접 10으로 바꾼 경우와 구분되지 않는다.
- i18n 키 `video.durationClampedToModel` 4개 언어.
- 회귀 테스트: 11-15초 선택 상태에서 base 전환 케이스를 명시적으로 포함한다.

## A7 정정 — 이미지 5장의 근거 범위

실측은 `grok-imagine-image-2.0` + 프록시(oauth) 경로 하나뿐이다.
`grok-api`(직접 키)와 다른 이미지 모델은 미확인.

WP3 실행 시 `XAI_API_KEY`로 `grok-api` 경로를 먼저 실측한다. 불가능하면
registry 주석에 가정을 명시한다:

```ts
// 5 measured on grok-imagine-image-2.0 through the oauth proxy 2026-09-08.
// grok-api targets the same upstream with a direct key, so the same cap is
// ASSUMED rather than measured. If an edit fails at 4-5 images on grok-api,
// this assumption is where to look.
```

## A1 정정 — 함께 바뀌는 테스트

`tests/provider-registry-parity.test.ts:55-59`의 `image` deepEqual에서
`grok: 3, "grok-api": 3`이 5가 된다.

