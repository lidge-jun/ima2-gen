---
created: 2026-07-24
tags: [ima2-gen, node-mode, phase2, error-recovery, batch]
status: planned (diff-level PRD — 구현은 Phase 2 PABCD 사이클)
---

# 020 — Phase 2: 노드 에러 구조화 + 배치 부분 실패 (W2, W3)

레퍼런스 근거: 001 §B4.1 (node-scoped structured error, ComfyUI T2), §B4.3
(batch = 독립 item 집합, InvokeAI T2), §B4.5 (retryability 분류별 액션).

## 문제

1. `ImageNodeData.error?: string` — 표시용 문자열뿐. `lib/errorClassify.ts`가 만드는
   `ImaErrorCode`가 노드에 남지 않아 UI가 "재시도 가능한가"를 판단 못 한다.
   실패 노드에 재시도 버튼이 없다 (`ImageNode.tsx` error 상태는 문구만 렌더).
2. `runNodeBatchImpl`: 한 노드 실패 시 `break` — 실패 노드의 downstream이 아닌
   독립 후보까지 중단된다 (storeNodeGenImpl.ts:~408).

## 변경 지도

### MODIFY ui/src/store/storeTypes.ts

```ts
export type NodeErrorInfo = {
  message: string;
  code?: ImaErrorCode;      // ui/src/lib/errorCodes.ts의 기존 유니언 타입 재사용 (감사 fold-back #3)
  retryable: boolean;
  occurredAt: number;
};
// ImageNodeData에 추가:
//   errorInfo?: NodeErrorInfo | null;   (기존 error?: string 유지 — 하위호환)
```

### NEW ui/src/lib/nodeErrorInfo.ts (<50줄)

`buildNodeErrorInfo(err: unknown): NodeErrorInfo` — `resolveErrorSpec`(errorCodes.ts)
으로 `.code`/`.errorCode`/message를 정규화. **CTA-only 매핑은 불건전** (wp2 감사
블로커 #1): 글로벌 ErrorCard의 CTA와 인라인 노드 액션은 다르다. 확정 매핑 규칙
(코드 수준 exhaustive, `satisfies Record<ImaErrorCode, ...>`):

- `auth` (retryable=false): spec.cta==="reauth" ∪ {AUTH_API_KEY_INVALID,
  APIKEY_DISABLED, AGY_QUOTA_EXHAUSTED} — 계정/키/쿼터 조치 유도.
- `retry` (retryable=true): spec.cta==="retry" ∪ spec.cta==="reload" ∪
  {EMPTY_RESPONSE, DB_ERROR, UNKNOWN} — 노드 로컬 복구는 reload가 아니라 재시도.
- `fix-input` (retryable=false): 나머지 dismiss 계열 — REF_*, MODERATION_REFUSED,
  SAFETY_REFUSAL, INVALID_REQUEST, INVALID_MODERATION,
  OAUTH_IMAGE_CAPABILITY_UNAVAILABLE 등 입력/기능 한계.

테스트는 34개 `ImaErrorCode` 전 멤버를 이 표에 대해 전수 검증하고 `.errorCode`
정규화 경로도 커버한다.

### MODIFY ui/src/store/storeNodeGenImpl.ts

- catch 블록: `error: msg` 유지 + `errorInfo: buildNodeErrorInfo(err)` 기록.
- 성공/취소 경로에서 `errorInfo: null` 초기화 (기존 `error: undefined` 옆).
- `runNodeBatchImpl` 부분 실패:

```ts
// break 대신 (wp2 감사 블로커 #3 반영 — failed/skipped 분리 집계):
let failedCount = 0;
let skippedCount = 0;
const skipIds = new Set<string>();
// 루프 선두: if (skipIds.has(candidateId)) { skippedCount += 1; continue; }
if (!nodeId) {
  failedCount += 1;
  for (const id of collectDownstream(get().graphEdges, candidateId)) skipIds.add(id);
  continue;   // 독립 후보는 계속. 개별 nodeBatch.failed 토스트는 제거 —
              // 종료 시 partial 요약 1회만.
}
// 종료: failedCount>0 ? t("nodeBatch.partialFinished", { done, failed: failedCount, skipped: skippedCount, total })
//                     : t("nodeBatch.finished", ...)
// nodeBatchStopping break는 유지 (stop 요청 시 partial 요약으로 종료).
```

`collectDownstream(edges, rootId): string[]`은 nodeBatch.ts에 순수 함수로 추가
(getUnselectedDownstreamIds와 달리 선택 여부 무관 전체 도달 집합).

**비디오 배치 경로 (wp2 감사 블로커 #2):** `runVideoGenerate(candidateId)`는
`parentServerNodeIdOverride`를 받지 않아 방금 생성된 부모의 fresh serverNodeId를
쓸 수 없다. continue-on-error 도입 전, 각 성공 직후의 기존 stale-marking 블록이
direct children의 `parentServerNodeId`를 이미 갱신하므로(directChildren 분기),
**선택된 직계 자식에도 같은 갱신을 적용**하는 라인을 추가해 비디오 경로가 저장된
parentServerNodeId 조회만으로 fresh 부모를 보게 한다. BP-04: A→C 선택 비디오
배치에서 C가 A의 새 serverNodeId를 참조함을 검증.

### MODIFY ui/src/components/ImageNode.tsx

error 상태 footer에 액션 버튼 렌더:

- `errorInfo?.retryable` → "재시도" 버튼: `generateNodeInPlace(id)` 재호출.
- `nodeRetryActionKey === "auth"` → 안내 문구 키 `node.errorAuthCta`.
- 그 외(fix-input) → 문구 키 `node.errorFixCta` (프롬프트/참조 수정 유도).
- 카드 테두리 `--node-error` 유지, `title`에 code 표기.

### MODIFY ui/src/i18n/en.json + ko.json

`node.retry`, `node.errorAuthCta`, `node.errorFixCta`, `nodeBatch.partialFinished`,
`nodeBatch.skippedDownstream` 키 추가.

### NEW tests/node-error-info-contract.test.js

- EI-01 `buildNodeErrorInfo`: MODERATION_REFUSED → retryable=false.
- EI-02 네트워크류(ECONNRESET 메시지) → retryable=true.
- EI-03 AUTH_CHATGPT_EXPIRED → actionKey "auth".
- EI-03b 레지스트리 정합: errorCodes.ts의 CTA 분류와 nodeRetryActionKey 매핑이
  어긋나는 코드가 없음을 전수 검사 (fold-back #3).
- EI-04 (activation) 소스 계약: storeNodeGenImpl catch가 `errorInfo:` 기록,
  성공 경로가 `errorInfo: null` 재설정 — 소스 매치 + 함수 단위 실행 검증.

### MODIFY tests/node-batch-contract.test.js (+ 필요시 NEW tests/node-batch-partial-contract.test.js)

- BP-01 `collectDownstream`: 체인/다이아몬드에서 도달 집합 정확.
- BP-02 (activation) 부분 실패 시나리오: 후보 [A(실패), B(독립), C(A의 child)]에서
  B는 실행되고 C는 스킵됨 — 모킹 스토어로 실행 순서/스킵 관찰.
  + stop-after-failure 변형: 실패 후 nodeBatchStopping 시 partial 요약으로 종료.
- BP-03 종료 토스트가 done/failed/skipped 카운트를 전달.
- BP-04 비디오 배치 parent 전파 (블로커 #2).

## Accept criteria (활성화 시나리오)

1. 실패 노드에 code 기반 재시도/CTA가 표시되고, 재시도 클릭이 실제 재실행을
   트리거한다 (EI-04 + 렌더 관찰).
2. 배치에서 한 노드 실패가 독립 후보 실행을 막지 않고, 실패 downstream만 스킵된다
   (BP-02가 트리거 증명).
3. C-RENDER-GROUNDING-01: 에러 상태 노드 UI를 dev 서버 렌더로 관찰 (에러 주입
   fixture 또는 스토리 상태), 관찰 기록을 attest에 포함.
4. 공통 게이트 green.

## Out of scope

큐 UI 전면 개편, durable queue(001 §B4.7 candidate), 서버 재시도 정책 변경.
