# 030 — 시크릿/로그 표면 하드닝 (WP-3)

대상 파일: `lib/mcp/executeMediaJob.ts`, `routes/mcpMedia.ts`, `routes/mcpMultishot.ts`,
`lib/mcp/sanitizer.ts`(재사용만), 테스트 신규 1개 + 기존 확장.

## 030-A: edit_video raw submit 덤프 제거 (F2)
`executeMediaJob.ts:47-51`의 wp5b2 리서치용 `console.error("[edit_video RAW SUBMIT]" …)` 를 삭제.
stage-1 keyframe_preview 계약은 커밋 7274ed0에서 파싱으로 고정되었으므로 덤프의 존재 이유 소멸.
서명 URL이 서버 로그에 통째로 남는 유일한 경로였음.

diff: 해당 3줄(주석 포함 5줄) 삭제. 대체 없음.

## 030-B: 오류 로그 message scrub (F6 잔여)
`routes/mcpMedia.ts:278`, `routes/mcpMultishot.ts:103`의 `console.error`가
`(error as Error)?.message`를 그대로 기록 — MCP_TOOL_ERROR 텍스트에는 제공자 응답 파편
(서명 URL, 이메일 등)이 포함될 수 있다.

diff 계획:
- `lib/mcp/sanitizer.ts`의 `scrubValue`를 재사용:
  두 콜사이트에서 `message=${(error as Error)?.message?.slice(0,500)}` →
  `message=${scrubValue(String((error as Error)?.message ?? "").slice(0, 500))}` 로 교체
  (mcpMultishot은 300자 유지). stack도 동일하게 scrubValue 적용 — stack 첫 줄에는
  error.message가 포함되므로 "경로/행번호만"이라는 전제는 성립하지 않는다(audit R1 수용).
  scrub된 stack 출력도 030-C 테스트에서 단정한다.
- import 추가: `import { scrubValue } from "../lib/mcp/sanitizer.js";`

## 030-C: 시크릿 회귀 테스트

## 030-D: jobLog nested-cause scrub (audit R2 blocker 수용)
`lib/mcp/jobLog.ts`의 `causeMessage()`가 cause.message를 scrub 없이 jobs.log에 영속 —
mcpMedia/mcpMultishot/mcpRecover 모두 `logMcpJobError` 경유이므로 중첩 cause의 서명 URL이
디스크에 남을 수 있었다. `scrubValue`를 causeMessage와 code 경로에 적용하고,
중첩-cause 시크릿 회귀 테스트를 030-C 파일에 추가한다.

신규 `tests/mcp-log-secrecy.test.ts` (node:test):
- `scrubValue`가 대표 서명 URL(`...?sig=abc...`, 40+ 토큰, 이메일)을 [REDACTED] 처리하는지 계약 고정.
- `executeMediaJob.ts` 소스 텍스트에 `RAW SUBMIT` 문자열이 없음을 파일 read로 단정
  (재도입 방지 canary). 소스-텍스트 단정은 이 저장소의 doc-sync 계약 테스트 관례와 동일 패턴.
- test-inventory 등록 (`npm run test:inventory` green 필수).

## 검증
`npm run typecheck`, 신규 테스트 단독, C에서 전량.
