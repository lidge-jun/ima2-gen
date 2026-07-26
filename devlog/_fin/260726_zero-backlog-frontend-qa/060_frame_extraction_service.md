---
title: "060 — WP6: FrameExtractionService 추상화 (#88)"
lane: "260726_zero-backlog-frontend-qa"
wp: 6
created: 2026-07-26
depends_on: [WP4]
issue: 88
criteria: [C6]
---

# WP6 — FrameExtractionService 추상화 (#88)

## 이슈 재정의

이슈 #88은 "브라우저 canvas 기반 추출이 MVP다. 서버 ffmpeg 폴백 체인을 만들자"고
말한다. 그런데 **서버 ffmpeg 추출은 이미 프로덕션에 있다**.

`lib/videoFrameExtract.ts`는 단순한 래퍼가 아니다:

- `safeGeneratedFilePath` (`lib/videoFrameExtract.ts:31-52`) — realpath 기반 경로 탈출 차단
- `assertLocalMp4` (`lib/videoFrameExtract.ts:54-70`) — 크기 한도 + `ftyp` 컨테이너 헤더 검증
- `extractVideoFrame` (`lib/videoFrameExtract.ts:72-89`) — `-sseof -3`로 마지막 프레임, timeout/killSignal
- `ffmpegError` (`lib/videoFrameExtract.ts:16-28`) — `FFMPEG_UNAVAILABLE`/`TIMEOUT`/`ABORTED` 타입 분류
- `routes/videoExtended.ts:410-430` — `/api/video/frame` 라우트

따라서 이 WP의 실제 작업은 **추출 구현이 아니라 오케스트레이션**이다. 클라이언트가
어떤 추출기를 언제 쓸지 결정하는 계층이 없어서, 현재는 무조건 브라우저 canvas를 쓴다.

ffmpeg는 npm 의존성이 아니라 **PATH 실행 파일 의존성**이다(`execFile("ffmpeg")`).
사용자 머신에 없을 수 있고, 그래서 폴백이 실제로 필요하다.

## 현재 클라이언트 추출의 한계

`ui/src/lib/videoMedia.ts:19-58`:

```ts
    video.onloadedmetadata = () => {
      video.currentTime = Math.max(0, seekFn(video.duration));
    };
```

세 가지 결함이 있다.

1. **`video.duration`이 `NaN`/`Infinity`일 수 있다.** 메타데이터 파싱 전이거나 스트리밍
   컨테이너면 그렇다. `Math.max(0, NaN - 0.1)`은 `NaN`이고, `currentTime = NaN`은
   조용히 무시된다 → `onseeked`가 안 오고 Promise가 **영구 pending**. 타임아웃이 없다.
2. **CORS.** `crossOrigin = "anonymous"`를 설정하지만 서버가 헤더를 안 주면
   canvas가 tainted되고 `toDataURL`이 `SecurityError`로 던진다.
3. **`d - 0.1`이 마지막 프레임을 보장하지 않는다.** 페이드아웃이면 검은 화면이 나온다.
   ffmpeg `-sseof -3`는 마지막 3초 구간에서 실제 프레임을 고르므로 결과가 다르다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/lib/frameExtraction.ts` | NEW | 인터페이스 + `createFrameExtractionService` + 기본 인스턴스 |
| `ui/src/lib/videoMedia.ts` | MODIFY | `extractFrameAtTime`에 NaN 가드·타임아웃·abort. 세 래퍼에 옵션 인자 |
| `ui/src/lib/api-generation.ts` | MODIFY | `/api/video/frame` 클라이언트 |
| `ui/src/store/storeVideoImpl.ts` | MODIFY (조건부) | 파일명 확보 가능 시에만 서비스 전환 |
| `tests/frame-extraction-fallback.test.ts` | NEW | 폴백 활성화 증명 |

서버는 건드리지 않는다. 이미 필요한 것을 전부 제공한다.

### 호출자 전수 (2026-07-26 rg 검증, A-감사 blocker 3 반영)

최초 계획은 호출자를 2개로 적었다. 실제로는 **6개**다.

| 파일 | 라인 | 함수 |
|---|---:|---|
| `ui/src/store/storeVideoImpl.ts` | 8, 76 | `extractLastFrame` |
| `ui/src/store/storeGraphNodeImpl.ts` | 11, 154 | `extractLastFrame` |
| `ui/src/store/storeNodeRefImpl.ts` | 7, 104 | `extractLastFrame` |
| `ui/src/lib/continueFromItem.ts` | 2, 33 | `extractLastFrame` |
| `ui/src/components/PromptComposer.tsx` | 4, 192 | `extractLastFrame` |
| `ui/src/components/ResultActions.tsx` | 7, 177/190/200 | `extractLastFrame`, `extractFirstFrame`, `extractMidFrame` |

`ResultActions.tsx`가 특히 중요하다. 마지막 프레임뿐 아니라 **첫/중간 프레임**도 쓴다.
서비스가 `extractLastFrame`만 다루면 이 컴포넌트는 절반은 서비스를, 절반은 직접
호출을 쓰는 상태가 된다.

### 책임 분리와 DI 경계 (A-감사 round 2 blocker 2 반영)

round 1의 "래퍼가 서비스에 위임한다"는 표현은 의존 방향을 뒤집어 순환을 만들 수
있었다. 소유권을 명확히 나눈다.

| 모듈 | 책임 |
|---|---|
| `ui/src/lib/videoMedia.ts` | **브라우저 추출 구현만** 소유. `extractFrameAtTime`(가드·타임아웃·abort 포함)과 세 래퍼. 서비스를 모른다 |
| `ui/src/lib/frameExtraction.ts` | **오케스트레이션만** 소유. 서버 시도 → 폴백 판정 → `videoMedia` 호출 |

**`videoMedia.ts`는 `frameExtraction.ts`를 import하지 않는다.** 의존은
`frameExtraction.ts` → `videoMedia.ts` 단방향뿐이라 순환이 생기지 않는다.

싱글턴 컨테이너나 전역 가변 상태를 만들지 않는다. 팩토리와 기본 인스턴스를 같은
파일에서 export한다.

```ts
// ui/src/lib/frameExtraction.ts
export function createFrameExtractionService(deps: {
  fetchGeneratedFrame: (filename: string, position: "last", opts?: { signal?: AbortSignal }) => Promise<string>;
  extractFromElement: (url: string, position: FramePosition, opts?: { signal?: AbortSignal }) => Promise<string>;
}): FrameExtractionService { /* 폴백 로직 */ }

// 프로덕션 기본 인스턴스 — 모듈 로드 시 1회 생성
export const frameExtraction = createFrameExtractionService({
  fetchGeneratedFrame: fetchGeneratedFrameApi,
  extractFromElement: (url, position, opts) =>
    position === "last" ? extractLastFrame(url, opts)
    : position === "first" ? extractFirstFrame(url, opts)
    : extractMidFrame(url, opts),
});
```

테스트는 `createFrameExtractionService`에 가짜를 넘긴다. `frameExtraction` 상수를
바꿔치기하지 않으므로 테스트 간 전역 오염이 없다.

### 호출자 계약 — 조건부 원칙 하나로 통일

round 1의 "6곳을 전혀 안 바꾼다"와 round 2의 "1곳은 바꿀 수 있다"가 병존해 계약이
둘이었다. 하나로 정리한다.

> **원칙: 호출자 6곳은 기본적으로 불변이다. 단 B 단계에서 어떤 호출자가 실제로
> filename을 보유함이 코드로 증명되면, 그 호출자에 한해 서비스로 전환한다.**

세 층으로 나뉜다.

| 대상 | 이번 사이클 | 근거 |
|---|---|---|
| `extractFrameAtTime` 가드·타임아웃·abort | **무조건 적용** | 옵션 인자를 optional로 추가하므로 호출자 6곳 불변 |
| 서비스 + 폴백 오케스트레이터 | **무조건 신설** | 테스트로 발화 증명 |
| 호출자의 서비스 전환 | **조건부, 최대 1곳** | 아래 검증 통과 시에만 |

**옵션 인자는 optional이다.** `extractLastFrame(src)`처럼 인자 하나로 부르는 기존 6곳은
시그니처 확장에도 그대로 컴파일된다. 이것이 "기본 불변"이 성립하는 이유다.

**조건부 전환의 검증 조건.** 후보는 `ui/src/store/storeVideoImpl.ts:76`이며 현재
호출은 `extractLastFrame(parentNode.data.imageUrl)` — 인자가 URL 하나다. 전환하려면
`parentNode.data`에 filename(또는 그것을 유도할 `serverNodeId`)이 실제로 있어야 한다.
`ImageNodeData` 타입과 노드 생성 경로를 읽어 확인한다.

- **있으면**: 그 한 곳을 `frameExtraction.extractFrame({ kind: "generated", filename }, "last")`로
  전환하고, 서버 폴백이 프로덕션 경로에서 발화함을 기록한다.
- **없으면**: 전환 0곳. **이번 사이클 프로덕션 서버 경로는 0곳**이고 폴백 분기는
  테스트에서만 발화한다. 그 사실을 D 요약에 명시한다 — "구현했지만 실제로는 아직
  안 탄다"와 "동작한다"를 구분한다.

나머지 5곳은 URL만 갖고 있다. 억지로 전환하면 `{ kind: "url" }`로 서비스를 거쳐 결국
브라우저 구현에 도달하는데, 간접 계층만 늘고 동작은 같다. **의미 없는 전환은 하지
않는다.** 파일명 전달은 WP8의 `AssetRef` 이후로 미룬다.

### 시그니처 확장

`extractFirstFrame`/`extractMidFrame`도 같은 서비스를 타야 하므로 인터페이스는
`extractLastFrame` 단일 메서드가 아니라 위치 인자를 받는다:

```ts
export type FramePosition = "first" | "mid" | "last";
export interface FrameExtractionService {
  extractFrame(source: FrameSource, position: FramePosition, options?: { signal?: AbortSignal }): Promise<FrameResult>;
}
```

서버 `extractVideoFrame`(`lib/videoFrameExtract.ts:72-89`)은 `"last"` 또는 초 단위
숫자를 받는다. `"first"`/`"mid"`는 서버 폴백 시 duration 기반 초로 변환해야 하는데,
클라이언트가 duration을 모르면 변환할 수 없다. **따라서 `"first"`/`"mid"`는 당분간
브라우저 경로만 사용한다.** 서비스가 이를 명시적으로 처리하고, 조용히 잘못된
프레임을 반환하지 않는다.

## 060-1. 인터페이스

```ts
export type FrameSource =
  | { kind: "generated"; filename: string }
  | { kind: "url"; url: string };

export type FrameResult = {
  dataUrl: string;
  via: "server-ffmpeg" | "browser-canvas";
};
```

`via`를 결과에 넣는 이유: 어느 경로가 실제로 실행됐는지 테스트와 로그에서 확인해야
한다. 이게 없으면 폴백이 발화했는지 증명할 수 없다(C-ACTIVATION-GROUNDING-01).

**MIME 정규화 필요.** 서버는 PNG base64를, 브라우저는 JPEG data URL을 반환한다.
서비스는 항상 `data:image/...;base64,` 형태의 완성된 data URL로 통일한다. 호출자가
포맷을 신경 쓰면 추상화가 아니다.

## 060-2. 폴백 체인

```ts
export async function extractFrame(source, position, options) {
  // 서버 ffmpeg는 "last"만 직접 지원한다 (lib/videoFrameExtract.ts:79-88).
  if (source.kind === "generated" && position === "last") {
    try {
      const b64 = await fetchGeneratedFrame(source.filename, "last", options);
      return { dataUrl: `data:image/png;base64,${b64}`, via: "server-ffmpeg" };
    } catch (err) {
      if (!isRecoverableServerFrameError(err)) throw err;
      // FFMPEG_UNAVAILABLE / TIMEOUT / 5xx → 브라우저로 폴백
    }
  }
  const url = source.kind === "url" ? source.url : generatedUrl(source.filename);
  return { dataUrl: await extractFromElement(url, position, options), via: "browser-canvas" };
}
```

판단 근거:

- **generated 파일은 서버 우선.** ffmpeg가 CORS도 없고 마지막 프레임 선택도 정확하다.
- **원격 URL은 브라우저 우선.** 서버 라우트가 임의 URL을 받지 않는다(SSRF 방지).
  `safeGeneratedFilePath`가 generated 디렉터리 밖을 거부하므로 애초에 불가능하다.
- **폴백 대상 오류를 좁게 정의한다.** `VIDEO_FRAME_EXTRACT_ABORTED`(사용자 취소)는
  폴백하지 않는다. 취소했는데 다른 경로로 계속 시도하면 취소가 아니다.
  `400`(잘못된 파일)도 폴백하지 않는다 — 브라우저도 실패한다.
  폴백 대상은 `FFMPEG_UNAVAILABLE`(503), `TIMEOUT`(504), 기타 5xx뿐이다.

## 060-3. `videoMedia.ts` 가드

```ts
     video.onloadedmetadata = () => {
-      video.currentTime = Math.max(0, seekFn(video.duration));
+      const duration = video.duration;
+      if (!Number.isFinite(duration) || duration <= 0) {
+        cleanup();
+        reject(new Error("video duration is unavailable"));
+        return;
+      }
+      video.currentTime = Math.max(0, seekFn(duration));
     };
```

추가로 전체 작업에 타임아웃을 건다:

```ts
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("frame extraction timed out"));
    }, 15_000);
```

`cleanup()`은 타이머 해제 + `video.src = ""` + `video.load()` + 리스너 제거를 한다.
현재 코드는 `finally`에서 src만 비우고 `onerror` 경로에서는 정리하지 않는다.
`AbortSignal`도 지원해 사용자가 취소하면 즉시 정리한다.

기존 `extractLastFrame(videoSrc)` 시그니처는 **유지**한다. 다른 호출자가 깨지지 않게
하고, 새 서비스가 내부적으로 이것을 쓴다.

## 060-4. 호출자 처리

위 "계약 확정"대로 호출자 6곳은 **수정하지 않는다.** `videoMedia.ts`의 세 함수가
서비스에 위임하므로 모든 호출자가 자동으로 가드와 타임아웃 혜택을 받는다.

`{ kind: "generated" }` 승격은 파일명을 실제로 가진 호출자에 한해 B 단계에서
개별 판단한다. 승격한 호출자와 그 근거를 이 문서에 기록한다. 승격이 0건이면
서버 폴백 분기는 이번 사이클에서 테스트로만 발화하며, 그 사실을 D 요약에 명시한다 —
"구현했지만 프로덕션 경로에서 아직 안 탄다"와 "동작한다"를 구분한다.

## 활성화 증거 (C-ACTIVATION-GROUNDING-01, STRICT)

폴백은 정의상 조건부 경로다. "테스트 전부 green"은 이 규칙을 만족하지 않는다.
세 시나리오를 **실제로 발화**시킨다:

```ts
test("falls back to browser canvas when ffmpeg is unavailable", async () => {
  const service = createFrameExtractionService({
    fetchFrame: async () => { throw Object.assign(new Error("no ffmpeg"), { status: 503, code: "FFMPEG_UNAVAILABLE" }); },
    extractFromElement: async () => "data:image/jpeg;base64,AAAA",
  });
  const result = await service.extractFrame({ kind: "generated", filename: "a.mp4" }, "last");
  assert.equal(result.via, "browser-canvas");  // 폴백이 실제로 발화했다는 증거
});

test("first/mid positions never take the server path", async () => {
  let serverCalls = 0;
  const service = createFrameExtractionService({
    fetchFrame: async () => { serverCalls += 1; return "AAAA"; },
    extractFromElement: async () => "data:image/jpeg;base64,BBBB",
  });
  await service.extractFrame({ kind: "generated", filename: "a.mp4" }, "first");
  assert.equal(serverCalls, 0);
});

test("does not fall back on user abort", async () => {
  // ABORTED는 폴백하지 않고 그대로 던진다
});

test("does not fall back on 400 invalid input", async () => {
  // 클라이언트도 실패할 입력으로 재시도하지 않는다
});
```

`via` 필드가 이 증명을 가능하게 한다. 반환값이 동일하면 어느 경로가 돌았는지 알 수 없고,
그건 죽은 분기를 살아있다고 착각하는 전형적인 실패다.

추가로 `NaN` duration 가드도 활성화 증거가 필요하다 — `duration`이 `NaN`인 mock video로
Promise가 pending이 아니라 reject되는 것을 확인한다.

## Accept criteria (C6)

1. 서비스 인터페이스가 두 구현을 감싸고 호출자는 구현을 모른다.
2. `frameExtraction.ts` → `videoMedia.ts` 단방향 의존이며 `videoMedia.ts`는 서비스를
   import하지 않는다 — 정적 검사로 확인.
3. `FFMPEG_UNAVAILABLE`/timeout/5xx에서만 브라우저로 폴백한다 — 각각 테스트로 발화 증명.
4. abort와 400은 폴백하지 않는다.
5. `NaN`/`Infinity` duration에서 Promise가 pending으로 남지 않는다.
6. 기존 `extractLastFrame`/`extractFirstFrame`/`extractMidFrame` 시그니처가 유지된다.
7. `"first"`/`"mid"`가 서버 경로를 타지 않는다 — 호출 카운터로 증명.
8. 서버 폴백을 실제 프로덕션 경로에서 타는 호출자가 있으면 명시하고, 없으면
   "테스트에서만 발화"임을 D 요약에 기록한다.
9. 전 게이트 green.

## 문서화 (이슈 요구사항)

이슈는 "'V2V'가 아니라 'last-frame I2V'로 문서화하라"고 요구한다. 실제로 모션·궤적
정보는 보존되지 않고 마지막 프레임 한 장만 넘어간다. `skills/ima2/SKILL.md`의 해당
설명을 정정한다 — 사용자가 모션 연속성을 기대하면 결과에 실망한다.

## 범위 경계

IN: 클라이언트 서비스(팩토리+기본 인스턴스), `extractFrameAtTime` 가드, 폴백 테스트,
조건부 호출자 1곳 전환, 스킬 문서 정정.
OUT: 서버 ffmpeg 로직 변경, 타임라인 스크러버 UI(사용자 프레임 선택), 모션 벡터 보존.
나머지 호출자 5곳의 데이터 흐름 변경은 WP8 이후로 미룬다.
