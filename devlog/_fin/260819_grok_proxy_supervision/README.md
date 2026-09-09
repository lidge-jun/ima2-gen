---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, grok, progrok, roadmap]
---

# 260819c — Grok 프록시 감독 재설계

GUI 로그인 후에도 Grok이 계속 `Disconnected`로 남는 문제를 고친다.

## 문서

| 문서 | 내용 |
|---|---|
| `000_research.md` | 결함 3종 실측 재현과 근본 원인 |
| `001_opencodex.md` | opencodex 감독 구조 대조 (채택/건너뛸 것) |
| `010_wp2_supervisor.md` | WP2 — 감독자 도입 + 로그인 재기동 |
| `020_wp3_advertise.md` | WP3 — advertise가 죽은 포트를 광고하지 않음 |
| `030_wp4_lane.md` | WP4 — lane 상태를 감독자 상태와 일치 |

## 결함 요약

1. **인증 실패가 종착 상태다.** progrok은 로그인 없으면 exit(1)하고
   (`progrok/src/commands/proxy.ts:22-26`), 런처는 그때 재시작을 포기한다
   (`lib/grokProxyLauncher.ts:172-176`). 로그인해도 되살릴 입구가 없다.
2. **advertise 파일이 죽은 포트를 광고한다.** 자식이 죽는 순간에
   `advertise()`가 다시 불리지 않는다.
3. **lane 상태가 전송 상태와 무관하다.** URL 문자열만 있으면 `ready`
   (`routes/models.ts:119-124`).

## 감사 이력

독립 서브에이전트 적대적 감사 4라운드: FAIL → FAIL → FAIL → PASS.

주요 지적과 처리:

- (R1-B1) "핸들을 보관하지 않는다"는 **내 초판 서술이 틀렸다**. 핸들은
  `server.ts:457`에 있다. 진짜 결함은 종료 전용 API + 라우트 미노출.
  → 000/010 정정.
- (R2-B1) 상태 조회가 ensure를 부르면 폴링 주기마다 자식을 낳는다.
  → 상태 라우트는 **관찰만** 하도록 설계 변경.
- (R2-B4/R3-B4) 늦게 도착한 프로브 응답이 죽은 프록시를 `ready`로 승격.
  → 세대 토큰 + 자식 생존 확인, 승격은 stdout과 **같은 콜백**을 탄다.
- (R3-B5) `stop()` 이후 `ensure()`가 좀비 자식을 낳는다.
  → `stopping` 게이트를 ensure 최상단과 포트 선택 await 직후에.

## 실행 순서

WP2(010) → WP3(020) → WP4(030). 각각 독립 PABCD 사이클이며, 실패 우선
테스트와 격리 HOME 라이브 검증을 각 사이클의 C에서 요구한다.

## 범위 밖

- progrok 저장소 자체 (exit(1) 계약은 외부 의존성 사실로 수용)
- `useGrokStatus`가 ready 이후 폴링을 멈추는 문제 (030에 후속 후보로 기록)
- `routes/health.ts`의 동일 불일치 (020에 남은 간극으로 기록)
- 관리 밖 progrok 프로세스 정리 (사용자 소유)
