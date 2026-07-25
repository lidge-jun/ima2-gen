# 011 — WP-1 결과 (010 구현)

## 구현
- `noteRpcSuccess(provider, identity)`: 성공한 callTool/listTools 후 sticky
  `MCP_TRANSPORT_DEGRADED` detail 해제 + reconnectBudget 리셋. **sameConnection 가드가
  리셋보다 선행** (audit R1 blocker: stale-generation RPC가 현 세대 예산을 되살리는 레이스 봉쇄).
- `reconnectBudget: Map<string, number>` — provider 키, `MAX_AUTO_RECONNECTS=3`,
  지수 딜레이 250/500/1000ms, `reconnectTimers.has()` 중복 등록 가드.
- 리셋 경로: 성공 RPC / 명시적 `connect()` / `handleOAuthCallback` / `reset()` / `disconnect()`.
  자동 refresh 성공은 리셋하지 않음 (연속 drop 상한 계약).
- `ProviderSession.reconnectUsed` 필드 제거.

## 검증
- 신규 테스트 5개 (degraded 해제 x2, 4연속 drop 소진, RPC/명시적 connect 리셋, stale-generation 회귀).
- `tests/mcp-connection-manager.test.ts` 30/30, `npm test` 1810/1810, typecheck/typecheck:tests green.
- structure/01 라인카운트 갱신 (계약 테스트 CHECK-OK).

## 리뷰
sol 리뷰어: R1 FAIL(1 blocker) → 가드 순서 수정 + 회귀 테스트 → R2 PASS.

커밋: 010 impl, structure refresh, audit fix (dev).
