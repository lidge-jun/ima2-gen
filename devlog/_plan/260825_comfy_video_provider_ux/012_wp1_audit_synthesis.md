---
created: 2026-08-25
tags: [ima2-gen, devlog, phase1, audit, synthesis]
---

# 012 — wp1 A: 감사 합성

리뷰어: 독립 explorer (anthropic/claude-fable-5), 약 18분 심층 감사.
판정 `VERDICT: GO-WITH-FIXES (blockers=8)`. 이전 라운드의 6개 블로커는 제외하고
새로운 것만 보고했다.

main이 8개 전부를 실제 소스로 재검증했다. **7개 ACCEPT, 1개 부분 REBUT.**

## B1 [High] UI 선택 체인이 세 곳에서 끊긴다 — ACCEPT (가장 중요)

재확인:

- storeSettingsImpl.ts:493-499 `selectVideoModelImpl`이
  `normalizeVideoModelValue(model) || GROK_VIDEO_MODEL_15`로 강제한다.
- imageModels.ts:146-148 `normalizeVideoModelValue`는 grok 3종이 아니면 false.
  → comfy workflow id는 `grok-imagine-video-1.5`로 **치환**된다.
- 이어 :498이 `provider !== grok` 이면 `setProvider("grok")`로 lane까지 되돌린다.
- storeSettingsImpl.ts:362-364 `setProviderImpl`의 `supportsVideo`가 grok 전용이라
  comfy lane 진입 시 `videoModelSelected`를 지운다.

즉 010 §6만 고치면 클릭은 값을 grok으로 바꾸고 lane까지 grok으로 되돌린다. §7의
`resolveVideoProvider`는 도달 불가능한 죽은 코드가 된다. 계획의 c-3이 구조적으로
증명 불가였다.

수정: storeSettingsImpl.ts의 selectVideoModelImpl/setProviderImpl을 scope에 넣고,
comfy workflow id의 저장 방식을 명시한다. 결정: **별도 필드 `comfyVideoWorkflow`**를
둔다. `videoModelSelected`의 grok 리터럴 유니온을 넓히면 normalizeVideoModelValue를
쓰는 모든 소비자(agent-mode 계약 테스트 포함)의 의미가 흔들린다. 별도 필드가
기존 grok 계약을 건드리지 않는 최소 변경이다.

## B2 [High] route 분기 위치가 admission/cancel/finish 앞이다 — ACCEPT

재확인: routes/video.ts의 handler는 하나의 큰 클로저이고 `startJob`은 :367,
`registerJobAbortController`는 :386, 202 응답은 :387, `finishJob`은 finally(:554)다.
010 §4처럼 :188에서 별도 함수로 빠지면 inflight 등록도, abort controller도,
terminal finishJob도 없이 돈다. UI 취소(`abortJob`)가 어댑터의 `options.signal`에
도달하지 못한다 — 어댑터의 취소 규율 전체가 그 signal에 걸려 있다.

수정: 분기는 **클로저 안에 남는다**. grok 전용 정규화(normalizeGrokVideoModel :226 등)
만 건너뛰고, admission(startJob) 이후에 comfy 실행으로 갈라진다. 분기점은 :226보다
앞이되 실행은 :367 이후여야 한다. cancelController.signal 전달과 onQueue → SSE
progress 매핑을 명시적 요구사항으로 적는다.

## B3 [High] history 키 순서 — 부분 REBUT + 부분 ACCEPT

리뷰어 주장: 현행 core `SaveVideo`는 `videos` 키로 직렬화하므로 계획의 `images`
주장이 틀렸다.

**main 재검증 (Tier 2, 직접 원문 fetch):**

    nodes_video.py:202  SaveVideo → return io.NodeOutput(video, ui=ui.PreviewVideo([...]))
    nodes_video.py:73   SaveWEBM  → return io.NodeOutput(images, ui=ui.PreviewVideo([...]))
    _ui.py:432-437      class PreviewVideo → as_dict(): {"images": self.values, "animated": (True,)}
    _ui.py 전체에 "videos" 키 정의 없음 (SavedImages=images, SavedAudios=audio)

→ core `SaveVideo`는 `PreviewVideo`를 반환하고 그 직렬화는 `images`다. 리뷰어의
핵심 주장은 **기각한다**. docs.comfy.org의 서술적 표현을 소스보다 우선한 것으로 보인다.

**그러나 하위 발견은 ACCEPT하며 이게 더 중요하다:** `collectImages`의 any-node
폴백(:241-243)이 모든 노드를 훑기 때문에, 그래프에 PreviewImage/SaveImage가 하나라도
있으면 **PNG 서술자가 먼저 잡히고** video 검증에서 죽는다. 이건 키 순서와 무관하게
실재하는 버그다.

수정: video kind의 수집은 (1) 바인딩된 output 노드를 **먼저**, (2) 그 노드에서
`images`/`gifs`/`videos` 순으로 본 뒤, (3) any-node 폴백에서는 `animated` 플래그가
있거나 `gifs`/`videos` 키인 항목만 받아들인다. 미래 호환을 위해 `videos` 키도 계속
읽되, core 계약은 `images`+`animated`임을 주석에 명시한다.

## B4 [Medium] WebM 수용 vs .mp4 하드코딩 체인 — ACCEPT

재확인: routes/video.ts:462가 `${Date.now()}_${rand}.mp4`로 파일명을 만들고,
videoContinuity.ts:48이 `.mp4`가 아니면 400을 던진다. webm을 .mp4로 저장하면
모든 하위 소비자에게 컨테이너를 거짓 신고하는 셈이다.

결정: **wp1은 MP4만 수용한다.** webm은 명시적 에러로 거절한다. 확장자 유도 체인
전체 감사는 이 work-phase의 범위를 넘고, 거짓 신고보다 정직한 거절이 낫다.
010의 매직바이트 표에서 WebM/EBML은 "검출하되 거절"로 바꾼다.

## B5 [Medium] binding 우선순위가 param 값을 삼킨다 — ACCEPT

재확인: comfyGraphBind.ts:197-198 `assign`은 `value === undefined`면 조용히 return한다.
바인딩 대상 입력을 **무조건** params 적용에서 빼면, 요청에 length가 없고 저장된
param에는 length가 있는 경우 튜닝값을 잃고 그래프 기본값으로 떨어진다. 이미지
workflow에도 같은 회귀가 난다.

수정: 배제 조건을 "바인딩이 **실제로 정의된 값을 받은** 입력"으로 좁힌다.
binding-present / value-absent / param-present 케이스의 테스트를 추가한다.

## B6 [Medium] 010과 011의 race 처리 방식이 상충 — ACCEPT

010 §3은 missing 3→6 상향, 011은 그걸 기각하고 별도 분기를 처방한다. 둘 다 B의
입력이라 모순이다. 또한 그 분기는 현재 이미지 경로 계약(:405-406 즉시 NO_IMAGE)을
바꾸므로 반드시 video 한정이어야 한다.

수정: 010 §3을 011의 메커니즘으로 교체하고 `kind === "video"` 한정을 명시한다.

## B7 [Medium] c-3/c-4가 H3를 지목하는데 origin이 죽어 있다 — ACCEPT

재확인: liveness는 `probeComfyOrigins`의 `/system_stats`만으로 결정되고(:190),
workflow 등록은 살아있는 origin을 요구하지 않는다(routes/comfy.ts:148-186). 따라서
stub origin 전략은 성립한다. 그러나 H3 레코드의 origin이 죽어 있는 한 H3는
`(offline)` 접미와 함께 disabled로 남는다 — lock을 걷어도 그렇다.

수정: c-3의 증명 대상을 stub 등록 workflow로 바꾸고, H3에 대해서는 **"lock-disabled가
아니라 offline-disabled"** 를 별도로 증명한다. 이 구분이 wp1이 실제로 바꾸는 계약이다.
이건 기준을 낮추는 게 아니라 정확히 하는 것이다 — 사용자의 GPU 박스를 켜는 건 이
루프의 권한 밖이다.

## B8 [Low] "not supported yet" 산문이 설정 화면과 i18n 4종에 남는다 — ACCEPT

재확인: ComfyWorkflowManager.tsx:280이 video workflow에 무조건
`t("comfy.videoCatalogOnly")`를 렌더하고, i18n 4개 파일 :2303이 실행 미지원을 말한다.
tests/comfy-ui-contract.test.ts:95가 그 사용을 고정한다 (다섯 번째 파손 지점).

수정: manager hunk와 i18n 키 4종을 010의 파일 맵에 추가한다.

## 리뷰어가 확인해준 사항

- collectImages/downloadImage 일반화에 공유 모듈 상태 없음 — 분리 안전.
- 취소는 loop/signal 배선에 있어 shared-core 분리 후에도 유지된다.
- 449줄 → comfyRunCore.ts 분리는 옳은 방향.
- providerOptions의 사유 교정(삭제 아닌 재문구)은 세 번째 lock의 올바른 처리.

## 판정

8개 중 7개 ACCEPT, 1개(B3 핵심 주장) 근거 있는 REBUT + 하위 발견 ACCEPT.
모든 High/Medium이 구체적 수정으로 접혔고 잔여 블로커 없음.
main 판정: **pass**.
