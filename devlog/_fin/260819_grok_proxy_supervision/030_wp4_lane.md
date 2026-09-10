---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, grok, models, lane, wp4]
---

# 030 — WP4: lane 상태를 실제 감독자 상태와 일치시킨다

결함 3을 고친다.

## 문제

`routes/models.ts:119-124`의 `grokLane`은 URL 문자열이 존재하기만 하면
`ready`를 반환한다. reason이 스스로 자백한다:
`"configured proxy endpoint; live session not probed"`.

결과적으로 한 서버가 같은 프로바이더에 대해 모순된 두 답을 낸다.
`/api/models`는 `ready`, `/api/grok/status`는 `offline`.

## 설계 결정 — 여기서 프로브를 새로 돌리지 않는다

> **감사 지적 B4.** "감독자 상태를 읽는다"만으로는 모순이 남는다. 감독자의
> `ready`는 자식 stdout 파싱에서만 오는데, 그 정규식은
> `127.0.0.1|localhost`만 인식한다 (`lib/grokProxyLauncher.ts:50`).
> 설정 호스트는 임의값일 수 있으므로(`config.ts:317`), 커스텀 호스트에서는
> `/api/grok/status` 프로브가 200을 받아 `ready`인데 감독자는 `starting`에
> 머물러 `/api/models`가 `disconnected`를 내는 **반대 방향 모순**이 생긴다.
>
> 해결은 WP2에 있다: 프로브 성공이 감독자 상태를 끌어올린다
> (`markProbedReady`). 실제 성공한 HTTP 응답은 stdout 문자열보다 강한
> 증거다. WP4는 그렇게 정정된 상태를 읽는다.

`/api/models`는 여러 lane을 합성하는 목록 엔드포인트다. 여기서 네트워크
프로브를 돌리면 응답 시간이 프록시 타임아웃에 묶인다. 나쁜 거래다.

대신 **감독자가 이미 아는 상태를 읽는다**. WP2에서 `ctx.grokProxy?.state`가
생기므로 lane은 매핑만 하면 된다. 추가 비용 0, 새 실패 모드 0.

**2차 감사 B5 반영.** 초판 코드는 `starting`까지 `disconnected`로 떨어뜨려
바로 아래 산문과 모순이었다. 모든 상태를 명시적으로 적는다 — catch-all이
모순의 원인이었으므로 catch-all을 없앤다.

```ts
const UNPROBED = "configured proxy endpoint; live session not probed";

function grokLaneState(ctx: RuntimeContext): LaneState {
  if (!ctx.grokUrl) return { status: "disconnected", reason: "Grok proxy not configured" };
  switch (ctx.grokProxy?.state) {
    case "ready":
      return { status: "ready" };

    // 아직 확정되지 않은 과도 상태 — 기존 동작 유지 (부팅 깜빡임 방지)
    case "starting":
    case "backoff":            // bounded 재시도 중: 곧 살아날 수 있다
    case "gave-up-retryable":
      return { status: "ready", reason: UNPROBED };

    // 확정적으로 나쁜 상태만 disconnected
    case "waiting-for-login":
      return { status: "disconnected", reason: "Grok login required" };
    case "gave-up":
      return { status: "disconnected", reason: "Grok proxy failed to start" };
    case "stopped":
      return { status: "disconnected", reason: "Grok proxy stopped" };

    // 감독자 없음 (autoStart 비활성 / 테스트 컨텍스트) — 기존 계약 그대로
    case undefined:
    default:
      return { status: "ready", reason: UNPROBED };
  }
}
```

`backoff`를 `ready`쪽에 둔 것은 판단이다. bounded 재시도 중이라는 것은
아직 실패가 확정되지 않았다는 뜻이고, 몇 초짜리 재시도 창에서 lane을
깜빡이게 하면 사용자에게 노이즈만 준다. 확정 실패는 `gave-up`이 표현한다.

`st === undefined`(감독자 없음 = autoStart 비활성 또는 테스트 컨텍스트)에서
기존 동작을 그대로 두는 것이 중요하다. 그래야 기존 계약 테스트를 깨지 않는다.

`starting`도 `disconnected`로 내리지 않는다. 부팅 직후 몇 백 ms 동안
lane이 깜빡이는 것은 개선이 아니라 새 소음이다. `starting`은 기존 문구를
유지하고, 확정적으로 나쁜 상태(`waiting-for-login`, `gave-up`, `stopped`)만
`disconnected`로 내린다.

## 테스트 (실패 우선)

`tests/models-endpoint-contract.test.ts`에 케이스를 추가한다.

1. `grokProxy.state = "waiting-for-login"`이면 lane이 `disconnected`이고
   reason이 로그인 필요를 말한다 (수정 전 실패: 지금은 ready).
2. `state = "ready"`면 lane도 ready.
3. 감독자가 없으면(`undefined`) 기존 문구 그대로 (회귀 방지).
4. `starting`은 `disconnected`가 **아니다** — 부팅 깜빡임 방지
   (2차 감사 B5).
5. `backoff`도 `disconnected`가 아니다 (재시도 중은 확정 실패가 아니다).
6. `gave-up`과 `stopped`는 `disconnected`다.

## UI 파급

없다. `grokLane`은 이미 `disconnected`를 표현할 수 있고
(`routes/models.ts:33`), UI도 그 상태를 이미 처리한다. 서버가 정직해질 뿐이다.

## 별도 관찰 — 폴링이 멈추는 문제 (범위 밖)

`useGrokStatus`는 ready를 한 번 받으면 재폴링을 예약하지 않는다
(`ui/src/hooks/useGrokStatus.ts:22-24`). 따라서 나중에 프록시가 죽어도 칩은
Ready로 남는다. 이번 작업의 목표(로그인 후 살아나기)와는 반대 방향 결함이고
UI 폴링 정책 변경이 필요하므로 **이번 범위에 넣지 않는다**. 후속 유닛
후보로 기록만 해 둔다.
