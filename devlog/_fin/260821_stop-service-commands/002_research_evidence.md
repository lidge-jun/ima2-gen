# 002 — 연구 증거 스냅샷 (HEAD de67510c 기준)

- server.ts:229 createLanApiGuard(루프백 pass-through), :302 buildAdvertisePayload
  (grok.live 유일 소스), :329 advertise / :345 unadvertise(pid 가드), :501 익명
  onShutdown 클로저(진짜 teardown), :510 shutdownServerAndMcp(리스너+MCP만)
- bin/lib/platform.ts:91 onShutdown + shutdownStarted 멱등 래치
- routes/health.ts:17 runtime.oauth.status 노출 / runtime.grok에 live 없음
- lib/grokProxyLauncher.ts:176 bare progrok 스폰 (launchd PATH 민감)
- scripts/classify-tests.mjs: 스캐너 + --fail-js-runtime (.test.js에서 lib/routes/bin
  import 거부) → 신규 테스트는 .test.ts
- 감사 이력: Pauli 3라운드 (5 blockers + 2 minor + 2 후속 정정) → PASS.
  구현 노트: adminNonce는 RuntimeContext에 부팅 시 1회 생성(재-advertise 무관).
