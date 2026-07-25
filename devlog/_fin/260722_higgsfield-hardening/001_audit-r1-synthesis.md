# 001 — WP-0 audit R1 합성 (리뷰어: sol 서브에이전트, 판정 FAIL→수정)

## Blocker 1 — reconnectBudget 리셋 시맨틱 모순 (수용)
RCA: 010 초안이 "성공 연결 시 리셋"과 "연속 drop 4회 → 4회째 offline" 테스트를 동시에
요구 — refresh 성공마다 리셋되면 상한이 영원히 소진되지 않음. 문서 자체 모순.
결정: **"성공한 실사용 RPC 없이 연속된 drop" 상한**으로 확정. 자동 재연결 성공은 리셋하지
않고, 성공 callTool/listTools·명시적 connect()/OAuth 콜백·disconnect()/reset()만 리셋.

## Blocker 2 — session 필드안과 Map안 공존 (수용)
RCA: 초안이 두 설계를 순차로 서술해 구현 계약이 이중화됨.
결정: session 필드안 삭제, provider-keyed `reconnectBudget` Map 단일 계약으로 재작성.
`reconnectUsed` 필드는 interface에서 제거.

## 비블로킹 3건 — 모두 수용
- listTools 성공 경로 degraded 해제 테스트 추가 (010).
- reconnectTimers 중복 등록 가드 명시 (010).
- stack scrub 전제 수정 + 테스트 단정 (030).

수정 커밋 후 동일 리뷰어에게 010/030 diff 요약과 함께 재검증 요청.
