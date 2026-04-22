# ima2-gen 기능 백로그 (0.1 단위 증분)

## 완료된 기능

### 0.0 기본 기능 (완료 ✅)
- Express 서버 + 웹 UI
- API Key / OAuth 인증
- 이미지 생성/편집
- CLI: serve, setup, reset

### 0.1 README & CLI 확장 (완료 ✅)
- `status`, `doctor`, `open`, `--version`, `--help` 커맨드
- README Roadmap, Troubleshooting, CLI 표
- 테스트 14개

---

## 다음 기능 백로그

### 0.01 React 마이그레이션 (public/index.html → ui/ Vite+React+TS+Tailwind v4)
- 자세한 플랜: `devlog/0.01-react-migration/README.md`
- 1075줄 단일 HTML을 React SPA로 분리
- 서버 계약(/api/*) 변경 없음
- 카드뉴스 등 후속 기능의 토대

### 0.2 글로벌 에러 핸들러
- Express 글로벌 에러 미들웨어 추가
- 커스텀 에러 클래스 (ValidationError, GenerationError)
- 클라이언트에 일관된 에러 응답 포맷

### 0.3 입력 검증 미들웨어
- prompt 길이 제한 (4000자)
- size 유효성 검사 (16px 배수, 비율 <= 3:1, 최대 < 3840px)
- quality enum 검증 (low/medium/high/auto)
- n (병렬 개수) 1~8 제한

### 0.4 서버 로깅
- 요청/응답 로깅 (method, path, status, elapsed)
- 에러 스택 트레이스 로깅
- 생성 이력 로그 (prompt, size, quality, provider, elapsed)

### 0.5 /health 엔드포인트
- 서버 상태 확인
- OAuth 프록시 연결 상태
- 메모리 사용량
- uptime

### 0.6 설정 외부화
- `config/app.config.js` — 포트, 기본값
- `config/image.config.js` — 지원 사이즈, 퀄리티, 포맷
- `config/oauth.config.js` — OAuth URL, 포트

### 0.7 라우트 분리
- `routes/generate.route.js` — 이미지 생성 API 분리
- `routes/edit.route.js` — 이미지 편집 API 분리
- `routes/billing.route.js` — 결제 정보 API 분리

### 0.8 서비스 분리
- `services/oauth.service.js` — OAuth 로직 분리
- `services/openai.service.js` — API Key 로직 분리
- `services/image.service.js` — 공통 이미지 처리

### 0.9 캐싱
- 동일 prompt + 설정 결과 파일 캐싱
- 캐시 키: hash(prompt + quality + size + format)
- TTL: 1시간

### 1.0 레이트 리미팅
- IP 기반 요청 제한 (분당 10회)
- 429 응답 + Retry-After 헤더

---

## 규칙
- 각 0.x 단위는 1개 핵심 기능만
- 완료 후 _fin/에 `YYMMDD_0.x_기능명.md`로 저장
- heartbeat는 _plan 최상단 미완료 항목을 다음 작업으로 제안
