# WP1 - 모델 기본값 계약 통합

## stale check

WP1 P에서 아래 path와 symbol을 다시 읽고 line drift를 이 문서에 반영한다.

## 변경 지도

### `lib/imageModels.ts` - MODIFY

- NEW export `DEFAULT_GROK_PLANNER_MODEL = "grok-4.5"`.
- NEW export `GROK_PLANNER_MODELS`를 최신 우선 순서로 둔다:
  `grok-4.5`, `grok-4.3`, `gpt-5.6-luna`, `gpt-5.6-terra`,
  `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`.
- 기존 image/video model set과 normalize 동작은 유지한다.

### `config.ts` - MODIFY

- import the central planner default.
- `styleSheet.model`: `gpt-5.4-mini` -> `gpt-5.6-luna`.
- `grokProvider.plannerModel`: `grok-4.3` -> central `grok-4.5`.
- `cardNewsPlanner.model`: `gpt-5.4-mini` -> `gpt-5.6-luna`.
- `imageModels.default`, `apiProvider.defaultImageModel`의 Luna는 유지한다.

### Grok 실행 소유 파일 - MODIFY

- `lib/grokImageCore.ts`: local planner fallback을 central default로 교체.
- `lib/grokImageAdapter.ts`: planner/search payload의 default parameter를 central default로 교체.
- `lib/grokVideoAdapter.ts`: config와 payload fallback을 central default로 교체.
- `lib/agentImageVideoGen.ts`: default constant는 central default를 쓰고,
  planner 판별은 `Set(["grok-4.5", "grok-4.3"])`로 만들어 저장된 4.3 Agent
  설정도 이미지 모델로 잘못 전달하지 않게 한다.
- `routes/videoExtended.ts`: first/last analysis에서
  `ctx.config.grokProvider.plannerModel`을 한 번 읽고 request와 response metadata에
  같은 실제 모델을 쓴다. config가 비어 있을 때만 central default를 쓴다.
- `routes/capabilities.ts`: local array를 central options export로 교체.
- `routes/models.ts`: Grok video lane의 `defaults.video`를 hardcoded
  `grok-imagine-video`가 아니라 `config.grokProvider.defaultVideoModel`로 투영해
  실제 기본 `grok-imagine-video-1.5`와 맞춘다.
- `lib/agentPlannerModel.ts`: 설명 예시를 `grok-4.5`로 갱신.

### CLI·integration - MODIFY

- `bin/commands/video.ts`: help 예시를 `grok-4.5`로 갱신.
- `integrations/comfyui/ima2_gen_bridge/nodes.py`: GPT-5.6 Luna/Terra/Sol을
  최신 우선 선택지로 추가하되 빈 값의 server-default 의미는 유지.

### generated artifacts - MODIFY by repo build

- `npm run build:server`: `config.js`, `lib/*.js`, `routes/*.js`.
- `npm run build:cli`: `bin/**/*.js`.
- 생성 결과 외 unrelated JS drift는 커밋하지 않는다.

## 테스트

- MODIFY `tests/config.test.js`: no-env style/image/api/Grok/card planner defaults.
- MODIFY `tests/image-model.test.ts`: Luna default 유지.
- MODIFY `tests/grok-planner-adapter.test.ts`: default call은 4.5, explicit 4.3은 4.3.
- MODIFY `tests/grokVideoAdapter.test.ts`: default와 override를 분리.
- MODIFY `tests/videoExtendedRoute.test.ts`: analysis response 4.5.
- MODIFY `tests/models-endpoint-contract.test.ts`: /api/models video default가
  runtime config의 1.5를 반영하고 override도 투영되는지 확인.
- NEW 또는 MODIFY model rollout contract: central options가 4.5 first, 4.3 포함.
- 기존 explicit 4.3 fixtures는 override 의미가 명확하면 유지한다.

## C activation scenarios

- config 미지정 -> planner payload model이 `grok-4.5`.
- explicit `plannerModel: "grok-4.3"` -> payload가 그대로 4.3.
- Agent session model이 4.5 또는 4.3 -> 둘 다 planner route로 분기하고 final
  `/v1/images/generations` body의 image model 자리에는 들어가지 않는다.
- env/file config에서 4.3 -> route GET이 4.3을 보고하고 PATCH options가 수용.
- video analysis config가 4.3 -> upstream request와 response `model`이 둘 다 4.3.
- OpenAI image model 미지정 -> `gpt-5.6-luna`.
- `/api/models` Grok lane -> `defaults.video === config.grokProvider.defaultVideoModel`.

## 검증

```bash
npm run build:server
npm run build:cli
npm run typecheck
npm run typecheck:tests
node --import tsx --test tests/config.test.js tests/image-model.test.ts tests/grok-planner-adapter.test.ts tests/grokVideoAdapter.test.ts tests/videoExtendedRoute.test.ts
node --import tsx --test tests/models-endpoint-contract.test.ts tests/agent-mode-runtime-contract.test.ts tests/agent-mode-right-sidebar-contract.test.js tests/model-default-projection-contract.test.ts
```
