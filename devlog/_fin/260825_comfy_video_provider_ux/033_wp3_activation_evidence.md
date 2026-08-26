---
created: 2026-08-25
tags: [ima2-gen, devlog, phase3, activation, evidence]
---

# 033 — wp3 C: 활성화 증거 (두 lane 상태의 출력 diff)

c-5의 핵심 증거. 같은 명령이 lane 상태 변화를 실제로 반영하는지.

## STATE A — comfy origin 127.0.0.1:18188 down

    lanes:
      oauth        image=6 video=0
      api          key-missing — OpenAI API key missing, image=6 video=0
      grok         image=3 video=2
      grok-api     key-missing — xAI API key missing, image=3 video=2
      agy          image=2 video=0
      gemini-api   image=2 video=0
      atlascloud   key-missing — Atlas Cloud API key missing, image=2 video=0
      minimax      key-missing — MiniMax API key missing, image=2 video=0
      nai          image=4 video=0
      comfy        disconnected — No ComfyUI instance responded, image=0 video=1
      runway       disconnected — MCP_CREDENTIAL_BINDING_MISMATCH, image=3 video=6
      higgsfield   disconnected — MCP_CREDENTIAL_BINDING_MISMATCH, image=0 video=0

## STATE B — 같은 origin에 stub 기동 후

      comfy        image=0 video=1

다른 11개 행은 글자 그대로 동일하다. **comfy 한 줄만 바뀌었고**, 바뀐 것은 코드가
아니라 그 호스트의 도달 가능성뿐이다. 이것이 하드코딩 산문이 낼 수 없는 출력이다.

TTL 5초 후 재조회했다 — 캐시가 상태 변화를 가리지 않는다는 증거이기도 하다.

## 서버 부재 경로

    buildIma2Capabilities({source: "local"})  →  source= local, has lanes= false

lanes를 통째로 생략한다. 추측한 상태를 싣지 않는다. `source`가 판별자이므로
소비자는 "아무도 모른다"와 "lane이 없다"를 구분할 수 있다.

`tests/capabilities-lane-contract.test.ts`가 이 쌍조건을 고정한다 (3 케이스).

## 파생 목록의 실측 효과

    deriveVideoProviderIds()  →  [grok, grok-api, comfy]
    ima2 video --help         →  --provider <grok|grok-api|comfy|runway|higgsfield>

손으로 쓴 문자열과 **글자 그대로 같다**. 지금은 같지만 다음 video lane이 생기면
자동으로 합류한다 — wp1에서 내가 직접 comfy를 손으로 추가해야 했던 그 작업이 사라진다.

multimode의 모델 목록은 파생 후 **더 길어졌다**: image-01, image-01-live,
nai-diffusion-* 6종이 하드코딩 목록에서 빠져 있었다. 드리프트가 이미 발생해 있었고
아무도 몰랐다.

## 범위 밖으로 선언한 항목 (B4-3)

`docs/CLI.md:76,79,90`과 번역본 3종의 손수 관리 provider 목록은 이번 범위 밖이다.
생성 스크립트가 없어 번역까지 포함하면 별도 work-phase 크기다. 놓친 것이 아니라
남긴 것이며, wp4의 후속 항목으로 기록한다.
