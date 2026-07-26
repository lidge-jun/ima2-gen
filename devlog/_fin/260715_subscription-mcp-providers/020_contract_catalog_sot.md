# 020 — Contract catalog SoT: dual namespace + availability 모델

> **Post-interview canonical (2026-07-16).** WP2 — 이 unit의 foundation phase. 인터뷰 Round 1(dual namespace)·Round 2(ima2-owned execution)의 구조적 구현이다.

## 목적

ima2 내장 tool과 외부 provider MCP tool을 하나의 canonical contract model로 기술하고, 기존에 갈라져 있던 세 AI-facing 표면(`AGENT_TOOL_MANIFEST`, `ima2 capabilities`, skill Markdown)을 이 model에서 파생되는 projection으로 이관한다. **제4의 SoT를 추가하는 것이 아니라 기존 3개를 1개로 수렴시키는 phase다** (A-audit blocker 3 반영).

## Ownership migration (SoT 수렴 규칙)

| 기존 표면 | 현재 정의 | 이관 후 |
|---|---|---|
| `lib/agentToolManifest.ts:3-10` `AGENT_TOOL_MANIFEST` | name/description/parameters 하드코딩 배열, `/api/agent/tools`(`routes/agent.ts:61-63`)와 capabilities의 SoT 선언 | catalog에서 생성되는 projection. 기존 export 시그니처는 유지하되 값은 `lib/contracts/catalog.ts`에서 파생 |
| `lib/capabilities.ts:12-26` command surface | schema 없는 문자열 목록 | catalog projection + availability 주석. 기존 API shape 호환 유지 |
| `skills/ima2/SKILL.md` tool 설명 | 수기 Markdown | 070에서 catalog 기반 생성으로 전환(이 phase는 hook 지점만 마련) |

마이그레이션 게이트: 기존 소비자(`routes/agent.ts`, `bin/commands/capabilities.ts:49-56` local fallback)가 값 변화 없이 통과하는 snapshot 대조 테스트를 먼저 추가한 뒤 내부 구현을 교체한다.

## 핵심 타입 (diff-level 계약)

```ts
// NEW lib/contracts/types.ts
export type ContractNamespace = "ima2" | `mcp.${string}`;
export interface ToolContract {
  id: string;                       // "ima2.generate_image" | "mcp.higgsfield.<tool>"
  namespace: ContractNamespace;
  name: string;                     // upstream 원본 이름 또는 ima2 canonical 이름
  title?: string;                   // upstream title 보존 (A-audit WP2 blocker 2)
  description: string;
  trust: "builtin" | "upstream-untrusted"; // description을 instruction으로 병합 금지 라벨
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;        // upstream 제공 시 보존; ima2 outputContract는 050이 정의(이연)
  annotations?: Record<string, unknown>; // upstream annotations 무손실 보존
  errorContract: TypedErrorCode[];  // auth_required | unavailable | schema_changed | ...
  executionOwner: "ima2-server";    // 인터뷰 Round 2로 고정
  availability: Availability;
  provenance?: SnapshotProvenance;  // mcp.* 전용
  binding?: ToolBinding;            // normalized capability <-> upstream tool 연결 (후속)
}
// snapshot 원본은 SnapshotSource{provenance, serverInstructions?, tools[]}로 무손실 유지 —
// catalog는 이를 ToolContract로 투영하되 040 sanitizer/lifecycle이 원본 shape를 계속 소유한다.
export interface Availability {
  state: "documented" | "installed" | "connected" | "callable" | "stale" | "blocked";
  cause?: "auth_required" | "entitlement" | "schema_drift" | "revoked" | "offline";
  evidence?: string;                // 판정 근거 (live tools/list ts, schema hash 등)
}
```

`callable` 전이 조건(인터뷰 rescan 설계 확정): live 세션 존재 AND live tools/list에 tool 존재 AND schema hash 일치. call-time 거부는 상태 롤백 + typed error로 처리하며, 번들 snapshot은 영구히 `documented` 이상으로 자동 승격되지 않는다.

## File change map

| Op | Path | 변경 |
|---|---|---|
| NEW | `lib/contracts/types.ts` | 위 타입 + JsonSchema/TypedErrorCode/SnapshotProvenance/ToolBinding. |
| NEW | `lib/contracts/catalog.ts` | 내장 tool 정의(현 manifest 이관) + snapshot loader 병합, id 충돌 검사, namespace 분리 조회 API. |
| NEW | `lib/contracts/availability.ts` | 상태기계: 전이표, callable predicate, cause 축 매핑. 순수 함수로 유지. |
| MODIFY | `lib/agentToolManifest.ts` | 하드코딩 배열 제거, catalog projection으로 재정의. export 시그니처 보존. |
| MODIFY | `lib/capabilities.ts` | 기존 필드 전부 불변(회귀 0) + **additive** `contracts` 요약 필드 추가(catalog 항목 수·namespace·availability 분포). tool 정의 자체는 manifest projection 경유로 이미 catalog-derived (WP2 감사 blocker 1 해소). |
| MODIFY | `routes/agent.ts` | 변경 없음 목표 — projection 호환성 테스트로 보증. |
| NEW | `tests/contracts-catalog.test.ts` | id/namespace 규칙, 충돌, projection 호환 snapshot, availability 전이표. |
| NEW | `tests/contracts-availability.test.ts` | callable predicate 진리표, cause 매핑, stale/blocked 잠금. |

## Before → after

- Before: manifest·capabilities·skill이 서로 독립 정의라 drift 가능; "알려진 기능"과 "지금 호출 가능"의 구분 없음.
- After: 단일 catalog가 정의를 소유하고, 세 표면은 파생물이며, 모든 tool 항목이 availability와 typed error 계약을 갖는다.

## Conditional activation scenarios

- Projection 회귀: catalog 도입 전후 `/api/agent/tools` 응답 diff가 0이어야 한다 (snapshot test).
- id 충돌: 같은 id의 내장/snapshot tool이 로드되면 기동 시 명시 오류가 난다.
- callable 오판: connected 상태에서 schema hash 불일치 시 callable이 아니라 `stale`이 된다.
- documented 고정: snapshot만 존재하는 provider tool이 어떤 경로로도 `callable`로 조회되지 않는다.

## Acceptance criteria

- `AGENT_TOOL_MANIFEST`와 `ima2 capabilities --json`이 catalog 파생으로 전환되고 기존 소비자 계약이 깨지지 않는다.
- 모든 catalog 항목이 namespace, availability, executionOwner, error contract를 가진다.
- callable predicate가 진리표 테스트로 고정된다.
- upstream description이 instruction으로 실행될 수 있는 경로가 없다 (렌더링 시 quoted-data 처리).

## Verification

```bash
npm run typecheck
npm run typecheck:tests
node --test --import tsx tests/contracts-catalog.test.ts tests/contracts-availability.test.ts
npm run test:inventory
```
