# 000 — ima2 stop + ima2 service: Plan

## Objective

`ima2 stop`(안전 종료)과 `ima2 service`(launchd/systemd 백그라운드 서비스)를
opencodex의 `ocx stop`/`ocx service` 성숙도 기준으로 구현한다.

## Evidence base (연구, 2026-08-21)

### ima2 현재 상태
- 서버 수명주기: `bin/ima2.ts` serve()가 `server.js`를 child spawn(stdio inherit),
  SIGINT/SIGTERM → `killProcessTree(child.pid)` (bin/lib/platform.js).
- 광고 파일: `server.ts` advertise()가 `config.storage.advertiseFile`
  (기본 ~/.ima2/server.json, IMA2_ADVERTISE_FILE 오버라이드)에
  {port,url,pid,startedAt,version,backend,oauth,grok} 기록. unadvertise()는
  cur.pid === process.pid일 때만 삭제 (server.ts:329-349).
- 종료 훅: server.ts:510 shutdownServerAndMcp (SIGINT 클린 셧다운). oauth/grok
  프록시는 lib/oauthLauncher.ts / lib/grokProxyLauncher.ts가 stop(SIGTERM) 제공.
- 헬스: GET /api/health → {ok,version,pid,startedAt} (routes/health.ts:40-48).
- 싱글턴 가드: serve()가 findRunningServer()로 이미 실행 중이면 안내 후 종료.
- **stop API 없음**, **stop/service 커맨드 없음**.

### opencodex 성숙 패턴 (../opencodex — 참조만, 코드 복사 금지)
- graceful stop: POST /api/stop 우선, 실패 시 SIGTERM→waitForExit(폴링)→SIGKILL.
  pid 재사용 방지 verifyPidIdentity. "refused"(409)는 강제 킬 금지.
- service: macOS launchd plist(RunAtLoad+KeepAlive), Linux systemd user unit.
  service-state.json에 설치 당시 홈/경로 기록. launchctl 함정 처리(load 실패해도
  exit 0 → stderr 파싱), launchctl print로 라이브 arguments 검증. repair =
  경로 이동 후 재설치. status는 설치상태+라이브 신원 동시 보고.
- 서비스-관리 재시작과 수동 정지 분리: 서비스 환경 변수로 셧다운 핸들러 분기.

## Loop-spec

- Loop archetype: spec-satisfaction
- Write scope: bin/commands/{stop,service}.ts(신규), bin/ima2.ts 라우팅/help,
  bin/lib/, lib/processControl(신규), routes/(stop API 필요시), server.ts 최소,
  tests/, README.md, structure/
- Out-of-scope: opencodex 코드 복사, Windows 완전 서비스(안내만), npm 배포, main push
- Budget: 무제한(사용자 grant); push는 dev 한정.
- Verification: typecheck + npm test + test:inventory + macOS 라이브 검증

## Work-phase map

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| swp0 | 000 | 로드맵 (docs-only) | — |
| swp1 | 010 | ima2 stop + 프로세스 제어 + stop API | — |
| swp2 | 020 | ima2 service (launchd/systemd) | swp1 |
| swp3 | 030 | 테스트 + 문서 | swp2 |
| swp4 | 040 | 라이브 검증 + opus 리뷰 + push | swp3 |

## Accept criteria: goalplan criteria[] (sc-stop/service/tests/live/final) 미러
