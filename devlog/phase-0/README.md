# Phase 0: README 보강 & CLI 커맨드 확장

상태: 완료 ✅  
기간: 0.5일  
목표: 사용자 경험 향상 — 문서 개선 + CLI 편의성 추가

---

## 완료 항목

### README.md 보강 ✅
- [x] 개발 로드맵(devlog) 링크 추가 — Roadmap 섹션에 Phase 표 추가
- [x] 테스트 방법 명시 (`npm test`)
- [x] CLI 전체 명령어 표 추가
- [x] Phase 로드맵 섹션 추가
- [x] Troubleshooting 섹션 추가

### CLI 커맨드 확장 ✅
- [x] `--version` / `-v` → 버전 출력 (package.json에서 읽음)
- [x] `--help` / `-h` → 개선된 도움말
- [x] `status` → 현재 설정 상태 확인 (API Key/OAuth/config 파일)
- [x] `doctor` → 환경 진단 (Node 버전, node_modules, .env, config)
- [x] `open` → 브라우저에서 웹 UI 열기

### 테스트 보강 ✅
- [x] 새 CLI 커맨드 테스트 추가 — 14개 테스트, 전부 통과

### 완료 조건 ✅
- [x] README에 로드맵 + CLI 전체 명령어 표시
- [x] CLI --version 동작
- [x] CLI status 동작
- [x] CLI doctor 동작
- [x] 테스트 10개 이상 통과 (14개 통과)

---

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `bin/ima2.js` | CLI 커맨드 5개 추가 (status, doctor, open, --version, --help) |
| `README.md` | CLI 표, Roadmap, Troubleshooting, Testing 섹션 추가 |
| `tests/bin.test.js` | 9개 테스트 → 14개 테스트 확장 |
| `package.json` | `test` 스크립트 추가 |
