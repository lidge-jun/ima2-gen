# 051 — wp5 로드맵 확장: 현재 기능 반영 amendment

**Amendment 범위:** 이 문서는 050의 "도입 로드맵 제안" 실행 조건과 Accept를 치환한다.
050의 tool 분류 표(Runway/Higgsfield 파생 계열)와 우선순위 판단, 소스 근거는 유지한다.
충돌 시 **051 우선**, 미언급은 050 유효. 근거 인벤토리는 001, 실행 순서는 060 소유.

## 결정 1 — 라우터 기반 재확인 (050 결정 유지, 근거 갱신)

`lib/mcp/mediaWorkflowRouter.ts:27-35`에 `video.upscale`/`image.upscale`/`video.edit` →
runway 매핑이 이미 있다(`lib/mcp/adapters/runway.ts:200-214` 포함). wp5a/b는 이 라우터와
adapter의 계약을 확장한다. 병렬 라우터 신설 금지(050과 동일, 001 D3로 재확인).

## 결정 2 — long-job 강화 파이프라인 탑승 + preview lineage 확장

파생 작업(edit/upscale)은 전부 long-job이므로 486dd25/8d7cccf의 download retry·poll·recover에
탑승한다(001 D3). edit_video의 2단 워크플로(keyframe preview → 승인 → 본편)는 새 계약이
필요하므로 lineage를 확장한다:

- preview artifact는 lineage에 `previewOf: <jobId>`, `approvalStatus: pending|approved|rejected`로 기록.
- rejected preview는 보존하되 결과 갤러리에는 올리지 않는다(감사용).
- recover는 preview 단계에서도 동일하게 동작해야 한다 — Accept에 계약 테스트로 고정.

## 결정 3 — UI: ResultActions + stage 호환

파생 액션 버튼은 `ui/src/components/ResultActions.tsx`에 부착한다(001 D5).
`377e0f8` 이후 결과 카드는 image stage/filmstrip 컨텍스트에서 렌더되므로, 액션은
stage 선택 상태(currentImage)와 호환돼야 하고 새 chrome grammar를 따른다.
edit_video의 keyframe 프리뷰 승인 단계는 기존 결과 카드 승인 흐름과 같은 표면을 쓴다.

## 결정 4 — multishot: 결정점만 고정

`generate_multishot_video`의 storyboard→shots[] 매핑은 node-studio의 branch/element tray
(`181426f`, 001 D2)와 결합할지, 독립 storyboard 표면으로 갈지 wp5a의 P에서 결정한다.
이 문서는 결정을 미루는 것 자체가 내용이다 — 구현 사이클에서 임의로 정하지 않는다.

## 결정 5 — wp5c(Higgsfield): lock 표면화는 capabilities contract로

결제 게이트 유지(050). recover-guard `4914ac5`가 catalog-only provider를 409
`MCP_EXECUTION_LOCKED`로 닫으므로, wp5c UI는 이 신호와 capabilities contract를 읽어
lock 상태를 표면화한다. 결제 여부를 ad-hoc으로 추정하는 체크는 두지 않는다.

## Accept (wp5 구현 사이클들) — 050 Accept를 이것으로 치환

각 서브 phase(wp5a/b/c)가 자체 PABCD로 돌되, 공통 게이트는:

1. mediaWorkflowRouter 확장분의 계약 테스트(플랜 구성, 무과금).
2. edit_video preview 승인/거부/재시도 각 경로의 lineage 계약 테스트
   (`approvalStatus` 전이 activation 포함).
3. preview 단계 recover 계약 테스트.
4. ResultActions 액션이 stage 컨텍스트에서 currentImage와 호환됨을 보이는 UI 계약 테스트.
5. 실행 1건(Runway, 사용자 승인 시) + devlog 증거.
6. wp5c는 결제 확인 전까지 착수하지 않는다 — lock 표면화만 허용.
