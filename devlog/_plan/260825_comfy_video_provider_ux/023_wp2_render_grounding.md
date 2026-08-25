---
created: 2026-08-25
tags: [ima2-gen, devlog, phase2, render-grounding, activation, evidence]
---

# 023 — wp2 C: 렌더 관측과 활성화 증거

## 활성화 증거 (C-ACTIVATION-GROUNDING-01)

배지가 하드코딩이 아니라 라이브 상태를 따른다는 증명. 같은 순간의 서버 응답과
렌더된 DOM을 나란히 놓는다.

    LIVE CATALOG            RENDERED OPTION
    oauth      ready        "GPT"
    api        key-missing  "GPT API   key missing"
    grok       ready        "Grok"
    grok-api   key-missing  "xAI API   key missing"
    agy        ready        "agy"
    gemini-api ready        "Gem API"
    atlascloud key-missing  "Atlas     key missing"
    minimax    key-missing  "MiniMax   key missing"
    nai        ready        "NovelAI"
    comfy      disconnected "ComfyUI   offline"

4개의 key-missing이 전부 배지를 얻었고, disconnected는 offline이 됐고, ready 5개는
전부 무표기다. 일대일 대응이 성립한다.

runway/higgsfield는 core 그룹에서 빠졌다 (B2 대응) — MCP 그룹이 이미 소유한다.

## 관측 불가로 남긴 조건 (정직한 기록)

- `locked` 배지: 현재 어떤 lane도 locked를 보고하지 않는다. 코드 경로는 존재하지만
  이 환경에서 발화시킬 수 없다. 관측했다고 적지 않는다.
- 미지 lane 폴백: 서버 lane 집합이 닫힌 유니온이라 라벨 없는 id를 낼 수 없다.
  구현은 되어 있고(disabled + 폴백 라벨) 타입이 그 도달을 막는다.

## 렌더 관측

데스크톱 1280x720, 모바일 390x844 모두에서:

- 배지가 우측 정렬로 라벨과 겹치지 않는다.
- 잘림 없음. 013이 겪은 300px 포털 문제가 재발하지 않았다.
- 닫힌 trigger는 `ComfyUI`만 표시한다 — `triggerSub=""`로 배지를 억제했다(B6).
  닫힌 컨트롤은 무엇을 골랐는지 말하는 자리이지 왜 안 되는지 말하는 자리가 아니다.

## Evidence

- `evidence/020_lane_state_badges.png` — 데스크톱 1280x720
- `evidence/021_lane_state_badges_mobile.png` — 모바일 390x844
