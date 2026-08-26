---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, opencodex, proxy, supervision, reference]
---

# 001 — opencodex 감독 구조 대조 (설계 참조)

조사 기준 opencodex commit `1a31d47f5`. 독립 서브에이전트(sol medium) 조사 +
본체 교차 확인. 파일 수정 없음.

## 먼저, 기대와 다른 결론 하나

"opencodex 방식으로 고치자"는 출발점이었지만, **로그인 복구에 관해서는
opencodex를 따라가면 안 된다.** 조사 결과 opencodex의 로그인 경로는
살아있는 프록시에만 reload를 요청하고, 죽어 있으면 `null`을 반환하고
아무것도 하지 않는다
(`src/oauth/login-cli.ts:36`, `src/oauth/login-cli.ts:78`).

즉 opencodex의 로그인-시점 정책을 그대로 옮기면 **지금 ima2 버그를 그대로
보존**하게 된다. opencodex에서 이 구조가 문제되지 않는 이유는 GUI OAuth를
프록시 자신이 제공하기 때문이다 — 프록시가 죽어 있으면 로그인 화면 자체가
없다 (`src/server/management/oauth-account-routes.ts:135`). ima2는 정반대다.
ima2 서버가 로그인을 받고, 프록시는 별도 자식 프로세스다. 그래서 "죽은
프록시를 GUI로 로그인시킨다"는 상황이 ima2에서만 존재한다.

가져올 것은 opencodex의 **로그인 정책이 아니라 감독 구조**다.

## 채택 1 — ensure 멱등 진입점

`ocx ensure`는 "살아 있나 확인하고, 아니면 살린다"를 한 함수로 수렴시킨다
(`src/cli/index.ts:431-489`). 순서가 참고할 만하다.

1. identity 확인된 `/healthz` 조회로 실제 생존 판정 (`src/cli/index.ts:195`)
2. autostart가 꺼져 있으면 아무것도 시작하지 않음 (`src/cli/index.ts:439`)
3. 이미 살아 있으면 동기화만 수행하고 성공 (`src/cli/index.ts:446`)
4. 죽어 있으면 한 번 spawn 후 최대 8초, 150ms 간격으로 생존 대기
   (`src/cli/index.ts:471`, `src/cli/index.ts:96`)
5. 살아난 **실제 포트**로 설정을 동기화 (`src/cli/index.ts:480`)

ima2에 옮길 형태: `ensure()` — 멱등 진입점 하나로 수렴한다. 이미 살아
있으면 no-op, 살릴 수 있는 상태면 살린다.

**단, opencodex와 다른 점 하나** (3차 감사 B2). opencodex의 `ensure`는
CLI가 명시적으로 부르는 명령이지만, ima2에서 이에 대응하는 자리는
**부팅과 로그인 사건뿐**이다. 상태 조회(`/api/grok/status`)는 ensure를
부르지 않는다. UI가 10초마다 폴링하므로, 상태 조회가 재기동을 개시하면
로그인 전까지 폴링 주기마다 자식을 낳는 무한 spawn이 된다. 상태 조회는
**관찰만** 한다.

## 채택 2 — 광고 전에 bind, 죽으면 철회

opencodex는 **실제 포트에 bind한 뒤에만** 런타임 상태를 원자적으로 기록하고
(`src/cli/index.ts:243`, `src/config.ts:3492`), 정상 종료 시 자기 PID
조건부로 제거한다 (`src/cli/index.ts:294`).

더 중요한 건 **파일을 믿지 않는다**는 점이다. 비정상 종료로 파일이 남아도
소비자가 `/healthz` 마커와 예상 PID, 실제 응답을 재검증한다
(`src/server/proxy-liveness.ts:96`, `:136`). stale 정리도 프로브 직전
스냅샷과 PID가 여전히 같을 때만 지워서, 동시에 뜬 새 프로세스의 상태를
지우지 않는다 (`src/config.ts:3753`).

ima2의 결함 2가 정확히 이 원칙의 부재다. `advertise()`가 포트 변경과
프로세스 사망 시점에 다시 불리지 않아 값이 낡는다.

## 채택 3 — liveness와 readiness 분리

opencodex는 두 축을 나눈다. `/healthz`는 리스너가 붙는 즉시 200을 주는 순수
liveness (`src/server/index.ts:813`), `/readyz`는 더 엄격한 준비 상태
(`src/server/index.ts:834`).

ima2에도 같은 구분이 필요하다. "포트가 열렸다"와 "인증까지 되어 실제로 쓸 수
있다"는 다른 질문이고, 지금 `grokLane`은 그보다 못한 세 번째 것 — "설정
문자열이 존재한다" — 을 ready로 부르고 있다 (`routes/models.ts:119-124`).

## 건너뛸 것

조사에서 명시적으로 걸러낸 항목들이다.

- **launchd/systemd/Task Scheduler/WinSW 서비스 계층 전체**
  (`src/service.ts:392`, `:1544`, `:2440`, `src/lib/winsw.ts:115`).
  opencodex는 지속 감독을 OS에 위임하지만, ima2에는 이미 오래 사는 부모
  프로세스(ima2 serve)가 있다. 서비스 설치는 순수 과잉이다.
- **부팅 1회성 readiness 게이트** (`src/server/readiness.ts:26-54`).
  `pending → ready|failed`로 **단 한 번만** 전이한다. progrok 자격증명은
  런타임에 생기므로, ima2의 실패 상태는 로그인 사건으로 다시 열려야 한다.
  한 번 닫히면 끝인 게이트를 쓰면 지금 버그를 구조로 굳히는 셈이다.
- **고정 5초 무한 재시작** (`src/service.ts:1544`). "로그인 필요" exit를
  크래시처럼 다루면 hot loop가 된다. ima2의 기존 bounded backoff가 이 점에서는
  오히려 더 낫다 — 유지하되 되돌릴 수 있게만 만든다.
- **프로세스 결합 암호학적 reload 권한**
  (`src/server/local-provider-reload-client.ts:38`). 같은 부모 안에서의
  함수 호출에는 세대(generation) 카운터와 PID 확인이면 충분하다.

## 정리 — ima2가 취할 상태 모델

opencodex 조사에서 추린 결론은 상태를 명시화하라는 것이다.

```
stopped ──spawn──> starting ──listening──> ready
   ^                   │
   │                   ├─ exit(1) + "not logged in" ─> waiting-for-login
   │                   └─ 기타 비정상 종료 ──────────> backoff(bounded)
   │                                                      │
   └──────────────── give-up ─────────────────────────────┘

login 성공 ──> waiting-for-login 만 무효화 ──> ensure 재실행
              (gave-up 은 건드리지 않는다: 원인이 자격증명이 아니므로)
```

핵심은 `waiting-for-login`을 **backoff와 다른 상태로 분리**하는 것이다.
지금 코드는 둘을 같은 "포기"로 뭉쳐 놓아서, 재시도해도 소용없다는 올바른
판단이 재시도하면 되는 상황까지 함께 막아버린다.
