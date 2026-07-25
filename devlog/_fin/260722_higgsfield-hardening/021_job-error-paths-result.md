# 021 — WP-2 결과 (020 구현)

## 구현
- `executeMediaJob.ts`: `isRateLimited()` (`\b429\b|rate.?limit|too many request`, 대소문자 무시).
  폴 catch 순서: abort 확인 → 레이트리밋이면 interval 2배(cap 30s) 후 continue(3-strike 미소진)
  → 일반 오류만 기존 3-strike. submit 단계는 불변(즉시 실패 유지).
- 신규 `tests/mcp-poll-rate-limit.test.ts` 6케이스: 연속 4회 레이트리밋 후 성공, 혼합
  (일반 2회+레이트리밋 2회) 성공, 일반 3연속 실패 회귀, 지속 레이트리밋 데드라인 타임아웃,
  레이트리밋 중 abort, **레이트리밋 submit 즉시 실패** (리뷰어 제안 수용).

## 검증
- 6/6 file-local, `npm test` 1817/1817, test:inventory green (130 runtime / 180 contract 갱신).
- 020-B(취소-완료 레이스): abort 3경로(sleep reject / catch 선두 / loop-top) 테스트로 고정,
  프로덕션 코드 추가 수정 불필요 확인.

## 리뷰
sol 리뷰어 A게이트 PASS (블로커 없음, 제안 1건 수용).

커밋: 020 impl + tests + inventory (dev).
