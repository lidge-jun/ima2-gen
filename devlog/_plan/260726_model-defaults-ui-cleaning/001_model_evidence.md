# 모델 근거와 드리프트 인벤토리

## 공식 근거

확인일은 2026-07-26이다.

- xAI model detail: <https://docs.x.ai/developers/models/grok-4.5>
  - model name `grok-4.5`
  - aliases `grok-4.5-latest`, `grok-build-latest`
- xAI Grok 4.5 API guide: <https://docs.x.ai/developers/grok-4-5>
  - Responses API와 Chat Completions에서 `grok-4.5` 사용
  - text+image input, configurable reasoning
- xAI release notes: <https://docs.x.ai/developers/release-notes>
  - 2026-07-08 API 출시 기록
- xAI models API: <https://docs.x.ai/developers/rest-api-reference/inference/models>
  - `/v1/models`, `/v1/language-models`가 모델 ID·aliases의 인증 키별 SoT
- OpenAI GPT-5.6 Luna model: <https://developers.openai.com/api/docs/models/gpt-5.6-luna>
  - model ID `gpt-5.6-luna`
  - Responses API `image_generation` tool 지원
- OpenAI model guidance: <https://developers.openai.com/api/docs/guides/latest-model>
  - Luna는 efficient/high-volume workload용 GPT-5.6 tier

정책: 기본값은 사용자가 요청한 고정 stable ID `grok-4.5`로 둔다. `-latest`
alias는 upstream 자동 이동이 필요한 사용자가 명시 선택할 때만 문서에서 설명한다.

## 로컬 근거

| 상태 | 위치 | 판정 |
|---|---|---|
| GPT 이미지 fallback Luna | `./config.ts:271-287`, `lib/imageModels.ts:3-5` | current |
| 생성 config JS의 이미지/API Luna | `./config.js:167-174` | current, fresh tsc와 byte-identical |
| Grok planner 4.3 | `./config.ts:296-303` | stale default |
| 이미지 fallback 4.3 | `lib/grokImageCore.ts:93-98` | stale local fallback |
| 비디오 fallback 4.3 | `lib/grokVideoAdapter.ts:105-114`, `lib/grokVideoAdapter.ts:204-206` | stale local fallback |
| Agent planner 4.3 | `lib/agentImageVideoGen.ts:34` | stale local constant |
| 분석 route 4.3 | `routes/videoExtended.ts:458-475` | stale literal |
| 설정 options 4.3 first | `routes/capabilities.ts:5-28` | missing 4.5 |
| Agent UI 4.3 only | `ui/src/lib/agentModelOptions.ts:17` | missing 4.5 |
| Prompt Builder default 5.5 | `ui/src/store/promptBuilderStore.ts:75-80` | stale UX default |

## 호환 경계

- `grok-4.3`은 삭제하지 않는다. 사용자 저장 설정과 explicit override 테스트를 유지한다.
- `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`도 valid set에 남긴다.
- `grok-imagine-image-quality`와 `grok-imagine-video-1.5`는 생성 모델이다.
  `grok-4.5`는 검색·planning·analysis 모델이므로 서로 바꾸지 않는다.
- live `/v1/models` 호출은 API key와 비용/권한이 필요할 수 있어 이번 범위에서 하지 않는다.
  공식 문서와 mock contract로 검증한다.
