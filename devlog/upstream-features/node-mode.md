# Node Mode 정식화 + 스트리밍 + 배치 선택

> 마스터: [README.md](README.md) — Phase 4.2
> 참조: upstream `c5aa4ca` (productize) `04f8bf5` (stream partial images) `a91fef4` (batch selection) `6e02cbc` (refs/regen flows) `9d2d2e8` (node-local refs) `2c6a38b` `47a9a93` `571ecd9` (node UI 폴리싱) `26e95be` (Duplicate branch auto-seed)

## 배경

Node mode는 그래프 형태로 이미지 생성 흐름을 시각화 — 노드 = 이미지, 엣지 = "이거 기반으로 변형/편집" 관계. 우리도 이미 일부 코드(lightbox/inflight 등) 보유.

upstream은 이 모드를 **실험에서 정식 제품**으로 승격: 부분 이미지 스트리밍, 노드 배치 선택/삭제, refs/regen flow 개선.

**주의**: node mode 사용자가 실제로 쓰는지 먼저 확인. 안 쓰면 Phase 4.2는 skip.

## 동작 명세

### 정식화 (`c5aa4ca`)

- node mode 진입점 안정화 — 사이드바 또는 mode switch
- 노드 layout 자동 정렬 (`ui/src/lib/nodeLayout.ts`)
- 노드 footer actions 컴팩트 정리 (`2c6a38b`)
- 연결 핸들 클릭 영역 확대 (`47a9a93`)
- 노드 미리보기 aspect ratio 보존 (`571ecd9`)

### 부분 이미지 스트리밍 (`04f8bf5`)

OpenAI 이미지 모델은 SSE로 부분 이미지(`data.partial_image`) 전송 가능. 노드 카드에 placeholder → 부분 이미지 → 최종 이미지 progressive 렌더.

서버:
- `/api/node/generate`에서 SSE 스트림 그대로 클라이언트로 전달
- 부분 이미지는 base64 → 임시 blob URL or data URI

UI:
- 노드 카드가 `pending → partial(N%) → complete` 상태 전이
- 부분 이미지가 들어올 때마다 카드 이미지 src 교체

### 배치 선택 (`a91fef4`)

`ui/src/lib/nodeSelection.ts` `nodeBatch.ts`:
- Shift-click / Ctrl-click → 다중 선택
- 영역 드래그 선택
- 선택된 노드 일괄: 삭제 / 복제 / 이동 / 같은 prompt로 regenerate

### refs/regen flow (`6e02cbc`)

- 노드에서 다른 노드로 reference 연결 시 자동 prompt seed
- "Regenerate" 액션이 부모 노드의 refs/prompt 자동 승계
- "Duplicate branch" — 노드 + 자식 트리 통째 복사 (`26e95be`)

### Node-local refs (`9d2d2e8`)

노드별로 reference 이미지 사이드카 저장 — 그래프 저장 시 ref도 같이 (그래프 단독으로 재현 가능).

## 영향 파일

| 파일 | 변경 |
|------|------|
| `lib/nodeStore.js` (있으면) | 노드 영속화 + ref 사이드카 |
| `server.js` | `/api/node/generate` SSE 부분 이미지 |
| `ui/src/lib/nodeLayout.ts` | 신규 |
| `ui/src/lib/nodeSelection.ts` | 신규 |
| `ui/src/lib/nodeBatch.ts` | 신규 |
| `ui/src/lib/nodeRefStorage.ts` | 신규 |
| `ui/src/components/NodeCanvas.tsx` | 부분 이미지 + 배치 선택 |
| `ui/src/components/NodeCard.tsx` | progressive 렌더, 컴팩트 footer |

## 검증

1. **스트리밍**: 느린 네트워크 시뮬레이션에서 부분 이미지 점진 표시
2. **배치**: 5개 노드 선택 → 일괄 삭제 → undo
3. **Duplicate branch**: 자식 3 deep 노드 복사 후 ref 보존
4. **회귀**: 기존 그래프 저장 파일 호환 (사이드카 누락 시 graceful)

## 의존성 / 순서

- Phase 1.4 (graph save 충돌 방어) 선행 필수
- Phase 2.4 (inflight 영속화) 선행 — 부분 스트리밍 중 새로고침 시 복구

## 진행 게이트

**사용자 확인**: node mode 사용 의향. 단순 generate만 쓰면 4.2는 skip.

## 분량 예측

7커밋 + 폴리싱. **5~7일** 소요 예상 (그래프 UI는 항상 어렵다).
