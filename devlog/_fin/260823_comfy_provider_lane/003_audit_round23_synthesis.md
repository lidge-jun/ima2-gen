---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, audit]
---

# 003 — A-phase 감사 라운드 2·3: 종합과 처분

같은 리뷰어(xai/grok-4.6)에게 컨텍스트를 유지한 채 재감사를 맡겼다
(AUDIT-LOOP-01: FAIL은 A를 벗어나지 못하고, 동일 리뷰어를 재사용한다).

| 라운드 | 판정 | 차단 |
|---|---|---|
| 1 | FAIL | High 7, Med 4, Low 2 |
| 2 | FAIL | High 2 (#1 어댑터 픽스처, #2 probe 라우트 소유자) |
| 3 | **GO-WITH-FIXES (blockers=3)** | Critical/High **0**, Med 3, Low 2 |

누적 22건 지적, **반박 0건**. 전부 코드로 재확인했고 전부 타당했다.

## 라운드 2가 잡아낸 것 — "고쳤다"와 "고칠 수 있다"의 차이

라운드 1의 #4를 나는 이렇게 처분했다: "comfy의 validateAuth 2상태를
워크플로 개수로 만든다. 스토어가 갱신하는 **캐시된 개수**를 읽는다."

리뷰어가 실제 테스트 파일을 읽고 이걸 반박했다:

    function contextWith(key: string | undefined): RuntimeContext {
      return { minimaxApiKey: key, atlasCloudApiKey: key } as unknown as RuntimeContext;
    }
    const withKey = contextWith("test-key");
    const withoutKey = contextWith(undefined);

픽스처가 바꾸는 건 **컨텍스트뿐**이다. 프로세스 전역 캐시는 같은 테스트의
두 호출 사이에서 ≥1이면서 동시에 0일 수 없다. 즉 내 지시는 **타이핑해도
초록이 되지 않는** 코드였다.

이건 계획서의 전형적 실패 양식이다. 산문으로는 문제를 해결했는데
**실행 가능한 지시가 아니었다.** DIFFLEVEL-ROADMAP-01이 "복붙 실행 가능한
PRD"를 요구하는 이유가 정확히 이것이다.

처분: 캐시 문장을 지우고 `RuntimeContext.comfyWorkflows`로 바꿨다.
`validateAuth`와 `listModels`가 **둘 다 동기**이고 스토어는 비동기라는
제약, 그리고 픽스처가 ctx로만 주입한다는 사실이 이 설계를 강제한다.
다른 어댑터가 ctx에서 키를 읽는 것과 같은 형태다.

라운드 3에서 리뷰어가 이 수정을 검증했다: `RuntimeContext`는 인터페이스라
선택 필드 추가가 가산적이고, `requireRuntimeContext`는 여분 키를 지우지
않으며, `createTestRuntimeContext`는 이미 오버라이드를 받는다. **작성
가능하고 초록이 된다.**

## 라운드 2 #2 — 클라이언트 계약에 서버 소유자가 없었다

050이 `POST /api/comfy/probe`를 부르는데 030의 라우트 표에 그게 없었다.
구현자는 목록에 없는 라우트를 만들어야 했다. 추가하면서 실패 형태를 둘로
나눴다 — 형식 오류 400, 도달 불가 200 ok:false. 합치면 포트를 빠뜨린
사용자에게 "ComfyUI를 켜세요"라고 말하게 된다.

## 라운드 3이 남긴 것 (전부 문서 동기화)

| # | 지적 | 처분 |
|---|---|---|
| 1 | 020이 여전히 캐시를 설명 — 010과 모순 | 020을 ctx 방식 코드로 교체 |
| 2 | `comfyWorkflows` 하이드레이션 소유자 없음 | server.ts 부팅 + routes/comfy.ts 쓰기 후, 표로 명시 |
| 3 | "5개 라우트" vs 실제 6+1 | 정정 |
| 4 | 010 변경 지도에 runtimeContext/doctor/adapter 테스트 누락 | 5행 추가 |
| 5 | node 에러 봉투가 실제 중첩 형태와 다름, FIXTURE 미정의, stale 문단 | 전부 수정 |

#1은 라운드 2 수정의 잔재였다. 010을 고치면서 020의 같은 내용을 안 고쳤다 —
문서가 10개가 되면 한 결정을 두 곳에 써두는 순간 드리프트가 시작된다.

#2가 실질적으로 가장 위험했다. ctx 필드를 정의하고 테스트도 통과하는데
**프로덕션에서 아무도 채우지 않으면** 배열이 영원히 비어 있다. 어댑터는
항상 "워크플로 없음"을 보고하고, 테스트만 초록인 상태가 된다.
LOOP-MECHANISM-PROOF-01이 말하는 "활성화되지 않는 분기"의 전형이다.

## 리뷰어와 갈린 판단

없다. 22건 전부 수용했다.

다만 라운드 1 #10에서는 리뷰어 제안보다 **넓게** 갔다. 리뷰어는
"범위 밖으로 문서화하거나 분기를 복사하거나" 둘 중 하나를 제시했는데,
나는 문서화 + **명시적 400 거부**까지를 범위로 잡았다. 근거는 라운드 2에서
리뷰어 자신이 확인해줬다: 가드가 없으면 세 파이프라인이
`generateViaResponses`로 떨어져 **OAuth에 과금된다.**

## 070의 처지 — 규칙 미충족을 라벨함

070은 diff-level이 아니다. 대상 코드가 wp1~wp6에서 이동하기 때문이다.
리뷰어 판정: "면제가 아니라 라벨된 위반이며, 가짜 before/after보다는
정직한 대안"이되 "이번 A-gate의 phase로 취급하면 안 된다."

수용해서 000의 work-phase 표에 wp7을 **"이번 머지 범위 밖, 060 이후로
이연"**으로 명시했다. 이번 유닛의 머지 경계는 wp6이다.

## 판정

라운드 3 최종: **GO-WITH-FIXES (blockers=3)**, Critical/High 0.
Medium 3건 + Low 2건을 전부 반영했으므로 near-pass로 A>B를 진행한다.

잔여 리스크는 실행 시점의 것이다: 다중 인스턴스 시나리오가 2차 근거로
남아 있고(001), TTL 상호작용은 wp3에서 실측한다.
