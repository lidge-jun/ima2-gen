# Phase 3: 성능 및 확장성

상태: 예정  
기간: 3~5일  
목표: 캐싱, 레이트 리미팅, 모니터링 도입

---

## 작업 항목

### 캐싱
- 캐시 키: `hash(prompt + quality + size + format)`
- 저장소: 파일 시스템 (`cache/` 디렉토리)
- TTL: 1시간
- 캐시 히트 시 즉시 반환 (elapsed=0)

### 레이트 리미팅
- 메모리 기반 Store (express-rate-limit)
- IP 기준: 분당 10회, 시간당 100회
- API Key 기준: 분당 60회
- 429 응답에 Retry-After 헤더

### 모니터링
```
GET /health
{
  "status": "ok",
  "uptime": 3600,
  "memory": { "used": "45MB", "total": "128MB" },
  "oauth": "ready",
  "apiKey": true
}
```

### 배치 처리 (선택)
- WebSocket 연결로 진행률 전송
- 큐 기반 처리 (bull 또는 직접 구현)

### 완료 조건
- [ ] 캐싱 적용 후 동일 요청 2배 이상 빠름
- [ ] 레이트 리미팅 429 반환 확인
- [ ] /health 엔드포인트 정상 응답
- [ ] 생성 통계 집계 기능
