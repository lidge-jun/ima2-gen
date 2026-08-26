---
created: 2026-08-25
tags: [ima2-gen, devlog, phase2, stale-check, design-read]
---

# 021 — wp2 P: stale check + Design Read 확정

## 020 대조 결과

| 020의 주장 | 현재 트리 | 판정 |
|---|---|---|
| CORE_PROVIDER_OPTIONS 하드코딩 (10개) | :26-37에 그대로 | 유효 |
| core lane 상태 미표시 | providerGroups 첫 그룹에 sub 없음 | 유효 |
| providerSupportsVideo 하드코딩 | :283 `provider === "grok" || "grok-api"` | 유효 |
| lane 12개 | 실측 12개 | 유효 |

wp1이 comfy video를 실행 가능하게 만들었으므로, :283의 하드코딩은 이제 **실제로
틀린 값**을 낸다: comfy lane은 video 카탈로그를 갖는데 false를 반환한다. wp1이
comfy 전용 video 그룹을 따로 렌더해 가려놨을 뿐이다. wp2에서 카탈로그 유도로
바꾸면 그 특수 분기의 존재 이유도 함께 사라진다.

## 라이브 lane 상태 실측 (2026-08-25, 새 빌드 3399)

    oauth        ready         img=6  vid=0
    api          key-missing   img=6  vid=0   OpenAI API key missing
    grok         ready         img=3  vid=2
    grok-api     key-missing   img=3  vid=2   xAI API key missing
    agy          ready         img=2  vid=0   binary installed; login cannot be probed
    gemini-api   ready         img=2  vid=0
    atlascloud   key-missing   img=2  vid=0   Atlas Cloud API key missing
    minimax      key-missing   img=2  vid=0   MiniMax API key missing
    nai          ready         img=4  vid=0
    comfy        disconnected  img=0  vid=1   No ComfyUI instance responded
    runway       disconnected  img=3  vid=6   MCP_CREDENTIAL_BINDING_MISMATCH
    higgsfield   disconnected  img=0  vid=0   MCP_CREDENTIAL_BINDING_MISMATCH

이게 문제의 실체다. 12개 lane 중 5개가 키 없음, 3개가 연결 끊김인데 **UI는 이
구분을 전혀 보여주지 않는다.** 사용자는 이유를 모른 채 실패하는 lane을 고른다.

또 하나 중요한 사실: 서버는 이미 lane별 `status`와 사람이 읽을 수 있는 `reason`을
모두 내려주고 있다. 없는 정보를 만들어내는 작업이 아니라, 이미 있는 정보를 UI가
버리고 있는 것을 멈추는 작업이다.

## Design Read (020에서 확정, 변경 없음)

    DESIGN_VARIANCE: 2
    MOTION_INTENSITY: 1
    Product density profile: D5

UX-CONCEPT-GEN-01 스킵 사유: 기존 디자인 시스템이 표면을 지배하고 이 작업은
유틸리티 컨트롤 개선이다. 이미지 컨셉 생성은 이 판단에 아무 정보도 더하지 않는다.

## UX-LAZY-01 적용

상태 배지를 추가하는 것은 결정을 늘리는 게 아니라 **줄인다**: 지금은 사용자가
lane을 고르고, 실패하고, 왜인지 추측해야 한다. 배지는 그 왕복을 없앤다.

다만 ready lane에는 배지를 붙이지 않는다. 정상 상태에 라벨을 다는 것은 소음이고,
D5 밀도 프로필에서 스캔을 방해한다. 예외 상태만 말한다.

## 범위 조정 (P-phase amendment)

020은 `api-models.ts`와 `useModelCatalog.ts` 신설을 제안했다. 실측 결과
`ui/src/lib/api-comfy.ts`의 `getComfyLaneModels`가 이미 `/api/models`를 읽고 comfy
lane만 뽑아 쓴다. 새 파일을 만드는 대신 그 옆에 lane 전체를 읽는 함수를 두는 것이
기존 패턴과 일관된다. 파일 수를 늘리지 않는다.
