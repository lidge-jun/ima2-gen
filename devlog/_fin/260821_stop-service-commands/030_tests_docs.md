# 030 — 테스트 + 문서 (swp3)

- NEW `tests/stop-command-contract.test.ts` (**.test.ts — 감사 블로커 4**:
  classify-tests.mjs --fail-js-runtime이 lib/routes/bin을 import하는 .test.js를
  거부) — processControl 유닛(신원 mismatch 시 no-kill, 에스컬레이션 순서,
  stale 정리), stop API 인증(nonce 없으면 거부, Origin 있으면 403) + 202+자기-시그널
- NEW `tests/service-command-contract.test.ts` — plist/unit 렌더 스냅샷(경로
  이스케이프, IMA2_SERVICE=1 + PATH 포함), launchctl 함정 파서, service-state 대조
- `test:inventory`는 레지스트리가 아닌 스캐너: scripts/classify-tests.mjs가
  docs/migration/runtime-test-inventory.md를 재생성 — **실행 후 재생성 md 커밋**
- README.md: CLI Commands 섹션에 stop/service 추가 (Server 하위)
- structure/01-file-function-map.md 라인수 갱신 + 신규 파일 행 추가
- structure/02-command-reference.md에 stop/service 커맨드 문서 추가 (감사 지적)
- bin/ima2.ts help 텍스트

## 검증: npm test 전체 green + inventory green
