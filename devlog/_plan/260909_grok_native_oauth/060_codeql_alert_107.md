---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, codeql, security, evidence]
---

# CodeQL alert 107 — /api/grok/status "missing rate limiting" (dismissed, false positive)

승격 PR #238에서 CodeQL이 `routes/grok.ts:22`에 대해 high severity
`js/missing-rate-limiting`을 새로 올렸다. 규칙 설명은 "This route handler performs
authorization, but is not rate-limited."

## 왜 오탐인가

레이트 리밋은 라우트가 아니라 앱 레벨 미들웨어가 소유한다. `server.ts`의
`buildApp`이 `createApiRequestBudget(API_REQUEST_POLICY)`를 만들어
`app.use(budget)`으로 라우트 등록보다 먼저 끼운다. 정책은 `config.ts`의
`API_REQUEST_POLICY` — 소켓 피어당 60초에 요청 600건, 변경 요청 120건, 최대 4096
피어. `lib/apiRequestBudget.ts`가 `isApiRequestPath`로 `/api/*`를 걸러 적용하므로
`/api/grok/status`도 당연히 포함된다. CodeQL은 이 간접 경로를 따라가지 못하고,
그래서 같은 규칙으로 이미 열려 있던 알림이 28건이다(`routes/history.ts`,
`routes/keys.ts`, `routes/video.ts` 등 기존 라우트 전반).

## 실측

격리 HOME으로 서버를 띄우고 `/api/grok/status`에 605회 연속 GET:

```
first 429 at request 601 | Retry-After: 60 | body:
{"error":{"code":"API_RATE_LIMITED","message":"Too many API requests; retry after the indicated delay"}}
status counts: {200: 600, 429: 5}
```

정책값 600과 정확히 일치하는 지점에서 차단됐다.

## 처리

알림 107을 `false positive`로 dismiss하고 위 근거를 코멘트에 남겼다. 규칙 자체를
비활성화하거나 라우트에 별도 리미터를 덧붙이지 않았다 — 후자는 이미 동작하는 예산과
이중으로 겹쳐 오히려 정책을 흐린다.
