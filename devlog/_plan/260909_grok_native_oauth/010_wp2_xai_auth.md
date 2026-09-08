---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, wp2, xaiAuth]
---

# 010 — wp2: `lib/xaiAuth.ts` 코어

브랜치 `codex/grok-native-oauth-02-xai-auth`, base `codex/grok-native-oauth-01-roadmap`.
이 레이어는 새 모듈과 그 계약 테스트만 추가한다. 프로덕션 호출자는 wp3에서 붙는다.
클래스 C3 (자격증명 보안 경계 → C4 수준 검증: negative case 필수).

## 파일 변경 지도

| 경로 | 종류 | 내용 |
|---|---|---|
| `lib/xaiAuth.ts` | NEW (~260줄) | 001 §6의 공개 API 그대로. leaf 모듈: `node:fs`, `node:crypto`, `node:os`, `node:path`만 import |
| `lib/errors/providerMap.ts` | MODIFY | `GROK_AUTH_REQUIRED`(401), `GROK_AUTH_REFRESH_FAILED`(502) 항목 추가. 기존 `GROK_AUTH_FAILED` 유지 |
| `routes/auth.ts` | MODIFY | `GROK_CLIENT_ID`/`GROK_SCOPE`/`GROK_TOKEN_URL` 로컬 상수 3개(:11-13)를 `lib/xaiAuth.ts` export로 교체. `saveGrokTokens`(:48-74) 본문을 `saveGrokCredentials` 호출로 교체(기존 `idToken` 보존 로직 포함) |
| `tests/xai-auth-contract.test.ts` | NEW | 아래 검증 표 |
| `docs/migration/runtime-test-inventory.md` | 생성물 | `node scripts/classify-tests.mjs` 재생성 |
| `structure/01-file-function-map.md` | 생성물 | `node scripts/refresh-structure-line-counts.mjs` + `lib/xaiAuth.ts` 행 수동 추가 |

## `lib/xaiAuth.ts` 상세

001 §6 시그니처를 따른다. 구현 규칙:

```ts
// 상수 — routes/auth.ts:11-13 과 vendor progrok dist/index.js:16-18, 28 과 동일 값
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
export const XAI_TOKEN_ENDPOINT_FALLBACK = "https://auth.x.ai/oauth2/token";
export const XAI_TOKEN_REFRESH_SKEW_MS = 120_000;
export const XAI_TOKEN_REQUEST_TIMEOUT_MS = 30_000;
const XAI_TRUSTED_AUTH_HOSTS = new Set(["auth.x.ai", "accounts.x.ai"]);   // 001 D6
const FLIGHT_STALE_MS = 120_000;
const TERMINAL_FAILURE_TTL_MS = 30_000;
const TERMINAL_OAUTH_ERRORS = new Set(["invalid_grant", "refresh_token_reused", "revoked_token"]);
```

파일 I/O:

```ts
export function grokAuthFilePath(homeDir = homedir()) { return join(homeDir, ".progrok", "auth.json"); }

export function loadGrokCredentials(homeDir?: string): GrokCredentials | null {
  // readFileSync + JSON.parse; 실패 시 null. accessToken이 문자열이 아니면 null.
  // 알 수 없는 키는 보존하기 위해 파싱 결과를 GrokCredentials & Record<string, unknown> 로 유지.
}

export function saveGrokCredentials(creds: GrokCredentials, homeDir?: string): void {
  // routes/auth.ts:48-74 패턴을 그대로 옮긴다:
  // mkdirSync(dir, { recursive: true, mode: 0o700 })
  // tmp = join(dir, `auth.json.tmp-${randomBytes(6).toString("hex")}`)
  // writeFileSync(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 }); renameSync(tmp, target)
}
```

토큰 요청 (`postXaiToken`) — OpenCodex xai.ts:100-115를 풀어 쓰되 D1~D4를 수정:

```ts
function retryDelayMs(attempt: number, retryAfter: string | null, random: () => number): number {
  const fromHeader = parseRetryAfterMs(retryAfter);       // D2: 정수초 + HTTP-date + 소수초
  if (fromHeader !== undefined) return Math.min(fromHeader, 60_000);   // D1: 서버 지시 우선, 절대 상한 60s
  const base = attempt === 1 ? 100 : 250;
  return Math.round(base * (0.75 + random() * 0.5));
}
// 루프: attempt 1..3. signal?.aborted 면 즉시 throw (D3). TimeoutError 는 재시도 안 함.
// 429 또는 >=500 만 재시도. 소진 시 XaiTokenRequestError(..., { cause: last }) (D4).
// 실패 응답 body 는 text() 로 소비하거나 body?.cancel() (D9).
```

refresh와 single-flight:

```ts
export async function refreshXaiToken(refreshToken, opts): Promise<GrokCredentials> {
  const tokenEndpoint = validateXaiAuthEndpoint(opts?.tokenEndpoint ?? (await discoverXaiOAuthEndpoints(opts?.signal)).tokenEndpoint);
  const payload = await postXaiToken(tokenEndpoint, { grant_type: "refresh_token", client_id: XAI_OAUTH_CLIENT_ID, refresh_token: refreshToken }, opts?.signal, opts?.deps);
  // expiresAt = typeof expires_in === "number" ? now + expires_in*1000 : undefined  (R3, D5: 3600 폴백 없음)
  // refreshToken = payload.refresh_token || refreshToken  (rotation 폴백)
}

export async function getGrokAccessToken(opts = {}): Promise<string> {
  if (Date.now() < terminalFailureUntil) throw new GrokAuthError("GROK_AUTH_REQUIRED", ...);
  const stored = loadGrokCredentials(opts.homeDir);
  if (!stored) throw new GrokAuthError("GROK_AUTH_REQUIRED", "Grok login required. Run ima2 grok login.");
  if (opts.rejectedAccessToken && stored.accessToken !== opts.rejectedAccessToken) return stored.accessToken; // 세대 확인
  const expiring = stored.expiresAt !== undefined && Date.now() + XAI_TOKEN_REFRESH_SKEW_MS >= stored.expiresAt;
  if (!opts.forceRefresh && !expiring) return stored.accessToken;
  if (!stored.refreshToken) throw new GrokAuthError("GROK_AUTH_REQUIRED", "Grok session expired and cannot be refreshed.");
  return (await runRefreshFlight(stored, opts)).accessToken;
}
// runRefreshFlight: 진행 중 비행이 FLIGHT_STALE_MS 이내면 join. finally 에서 자기 자신일 때만 해제.
// terminal oauthError → terminalFailureUntil = now + TTL, GROK_AUTH_REQUIRED. 그 외 → GROK_AUTH_REFRESH_FAILED.
// 성공 시 saveGrokCredentials({ ...stored, ...fresh })  — stored 의 idToken/email/accountId 보존.
```

`GrokAuthError`는 `lib/errors/classes.ts`의 기존 클래스 계층을 따르되, leaf 제약 때문에
`lib/xaiAuth.ts` 안에서 `Error`를 직접 확장하고 `code`/`status`를 갖는다
(`lib/grokImageCore.ts:78` `grokError`와 같은 shape이라 기존 라우트 에러 봉투가 그대로 처리).

## `routes/auth.ts` diff

```diff
-const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
-const GROK_SCOPE = "openid profile email offline_access grok-cli:access api:access";
-const GROK_TOKEN_URL = "https://auth.x.ai/oauth2/token";
+import { XAI_OAUTH_CLIENT_ID as GROK_CLIENT_ID, XAI_OAUTH_SCOPE as GROK_SCOPE,
+  XAI_TOKEN_ENDPOINT_FALLBACK as GROK_TOKEN_URL, saveGrokCredentials, loadGrokCredentials } from "../lib/xaiAuth.js";
```

`saveGrokTokens`(:48-74)는 email 추출만 남기고 쓰기를 `saveGrokCredentials({ ...(loadGrokCredentials() ?? {}), accessToken, refreshToken, expiresAt, tokenEndpoint, idToken: tokens.id_token, email })`로 교체. 동작 동일, 파일 형식 동일(2칸 들여쓰기, 0600).

## 검증 (C 게이트)

`tests/xai-auth-contract.test.ts` — 격리 HOME(`mkdtemp`)과 `globalThis.fetch` 스텁으로 네트워크 없이 실행.

| 시나리오 | 기대 | 활성화 방법 |
|---|---|---|
| 파일 없음 | `GROK_AUTH_REQUIRED`, fetch 호출 0 | 빈 HOME |
| 유효 토큰 (expiresAt 미래) | 저장된 accessToken 반환, fetch 0 | expiresAt = now + 1h |
| 만료 임박 (now+60s) | refresh 1회, 새 토큰 반환, 파일 갱신, 0600 유지 | expiresAt = now + 60s, fetch 스텁이 새 access_token 반환 |
| expiresAt 없음 | refresh 없이 반환 | 필드 삭제 |
| 동시 12건 만료 임박 | fetch 호출 정확히 1 | `Promise.all(12 × getGrokAccessToken())` |
| refresh_token rotation 없음 | 기존 refreshToken 보존 | 응답에 refresh_token 없음 |
| idToken 보존 | 갱신 후 파일에 idToken 남음 | 초기 파일에 idToken 포함 |
| invalid_grant | `GROK_AUTH_REQUIRED`, 파일 삭제 안 됨, 30s 내 재호출은 fetch 0 | 스텁 400 `{error:"invalid_grant"}` |
| 503 ×3 | `GROK_AUTH_REFRESH_FAILED`, 3회 시도 | 스텁 503, deps.sleep 즉시 |
| 429 + Retry-After: 5 | 두 번째 시도 전 sleep(5000) | deps.sleep 캡처 |
| 429 + Retry-After HTTP-date | Date.parse 결과 사용 | D2 |
| 커스텀 abort reason | 재시도 없이 그 reason throw | `controller.abort(new Error("x"))` |
| rejectedAccessToken ≠ 저장값 | refresh 없이 저장값 반환 | 세대 확인 |
| discovery가 `https://evil.x.ai/token` 반환 | throw (D6) | 스텁 discovery |
| tmp 파일 잔존 없음 | 디렉터리에 `auth.json`만 | 갱신 후 readdir |

명령: `node --experimental-strip-types --test tests/xai-auth-contract.test.ts`
(PLAN-VERIFIER-REAL-01: 이 명령은 새 파일을 직접 인자로 읽는다).
전체: `npm run typecheck && npm run typecheck:tests && npm test && npm run test:inventory`.

## 우회 경로 (PLAN-BYPASS-NAMED-01)

이 레이어에 새 enforcement는 없다. 0600은 파일시스템 계층의 조기 경고이며, 다른 프로세스(progrok 잔존 시)가
같은 파일을 0644로 다시 쓰면 무효화된다. 최종 계층: 없음.
