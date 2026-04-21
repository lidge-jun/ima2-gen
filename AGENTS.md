# ima2-gen — AI Context

## What This Project Does
GPT Image 2 (gpt-image-2) 이미지 생성기 CLI + 웹 UI
- OAuth (ChatGPT 계정) 또는 API Key 인증 지원
- 텍스트→이미지, 이미지→이미지(편집) 생성
- 병렬 생성 (최대 8장)

## Tech Stack
- Runtime: Node.js >=18 (ES Module)
- Server: Express 5
- API Client: OpenAI SDK v5
- OAuth: openai-oauth (ChatGPT 세션 프록시)
- Frontend: Vanilla HTML/CSS/JS

## Project Structure
```
image_gen/
├── bin/ima2.js           # CLI 진입점
├── server.js             # Express 서버 (이미지 생성/편집 API)
├── public/index.html     # 웹 UI
├── devlog/               # 개발 로드맵 및 계획
│   ├── _plan/README.md   # 활성 계획
│   ├── _fin/             # 완료된 작업
│   ├── phase-0/          # README + CLI 확장 (완료)
│   ├── phase-1/          # 코드 품질/구조 개선
│   ├── phase-2/          # 기능/안정성 개선
│   └── phase-3/          # 성능/확장성
├── tests/                # 테스트
│   ├── bin.test.js
│   └── server.test.js
└── package.json
```

## Devlog Phase Roadmap
- **Phase 0** ✅: README 보강, CLI 확장 (status, doctor, open, --version, --help)
- **Phase 1**: server.js 모듈 분리 (<200라인), 설정 외부화, 에러 처리 표준화
- **Phase 2**: 입력 검증, 로깅 시스템, 재시도/회복 메커니즘
- **Phase 3**: 캐싱, 레이트 리미팅, 모니터링 (/health), 배치 처리

## Conventions
- ES Module only (import/export)
- File length < 500 lines (split if exceeded)
- Function length < 50 lines
- try/catch mandatory for all async operations
- Config values in config.js or .env, never hardcode

## Test Command
```bash
npm test   # node --test tests/**/*.test.js
```

## Heartbeat
- 20분마다 devlog/_plan 점검 및 다음 작업 제안
- 완료된 phase는 _fin/으로 이동 (YYMMDD_ prefix)
