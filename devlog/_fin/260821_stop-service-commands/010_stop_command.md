# 010 — ima2 stop + 프로세스 제어 헬퍼 (swp1)

## 설계

정지 시퀀스 (opencodex 의미론, ima2 구조에 맞게):
1. `~/.ima2/server.json` 읽기 (config.storage.advertiseFile 경유 — IMA2_CONFIG_DIR 존중)
2. 파일 없음/파싱 실패 → "not running" + exit 0 (멱등)
3. **pid 신원 검증**: pid 살아있는지(kill(pid,0)) + GET http://127.0.0.1:{port}/api/health
   응답의 pid가 파일의 pid와 일치하는지. 불일치 → stale 파일 정리 후 "not running".
   (재사용된 pid를 절대 죽이지 않는다)
4. **graceful**: POST /api/admin/stop (신규, 아래) → 200이면 waitForExit(pid, 8000ms)
5. **에스컬레이션**: graceful 실패/timeout → process.kill(pid, SIGTERM) →
   waitForExit(5000) → 여전히 살아있으면 SIGKILL → waitForExit(2000)
6. 종료 확인 후 server.json이 그 pid 것이면 삭제. 자식(oauth/grok 프록시)은
   server.js 셧다운 훅이 정리(이미 존재) — SIGKILL 경로일 때만 잔존 가능성을
   보고 메시지로 안내.
7. `--force`: graceful 건너뛰고 바로 SIGTERM 에스컬레이션.

## 파일 계획

- NEW `lib/processControl.ts` (~120줄)
  - `isProcessAlive(pid)`, `waitForExit(pid, timeoutMs)` (50ms 폴링, Atomics.wait 아닌
    단순 setTimeout 루프 — 서버 코드와 달리 CLI라 async 허용)
  - `verifyServerIdentity(entry: {pid,port}): Promise<"match"|"mismatch"|"unreachable">`
    — /api/health의 pid 대조
  - `gracefulStop(entry): Promise<boolean>` — POST /api/admin/stop, 2s 타임아웃
  - `escalateKill(pid): Promise<"term"|"kill"|"already-dead">`
- NEW `routes/admin.ts`에 POST `/api/admin/stop` (~50줄)
  - **인증 (감사 블로커 1)**: LAN 가드는 루프백에서 pass-through라 브라우저
    drive-by(fetch from any web page)로 킬 스위치가 된다. 방어 2중:
    (a) advertise 파일에 `adminNonce`(설치 시 randomUUID) 기록, stop 요청은
    `X-Ima2-Admin-Nonce` 헤더 필수 — 파일을 읽을 수 있는 로컬 프로세스만 통과;
    (b) `Origin` 헤더가 존재하면(브라우저 발) 무조건 403. CLI fetch는 Origin 없음.
  - 응답 202 후 setImmediate로 **process.kill(process.pid, "SIGTERM") 자기-시그널**
    (감사 블로커 2): 진짜 teardown(unadvertise, oauth/grok 자식 정리,
    stopAgentQueueWorker, closeDb, exit)은 server.ts:501의 비공개 onShutdown
    클로저에 있고 platform.ts:91의 shutdownStarted 래치가 자기-시그널을 멱등하게
    만들어 준다. shutdownServerAndMcp 단독 호출은 고아 프록시+stale advertise를
    남기므로 금지.
- NEW `bin/commands/stop.ts` (~90줄) — 위 시퀀스 + 사람이 읽는 리포트
  ("stopped pid 1234 (graceful)" / "was not running" / "stale advertise cleaned")
- MODIFY `bin/ima2.ts` — 커맨드 라우팅 + help 텍스트에 stop 추가

## 명시 동작 (감사 소소 지적 반영)

- `bin/lib/client.ts`는 LAN 토큰 미지원 — IMA2_LAN_TOKEN 설정 환경에서 graceful
  POST가 401로 강등되어 SIGTERM 경로로 가는 것은 **의도된 동작**으로 문서화.

## 검증

- 유닛: verifyServerIdentity mismatch 시 kill 미호출, stale 정리 로직,
  에스컬레이션 순서 (mock 주입)
- 라이브: ima2 serve(백그라운드) → ima2 stop → 프로세스 사망 + server.json 삭제 확인
