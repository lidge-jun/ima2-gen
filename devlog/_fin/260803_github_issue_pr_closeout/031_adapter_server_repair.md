# 031 — WP4: 어댑터/서버 결함 수정

대응 work-phase: `wp4` / 대응 기준: `g-adapter`

## 스코프

IN

- `lib/minimaxImageAdapter.ts` — F3 모델 전환, F4 타임아웃, F5 카운트 파싱, F8 다운로드 상한
- `routes/keys.ts` — F2 키 검증
- `tests/minimax-provider-contract.test.ts` — 잘못된 계약 수정 + 활성화 테스트 추가

OUT

- 다른 provider 동작 변경 (grok/gemini/atlascloud는 참조만)
- Web UI (WP5)
- `structure/01-file-function-map.md` (WP6에서 마지막에 일괄)

## F3 — 모델 강제 전환 제거 + 정직한 provenance

### 왜

MiniMax 공식 문서상 `image-01`이 T2I와 `subject_reference` I2I를 모두 지원한다.
`image-01-live`로 강제 전환할 근거가 없다. 게다가 전환 후에도 저장 메타데이터에는
원래 모델을 기록해서 히스토리가 거짓을 남긴다. 그 값은
`ui/src/components/ResultMetadataModal.tsx`에서 사용자에게 표시되고
`ui/src/store/storeReferenceImpl.ts`에서 모델 복원에 재사용된다.

### MODIFY `lib/minimaxImageAdapter.ts` — 전환 로직 제거

현재 코드(`origin/pr-118:lib/minimaxImageAdapter.ts:113-116`)는 reference가 있으면
요청 모델이 `image-01`일 때 이를 `MINIMAX_IMAGE_TO_IMAGE_MODEL`로 치환한다.
그 삼항 연산 전체를 지우고 아래로 대체한다:

```ts
// Both image-01 and image-01-live accept `subject_reference`, so an attached
// reference never overrides the caller's model choice. Only an unset model
// falls back to the configured default.
const model = options.model || MINIMAX_TEXT_TO_IMAGE_MODEL;
```

주석 `// image-01-live is the live/image-to-image variant; image-01 is text-to-image.`
도 함께 제거한다. 사실과 다르다.

### 결과 타입에 실제 전송 모델을 싣는다

`MinimaxImageResult`에 필드를 추가한다:

```ts
/** Model actually sent upstream. */
effectiveModel: string;
```

주석에 "callers persist this"라고 쓰지 않는다. 실제로 호출자는 저장하지 않는다.
지금 이 필드의 용도는 어댑터가 무엇을 보냈는지 테스트로 고정하는 것뿐이다.

반환 객체에 `effectiveModel: model`을 추가한다.

`MINIMAX_IMAGE_TO_IMAGE_MODEL` 상수는 모델 목록 검증에서 계속 쓰이므로 export를
유지한다. 강제 전환에만 쓰지 않는다.

선례: `lib/grokVideoAdapter.ts:453-488`이 `requestedModel`/`effectiveModel`/
`modelFallback`을 모두 반환한다. 여기서는 전환 자체를 없애므로 `effectiveModel`
하나로 충분하다.

### 파이프라인 전파 판단

각 파이프라인은 요청 시점의 `imageModel`을 그대로 저장한다. 전환을 제거하면 전송
모델과 요청 모델이 같아지므로 **provenance 불일치가 구조적으로 사라진다.** 따라서
`lib/generatePipeline.ts` 등 파이프라인 저장 코드는 바꾸지 않아도 정합해진다.
`effectiveModel`은 어댑터가 실제로 무엇을 보냈는지 테스트로 고정하는 용도다.
호출자가 이 필드를 저장하지는 않는다.

이 판단은 A 단계 검증 대상이다. 어딘가에서 여전히 모델이 바뀐다면 전파가 필요하다.

A 단계 검증 결과: 판단이 맞다. `normalizeMinimaxImageModel`
(`origin/pr-118:lib/imageModels.ts:111-123`)은 기본값 보정과 allowlist 검증만 하고
유효한 모델을 바꾸지 않는다. 강제 전환을 제거하면 `generatePipeline`,
`multimodePipeline`, `nodeGeneration`, `agentImageVideoGen`, `routes/edit.ts`의 모든
저장 경로에서 요청 모델과 전송 모델이 일치한다. 파이프라인 수정은 불필요하다.

다만 `effectiveModel`을 "향후 폴백 대비 계약"이라고 부르는 것은 과장이다. 호출자가
그 필드를 소비하지 않으므로 실제 폴백이 생기면 각 저장 경로를 함께 고쳐야 한다.
이번에는 어댑터가 무엇을 보냈는지 테스트로 고정하는 용도로만 쓴다.

## F9 — global region에서 `image-01-live` T2I 차단 (A-phase blocker 3)

### 왜

공식 문서상 허용 모델이 region마다 다르다.

| region | T2I 허용 모델 | I2I 허용 모델 |
|--------|---------------|---------------|
| global (`.io`) | `image-01`만 | `image-01`, `image-01-live` |
| CN (`.minimaxi.com`) | `image-01`, `image-01-live` | 둘 다 |

기본 region이 `global_en`인데 UI는 두 모델을 구분 없이 노출한다. 사용자가
`image-01-live`를 고르고 reference 없이 생성하면 공식 허용 범위를 벗어난 요청이
나가고 런타임 bad request가 뜬다. 원인을 알 수 없는 실패다.

F3에서 강제 전환을 제거했기 때문에 이 조합이 실제로 도달 가능해졌다. 전환이 있을
때는 우연히 가려져 있었다.

### MODIFY `lib/minimaxImageAdapter.ts`

모델 결정 직후, 요청을 보내기 전에 검사한다:

```ts
// Global MiniMax only lists image-01 for text-to-image; image-01-live is a
// reference-driven model there. Reject the unsupported combination locally
// with an explainable error instead of letting the API return a bare 2013.
const region = ctx.config.minimaxProvider.region;
if (region !== "cn_zh" && model === MINIMAX_IMAGE_TO_IMAGE_MODEL && references.length === 0) {
  throw minimaxError(
    "MiniMax image-01-live requires a reference image outside the China region. "
      + "Attach a reference or switch to image-01.",
    400,
    "MINIMAX_MODEL_REQUIRES_REFERENCE",
  );
}
```

메시지가 다음 행동을 알려준다: reference를 붙이거나 모델을 바꾸라고.

### 테스트

| region | model | refs | 기대 |
|--------|-------|------|------|
| `global_en` | `image-01-live` | 0 | `MINIMAX_MODEL_REQUIRES_REFERENCE` 400 |
| `global_en` | `image-01-live` | 1 | 통과, 전송 모델 유지 |
| `global_en` | `image-01` | 0 | 통과 |
| `cn_zh` | `image-01-live` | 0 | 통과 (CN은 T2I 허용) |

UI 쪽 대응은 `032`가 아니라 여기서 끝낸다. 서버가 명확한 오류를 주면 사용자는 무엇을
해야 할지 알 수 있고, region별 동적 모델 카탈로그는 이번 스코프를 넘는 설계 변경이다.

## F2 — 키 검증: 비과금 + region 반영 + fail-closed

### 왜

`{model:"image-01", prompt:"ima2 key check"}`는 불완전 요청이 아니다. 공식 스펙상
`aspect_ratio`는 `1:1`, `response_format`은 `url`, `n`은 `1`이 기본값이라 정상
생성 요청이고, 성공하면 이미지 한 장($0.0035)을 만들고 버린다. 게다가 검증 URL이
global 하드코딩이라 중국 region 설정에서 어긋나고, `401`/`1004`/`2049`만 거부해서
`403`·`429`·`500`·비정상 JSON은 유효한 키로 저장된다.

### 설계 — 생성 엔드포인트를 아예 쓰지 않는다

초안은 "빈 prompt를 보내 입력 검증에서 반려시킨다"였다. **폐기한다.** 공식 OpenAPI가
`prompt`에 `minLength`를 두지 않아 빈 문자열이 반드시 거부된다는 보장이 없고, 거부되지
않으면 키 저장마다 이미지가 생성돼 과금된다($0.0035/장). 사용자 돈이 걸린 문제에
"아마 거부될 것"이라는 가정을 쓸 수 없다.

대신 MiniMax가 제공하는 **OpenAI 호환 목록 엔드포인트 `GET /v1/models`**를 쓴다.
다른 provider(openai/xai/atlascloud)가 이미 전부 이 방식이다. 실측으로 확인했다:

```
$ curl -o /dev/null -w '%{http_code}' https://api.minimax.io/v1/models
401

$ curl -H "Authorization: Bearer invalid-probe-key" https://api.minimax.io/v1/models
{"type":"error","error":{"type":"authorized_error",
 "message":"login fail: Please carry the API secret key in the 'Authorization'
 field of the request header (1004)","http_code":"401"}, ...}

$ curl -o /dev/null -w '%{http_code}' https://api.minimaxi.com/v1/models
401
```

무효 키에 `401` + `1004`를 정확히 돌려준다. 생성이 일어나지 않으므로 과금이 없다.
global/CN 양쪽 모두 같은 경로를 제공한다.

### region 해석 헬퍼 추가

어댑터의 `resolveBaseUrl`과 같은 규칙으로 `routes/keys.ts`에 추가한다:

```ts
function resolveMinimaxValidateUrl(ctx: RuntimeContext): string {
  const cfg = ctx.config.minimaxProvider;
  const base = cfg.region === "cn_zh" ? cfg.cnBaseUrl : cfg.globalBaseUrl;
  return `${base.replace(/\/$/, "")}/models`;
}
```

`VALIDATE_URL_MAP.minimax`는 global `/v1/models`로 고쳐 두되, minimax 분기는 이
헬퍼가 계산한 region-aware URL을 쓴다는 주석을 단다.

### 검증 분기 교체

기존 minimax 분기(`origin/pr-118:routes/keys.ts:220-232`)를 통째로 교체한다.

```ts
// MiniMax exposes an OpenAI-compatible model list. Listing models never
// generates an image, so key validation costs nothing. (Probing the
// generation endpoint would bill a real image per save.)
opts.method = "GET";
opts.headers = { Authorization: `Bearer ${trimmed}` };
const validateRes = await fetch(resolveMinimaxValidateUrl(ctx), opts);
if (!validateRes.ok) throw new Error(`HTTP ${validateRes.status}`);
const parsed = await readJsonOrNull(validateRes);
// Fail CLOSED: a 2xx alone is not proof. MiniMax also returns errors inside
// a 200 body, so require the documented list shape before accepting the key.
if (!parsed || !Array.isArray(parsed.data)) {
  throw new Error("unexpected model list response");
}
const baseCode = parsed?.base_resp?.status_code;
if (typeof baseCode === "number" && baseCode !== 0) {
  throw new Error(`MiniMax status ${baseCode}`);
}
```

`readJsonOrNull`은 파싱 실패 시 `null`을 돌려주는 작은 헬퍼로 추가한다. 기존
구현처럼 빈 객체로 뭉개면 "읽을 수 없었다"와 "필드가 없었다"를 구분할 수 없다.

이 형태는 `403`·`429`·`5xx`·비정상 JSON·200 안의 MiniMax 오류를 전부 거부한다.
초안이 놓쳤던 "HTTP 200 + `base_resp.status_code != 0`" 구멍이 닫힌다.

`ctx`는 `routes/keys.ts`가 이미 `ctx.config.storage.configFile`을 쓰므로 접근 가능하다.

## F4 — 타임아웃을 504로 분류

`AbortSignal.timeout()`은 Node 20+에서 `TimeoutError`를 던진다. 현재 catch는
`AbortError`만 검사해서 타임아웃이 네트워크 실패(502)로 새어 나간다.

catch 블록 맨 앞에 분기를 추가한다:

```ts
if (e.name === "TimeoutError") {
  throw minimaxError("MiniMax image generation timed out", 504, "GENERATION_TIMEOUT");
}
```

기존 `AbortError` 분기는 그대로 둔다. `AbortSignal.any()`는 먼저 발화한 쪽의 reason을
전파하므로 사용자 취소는 계속 `AbortError` + `options.signal.aborted`로 잡힌다.

## F5 — 문자열 카운트 파싱

공식 응답 예시는 `success_count: "3"`처럼 문자열을 준다. 현재는 number만 검사해서
실제 안전 차단이 `MINIMAX_NO_IMAGE`(502 upstream 장애)로 잘못 노출된다.

헬퍼를 추가한다:

```ts
function toCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
```

`successCount`/`failedCount` 추출을 `toCount(...)`로 감싸고, 안전 차단 판정을
`failedCount !== null && failedCount > 0 && (successCount === null || successCount === 0)`
로 바꾼다.

## F8 — 다운로드 크기 상한 + 이미지 여부 검증 (양쪽 응답 경로 모두)

### 검증은 응답 형태와 무관해야 한다 (A-phase blocker 3)

MiniMax는 이미지를 `image_urls`(다운로드)와 `image_base64`(인라인) 두 형태로 준다.
다운로드 경로만 검증하면 upstream이 HTML/오류 텍스트를 base64로 넣었을 때 그대로
통과해 손상된 `.png`가 저장된다. 현재 어댑터가 정확히 그렇다
(`lib/minimaxImageAdapter.ts:182,192` — 감지 실패 시 PNG로 간주).

그래서 바이트 검증을 공통 함수로 분리하고 **두 경로 모두**에 적용한다:

```ts
const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * The detected magic bytes are authoritative: a Content-Type header (or the
 * absence of one) never overrides what the payload actually is.
 */
function validateMinimaxImageBytes(b64: string, headerMime?: string | null): string {
  if (!b64) {
    throw minimaxError("MiniMax returned an empty image payload", 502, "MINIMAX_IMAGE_INVALID");
  }
  const detected = detectImageMimeFromB64(b64);
  if (detected && ALLOWED_IMAGE_MIMES.has(detected)) return detected;
  const header = headerMime?.split(";")[0]?.trim();
  if (header && ALLOWED_IMAGE_MIMES.has(header)) {
    // Header claims an allowed image type but the bytes do not look like one.
    throw minimaxError(
      `MiniMax returned non-image bytes for ${header}`, 502, "MINIMAX_IMAGE_INVALID",
    );
  }
  throw minimaxError("MiniMax returned a non-image payload", 502, "MINIMAX_IMAGE_INVALID");
}
```

`detectImageMimeFromB64`의 실제 반환 타입은
`"image/png" | "image/jpeg" | "image/webp" | null`이다(`lib/refs.ts:17,38`).
감지가 성공하면 이미 허용 목록 안이므로 그 값을 그대로 쓴다.

`image_base64` 경로도 반드시 통과시킨다:

```ts
if (imageBase64.length > 0) {
  b64 = typeof imageBase64[0] === "string" ? imageBase64[0] : "";
  mime = validateMinimaxImageBytes(b64);
}
```

에러 코드는 `MINIMAX_IMAGE_INVALID` 하나로 통일한다. 초안의
`MINIMAX_IMAGE_DOWNLOAD_INVALID`는 다운로드 경로에만 해당하는 이름이라 부적절하다.

`lib/grokImageCore.ts:140-176`의 선례를 따른다: HTTP(S) 스킴 제한, `content-length`
선검사, 스트리밍 누적 상한. 상수는 동일하게 50MB.

새 헬퍼 `downloadMinimaxImage(url, signal)`를 추가한다. 동작 순서:

1. `new URL(url)`로 파싱하고 프로토콜이 `http:`/`https:`가 아니면 거부
   (`MINIMAX_IMAGE_DOWNLOAD_FAILED`).
2. `fetch` 후 `!res.ok`면 거부.
3. `content-length`가 50MB를 넘으면 즉시 거부
   (`MINIMAX_IMAGE_DOWNLOAD_TOO_LARGE`).
4. `res.body`가 없으면 거부.
5. `res.body.getReader()`로 청크를 누적하며 총량이 50MB를 넘는 순간
   `reader.cancel()` 후 거부. 선언된 길이가 없거나 거짓말인 경우를 잡는다.
6. 빈 버퍼면 거부.
7. **응답이 실제 이미지인지 확인한다.** header의 `content-type`만 믿지 않는다.
   - 허용 MIME은 `image/png`, `image/jpeg`, `image/webp`로 제한한다.
   - 다운로드한 바이트에 `detectImageMimeFromB64`를 돌려 교차 검증한다.
   - header가 비어 있거나 허용 목록 밖이면 감지된 MIME을 쓰고, 감지도 실패하면
     거부한다(`MINIMAX_IMAGE_DOWNLOAD_INVALID`).
   근거: downstream `lib/routeHelpers.ts:11`이 알 수 없는 MIME을 PNG로 간주하므로,
   CDN이 200으로 HTML 오류 페이지를 주면 그 바이트가 `.png`로 저장된다.
8. 검증된 MIME과 base64를 반환.

`combinedSignal`을 그대로 넘기는 것은 의도된 설계다. 생성+다운로드를 합친 120초
전체 deadline이며, 새 타이머를 만들지 않으므로 정리할 타이머도 없다. (grok 헬퍼는
별도 다운로드 타임아웃을 만들기 때문에 `clearTimeout`이 필요한 다른 구조다.)

기존 호출부(`fetch` → `arrayBuffer()` 직접 적재)를 이 헬퍼 호출로 교체한다.

## 계약 테스트 수정 + 활성화 증거

### MODIFY `tests/minimax-provider-contract.test.ts`

기존 케이스가 F3의 강제 전환을 계약으로 고착하고 있다(`:101-124`). 그 케이스를
**정반대 기대**로 뒤집는다: reference가 붙어도 요청 모델이 유지되어야 한다.

### NEW 활성화 테스트 (각 수정마다 분기를 실제로 발화)

| 수정 | 트리거 | 관측 |
|------|--------|------|
| F3 | `model:"image-01"` + reference 1개로 generate | 전송 body의 `model === "image-01"`, 결과 `effectiveModel === "image-01"` |
| F3 | `model:"image-01-live"` + reference | 그대로 `image-01-live` 유지 |
| F4 | fetch가 `TimeoutError`를 던지도록 스텁 | 에러 `status === 504`, `code === "GENERATION_TIMEOUT"` |
| F5 | `metadata.failed_count: "1"`(문자열), 이미지 없음 | `code === "MINIMAX_SAFETY_BLOCKED"`, `status === 400` |
| F8 | `content-length`가 50MB 초과 | `code === "MINIMAX_IMAGE_DOWNLOAD_TOO_LARGE"` |
| F8 | 선언 없이 스트림이 상한 초과 | 같은 코드 |
| F8 | `file://` 등 비HTTP URL | `MINIMAX_IMAGE_DOWNLOAD_FAILED` |
| F8 | 200 + `text/html` 본문 | `MINIMAX_IMAGE_DOWNLOAD_INVALID` |
| F8 | 거짓 `image/png` header + HTML 바이트 | `MINIMAX_IMAGE_DOWNLOAD_INVALID` |
| F9 | global + `image-01-live` + refs 0 | `MINIMAX_MODEL_REQUIRES_REFERENCE` 400 |
| F9 | global + `image-01-live` + refs 1 | 통과 |
| F9 | `cn_zh` + `image-01-live` + refs 0 | 통과 |
| F2 | `GET /v1/models` 200 + `{data:[...]}` | 키 저장 성공 |
| F2 | 401 | 키 저장 안 됨 |
| F2 | 429 / 500 | 키 저장 안 됨 (fail-closed) |
| F2 | 200 + 비정상 JSON | 키 저장 안 됨 |
| F2 | 200 + `base_resp.status_code != 0` | 키 저장 안 됨 |
| F2 | region `cn_zh` | 요청 URL이 `api.minimaxi.com/v1/models` |

각 케이스는 `global.fetch`를 스텁해 실제 네트워크 없이 분기를 구동한다. 기존
테스트 파일이 이미 그 방식을 쓰므로 관례를 따른다.

F2는 `routes/keys.ts`가 Express 라우터라 단위 호출이 번거롭다. 검증 판정 로직을
순수 함수(`isMinimaxKeyValid(response, parsedBody)` 형태)로 분리해 그 함수를
테스트하고, URL 해석은 `resolveMinimaxValidateUrl`을 직접 호출해 확인한다.

**순수 함수만으로는 부족하다(A-phase 라운드 2 관찰).** 키 저장은 C4 경계이므로
실제 route가 (a) POST가 아닌 GET을 쓰고 (b) 검증 실패 시 config 파일에 쓰지 않는지를
최소 한 건의 route 테스트로 확인한다. 현재 이 저장소에 keys route 테스트가 없으므로
새로 만든다. `global.fetch`를 스텁하고 임시 config 경로를 준 뒤, 401 응답에서
config가 그대로인지 읽어 확인한다.

또 F8 구현 시 감지된 MIME을 authoritative로 삼고 header와 불일치하면 거부한다고
코드 주석에 명시한다. 모호하게 남기지 않는다.

`AbortSignal.timeout()`이 실제로 `TimeoutError`를 던지는 것은 리뷰어가 Node
v24.17.0에서 실측 확인했다(단독/`any()` 합성 모두 `DOMException` `TimeoutError`).
F4 테스트는 fetch 스텁으로 그 에러를 던져 분기를 구동한다.

ablation 반증: 수정 하나를 되돌리면 대응 케이스만 실패해야 한다. C 단계에서 확인한다.

## 검증

```
node --import tsx --test tests/minimax-provider-contract.test.ts
npm run typecheck
npm run typecheck:tests
```

## 한계

MiniMax 실 API 키가 없다. 실제 생성 왕복은 검증할 수 없고, 요청 조립·응답 파싱·에러
매핑까지만 증명한다.

F2는 초안의 스펙 해석 대신 실측으로 옮겨졌다: `GET /v1/models`가 인증만 요구하고
무효 키에 401/1004를 준다는 것을 global·CN 양쪽에서 curl로 확인했다. 유효 키로
200 목록이 오는 것은 키가 없어 확인하지 못했으므로, 그 경로는 스텁 테스트로만
고정한다. 이 구분을 D 요약에 남긴다.

## A-phase 라운드 4 보완 (구현 직전 감사 반영)

### 깨질 기존 테스트 전수

| 위치 | 무엇이 깨지나 | 조치 |
|------|---------------|------|
| `:101-124` | F3 강제 전환을 계약으로 고착 | 정반대 기대로 뒤집는다 |
| `:61,76` | URL 성공 fixture가 `"fake image"` 바이트에 JPEG header | 실제 JPEG magic bytes(`ff d8 ff`)로 교체 |
| `:108,125` | `image_base64` fixture `"b3V0"`가 이미지가 아님 | 실제 PNG magic bytes로 교체 |

세 곳 모두 F8이 발화하면 실패한다. fixture를 진짜 이미지 바이트로 바꾸는 것이
올바른 조치다 — 검증을 느슨하게 만드는 것이 아니라. 나머지 케이스(number형 safety,
CN routing, auth, ref-count)는 영향이 없다.

### F2는 route 테스트 하나로 통합

`routes/keys.ts`의 공개 seam은 `mountKeyRoutes` 하나뿐이다(`:80`). 비공개 헬퍼를
테스트에서 import하면 컴파일이 깨지고, 테스트를 위해 구현을 export로 열지 않는다.
대신 실제 경계를 태워 한 테스트에서 전부 관측한다:

- 요청 method가 `GET`이고 URL 경로가 `/v1/models`인가
- region이 `cn_zh`일 때 `api.minimaxi.com`으로 가는가
- 200 + `{data:[...]}` → 키 저장 성공
- 401 / 429 / 500 / 비정상 JSON / 200+`base_resp.status_code != 0` → 저장 안 됨

스텁 주의: `global.fetch`를 스텁하면 테스트가 서버로 보내는 localhost 요청까지
가로챈다. localhost는 원본 fetch로 넘기고 MiniMax 호스트만 가로챈다. 선례는
`tests/api-provider-parity.test.ts:54,101`.

### 테스트 작성 기법

- F4 타임아웃: fetch 스텁에서 `new DOMException("timed out", "TimeoutError")`를 던진다.
- F8 스트림 상한: `new Response(new ReadableStream({ pull(c) { c.enqueue(chunk); } }))`.
  선례는 `tests/responses-adapter-safety.test.ts:114`.

### 확인된 사실 (구현 시 신뢰해도 됨)

- `ctx`는 라우터 팩토리 인자로 들어와 PUT handler에서 사용 가능하다(`routes/keys.ts:80,187`).
- `opts`는 초기에 signal만 가지므로 GET 전환 시 body/Content-Type 충돌이 없다(`:214`).
- `readJsonOrNull`은 저장소에 기존 선언이 없어 이름 충돌이 없다.
- `MINIMAX_IMAGE_TO_IMAGE_MODEL`은 `routes/models.ts:8,176`에서 계속 쓰이므로
  전환 로직만 지워도 `noUnusedLocals`에 걸리지 않는다.
- F9 조합은 실제 도달 가능하다: `lib/imageModels.ts:19,111` allowlist 통과 →
  `lib/providerOptions.ts:45` 모델 보존 → `lib/generatePipeline.ts:66,341`이
  references 기본값 `[]`와 함께 어댑터로 전달. 죽은 코드가 아니다.
- `res.body.getReader()`는 이 저장소 tsconfig에서 컴파일된다(`lib/grokImageCore.ts:161,164` 선례).
