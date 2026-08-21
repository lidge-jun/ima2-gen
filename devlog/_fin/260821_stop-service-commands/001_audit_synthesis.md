# 001 — 로드맵 감사 합성 (Pauli, opus-5 high)

R1 FAIL, 5 blockers — 전부 수용:

| # | 지적 | 처리 |
|---|------|------|
| 1 | 루프백 LAN 가드 pass-through → stop API가 drive-by 킬 스위치 | 010: adminNonce(advertise 파일) 헤더 + Origin 존재 시 403 이중 방어 |
| 2 | shutdownServerAndMcp 단독 호출은 고아 프록시/stale advertise | 010: 자기-시그널 SIGTERM (shutdownStarted 래치로 멱등) |
| 3 | launchd 최소 환경 → progrok/oauth 조용한 사망 | 020: plist/unit PATH 주입 + install 게이트 프로바이더 라이브니스 |
| 4 | test:inventory는 스캐너; .test.js는 --fail-js-runtime 거부 | 030: .test.ts 명명 + md 재생성 커밋 절차 |
| 5 | 라이브 검증이 stale 바이너리 대상 | 040: build 게이트 + node bin/ima2.js 핀 |

소소: client.ts LAN 토큰 미지원 401→SIGTERM 강등 의도 동작 문서화(010),
structure/02-command-reference.md 추가(030).
