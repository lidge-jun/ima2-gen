# ima2-gen 개선 로드맵

## Phase 0: README 보강 & CLI 확장 (완료 ✅)

### 0-1. README.md 보강 ✅
- CLI 전체 명령어 표, Roadmap 섹션, Troubleshooting, Testing 추가

### 0-2. CLI 커맨드 확장 ✅
- `--version`, `--help`, `status`, `doctor`, `open` 추가

---

## Phase 1: 코드 품질 및 구조 개선 (1~2일)

### 1-1. 서버 모듈 분리
- [ ] `server.js` 450라인 → 라우트/서비스/유틸리티 분리
- [ ] `routes/generate.route.js` — 이미지 생성 API
- [ ] `routes/edit.route.js` — 이미지 편집 API
- [ ] `routes/billing.route.js` — 결제 정보 API
- [ ] `services/oauth.service.js` — OAuth 로직 분리
- [ ] `services/openai.service.js` — API Key 로직 분리

### 1-2. 설정 외부화
- [ ] `config/app.config.js` — 포트, 기본값 등
- [ ] `config/image.config.js` — 지원 사이즈, 퀄리티, 포맷
- [ ] `config/oauth.config.js` — OAuth URL, 포트

### 1-3. 에러 처리 표준화
- [ ] 커스텀 에러 클래스 생성
- [ ] 글로벌 에러 미들웨어 추가
- [ ] 모든 비동기 함수 try/catch 래핑

## Phase 2: 기능 및 안정성 개선 (2~3일)

### 2-1. 입력 검증
- [ ] prompt 길이 제한 (4000자)
- [ ] size 유효성 검사 (16px 배수, 비율, 최대 크기)
- [ ] quality 값 enum 검증
- [ ] n (병렬 개수) 1~8 제한

### 2-2. 로깅 시스템
- [ ] winston 또는 pino 로거 도입
- [ ] 요청/응답 로깅 미들웨어
- [ ] 에러 스택 트레이스 로깅
- [ ] 생성 이력 로그 (prompt, size, quality, elapsed)

### 2-3. 재시도/회복 메커니즘
- [ ] OpenAI API 호출 재시도 (exponential backoff)
- [ ] OAuth 프록시 자동 재시작 개선
- [ ] 생성 실패 시 graceful degradation

## Phase 3: 성능 및 확장성 (3~5일)

### 3-1. 캐싱
- [ ] 동일 prompt + 설정 결과 캐싱
- [ ] Redis 또는 파일 기반 캐시
- [ ] 캐시 TTL 설정 (1시간)

### 3-2. 레이트 리미팅
- [ ] IP 기본 요청 제한 (분당 10회)
- [ ] API Key 기반 제한
- [ ] 429 응답 처리

### 3-3. 모니터링
- [ ] /health 엔드포인트
- [ ] 생성 통계 (일일/주간)
- [ ] 평균 생성 시간 메트릭
- [ ] 오류율 추적

### 3-4. 배치 처리
- [ ] 대용량 배치 생성 큐
- [ ] WebSocket 진행률 알림
- [ ] 백그라운드 작업 처리
