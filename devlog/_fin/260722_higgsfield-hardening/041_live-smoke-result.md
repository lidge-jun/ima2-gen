# 041 — WP-4 결과 (라이브 스모크 + 출하)

## 서버 재기동
`npm run build:server` + `build:cli` 후 :3333 프로세스 재시작. 재기동 직후
`/api/mcp/providers`: runway/higgsfield 모두 `connected`, **detail 없음** — WP-1의
sticky DEGRADED 해소가 라이브에서 확인됨 (재기동 전에는 detail=MCP_TRANSPORT_DEGRADED 잔류였음).
OAuth 토큰은 디스크 보존 → restore로 자동 재연결 (리뷰어 사전 확인대로).

## 라이브 스모크 결과
- **MCP 직접 submit은 제공자측 오류**: `generate_image`/`generate_video` 호출이 모델·파라미터
  조합 불문(`soul_2`/`nano_banana_2`/`gpt_image_2`, quality/resolution/unlimited, string params,
  workspace 선택 후 포함) 전부 `Error starting generation: Something went wrong`
  (Request ID 다수 기록). `get_cost: true` 프리플라이트는 성공(1 credit) — 인증/스키마 문제가
  아니라 Higgsfield MCP 서버의 submit 경로 장애로 판정. → 직접 submit 항목 **BLOCKED(외부)**.
- **웹 UI(Chrome 버튼 클릭) 생성은 성공**: 이미지(nano_banana_2, 3:4)와 비디오(Seedance 2.0
  720p/8s, Unlimited 모드 토글 on) 모두 완료.
- **ima2 레인 e2e 증거 (poll→parse→download→commit)**: 완료된 두 잡을
  `/api/mcp/tasks/:id/recover`로 수거 —
  - 이미지 task `03fbf923-…`: jobs.log `recovered` + `~/.ima2/generated/1784728967794_0364fd20_mcp.png`
  - 비디오 task `952cb78f-…`: jobs.log `recovered` + `~/.ima2/generated/1784729280013_0e32ff28_mcp.mp4`
  jobs.log 라인은 sanitizedUrl(쿼리 제거)만 기록 — WP-3 시크릿 규칙 라이브 확인.
  `higgsfieldAdapter.parsePoll`이 라이브 job_status 응답에서 succeeded+rawUrl 정상 파싱.

## 최종 게이트
npm test 1821/1821, typecheck, typecheck:tests, test:inventory, ui build 전량 green.

## 출하
push 1차는 GitHub push protection이 테스트 픽스처의 `sk_live_…` 가짜 토큰을 Stripe 키로
오탐 → 픽스처 문자열 교체(fixup+autosquash) 후 push 성공.
원격 dev = `8bb35a6a3f4a5fe886c37d78ccabbee860591800` (12 커밋).

## 판정
WP-4 DONE (직접 submit 스모크 항목만 외부 BLOCKED — Higgsfield MCP 서버측 장애, 재시도 대상).
