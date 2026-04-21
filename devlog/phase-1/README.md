# Phase 1: 코드 품질 및 구조 개선

상태: 예정  
기간: 1~2일  
목표: 500라인 이상의 server.js 분리 및 모듈화

---

## 작업 항목

### server.js 분리
현재 450라인의 monolithic 서버를 기능별로 분리

```
src/
├── routes/
│   ├── generate.route.js
│   ├── edit.route.js
│   ├── billing.route.js
│   └── providers.route.js
├── services/
│   ├── oauth.service.js
│   ├── openai.service.js
│   └── image.service.js
├── middleware/
│   ├── error.middleware.js
│   └── logging.middleware.js
├── config/
│   └── app.config.js
└── utils/
    └── validation.js
```

### Barrel Export 적용
각 폼더에 `index.js` 생성하여 단일 진입점 제공

### 설정 외부화
.env + config 파일로 모든 하드코딩된 값 이전

### 완료 조건
- [ ] server.js < 200라인
- [ ] 모든 라우트 별도 파일
- [ ] 모든 서비스 별도 파일
- [ ] 테스트 커버리지 60%+
