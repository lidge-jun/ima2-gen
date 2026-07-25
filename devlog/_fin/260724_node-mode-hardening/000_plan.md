---
created: 2026-07-24
tags: [ima2-gen, node-mode, roadmap, pabcd]
status: active (docs-only roadmap cycle — LOOP-DOCS-FIRST-01)
session: 019f8fec-b04a-7f50-bcf2-e7a8e136026f
goalplan: ima2-gen-node-studio-pabcd-docs-only-loop-docs-f
---

# 000 — 노드모드 보강 로드맵 (260724_node-mode-hardening)

## Objective

노드모드(Node Studio)의 구조적 약점을 레퍼런스 근거(001) 기반으로 보강한다.
각 phase는 독립 PABCD 사이클 1개로 실행한다 (one work-phase = one cycle).

## 현행 구조 (P 탐사 근거)

- 클라 그래프: `ui/src/store/storeGraphNodeImpl.ts`(node/edge CRUD),
  `storeNodeGenImpl.ts`(생성 실행/배치), `storeGraphSave.ts`(debounce 저장 + 409 재로드).
- 그래프 유틸: `ui/src/lib/nodeGraph.ts`(부모 파생), `nodeCompatibility.ts`(포트 타입
  검증), `nodePortCatalog.ts`(핸들→논리 포트), `nodeBatch.ts`(topo sort/의존성 차단),
  `nodeBranching.ts`(변형 분기), `nodeStudioGraph.ts`(스냅샷 커밋/validSnapshot).
- 캔버스: `NodeCanvas.tsx` + `node-canvas/*` 컨트롤러, `ImageNode.tsx`.
- 서버: `routes/nodes.ts`(생성/조회), `lib/nodeGeneration.ts`, `lib/nodeValidation.ts`
  (prompt/refs/moderation만 검증 — 그래프 구조는 미검증).

## 확정 약점 (코드 근거 → 레퍼런스 매핑은 001 §D)

| # | 약점 | 코드 근거 |
|---|---|---|
| W1 | **사이클 미검출** | `connectNodesImpl`은 self-edge/중복/다중입력만 차단. `canConnectPorts`에 CYCLE reason 없음. `validSnapshot`도 미검사. `topologicalSortSelected`는 사이클 노드를 잔여로 뒤에 붙여 실행해버림 |
| W2 | **노드 에러 구조 빈약** | `ImageNodeData.error?: string` 1개. `lib/errorClassify.ts`의 ImaErrorCode 분류가 노드 데이터에 미전달, 재시도 affordance 없음 |
| W3 | **배치 부분 실패 = 전체 중단** | `runNodeBatchImpl`: `if (!nodeId) { toast; break; }` — 실패 노드와 무관한 독립 후보도 중단 |
| W4 | **그래프 undo 부재** | delete/disconnect/branch/template 커밋 모두 비가역. undo는 `useCanvasAnnotations`(주석)에만 존재 |

## Work-phase map (의존성 순서 — PHASE-SPLIT-01)

```
Phase 0 (this cycle): docs-only 로드맵 + 레퍼런스 서베이  → 000/001/010/020/030
Phase 1 (010): 그래프 무결성 — 사이클 검출 (스키마/계약 기반층)
Phase 2 (020): 노드 에러 구조화 + 재시도 + 배치 부분 실패 (실행 계층, 010의 계약 위)
Phase 3 (030): 그래프 undo 히스토리 (상태 계층 — 020까지 확정된 mutation 집합 위)
```

순서 근거: W1은 그래프 계약 자체라 최하층(020의 배치 continue-on-error가 topo 순서
정합성에 의존). W2/W3은 실행-상태 필드를 추가하므로 undo 스냅샷 대상 필드가 W3 전에
확정되어야 한다. 효과 크기가 아니라 빌드 순서로 슬라이스했다.

APPEND-friendly: 캔버스 UX/성능(040 후보 — onlyRenderVisibleElements 벤치, 단축키
확장, connection-aware 팔레트 확대)은 LOOP-UNIT-CHAIN-01에 따라 로드맵 lock 후에도
P-phase amendment로 append 가능. 이번 lock 범위는 010–030.

## Scope

- IN: `ui/src`의 node* 파일, `ui/src/store/store*`의 노드 관련 슬라이스, `tests/`,
  이 devlog 유닛. i18n 키 추가(`ui/src/i18n`).
- OUT: 릴리스/배포/npm publish, git push, provider/MCP 코드, `ui/dist` 수동 편집,
  서버 그래프 저장 스키마 변경(세션 마이그레이션 리스크 — 별도 유닛).

## Verifier (모든 phase 공통 C 게이트)

```
npm run typecheck && npm run typecheck:tests && npm test && (cd ui && npm run build)
```

UI 표면 변경 phase(020)는 C-RENDER-GROUNDING-01 렌더 관찰 포함.

## Loop-spec (C2–C3 헤더)

- Loop archetype: spec-satisfaction repair (verifier가 done 정의).
- Trigger: 사용자 명시 요청(노드모드 보강 루프).
- Goal: W1–W4 해소가 phase별 테스트+게이트로 증명됨.
- Non-goals: 서버 그래프 스키마 변경, 실행 캐시/subgraph(레퍼런스상 high-cost 항목).
- Stop: 010–030 D 완료 or 터미널 상태(BLOCKED/NEEDS_HUMAN/BUDGET_EXHAUSTED).
- Memory artifact: 이 유닛 + goalplan ledger.
- HOTL bounds: 로컬 커밋만, push 금지. 도구는 로컬 셸+서브에이전트. 세션 토큰
  예산 내에서 phase 단위 진행; 고갈 시 BUDGET_EXHAUSTED 보고.
- Escalation: 동일 실패 2회 → 루트코즈 모드, 3회 → P 재진입 (LOOP-REPAIR-01).

## SoT sync 대상

`structure/` 문서 중 노드모드 아키텍처 언급부(각 phase C에서 확인·패치).
