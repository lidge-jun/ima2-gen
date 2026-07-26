---
title: "020 — WP2 실행 기록: 모델 UX·문서 동기화"
lane: "260726_model-defaults-ui-cleaning"
wp: 2
record: D
completed: 2026-07-26
commits: [03d7d51]
---

# WP2 실행 기록

모델 선택 UI와 공개 문서를 WP1 런타임 계약에 맞췄다. 최신 모델은 기본값과
첫 선택지로 보이고, 이전 모델은 호환 선택지로 남는다.

## 결과

- Agent model menu는 `Grok 4.5`를 4.3 앞에 두고, 공용 OpenAI 목록은
  Luna/Terra/Sol 순으로 정렬한다.
- Prompt Builder store와 backend schema는 `gpt-5.6-luna` 기본값을 공유한다.
- 설정·composer reset·i18n·README/docs/site/structure 문서가 같은 모델명을
  쓴다.
- 역사 계획 문서는 당시 snapshot 표지만 붙여 현재 기본값 문서와 혼동하지 않게 했다.

## 검증 영수증

```text
node --import tsx --test tests/gpt56-rollout-contract.test.ts tests/agent-mode-right-sidebar-contract.test.js tests/grok-planner-config-route.test.ts tests/prompt-builder-contract.test.ts tests/model-default-projection-contract.test.ts
npm --prefix site run check
npm --prefix site run build
npm run docs:refresh-line-counts
```
