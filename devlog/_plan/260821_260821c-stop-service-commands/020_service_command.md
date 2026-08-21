# 020 — ima2 service (swp2)

## 설계

서브커맨드 8종: `install | uninstall | start | stop | restart | status | logs | repair`

### macOS (launchd, 1차 대상)
- plist: `~/Library/LaunchAgents/com.ima2.server.plist`
  - ProgramArguments: [설치 시점의 process.execPath(node), <ROOT>/server.js]
  - RunAtLoad true, KeepAlive true, WorkingDirectory <ROOT>,
    StandardOut/ErrPath: ~/.ima2/logs/service.{out,err}.log
  - EnvironmentVariables: IMA2_SERVICE=1 (+ IMA2_CONFIG_DIR 현재값 있으면)
- install: plist 렌더 → launchctl bootstrap gui/$UID (fallback: load -w)
  → launchctl 출력 함정 처리: exit 0이어도 stderr "Load failed" 파싱
  → 기동 후 /api/health 폴링(10s)으로 실제 살아났는지 확인
- uninstall: launchctl bootout(fallback unload) → plist 삭제 → state 삭제
  → 살아있는 서버는 stop 시퀀스로 정리
- start/stop: launchctl kickstart / bootout 없이 kill (KeepAlive 고려:
  stop은 `launchctl bootout`이 아니라 임시 disable이 필요 → 단순화:
  stop = uninstall 아닌 `launchctl kill SIGTERM gui/$UID/com.ima2.server`
  + KeepAlive가 되살리는 것 방지 위해 bootout 후 재-bootstrap은 start가 담당)
  **결정: stop은 bootout(등록 해제, plist는 보존), start는 bootstrap(재등록)** —
  KeepAlive와 싸우지 않는 유일하게 정직한 의미론
- restart: bootout → bootstrap
- status: (1) plist 존재 (2) launchctl print gui/$UID/com.ima2.server 파싱
  (3) service-state.json의 기록 경로 vs 현재 노드/루트 (stale 경고)
  (4) /api/health 라이브 pid — 4계층 보고
- logs: ~/.ima2/logs/service.*.log tail -n (기본 50, --follow 없음 v1)
- repair: 현재 경로로 plist 재렌더 + bootout/bootstrap (nvm/prefix 이동 복구)

### Linux (systemd user unit)
- `~/.config/systemd/user/ima2.service`: ExecStart=node server.js, Restart=always,
  Environment=IMA2_SERVICE=1. systemctl --user {enable --now|disable --now|start|
  stop|restart|status}. logs → journalctl --user -u ima2 -n 50.
- linger 미설정 경고(로그아웃 시 정지)를 status에 표기.

### Windows: 명시적 미지원 안내 + 수동 등록 가이드 출력 (v1 스코프)

### 상태 파일
- `~/.ima2/service-state.json`: {version:1, platform, nodePath, serverJs,
  configDir, installedAt}. status/repair가 현재 경로와 대조.

### serve 싱글턴 상호작용
- serve()의 이미-실행-중 안내에 서비스 관리 여부 표기: service-state 존재 +
  라이브 pid가 서비스 소속이면 "managed by ima2 service — use 'ima2 service stop'"
- server.js 셧다운 훅: IMA2_SERVICE=1이면 KeepAlive 재시작을 전제로 로그만 남김
  (특수 동작 불필요 — ima2는 native 복원 같은 사이드이펙트 없음)

## 파일 계획

- NEW `bin/commands/service.ts` (~400줄, 렌더러/launchctl 러너 분리)
- NEW `bin/lib/serviceTemplates.ts` — plist/unit 렌더 순수함수 (테스트 대상)
- MODIFY `bin/ima2.ts` — 라우팅 + help
- MODIFY `bin/commands/stop.ts` — 서비스 설치 상태면 "service가 되살립니다.
  'ima2 service stop'을 쓰세요" 경고 (opencodex의 관리-충돌 안내 반영)

## 검증

- 유닛: plist/unit 렌더 스냅샷, launchctl stderr 함정 파서, state 대조 로직
- 라이브(macOS): install → launchctl print 등록 확인 + health OK → status 4계층
  → uninstall → 등록 해제 + 프로세스 종료 확인
