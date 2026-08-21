# 040 — 라이브 검증 + 리뷰 + push (swp4)

1. serve→stop: `ima2 serve`(관리 세션) → `ima2 stop` → ps 사망 + server.json 삭제 로그
2. service: `ima2 service install` → `launchctl print gui/$UID/com.ima2.server` 등록 +
   /api/health OK → `ima2 service status` 4계층 출력 검증 → `ima2 service restart` →
   pid 변경 확인 → `ima2 service uninstall` → 등록 해제 + 프로세스 종료 + plist 삭제
3. opus(claude-opus-5, high) 리뷰어 파견: diff 전체 + 라이브 로그 감사 (특히
   pid 신원 검증 의미론, launchctl 함정, KeepAlive 대응 stop 의미론)
4. 최종 게이트: typecheck + npm test + test:inventory → dev push

## 주의: 검증 중 사용자의 기존 로컬 서버를 죽였다면 마지막에 상태 복원
(검증 전 실행 여부 기록, 종료 시 원상복구)
