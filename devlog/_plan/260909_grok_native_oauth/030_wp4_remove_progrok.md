---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, progrok, wp4, removal]
---

# 030 — wp4: progrok 슈퍼바이저·의존성 제거, 네이티브 CLI, readiness 재정의

브랜치 `codex/grok-native-oauth-04-remove-progrok`, base `codex/grok-native-oauth-03-direct-lane`.
클래스 C4(의존성 제거 + 릴리스 표면 + 패키징). 003_removal_blast_radius.md가 근거.

## 삭제

| 경로 | 근거 |
|---|---|
| `lib/grokProxyLauncher.ts` | 003 §1-1. import는 `server.ts:18`, `lib/runtimeContext.ts:4`뿐 |
| `vendor/progrok-0.2.0.tgz` | 003 §1-14 |
| `tests/grok-proxy-supervisor-contract.test.ts`, `grok-proxy-restart.test.ts`, `grok-proxy-launcher.test.ts`, `grok-command-login-contract.test.ts` | 003 §2-1 |
| `tests/grok-advertise-liveness-contract.test.ts` | `backend` 계약(42-50)은 새 `tests/advertise-payload-contract.test.ts`로 이동 |
| `scripts/paired-generated-paths.txt:9` | `lib/grokProxyLauncher.js` 행 |

## 수정

`lib/grokRuntime.ts`: `getGrokProxyBaseUrl`/`getGrokProxyUrl`과 `DEFAULT_GROK_PROXY_*` 삭제. wp3 이후 호출자 0 확인 후.

`server.ts` (003 §1-3):

```diff
-import { startGrokProxy } from "./lib/grokProxyLauncher.js";
 ...
-  markGrokProxyPort: (info?: { url?: string; port?: number }) => void;
 ...
-  const grokPort = config.grokProvider.proxyPort;
 ...
-    grokPort,
-    grokActualPort: grokPort,
-    grokUrl: `http://${config.grokProvider.proxyHost}:${grokPort}/v1`,
 ...
-    markGrokProxyPort: ({ url, port } = {}) => { ... },
 ...
-  const grokChild = ctx.config.grokProvider.autoStart ? await startGrokProxy({ ... }) : null;
-  ctx.grokProxy = grokChild ?? undefined;
 ...
-  try { grokChild?.stop?.(); } catch {}
-  try { grokChild?.kill?.(); } catch {}
 ...
-  console.log(`Provider policy: ... Grok proxy port ${ctx.grokActualPort || ctx.grokPort}.`);
+  console.log(`Provider policy: GPT OAuth, API-key Responses, and Grok (xAI OAuth or API key) providers. GPT OAuth proxy port ${ctx.oauthPort}.`);
```

`buildAdvertisePayload`(`server.ts:306-333`) — R9:

```diff
-  const grokLive = ctx.grokProxyLive === true;
 ...
-    grok: { configuredPort, actualPort, url, live: grokLive },
+    grok: { auth: loadGrokCredentials() ? "oauth" : "none" },
```

`bin/commands/service.ts:139-151`: `grok.live === false` 경고 → `grok.auth === "none"`이면 "Grok is not logged in. Run ima2 grok login." 안내.

`lib/runtimeContext.ts`: `grokActualPort`/`grokPort`/`grokUrl`/`grokProxy`/`grokProxyLive` 필드(:22-28), `GrokProxyHandle` import(:4), `requireRuntimeContext` 기본값(:116-124), `createTestRuntimeContext`(:197-199), 주석(:16-19) 정리.

`config.ts:378-387`: `proxyPort`/`proxyHost`/`autoStart`/`restartDelayMs`/`restartMaxAttempts`/`restartMaxDelayMs`/`restartHealthyMs` 7키 삭제. `IMA2_NO_GROK_PROXY`, `IMA2_GROK_PROXY_*`, `IMA2_GROK_RESTART_*` env는 읽지 않게 됨(문서에 deprecated 표기는 wp5).

`lib/providers/registry.ts:73`: `{ kind: "oauth-proxy", envVars: [...], configKey: "grokProvider" }` → `{ kind: "oauth", authFile: "~/.progrok/auth.json" }`. `lib/providers/types.ts`의 credential union에 `kind: "oauth"` 추가. `node scripts/generate-provider-types.mjs` 재생성.

`routes/models.ts:130,140-161` `grokLaneState`:

```ts
function grokLaneState(): LaneState {
  const creds = loadGrokCredentials();
  if (!creds) return { status: "disconnected", reason: "Grok login required" };
  if (creds.expiresAt !== undefined && Date.now() >= creds.expiresAt && !creds.refreshToken)
    return { status: "disconnected", reason: "Grok session expired" };
  return { status: "ready" };
}
```
`UNPROBED_GROK_REASON` 삭제.

`routes/health.ts:20-24`: `grok: { configuredPort, actualPort, url }` → `grok: { auth: "oauth" | "none" }`.

`routes/auth.ts:258`: `startGrokDeviceCode(() => ctx?.grokProxy?.notifyCredentialsChanged())` → `startGrokDeviceCode()`; 콜백 파라미터 제거.

`routes/quota.ts:118-127`: 경로 상수는 `grokAuthFilePath()`로, 라벨 `progrok:auth-json` → `ima2:grok-auth-json`.

`bin/lib/doctor-runtime.ts:7`: `"progrok/package.json"` 제거. `bin/lib/doctor-providers.ts:49-55`: 경로를 `grokAuthFilePath()`로, 문구 "no ~/.progrok or ~/.grok auth file" 유지(경로 자체는 안 바뀜).

`bin/commands/grok.ts` REWRITE (R11): progrok spawn 제거. 서브커맨드:
- `login [--device-code]`: 서버가 떠 있으면 `POST /api/auth/switch {provider:"grok"}` 후 폴링(기존 GUI 경로 재사용); 서버가 없으면 `routes/auth.ts`의 device-code 로직을 `lib/xaiDeviceLogin.ts`로 추출해 직접 실행. 이 추출은 이 WP의 부수 리팩터(routes/auth.ts:79-141 → lib).
- `status`: `loadGrokCredentials()` 요약(email, expiresAt 상대시간, refresh 가능 여부) + `--probe`면 `/v1/models` 호출.
- `logout`: `clearGrokCredentials()`.
- `models`/`proxy` 제거. HELP 갱신.

`package.json`: `dependencies.progrok`(:102), `bundleDependencies`의 `"progrok"`(:112) 삭제 → `npm install --package-lock-only`로 lock 재생성(`check-install-policy.mjs:67-71` 게이트).

`nix/node-modules.nix:21,29-30` progrok 참조 삭제, `flake.nix:18`·`Dockerfile:12` 주석 갱신, `scripts/qa-grok-video.mjs:11,181` 문구 갱신.

`.github/workflows/ci.yml:108-109` "CLI smoke (grok --help)" → `node bin/ima2.js grok status --json`(로그인 없어도 exit 0으로 `{auth:"none"}` 출력하도록 설계). `provider-canary.yml:34-35` `CANARY_GROK_MODELS_URL`/`CANARY_GROK_TOKEN`은 그대로 두되 canary 스크립트가 URL 기본값을 `https://api.x.ai/v1/models`로 쓰는지 확인.

`tests/package-install-smoke.mjs:141,154,184,218,223,238-239`: progrok bin/help 단정 삭제, `ima2 grok status` 단정으로 교체. `tests/release-pipeline-contract.test.ts:215,218` 픽스처 `["openai-oauth"]`. `tests/cli-commands.test.js:357-365` 새 HELP 문구. `tests/models-endpoint-contract.test.ts` `grokProxyState` 케이스 → 격리 HOME auth.json 유무 케이스. `tests/runtime-context-normalize.test.ts:25,62-65`, `tests/agent-mode-runtime-contract.test.ts:101,135,514,603`, `tests/e2e-app-environment.test.ts:36-39,66`, `tests/j6-isolation-preflight.test.mjs:99,222`, `tests/history-tombstone.test.ts:69`, `ui/e2e/fixtures/appIsolation.ts:32-33`, `ui/e2e/fixtures/appServer.ts:79,138-139,318`, `ui/e2e/fixture-isolation.spec.ts:34`: `IMA2_NO_GROK_PROXY`/포트 픽스처 제거.

## 생성물 게이트 (반드시 순서대로)

1. `node scripts/generate-provider-types.mjs`
2. `node scripts/classify-tests.mjs` (docs/migration/runtime-test-inventory.md)
3. `node scripts/refresh-structure-line-counts.mjs` + `structure/01-file-function-map.md`의 삭제 파일 행 수동 제거(:292 grokProxyLauncher, :137 grok.ts 설명 갱신, :68)
4. `npm install --package-lock-only` → `npm run test:install-policy`

## 검증

로컬: `npm run typecheck && npm run typecheck:tests && npm test && npm run test:inventory && npm run lint:pkg && npm run test:package-install`.
`rg -n progrok lib routes bin server.ts config.ts package.json` → `lib/xaiAuth.ts`의 경로 상수 주석만.
격리 HOME 부팅: `HOME=$TMP node --import tsx server.ts` → `/api/health` `grok.auth === "none"`; auth.json 복사 후 재기동 → `"oauth"`; `GET /api/grok/status` → ready.
호스팅: PR CI(pr-fast) 후행 추적 + **`gh workflow run ci.yml -f sha=<head>`** 로 package smoke·Windows 레인까지 확인(003 §5-2).

## 우회 경로

없음(제거 작업). 잔존 위험은 외부 도구가 `~/.ima2/server.json`의 `grok.url`을 읽던 경우 — 003 §1-4 기준 그런 소비자는 저장소 안에 없다.
