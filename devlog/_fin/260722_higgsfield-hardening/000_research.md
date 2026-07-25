# 000 — Higgsfield MCP 배포 전 하드닝: 리서치/인벤토리 (2026-07-22)

## 목표
Higgsfield MCP 레인(연결/토큰/생성 잡/로그)을 배포 품질로 하드닝하고, OAuth 무제한(24h) 창에서
라이브 생성 스모크까지 증거를 남긴 뒤 dev에 push한다.

## 현재 라이브 상태 (증거)
- `POST /api/mcp/providers/higgsfield/connect` → `auth_required` + authorizationUrl (PKCE S256,
  redirect `http://localhost:3333/api/mcp/oauth/callback`). Chrome으로 열어 사용자 로그인 완료.
- 로그인 후 `/api/mcp/providers`: `higgsfield state=connected`.
- `/api/mcp/providers/higgsfield/status`:
  `{"state":"connected","detail":"MCP_TRANSPORT_DEGRADED","toolCount":77, "snapshotDiff":{"drifted":[8개],"added":["list_website_categories","apps_search","apps_describe","apps_invoke"]}}`
  → **connected인데 detail이 DEGRADED로 남아 있음** (아래 F1).
- `/api/mcp/providers/higgsfield/models`: 이미지 12종/비디오 6종 카탈로그 정상 반환 (nano_banana_2,
  soul_2, cinematic_studio_3_0 …). 스냅샷 73툴 → 라이브 77툴로 드리프트.
- `npm test`: 1806/1806 pass (하드닝 시작 시점 green 기준선).

## 워킹트리 선행 diff (커밋 필요)
이전 세션(260721 힉스필드 언락)의 미커밋 diff가 남아 있음 — 이번 레인과 동일 주제이므로
WP-1 시작 전에 독립 커밋으로 먼저 적재한다:
- `lib/mcp/adapters/higgsfield.ts` (+178/-…): catalog-only 스텁 → 실행 가능 어댑터
  (generate_image/generate_video, job_status poll, 상태 enum 정규화, rawUrl 파싱)
- `lib/mcp/providerRegistry.ts`: `lockReason` 제거, defaults `{image: soul_2, video: cinematic_studio_3_0}`
- tests 6개 파일 갱신 (adapter/integration/ui-contract/recover/character/models-endpoint)
- `scripts/probe-edit-video-shape.ts` (untracked, wp5b2 리서치 스크립트) — 커밋 포함

## 발견 사항 (하드닝 후보)
### F1 — sticky MCP_TRANSPORT_DEGRADED (connectionManager.ts:164)
`handleRuntimeError`가 non-terminal 오류에서 `session.detail="MCP_TRANSPORT_DEGRADED"`를 세팅하지만
이후 **성공한 callTool/listTools가 detail을 지우지 않는다**. 지금 라이브 상태가 그 증거:
연결되어 모델 카탈로그까지 정상 반환하는데 status는 계속 DEGRADED. UI가 이 detail을 노출하면
사용자는 영구 경고를 본다. → WP-1 (010)

### F2 — raw submit 덤프 (executeMediaJob.ts:49-51)
`plan.toolName === "edit_video"`일 때 `console.error("[edit_video RAW SUBMIT]", JSON.stringify(submitResult).slice(0,3000))`
— wp5b2 shape 리서치용 임시 코드가 남아 있음. 제출 응답에는 **서명 URL/토큰성 문자열**이 들어올 수
있고 jobLog의 secret-free 원칙(서명 URL 금지)과 모순. → WP-3 (030)에서 제거(스키마는 이미
`keyframe_preview` 파싱으로 안정화됨, 커밋 7274ed0).

### F3 — 폴링 레이트리밋 미대응 (executeMediaJob.ts)
`executeMediaPlan` 폴 루프는 임의 오류를 3회 연속까지만 삼키고 지수 백오프(1.5x, cap 15s)를 하지만
**레이트리밋(MCP_TOOL_ERROR에 429/rate-limit 표시)을 구분하지 않는다**. 무제한 창에서 병렬 생성 시
제공자 측 레이트리밋이 오면 3연속 오류로 잡이 죽을 수 있다. HTTP 레벨 Retry-After는 라우트 레인
(TOO_MANY_JOBS)에만 존재. → WP-2 (020): 레이트리밋 오류를 재시도 카운트에서 분리, 대기 후 지속.

### F4 — 단발 reconnect (connectionManager.ts markOffline)
`reconnectUsed` 플래그로 identity당 **1회만** 자동 재연결. 두 번째 transport drop이면 offline으로
영구 잔류(사용자 수동 refresh 필요). 무제한 창 장시간 세션에서 발생 가능. → WP-1 (010):
지수 백오프 기반 소수 회수(예: 3회) 재연결로 확장하되 무한 루프 금지, 테스트로 상한 증명.

### F5 — 스냅샷 드리프트 (snapshotDiff.drifted 8종 + added 4종)
라이브 툴 스키마가 스냅샷과 드리프트. ingest는 connect 시 best-effort로 이미 수행되어 diff가
status에 붙는다(정상 동작). 스냅샷 픽스처 갱신은 선택적 — 계약 테스트가 sanitized 픽스처 기반이므로
**이번 범위에서는 기록만** 하고 픽스처 재캡처는 하지 않는다(테스트 대량 churn 방지).

### F6 — 시크릿 표면 점검 (양호 기준선)
- `sanitizer.ts` MCP_SECRET_PATTERNS(40+ 토큰/이메일/서명 쿼리) → 스냅샷 저장은 scrub됨.
- `jobLog.ts`: taskId + query-strip URL + 120자 프롬프트만 기록. 양호.
- `routes/mcpConnections.ts`: secret-free 응답 원칙 주석 + 상태 객체만 노출. 양호.
- 남은 구멍은 F2의 raw 덤프와, mcpMedia/mcpMultishot의 `console.error`에 들어가는
  error.message(도구 오류 텍스트에 서명 URL이 포함될 수 있음) → WP-3에서 message scrub 적용.

## 검증 기준선 명령
`npm run typecheck` / `npm run typecheck:tests` / `npm test` (1806) / `npm run test:inventory` / `cd ui && npm run build`

## Work-phase 매핑
- WP-1 = 010 연결/수명주기 (F1, F4)
- WP-2 = 020 잡 오류 경로 (F3 + 취소-완료 레이스 회귀 확인)
- WP-3 = 030 시크릿/로그 (F2, F6 잔여)
- WP-4 = 040 라이브 스모크 + 최종 게이트 + push (F5는 기록만)
