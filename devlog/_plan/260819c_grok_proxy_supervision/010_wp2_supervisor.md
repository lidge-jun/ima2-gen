---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, grok, progrok, supervisor, wp2]
---

# 010 — WP2: 감독자(supervisor) 도입과 로그인 재기동

결함 1을 고친다. 근거는 `000_research.md`, 설계 대조는 `001_opencodex.md`.

## 목표

GUI 로그인 후 **서버 재시작 없이** Grok이 살아난다. 크래시 루프 보호는
유지한다.

## 설계 결정

런처가 이미 자식 수명주기를 알고 있으므로 새 파일을 만들지 않고
`lib/grokProxyLauncher.ts`를 감독자로 승격한다. 새 모듈을 만들면 상태가
두 곳에 생기고, 그게 정확히 지금 문제의 형태다.

상태를 명시적 유니온으로 만든다.

```ts
export type GrokProxyState =
  | "stopped"             // 아직 안 띄웠음 — spawn 가능
  | "gave-up-retryable"   // 자격증명 사건으로 재무장됨 — spawn 가능
  | "starting"            // spawn 진행 중
  | "ready"               // 리스닝 확인됨
  | "waiting-for-login"   // progrok exit(1) "not logged in" — 로그인 전엔 spawn 금지
  | "backoff"             // 그 외 비정상 종료 — bounded 재시도 타이머 대기 중
  | "gave-up";            // backoff 예산 소진 (원인은 자격증명과 무관, 자동 복구 없음)
```

**감사 지적 B2 반영.** `gave-up`은 자동 재기동 대상이 **아니다**. 이 상태에는
바이너리 부재, 포트 점유, 일반 크래시가 섞여 있고, UI가 non-ready일 때 10초마다
폴링하므로(`ui/src/hooks/useGrokStatus.ts:22-24`) 여기서 ensure를 부르면
**폴링마다 자식을 하나씩 낳는 무한 루프**가 된다. 자동 재기동은 오직
`waiting-for-login`에서만 일어난다. 이것이 상태를 쪼갠 이유 그 자체다.

`waiting-for-login`을 `gave-up`과 분리하는 것이 이 변경의 핵심이다. 지금
코드는 둘을 같은 `return`으로 뭉개서(`lib/grokProxyLauncher.ts:172-176`),
"재시도해도 소용없다"는 옳은 판단이 "로그인하면 되는 상황"까지 막는다.

## 변경 1 — 핸들 확장 (`lib/grokProxyLauncher.ts`)

`startGrokProxy`의 반환 객체에 다음을 추가한다.

```ts
export interface GrokProxyHandle {
  readonly child: ChildProcess | null;
  readonly state: GrokProxyState;
  /** 멱등. SPAWNABLE 상태에서만 실제 spawn한다. */
  ensure(): Promise<GrokProxyState>;
  /** 로그인 성공 사건. waiting-for-login만 재무장한다. */
  notifyCredentialsChanged(): void;
  /** 비동기 프로브 시작 전에 찍어 둘 토큰. (3차 감사 B1) */
  probeToken(): GrokProbeToken;
  /** 프로브 성공 승격. 토큰이 낡았으면 무시된다. */
  markProbedReady(token: GrokProbeToken, url: string): boolean;
  kill(signal?: NodeJS.Signals): void;
  stop(signal?: NodeJS.Signals): void;
}

/** 불투명 토큰. 라우트가 launcher 내부(세대 카운터)를 알 필요가 없다. */
export type GrokProbeToken = { readonly gen: number };
```

**3차 감사 B1 반영.** 초판은 `markProbedReady(spawnGen, url)`를 보여주면서
`spawnGen`을 얻을 방법을 노출하지 않았다. 라우트는 fetch **이전에**
`probeToken()`을 받아 두고, 응답이 온 뒤 그 토큰으로 승격을 시도한다.
토큰을 불투명 타입으로 둔 이유는 세대 카운터가 런처 내부 사정이기 때문이다.

- `ensure()`: **멱등**이어야 한다 (감사 지적 B3). no-op 대상은
  `ready`, `starting`, **그리고 `backoff`**다. `backoff`는 이미 타이머가
  걸려 있으므로(`lib/grokProxyLauncher.ts:98-102`) 여기서 spawn하면 타이머가
  깨어날 때 자식이 둘이 된다.
  또한 spawn은 포트 선택을 `await`한 뒤에야 `currentChild`를 대입하므로
  (`lib/grokProxyLauncher.ts:105-130`) 그 사이 두 번째 호출이 통과할 수 있다.
  따라서 `ensure()`는 **동기적으로** `state = "starting"`을 먼저 찍고,
  진행 중 promise를 `inflight`에 보관해 동시 호출이 그것을 공유하게 한다.

  **2차 감사 반영.** 초판 의사코드는 산문과 어긋났다. `starting`을
  `inflight` 확인보다 먼저 return해서 동시 호출이 promise를 공유하지 못했고,
  `gave-up`/`waiting-for-login`이 spawn 가능한 채로 남아 무한 spawn 경로가
  그대로 있었다. 아래가 **그대로 구현 가능한** 최종 형태다.

  ```ts
  // spawn을 허용하는 상태는 이 둘뿐이다. 나머지는 전부 no-op.
  const SPAWNABLE = new Set<GrokProxyState>(["stopped", "gave-up-retryable"]);

  let inflight: Promise<GrokProxyState> | null = null;

  async function ensure(): Promise<GrokProxyState> {
    if (stopping) return state;           // ⓪ 종료 중엔 절대 살리지 않는다
    if (inflight) return inflight;        // ① 진행 중이면 무조건 공유
    if (!SPAWNABLE.has(state)) return state;  // ② ready/starting/backoff/
                                              //    waiting-for-login/gave-up
    state = "starting";                   // ③ 동기 전이 — 경합 창 제거
    inflight = spawnProxy()
      .then(() => state)
      .finally(() => { inflight = null; });
    return inflight;
  }
  ```

  **3차 감사 B5 반영 — 종료 게이트.** `stopping` 확인이 맨 앞에 와야 한다.
  `stop()`은 `stopping = true`를 세우고 그 시점의 자식만 죽이므로
  (`lib/grokProxyLauncher.ts:189-195`), 게이트가 없으면 셧다운 이후의
  `ensure()`가 좀비 자식을 낳는다.

  같은 이유로 `spawnProxy()` 안에서도 **포트 선택 await 직후** 한 번 더
  확인해야 한다 (`lib/grokProxyLauncher.ts:105`). await 중에 셧다운이
  시작되면, 깨어난 코드가 아무도 추적하지 않는 자식을 spawn하게 된다.

  ```ts
  port = await findAvailablePort(requestedPort, { host });
  if (stopping) { state = "stopped"; return; }   // await 이후 재확인
  ```

  핵심은 순서다. `inflight` 확인이 **가장 먼저** 와야 `starting` 중인
  동시 호출도 같은 promise를 받는다.

  `waiting-for-login`이 `SPAWNABLE`에서 빠진 것이 2차 감사 B1의 답이다.
  그 상태 자체가 "직전 자식이 자격증명을 못 찾았다"는 증거이므로, **자격증명이
  바뀌었다는 양의 증거 없이** 다시 띄우면 폴링 주기마다 자식을 낳는다.
  상태를 spawn 가능하게 바꾸는 유일한 경로는 `notifyCredentialsChanged()`다.

- `notifyCredentialsChanged()`: 상태를 spawn 가능하게 만드는 **유일한 문**이다.

  ```ts
  function notifyCredentialsChanged(): void {
    credentialGeneration += 1;            // 항상 올린다 (starting 중 로그인 대비)
    if (state !== "waiting-for-login") return;   // gave-up은 건드리지 않는다
    authRequired = false;
    restartAttempt = 0;                   // 인증 원인일 때만 예산 리셋
    state = "gave-up-retryable";          // ← SPAWNABLE로 전이
    void ensure();
  }
  ```

  `gave-up`(자격증명과 무관한 원인으로 예산 소진)은 **건드리지 않는다**.
  로그인이 바이너리 부재나 포트 점유를 고칠 리 없다.

  `starting` 중에 로그인이 끝나는 경우를 결정적으로 만들기 위해
  `credentialGeneration` 카운터를 둔다. spawn은 시작 시점 카운터를 기억하고,
  자식이 `waiting-for-login`으로 죽을 때 현재 카운터와 비교한다. 그 사이
  값이 올라갔다면 **로그인 이전에 뜬 낡은 자식의 죽음**이므로, 그때
  `notifyCredentialsChanged()`와 같은 전이를 한 번 수행한다.

`exit` 핸들러의 현재 조기 `return`(`:172-176`)은 `state =
"waiting-for-login"` 설정으로 바뀐다. 메시지는 유지한다 — 사용자에게 여전히
유효한 안내다.

## 변경 2 — 핸들을 라우트에 노출 (`server.ts`)

> **정정 (감사 지적 B1).** 반환값은 이미 `grokChild`에 저장되어 있고
> (`server.ts:457`) 셧다운 클로저가 붙잡고 있다 (`server.ts:481-482`).
> 진짜 문제는 (1) 그 API가 종료 전용이고, (2) `startServer` 지역 변수라
> 라우트에서 볼 수 없다는 점이다.

따라서 할 일은 "보관"이 아니라 **노출**이다. 핸들을 ctx에 붙인다.

```ts
const grokProxy = ctx.config.grokProvider.autoStart ? await startGrokProxy({...}) : null;
ctx.grokProxy = grokProxy;   // RuntimeContext에 optional 필드 추가
```

`lib/runtimeContext.ts`의 타입에 `grokProxy?: GrokProxyHandle`을 더한다.
테스트 컨텍스트가 이 필드를 갖지 않아도 되도록 반드시 optional로 둔다.

`GrokProxyHandle`은 현재 익명 반환 타입이므로(`lib/grokProxyLauncher.ts:184`)
**명시적 export 타입으로 승격**해야 한다 (감사 지적 B7).

## 변경 3 — 로그인 성공이 재기동을 부른다 (`routes/auth.ts`)

`saveGrokTokens(tokens)` 직후, 세션을 `complete`로 표시하기 전에
재기동 사건을 발화한다 (`routes/auth.ts:119-123`).

```ts
saveGrokTokens(tokens);
ctx.grokProxy?.notifyCredentialsChanged();
session.status = "complete";
```

`registerAuthRoutes(app)`는 현재 ctx를 받지 않으므로
`registerAuthRoutes(app, ctx)`로 시그니처를 넓힌다. 호출부는
`routes/index.ts` 한 곳이다.

옵셔널 체이닝이 중요하다. `autoStart`가 꺼진 배포에서는 핸들이 없고,
그때 로그인은 여전히 성공해야 한다.

## 변경 4 — 상태 조회는 관찰만 한다 (`routes/grok.ts`)

**2차 감사 B1 반영: 상태 조회는 자가 치유하지 않는다.** 프로브 실패 시
`ensure()`를 부르지 않는다. `waiting-for-login`에서 폴링마다 ensure를
부르면 그것이 곧 무한 spawn이다. 상태 라우트는 **읽기 전용**이고, 재기동은
오직 로그인 사건에서만 일어난다.

반대 방향만 남긴다 (감사 지적 B4): 프로브가 **성공**했는데 감독자 상태가
`ready`가 아니면 상태를 올린다. stdout 파싱은 `127.0.0.1|localhost`만
인식하므로 (`lib/grokProxyLauncher.ts:50`) 커스텀 호스트에서는 영영
`starting`에 머무를 수 있다.

단, 2차 감사 B4가 지적한 두 위험을 막아야 한다.

```ts
// routes/grok.ts — fetch 전에 토큰을 찍는다
const token = ctx.grokProxy?.probeToken();
const r = await fetch(getGrokProxyUrl(ctx, "/v1/models"), { signal: ... });
if (r.ok && token) ctx.grokProxy?.markProbedReady(token, getGrokProxyBaseUrl(ctx));

// lib/grokProxyLauncher.ts — 승격은 두 조건을 모두 만족할 때만
function markProbedReady(token: GrokProbeToken, url: string): boolean {
  if (stopping) return false;
  if (token.gen !== spawnGeneration) return false;  // 낡은 응답 무시
  if (!currentChild) return false;                  // 자식이 이미 죽었으면 무시
  onReadyInternal({ url, port: portOf(url) });      // stdout ready와 같은 경로
  return true;
}
```

- **낡은 응답 승격 금지**: 프로브가 날아간 뒤 자식이 죽어 `waiting-for-login`이
  됐는데 늦게 도착한 200이 그걸 `ready`로 덮는 문제
  (`lib/grokProxyLauncher.ts:167`에서 `currentChild`가 먼저 null이 된다).
  세대 번호와 `currentChild` 생존을 함께 확인해 막는다.
- **advertise 동기화**: stdout ready와 **같은 콜백**을 타야 한다. 아니면
  감독자만 `ready`가 되고 `ctx.grokProxyLive`는 false로 남아,
  `/api/models`는 ready인데 advertise는 null인 새 모순이 생긴다.

응답에 `state` 필드를 추가해 UI가 "왜" 죽었는지 구분할 수 있게 한다.
기존 `status` 값은 호환을 위해 유지한다.

## 테스트 (실패 우선)

`tests/grok-proxy-supervisor-contract.test.ts` 신설.

1. `waiting-for-login` 상태에서 `notifyCredentialsChanged()`가
   재spawn을 유발한다 (수정 전 실패).
2. `waiting-for-login`에서만 `restartAttempt` 예산이 리셋된다.
   `gave-up`에서는 재기동 사건이 와도 **리셋되지 않고 spawn도 없다**
   (2차 감사 B3 — 초판 테스트 2와 정면 충돌했던 항목을 이렇게 정정한다).
3. `ready` 상태에서 `ensure()`는 새 프로세스를 만들지 않는다 (멱등).
4. `restartPlan`의 bounded 성질은 그대로다 — 크래시 루프 보호 회귀 방지.
5. `gave-up` 상태에서 `ensure()`를 반복 호출해도 새 자식이 생기지 않는다.
6. `backoff` 상태에서 `ensure()`는 no-op이다 (이중 spawn 방지).
7. 동시 `ensure()` 두 번이 자식을 하나만 만든다 (inflight 공유).
8. `waiting-for-login`에서 `ensure()`를 반복 호출해도 자식이 생기지 않는다
   (2차 감사 B1 — 폴링 유발 무한 spawn 회귀 방지).
9. 죽은 자식의 세대로 온 `markProbedReady`는 상태를 `ready`로 올리지 못한다
   (2차 감사 B4 — 낡은 승격 회귀 방지).
10. **양성 경로**: 현재 세대 + 살아있는 자식으로 온 `markProbedReady`는
    상태를 `ready`로 올리고 **외부 `onReady` 콜백까지 호출한다**.
    즉 `ctx.grokProxyLive`가 true가 되고 advertise가 갱신된다
    (3차 감사 B4 — 상태/advertise 어긋남 회귀 방지).
11. **로그인이 `starting` 중에 도착하는 경우** (3차 감사 B3, 핵심 레이스):
    첫 자식이 `starting`인 동안 `notifyCredentialsChanged()`가 오고,
    그 자식이 이어서 auth-required로 죽으면, 교체 자식이 **정확히 하나만**
    뜬다. `credentialGeneration`의 존재 이유를 직접 검증하는 테스트다.
12. `stop()` 이후의 `ensure()`는 새 자식을 만들지 않는다
    (3차 감사 B5 — 셧다운 이후 좀비 spawn 회귀 방지).

새 테스트 파일을 추가하므로 `npm run test:inventory`가 생성하는
`docs/migration/runtime-test-inventory.md`를 **함께 갱신**해야 한다
(감사 지적 B8). 갱신 없이는 `test:inventory`가 stale로 실패한다.

런처는 이미 `progrokBinPath` 주입을 지원하므로(`:123`), 가짜 스크립트로
exit(1)을 재현할 수 있다. 실제 progrok을 띄우지 않는다.

## 라이브 검증

격리 HOME에서: 서버 기동 → `/api/grok/status`가 offline →
`~/.progrok/auth.json` 기록 + 재기동 사건 → 같은 서버 pid 유지한 채
status가 ready. **pid가 변하지 않았음을 반드시 함께 기록한다.**
