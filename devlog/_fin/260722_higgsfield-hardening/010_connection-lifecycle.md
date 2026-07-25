# 010 — MCP 연결/수명주기 하드닝 (WP-1)

대상 파일: `lib/mcp/connectionManager.ts`, `lib/mcp/connectionRuntime.ts`,
테스트 `tests/mcp-connection-manager.test.ts`.

## 010-A: sticky DEGRADED detail 해소 (F1)
문제: `handleRuntimeError`(cM.ts:161-165)가 non-terminal 오류에서
`session.detail = "MCP_TRANSPORT_DEGRADED"`를 세팅한 뒤, 이후 성공한 RPC가 detail을
지우지 않는다. 라이브 증거: higgsfield connected + models 정상인데 status.detail=DEGRADED 잔류.

diff 계획 (connectionManager.ts):
- `callTool` 성공 경로(try 블록 return raw 직전)와 `listTools` 성공 경로(페이지네이션 완료 후)에서
  현재 identity가 동일하고 `session.detail === "MCP_TRANSPORT_DEGRADED"`이면 `session.detail = undefined`.
- 헬퍼 `private clearDegraded(provider, identity)` 추가 (≤6줄):
  ```ts
  private clearDegraded(provider: string, identity: McpConnectionIdentity | null): void {
    const session = this.sessions.get(provider);
    if (!session || !sameConnection(session.identity, identity)) return;
    if (session.detail === "MCP_TRANSPORT_DEGRADED") session.detail = undefined;
  }
  ```
- 호출 위치: callTool 성공 반환 직전 1곳, listTools tools 수집 완료 후 1곳.

테스트:
- 기존 445행 테스트 확장 or 신규: transient onerror → detail=DEGRADED 확인 후,
  성공 callTool 1회 → status.detail 부재 확인. (fake client callTool 성공 stub)

## 010-B: 재연결 소진 확장 (F4)
문제: `markOffline`이 `reconnectUsed` 단일 플래그로 identity당 1회만 자동 재연결.
장시간(24h) 세션에서 두 번째 drop이면 offline 영구 잔류.

구현 계약 (audit R1 blocker 반영 — 단일 계약, provider-keyed budget):
- `ProviderSession.reconnectUsed`는 제거하지 않고 **무시하지도 않는다 — 삭제한다**
  (connectionRuntime.ts interface에서 필드 제거, connectionManager.ts 사용처 제거).
  카운터는 오직 manager-level `private readonly reconnectBudget = new Map<string, number>()`.
- **semantics: "성공한 실사용 RPC 없이 연속된 drop"의 상한.**
  - `markOffline`(자동 경로): `const used = this.reconnectBudget.get(provider) ?? 0;`
    `if (used >= MAX_AUTO_RECONNECTS || this.shuttingDown) return;`
    `this.reconnectBudget.set(provider, used + 1);`
    딜레이 = `(this.options.reconnectDelayMs ?? 250) * 2 ** used` (250/500/1000ms).
  - **자동 재연결(refresh) 성공은 budget을 리셋하지 않는다.** refresh()의 bumpGeneration으로
    identity가 바뀌어도 Map은 provider 키라서 카운터가 이어진다 — 연속 drop 4회면
    3회까지만 재연결, 4회째 offline 잔류 (테스트 시나리오와 정확히 일치).
  - budget 리셋(0으로)은 다음 세 경우만:
    (1) **성공한 callTool/listTools** — 연결이 실제로 일을 했다는 증거 (010-A의
    clearDegraded와 같은 호출 지점에서 함께 리셋),
    (2) **명시적 사용자 경로** — `connect()` / `handleOAuthCallback` 진입 시
    (사용자가 직접 다시 연결을 명령한 경우 새 예산).
  - `disconnect()`/`reset()`은 budget을 리셋한다 (의도된 세션 종료 후 재연결은 새 맥락).
- `MAX_AUTO_RECONNECTS = 3` 상수 (connectionManager.ts 최상단).
- 타이머 중복 등록 방지: `markOffline`에서 `this.reconnectTimers.has(provider)`면 신규 등록 생략
  (리뷰어 비블로킹 제안 수용).

테스트:
- reconnectDelayMs:0 harness에서 **성공 RPC 없이** 연속 drop 4회: 3회까지는 refresh 재시도 발생,
  4회째는 offline 잔류 + 타이머 미등록 확인 (자동 재연결 성공이 budget을 되돌리지 않음 증명).
- 성공 RPC 후 budget 리셋 확인: drop→재연결→**성공 callTool**→drop 시 다시 재연결 시도.
- 명시적 connect() 재진입 후 budget 리셋 확인.

## 010-A 추가 (리뷰어 비블로킹 수용)
- degraded 해제 테스트는 callTool 성공뿐 아니라 listTools 성공 경로도 커버한다.

## 검증
`npm run typecheck`, `node --import tsx --test tests/mcp-connection-manager.test.ts`, 이후 C에서 전량.
