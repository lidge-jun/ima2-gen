---
created: 2026-07-24
tags: [ima2-gen, node-mode, phase1, graph-integrity]
status: planned (diff-level PRD — 구현은 Phase 1 PABCD 사이클)
---

# 010 — Phase 1: 그래프 사이클 검출 (W1)

레퍼런스 근거: 001 §B2.4 (ComfyUI 2단계 cycle detection, Tier-2), §C2.3
(`isValidConnection` 드래그 중 검증).

## 문제

`connectNodesImpl`(ui/src/store/storeGraphNodeImpl.ts)은 self-edge/중복/다중입력만
차단한다. A→B→C 상태에서 C→A 연결이 허용되어 사이클이 생기고,
`topologicalSortSelected`(ui/src/lib/nodeBatch.ts)는 사이클 노드를 잔여로 out 뒤에
붙여 **부모 이미지가 준비되지 않은 채 실행**한다. `deriveParentServerNodeIds`는
`edges.find(first incoming)` 기반이라 사이클에서 부모 파생이 비결정적이다.

## 변경 지도

### MODIFY ui/src/lib/nodeGraph.ts

`wouldCreateCycle` 추가 (BFS reachability — target에서 출발해 source 도달 여부):

```ts
export function wouldCreateCycle(
  edges: readonly { source: string; target: string }[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return true;
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const seen = new Set<string>([targetId]);
  const queue = [targetId];
  for (let i = 0; i < queue.length; i++) {
    for (const next of children.get(queue[i]) ?? []) {
      if (next === sourceId) return true;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return false;
}
```

### MODIFY ui/src/lib/nodeCompatibility.ts

- `CompatibilityResult.reason` 유니언에 `"CYCLE"` 추가.
- `canConnectPorts`: CARDINALITY 검사 앞에 사이클 검사 삽입 —
  `if (wouldCreateCycle(graph.edges, source.nodeId, target.nodeId)) return { allowed: false, reason: "CYCLE" };`
  (import from `./nodeGraph`).

### MODIFY ui/src/store/storeGraphNodeImpl.ts

`connectNodesImpl`: `wouldCreateMultipleIncomingEdge` 가드 다음에

```ts
if (wouldCreateCycle(get().graphEdges, sourceClientId, targetClientId)) {
  get().showToast(t("edge.cycleBlocked"), true);
  return;
}
```

### MODIFY ui/src/lib/nodeStudioGraph.ts

`validSnapshot`: edge 참조 무결성 검사 뒤에 전체 그래프 사이클 검사 추가
(template/branch 커밋 경로 방어 — Kahn 알고리즘으로 전 노드 방문 확인):

```ts
function graphHasCycle(nodes, edges): boolean { /* indegree Kahn; visited < nodes.length → true */ }
// validSnapshot 마지막에: if (graphHasCycle(nodes, edges)) return false;
```

### MODIFY ui/src/lib/nodeBatch.ts

`validateBatchDependencies` 반환을 확장하지 않고 별도 함수 추가:
`findCycleNodeIds(nodes, edges, selectedIds): string[]` — topo 방문 후 잔여 노드 반환.
`runNodeBatchImpl`(storeNodeGenImpl.ts)에서 blocked 검사 다음에 호출, 비어있지 않으면
`t("nodeBatch.cycleBlocked", { count })` 토스트 후 return.

### MODIFY ui/src/components/node-canvas/useNodeStudioController.ts

`COMPATIBILITY_REASON_KEYS`에 `CYCLE: "nodeStudio.compatibility.cycle"` 추가.
`ui/src/lib/nodeStudioCatalog.ts`의 `compatibilityReasonMessage`에도 CYCLE 분기 추가.

### MODIFY ui/src/components/NodeCanvas.tsx + useNodeConnectionController.ts (감사 fold-back #1)

드래그 **중** 검증을 실제로 배선한다 — 현재는 `onConnect`(제스처 완료 후)만 존재.

- `useNodeConnectionController`에 `isValidConnection(connection): boolean` 콜백 추가:
  source/target 포트를 `resolveNodePort`로 해석해 `canConnectPorts` (사이클 검사
  포함) verdict의 `allowed`를 반환. 포트 미해석 시 false.
- `NodeCanvas.tsx`의 `<ReactFlow ...>`에 `isValidConnection={studio.isValidConnection}`
  prop 배선 (React Flow 공식 API — 드래그 중 invalid edge 프리뷰 차단).
- 활성화 테스트: CY-05 — `isValidConnection`이 사이클 연결 후보에 false,
  정상 후보에 true를 반환 (controller 순수 로직 단위로 검증).

### MODIFY ui/src/i18n/en.json + ko.json

키 추가: `edge.cycleBlocked`, `nodeBatch.cycleBlocked`, `nodeStudio.compatibility.cycle`.

### MODIFY tests/node-compatibility.test.ts

- NC-11: A→B→C 그래프에서 C출력→A입력 `canConnectPorts` → `reason: "CYCLE"`.
- NC-12: 독립 노드 연결은 여전히 allowed.

### NEW tests/node-cycle-contract.test.js (인벤토리 등록: scripts/classify-tests.mjs 규칙 확인)

- CY-01 `wouldCreateCycle` 직접: 3-노드 체인 역방향 true, 무관 노드 false, self true.
- CY-02 `validSnapshot`(via `commitGraphSnapshot` export 경로 또는 내부 함수 export)
  사이클 그래프 커밋 거부.
- CY-03 `findCycleNodeIds`: 사이클 선택 시 해당 id 반환, 비사이클 빈 배열.
- CY-04 (activation, C-ACTIVATION-GROUNDING-01): store-level —
  `connectNodesImpl` 모킹 스토어로 사이클 연결 시 edge 미추가 + 토스트 호출 확인.
- CY-05 (activation): `isValidConnection` 드래그 중 거부/허용 (fold-back #1).

## Accept criteria (활성화 시나리오 포함)

1. 드래그 연결로 사이클 생성 시 연결 거부 + CYCLE 사유 토스트 (CY-04가 트리거 증명).
   드래그 중에도 `isValidConnection`이 invalid 프리뷰를 차단 (CY-05).
2. 템플릿/브랜치 커밋 경로로도 사이클 스냅샷 반입 불가 (CY-02).
3. 배치 실행이 사이클 선택을 실행 전에 차단 (CY-03 + 토스트).
4. 공통 게이트: typecheck/typecheck:tests/npm test/ui build green, test:inventory 통과.

## Out of scope

서버측 그래프 검증(세션 저장 스키마 접근 필요 — 000 OUT), reroute/splice UX.
