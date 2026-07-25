# 020 — 생성 잡 오류 경로 하드닝 (WP-2)

대상 파일: `lib/mcp/executeMediaJob.ts`, 테스트 `tests/mcp-media-jobs*.test` 계열
(현재 폴 루프 회귀는 `tests/mcp-media-kind-behavior.test.ts` / `tests/mcp-generation-integration.test.ts`에 분산).

## 020-A: 폴 루프 레이트리밋 인지 (F3)
문제: `executeMediaPlan`의 폴 루프는 모든 callTool 오류를 동일하게 `pollErrors`로 계수,
3연속이면 잡 전체 실패. 무제한 창 병렬 생성 시 제공자 레이트리밋(툴 오류 텍스트에
429/rate limit/too many 표기)이 오면 **원격 잡은 살아 있는데 로컬이 포기**한다.

diff 계획 (executeMediaJob.ts):
- 헬퍼 추가:
  ```ts
  const RATE_LIMIT_PATTERN = /\b429\b|rate.?limit|too many request/i;
  function isRateLimited(error: unknown): boolean {
    return RATE_LIMIT_PATTERN.test(String((error as Error)?.message ?? error));
  }
  ```
- 폴 catch 블록:
  ```ts
  } catch (error) {
    if (options.signal?.aborted) throw new Error("MCP_JOB_ABORTED");
    if (isRateLimited(error)) { interval = Math.min(interval * 2, 30_000); continue; }  // 데드라인이 상한
    pollErrors += 1;
    if (pollErrors >= 3) throw error;
    continue;
  }
  ```
  레이트리밋은 pollErrors에 계수하지 않고 backoff만 강화(cap 30s). 전체 안전망은 기존
  deadline(image 5m / video 12m)이 그대로 담당하므로 무한 대기 없음.
- submit 단계는 변경하지 않음(제출 레이트리밋은 즉시 실패가 옳다 — 사용자 재시도 /
  라우트 레인의 TOO_MANY_JOBS/Retry-After가 담당).

## 020-B: 취소-완료 레이스 회귀 확인 (코드 변경 없음 예상)
`lib/ssePublish.ts`의 cancel-done race guard + `sleep()`의 abort reject 경로가 이미 있다.
B 단계에서 폴 루프 수정 후: abort 시그널이 (1) sleep 중, (2) callTool 대기 중, (3) 레이트리밋
continue 직후 각각에서 MCP_JOB_ABORTED로 종결되는지 테스트로 고정한다. 누락 케이스 발견 시에만 수정.

## 테스트
- 신규 or 기존 파일 확장: fake manager.callTool이 처음 2회 `MCP_TOOL_ERROR:job_status:429 Too Many Requests`
  를 던지고 3회째 succeeded 반환 → 잡 성공 + pollErrors 미소진 확인.
- 레이트리밋 4연속 + 이후 성공 → 여전히 성공 (계수 안 됨 증명).
- 일반 오류 3연속 → 기존대로 throw (회귀 가드).
- deadline 초과 레이트리밋 지속 → MCP_JOB_TIMEOUT.
- abort 중 레이트리밋 continue → MCP_JOB_ABORTED.

## 검증
`npm run typecheck`, 관련 테스트 파일 단독 실행, C에서 전량.
