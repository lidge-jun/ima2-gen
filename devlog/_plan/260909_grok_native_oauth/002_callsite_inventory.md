---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, progrok, research]
---

# 002 — Grok 프록시 도달 경로 전수 조사 (opus-5 explorer, 2026-09-09)

읽기 전용 조사. 대상 dev @ 11900764 (v3.15.1). 본문은 파견 결과를 그대로 보존하고,
000_plan.md에서 결정으로 승격된 항목만 별도로 요약한다.


# Grok 프록시(progrok) 도달 경로 전수 조사

조사 대상: `/Users/jun/.codex/worktrees/6563/ima2-gen`, `dev` @ `11900764` (v3.15.1). 읽기 전용, 편집·커밋·테스트 실행 없음.

## 0. 현재 구조 요약

프록시 URL을 만드는 단일 지점은 두 개뿐이고 나머지는 전부 이 둘을 경유한다.

- `lib/grokImageCore.ts:62` `getGrokEndpoint(ctx, path, directApiKey?)` — 이미지/플래너/검색/프롬프트빌더용
- `lib/grokVideoShared.ts:113` `videoEndpoint(ctx, path, directApiKey?)` — 비디오용

예외적으로 `routes/videoExtended.ts:69` `videoProxyUrl()`이 세 번째 복제본으로 존재하며, 이건 `directApiKey`를 아예 받지 않는다.

```ts
// lib/grokRuntime.ts:20-26
export function getGrokProxyUrl(ctx: RouteRuntimeContext = {}, path = "/v1"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getGrokProxyBaseUrl(ctx)}${normalizedPath}`;
}

export function getGrokDirectBaseUrl(): string {
  return "https://api.x.ai";
}
```

`getGrokDirectBaseUrl()`은 정의만 있고 호출자가 없다 (`rg -n 'getGrokDirectBaseUrl' . --glob '!node_modules'` → `lib/grokRuntime.ts:25` 한 줄). 두 엔드포인트 함수는 `https://api.x.ai`를 리터럴로 박아 쓴다. 통합 시 이 함수를 실제 단일 상수원으로 승격시키면 된다.

## 1. 전체 도달 경로 표

### 1-A. 이미지 lane

| file:line | function | 현재 엔드포인트 해석 | auth 헤더 출처 | lane | 변경 |
|---|---|---|---|---|---|
| `lib/grokImageCore.ts:62-74` | `getGrokEndpoint` | `directApiKey` 있으면 `https://api.x.ai${path}`, 없으면 `getGrokProxyUrl(ctx, path)` | `Bearer ${directApiKey}` / `Bearer dummy` | grok, grok-api 공용 | credential 인자로 교체, 항상 `https://api.x.ai` |
| `lib/grokImageCore.ts:150-157` | `postGrokImages` | `getGrokEndpoint(ctx, path, directApiKey)` | 위 상속 | 양쪽 | `directApiKey?: string` → `credential` 전파 |
| `lib/providers/adapters/grokOperations.ts:52` | `generateViaGrok` | `postGrokImages(..., endpoint, options.directApiKey)` (`/v1/images/generations` \| `/v1/images/edits`) | 위 상속 | 양쪽 | 옵션 필드명 교체 |
| `lib/providers/adapters/grokOperations.ts:58-61` | `generateViaGrok` 다운로드 | `downloadGrokImageUrl(..., { trustedProxyOrigin: directApiKey ? undefined : new URL(getGrokProxyBaseUrl(ctx)).origin })` | — | grok만 trustedOrigin 부여 | `trustedProxyOrigin` 항상 `undefined`, 호출부 3곳 삭제 |
| `lib/providers/adapters/grokOperations.ts:86,91-94` | `editViaGrok` | `/v1/images/edits` + 동일 다운로드 정책 | 위 상속 | 양쪽 | 동일 |
| `lib/providers/adapters/grokMultimodeOperations.ts:98,101-104` | `generateMultimodeViaGrok` | 루프 내 `postGrokImages` + 다운로드 정책 | 위 상속 | 양쪽 | 동일 |
| `lib/providers/adapters/grokExecution.ts:27,35,49` | `prepareGrokClassic` | `activeProvider === "grok-api" ? ctx.xaiApiKey : undefined` | ctx | 분기 지점 | `await resolveGrokCredential(ctx, provider)` |
| `lib/providers/adapters/grokExecution.ts:59,61` | `prepareGrokNode` | 동일 | ctx | 분기 | 동일 |
| `lib/providers/adapters/grokExecution.ts:84,87` | `executeGrokEdit` | 동일 | ctx | 분기 | 동일 |
| `lib/providers/adapters/grokExecution.ts:96,101` | `executeGrokMultimode` | 동일 | ctx | 분기 | 동일 |

`grokExecution.ts`의 네 곳이 이미지 lane에서 프록시/직결을 가르는 **유일한 분기점**이다. 전부 같은 한 줄이다.

```ts
// lib/providers/adapters/grokExecution.ts:27
const grokDirectApiKey = activeProvider === "grok-api" ? ctx.xaiApiKey : undefined;
```

### 1-B. 비디오 lane

| file:line | function | 현재 엔드포인트 해석 | auth 헤더 출처 | lane | 변경 |
|---|---|---|---|---|---|
| `lib/grokVideoShared.ts:113-125` | `videoEndpoint` | `directApiKey` 유무로 `https://api.x.ai` / 프록시 | `Bearer ${directApiKey}` / `Bearer dummy` | 양쪽 | credential 인자로 교체 |
| `lib/grokVideoAdapter.ts:282` | `planGrokVideo` | `videoEndpoint(ctx, "/v1/chat/completions", options.directApiKey)` | 위 상속 | 양쪽 | 전파 |
| `lib/grokVideoAdapter.ts:247` | `planGrokVideo` 검색 | `searchGrokVisualContext(...)` → `getGrokEndpoint(ctx,"/v1/responses",directApiKey)` | 위 상속 | 양쪽 | 전파 |
| `lib/grokVideoAdapter.ts:398` | `startVideoRequest` | `videoEndpoint(ctx, "/v1/videos/generations", options.directApiKey)` | 위 상속 | 양쪽 | 전파. 재시도 금지 규약 유지 |
| `lib/grokVideoPoll.ts:45` | `pollVideoOnce` | `videoEndpoint(ctx, \`/v1/videos/${requestId}\`, directApiKey)` | 위 상속 | 양쪽 | 전파 |
| `lib/grokVideoPoll.ts:91` | `pollVideoUntilDone` | `options.directApiKey` 전달 | ctx→options | 양쪽 | 전파 |
| `lib/grokVideoDownload.ts:142-153` | `downloadVideo` | 프록시 아님. poll이 준 `poll.video.url`을 그대로 fetch, **Authorization 헤더 없음** | 없음 | 공통 | 변경 없음 |
| `routes/video.ts:543,558` | `POST /api/video` | `provider === "grok-api" ? ctx.xaiApiKey : undefined` | ctx | 분기 | credential 해석으로 교체 |
| `lib/videoExtendI2vOperation.ts:68` | i2v extend | `provider === "grok-api" ? ctx.xaiApiKey ?? undefined : undefined` | ctx | 분기 | 동일 |
| `routes/videoExtended.ts:69-70` | `videoProxyUrl` | **무조건 프록시 + `Bearer dummy`** | 하드코딩 | grok 전용 | 삭제하고 `videoEndpoint`로 통합 |
| `routes/videoExtended.ts:206` | `POST /api/video/edit` | `videoProxyUrl(ctx,"/v1/videos/edits")` | `Bearer dummy` | grok 전용 | credential 필요 |
| `routes/videoExtended.ts:341` | `POST /api/video/extend/native` | `videoProxyUrl(ctx,"/v1/videos/extensions")` | `Bearer dummy` | grok 전용 | credential 필요 |
| `routes/videoExtended.ts:435` | 프레임 분석 | `videoProxyUrl(ctx,"/v1/responses")` | `Bearer dummy` | grok 전용 | credential 필요 |

`routes/videoExtended.ts`의 세 라우트는 현재 `grok-api` 키를 절대 쓰지 않는다. 직결 전환 시 여기가 유일하게 "credential 인자가 존재하지도 않는" 신규 배선 지점이다.

```ts
// routes/videoExtended.ts:69-70
function videoProxyUrl(ctx: RuntimeContext, path: string) {
  return { url: getGrokProxyUrl(ctx, path), headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" } };
}
```

### 1-C. planner / chat lane

| file:line | function | 현재 엔드포인트 | auth | lane | 변경 |
|---|---|---|---|---|---|
| `lib/grokImagePlanner.ts:212` | `searchGrokVisualContext` | `getGrokEndpoint(ctx, "/v1/responses", options.directApiKey)` | 상속 | 양쪽 | 전파 |
| `lib/grokImagePlanner.ts:310` | `planGrokImage` | `getGrokEndpoint(ctx, "/v1/chat/completions", options.directApiKey)` | 상속 | 양쪽 | 전파 |
| `lib/agentPlannerModel.ts:115` | `requestGrokPlan` | `getGrokEndpoint(ctx, "/v1/chat/completions")` — **인자 없음 = 항상 프록시** | `Bearer dummy` | grok 전용 | credential 해석 필요 |
| `lib/promptBuilder/router.ts:107-111` | 백엔드 라우팅 | `backend === "grok-api" ? ctx.xaiApiKey : undefined` 후 `getGrokEndpoint` | ctx | 양쪽 | 아래 인용 참조 |

```ts
// lib/agentPlannerModel.ts:115  — grok 세션 플래너는 무조건 프록시
const { url, headers } = getGrokEndpoint(ctx, "/v1/chat/completions");
```

```ts
// lib/promptBuilder/router.ts:107-112
const directApiKey = backend === "grok-api" ? ctx.xaiApiKey : undefined;
if (backend === "grok-api" && !directApiKey) {
  throw unavailableBackendError("grok-api");
}
const target = getGrokEndpoint(ctx, "/v1/chat/completions", directApiKey);
return { ...target, useOAuthFetch: false };
```

`promptBuilder/router.ts`는 `grok-api`에만 사전 키 검사를 하고 `grok`은 무검사로 프록시에 넘긴다. 통합 후에는 두 백엔드 모두 `unavailableBackendError`가 걸릴 수 있어야 한다.

### 1-D. models / health / quota / status

| file:line | function | 현재 | 변경 |
|---|---|---|---|
| `routes/grok.ts:13` | `GET /api/grok/status` | 프록시로 실 `GET /v1/models` 호출 (`getGrokProxyUrl(ctx,"/v1/models")`), 인증 헤더 없음(프록시가 주입) | 직결 `https://api.x.ai/v1/models` + `Bearer <oauth token>` |
| `routes/grok.ts:11,22` | probe token | `ctx.grokProxy?.probeToken()` / `markProbedReady` | 프록시 supervisor 소멸 시 삭제 |
| `routes/models.ts:140-161` | `grokLaneState` | `ctx.grokUrl` 존재 + `ctx.grokProxy?.state` 스위치 | credential 상태 기반으로 재정의 |
| `routes/models.ts:178-184` | `grokApiLane` | `ctx.xaiApiKey` 유무만 | 유지 |
| `routes/health.ts:20-24` | `runtimePorts().grok` | `configuredPort/actualPort/url` 노출 | 프록시 포트 개념 소멸 |
| `server.ts:307,326-330` | `buildAdvertisePayload` | `grokProxyLive` → `actualPort/url/live` | 동일 |
| `bin/commands/service.ts:142-147` | service doctor | `grok.live === false` 판정 | 동일 |
| `routes/quota.ts:98-125,222-270` | `fetchGrokBilling` | **프록시 미경유**. `~/.grok/auth.json` + `~/.progrok/auth.json` 토큰을 직접 읽어 `cli-chat-proxy.grok.com`에 붙음 | 토큰 소스 공유 가능, 엔드포인트는 그대로 |

quota는 이미 progrok 프로세스가 아니라 progrok의 **자격증명 파일**만 읽는다. 이게 OAuth 토큰 재사용의 기존 선례다.

```ts
// routes/quota.ts:120-128
    const auth = JSON.parse(readFileSync(join(homeDir, ".progrok", "auth.json"), "utf8")) as { accessToken?: string };
    if (typeof auth.accessToken === "string" && auth.accessToken.trim()) {
      candidates.push({
        token: auth.accessToken,
        source: "progrok:auth-json",
```

### 1-E. 프록시 프로세스 수명주기 (통합 시 전부 소멸 후보)

| file:line | 내용 |
|---|---|
| `lib/grokProxyLauncher.ts:1-325` | 전체 supervisor. spawn/backoff/`waiting-for-login`/probe token |
| `server.ts:18,489-515` | `startGrokProxy` 호출, `grokProxyLive` 갱신 |
| `server.ts:390,401-403` | `grokPort`, `grokActualPort`, `grokUrl` 초기화 |
| `lib/runtimeContext.ts:22-28,116-123,197-199` | ctx 필드 및 기본값 |
| `routes/auth.ts:258` | 로그인 완료 시 `ctx?.grokProxy?.notifyCredentialsChanged()` |
| `bin/commands/grok.ts:1-80` | `ima2 grok login/logout/status/models/proxy` → progrok 바이너리 spawn |
| `package.json:102,112` | `"progrok": "file:vendor/progrok-0.2.0.tgz"` + bundledDependencies |
| `config.ts:378-410` | `grokProvider.proxyPort/proxyHost/autoStart/restart*` |

## 2. 통합 후 `getGrokEndpoint` 형태

### 권장 시그니처

토큰 갱신이 비동기이므로 credential 해석과 URL 조립을 분리하는 편이 낫다. 호출부 대부분은 이미 async 함수 안에 있다.

```ts
// lib/grokRuntime.ts (신규)
export type GrokCredential =
  | { kind: "api-key"; key: string }
  | { kind: "oauth"; token: string };

export function grokAuthHeaders(credential: GrokCredential): Record<string, string> {
  const bearer = credential.kind === "api-key" ? credential.key : credential.token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` };
}

/** 유일한 credential 해석 지점. oauth는 만료 임박 시 refresh까지 수행. */
export async function resolveGrokCredential(
  ctx: RouteRuntimeContext,
  provider: "grok" | "grok-api",
): Promise<GrokCredential> { /* §5 참조 */ }
```

### `lib/grokImageCore.ts:62-74` before/after

```ts
// BEFORE — lib/grokImageCore.ts:62-74
export function getGrokEndpoint(ctx: RouteRuntimeContext, path = "/v1/images/generations", directApiKey?: string): { url: string; headers: Record<string, string> } {
  if (directApiKey) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return {
      url: `https://api.x.ai${normalizedPath}`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${directApiKey}` },
    };
  }
  return {
    url: getGrokProxyUrl(ctx, path),
    headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
  };
}
```

```ts
// AFTER
export function getGrokEndpoint(
  _ctx: RouteRuntimeContext,
  path = "/v1/images/generations",
  credential: GrokCredential,
): { url: string; headers: Record<string, string> } {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return {
    url: `${getGrokDirectBaseUrl()}${normalizedPath}`,
    headers: grokAuthHeaders(credential),
  };
}
```

`ctx`는 시그니처 호환을 위해 남기되 미사용이다. 완전 제거하면 호출부 9곳을 전부 손봐야 하므로 1차 diff에서는 유지하는 쪽이 리뷰 범위가 작다.

### `lib/grokVideoShared.ts:113-125` before/after

```ts
// BEFORE — lib/grokVideoShared.ts:113-125
export function videoEndpoint(ctx: RouteRuntimeContext, path: string, directApiKey?: string) {
  if (directApiKey) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return {
      url: `https://api.x.ai${normalizedPath}`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${directApiKey}` },
    };
  }
  return {
    url: getGrokProxyUrl(ctx, path),
    headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
  };
}
```

```ts
// AFTER — grokRuntime의 한 구현으로 위임. grokVideoShared는 re-export만.
export { getGrokEndpoint as videoEndpoint } from "./grokImageCore.js";
```

두 함수가 문자 단위로 동일하므로 통합 후 별도 구현을 유지할 이유가 사라진다. `grokVideoShared.ts:1-11`의 "leaf 유지" 주석 규약은 `grokRuntime.ts`가 이미 leaf라서 깨지지 않는다.

### `GrokVideoOptions` 필드 변경

```ts
// BEFORE — lib/grokVideoShared.ts:59
  directApiKey?: string | undefined;
// AFTER
  credential?: GrokCredential | undefined;
```

동일 필드가 `lib/grokImagePlanner.ts:207,283`, `lib/providers/adapters/grokOperations.ts:28,79`, `grokMultimodeOperations.ts:48`, `grokVideoPoll.ts:42`에 반복 선언되어 있어 총 7개 선언을 함께 바꿔야 한다.

## 3. 프록시 readiness 소비자 전수 + 새 의미론

새 상태 모델 제안: `credential-ready` (토큰/키 보유 + 만료 전) / `credential-missing` / `refresh-failed`.

| file:line | 현재 판정 | 새 의미론 |
|---|---|---|
| `routes/grok.ts:11` | `ctx.grokProxy?.probeToken()` | 삭제. probe generation 개념 자체가 프록시 자식 프로세스 전용 |
| `routes/grok.ts:13` | 프록시 `/v1/models` 200 여부 | `https://api.x.ai/v1/models` + OAuth Bearer. 401이면 `offline` 대신 refresh 1회 후 재판정 |
| `routes/grok.ts:22` | `markProbedReady(token, base)` | 삭제 |
| `routes/grok.ts:25,30` | `state: ctx.grokProxy?.state` | credential 상태 문자열로 대체 |
| `routes/models.ts:141` | `if (!ctx.grokUrl) → disconnected "Grok proxy not configured"` | credential 없음 → `key-missing`/`disconnected` |
| `routes/models.ts:142-160` | supervisor state 7분기 | 3분기로 축소 |
| `server.ts:307,326-330` | `grokProxyLive` → advertise `grok.live` | live 개념 소멸. 필드 제거 또는 credential 보유 여부로 재정의 |
| `server.ts:499,504,510` | onPortSelected/onReady/onExit에서 갱신 | 삭제 |
| `bin/commands/service.ts:142-147` | `grok.live === false` 경고 | advertise 스키마 변경에 동반 수정 |
| `routes/health.ts:20-24` | grok 포트/URL 노출 | 제거 또는 `{ auth: "oauth" | "none" }` |
| `lib/runtimeContext.ts:22-28` | `grokActualPort/grokPort/grokUrl/grokProxy/grokProxyLive` | 전부 제거 대상 |
| `routes/auth.ts:258` | 로그인 후 supervisor 재무장 | 토큰 캐시 무효화 훅으로 대체 |

### 현행 lane 판정 (인용)

```ts
// routes/models.ts:140-161
function grokLaneState(ctx: RuntimeContext): LaneState {
  if (!ctx.grokUrl) return { status: "disconnected", reason: "Grok proxy not configured" };
  switch (ctx.grokProxy?.state) {
    case "ready":
      return { status: "ready" };
    case "starting":
      return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "backoff":
      return { status: "disconnected", reason: "Grok proxy restarting" };
    case "gave-up-retryable":
      return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "waiting-for-login":
      return { status: "disconnected", reason: "Grok login required" };
    case "gave-up":
      return { status: "disconnected", reason: "Grok proxy failed to start" };
    case "stopped":
      return { status: "disconnected", reason: "Grok proxy stopped" };
    default:
      return { status: "ready", reason: UNPROBED_GROK_REASON };
  }
}
```

`UNPROBED_GROK_REASON`은 `routes/models.ts:130`의 `"configured proxy endpoint; live session not probed"`다. 직결 후에는 "프로브되지 않은 낙관적 ready" 상태 자체가 불필요하다. 토큰 존재 여부는 동기적으로 확실히 알 수 있기 때문이다.

### UI가 기대하는 문자열 (계약)

`ui/src/hooks/useGrokStatus.ts:5-9`가 `/api/grok/status` 응답의 타입 계약이다.

```ts
export interface GrokStatus {
  status: "ready" | "no_image_model" | "error" | "offline";
  models?: string[];
  reason?: string;
}
```

이 4개 리터럴을 소비하는 곳:

- `ui/src/hooks/useProviderAvailability.ts:40-49` — `ready` / `offline` / `no_image_model` / `error` 4분기, 그 외는 빈 문자열
- `ui/src/hooks/useProviderAvailability.ts:65-69` — `grok: { ok: grokReady, reason, hint: t("provider.grokOfflineHint") }`
- `ui/src/hooks/useProviderAvailability.ts:70-73` — `"grok-api": { ok: xaiKeyOk, reason: t("provider.xaiApiKeyRequired") }` (`keyStatus?.xai?.valid`, 프록시 무관)
- `ui/src/components/OnboardingPopup.tsx:31` — `grok?.status === "offline" || grok?.status === "error"` 를 미인증으로 간주
- `ui/src/components/AccountSettings.tsx:116-117` — `statusTone(grok?.status)` / `statusLabel(t, grok?.status)`
- `ui/src/hooks/useGrokStatus.ts:28-30` — `status !== "ready"`면 10초 재폴링. `ui/src/hooks/useGrokStatus.ts:32`는 fetch 실패 시 `{ status: "offline" }`

i18n 문자열 중 프록시를 명시적으로 언급해 수정이 필요한 것:

```
ui/src/i18n/ko.json:740  "grokOffline": "Grok 프록시가 실행되지 않고 있습니다."
ui/src/i18n/ko.json:743  "grokOfflineHint": "필요하면 `ima2 grok login`을 한 번 실행한 뒤 `ima2 serve`를 시작하세요. ima2가 번들된 Grok 프록시를 자동으로 띄웁니다."
ui/src/i18n/ko.json:360  "grokApiBody": "번들 progrok에서 필수 검색 → Grok 4.5 이미지·텍스트 도구 기획(영어 프롬프트) → xAI Images API 순서로 실행합니다. ..."
```

`en.json:740,743,360`, `zh-Hans`, `zh-Hant` 동일 키에 같은 내용이 있다. `readiness.grokApiBody`는 `ui/src/components/ProviderReadinessPopup.tsx:100-101`에서 `provider === "grok"`일 때만 표시된다 (`ProviderReadinessPopup.tsx:41`의 `const isGrok = provider === "grok"`).

`ui/src/components/SettingsWorkspace.tsx:220-225`의 `settings.grokCompatibility.*`도 `provider === "grok"` 조건부다.

**status 리터럴을 유지한 채 의미만 재매핑하는 것이 UI 변경을 최소화한다:**

- `ready` = credential 유효 + `/v1/models`에 `grok-imagine*` 존재
- `no_image_model` = 인증은 됐으나 이미지 모델 없음 (그대로)
- `offline` = credential 없음 (문구만 "로그인 필요"로 교체)
- `error` = refresh 실패 또는 401/5xx

## 4. `grok` vs `grok-api` 차이 — auth 헤더 외 전부

`rg 'grok-api' lib routes` 기준 행동 분기 전수.

### 실제로 다른 것

| 위치 | 분기 | 통합 후 |
|---|---|---|
| `lib/providers/registry.ts:73` vs `94-101` | credentials 종류: `{kind:"oauth-proxy", envVars:["IMA2_GROK_PROXY_HOST","IMA2_GROK_PROXY_PORT"], configKey:"grokProvider"}` vs `{kind:"api-key", keyVocabulary:"xai", envVars:["XAI_API_KEY"], keyPrefix:"xai-", validateUrl:"https://api.x.ai/v1/models", configKey:"xaiApiKey"}` | **잔존**. `oauth-proxy` → `oauth`로 kind 변경, env는 무의미해짐 |
| `lib/providers/execution/admission.ts:14` | `grok-api`만 키 없으면 401 `GROK_API_KEY_MISSING` | grok도 대칭 검사 필요 (`GROK_OAUTH_MISSING`) |
| `routes/models.ts:178-184` | `grokApiLane`은 `ctx.xaiApiKey`만 보고, models/defaults는 `grokLane(ctx,"grok-api")` 재사용 | 두 lane 판정 로직이 대칭이 됨 |
| `lib/promptBuilder/router.ts:107-110` | `grok-api`만 사전 키 검사 | 대칭화 |
| `lib/agentPlannerModel.ts:78` | `input.settings.provider === "grok"`만 `requestGrokPlan` 경유. `grok-api`는 `requestResponsesPlan`으로 빠짐 | grok-api도 xAI로 보낼지 결정 필요 (별건) |
| `routes/videoExtended.ts:284,101` | extend는 `grok`/`grok-api` 모두 허용하나 edit/native/analyze 3개 라우트는 프록시 고정 | 통합으로 해소 |
| 다운로드 정책 | `grokOperations.ts:59-60`, `:92-93`, `grokMultimodeOperations.ts:102-103` — grok만 `trustedProxyOrigin` 부여 | **소멸**. 직결 URL은 항상 공개 https라 SSRF 예외가 불필요 |

### 사실상 동일한 것 (registry 메타데이터로 잔존)

`lib/providers/registry.ts:71-88` vs `92-115` 비교:

- `surfaces`: 양쪽 `["generate","edit","multimode","node","video"]` 동일
- `vendor`: 양쪽 `"xai"`
- `models`: 5개 항목 문자 단위 동일 (`grok-imagine-image-2.0`, `-image`, `-image-quality`, `grok-imagine-video`, `grok-imagine-video-1.5` + aliases)
- `referenceLimits`: 양쪽 `{ image: 5, edit: 5, video: 14 }`
- `elementTaxonomy`: 양쪽 `"grok"`
- `limits.timeoutMs`: 양쪽 `300_000`
- `errorPrefix`: 양쪽 `"GROK_"`

`grok-api` 쪽 주석이 이미 이 사실을 인정한다:

```ts
// lib/providers/registry.ts:109-112
    // Same upstream as the grok lane, reached with a direct key instead of the proxy, so
    // the caps are taken to match. The 5 was measured on the proxy path only; if an edit
    // fails at 4-5 images with a direct key, this assumption is the place to look.
    referenceLimits: { image: 5, edit: 5, video: 14 },
```

### 파이프라인의 `grok || grok-api` OR 조건 (통합 후에도 잔존, 축소 불가)

두 lane이 별도 provider id로 남는 한 아래는 그대로다. 실행 경로가 아니라 provider id 분류이기 때문이다.

- `lib/generatePipeline.ts:233,291,295,397,478,514,604`
- `lib/multimodePipeline.ts:48,280,302,305,308`
- `lib/nodeGeneration.ts:101,150,301,333`
- `routes/edit.ts:271,274,296`
- `lib/providers/execution/legacy.ts:9,14`
- `lib/providerOptions.ts:100-123` (두 블록이 provider 문자열만 다른 복제)
- `ui/src/lib/coreSelection.ts:73,137`

## 5. 401 처리 현황과 단일 refresh 훅 위치

### 현재: progrok가 투명하게 갱신하고, ima2는 401을 사실상 못 본다

progrok는 매 요청마다 `getValidBearer()`를 호출해 만료 2분 전이면 refresh 한다.

```js
// node_modules/progrok/dist/index.js:28
var TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1e3;

// :235-246
  if (tokens.expiresAt && Date.now() + TOKEN_REFRESH_SKEW_MS >= tokens.expiresAt) {
    if (!tokens.refreshToken || !tokens.tokenEndpoint) {
      throw new Error("Token expired and no refresh token available. Run `progrok login` again.");
    }
    log.dim("Refreshing access token...");
    const res = await fetch(tokens.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: XAI_OAUTH_CLIENT_ID, refresh_token: tokens.refreshToken }),
```

```js
// node_modules/progrok/dist/index.js:531-545
async function handleProxy(req, res) {
  const relPath = req.path.replace(/^\/v1/, "");
  let bearer;
  try {
    bearer = await getValidBearer();
  } catch (err) {
    res.status(401).json({ error: { message: err.message, type: "auth_error" } });
    return;
  }
  ...
  fwdHeaders["Authorization"] = `Bearer ${bearer}`;
```

즉 ima2가 401을 보는 경우는 refresh 자체가 실패했을 때뿐이고, 그때는 재시도해도 소용없다. 이것이 현재 재시도 술어가 401을 전혀 다루지 않는 이유다.

### `lib/grokUpstreamRetry.ts` 재시도 술어 전문

```ts
// lib/grokUpstreamRetry.ts:28-47
/** Gateway-class statuses. 507 is storage-class, not transient, and is excluded. */
export function isTransientUpstreamStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504
    || status === 520 || status === 521 || status === 522;
}

export function isConnectionResetError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Aborts and timeouts are caller decisions / honest failures — never retryable.
  if (err.name === "AbortError" || err.name === "TimeoutError") return false;
  const code = (err as { code?: unknown }).code;
  if (code === "ECONNRESET" || code === "EPIPE") return true;
  const cause = (err as { cause?: unknown }).cause;
  const causeCode = cause && typeof cause === "object" ? (cause as { code?: unknown }).code : undefined;
  if (causeCode === "ECONNRESET" || causeCode === "EPIPE") return true;
  const msg = err.message.toLowerCase();
  return msg.includes("socket connection was closed unexpectedly")
    || msg.includes("connection reset by peer")
    || msg.includes("socket hang up");
}
```

401은 어디에도 없다. `grokFetchWithRetry`(`:141-163`)는 `isTransientUpstreamStatus`만 보므로 401은 첫 응답 그대로 반환된다.

ima2의 401 취급은 두 군데다.

```ts
// lib/grokImageCore.ts:178
      if (res.status === 401 || res.status === 403) throw grokError(`Grok auth failed: ${msg}`, 502, "GROK_AUTH_FAILED");
// lib/grokImageCore.ts:90 (grokStageError)
  if (status === 401 || status === 403) return grokError(`${stage} auth failed: ${message}`, 502, "GROK_AUTH_FAILED");
```

비디오 쪽은 401 전용 매핑이 없다. `grokVideoPoll.ts:55`는 `res.status >= 500 ? 502 : res.status`로 401을 그대로 흘리고, `isRecoverablePollError`(`:29-36`)는 `status >= 500 || status === 429`만 회복 가능으로 보므로 401 poll은 즉시 치명 실패가 된다.

### 훅을 놓을 위치: `resolveGrokCredential` + `grokFetchWithRetry` 확장 2단

6곳 복제를 피하려면 두 층에 나눠 넣는 게 유일한 방법이다. 호출부는 `getGrokEndpoint`를 부르는 시점과 `fetch`를 부르는 시점이 분리돼 있어 한 층만으로는 커버가 안 된다.

**층 1 — 사전 갱신 (`lib/grokRuntime.ts`의 `resolveGrokCredential`)**

progrok의 `getValidBearer()`와 동일 규약. skew 2분, `~/.progrok/auth.json` 읽기 → 만료 임박 시 `https://auth.x.ai/oauth2/token`에 `grant_type=refresh_token` → 원자적 재기록. `routes/auth.ts:48-74`의 `saveGrokTokens`가 이미 temp+rename 원자 쓰기를 구현해 두었으므로 그대로 재사용한다. `routes/auth.ts:11-13`의 `GROK_CLIENT_ID` / `GROK_TOKEN_URL` 상수도 이미 존재한다.

```ts
// routes/auth.ts:11-13
const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const GROK_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const GROK_TOKEN_URL = "https://auth.x.ai/oauth2/token";
```

이 층만으로 정상 케이스 100%가 커버된다. 각 호출부는 `getGrokEndpoint` 직전에 `await resolveGrokCredential(ctx, provider)` 한 줄을 추가할 뿐이고, 진입점은 이미 좁다: `grokExecution.ts` 4곳, `routes/video.ts:543`, `videoExtendI2vOperation.ts:68`, `routes/videoExtended.ts` 3곳, `agentPlannerModel.ts:115`, `promptBuilder/router.ts:107`.

**층 2 — 사후 1회 재시도 (`lib/grokUpstreamRetry.ts`)**

시계 오차나 서버측 조기 무효화로 실제 401이 오는 경우 대비. `grokFetchWithRetry`에 `onUnauthorized?: () => Promise<GrokCredential | null>` 옵션을 추가하고, 401 수신 시 정확히 1회만 갱신 후 `doFetch` 재실행한다. `doFetch`가 이미 replayable 계약(`:139-140` "MUST be replayable")이므로 구조 변경이 없다.

단, `grokFetchWithRetry`를 쓰지 않는 두 호출은 별도 처리가 필요하다.

- `lib/grokImageCore.ts:150-193` `postGrokImages` — `:144-148` 주석이 명시적으로 재시도를 금지한다. 401은 이미지가 생성되기 전 거부이므로 과금 위험이 없어 **401 한정 재시도는 안전**하다. 이 예외를 주석에 명기해야 한다.
- `lib/grokVideoAdapter.ts:398-423` `startVideoRequest` — 동일 논리. `:401-403` 주석 참조.

**커버리지 확인:** image(`postGrokImages`) / video-start(`startVideoRequest`) / video-poll(`pollVideoOnce` → `grokFetchWithRetry`) / video-download(`downloadVideo` → 인증 불필요, 층 무관) / planner(`planGrokImage`, `searchGrokVisualContext`, `planGrokVideo`, `requestGrokPlan` → 전부 `grokFetchWithRetry` 또는 단순 fetch). video-download는 서명 URL을 헤더 없이 받으므로 401 훅 대상이 아니다 (`lib/grokVideoDownload.ts:150-153`, Authorization 미설정).

## 6. `routes/models.ts`의 grok 모델 목록 — registry-static

**live 호출 아님.** 토큰이 필요 없다.

```ts
// routes/models.ts:163-176
function grokLane(ctx: RuntimeContext, provider: "grok" | "grok-api" = "grok"): ModelLaneDto {
  const state = grokLaneState(ctx);
  return lane(state, {
    image: ctx.config.grokProvider.defaultImageModel,
    video: ctx.config.grokProvider.defaultVideoModel,
  }, {
    image: entries(provider, deriveModels(provider, "image")),
    video: entries(
      provider,
      [...deriveModels("grok", "video")].filter((model) => model !== "grok-imagine-video-1.5-preview"),
      videoCapabilities(),
    ),
  });
}
```

`deriveModels`는 `lib/providers/derive.js`에서 registry(`lib/providers/registry.ts:74-80`)를 읽는 순수 함수이고, defaults는 config(`config.ts:405,410`)에서 온다. 네트워크가 없다.

`grokApiLane`도 마찬가지로 `grokLane(ctx, "grok-api")`의 models를 그대로 재사용한다 (`routes/models.ts:182-183`).

grok에서 **유일하게 live인 모델 목록**은 `/api/grok/status`다.

```ts
// routes/grok.ts:13-23
      const r = await fetch(getGrokProxyUrl(ctx, "/v1/models"), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.ok) {
        const data: any = await r.json();
        const models: string[] = data?.data?.map((m: any) => m.id).filter(Boolean) || [];
        const hasImageModel = models.some((m: string) => m.startsWith("grok-imagine"));
```

여기는 현재 Authorization 헤더 없이 프록시에 붙어 progrok가 주입하는 방식이라, 직결 전환 시 **토큰이 필수**가 된다. 이 GET이 credential 유효성 프로브 역할까지 겸하게 되므로 §5의 401 훅이 여기에도 걸려야 한다. 참고로 registry의 `grok-api` credential에는 이미 동일 URL이 검증용으로 등록돼 있다 (`lib/providers/registry.ts:99` `validateUrl: "https://api.x.ai/v1/models"`).

## 7. 테스트 계약에 박힌 프록시 가정

diff 시 함께 깨지는 픽스처. 읽기만 했고 수정하지 않았다.

- `tests/_videoExecutionFixture.ts:97` — `assert.equal(call.headers.get("authorization"), "Bearer dummy")`
- `tests/videoRoute.test.ts:44`, `tests/videoExtendedRoute.test.ts:44`, `tests/video-download-cancellation.test.ts:48`, `tests/agent-mode-runtime-contract.test.ts:136` — 동일 단언
- `tests/grok-execution-parity.test.ts:79-80,252,259-260` — grok은 `http://grok-fixture.invalid` + `Bearer dummy`, grok-api는 `https://api.x.ai` + 실키. 통합 후 이 parity 테스트는 "두 lane이 동일 origin/상이 bearer"로 재작성 대상
- `tests/error-envelope-contract.test.ts:81,291` — `http://127.0.0.1:1` / `:9` 프록시 주소 가정
- `tests/models-endpoint-contract.test.ts:104,121,366-383` — `grokProxyState` 주입으로 lane 상태 검증
- `tests/prompt-builder-contract.test.ts:231,262` — grok-api는 이미 `https://api.x.ai/v1/chat/completions` 기대
- `tests/grok-proxy-supervisor-contract.test.ts`, `tests/grok-proxy-restart.test.ts`, `tests/grok-proxy-launcher.test.ts` — supervisor 삭제 시 통째로 제거 대상
- `tests/_executionRouteHarness.ts:164` — `grokUrl: "http://grok-fixture.invalid/v1"` 기본값

## 8. 변경 규모 정리

프록시 URL을 만드는 지점은 3개(`getGrokEndpoint`, `videoEndpoint`, `videoProxyUrl`)뿐이고 앞의 둘은 문자 단위로 동일하다. credential을 결정하는 분기는 `provider === "grok-api" ? ctx.xaiApiKey : undefined` 형태로 8곳에 복제돼 있다 (`grokExecution.ts` 27/59/84/96, `routes/video.ts:543`, `videoExtendI2vOperation.ts:68`, `promptBuilder/router.ts:107`, 그리고 인자 없이 프록시로 떨어지는 `agentPlannerModel.ts:115`). 이 8곳을 `resolveGrokCredential` 호출로 바꾸면 실행 경로 통합은 끝난다.

부수적으로 사라지는 것은 프록시 supervisor 전체(`grokProxyLauncher.ts` 325줄), `trustedProxyOrigin` SSRF 예외 3곳, `grokUrl`/`grokPort`/`grokActualPort`/`grokProxyLive`/`grokProxy` ctx 필드 5개, `routes/videoExtended.ts:69`의 세 번째 엔드포인트 복제본이다.

가장 주의할 지점은 `routes/videoExtended.ts`의 edit/extend-native/analyze 세 라우트다. 지금은 `directApiKey` 인자를 받는 통로조차 없어서 `grok-api` 사용자가 이 기능들을 쓰면 조용히 OAuth 프록시로 나간다. 통합은 이 잠재 버그를 자동으로 고치지만, 반대로 credential 배선을 빠뜨리면 세 라우트가 인증 없이 `api.x.ai`를 때리게 된다.


