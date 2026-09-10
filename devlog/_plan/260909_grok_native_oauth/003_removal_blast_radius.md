---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, progrok, removal, blast-radius, research]
---

# 003 — progrok 제거 blast-radius 인벤토리 (opus-5 explorer, 2026-09-09)

읽기 전용 조사 결과를 그대로 보존한다. 첫머리의 "핵심 판정"에 대한 답은
000_plan.md에 있다: grok 레인은 폐기하지 않고 (b) 직접 호출로 재배선한다.

# progrok 제거 blast-radius 인벤토리

조사 기준: `/Users/jun/.codex/worktrees/6563/ima2-gen`, `dev` @ `11900764` (v3.15.1). 읽기 전용, 편집·커밋·빌드 없음.

**핵심 판정 먼저**: `lib/grokRuntime.ts`는 삭제 대상이 아니다. 프록시 감독자(`grokProxyLauncher`)와 별개로 `grok` lane의 **모든 이미지/비디오 실행 경로**가 `getGrokProxyUrl()`로 엔드포인트를 만든다. progrok을 없애면 `grok` lane 자체가 죽고 `grok-api`(직접 키)만 남는다. 이게 이 인벤토리에서 가장 큰 정책 분기이며 wp4 착수 전에 확정되어야 한다.

## 1. 프로덕션 코드

### 1-1. lib/grokProxyLauncher.ts — 전체 삭제 (325줄)

전량 progrok 자식 프로세스 감독자다. 외부에 노출되는 심볼 5개:

```ts
// lib/grokProxyLauncher.ts:43-50, 63-74, 80-86, 95-104, 110
export type GrokProxyState = "stopped" | "gave-up-retryable" | "starting" | "ready" | "waiting-for-login" | "backoff" | "gave-up";
export type GrokProbeToken = { readonly gen: number };
export interface GrokProxyHandle { ... }
export function restartPlan(attempt, opts): { delayMs; giveUp }
export function isGrokProxyAuthRequiredMessage(line): boolean
export function normalizeGrokProxyMessage(line): string
export async function startGrokProxy(options): Promise<GrokProxyHandle>
```

실제 spawn 지점 (`lib/grokProxyLauncher.ts:176-182`):

```ts
const progrokBin = options.progrokBinPath ?? join(localBinPath(), isWin ? "progrok.cmd" : "progrok");
const child = spawn(progrokBin, ["proxy", "--host", host, "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"], shell: isWin, windowsHide: true, env: process.env,
});
```

`localBinPath()`는 `node_modules/.bin` (`lib/grokProxyLauncher.ts:106-108`) — 즉 번들 의존성 `progrok`의 bin shim에 직접 의존한다.

**import하는 곳은 `server.ts:18`과 `lib/runtimeContext.ts:4` 둘뿐** (테스트 제외). 소비자 그래프가 좁아서 삭제 자체는 깨끗하다.

### 1-2. lib/grokRuntime.ts — 삭제 아님, 축소/재작성 (27줄)

```ts
// lib/grokRuntime.ts:3-4, 10-18
const DEFAULT_GROK_PROXY_HOST = "127.0.0.1";
const DEFAULT_GROK_PROXY_PORT = 18645;

export function getGrokProxyBaseUrl(ctx: RouteRuntimeContext = {}): string {
  const grokCfg = (ctx.config as any)?.grokProvider || {};
  const explicitUrl = (ctx as { grokUrl?: string }).grokUrl;
  if (explicitUrl) return normalizeBaseUrl(explicitUrl);
  const host = grokCfg.proxyHost || DEFAULT_GROK_PROXY_HOST;
  const port = (ctx as { grokActualPort?: number }).grokActualPort || grokCfg.proxyPort || DEFAULT_GROK_PROXY_PORT;
  return `http://${host}:${port}`;
}
```

소비자 7곳이 프로덕션 실행 경로다:

| 소비자 | 라인 | 역할 |
|---|---|---|
| `lib/grokImageCore.ts` | 4, 71 | `getGrokEndpoint()` 프록시 분기 |
| `lib/grokVideoShared.ts` | 13, 122 | `videoEndpoint()` 프록시 분기 |
| `routes/videoExtended.ts` | 7, 70 | 영상 연장 엔드포인트 |
| `routes/grok.ts` | 3, 13, 22 | `/api/grok/status` 프로브 |
| `lib/providers/adapters/grokOperations.ts` | 5, 60, 93 | 어댑터 origin |
| `lib/providers/adapters/grokMultimodeOperations.ts` | 11, 103 | 멀티모드 origin |

`getGrokDirectBaseUrl()` (`lib/grokRuntime.ts:25-27`)는 `https://api.x.ai`를 반환하며 progrok과 무관하다 — 유지.

프록시/직접 분기 구조는 이미 `directApiKey` 인자로 되어 있다 (`lib/grokImageCore.ts:62-73`):

```ts
export function getGrokEndpoint(ctx, path = "/v1/images/generations", directApiKey?: string) {
  if (directApiKey) {
    return { url: `https://api.x.ai${normalizedPath}`, headers: { ..., Authorization: `Bearer ${directApiKey}` } };
  }
  return { url: getGrokProxyUrl(ctx, path), headers: { ..., Authorization: "Bearer dummy" } };
}
```

`videoEndpoint()`도 동일 구조 (`lib/grokVideoShared.ts:113-125`). 즉 **wp4의 실질 작업은 `directApiKey` 없는 경로를 어떻게 처리하느냐**다. 선택지는 두 개뿐이고, wp4 diff 규모가 여기서 갈린다.

- (a) `grok` lane 폐기 → `grok-api`만 유지. `lib/providers/registry.ts:70-88`의 lane 정의, `routes/models.ts:327` 등록, 프로바이더 enum 파생 전부 연쇄.
- (b) `grok` lane을 직접 호출로 재배선 → `getGrokProxyUrl` 호출부 6개를 `api.x.ai` + 키 해석으로 치환, `grokRuntime.ts`는 `getGrokDirectBaseUrl`만 남기고 축소.

### 1-3. server.ts — 부분 수정 (612줄)

`rg -n 'startGrokProxy|grokChild|grokProxy|markGrokProxyPort|grokProxyLive|advertise'` 결과별 처리:

**삭제할 블록 — 감독자 부팅 (`server.ts:491-515`)**

```ts
const grokChild = ctx.config.grokProvider.autoStart
  ? await startGrokProxy({
      host: ctx.config.grokProvider.proxyHost,
      port: ctx.config.grokProvider.proxyPort,
      restartDelayMs: ctx.config.grokProvider.restartDelayMs,
      onPortSelected: ({ url, port }) => {
        ctx.markGrokProxyPort({ url, port });
        ctx.grokProxyLive = false;   // Port selection is an intent to bind, not a successful bind.
        advertise(ctx);
      },
      onReady: ({ url, port }) => { ctx.markGrokProxyPort({ url, port }); ctx.grokProxyLive = true; advertise(ctx); },
      onExit: () => { ctx.grokProxyLive = false; advertise(ctx); },
    })
  : null;
ctx.grokProxy = grokChild ?? undefined;
```

**삭제 — import (`server.ts:18`)**, **타입 (`server.ts:46`)**:

```ts
import { startGrokProxy } from "./lib/grokProxyLauncher.js";
markGrokProxyPort: (info?: { url?: string; port?: number }) => void;
```

**삭제 — 부트 컨텍스트 필드 (`server.ts:390`, `401-403`)**:

```ts
const grokPort = config.grokProvider.proxyPort;
grokPort,
grokActualPort: grokPort,
grokUrl: `http://${config.grokProvider.proxyHost}:${grokPort}/v1`,
```

**삭제 — 마커 (`server.ts:435-439`)**:

```ts
markGrokProxyPort: ({ url, port }: { url?: string; port?: number } = {}) => {
  if (port) ctx.grokActualPort = port;
  if (url) ctx.grokUrl = url;
  else if (port) ctx.grokUrl = `http://${ctx.config.grokProvider.proxyHost}:${port}/v1`;
},
```

**수정 — 셧다운 (`server.ts:525-526`)** 두 줄 제거, `oauthChild` 라인(523-524)은 유지:

```ts
try { grokChild?.stop?.(); } catch {}
try { grokChild?.kill?.(); } catch {}
```

**수정 — 부팅 로그 (`server.ts:555`)**, Grok 프록시 포트 문구 삭제:

```ts
console.log(`Provider policy: GPT OAuth, API-key Responses, and Grok Images providers. GPT OAuth proxy port ${ctx.oauthPort}; Grok proxy port ${ctx.grokActualPort || ctx.grokPort}.`);
```

**남는 것**: `advertise()`(335-356), `unadvertise()`(358-364), 호출부 `server.ts:484`(OAuth ready), `556`(listen 후), `539`(exit 훅)은 전부 유지. `advertise` 자체는 progrok과 무관한 서버 광고 메커니즘이다.

### 1-4. advertise() 및 ~/.ima2/server.json 스키마

`buildAdvertisePayload()` (`server.ts:306-333`) — 발행 필드 전체:

```ts
export function buildAdvertisePayload(ctx: RuntimeContext) {
  const grokLive = ctx.grokProxyLive === true;
  return {
    port, url, pid: process.pid, startedAt, version, adminNonce,
    backend: { configuredPort, actualPort, url },
    oauth:   { configuredPort, actualPort, url, status: ctx.oauthReadyState },
    grok: {
      configuredPort: Number(ctx.grokPort),
      actualPort: grokLive ? Number(ctx.grokActualPort || ctx.grokPort) : null,
      url: grokLive ? ctx.grokUrl : null,
      live: grokLive,
    },
  };
}
```

파일 쓰기는 `server.ts:335-356`, 0o600 강제 + `chmodSync` 재확인. `adminNonce`가 kill-switch credential이라 권한 로직은 건드리지 않는다.

**`grok` 섹션을 읽는 소비자는 정확히 한 곳**:

```ts
// bin/commands/service.ts:139-151
const grok = (entry as { grok?: { live?: boolean } }).grok;
// grok.live only exists in the advertise payload, not /api/health (audit note).
if (grok && grok.live === false) {
  console.log("  Warning: Grok proxy is not live under the service environment.");
  console.log("  If Grok worked in a terminal, the service PATH may be missing its binary.");
}
```

ComfyUI 브리지는 `backend`/`url`/`port`만 읽고 grok은 보지 않는다 (`integrations/comfyui/ima2_gen_bridge/nodes.py:93-101`). `bin/lib/client.ts:114`, `bin/ima2.ts:82-91`, `bin/commands/stop.ts:14-17`도 pid/url만 사용. **payload의 `grok` 키를 통째로 없애도 파손되는 외부 소비자는 `service.ts`의 경고문 하나뿐**이다.

`routes/health.ts:20-23`은 별도 표면이고 advertise와 다른 계약이다:

```ts
grok: {
  configuredPort: Number(ctx.grokPort),
  actualPort: Number(ctx.grokActualPort || ctx.grokPort),
  url: ctx.grokUrl,
},
```

### 1-5. lib/runtimeContext.ts — 필드 5개 + 기본값 제거

인터페이스 (`lib/runtimeContext.ts:22-28`):

```ts
grokActualPort: number | undefined;
grokPort: number;
grokUrl: string;
/** Supervisor handle. Optional: absent when autoStart is off or in test contexts. */
grokProxy?: GrokProxyHandle | undefined;
/** True only while a supervised child is actually listening. */
grokProxyLive?: boolean | undefined;
```

import (`lib/runtimeContext.ts:4`): `import type { GrokProxyHandle } from "./grokProxyLauncher.js";`

`requireRuntimeContext()` 기본값 (`lib/runtimeContext.ts:116-124`):

```ts
if (target.grokPort === undefined) {
  target.grokPort = (target.config as AppConfig).grokProvider?.proxyPort ?? 18645;
}
if (target.grokUrl === undefined) {
  const grokCfg = (target.config as AppConfig).grokProvider;
  const host = grokCfg?.proxyHost ?? "127.0.0.1";
  const port = target.grokActualPort ?? target.grokPort ?? grokCfg?.proxyPort ?? 18645;
  target.grokUrl = `http://${host}:${port}/v1`;
}
```

`createTestRuntimeContext()` (`lib/runtimeContext.ts:197-199`):

```ts
grokActualPort: undefined,
grokPort: 18645,
grokUrl: "http://127.0.0.1:18645/v1",
```

주석 하나가 `advertise()` 재실행 계약을 언급하니 문구도 손봐야 한다 (`lib/runtimeContext.ts:16-19`): `"(advertise() re-runs on proxy state changes and must not rotate it)"` — 프록시 상태 변화가 사라지면 이 근거가 무효.

### 1-6. config.ts:378-387 — 키별 판정

| 키 | env | 기본값 | 읽는 곳 | 판정 |
|---|---|---|---|---|
| `proxyPort` | `IMA2_GROK_PROXY_PORT` | `18645` | `server.ts:390`, `grokProxyLauncher.ts:112`, `grokRuntime.ts:16`, `runtimeContext.ts:117,122`, `registry.ts:73` | 삭제 (lane 폐기 시) |
| `proxyHost` | `IMA2_GROK_PROXY_HOST` | `127.0.0.1` | `server.ts:403,438`, `grokProxyLauncher.ts:111`, `grokRuntime.ts:15`, `runtimeContext.ts:121`, `registry.ts:73` | 삭제 |
| `autoStart` | `IMA2_NO_GROK_PROXY` (부정) | `true` | `server.ts:491` 단 한 곳 | 삭제 |
| `restartDelayMs` | `IMA2_GROK_RESTART_DELAY_MS` | `2000` | `grokProxyLauncher.ts:113`, `server.ts:494` | 삭제 |
| `restartMaxAttempts` | `IMA2_GROK_RESTART_MAX_ATTEMPTS` | `6` | `grokProxyLauncher.ts:114` | 삭제 |
| `restartMaxDelayMs` | `IMA2_GROK_RESTART_MAX_DELAY_MS` | `60_000` | `grokProxyLauncher.ts:115` | 삭제 |
| `restartHealthyMs` | `IMA2_GROK_RESTART_HEALTHY_MS` | `60_000` | `grokProxyLauncher.ts:116` | 삭제 |

`config.ts:388` 이후 (`plannerModel`, 타임아웃, `defaultImageModel`, 비디오 예산 등)는 전부 유지 — 프록시가 아니라 xAI 호출 예산이다.

`lib/providers/registry.ts:73`이 삭제 대상 env 두 개를 lane credential로 선언한다:

```ts
credentials: [{ kind: "oauth-proxy", envVars: ["IMA2_GROK_PROXY_HOST", "IMA2_GROK_PROXY_PORT"], configKey: "grokProvider" }],
```

registry는 생성 파일 게이트가 걸려 있다 (`scripts/generate-provider-types.mjs --check`, ci.yml:63-64 / pr-fast.yml:51-52). 여기를 고치면 생성물 재생성이 필수.

### 1-7. lib/runtimePorts.ts — 유지 (삭제 금지)

`findAvailablePort`는 progrok 런처가 유일한 프로덕션 소비자다 (`lib/grokProxyLauncher.ts:6,156`). 하지만 **모듈은 유지**해야 한다:

```
server.ts:30       import { getServerPort, listenWithPortFallback } from "./lib/runtimePorts.js";
lib/oauthLauncher.ts:2  import { parseLocalhostPortFromUrl, parseOAuthReadyUrl } from "./runtimePorts.js";
tests/history-tombstone.test.ts:14,40   findAvailablePort
tests/runtime-ports.test.ts:6-10        5개 심볼 전부
```

`findAvailablePort` 자체는 OAuth가 쓰지 않는다 — OAuth는 `parseOAuthReadyUrl`/`parseLocalhostPortFromUrl`만 쓴다. 즉 progrok 제거 후 `findAvailablePort`의 프로덕션 소비자는 0이 되고 테스트 2개만 남는다. export 유지가 가장 저비용(테스트 수정 불필요), 삭제하려면 `tests/history-tombstone.test.ts`와 `tests/runtime-ports.test.ts`를 같이 손봐야 한다.

### 1-8. bin/commands/grok.ts — 전체 삭제 (90줄)

HELP 텍스트 (`bin/commands/grok.ts:9-26`)가 전부 progrok 계약이다:

```
  Manage the bundled progrok runtime used by the Grok image provider.
  No separate progrok install is required.
  Subcommands: login / logout / status / models / proxy
  Notes:
    ima2 serve auto-starts the bundled proxy on 127.0.0.1:18645 by default.
    Use IMA2_NO_GROK_PROXY=1 to disable automatic proxy startup.
```

passthrough 구조 — 서브커맨드 화이트리스트가 없다. `argv`를 그대로 progrok 바이너리에 넘긴다 (`bin/commands/grok.ts:35-48, 73`):

```ts
const progrokBin = join(localBinPath(), isWin ? "progrok.cmd" : "progrok");
const child = spawn(progrokBin, argv, { cwd: ROOT, env, stdio: "inherit", shell: isWin, windowsHide: true });
...
const code = await spawnProgrok(argv, env);
```

`env.PATH`에 `node_modules/.bin`을 prepend한다 (`bin/commands/grok.ts:65-68`). export된 `normalizeGrokLoginArgs` (`bin/commands/grok.ts:50-56`)는 `tests/grok-command-login-contract.test.ts`가 직접 import한다.

`ima2 grok --help`는 CI 스모크에 걸려 있다 (아래 5절) — 커맨드를 지우면 워크플로도 같이 고쳐야 한다.

### 1-9. doctor 계열

`bin/lib/doctor-runtime.ts:7` — 런타임 의존성 존재 검증 목록:

```ts
const RUNTIME_DEPENDENCIES = ["express", "better-sqlite3", "openai", "openai-oauth", "progrok/package.json", "@openai/codex/package.json", "zod"];
```

`"progrok/package.json"` 항목 제거 필요.

`bin/lib/doctor-providers.ts:49-55` — 자격증명 파일 탐지:

```ts
if (lane === "grok") {
  const files = [join(home, ".progrok", "auth.json"), join(home, ".grok", "auth.json")];
  ...
  return { code: "CREDENTIAL_MISSING", lane, kind: "warn", text: `${lane}: no ~/.progrok or ~/.grok auth file` };
}
```

`~/.progrok` 경로와 경고 문구를 정리. `bin/commands/doctor.ts`에는 `grok` 매치가 없다 — advertise 파일 읽기(163, 293-297)만 있고 grok 필드는 안 본다.

### 1-10. routes/auth.ts:258 — notifyCredentialsChanged 대체

```ts
const result = provider === "grok"
  ? await startGrokDeviceCode(() => ctx?.grokProxy?.notifyCredentialsChanged())
  : await startCodexDeviceCode();
```

이 콜백은 로그인 성공 시 `waiting-for-login` 상태의 감독자를 재기동시키는 유일한 입구다 (`lib/grokProxyLauncher.ts:285-293`). 감독자가 사라지면 **재기동할 대상 자체가 없으므로 대체 로직이 필요 없다** — 콜백 인자를 제거하고 `startGrokDeviceCode()`를 무인자 호출로 바꾸면 된다. `startGrokDeviceCode`의 시그니처가 콜백을 옵셔널로 받는지 확인 후 정리.

### 1-11. routes/models.ts — grokLaneState 재작성

`routes/models.ts:140-161`이 감독자 상태 7종을 lane 상태로 접는다:

```ts
function grokLaneState(ctx: RuntimeContext): LaneState {
  if (!ctx.grokUrl) return { status: "disconnected", reason: "Grok proxy not configured" };
  switch (ctx.grokProxy?.state) {
    case "ready": return { status: "ready" };
    case "starting": return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "backoff": return { status: "disconnected", reason: "Grok proxy restarting" };
    case "gave-up-retryable": return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "waiting-for-login": return { status: "disconnected", reason: "Grok login required" };
    case "gave-up": return { status: "disconnected", reason: "Grok proxy failed to start" };
    case "stopped": return { status: "disconnected", reason: "Grok proxy stopped" };
    default: return { status: "ready", reason: UNPROBED_GROK_REASON };
  }
}
```

`UNPROBED_GROK_REASON = "configured proxy endpoint; live session not probed"` (`routes/models.ts:130`)도 문구 정리 대상.

### 1-12. routes/grok.ts — 전체 재작성 또는 삭제 (33줄)

`/api/grok/status`가 프록시 `/v1/models`를 프로브하고 세대 토큰으로 감독자를 승격시킨다 (`routes/grok.ts:11, 13, 22, 25, 30`). progrok 제거 시 이 라우트는 존재 이유가 사라진다. UI가 10초 폴링하는 표면이라 (`routes/grok.ts:27-29` 주석) 프론트 연동 확인 필요.

### 1-13. routes/quota.ts:118-127 — progrok:auth-json 라벨

```ts
const auth = JSON.parse(readFileSync(join(homeDir, ".progrok", "auth.json"), "utf8")) as { accessToken?: string };
...
source: "progrok:auth-json",
```

`~/.grok/auth.json` 경로(105-112, source `grok:auth-json` / `grok:auth-json-oidc`)는 progrok과 무관하게 xAI CLI 자격증명이므로 유지. `~/.progrok` 후보만 제거.

### 1-14. 패키징 · 인프라

| 파일 | 라인 | 내용 | 처리 |
|---|---|---|---|
| `package.json` | 102 | `"progrok": "file:vendor/progrok-0.2.0.tgz"` | 삭제 |
| `package.json` | 112 | `bundleDependencies` 내 `"progrok"` | 삭제 |
| `package.json` | 79 | `files` 내 `"vendor/"` | 유지 (openai-oauth tgz 잔존) |
| `package.json` | 32 | `lint:pkg`의 `mustInclude` 배열에 `'vendor/'` | 유지 |
| `package-lock.json` | — | `node_modules/progrok` 엔트리 + 루트 `bundleDependencies` | 재생성 필요 |
| `vendor/progrok-0.2.0.tgz` | — | 번들 tarball | 삭제 |
| `nix/node-modules.nix` | 21, 29-30 | `rootLock.packages."node_modules/progrok"` 직접 참조 | 삭제 (이 코드가 없으면 nix eval 실패 가능) |
| `flake.nix` | 18 | 주석 "vendored progrok tarball" | 문구 수정 |
| `Dockerfile` | 12 | 주석 "(openai-oauth, progrok) referenced by package.json" | 문구 수정 |
| `scripts/qa-grok-video.mjs` | 11, 181 | progrok 전제 안내 문구 | 수정 |
| `scripts/paired-generated-paths.txt` | 9 | `lib/grokProxyLauncher.js` | 삭제 |
| `scripts/lib/uiBuildReceiptFiles.mjs` | 25 | `\.progrok` 시크릿 정규식 | 유지 (방어적) |

`docker-compose.yml`은 `progrok` 매치 없음. `nix/node-modules.nix:21` 주석은 `file:vendor/progrok-0.1.1.tgz`라고 적혀 있어 실제 `0.2.0`과 이미 어긋나 있다.

`scripts/check-install-policy.mjs:67-71`이 manifest와 lock의 `bundleDependencies` 일치를 강제하므로, package.json만 고치고 lock을 재생성하지 않으면 CI가 잡는다:

```js
const manifestBundles = [...(manifest.bundleDependencies || [])].sort();
const lockBundles = [...(lock.packages?.[""]?.bundleDependencies || [])].sort();
... `bundleDependencies mismatch: package.json=${manifestBundles.join(",")} package-lock.json=${lockBundles.join(",")}`
```

`scripts/release-contract.mjs:458, 471`도 `bundleDependencies`를 순회한다.

## 2. 테스트

### 2-1. 파일별 판정

| 파일 | 줄 | 히트 | 내용 | 판정 |
|---|---|---|---|---|
| `tests/grok-proxy-supervisor-contract.test.ts` | 142 | 19 | 로그인 재기동, `waiting-for-login` 비-spawnable, 세대 토큰. 가짜 progrok 스크립트를 tmpdir에 씀 | **DELETE** |
| `tests/grok-proxy-restart.test.ts` | 53 | 12 | `restartPlan` 지수 백오프 + 예산 소진, 없는 바이너리 재시도 | **DELETE** |
| `tests/grok-proxy-launcher.test.ts` | 72 | 8 | `startGrokProxy`, auth 메시지 정규화(`progrok login` → `ima2 grok login`) | **DELETE** |
| `tests/grok-advertise-liveness-contract.test.ts` | 51 | 7 | `buildAdvertisePayload`의 grok liveness 4케이스 | **DELETE** — 단, `backend` 계약 검증(42-50)은 별도 테스트로 보존 권장 |
| `tests/grok-command-login-contract.test.ts` | 30 | 1 | `normalizeGrokLoginArgs` 4케이스 | **DELETE** (`bin/commands/grok.ts` 동반 삭제 시) |
| `tests/models-endpoint-contract.test.ts` | 460 | 6 | `grokProxyState` 주입으로 lane 상태 매핑 검증 (104, 114, 121, 366, 377, 383) | **REWRITE** — lane 상태 계약이 바뀌므로 |
| `tests/runtime-context-normalize.test.ts` | 67 | 4 | `grokUrl` 기본값·오버라이드 (25, 62-65) | **KEEP-with-edit** — grok 단정 제거 |
| `tests/package-install-smoke.mjs` | 354 | 6 | 번들 목록(141), bin shim 존재(154), `progrok --help` 실행(184, 238-239), `bundled progrok runtime` 매치(223), `IMA2_NO_GROK_PROXY=1`(218) | **REWRITE** |
| `tests/release-pipeline-contract.test.ts` | 766 | 2 | `validateBundleParity`가 `["progrok", "openai-oauth"]` 사용 (215, 218) | **KEEP-with-edit** — 픽스처 문자열 교체 |
| `tests/cli-commands.test.js` | 367 | 2 | `ima2 grok --help`가 `bundled progrok runtime`, `IMA2_NO_GROK_PROXY=1` 출력 (357-365) | **REWRITE or DELETE** |
| `tests/agent-mode-runtime-contract.test.ts` | 802 | 4 | `proxyPort: 18645` 픽스처 + origin 단정 (101, 135, 514, 603) | **KEEP-with-edit** |
| `tests/e2e-app-environment.test.ts` | — | — | `IMA2_NO_GROK_PROXY`, `IMA2_GROK_PROXY_PORT/HOST` env 계약 (36-39, 66) | **KEEP-with-edit** |
| `tests/j6-isolation-preflight.test.mjs` | 234 | 1 | 포트 18645 격리(99), `IMA2_NO_GROK_PROXY` 단정(222) | **KEEP-with-edit** |
| `tests/history-tombstone.test.ts` | — | — | `findAvailablePort` 사용(14, 40), `IMA2_NO_GROK_PROXY: "1"`(69) | **KEEP-with-edit** |
| `tests/grok-planner-adapter.test.ts` | 344 | 2 | 플래너 로직 — 프록시와 무관 | **KEEP** (URL 픽스처만 확인) |
| `tests/grok-execution-parity.test.ts` | 392 | 1 | 실행 패리티 | **KEEP** |
| `tests/grokVideoAdapter.test.ts` / `grokVideoPlannerFallback.test.ts` / `videoRoute.test.ts` / `videoExtendI2v.test.ts` / `prompt-builder-contract.test.ts` / `video-download-cancellation.test.ts` / `_executionRouteHarness.ts` | — | 각 1-2 | URL 픽스처 수준 | **KEEP-with-edit** |

E2E 픽스처도 같은 env를 쓴다: `ui/e2e/fixtures/appIsolation.ts:32-33`, `ui/e2e/fixtures/appServer.ts:79, 138-139, 318`, `ui/e2e/fixture-isolation.spec.ts:34`. `appServer.ts:318`의 `grokProvider: { disableAutoStart: true }`는 config 키가 사라지면 무의미해진다.

### 2-2. 삭제를 등록하는 방법

러너는 디렉터리 스캔이라 등록이 필요 없다 (`scripts/run-tests.mjs:8-11`):

```js
const files = readdirSync(testDir)
  .filter((f) => /\.test\.[cm]?[jt]s$/.test(f))
  .map((f) => join(testDir, f)).sort();
```

**하지만 인벤토리 문서는 생성물이고 CI가 drift를 잡는다.** `scripts/classify-tests.mjs`는 `--check`일 때 온디스크 파일과 재생성 결과가 **문자열 동일**해야 통과한다 (56-63):

```js
if (check) {
  const existing = existsSync(outPath) ? readFileSync(outPath, "utf8").replace(/\r\n/g, "\n") : null;
  if (existing !== output) {
    console.error(`${outPath} is stale. Run: node scripts/classify-tests.mjs`);
    process.exit(1);
  }
}
```

총계 줄(`Total: N (runtime: R, contract: C)`)까지 포함해 비교하므로, 테스트 파일을 하나라도 지우면 `docs/migration/runtime-test-inventory.md`(503줄)를 반드시 재생성해야 한다. 절차: `node scripts/classify-tests.mjs` (플래그 없이) 실행 → 파일 재작성 → 커밋. 삭제 대상 5개는 인벤토리 89-91, 81-82행에 등재돼 있다.

`npm run test:inventory`는 `--check --fail-js-runtime`이며 (`package.json:26`), CI 두 곳에서 돈다.

### 2-3. structure/01 라인수 게이트

`scripts/refresh-structure-line-counts.mjs`가 표 셀을 정규식으로 파싱한다 (37):

```js
const ROW_RE = /\| `([^`]+\.(?:ts|tsx))` \| (\d+|n\/a) \|/g;
```

삭제된 파일 처리는 **조용한 무시**다 (26-30, 45-47):

```js
function lineCount(relPath) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) return null;   // ← 파일이 없으면 null
  ...
}
const actual = lineCount(relPath);
if (actual == null) return full;        // ← 행을 그대로 둠, drift로 잡지 않음
```

즉 `lib/grokProxyLauncher.ts`를 지워도 `structure/01-file-function-map.md:292`의 `| lib/grokProxyLauncher.ts | 326 | ... |` 행은 **게이트를 통과한 채 유령으로 남는다**. wp5에서 수동 삭제해야 한다. 대상 행:

```
structure/01-file-function-map.md:292  | `lib/grokProxyLauncher.ts` | 326 | Grok proxy process startup and readiness helpers |
structure/01-file-function-map.md:293  | `lib/grokRuntime.ts` | 28 | Grok runtime configuration helpers |
structure/01-file-function-map.md:137  | `bin/commands/grok.ts` | 91 | Grok OAuth login and status helpers |
structure/01-file-function-map.md:68   grok.ts               GET /api/grok/status + progrok helpers
```

반대로 `server.ts`, `config.ts`, `lib/runtimeContext.ts`, `routes/models.ts`는 줄 수가 줄어들면 drift로 **잡힌다** (SCOPES에 포함, 15-24). `node scripts/refresh-structure-line-counts.mjs` 실행 필요. 이 게이트는 pr-fast.yml:49-50과 ci.yml:57-58 양쪽에서 fast-fail로 돈다.

## 3. 문서 / SoT

### 3-1. 파일별 히트 수

`rg -c 'progrok|18645|grok proxy|Grok proxy|IMA2_GROK_PROXY|IMA2_NO_GROK_PROXY'`:

```
structure/06-infra-operations.md            7
docs/API.zh-TW.md / API.zh-CN.md            7 / 7
docs/API.md                                 6
docs/grok-video-i2v-plan.{md,zh-CN,zh-TW}   5 each
docs/README.{ko,zh-CN,zh-TW}.md             5 each
docs/CLI.{md,zh-CN,zh-TW}.md                5 each
README.md                                   5
structure/02-command-reference.md           4
structure/00-structure-hub.md               4
site/src/i18n/strings.ts                    4
site/.../reference/config.astro (en+ko)     3 each
structure/01-file-function-map.md           2
site/.../api|providers|architecture.astro   2 each (en+ko)
skills/ima2/SKILL.md                        1
site/.../cli.astro, docs/index.astro        1 each (en+ko)
docs/grok-video-i2v-research.*              1 each
AGENTS.md                                   1
```

`CONTRIBUTING.md`, `devlog/_plan/README.md`는 매치 없음.

### 3-2. structure/*.md — wp5가 다시 쓸 SoT 섹션

**`structure/06-infra-operations.md`** (가장 무겁다):

- `:61` — Mermaid 프로세스 다이어그램 노드 `SRV --> GROK["progrok<br/>default port 18645"]`
- `:77` — 표 행 `| bundled dependencies | progrok, patched openai-oauth, zod |`
- `:168-170` — 환경변수 표 3행 (`IMA2_GROK_PROXY_HOST` / `_PORT` / `IMA2_NO_GROK_PROXY`)
- `:213` — 프로바이더 산문 단락, `provider: "grok"` uses bundled progrok
- `:374` — 2026-06-01 변경 이력 항목 (progrok-backed video)

**`structure/00-structure-hub.md`**:

- `:13` — `lib/*` 소유 범위 산문 "Grok/progrok provider plumbing"
- `:21` — 2026-05-30 스냅샷 노트 "The Grok provider path now bundles progrok"
- `:38` — 2026-08-23 comfy 스냅샷, "what distinguishes it from the grok/progrok lane" (comfy lane 정의가 progrok 대조에 의존)
- `:59` — Mermaid `API --> GROK["progrok<br/>xAI proxy"]`

**`structure/02-command-reference.md`**:

- `:58` — 커맨드 표 행 `| ima2 grok login/status/models/proxy | ... | bin/commands/grok.ts, routes/grok.ts |`
- `:134`, `:192` — `--provider` 플래그 설명 2곳 ("`grok` uses bundled progrok OAuth")
- `:143` — 프로바이더 오버라이드 의미론 산문

**`structure/01-file-function-map.md`**: 위 2-3절의 4행.

### 3-3. 사용자 문서

- `README.md:173-174` (프로바이더 설명), `:355-357` (env 표 3행)
- `docs/CLI.md:18` (커맨드 표), `:116` (프로바이더 설명), `:165-168` (자동 시작 안내 단락), `:468` (`ima2 grok status` 행)
- `docs/API.md:65`, `:155` (`GET /api/grok/status`), `:166` (`~/.progrok/auth.json`), `:397`, `:882-883` (에러 코드 `GROK_RATE_LIMITED` / `GROK_AUTH_FAILED` 설명)
- `docs/README.ko.md:135-136`, `:266-268`
- 중국어 번역본 6종(`API`/`CLI`/`README` × `zh-CN`/`zh-TW`)이 원문과 1:1 대응 — 동일 위치 동반 수정
- `docs/grok-video-i2v-{plan,research}.*` 9파일 — 과거 계획 문서, 수정 대신 그대로 두는 판단도 가능
- `skills/ima2/SKILL.md:88` — "Use Grok when the request should run through bundled progrok"
- `AGENTS.md:28` — `- Grok: bundled progrok (xAI Images API)`

### 3-4. site/ (Astro)

`site/`는 Astro 정적 사이트이고 GitHub Pages로 배포된다. 영문/한국어 페이지가 쌍으로 존재:

```
site/src/pages/docs/reference/config.astro:45-47        (+ ko 동일)
site/src/pages/docs/concepts/architecture.astro         2건 (+ ko)
site/src/pages/docs/concepts/providers.astro            2건 (+ ko)
site/src/pages/docs/reference/api.astro                 2건 (+ ko)
site/src/pages/docs/reference/cli.astro                 1건 (+ ko)
site/src/pages/docs/index.astro                         1건 (+ ko)
site/src/i18n/strings.ts                                4건
```

`config.astro:45-47`은 env 표 `<tr>` 3행으로, README/structure 표와 같은 내용이다. 한국어 페이지도 동일 라인 번호.

## 4. 선행 유닛 `260819c_grok_proxy_supervision/`

### 4-1. 계획한 것

README 기준 (`devlog/_plan/260819c_grok_proxy_supervision/README.md`), GUI 로그인 후에도 Grok이 `Disconnected`로 남는 문제를 3개 WP로 나눴다:

| 문서 | 줄 | 내용 |
|---|---|---|
| `000_research.md` | 149 | 결함 3종 실측 재현과 근본 원인 |
| `001_opencodex.md` | 113 | opencodex 감독 구조 대조 |
| `010_wp2_supervisor.md` | 274 | WP2 감독자 도입 + 로그인 재기동 |
| `020_wp3_advertise.md` | 135 | WP3 advertise가 죽은 포트를 광고하지 않음 |
| `030_wp4_lane.md` | 110 | WP4 lane 상태를 감독자 상태와 일치 |

명시된 결함 3종:

```
1. 인증 실패가 종착 상태다. progrok은 로그인 없으면 exit(1)하고
   (progrok/src/commands/proxy.ts:22-26), 런처는 그때 재시작을 포기한다.
2. advertise 파일이 죽은 포트를 광고한다.
3. lane 상태가 전송 상태와 무관하다. URL 문자열만 있으면 ready
   (routes/models.ts:119-124).
```

적대적 감사 4라운드(FAIL→FAIL→FAIL→PASS) 기록도 있다.

### 4-2. 실제로 구현된 것

`devlog/_plan/README.md:26`는 이 유닛을 **"조사 + 로드맵 완료 (000-030), 구현 미착수"**로 적어놓았다. 그러나 코드는 다르다:

```
git log --oneline --since=2026-08-19 -- lib/grokProxyLauncher.ts
054c729f 2026-08-19 fix(grok): make GUI login revive the progrok proxy without a server restart
```

이 커밋 하나가 **WP2/WP3/WP4를 전부 실현했다**. 현재 코드에 남은 증거:

- WP2: `GrokProxyState` 7상태 + `waiting-for-login` 분리 + `notifyCredentialsChanged` (`lib/grokProxyLauncher.ts:43-56, 285-293`)
- WP3: `grokProxyLive` + `buildAdvertisePayload`의 liveness 게이트 (`server.ts:307, 326-332`), `tests/grok-advertise-liveness-contract.test.ts`
- WP4: `grokLaneState`가 `ctx.grokProxy?.state`를 switch (`routes/models.ts:140-161`)

즉 `_plan/README.md:26`의 "구현 미착수" 서술은 **부정확**하다. 아카이빙 시 이 오기를 함께 정정해야 한다.

### 4-3. 아카이빙 절차

`devlog/_plan/README.md:10-12`가 규칙을 정한다:

```
`_plan`은 앞으로 구현하거나 검증할 일이 남은 항목만 둔다. 구현 근거와
테스트가 확인된 항목은 `_fin`으로 이동한다. 완료 여부는 폴더 위치만이 아니라
현재 코드, 테스트, GitHub issue 상태, closeout 증거를 같이 본다.
```

명명 규칙 (`:18-19`): `YYMMDD_issue<NN>-<kebab-slug>` 또는 `YYMMDD_<kebab-slug>`. 과거 이동 사례를 보면 `_plan`의 접미 문자(`b`, `c`, `d`)를 **떼고** 옮긴다 (`:97, 99`):

```
- `260819b_release_speed/` → `_fin/260819_release_speed/` — v3.7.1로 완료
- `260821_260821d-release-train/` → `_fin/260821_release_train/` — v3.10.0으로 완료
```

`_fin/` 실물도 접미 없는 형태다: `260819_release_speed`, `260821_release_train`, `260908_post_314_cleanup`.

**구체 절차**:

1. `git mv devlog/_plan/260819c_grok_proxy_supervision devlog/_fin/260819_grok_proxy_supervision` — 접미 `c` 제거. `_fin`에 `260819_kling_provider_feasibility`, `260819_log_detail_modal`, `260819_release_speed`가 이미 있으나 슬러그가 달라 충돌 없음.
2. 해당 폴더에 supersede 노트 추가 (예: `900_superseded.md`). 담을 내용: 054c729f로 WP2-WP4가 실제 구현되었다는 사실, 새 제거 유닛이 그 구현물을 통째로 걷어낸다는 사실, 새 유닛 경로.
3. `README.md` frontmatter의 `updated`를 갱신하고, 본문 상단에 supersede 배너를 넣는다.
4. `devlog/_plan/README.md:26`의 active lane 표 행을 삭제하고, `:87` 이후의 `_fin` 이동 기록 목록에 항목을 추가한다. "구현 미착수" 오기 정정을 이동 사유에 명시한다.
5. `scripts/check-devlog-citations.mjs`가 devlog 인용을 검사하므로, `config.ts:341`과 `:394`처럼 코드 주석이 devlog 경로를 참조하는 패턴이 이 유닛에도 있는지 확인. 현재 `260819c_grok_proxy_supervision`을 코드에서 참조하는 곳은 검색상 없다 (`010_wp2_supervisor.md:117`이 코드를 인용하는 반대 방향뿐).

## 5. CI

### 5-1. `.github/workflows/ci.yml` (381줄)

트리거 (`:6-14`): `push` `branches: [main, dev]`, `schedule` `cron: '17 3 * * *'`, `workflow_dispatch`(40자 SHA 입력, 릴리스 후보 게이트). **`pull_request` 트리거 없음** — PR은 pr-fast.yml이 담당.

잡 1 `test (${{ matrix.os }}, node ${{ matrix.node }}, npm ${{ matrix.npm }})` (`:26-27`), 매트릭스 러너. 주요 스텝 순서:

```
:57  Structure line-count drift (fast fail)  → node scripts/refresh-structure-line-counts.mjs --check
:63  Provider registry generated-file drift  → node scripts/generate-provider-types.mjs --check
:69  Install policy contract                 → npm run test:install-policy
:78  Test inventory                          → npm run test:inventory
:80  Runtime installation documentation      → npm run docs:runtime:check
:88  Emitted doctor CLI offline and JSON contracts
:90  Run tests                               → npm test
:94  Lint package.json                       → npm run lint:pkg
:102 Package install smoke                   → npm run test:package-install
:105 Global install, update, and package-local OAuth smoke
:108 CLI smoke (grok --help)                 → node bin/ima2.js grok --help
:116 Graceful shutdown (SIGINT clean exit)
:142 Publish dry-run                         → npm run publish:dry-run
```

**progrok을 직접 invoke하는 스텝은 `:108-109` 하나**:

```yaml
      - name: CLI smoke (grok --help)
        run: node bin/ima2.js grok --help
```

`bin/commands/grok.ts`를 삭제하면 이 스텝이 실패한다. 스텝 자체를 제거하거나 다른 커맨드로 교체해야 한다.

간접 invoke는 `:102`의 package install smoke — `tests/package-install-smoke.mjs:184, 238-239`가 설치된 tarball에서 `progrok --help`를 실제 실행하고 `/Usage: progrok/`를 매치한다.

잡 2 `windows (node ${{ matrix.node }}, npm ${{ matrix.npm }})` (`:149-151`), `runs-on: windows-latest`, `npm ci --foreground-scripts`(`:180`). Windows 경로는 `progrok.cmd` shim에 의존한다 (`lib/grokProxyLauncher.ts:176`, `bin/commands/grok.ts:37`).

### 5-2. `.github/workflows/pr-fast.yml` (209줄)

트리거 (`:6-7`): `pull_request: {}` — **base 브랜치 제한 없음**. 모든 PR에서 돈다. concurrency 그룹은 PR 번호 기준, `cancel-in-progress: true` (`:9-11`).

Node `22.23.0` 고정, npm `11.18.0` 핀 (`:27, 42`). ci.yml은 매트릭스 변수를 쓴다.

잡 3개:

- `fast` / "PR backend checks", `ubuntu-latest`, timeout 30분 (`:14-18`). 스텝: blob budget(`:44`), 루트+ui 설치, **structure line-count drift `:49-50`**, provider registry drift(`:51-52`), native deps, install policy, typecheck ×2, **test inventory `:61-62`**, build server/cli/ui, 패키지 크기 예산(`:71-72`), `npm test`(`:77-79`, timeout 5분), `lint:pkg`(`:80-81`).
- `frontend` / "PR frontend checks", `ubuntu-latest`, timeout 25분 (`:83-86`). Playwright Chromium, `typecheck:e2e`, `build:fixture`, `test:e2e`, 증거 아티팩트 업로드 다수.
- `gate` / "PR fast gate", `needs: [fast, frontend]`, `if: always()` (`:198-209`). 둘 다 success여야 통과.

**pr-fast.yml에는 progrok 설치·실행 스텝이 없다.** package install smoke와 Windows 레인은 fast gate에서 빠져 있다 (`:73-76` 주석: "What the fast gate drops is the Windows lane and the two package smokes, which cost 573s of the 831s Windows job"). 따라서 **progrok 제거의 패키징 파손은 PR 게이트에서 보이지 않고 dev push 후 ci.yml에서야 드러난다.** wp4 검증 계획에 `workflow_dispatch`로 ci.yml을 후보 SHA에 직접 돌리는 단계가 필요하다.

### 5-3. provider-canary.yml

`:34-35`에 grok 시크릿 두 개:

```yaml
      CANARY_GROK_MODELS_URL: ${{ secrets.CANARY_GROK_MODELS_URL }}
      CANARY_GROK_TOKEN: ${{ secrets.CANARY_GROK_TOKEN }}
      CANARY_XAI_API_KEY: ${{ secrets.CANARY_XAI_API_KEY }}
```

`on: schedule (cron '23 6 * * *') / workflow_dispatch`만이며 `pull_request`에서 절대 돌지 않는다 (`:10-15`). progrok 바이너리를 설치하거나 실행하지 않고, 시크릿으로 받은 URL을 프로브할 뿐이다. `grok` lane 폐기 시 `CANARY_GROK_*` 두 항목 정리 대상.

### 5-4. 기타 워크플로

`wp09-startup-diagnostic.yml:65`가 `--grep 'WP02 Grok API survives|J9'`로 Grok API 저널리를 돌린다 — `grok-api`(직접 키) 경로라 progrok과 무관.

`.github` 전체에서 `progrok` 문자열 매치는 0건. grok 매치는 위 3곳뿐이다.

## 6. UI

### 6-1. 사용자 노출 카피

`ui/src` 전체에서 progrok/18645를 언급하는 코드 로직은 없고, **i18n 문자열과 라벨 하나뿐**이다.

`ui/src/components/ResultMetadataModal.tsx:23`:

```tsx
  grok: "Grok OAuth / progrok",
```

프록시를 명시하는 i18n 키 (en 기준, ko/zh-Hans/zh-Hant 동일 위치):

| 키 | en.json 라인 | 내용 |
|---|---|---|
| `grokApiBody` | 360 | "Runs through bundled progrok: mandatory search, Grok 4.5 image-and-text tool planning in English, then xAI Images API." |
| `grokOffline` | 740 | "Grok proxy is not running." |
| `grokOfflineHint` | 743 | "Run \`ima2 grok login\` once if needed, then start \`ima2 serve\`; ima2 starts the bundled Grok proxy automatically." |
| `grokManagedByIma2` | 744 | "Grok runs locally inside \`ima2 serve\` through the bundled progrok proxy at 127.0.0.1:18645." |
| `grokCompatBody` | 748 | "ima2 serve manages the bundled progrok proxy at 127.0.0.1:18645. ..." |
| `grokEyebrow` | 1326 | "Local xAI proxy" |
| `grokBody` | 1328 | "Uses progrok at the configured local port for xAI Images API generation." |
| `unsupportedHelp` | 1391 | "Grok models use xAI's Images API through the bundled local proxy." |
| (xAI 키 누락) | 1640 | "This image request will not fall back to the Grok proxy." |

한국어 대응 (`ui/src/i18n/ko.json:360, 744, 748, 1328`), 중국어 간체/번체도 같은 라인 번호에 대응 문자열이 있다. **4개 로케일 × 최소 9개 키**를 wp5에서 함께 손봐야 한다.

`ui/src/i18n/en.json:734, 737, 1595-1596`의 `oauthNotReady` / `oauthStarting` / "GPT OAuth proxy unavailable"은 OAuth 프록시라 무관 — 유지. `:1536`의 "proxy or transient stream transport issue"는 일반 네트워크 문구라 무관.

### 6-2. 폴링 표면

`routes/grok.ts` 주석이 UI 폴링 주기를 명시한다 (`routes/grok.ts:27-29`):

```ts
      // Deliberately does NOT call ensure(): the UI polls every 10s while not
      // ready, so self-healing here would spawn a child per poll forever.
      // Recovery is driven by the login event only.
```

`useGrokStatus` 훅이 `_plan/260819c` README의 "범위 밖"에도 등장한다 — ready 이후 폴링을 멈추지 않는 알려진 문제. `/api/grok/status`를 제거하거나 의미를 바꾸면 이 훅의 소비자 컴포넌트를 함께 확인해야 한다.

## wp4/wp5 착수 전 확정해야 할 결정

1. **`grok` lane을 폐기하는가, 직접 호출로 재배선하는가.** 이게 diff 규모를 2배 이상 가른다. 재배선이면 `lib/grokRuntime.ts` 축소 + 호출부 6곳 + 키 해석 경로, 폐기면 registry/models/enum/UI 라벨/문서 전반 연쇄.
2. **advertise payload의 `grok` 키를 제거할지, `live: false` 고정으로 남길지.** 제거하면 `bin/commands/service.ts:139-151` 경고문만 손보면 되지만, `~/.ima2/server.json`은 외부 도구가 읽는 계약이다.
3. **`findAvailablePort` export 유지 여부** — 프로덕션 소비자가 0이 되지만 테스트 2개가 쓴다.
4. **ci.yml `:108-109` grok --help 스모크 대체** — 커맨드 삭제와 동시에 처리하지 않으면 dev push가 깨진다.

검증 시 반드시 함께 돌려야 하는 생성물 게이트 3개: `node scripts/classify-tests.mjs` (인벤토리 재생성), `node scripts/refresh-structure-line-counts.mjs` (라인수), `node scripts/generate-provider-types.mjs` (registry 변경 시). package-lock 재생성 없이는 `check-install-policy.mjs:67-71`이 막는다.


