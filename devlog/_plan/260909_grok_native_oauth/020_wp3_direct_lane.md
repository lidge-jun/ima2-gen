---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, wp3, direct-lane]
---

# 020 — wp3: grok 레인 직접 호출 전환

브랜치 `codex/grok-native-oauth-03-direct-lane`, base `codex/grok-native-oauth-02-xai-auth`.
이 레이어가 끝나면 `grok` 레인의 모든 요청이 `https://api.x.ai`로 직접 나간다. 프록시
슈퍼바이저와 `getGrokProxyUrl`은 파일로는 남되 프로덕션 호출자가 0이 된다(삭제는 wp4).
클래스 C3.

## 핵심 설계 (002 §2, §5 채택)

`lib/grokRuntime.ts`를 재작성해 세 가지를 소유한다.

```ts
// lib/grokRuntime.ts (재작성, ~90줄). leaf: lib/xaiAuth.js 만 import.
export type GrokCredential = { kind: "api-key"; key: string } | { kind: "oauth"; token: string };

export function getGrokDirectBaseUrl(): string { return "https://api.x.ai"; }   // 유일한 상수원

export function grokAuthHeaders(c: GrokCredential): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${c.kind === "api-key" ? c.key : c.token}` };
}

/** 유일한 credential 해석 지점. */
export async function resolveGrokCredential(ctx: RouteRuntimeContext, provider: "grok" | "grok-api",
  opts?: { forceRefresh?: boolean; rejectedAccessToken?: string; signal?: AbortSignal }): Promise<GrokCredential> {
  if (provider === "grok-api") {
    const key = typeof ctx.xaiApiKey === "string" ? ctx.xaiApiKey.trim() : "";
    if (!key) throw grokCredentialError("GROK_API_KEY_MISSING", 401, "Grok API key is required for grok-api");
    return { kind: "api-key", key };
  }
  return { kind: "oauth", token: await getGrokAccessToken(opts) };   // GrokAuthError 그대로 전파
}

export function getGrokEndpoint(path: string, credential: GrokCredential) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return { url: `${getGrokDirectBaseUrl()}${normalizedPath}`, headers: grokAuthHeaders(credential) };
}

/**
 * 401 을 정확히 1회 refresh 후 재시도. grokFetchWithRetry 는 헤더를 다시 만들 수 없으므로 여기서만 처리(R6).
 * doFetch 는 credential 을 받아 요청을 만든다. 이미지/비디오 시작처럼 재시도 금지 호출도 401 은 생성 전 거부라 안전.
 */
export async function fetchWithGrokAuth<R extends { status: number }>(
  ctx: RouteRuntimeContext, provider: "grok" | "grok-api",
  doFetch: (credential: GrokCredential) => Promise<R>, opts?: { signal?: AbortSignal },
): Promise<R> {
  const first = await resolveGrokCredential(ctx, provider, opts);
  const res = await doFetch(first);
  if (res.status !== 401 || first.kind !== "oauth") return res;
  const second = await resolveGrokCredential(ctx, provider, { ...opts, forceRefresh: true, rejectedAccessToken: first.token });
  return doFetch(second);
}
```

`RouteRuntimeContext`에 `grokAuthHomeDir?: string`을 추가해 테스트가 격리 HOME을 주입한다
(`resolveGrokCredential`이 `getGrokAccessToken({ homeDir: ctx.grokAuthHomeDir })`로 전달).

## 파일 변경 지도

| 경로 | 종류 | 변경 |
|---|---|---|
| `lib/grokRuntime.ts` | REWRITE | 위 코드. `getGrokProxyBaseUrl`/`getGrokProxyUrl`은 **wp4까지 남긴다**(routes/grok.ts 옛 코드 컴파일용) — 단 deprecated 주석 |
| `lib/grokImageCore.ts:62-74` | MODIFY | `getGrokEndpoint(ctx, path, directApiKey?)` 삭제 → `grokRuntime`의 것을 re-export. `postGrokImages(ctx, payload, signal, path, credential: GrokCredential)` 시그니처 변경. 내부 fetch를 `fetchWithGrokAuth`로 감싸지 않고 credential을 받는 형태로 유지(재시도 정책은 호출자 소유) |
| `lib/grokImageCore.ts:171-181` | MODIFY | 401/403 → `GROK_AUTH_FAILED` 매핑은 유지. `GrokAuthError`가 상위에서 던져지면 그 code 유지 |
| `lib/grokVideoShared.ts:113-125` | MODIFY | `videoEndpoint` 본문 삭제 → `export { getGrokEndpoint as videoEndpoint } from "./grokRuntime.js"`. `GrokVideoOptions.directApiKey`(:59) → `credential: GrokCredential` |
| `lib/grokImagePlanner.ts:207,283` | MODIFY | `directApiKey?: string` → `credential: GrokCredential`; :212, :310 호출 갱신 |
| `lib/providers/adapters/grokOperations.ts:28,52,58-61,79,86,91-94` | MODIFY | 옵션 필드 교체; `trustedProxyOrigin` 3곳 제거(직결 URL은 공개 https) |
| `lib/providers/adapters/grokMultimodeOperations.ts:48,98,101-104` | MODIFY | 동일 |
| `lib/providers/adapters/grokExecution.ts:27,59,84,96` | MODIFY | `const grokDirectApiKey = activeProvider === "grok-api" ? ctx.xaiApiKey : undefined` → `const credential = await resolveGrokCredential(ctx, activeProvider, { signal })`. 4곳 |
| `lib/grokVideoAdapter.ts:247,282,398` | MODIFY | `options.directApiKey` → `options.credential` |
| `lib/grokVideoPoll.ts:42,45,91` | MODIFY | 동일 |
| `routes/video.ts:543,558` | MODIFY | `provider === "grok-api" ? ctx.xaiApiKey : undefined` → `await resolveGrokCredential(ctx, provider)` |
| `lib/videoExtendI2vOperation.ts:68` | MODIFY | 동일 |
| `routes/videoExtended.ts:69-70,206,341,435` | MODIFY | `videoProxyUrl` 삭제. 세 라우트가 `fetchWithGrokAuth(ctx, provider, (c) => fetch(getGrokEndpoint(path, c).url, ...))` 사용. **provider는 요청 body에서 읽되 기본 "grok"** (지금은 grok-api 사용자도 프록시로 새던 잠재 버그를 함께 고침) |
| `lib/agentPlannerModel.ts:115` | MODIFY | `getGrokEndpoint(ctx, "/v1/chat/completions")` → `fetchWithGrokAuth(ctx, "grok", ...)` |
| `lib/promptBuilder/router.ts:107-112` | MODIFY | `resolveGrokCredential(ctx, backend)`로 통일; grok도 자격증명 없으면 `unavailableBackendError("grok")` |
| `routes/grok.ts` | REWRITE | probe token 제거. `fetchWithGrokAuth(ctx, "grok", (c) => fetch(getGrokEndpoint("/v1/models", c).url, {headers, signal}))`. `GrokAuthError.code === "GROK_AUTH_REQUIRED"` → `{status:"offline", reason:"login_required"}`, `GROK_AUTH_REFRESH_FAILED` → `{status:"error", reason}`. 응답 리터럴 4종 유지(R8) |
| `lib/providers/execution/admission.ts:13-17` | MODIFY | `directKeyFailure`를 양 레인 대칭으로: grok은 `loadGrokCredentials()` null이면 `{status:401, code:"GROK_AUTH_REQUIRED"}` |
| `lib/errors/providerMap.ts` | MODIFY | (wp2에서 추가한 두 코드가 여기서 실제 사용) |
| `lib/runtimeContext.ts` | MODIFY | `grokAuthHomeDir?: string` 추가만. 프록시 필드 삭제는 wp4 |

## 테스트 변경

| 파일 | 변경 |
|---|---|
| `tests/_executionRouteHarness.ts:164` | `grokUrl` 픽스처 대신 격리 HOME + `auth.json` 작성 헬퍼 `seedGrokAuth(home, {accessToken, expiresAt})` 추가; `ctx.grokAuthHomeDir` 주입 |
| `tests/_videoExecutionFixture.ts:97` 외 `Bearer dummy` 단정 5곳 | `Bearer <seeded token>` 으로 교체 |
| `tests/grok-execution-parity.test.ts:79-80,252,259-260` | grok/grok-api 모두 origin `https://api.x.ai`, bearer만 다름으로 재작성 |
| `tests/error-envelope-contract.test.ts:81,291` | 프록시 주소 픽스처 → fetch 스텁이 401/503 반환 |
| `tests/models-endpoint-contract.test.ts:104,121,366-383` | `grokProxyState` 주입 케이스는 wp4에서 재작성; 이 레이어에서는 그대로 통과해야 함(grokLaneState 미변경) |
| `tests/grok-direct-lane-contract.test.ts` | NEW: (a) 만료 토큰 → 사전 refresh 후 요청 헤더에 새 토큰, (b) 유효 토큰인데 upstream 401 → refresh 1회 + 재요청 1회, 두 번째 401은 `GROK_AUTH_REQUIRED`, (c) grok-api 는 401이어도 refresh 없음, (d) videoExtended 세 라우트가 Authorization 헤더를 실제로 싣는지 |

## 검증

`npm run typecheck && npm run typecheck:tests && npm test` 전체. 추가로
`node --experimental-strip-types --test tests/grok-direct-lane-contract.test.ts tests/grok-execution-parity.test.ts`.
활성화 근거(C-ACTIVATION-GROUNDING-01): (b)는 fetch 스텁이 첫 호출에 401, 둘째에 200을 반환해 재시도 분기를 실제로 태운다.

라이브 증거(선택, 과금 없음): 격리 HOME에 실제 `~/.progrok/auth.json`을 복사한 뒤 `GET /api/grok/status`가 `ready`와 모델 목록을 반환하는지. `expiresAt`을 과거로 조작해 로그에 refresh 1회가 찍히는지.

## 우회 경로

`resolveGrokCredential`은 어댑터 입구의 조기 경고다. `getGrokEndpoint`를 직접 import해 credential을 임의로 만들면 우회 가능. 최종 계층: 없음(xAI 서버의 401).
