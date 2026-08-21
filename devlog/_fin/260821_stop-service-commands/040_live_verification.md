# 040 — 라이브 검증 + 리뷰 + push (swp4)

0. **빌드 게이트 (감사 블로커 5)**: bin/과 server.js는 TS 컴파일 산출물(.js는
   gitignore) — 라이브 검증 전 `npm run build:server && npm run build:cli` 필수,
   검증은 PATH의 전역 ima2가 아니라 **이 체크아웃의 `node bin/ima2.js`로 핀**.
1. serve→stop: `node bin/ima2.js serve`(관리 세션) → `node bin/ima2.js stop` →
   ps 사망 + server.json 삭제 로그
2. service: `node bin/ima2.js service install` → `launchctl print
   gui/$UID/com.ima2.server` 등록 + /api/health OK → status 4계층 출력 검증 →
   restart → pid 변경 확인 → uninstall → 등록 해제 + 프로세스 종료 + plist 삭제.
   KeepAlive plist가 dev 경로를 굽는 것은 같은 세션 안에서 uninstall로 닫으므로
   허용 (경로 이동 복구는 repair 담당).
3. opus(claude-opus-5, high) 리뷰어 파견: diff 전체 + 라이브 로그 감사 (특히
   pid 신원 검증 의미론, launchctl 함정, KeepAlive 대응 stop 의미론)
4. 최종 게이트: typecheck + npm test + test:inventory → dev push

## 주의: 검증 중 사용자의 기존 로컬 서버를 죽였다면 마지막에 상태 복원
(검증 전 실행 여부 기록, 종료 시 원상복구)
