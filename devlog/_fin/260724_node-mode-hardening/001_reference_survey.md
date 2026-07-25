---
created: 2026-07-24
tags: [ima2-gen, node-mode, research, cxc-search]
status: research (000-range, no diffs here — LEXICO-SPLIT-01)
---

# 001 — 노드모드 레퍼런스 서베이 (티어드 서브에이전트 수집)

수집 방법: cxc-search 티어드 파견. Sol 심층 2레인(UX 패턴 / 엔지니어링 패턴) +
Luna 광역 discovery 1레인. Tier-2(원문 열람 증명) 표기는 각 레인의 보고 그대로 유지.
기준일 2026-07-24.

## A. 광역 landscape (Luna 레인, Tier1 중심)

검증(yes)은 공식 페이지 직접 열람, candidate는 스니펫 기반.

| Tool | Node/canvas offering | Distinctive | URL | verified |
|---|---|---|---|---|
| ComfyUI | 범용 노드 그래프 이미지·비디오·오디오 | 커스텀 노드 생태계, JSON 워크플로 공유 | https://docs.comfy.org/ | yes |
| InvokeAI | Unified Canvas + Node Workflows | 커스텀 UI 파라미터 노출 | https://invoke.ai/ | yes |
| Runway Workflows | 클라우드 노드 그래프 | 노드 잠금, 분기·배치, 워크플로→앱 게시 | https://help.runwayml.com/hc/en-us/articles/45763528999699 | yes |
| Figma Weave | 멀티모달 노드 캔버스 | 스토리보드 일관성, 마스킹·컴포지팅 | https://www.figma.com/solutions/ai-storyboard-generator-weave/ | yes |
| Freepik/Magnific Spaces | 무한 캔버스 노드 | Spotlight 노드 검색, 미니맵, 협업 | https://www.magnific.com/ru/ai/docs/getting-started-with-spaces | yes |
| Weavy | 편집도구+AI모델 노드 연결 | 다층 합성, 매트 조작 | https://www.weavy.ai/ | yes |
| SwarmUI | 간단 UI + Comfy Workflow Editor 병행 | 워크플로 입력의 간단 UI 승격 | https://swarmui.net/ | yes |
| Krita AI Diffusion | Krita 캔버스 ↔ ComfyUI | 레이어·마스크 인페인팅, 커스텀 JSON 워크플로 | https://github.com/Acly/krita-ai-diffusion/wiki/Custom-Workflows | yes |
| Flowise / Langflow | AI 파이프라인 캔버스 | 조건 분기, Playground, MCP | https://docs.flowiseai.com/ , https://docs.langflow.org/concepts-overview | yes |
| Firefly Boards | 무한 캔버스 아이디어 보드 | 멀티 모델, Generative Fill | (리뷰 소스) | yes |
| ComfyUI Copilot | LLM 그래프 자동 구성 | 자연어→그래프 | https://aclanthology.org/2025.acl-demo.61.pdf | candidate |

타사에 없는/드문 기능 아이디어 (Luna 레인 종합):

1. 그래프 내 이미지·비디오·오디오·3D 혼합 + 프레임별 모델 선택.
2. **노드 단위 결과 잠금** — 재실행 시 특정 결과만 보존 (Runway Workflows).
3. 복잡한 그래프 입력의 **간단 UI 자동 승격** (SwarmUI/InvokeAI publish).
4. 스크립트·캐릭터 기반 스타일/연속성 유지 (StoryboardCanvas Style-Lock).
5. 생성·편집·마스킹·색보정·업스케일의 재사용 파이프라인화 (Weavy).

## B. 엔지니어링 패턴 (Sol 레인 2, 전부 Tier-2 열람 증명)

### B1. React Flow 성능 (공식 문서)

| # | 기법 | 채택비용 | 출처 |
|---|---|---|---|
| 1.1 | memo/useCallback/useMemo로 렌더 입력 참조 안정화 | low | reactflow.dev/learn/advanced-use/performance |
| 1.2 | 전체 nodes 배열 구독 금지 — 좁은 selector/파생 상태 | medium | 동일 + state-management |
| 1.3 | `onlyRenderVisibleElements` 벤치마크 기반 활성화 | low | reactflow.dev/api-reference/react-flow |
| 1.4 | 접힌 그룹 자식 `hidden` 처리, 장식 축소 | medium | performance 문서 |
| 1.5 | controlled flow + Zustand 중앙 store (현행 구조 일치) | medium | uncontrolled-flow + state-management |

### B2. 그래프 모델/실행 엔진 (ComfyUI/InvokeAI 소스)

| # | 기법 | 채택비용 | 출처 |
|---|---|---|---|
| 2.1 | typed sockets + port identity 저장 | medium | reactflow handles + docs.comfy.org datatypes |
| 2.2 | 연결 시 클라 검증 + 실행 전 서버 재검증 (이중) | medium | reactflow validation + ComfyUI VALIDATE_INPUTS |
| 2.3 | indegree 기반 incremental topological scheduler | high | ComfyUI comfy_execution/graph.py |
| 2.4 | 2단계 cycle detection (edge 생성 시 + 실행 전) | medium | ComfyUI graph.py/execution.py |
| 2.5 | input-signature 기반 dirty-subgraph 부분 재실행 | high | ComfyUI caching.py |
| 2.6 | graph/editor/execution/artifact 상태 계층 분리 | high | InvokeAI workflow-api |

### B3. Undo/redo·persistence

| # | 기법 | 채택비용 | 출처 |
|---|---|---|---|
| 3.1 | interaction 단위 diff history (mark+squash, bail) | high | tldraw.dev/sdk-features/history |
| 3.2 | zundo temporal + partialize + limit | low–medium | github.com/charkour/zundo |
| 3.3 | Immer forward/inverse patches | medium–high | immerjs.github.io/immer/patches |
| 3.5 | versioned autosave envelope + recovery draft 분리 | medium | reactflow save-and-restore |

### B4. 에러/복구 UX

| # | 기법 | 채택비용 | 출처 |
|---|---|---|---|
| 4.1 | node-scoped structured error (`nodeId/category/retryability`) | medium | ComfyUI execution.py + cloud API |
| 4.2 | status machine 계약 (`pending→in_progress→completed\|failed\|cancelled`) | low | ComfyUI cloud API + InvokeAI |
| 4.3 | batch = 독립 item 집합 (부분 성공 보존) | medium | InvokeAI enqueue_batch |
| 4.5 | retryability 분류별 액션 분기 | medium | ComfyUI 오류 분류 |
| 4.6 | 대기열 취소 / 실행 중단 / 히스토리 삭제 분리 | low–medium | ComfyUI queue API |
| 4.7 | durable queue crash recovery (lease/heartbeat) | high | candidate — unverified |

Sol 레인 2 종합 Top-8: (1) typed ports 이중 검증, (2) dirty-subgraph 캐시 실행,
(3) incremental topo scheduler + 서버 cycle detection, (4) 상태 계층 분리,
(5) 좁은 selector + memoized props, (6) node-scoped 에러 + item terminal status,
(7) interaction-batched undo/redo 하이브리드, (8) versioned autosave + recovery draft.

## C. UX 패턴 (Sol 레인 1)

전부 Tier-2 열람 증명 (candidate 표기 예외). 기준일 2026-07-24.

### C1. ComfyUI UX

| # | PATTERN | 요지 | Tier |
|---|---|---|---|
| C1.1 | 더블클릭 quick-add 검색 | 빈 캔버스 더블클릭 → 커서 위치에 노드 검색 (fuzzy, 프리뷰) | T2 (docs.comfy.org/interface/shortcuts) |
| C1.2 | **connection-aware quick-add** | 포트에서 드래그 후 빈 곳에 놓으면 해당 타입 호환 노드 메뉴 | T2 (core-concepts/nodes) |
| C1.3 | 타입별 색상 포트/와이어 | 데이터 타입 색상 + 비호환 연결 차단 | T2 (core-concepts/links) |
| C1.4 | 네이티브 edge reroute | 와이어 경유점으로 가독성 확보 | T2 |
| C1.5 | Never/Bypass 시맨틱 분리 | mute(출력 차단)와 bypass(통과) 구분 → A/B 실험 | T2 |
| C1.6 | floating selection toolbox | 선택 시 색/우회/잠금/삭제 미니 툴바 | T2 |
| C1.7 | Frame(Ctrl+G) 시각 조직 | 실행 의미 없는 스테이지 라벨링 | T2 |
| C1.8 | 재사용 subgraph | 선택 → 접기 → 라이브러리 게시. 단 2026-03 frontend #10585: subgraph/widget promotion은 회귀 다발 영역 — 직렬화·상태 관리 기능으로 취급할 것 | T2 |
| C1.9 | 워크플로/템플릿 라이브러리 분리 | 빈 캔버스 대신 검증된 시작점 | T2 |
| C1.10 | 퍼스트클래스 큐/히스토리 | 순서·취소·우선순위·실패 위치 노출; 제출 시 상태 스냅샷 (discussion #2617) | T2 |

사용자 여론(discussion #2149, T2): 유연성 호평 / "강력하지만 일상 사용엔 다듬어지지 않음",
그룹 bypass와 **단순화된 run view**(선택 컨트롤만 노출) 요구. Frontend #10585: 테스트
커버리지 부족으로 회귀 다발 인정.

### C2. React Flow 공식

| # | PATTERN | Tier |
|---|---|---|
| C2.1 | memoized 렌더 (B1.1과 동일) | T2 |
| C2.2 | progressive disclosure (접기 + 줌 레벨별 디테일 축소) | T2 |
| C2.3 | `isValidConnection` 드래그 중 검증 | T2 |
| C2.4 | 키보드 조작 그래프 (Tab/Enter/Esc/화살표 이동) | T2 (accessibility) |
| C2.5 | `ariaLabelConfig` 현지화 + ARIA live 이동 피드백 | T2 |
| C2.6 | helper lines 스냅핑 (Pro example) | T2 |
| C2.7 | Controls: fit/lock/zoom | T2 |
| C2.8 | 타입별 색상 minimap | T2 |
| C2.9 | auto-layout은 명시적 액션 (Dagre/ELK), 전체 이동은 undo 1단위 | T2 |

### C3. tldraw / Blender / FigJam

| # | PATTERN | Tier |
|---|---|---|
| C3.1 | tldraw: 다중 발견 경로 (단축키+컨텍스트 메뉴+팔레트) | T2 |
| C3.2 | tldraw: 고정 줌 인디케이터/메뉴 | T2 |
| C3.3 | Blender: 와이어 위 드롭 → 노드 삽입(splice) | candidate — unverified |
| C3.4 | Blender: 링크 긋기 컷/뮤트 | candidate — unverified |
| C3.5 | Blender: delete-with-reconnect | candidate — unverified |
| C3.6 | Blender: Frame vs Group 구분 | candidate — unverified |
| C3.7 | FigJam: marquee/Shift 추가 선택/Esc 해제, 잠긴 객체 marquee 제외 | T2 |
| C3.8 | FigJam: Space 임시 hand tool | T2 |
| C3.9 | FigJam: Shift+1 전체 fit / Shift+2 선택 fit | T2 |
| C3.10 | FigJam: align/distribute/tidy-up | T2 |
| C3.11 | FigJam: 완성 영역 lock | T2 |

### Sol 레인 1 Top-10 (원문 순서 유지)

1. connection-aware quick-add 2. 타입 연결 피드백 강화 3. 퍼스트클래스 비동기 큐
4. bypass 프리미티브 5. subgraph+frame 분리 6. 배선 없는 삽입/삭제(splice)
7. progressive disclosure 8. 보편 캔버스 내비게이션 9. 로컬 정리 보조(undo 1단위)
10. **simplified run view**.

전략 결론: ComfyUI의 유연성은 호평받지만 그래프-우선 노출 자체가 반복되는 사용성
불만이다. 전문가 캔버스 + connection-aware 가이드 + 견고한 큐 시맨틱 + 단순화된
run surface의 조합이 최선의 방향.

## D. ima2-gen 현행 대비 갭 매핑 (메인 세션 판단)

로컬 코드 탐사(P-phase) 결과와의 대조:

| 갭 | 현행 상태 (근거) | 레퍼런스 |
|---|---|---|
| **그래프 undo/redo 부재** | `useCanvasAnnotations`에만 undo 존재; graphNodes/graphEdges 조작(delete/disconnect/branch)은 복구 불가 | B3.1–3.3 |
| **클라 검증만 존재, 서버 그래프 검증 없음** | `nodeCompatibility.ts`는 UI 전용; 서버 `validateNodeInputs`는 prompt/refs/moderation만 검사, edge/cycle 미검증 | B2.2, B2.4 |
| **cycle detection 부재** | `wouldCreateMultipleIncomingEdge`만 있음; connect 시 사이클 미검사 (topologicalSortSelected는 사이클 노드를 뒤에 붙임) | B2.4 |
| **노드 에러 상태 빈약** | `error` 문자열 1개 (`ImageNode.tsx:195`); category/retryability 없음 | B4.1, B4.5 |
| **배치 부분 실패 UX** | nodeBatch는 의존성 차단만; 실패 후 재시도 affordance 없음 | B4.3 |
| **키보드/팔레트 커버리지** | `/`와 Space만; 복제·복사·정렬·fit 단축키 없음, `NODE_STUDIO_COMMANDS` 1종뿐 | C (대기), A-3 |
| **성능 방어** | NodeCanvas가 store 전체 nodes/edges 구독; `onlyRenderVisibleElements` 미사용 | B1.2, B1.3 |
| **결과 잠금/보존** | regenerate-in-place가 기존 이미지를 덮어씀; 노드 잠금 개념 없음 | A-2 |
