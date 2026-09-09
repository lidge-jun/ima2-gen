---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, opencodex, port-spec, research]
---

# 001 — OpenCodex xai.ts 이식 사양과 결함 감사 (opus-5 explorer, 2026-09-09)

읽기 전용 조사 결과를 그대로 보존한다. D1/D2/D3/D6은 lidge-jun/opencodex 이슈 후보이며,
등록 여부와 번호는 000_plan.md의 "OpenCodex 이슈" 절에 기록한다.


# xAI OAuth 클라이언트 이식 사양 (OpenCodex `src/oauth/xai.ts` → ima2-gen `lib/xaiAuth.ts`)

조사 대상 커밋: ima2-gen `dev` @ `d4773557` (v3.15.1, Node `>=22`, `.node-version` 24.17.0), OpenCodex `src/oauth/xai.ts` 241줄, 번들 progrok 0.2.0 (`vendor/progrok-0.2.0.tgz`, `package.json:102`).

## 1. `xai.ts` export 인벤토리와 이식 판정

런타임 전제부터 정리한다. OpenCodex는 Bun 전용이다. `package.json:9` `"bun": "./src/index.ts"`, `bin/package-main.mjs`가 `if (typeof Bun === "undefined") throw new Error("The opencodex programmatic API requires the Bun runtime.")`로 Node 진입을 막는다. 반면 ima2-gen은 Node 24 ESM이다. 그래서 `Bun.sleep` 하나가 이식의 필수 교체 지점이다.

| Export | 시그니처 | Bun/Node 의존 | 판정 |
|---|---|---|---|
| `XAI_OAUTH_DISCOVERY_URL` | `const: string` (`xai.ts:7`) | 없음 | **KEEP** — `routes/auth.ts:79` 하드코딩 URL과 동일 문자열 |
| `XAI_OAUTH_CLIENT_ID` | `const: string` (`xai.ts:8`) | 없음 | **KEEP** — `routes/auth.ts:11` `GROK_CLIENT_ID`와 완전 동일 |
| `XAI_OAUTH_SCOPE` | `const: string` (`xai.ts:9`) | 없음 | **KEEP** — `routes/auth.ts:12` `GROK_SCOPE`와 완전 동일 |
| `XAI_LOCAL_CLI_DETACH_WARNING` | `const: string` (`xai.ts:15-16`) | 없음 | **DROP** — `~/.grok` 소유권 이관 경고. ima2는 `~/.grok`을 읽기 전용으로만 본다 (`routes/quota.ts:105`) |
| `XaiTokenPayload` | `interface` (`xai.ts:28-34`) | 없음 | **KEEP** |
| `discoverXaiOAuthEndpoints` | `(signal?: AbortSignal) => Promise<XaiDiscovery>` (`xai.ts:56`) | `fetch`, `AbortSignal.timeout`, `AbortSignal.any` — 전부 Node 18+ 표준 | **ADAPT** — `device_authorization_endpoint`도 반환하도록 확장 (`routes/auth.ts:80-81`이 필요로 함) |
| `XaiTokenRequestError` | `class extends Error { status?: number; oauthError?: string }` (`xai.ts:95`) | 없음 | **KEEP** — `oauthError`가 `invalid_grant` 판정의 유일한 근거 |
| `XaiTokenRetryDeps` | `interface { sleep?; random? }` (`xai.ts:96`) | 없음 | **KEEP** — 테스트 주입점 |
| `postXaiToken` | `(tokenEndpoint, body, signal?, deps?) => Promise<XaiTokenPayload>` (`xai.ts:100-115`) | **`Bun.sleep` (`xai.ts:105`)**, `DOMException` (`xai.ts:97`) | **ADAPT** — 아래 §5 결함 수정 포함 |
| `XaiOAuthFlow` | `class extends OAuthCallbackFlow` (`xai.ts:141`) | `callback-server.ts:63` `Bun.serve` | **DROP** |
| `loginXai` | `(ctrl, opts?) => Promise<OAuthCredentials>` (`xai.ts:196`) | `XaiOAuthFlow` 경유 `Bun.serve` | **DROP** |
| `refreshXaiToken` | `(refreshToken, signal?) => Promise<OAuthCredentials>` (`xai.ts:226`) | `postXaiToken` 경유 `Bun.sleep` | **KEEP (핵심)** |
| `credentialsFromTokenPayload` (비-export) | `(payload, refreshFallback?) => OAuthCredentials` (`xai.ts:117`) | 없음 | **KEEP** — export로 승격 |
| `decodeJwtPayload` / `getTokenIdentity` (비-export) | `xai.ts:76`, `xai.ts:87` | `Buffer.from(..., "base64url")` — Node 네이티브 | **KEEP** |
| `validateXaiEndpoint` (비-export) | `(rawUrl: string) => string` (`xai.ts:47`) | 없음 | **ADAPT** — §5 D6 |

**PKCE / callback-server DROP 확정.** 근거 셋. (1) ima2는 이미 device-code 플로우를 완성해 두었다 — `routes/auth.ts:79-141`이 discovery → `device_authorization_endpoint` POST → `urn:ietf:params:oauth:grant-type:device_code` 폴링까지 자체 구현했고, `CODEX_DEVICE_CODE_GRANT`(`routes/auth.ts:15`)를 쓴다. (2) xAI discovery가 device_code grant를 실제로 광고한다 — 라이브 확인:

```json
"grant_types_supported":["authorization_code","refresh_token","urn:ietf:params:oauth:grant-type:device_code"]
"device_authorization_endpoint":"https://auth.x.ai/oauth2/device/code"
```

(3) `XaiOAuthFlow`가 상속하는 `OAuthCallbackFlow`는 `callback-server.ts:63` `type BunServer = ReturnType<typeof Bun.serve>`에 묶여 있어 Node 이식 시 서버 계층 전체를 다시 써야 한다. 이식 대상은 **refresh 경로 하나**로 좁히는 게 맞다. `generatePKCE`(`pkce.ts:5-15`)는 순수 WebCrypto라 Node에서 돌지만, PKCE를 쓰는 authorization_code 플로우 자체가 DROP이므로 함께 뺀다.

## 2. 이식할 상수와 client_id 대조

```ts
// xai.ts:6-13
const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const XAI_OAUTH_CALLBACK_PORT = 56121;          // DROP
const XAI_OAUTH_CALLBACK_PATH = "/callback";    // DROP
const XAI_OAUTH_REFRESH_SKEW_MS = 2 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;
```

재시도 정책은 `postXaiToken`에 인라인되어 있다. 최대 3회 시도(`xai.ts:106` `attempt<=3`), 백오프 base는 1차 100ms / 그 이후 250ms에 ±25% 지터(`xai.ts:98`), 상한 2000ms, `retry-after`는 `/^\d+$/` 정수 초만 인식. 재시도 상태는 **429와 5xx만**(`xai.ts:114` `response.status===429||response.status>=500`), 네트워크 예외는 재시도하되 호출자 abort는 즉시 전파.

**client_id / scope 3자 대조 — 전부 일치, 리스크 없음.**

| 값 | OpenCodex | ima2 | progrok 0.2.0 |
|---|---|---|---|
| client_id | `b1a00492-...-4c329264a828` (`xai.ts:8`) | 동일 (`routes/auth.ts:11`) | 동일 (`dist/index.js:16`) |
| scope | `openid profile email offline_access grok-cli:access api:access` (`xai.ts:9`) | 동일 (`routes/auth.ts:12`) | 동일 (`dist/index.js:17`) |
| issuer | `https://auth.x.ai` (`xai.ts:6`) | 동일 (`routes/auth.ts:13` 토큰 URL) | 동일 (`dist/index.js:18`) |
| refresh skew | 120,000ms (`xai.ts:12`) | 없음 (refresh 미구현) | 120,000ms (`dist/index.js:28`) |
| 요청 타임아웃 | 30,000ms (`xai.ts:13`) | discovery 10s / device 15s / token 10s (`routes/auth.ts:79,87,120`) | 30,000ms (`dist/index.js:25`) |

세 구현이 같은 client_id를 쓰므로, ima2 device-code로 발급한 토큰을 `lib/xaiAuth.ts`가 갱신하고 progrok이 이어 갱신해도 grant가 깨지지 않는다. 이식 시 `XAI_OAUTH_REFRESH_SKEW_MS`는 progrok의 `TOKEN_REFRESH_SKEW_MS`와 값이 같아 두 프로세스의 갱신 판단이 어긋나지 않는다 — 다만 skew 적용 **지점**이 다르다(§3, D8).

`token_endpoint`는 하드코딩(`routes/auth.ts:13` `https://auth.x.ai/oauth2/token`)과 discovery 조회(`xai.ts:230`) 두 방식이 공존하는데, 라이브 discovery가 정확히 그 값을 반환하므로 현재는 동치다. 디스크에 `tokenEndpoint`가 이미 저장돼 있으니(§3) 갱신 시에는 저장값 우선, 없을 때만 discovery로 폴백하는 게 왕복을 줄인다.

## 3. `~/.progrok/auth.json` 스키마 3자 대조

**ima2가 쓰는 형태** (`routes/auth.ts:60-73`):

```ts
const data: Record<string, unknown> = {
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: typeof tokens.expires_in === "number" ? Date.now() + (tokens.expires_in as number) * 1000 : undefined,
  tokenEndpoint: GROK_TOKEN_URL,
};
if (email) data.email = email;
```

**progrok이 쓰는 형태** (`dist/index.js:194-214`):

```js
const data = {
  accessToken: input.accessToken,
  refreshToken: input.refreshToken,
  expiresAt: input.expiresIn ? Date.now() + input.expiresIn * 1e3 : void 0,
  tokenEndpoint: input.tokenEndpoint,
  idToken: input.idToken
};
// id_token JWT payload.email → data.email
writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 384 });   // 384 = 0o600
```

**OpenCodex `OAuthCredentials`** (`types.ts:28-45`): `{ refresh, access, expires, email?, accountId?, source? }`. `expires`는 "epoch ms after any small provider-specific early-refresh margin" — 즉 skew가 **이미 차감된** 값(`xai.ts:135` `Date.now() + expiresIn*1000 - XAI_OAUTH_REFRESH_SKEW_MS`).

현재 실제 디스크 상태(내 홈 기준 확인): `["accessToken","refreshToken","expiresAt","tokenEndpoint"]`.

차이는 셋이다. ima2는 `idToken`을 저장하지 않는다(progrok은 저장). ima2는 `accountId`/`sub`를 전혀 기록하지 않는다. 그리고 결정적으로 **`expiresAt`의 의미가 다르다** — progrok/ima2는 원시 만료 시각이고 skew는 읽는 쪽에서 뺀다(`dist/index.js:235` `Date.now() + TOKEN_REFRESH_SKEW_MS >= tokens.expiresAt`), OpenCodex `expires`는 skew가 이미 반영된 값이다.

**제안 스키마 — 마이그레이션 불필요, 기존 파일과 바이트 호환.**

```ts
// lib/xaiAuth.ts on-disk schema (~/.progrok/auth.json)
interface ProgrokAuthFile {
  accessToken: string;          // required
  refreshToken?: string;        // absent → refresh 불가, GROK_AUTH_REQUIRED
  expiresAt?: number;           // epoch ms, RAW (skew 미차감) — progrok 의미론 유지
  tokenEndpoint?: string;       // 없으면 discovery 폴백
  email?: string;               // id_token 또는 access_token JWT에서 추출
  idToken?: string;             // progrok 호환: 있으면 보존, 없으면 새로 쓰지 않음
  accountId?: string;           // NEW, optional. progrok/quota가 무시하므로 안전
}
```

필드 매핑:

| OAuthCredentials | ProgrokAuthFile | 변환 |
|---|---|---|
| `access` | `accessToken` | 그대로 |
| `refresh` | `refreshToken` | 그대로 |
| `expires` (skew 차감됨) | `expiresAt` (raw) | 읽기 `expires = expiresAt`, 쓰기 `expiresAt = Date.now() + expires_in*1000` |
| `email` | `email` | 그대로 |
| `accountId` | `accountId` | 신규 optional |
| `source` | — | 저장 안 함. `~/.progrok`는 정의상 로컬 OAuth 소유 |

호환성 근거: 추가 키를 넣어도 progrok `loadTokens()`(`dist/index.js:216-223`)는 `JSON.parse` 후 필드 접근만 하므로 무시하고, `routes/quota.ts:121-126`은 `accessToken`만 읽으며, `bin/lib/doctor-providers.ts:51`은 파일 존재 여부만 본다. **읽을 때 `idToken`이 있으면 그대로 되써야 한다** — 안 그러면 ima2의 갱신이 progrok이 저장한 `idToken`을 지운다.

**skew 의미론 경계를 명시적으로 그어라.** `lib/xaiAuth.ts` 내부에서는 `expires`를 raw로 다루고, 만료 판정에서만 `Date.now() + SKEW_MS >= expiresAt`으로 비교한다(progrok과 동일). `credentialsFromTokenPayload`를 그대로 가져오면 skew가 이중 차감되어 유효 수명이 2분 더 짧아진다 — 잘못된 갱신은 아니지만 progrok과 판단이 어긋나 불필요한 갱신 경합이 생긴다.

## 4. ima2 refresh 알고리즘 사양

**skew.** 120초, progrok `TOKEN_REFRESH_SKEW_MS`(`dist/index.js:28`)와 동일. 판정식은 progrok과 글자 그대로 맞춘다: `expiresAt !== undefined && Date.now() + 120_000 >= expiresAt`. `expiresAt`이 없으면(device-code 응답에 `expires_in`이 없던 경우, `routes/auth.ts:63`이 `undefined`로 남김) 만료 미상 → 낙관적으로 사용하고 401을 신호로 삼는다.

**single-flight.** OpenCodex는 `Map<key, flight>` + stale 회수 방식이다(`index.ts:502-541`): `tokenRefreshes.get(key)`로 기존 비행 조인, `OAUTH_TOKEN_REFRESH_FLIGHT_STALE_MS`(120초, `index.ts:114`) 초과 시 abort 후 교체, `MAX_OAUTH_TOKEN_REFRESH_FLIGHTS` 32개 상한. ima2는 계정이 하나뿐이므로 이걸 단일 모듈 변수로 줄인다:

```ts
let refreshFlight: { promise: Promise<GrokCredentials>; startedAt: number } | undefined;
```

조인 조건은 `Date.now() - startedAt <= 120_000`. `finally`에서 자기 자신일 때만 해제(`index.ts:537` `if (tokenRefreshes.get(key) === flight)` 패턴)해야 늦게 끝난 이전 비행이 새 비행을 지우지 않는다. ima2 서버는 병렬 생성 최대 12건이므로 이 dedup이 없으면 12개 요청이 동시에 refresh_token을 태우고, xAI가 refresh rotation을 하면 11개가 `refresh_token_reused`로 죽는다.

**원자적 0600 쓰기 — `lib/atomicWrite.ts`는 재사용하지 마라.** 현재 구현:

```ts
// lib/atomicWrite.ts:3-7
export async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, path);
}
```

`mode` 옵션이 없어 tmp가 umask 기본(보통 0644)으로 생성되고, rename이 그 퍼미션을 그대로 옮긴다. 자격증명 파일이 world-readable이 된다. 게다가 tmp 이름이 `process.pid` 고정이라 같은 프로세스 내 동시 쓰기가 충돌한다. `routes/auth.ts:70-73`이 이미 올바른 패턴을 갖고 있으니 그걸 따른다:

```ts
const tmp = join(dir, `auth.json.tmp-${randomBytes(6).toString("hex")}`);
writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
renameSync(tmp, target);
```

`lib/xaiAuth.ts`는 이 로직을 자체 보유하고(sidecar용 `atomicWrite.ts`와 용도가 다르다), 디렉터리는 `mkdirSync(dir, { recursive: true, mode: 0o700 })`(`routes/auth.ts:50`)로 보장한다. 들여쓰기 2칸 `JSON.stringify(data, null, 2)`도 progrok(`dist/index.js:214`)·ima2(`routes/auth.ts:72`)와 동일하게 유지해 diff 노이즈를 없앤다.

**refresh 실패 처리.** 파일은 **지우지 않는다**. progrok `logout`(`dist/index.js:488-490`)만 `deleteTokens()` 권한을 갖는다. 자동 삭제는 두 가지를 망친다 — 사용자가 재로그인 전까지 `email` 같은 표시용 메타를 잃고, 일시적 오분류(예: 네트워크 장애를 terminal로 오판)가 복구 불가능해진다.

terminal 판정은 OpenCodex `index.ts:602`를 그대로 쓴다:

```ts
["invalid_grant","refresh_token_reused","revoked_token"].includes(error.oauthError ?? "")
```

terminal이면 `GrokAuthError("GROK_AUTH_REQUIRED")`, 그 외(네트워크·5xx·429 소진)는 `GROK_AUTH_REFRESH_FAILED`. 이 구분이 UI에서 "재로그인하세요" vs "잠시 후 재시도"를 가른다. 추가로 OpenCodex의 negative-cache(`index.ts:156` `XAI_PERMANENT_FAILURE_TTL_MS=30_000`)를 가져오면 terminal 판정 후 30초간 같은 자격증명으로의 재시도를 즉시 차단할 수 있다 — 12건 병렬에서 죽은 토큰으로 12번 왕복하는 걸 막으므로 권장한다.

**요청 중 401 — 강제 갱신 1회 + 재시도 1회.** 현재 ima2 Grok 이미지 경로는 `Authorization: "Bearer dummy"`(`lib/grokImageCore.ts:72`)로 progrok 프록시에 붙고 실제 베어러 주입은 progrok이 한다(`dist/index.js:553`). 그래서 401 재시도 루프는 `lib/xaiAuth.ts`를 직접 쓰는 새 경로(프록시 우회)에만 필요하다. 사양:

1. 401 수신 → 현재 access token의 generation(예: `access` 문자열의 SHA-256 접두)을 기록.
2. `getGrokAccessToken({ forceRefresh: true })` 호출. 내부에서 저장된 generation이 이미 바뀌었으면(다른 요청이 먼저 갱신) 갱신 없이 새 토큰 반환 — OpenCodex `index.ts:499` `if (rejectedGeneration !== undefined && current.generation !== rejectedGeneration) return current;`와 같은 조건.
3. 새 토큰으로 **정확히 1회** 재시도. 다시 401이면 `GROK_AUTH_REQUIRED`로 종결.

**`lib/grokUpstreamRetry.ts`와의 관계 — 401은 이미 제외되어 있고, 그대로 둬야 한다.** `isTransientUpstreamStatus`(`grokUpstreamRetry.ts:29-32`)는 `500, 502, 503, 504, 520, 521, 522`만 재시도하므로 401·403·429는 애초에 통과한다. 401 재시도를 그 모듈에 넣으면 안 되는 이유가 명확하다 — `grokFetchWithRetry`는 같은 `doFetch`를 재실행할 뿐 헤더를 다시 만들지 않아서, 갱신된 토큰이 반영되지 않는 무의미한 재시도가 된다. 401 처리는 헤더를 재구성할 수 있는 호출 계층(어댑터)에 두고, `grokUpstreamRetry.ts`는 "MUST stay a leaf module: no imports from config, routes, or adapters"(`grokUpstreamRetry.ts:12`)라는 자체 계약대로 `lib/xaiAuth.ts`를 import하지 않는다.

한 가지 주의. `lib/grokImageCore.ts:178`은 401/403을 `502 GROK_AUTH_FAILED`로 변환한다. 401 재시도 로직을 이 계층 위에 얹으면 원래 상태 코드가 이미 뭉개진 뒤라 감지가 안 된다. 재시도는 `res.status` 원본을 보는 위치, 즉 `postGrokImages` 내부 `if (!res.ok)` 블록(`grokImageCore.ts:171`) 안에서 처리해야 한다.

## 5. `xai.ts` 결함 감사

Bun/Node 차이는 실제로 실행해 확인했다(Node 24.17.0, undici). 결함과 스타일을 분리한다.

### D1 — `retry-after`가 2000ms 상한에 삼켜진다 (실제 결함)

```ts
// xai.ts:98
return Math.min(2000,Math.max(j,seconds*1000));
```

`Math.min`이 바깥이라 서버가 지정한 대기 시간이 무조건 2초로 잘린다. 실측:

```
ra=60 -> 2000     // 서버가 60초 요구, 2초 후 재시도
```

**실패 시나리오.** xAI가 429 + `Retry-After: 60`을 주면 클라이언트는 2초 뒤 재시도해 즉시 또 429를 받고, 3회를 다 태운 뒤 실패한다. 레이트리밋 상황에서 백오프가 사실상 무력화되고 오히려 압박을 가중한다. `Retry-After`는 RFC 9110에서 준수 대상이지 상한 대상이 아니다.

**한 줄 수정.** `retryAfter`가 있으면 그 값을 그대로 쓰고 지터 상한만 2000ms로 제한: `return seconds > 0 ? seconds * 1000 : Math.min(2000, j);` (필요하면 별도의 넉넉한 절대 상한, 예: 60초를 둔다).

참고로 같은 저장소의 ima2 쪽 `retryBackoffDelayMs`(`grokUpstreamRetry.ts:65-70`)도 `Math.min(retryAfter, opts.maxDelayMs)`로 동일 계열의 절삭을 한다. 다만 ima2 쪽은 maxDelay가 5초이고 5xx 재시도 용도라 성격이 다르므로, 이식 시 xAI 토큰 경로에는 절삭 없는 정책을 쓰는 걸 권한다.

### D2 — `retry-after` HTTP-date 형식을 무시한다 (실제 결함)

```ts
// xai.ts:98
seconds=retryAfter!==null&&/^\d+$/.test(retryAfter)?Number(retryAfter):0
```

RFC 9110 `Retry-After`는 delay-seconds와 HTTP-date 두 형식을 모두 허용한다. 정규식이 후자를 버려 `seconds=0`이 되고, 서버 지시가 통째로 사라진다. 실측:

```
ra=Sun, 06 Nov 1994 08:49:37 GMT -> 100   // 100ms 후 재시도
```

소수 초(`1.5`)도 같은 이유로 0이 된다. 헤더 앞뒤 공백은 `Headers.get()`이 트림하므로(확인함: `' 30 '` → `"30"`) 문제되지 않는다.

**한 줄 수정.** `grokUpstreamRetry.ts:49-57` `retryAfterDelayMs`처럼 `Number()` 시도 후 실패 시 `Date.parse()` 폴백을 넣는다. 이식 시에는 그 함수를 재사용하는 게 자연스럽다.

### D3 — `isAbortError`가 사용자 지정 abort reason을 놓친다 (실제 결함, 단 통념과는 다른 형태)

```ts
// xai.ts:97
function isAbortError(error:unknown):boolean{return error instanceof DOMException&&error.name==="AbortError";}
```

"Node undici는 plain Error를 던진다"는 가설은 **틀렸다**. Node 24에서 직접 확인:

```
// AbortSignal.timeout 만료
ctor DOMException  name TimeoutError  dom true
// controller.abort() (reason 미지정)
ctor DOMException  name AbortError    dom true
```

기본 경로에서는 `DOMException`이 맞다. 진짜 결함은 두 가지다.

첫째, `controller.abort(reason)`으로 커스텀 reason을 주면 undici가 그 reason을 그대로 reject한다:

```
ctor Error  name Error  dom false  msg user cancel
```

ima2에는 이 패턴이 실재한다 — `grokUpstreamRetry.ts:73` `return signal?.reason ?? new DOMException(...)`. 즉 ima2 호출자가 커스텀 reason으로 취소하면 `isAbortError`가 false를 반환하고, `xai.ts:114`의 `if(isAbortError(error)&&signal?.aborted)throw error` 가드가 뚫려 **취소된 요청이 두 번 더 재시도된다**.

둘째, `AbortSignal.timeout` 만료는 `name === "TimeoutError"`라 `isAbortError`가 false다. `requestSignal`(`xai.ts:42-45`)이 30초 타임아웃을 항상 합성하므로, 타임아웃 만료 시 재시도 경로로 빠져 총 90초까지 늘어난다. 의도된 동작일 수도 있으나 `TOKEN_REQUEST_TIMEOUT_MS`라는 이름의 계약과는 어긋난다.

**한 줄 수정.** `signal?.aborted`를 1차 판정으로 삼아 에러 타입 의존을 없앤다: `if (signal?.aborted) throw error;` — reason 타입과 무관하게 정확하다. 타임아웃은 별도로 `error.name === "TimeoutError"`를 재시도 불가로 분류.

### D4 — 3회 소진 시 `throw last`가 raw 네트워크 에러를 노출한다 (경미한 결함)

`xai.ts:114` 말미의 `throw last`는 `for` 루프가 정상 종료됐을 때만 도달하는데, 실제로는 `attempt===3` 분기에서 항상 throw하므로 **도달 불가능한 코드**다. TypeScript는 `last: unknown` 타입이라 이를 잡지 못한다. 기능상 무해하지만 `throw`할 수 없는 값(`undefined`)을 던질 수 있는 형태라 정적으로 위험하다. 수정: 루프 후 `throw new XaiTokenRequestError(undefined, undefined, "xAI token request exhausted retries", { cause: last });`.

### D5 — `credentialsFromTokenPayload`의 `expires_in` 기본값 3600 (설계 판단, 조건부 결함)

```ts
// xai.ts:128-129
const expiresIn = typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in) ? payload.expires_in : 3600;
```

서버가 `expires_in`을 안 주면 1시간을 가정한다. 실제 수명이 더 짧으면 만료된 토큰을 최대 1시간 유효하다고 믿고 401을 받는다. `Number.isFinite` 가드 자체는 올바르다(`NaN`/`Infinity` 차단). 다만 progrok은 같은 상황에서 `expiresAt: undefined`(`dist/index.js:196`)로 "모름"을 명시하고 401을 신호로 쓴다 — 더 정직한 처리다. **ima2 이식판은 progrok 쪽을 따라야 한다.** 디스크 스키마가 `expiresAt?: number`로 optional인 이상, 3600을 넣으면 progrok의 "모름" 표현과 충돌한다.

`expires_in`이 문자열로 오는 경우(일부 IdP가 그런다)도 3600 폴백으로 흡수된다. `typeof === "string"`이면 `Number()` 시도를 추가하는 게 안전하다.

### D6 — `validateXaiEndpoint`가 임의 `*.x.ai` 서브도메인과 credential URL을 허용한다 (실제 결함, 낮은 심각도)

```ts
// xai.ts:50
if (parsed.protocol !== "https:" || (host !== "x.ai" && !host.endsWith(".x.ai"))) {
```

두 문제. (1) `.x.ai` 접미사만 보므로 discovery 응답이 오염되면 `https://attacker.x.ai/token`이 통과한다 — x.ai 서브도메인 하나만 탈취되면 refresh_token이 그리로 간다. 다만 discovery 자체가 TLS 고정 호스트라 공격 표면은 좁다. (2) `new URL()`은 userinfo를 보존한다:

```
https://u:p@auth.x.ai/oauth2/token  →  그대로 통과
```

`parsed.toString()`이 credential을 포함한 URL을 반환하고 `fetch`가 그걸 Authorization으로 변환할 수 있다. progrok의 `requireTrustedEndpoint`(`dist/index.js:41-50`)도 동일한 약점을 갖는다(원본 `url` 문자열을 그대로 반환하므로 오히려 더 느슨하다).

**한 줄 수정.** 알려진 호스트만 허용하고 userinfo를 거부: `if (parsed.protocol !== "https:" || parsed.username || parsed.password || (host !== "auth.x.ai" && host !== "accounts.x.ai")) throw ...`. progrok이 이미 `XAI_OAUTH_CORS_ORIGINS = ["auth.x.ai", "accounts.x.ai"]`(`dist/index.js:24`)라는 정확한 허용 목록을 갖고 있으니 근거도 있다.

### D7 — `decodeJwtPayload`의 base64url 처리는 정상 (결함 아님)

```ts
// xai.ts:81
return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as XaiJwtPayload;
```

Node의 `"base64url"` 인코딩은 패딩 없는 base64url을 올바로 디코드한다(확인: `eyJlbWFpbCI6ImFAYi5jb20ifQ` → `{"email":"a@b.com"}`). 잘못된 입력은 조용히 쓰레기 바이트를 만들지만 `JSON.parse`가 던지고 `catch`가 `undefined`를 반환하므로(`xai.ts:82-84`) 안전하다. `parts.length !== 3` 검사도 있다. **결함 없음.** 다만 서명 검증을 하지 않으므로 `email`/`sub`는 표시용으로만 써야 한다 — 인가 판단에 쓰면 안 된다. `xai.ts:88`에서 `id_token` 실패 시 `access_token`을 파싱하는데, access token이 JWT가 아닌 불투명 토큰일 수 있어 그때는 `undefined`가 되고 정상 폴백한다.

### D8 — refresh token rotation 폴백은 올바름 (결함 아님, 단 skew 이중 차감 주의)

```ts
// xai.ts:121-127
const refresh = typeof payload.refresh_token === "string" && payload.refresh_token.length > 0
  ? payload.refresh_token : refreshFallback;
if (!refresh) throw new Error("xAI token response did not include a refresh token");
```

`refreshXaiToken`이 `refreshToken`을 폴백으로 넘기므로(`xai.ts:240`), rotation을 안 하는 서버에서도 기존 토큰이 보존된다. progrok도 동일 패턴(`dist/index.js:263`). **올바르다.**

다만 `xai.ts:135` `expires: Date.now() + expiresIn * 1000 - XAI_OAUTH_REFRESH_SKEW_MS`는 skew를 차감해 저장한다. 이식 시 이 값을 그대로 `expiresAt`에 쓰면 progrok의 raw 의미론과 충돌해 skew가 두 번 적용된다(§3). 이식판에서는 차감을 제거해야 한다.

### D9 — `postXaiToken`의 응답 body 누수 (경미)

`xai.ts:114`에서 429/5xx 응답은 `readTokenError`가 `response.json()`으로 소비하지만(`xai.ts:99`), `json()`이 던지면 `catch{}`가 삼키고 body가 미소비 상태로 남는다. undici는 GC 시 정리하지만 소켓 재사용이 지연된다. ima2의 `cancelResponseBodyBestEffort`(`grokUpstreamRetry.ts:100-107`)가 이 문제를 명시적으로 다루는 참고 구현이다. 심각도 낮음.

### 스타일 (결함 아님)

`xai.ts:95-99`와 `xai.ts:105-114`의 압축 한 줄 코드는 기능상 정확하지만 리뷰·디버깅을 방해한다. `xai.ts:114`는 한 줄에 fetch·에러 분류·재시도 판정·백오프가 모두 들어 있어 스택 트레이스가 무의미해진다. ima2 규약(`AGENTS.md`: 함수 50줄 미만, 파일 500줄 미만)에도 어긋나므로 이식 시 풀어 쓴다. `xai.ts:96` `XaiTokenRetryDeps`의 `sleep`/`random` 주입은 좋은 설계이므로 유지.

**GitHub 이슈 후보 우선순위:** D1(retry-after 절삭)과 D2(HTTP-date 무시)는 재현이 쉽고 영향이 명확해 단독 이슈로 적합하다. D3(abort reason)은 커스텀 reason을 쓰는 호출자가 있어야 발현하므로 재현 조건을 명시해야 한다. D6(엔드포인트 검증)은 보안 강화 성격으로 별도 이슈. `AGENTS.md` 관례상 버그 하나당 PR 하나로 분리한다.

## 6. 제안 `lib/xaiAuth.ts` 공개 API

```ts
// lib/xaiAuth.ts — Node 24 ESM. 의존: node:fs, node:crypto, node:os, node:path only.
// MUST stay a leaf module: no imports from config, routes, or adapters.

export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_TOKEN_REFRESH_SKEW_MS = 120_000;
export const XAI_TOKEN_REQUEST_TIMEOUT_MS = 30_000;

export type GrokAuthErrorCode = "GROK_AUTH_REQUIRED" | "GROK_AUTH_REFRESH_FAILED";

export class GrokAuthError extends Error {
  readonly code: GrokAuthErrorCode;
  readonly status: number;           // GROK_AUTH_REQUIRED → 401, REFRESH_FAILED → 502
  readonly oauthError?: string;      // invalid_grant 등 원문 보존
  constructor(code: GrokAuthErrorCode, message: string,
              options?: { oauthError?: string; cause?: unknown });
}

/** ~/.progrok/auth.json 온디스크 형태. progrok 0.2.0과 바이트 호환. */
export interface GrokCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;                // epoch ms, RAW (skew 미차감)
  tokenEndpoint?: string;
  email?: string;
  idToken?: string;                  // 존재 시 반드시 보존
  accountId?: string;
}

export interface XaiDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  deviceAuthorizationEndpoint?: string;
}

export interface XaiTokenRetryDeps {
  sleep?: (ms: number) => Promise<void>;   // 기본: setTimeout 기반 (Bun.sleep 대체)
  random?: () => number;
  now?: () => number;
}

export function grokAuthFilePath(homeDir?: string): string;

/** 파일 부재/파싱 실패 시 null. 절대 throw하지 않는다. */
export function loadGrokCredentials(homeDir?: string): GrokCredentials | null;

/** 원자적 0600 쓰기 (tmp + rename). 디렉터리는 0700으로 보장. */
export function saveGrokCredentials(creds: GrokCredentials, homeDir?: string): void;

/** 파일 삭제. 명시적 logout에서만 호출. refresh 실패는 삭제하지 않는다. */
export function clearGrokCredentials(homeDir?: string): void;

export function discoverXaiOAuthEndpoints(signal?: AbortSignal): Promise<XaiDiscovery>;

export function postXaiToken(
  tokenEndpoint: string,
  body: Record<string, string>,
  signal?: AbortSignal,
  deps?: XaiTokenRetryDeps,
): Promise<XaiTokenPayload>;

export function refreshXaiToken(
  refreshToken: string,
  opts?: { tokenEndpoint?: string; signal?: AbortSignal; deps?: XaiTokenRetryDeps },
): Promise<GrokCredentials>;

export interface GetAccessTokenOptions {
  forceRefresh?: boolean;
  /** 401을 받은 토큰. 저장된 토큰이 이미 다르면 갱신 없이 새 토큰 반환. */
  rejectedAccessToken?: string;
  signal?: AbortSignal;
  homeDir?: string;
}

/**
 * 유효한 access token 반환. 만료 임박(skew 120s) 또는 forceRefresh 시 갱신 후 저장.
 * 자격증명 없음/refresh 없음/terminal 실패 → GrokAuthError("GROK_AUTH_REQUIRED")
 * 네트워크·5xx·429 소진 → GrokAuthError("GROK_AUTH_REFRESH_FAILED")
 */
export function getGrokAccessToken(opts?: GetAccessTokenOptions): Promise<string>;

/** 테스트 전용: single-flight와 negative-cache 초기화. */
export function __resetGrokAuthStateForTest(): void;
```

single-flight 메커니즘은 모듈 내부에 캡슐화한다:

```ts
let refreshFlight: { promise: Promise<GrokCredentials>; startedAt: number; token: string } | undefined;
const FLIGHT_STALE_MS = 120_000;          // OpenCodex index.ts:114와 동일
const TERMINAL_FAILURE_TTL_MS = 30_000;   // OpenCodex index.ts:156과 동일
let terminalFailureUntil = 0;
```

동작 규칙 넷. 조인 — 진행 중 비행이 `FLIGHT_STALE_MS` 이내면 그 promise를 공유한다. 세대 확인 — `rejectedAccessToken`이 주어졌고 디스크의 `accessToken`이 이미 다르면 갱신 없이 즉시 반환한다(`index.ts:499` 패턴). 자기 해제 — `finally`에서 `refreshFlight`가 자기 자신일 때만 `undefined`로 되돌린다(`index.ts:537` 패턴). 부정 캐시 — terminal 실패 후 `TERMINAL_FAILURE_TTL_MS` 동안 네트워크 왕복 없이 `GROK_AUTH_REQUIRED`를 즉시 던진다.

호출자 계약: `getGrokAccessToken()`은 매 요청 앞에서 호출하고 반환값을 캐시하지 않는다. 401을 받으면 `{ forceRefresh: true, rejectedAccessToken: <방금 쓴 토큰> }`으로 한 번만 재호출하고, 성공 시 요청을 한 번만 재시도한다. 두 번째 401은 `GROK_AUTH_REQUIRED`로 종결한다.

한 가지 미해결 사항을 남긴다. `lib/xaiAuth.ts`가 자격증명 파일을 갱신하면 별도 프로세스인 progrok이 그 변경을 자동 감지하지 않는다 — progrok은 요청마다 `loadTokens()`를 다시 읽으므로(`dist/index.js:229`) 실제로는 다음 요청에서 새 토큰을 집는다. 반대 방향, 즉 progrok이 갱신한 뒤 ima2의 인메모리 상태가 낡는 경우는 `loadGrokCredentials()`를 매번 디스크에서 읽는 설계로 회피된다. 인메모리 캐시를 도입하면 이 안전성이 깨지므로, 캐시 없이 파일을 진실의 원천으로 유지하는 걸 사양에 못박아 둔다.


