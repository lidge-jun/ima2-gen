# 042 — MCP submit 장애 조사 (2026-07-23)

## 질문
Higgsfield MCP 직접 `generate_image`/`generate_video` submit이 왜 계속
`Error starting generation: Something went wrong`으로 죽는가.

## 증거 체인
1. **웹 UI 생성 페이로드 캡처 (Chrome CDP)**: Unlimited 토글 on 상태에서 생성 시
   `POST https://fnf-api-gw.higgsfield.ai/fnf/jobs/nano-banana-2` 바디에
   `use_unlim: true`(params 남쪽 + 최상위 모두). 웹 경로는 이 플래그로 크레딧 우회.
2. **MCP 프로브 매트릭스 (전부 동일 오류)**: model(soul_2/nano_banana_2/gpt_image_2) ×
   aspect_ratio × quality × resolution × use_unlim × workspace_id × surface/application ×
   string-params × select_workspace 선행 — 13+ 조합 전부 submit 실패.
3. **transactions 조회**: MCP 시도 시점에 차감 시도 레코드조차 없음 → 과금 전 단계,
   잡 생성 자체가 MCP 백엔드에서 실패. (unlimited 생성은 `credits: 0 spend`,
   크레딧 생성은 `-2`로 기록됨을 확인.)
4. **같은 연결에서 get_cost/balance/show_generations/listTools(77종)/job_status 정상** —
   인증·스키마·워크스페이스 문제 아님.

## 결론
계정 상태와 무관한 **Higgsfield MCP 백엔드의 submit 경로 장애(외부 BLOCKED)**.
클이언트에서 더 바꿀 수 있는 건 없음. 웹 UI 경유 생성 + ima2 recover 수거가
현재 유일한 e2e 경로.

## 그래도 열어둔 것 (adapter 하드닝, dfdb03e 이후 추가)
- `buildGenerateCall`이 `use_unlim: true`를 기본 전송 (웹 앱 계약과 일치;
  `parameters.use_unlim: false`로 명시 해제 가능). 제공자가 MCP submit을 고치면
  unlimited trial 계정도 곧바로 unlimited 경로를 탄다.
- 저해상도 요청이 실제로 제공자에 도달하도록 스칼라 노브 화이트리스트 포워딩:
  `resolution`(nano_banana), `quality`(soul), `count`. 이전에는 조용히 drop됐음.
- 테스트: `tests/mcp-provider-adapters.test.ts`에 use_unlim 기본/오버라이드,
  화이트리스트 포워딩/차단 케이스 추가.

## 라이브 확인 (2026-07-23)
- Unlimited 토글 on 웹 생성: 잔액 6 유지(0 크레딧), job `ced03917` 완료.
- 수거: `/api/mcp/tasks/:id/recover` × 2 (unlimited 건 + 이전 크레딧 건)
  → `~/.ima2/generated/1784771132801_71fff558_mcp.png`, `…810_36739fae_mcp.png` (896×1200).
- 서버 재시작 후 higgsfield 자동 재연결 정상 (토큰 디스크 보존).
