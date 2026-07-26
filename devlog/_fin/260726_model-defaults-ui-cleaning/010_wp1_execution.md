---
title: "010 — WP1 실행 기록: 모델 기본값 계약"
lane: "260726_model-defaults-ui-cleaning"
wp: 1
record: D
completed: 2026-07-26
commits: [9aa84f2]
---

# WP1 실행 기록

Grok planner 기본값을 `grok-4.5`, OpenAI 계열 기본값을 `gpt-5.6-luna`로
중앙 설정과 실행 경로에 맞췄다. 저장된 `grok-4.3` 설정은 삭제하지 않고
compatibility override로 유지한다.

## 결과

- `DEFAULT_GROK_PLANNER_MODEL`와 `GROK_PLANNER_MODELS`를 `config.ts`에 뒀다.
- image/video adapter, Agent, capabilities, `/api/models`, video analysis가 같은
  중앙 계약을 읽는다.
- Agent의 4.5와 4.3 session model은 planner route로만 쓰이고 final image
  generation body의 image model 자리로 새지 않는다.
- `build:server`와 `build:cli`로 생성 JS와 CLI shebang 산출물을 갱신했다.

## 검증 영수증

```text
npm run build:server
npm run build:cli
node --import tsx --test tests/config.test.js tests/image-model.test.ts tests/grok-planner-adapter.test.ts tests/grokVideoAdapter.test.ts tests/videoExtendedRoute.test.ts
node --import tsx --test tests/models-endpoint-contract.test.ts tests/agent-mode-runtime-contract.test.ts tests/agent-mode-right-sidebar-contract.test.js tests/model-default-projection-contract.test.ts
```
