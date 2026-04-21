# Phase 2: 기능 및 안정성 개선

상태: 예정  
기간: 2~3일  
목표: 입력 검증, 로깅, 재시도 메커니즘 구축

---

## 작업 항목

### 입력 검증
- prompt: 문자열, 1~4000자
- size: 정규식으로 WIDTHxHEIGHT 검증
  - 양변 16px 배수
  - 비율 <= 3:1
  - 총 픽셀 655,360 ~ 8,294,400
- quality: "low" | "medium" | "high" | "auto"
- n: 1~8 정수
- format: "png" | "jpeg" | "webp"

### 로깅 시스템
```
[2026-04-22T07:30:00Z] [INFO] [generate] prompt="cat" quality=low size=1024x1024 elapsed=2.3s
[2026-04-22T07:30:01Z] [ERROR] [generate] message="API timeout" retry=1
```

### 재시도 메커니즘
- OpenAI API: 최대 3회, exponential backoff (1s, 2s, 4s)
- OAuth 프록시: 5초 간격 무한 재시작 → 10초 간격 최대 10회

### 완료 조건
- [ ] 모든 API 입력 검증
- [ ] 로그 파일 daily rotation
- [ ] 재시도 로직 동작 확인
- [ ] 에러 메시지 클라이언트에 전달
