---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, grok, progrok, proxy, supervision, auth]
---

# 000 — Grok 프록시 감독(supervision) 재설계 조사

## 증상

GUI에서 Grok 로그인을 마쳐도 설정 화면의 Grok 칩이 계속 `Disconnected`로
남는다. ima2 서버를 재시작하면 그때서야 정상이 된다.

## 실측 재현 (2026-08-19, opus-5)

격리 HOME으로 로그인 안 된 상태를 만들고 서버를 띄우면 결정적으로 재현된다.

```
TMPD=$(mktemp -d)
HOME=$TMPD IMA2_GROK_PROXY_PORT=18690 ... node server.js

Starting bundled progrok proxy for Grok images at http://127.0.0.1:18690/v1 ...
[grok] Not logged in. Run `ima2 grok login` first.
[grok] Grok OAuth is not logged in. Run `ima2 grok login` to enable Grok images/video.
[grok] Continuing without auto-restarting the Grok proxy. ...
```

이 시점부터 프록시 포트에는 리스너가 없고, 프로세스 수명 내내 없다.

## 결함 1 — 인증 실패가 복구 불가능한 종착 상태다

원인은 두 계약이 맞물린 자리에 있다.

1. progrok의 `proxy` 명령은 **기동 시점에 자격증명을 하드 체크**한다.
   (`progrok/src/commands/proxy.ts:22-26` — `loadTokens()`가 비면
   `log.error("Not logged in")` 후 `process.exit(1)`.)
   즉 progrok은 "로그인 없이 떠서 기다리는" 모드가 없다.
2. ima2의 런처는 그 exit(1)을 보고 **의도적으로 재시작을 포기**한다.
   (`lib/grokProxyLauncher.ts:170-177` — `authRequired && code !== 0`이면
   `scheduleRestart()`를 호출하지 않고 `return`.)

포기 자체는 합리적이다. 로그인이 안 된 상태에서 6번 재시도해봐야 똑같이
exit(1)일 뿐이고, 크래시 루프만 만든다. 문제는 **그 포기가 되돌릴 수 없다**는
점이다. 로그인은 포기의 전제를 무효화하는 사건인데, 그 사건이 런처에
전달되지 않는다.

## 결함 1의 나머지 절반 — 로그인이 재기동을 트리거하지 않는다

GUI 로그인은 `POST /api/auth/switch` (provider=grok)로 들어와
`routes/auth.ts`의 `saveGrokTokens()`가 `~/.progrok/auth.json`을
원자적으로 쓰고 세션을 `complete`로 표시하는 것으로 끝난다.
(`routes/auth.ts:47-73`, `routes/auth.ts:118-123`.)

그런데 죽은 프록시를 되살리는 경로가 존재하지 않는다.

> **정정 (감사 지적 B1, 2026-08-19).** 초판은 "핸들을 어디에도 보관하지
> 않는다"고 썼는데 이는 사실이 아니다. `server.ts:457`에서 `grokChild`에
> 대입되고 셧다운 클로저가 이를 붙잡고 있다 (`server.ts:481-482`).
> 정확한 사실은 두 가지다: (1) 그 핸들이 노출하는 API가 `stop`/`kill`
> **종료 전용**이라 되살릴 수단이 없고 (`lib/grokProxyLauncher.ts:184-196`),
> (2) 핸들이 `startServer` 지역 변수라 **라우트에서 접근할 수 없다**.
> 로그인을 처리하는 `routes/auth.ts`는 그 존재조차 모른다.

즉 결함은 "핸들 부재"가 아니라 **재기동 API 부재 + 소유권 미노출**이다.

그 결과 `GET /api/grok/status`는 리스너 없는 포트로 계속 fetch하고
(`routes/grok.ts:10-21`), 예외를 삼켜 `{status:"offline"}`을 돌려준다.
`useGrokStatus`는 **ready가 아닐 때만** 10초 후 재폴링을 예약하고
(`ui/src/hooks/useGrokStatus.ts:22-24`), `AccountSettings`가 그 값으로
Disconnected 칩을 그린다 (`ui/src/components/AccountSettings.tsx:113-114`).

폴링이 조건부라는 점은 양방향으로 의미가 있다. 죽은 동안에는 재시도가
계속되므로 **복구를 관찰**할 수 있지만, 일단 ready를 한 번 받으면 폴링이
**영구히 멈춘다**. 이후 프록시가 죽어도 칩은 Ready로 남는다 (감사 지적).

폴링이 복구를 **개시하지는 않는다**는 점을 분명히 해 둔다 (3차 감사 B2).
상태 조회가 재기동을 트리거하면, 로그인 전에는 폴링 주기마다 자식을 낳는
무한 spawn이 된다. 재기동의 유일한 방아쇠는 로그인 사건이다.

**로그인은 성공했고, 죽은 것은 전송 계층이다.** UI는 정직하게 죽은 전송을
보고하고 있었을 뿐이다.

## 결함 2 — advertise 파일이 죽은 포트를 광고한다

같은 영역에서 독립적인 두 번째 결함이 확인된다. 실측:

| 출처 | grok 포트 |
|---|---|
| `/api/health` (살아있는 서버 pid 34239) | **18646** |
| `~/.ima2/server.json` (advertise 파일) | **18647** |
| 실제 리스너 | 18646 (ima2 관리), 18645 (관리 밖 progrok) |

`curl 127.0.0.1:18647/v1/models` → 연결 실패, `18646` → 200.

advertise 파일은 예전 실행이 남긴 값을 들고 있다.

> **정정 (감사 지적 B5).** "포트가 바뀔 때 갱신되지 않는다"는 초판 서술은
> 틀렸다. `onPortSelected`/`onReady`가 이미 `advertise(ctx)`를 부른다
> (`server.ts:462-469`). 빠진 것은 **자식이 죽는 순간**뿐이다.
> 또한 저장소 안의 소비자(`bin/lib/client.ts`,
> `integrations/comfyui/.../nodes.py`)는 `server.json`의 backend 부분만
> 읽고 `grok` 절은 읽지 않는다 — grep으로 확인. 따라서 "지금 CLI가 죽은
> 포트로 간다"는 주장은 근거가 없다. 실제 위험은 **미래 소비자와 외부
> 클라이언트**, 그리고 진단 시 사람이 이 파일을 믿는 경우다.

결함의 본질은 유지된다: 파일이 리스너 없는 포트를 계속 광고한다.

## 결함 3 — lane 상태가 실제 전송을 반영하지 않는다

`routes/models.ts:119-124`의 `grokLane`은 URL이 **설정되어 있기만 하면**
`status: "ready"`를 돌려준다. reason 문자열이 그 사실을 자백한다:
`"configured proxy endpoint; live session not probed"`.

실측으로도 이 불일치가 잡힌다. 현재 개발기에서
`/api/models`의 grok lane은 `ready`인데, 같은 서버의
`/api/grok/status`는 실제 프로브를 돌린다. 전송이 죽은 상황에서는 전자가
`ready`, 후자가 `offline`으로 갈린다. 한 서버가 같은 프로바이더를 두고
서로 모순되는 두 답을 내놓는 상태다.

## 사용자 질문에 대한 답: progrok을 따로 띄워야 하나

아니다. 따로 띄우는 건 증상 회피지 수정이 아니다. 실제로 지금 개발기에는
관리 밖 progrok이 18645에 떠 있는데(pid 3012), 그것이 있음에도 GUI는
Disconnected였다. ima2가 자기 자식 프로세스만 바라보기 때문이다. 수동으로
하나 더 띄우면 포트 경합과 "누가 진짜인지" 모호함만 늘어난다.

올바른 방향은 **ima2가 프록시 수명주기의 단일 소유자가 되는 것**이다.

## 설계 방향 (opencodex 참조)

opencodex는 같은 문제(로컬 프록시를 오래 살려두기)를 감독 구조로 푼다.
ima2가 가져올 것은 구조지 코드가 아니다. 상세 대조는 `001_opencodex.md`.

핵심은 세 가지다.

- **ensure 진입점**: "지금 살아 있나? 아니면 살려라"를 한 곳에서 수행하는
  멱등 함수. 부팅 때만 실행되는 spawn이 아니라, 언제든 호출 가능한 입구.
- **재기동 사건(re-arm)**: 로그인 성공은 포기 상태를 무효화하는 명시적
  사건이다. 백오프 예산을 리셋하고 ensure를 부른다. 크래시 루프 보호는
  그대로 두되, 되돌릴 수 있게 만든다.
- **프로브 기반 상태**: 준비 상태는 부팅 시점의 가정이 아니라 실제 프로브에서
  파생한다. advertise 파일도 같은 원칙을 따른다 — 리스너 없는 포트는
  광고하지 않는다.

## 범위 밖

progrok 저장소 자체는 건드리지 않는다. `exit(1)` 계약은 외부 의존성의
사실로 받아들이고 ima2 쪽에서 적응한다. progrok을 "로그인 없이도 떠서
401을 돌려주는" 모드로 고치는 건 별도 판단이 필요한 다른 작업이다.
