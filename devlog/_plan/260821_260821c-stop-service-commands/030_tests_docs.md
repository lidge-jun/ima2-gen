# 030 — 테스트 + 문서 (swp3)

- NEW `tests/stop-command-contract.test.js` — processControl 유닛(신원 mismatch
  시 no-kill, 에스컬레이션 순서, stale 정리), stop API 라우트 202+셧다운 트리거
- NEW `tests/service-command-contract.test.js` — plist/unit 렌더 스냅샷(경로 이스케이프,
  IMA2_SERVICE=1 포함), launchctl 함정 파서, service-state 대조
- `npm run test:inventory` 레지스트리에 신규 파일 등록 (tests/README 또는 inventory 규칙 확인)
- README.md: CLI Commands 섹션에 stop/service 추가 (Server 하위)
- structure/01-file-function-map.md 라인수 갱신 + 신규 파일 행 추가
- bin/ima2.ts help 텍스트

## 검증: npm test 전체 green + inventory green
