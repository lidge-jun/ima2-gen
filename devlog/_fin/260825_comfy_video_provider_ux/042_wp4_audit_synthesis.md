---
created: 2026-08-25
tags: [ima2-gen, devlog, phase4, audit, synthesis]
---

# 042 — wp4 A: 최종 diff 감사

## 리뷰어 은퇴 (DISPATCH-RETIRE-01)

독립 리뷰어(anthropic/claude-fable-5)를 9-commit diff 리뷰로 파견했으나 약 20분,
wait 사이클 15회 동안 아무것도 반환하지 않았다. DISPATCH-RETIRE-01에 따라 은퇴시키고
main이 직접 감사한다. 침묵한 파견은 재시도를 소진한다.

이전 세 라운드(wp0/wp1 6+8건, wp2 8건, wp3 5건)는 정상 반환했으므로 감사 자체는
이 유닛 전반에 걸쳐 실질적으로 수행됐다.

## main 직접 감사

### 1. comfy 이미지 경로 회귀 — 없음

    git diff origin/dev..HEAD -- lib/comfyImageAdapter.ts | grep collectImages
    -      const images = collectImages(entry, workflow.bind.output.node);
    +        : collectImages(entry, workflow.bind.output.node);

`collectImages` 함수 본문은 **한 글자도 바뀌지 않았다.** 호출 지점만 삼항의 else
가지로 옮겼다. video 전용 분기는 전부 `mediaKind === "video"` 게이트 뒤에 있다
(:519, :524). 이미지 경로는 이전과 동일한 코드를 실행한다.

### 2. 202 이후 throw 시 finishJob — 정상

comfy 분기(:417)는 handler의 `try` 블록 **안**에 있고, 그 `finally`(:554)가
`if (jobOwned) finishJob(...)`을 호출한다. `dualEmitVideo(res, requestId, "error", ...)`도
같은 catch에서 나간다. 별도 핸들러로 뺐다면 둘 다 없었을 것이다 — 감사 라운드 2의
B2가 정확히 이 지점을 지적했고, 그 수정이 지금 검증된다.

### 3. comfy를 안 쓰는 사용자 영향 — 없음

    routes/video.ts:189  const isComfy = provider === "comfy";

모든 신규 분기가 `isComfy` 게이트 뒤에 있다. grok 요청은 :190의 조건을 그대로 통과해
이전과 같은 경로를 탄다. store의 `comfyVideoWorkflow`는 초기값 null이고
`videoLaneFields`는 comfy가 아니면 기존 grok 캐스팅과 동일한 값을 낸다.

### 4. TTL 캐시의 모듈 수준 가변 상태 — 수용 가능, 시드 있음

`laneSummaryCache`는 모듈 스코프다. 테스트 오염 위험이 있어 `_resetLaneSummaryCache`
테스트 시드를 함께 export했다 (routes/models.ts:553). 5초 TTL이므로 자격증명 변경
직후 최대 5초 stale하다 — 사람이 키를 넣고 새로고침하는 시간 규모에서 무시 가능하고,
대안(매 요청 원격 프로브)은 UI 폴링과 결합해 훨씬 나쁘다.

멀티테넌트 위험은 이 제품에 해당하지 않는다: 사용자 자신의 머신에서 도는 단일
사용자 로컬 서버다.

### 5. 신규 테스트가 실제로 무엇을 검증하는가

- history race 테스트는 `historyCalls >= 3`을 단언한다 — 첫 시도 성공이 재시도로
  위장할 수 없다. 실행 로그가 `attempt=1, attempt=2`를 실제로 찍었다.
- 정지 프레임 테스트는 PreviewImage를 실제 output에 **나란히** 놓는다. 폴백이
  느슨하면 PNG를 집어 실패한다.
- binding/param 테스트는 양방향이다: 요청값 우선, 그리고 바인딩이 침묵할 때 param 보존.
- capabilities 계약은 쌍조건을 고정한다.

통과하면서 기능이 깨져 있을 수 있는 테스트는 발견하지 못했다.

### 6. 커밋 위생

9개 커밋 모두 "무엇을, 왜"를 적었고 과장하지 않는다. wp1 커밋은 라이브 GPU 실행을
주장하지 않고, wp3 커밋은 파생 목록이 오늘은 동일하다고 명시한다.

## 판정

차단 사항 없음. main 판정: **pass**. 은퇴한 리뷰어의 부재는 이전 세 라운드의 실질
감사와 이 직접 감사로 보완된다.
