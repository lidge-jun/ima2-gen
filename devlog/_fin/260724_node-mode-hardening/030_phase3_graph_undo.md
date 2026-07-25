---
created: 2026-07-24
tags: [ima2-gen, node-mode, phase3, undo]
status: planned (diff-level PRD — 구현은 Phase 3 PABCD 사이클)
---

# 030 — Phase 3: 그래프 undo 히스토리 (W4)

레퍼런스 근거: 001 §B3.1 (tldraw interaction-batched history, T2), §B3.2 (zundo
partialize/limit, T2). 채택 결정: **의존성 추가 없이** zundo의 partialize+limit
아이디어를 경량 스냅샷 링으로 자체 구현한다 (그래프는 노드 수십 개 규모라 스냅샷
비용이 낮고, 기존 store가 immer 미사용이라 patch 방식은 과설계 — B3.4 경계 판단).

## 문제

delete/disconnect/branch append/template copy가 전부 비가역. 삭제 시
`cancelInflight` + `clearStoredNodeRefs`까지 즉시 실행되어 실수 삭제 복구 불가.
undo는 주석(`useCanvasAnnotations`)에만 존재.

## 설계 (interaction 단위 스냅샷)

- 히스토리 대상: `graphNodes` + `graphEdges`만 (partialize). pending/inFlight/
  selection은 제외 — undo가 in-flight 요청을 되살리지 않는다.
- 기록 시점: **모든 구조적 mutation 직전** 1회 (interaction 단위, 감사 fold-back #2 —
  전체 인벤토리): `addRootNode`, `createRootNodeFromHistoryItem`, `addChildNode`,
  `addSiblingNode`, `addChildNodeAt`, `duplicateBranchRoot`, `deleteNode(s)`,
  `disconnectEdges`, `connectNodes`, `commitGraphSnapshot`(template/branch/palette/
  element-drop). 프롬프트 타이핑·드래그 이동은 기록하지 않는다
  (tldraw squash 원칙의 최소 적용 — 이동 undo는 후속 append 후보).
- `commitGraphSnapshot` 경로의 기록 순서 (fold-back #4): `validSnapshot`이 후보를
  **수락한 뒤, setState 직전**에 기록한다 — 거부된 template/branch/palette 시도가
  빈 undo 엔트리를 만들면 안 된다.
- 링 버퍼 limit 30. redo 스택은 새 기록 시 클리어 (표준 시맨틱).
- undo 시 반입 스냅샷은 `deriveParentServerNodeIds` 재파생 + 현재 in-flight 노드의
  pending 필드는 현재 상태 우선 병합 (pending 노드가 스냅샷에 empty로 있으면 현재
  데이터 유지 — 생성 중 노드 보호).
- 삭제 undo 한계: `clearStoredNodeRefs`로 지운 localStorage refs는 복원 불가 →
  스냅샷에 refs가 노드 data로 남아 있으므로 이미지 자체는 복원됨. cancelInflight는
  비가역 — pending 노드 삭제 undo는 empty 상태로 복원 (명시 한계, 문서화).

## 변경 지도

### NEW ui/src/lib/nodeHistory.ts (<120줄)

```ts
export type GraphSnapshotEntry = { nodes: GraphNode[]; edges: GraphEdge[]; label: string; at: number };
export function pushHistory(stack, entry, limit=30): stack
export function popUndo(past, present, future): { past, present, future } | null
export function popRedo(...): ... | null
export function mergeAfterRestore(snapshot, current): { nodes, edges }  // pending 보호 병합
```

순수 함수만 — store 비의존 (테스트 용이).

### MODIFY ui/src/store/storeTypes.ts

`graphHistoryPast: GraphSnapshotEntry[]`, `graphHistoryFuture: GraphSnapshotEntry[]`,
액션 `recordGraphHistory(label)`, `undoGraph()`, `redoGraph()` 시그니처 추가.

### MODIFY ui/src/store/storeGraphNodeImpl.ts + nodeStudioGraph.ts

위 인벤토리의 **모든** 구조적 mutation impl에 `get().recordGraphHistory("<label>")`
1줄 (add-root/child/sibling/child-at/duplicate 포함 — fold-back #2).
`commitGraphSnapshot`은 validSnapshot 수락 후·setState 직전에 reason을 label로
전달해 기록한다 (fold-back #4).

### MODIFY ui/src/store/useAppStore.ts

세 액션 구현 배선 (nodeHistory 순수 함수 호출 + `scheduleGraphSave`).
세션 전환 시 히스토리 클리어 (wp3 감사 블로커 #1 — 두 경로 모두):
`switchSessionImpl`은 `apiGetSession` 성공 후 그래프 교체 `set(...)`에 함께 클리어
(flushGraphSave 실패로 전환이 막히면 undo 보존), `createAndSwitchSessionImpl`도
그래프 교체 시 클리어.

**스냅샷 격리 (wp3 감사 블로커 #2):** 히스토리 엔트리는 기록 시점에
`structuredClone`으로 nodes/edges를 복제한다 — store 객체 참조 보유 금지.
`errorInfo`는 일반 노드 데이터로 스냅샷에 포함·복원한다. pending 병합은
pending/recovery 필드만 현재 상태 우선이고 non-pending 노드의 역사적 errorInfo는
스냅샷 값을 따른다. GH-08: 중첩 필드(referenceImages/video/errorInfo) identity
격리 회귀 테스트. GH-09: 비동기 후속(map by id — addChild 프레임 추출,
duplicate ref 압축)이 undo로 제거된 노드에 no-op인지 레이스 테스트.
키보드는 onKeyDown 최상단 mod-key 분기, editable 가드 유지, 처리 시에만
preventDefault (감사 확인 사항).

### MODIFY ui/src/lib/nodeStudioKeyboard.ts + NodeCanvas.tsx

캔버스 포커스에서 `mod+z` → undoGraph, `mod+shift+z` → redoGraph
(isEditable 가드 유지 — 프롬프트 입력 중에는 브라우저 기본 undo).

### MODIFY ui/src/i18n

`graph.undone`, `graph.redone`, `graph.nothingToUndo` 토스트 키.

### NEW tests/node-history-contract.test.js

- GH-01 push/limit: 31회 push 시 가장 오래된 항목 탈락.
- GH-02 undo→redo 왕복이 원 그래프 복원.
- GH-03 새 기록이 redo 스택 클리어.
- GH-04 (activation) mergeAfterRestore: pending 노드가 스냅샷의 empty로
  격하되지 않음 — pending 필드 유지 관찰.
- GH-05 (activation) 삭제 후 undo: 노드+엣지+refs 데이터 복원, 세션 전환 시
  히스토리 클리어 — 소스 계약 매치 포함.
- GH-06 (fold-back #2) add 계열 mutation(addChildNode 등)도 undo 대상 — add 후
  undo가 추가 노드/엣지를 제거.
- GH-07 (fold-back #4, activation) 유효하지 않은 스냅샷 커밋 거부 시 히스토리
  불변 — 거부 전후 past 스택 길이 동일 관찰.

## Accept criteria (활성화 시나리오)

1. 노드 삭제 → mod+z → 노드·엣지 복원 (GH-05 + 렌더 관찰로 트리거 증명).
2. 생성 중(pending) 노드가 있는 상태의 undo가 해당 노드의 진행 상태를 보존 (GH-04).
3. 히스토리가 30개로 바운드되고 세션 전환 시 초기화 (GH-01, GH-05).
4. 공통 게이트 green + C-RENDER-GROUNDING-01 관찰 (undo 동작 UI).

## Out of scope

드래그 이동 undo(후속 append 후보), 서버측 히스토리, 주석 undo와의 통합.
