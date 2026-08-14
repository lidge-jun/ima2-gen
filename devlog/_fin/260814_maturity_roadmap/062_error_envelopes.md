---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, errors, sse]
---

# 062 — 오류 전송 봉투

- work-phase: `060`을 분할한 두 번째 유닛
- 소비: `061`이 보존한 `rawCode`/`errorClass`
- 소비되는 곳: `063` UI 소비

`061`은 서버가 코드를 **들고 있게** 만들었다. 이 유닛은 그것을 **실어 나른다.**
UI는 건드리지 않는다.

## 봉투 목록과 현재 상태

`060`의 매트릭스를 전송 형태 기준으로 다시 센다. 감사가 Classic과 Node를
한 계열로 묶으면 안 된다고 지적했고(형태가 다르다), Video는 SSE와 JSON 두
경로를 가진다.

| # | 봉투 | 발행 지점 | 현재 형태 | 할 일 |
|---|---|---|---|---|
| 1 | Classic SSE | `lib/generatePipeline.ts:615` | 평면 `{error, code, ...진단}` | `upstreamErrorFields`에 두 필드 추가 |
| 2 | Node SSE | `lib/nodeHelpers.ts:53` | 중첩 `{error:{code,message}}` | 중첩 객체에 두 필드 추가 |
| 3 | Video SSE | `routes/video.ts:503`, `routes/videoExtended.ts:258`, `routes/videoExtended.ts:372` | 평면 `{error, code}` | 두 필드 추가. extend의 비동기 이벤트버스 페이로드 두 곳도 같은 계열이다 (구현 감사 blocker 3) |
| 4 | Video JSON | `routes/videoExtended.ts:83` | `sendError()`가 **코드를 버린다** | 코드부터 싣고 두 필드 추가 |
| 5 | Multimode 집계 | `lib/multimodePipeline.ts:461` | 전 항목 실패 시 `EMPTY_RESPONSE`. **항목 오류가 어댑터에서 이미 버려진다** | 어댑터가 오류를 반환 → 대표 코드 선택 → 두 필드 |
| 6 | MCP SSE | `routes/mcpMedia.ts:45` | `errorCode()`가 메시지 앞부분을 자른다 | `error.code` 우선, 메시지 파싱은 폴백 |
| 7 | Edit JSON | `routes/edit.ts:186` 외 | 각 분기가 `{error, code}` 직접 구성 | 공통 헬퍼로 두 필드 부착 |
| 8 | Agent queue | `lib/agentQueueWorker.ts:168` | `{code, message}`만 저장 | `errorClass` 동반 |

## 설계: 하나의 부착 함수

봉투마다 형태가 다르므로 **필드를 만드는 곳은 하나**로 두고 각 봉투가 자기
형태에 맞게 펼친다.

```ts
// lib/errors/envelope.ts
export function errorEnvelopeFields(err: unknown): { rawCode?: string; errorClass?: string }
```

`061`이 붙인 `rawCode`/`errorClass`가 있으면 그대로, 없으면 `providerErrorClass`로
한 번 더 시도한다. **둘 다 없으면 빈 객체**를 반환한다 — 앱 코드에 잘못된
클래스를 붙이지 않는다는 `061`의 규칙을 그대로 잇는다.

### `code` 의미는 여전히 바꾸지 않는다

`060` 감사가 남긴 미해결 질문이 여기 있었다: 402 카나리는 `code:
INVALID_REQUEST`로 나가고 그것은 UI에 등록된 코드라 클래스보다 먼저 이긴다.

**이 유닛에서는 답하지 않는다.** 봉투는 세 필드를 모두 실어 나르기만 하고,
우선순위 결정은 `063`이 `resolveErrorSpec`에서 내린다. 봉투 단계에서 `code`를
바꾸면 여덟 소비자가 동시에 흔들리고, 그것이 `060`이 실패한 이유다.

`063`이 쓸 수 있는 재료를 여기서 다 실어 보내는 것이 이 유닛의 계약이다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `lib/errors/envelope.ts` (신규) | `errorEnvelopeFields()` |
| `lib/routeHelpers.ts:31` `upstreamErrorFields` | 반환에 두 필드 병합. **Classic만** 자동으로 얻는다 (구현 감사 blocker 1 — Multimode는 이 헬퍼를 부르지 않고 `lib/multimodePipeline.ts:559`에서 세 필드를 손으로 복사한다) |
| `lib/multimodePipeline.ts:559` | 손으로 복사하는 필드 목록에 두 필드 추가 |
| `lib/grokMultimodeAdapter.ts:86` | **필수** — 항목 오류를 로그로만 남기고 버린다(`lib/grokMultimodeAdapter.ts:88`). 마지막 항목 오류를 결과에 실어 보내야 대표 코드를 고를 수 있다 |
| `lib/nodeHelpers.ts:53` | 중첩 `error` 객체에 두 필드 |
| `routes/video.ts:503`, `routes/videoExtended.ts:258`, `routes/videoExtended.ts:372` | 두 필드 |
| `routes/videoExtended.ts:83` `sendError` | `err.code`를 싣고 두 필드 |
| `lib/multimodePipeline.ts:461` | 전 항목 실패 시 대표 코드 선택 |
| `routes/mcpMedia.ts:45` `errorCode` | `error.code` 우선. `routes/mcpRecover.ts:28`, `routes/mcpMultishot.ts:102` 동일 |
| `routes/edit.ts` 오류 응답 | 두 필드 |
| `lib/db.ts:145` CREATE TABLE, `lib/db.ts:204` `addColumnIfMissing` | `agent_queue_items.error_class` nullable 컬럼 추가 (신규 DB와 기존 DB 양쪽) |
| `lib/agentQueueStore.ts:180` `failAgentQueueItem`, 두 SELECT 목록, `lib/agentQueueStore.ts:228`, `lib/agentQueueStore.ts:279` | `errorClass` 저장·읽기 |
| `lib/agentTypes.ts:62` 큐 행 타입, `lib/agentTypes.ts:100` `AgentGenerationErrorRecord` | 필드 추가 (후자는 현재 code/message만 노출) |
| `lib/agentQueueWorker.ts:179` | 실패 시점에 클래스 계산해 전달 |
| `tests/agent-mode-queue-migration-contract.test.ts:32` | 마이그레이션 계약에 새 컬럼 추가 |
| `tests/error-envelope-contract.test.ts` (신규) | 봉투별 카나리 |

**Agent는 클래스를 저장한다 (구현 감사 blocker 2로 결정 번복).** `060`은 저장
확장과 직렬화 시점 파생 중 고르라고 남겼고 나는 파생을 택했다. **불가능하다**:
`providerErrorClass`는 겹치는 코드에 status가 필요한데
(`lib/errors/providerMap.ts:110`), 큐는 `errorCode`와 메시지만 저장한다
(`lib/agentQueueStore.ts:180`). Agent는 Atlas 이미지
(`lib/agentImageVideoGen.ts:101`)와 Grok 비디오(`lib/agentImageVideoGen.ts:293`)를
타므로, 저장된 `ATLASCLOUD_GENERATE_FAILED`만으로는 400과 5xx를 구분할 수 없다.

따라서 실패 시점에 계산한 `errorClass`를 저장한다. 읽는 쪽
(`lib/agentQueueStore.ts:228`의 `getAgentGenerationErrors`,
`lib/agentQueueStore.ts:279`의 `queueItemFromRow`)은 저장된 값을 그대로
내보내고, 값이 없는 기존 행은 필드를 생략한다.

**이것은 스키마 마이그레이션이다 (2라운드 감사 blocker 1).** 초안은 "마이그레이션
없이"라고 적었는데 틀렸다: `agent_queue_items`에 `error_class` 컬럼이 없고
(`lib/db.ts:145`), 기존 DB 업그레이드는 `addColumnIfMissing`으로 컬럼을 하나씩
추가한다(`lib/db.ts:204`). 백필은 불필요하지만 nullable 컬럼 추가는 그 자체로
마이그레이션이다. 아래 변경 맵에 관련 파일을 모두 넣는다.

## 수용 기준

- `h1`: **여덟 봉투 각각에 카나리와 음성 대조가 있다.** 하나가 통과해도 다른
  봉투는 아무것도 증명하지 못한다(`060` 감사). 각 카나리는 패치 전 트리에서
  실패해야 한다.

  | 봉투 | 카나리 | 확인 |
  |---|---|---|
  | Classic SSE | MiniMax 402 | 평면 페이로드에 `rawCode`+`errorClass` |
  | Node SSE | 같은 오류 | **중첩** `error` 객체 안에 두 필드 |
  | Video SSE | Grok video 502 | 두 필드 |
  | Video JSON | `sendError`로 나가는 오류 | `code`가 **존재**하고 두 필드 |
  | Multimode | 전 항목 실패 | 대표 코드가 `EMPTY_RESPONSE`가 아님 |
  | MCP | 구조화된 `error.code` | 메시지 파싱을 이김 |
  | Edit JSON | Gemini 오류 | 두 필드 |
  | Agent queue | Atlas 400과 502 **두 건** | 실패 시점에 계산된 클래스가 DB에 저장되고 읽기에서 그대로 나온다. status 의존 코드를 써야 파생 설계로 되돌아가지 않았음이 증명된다 (2라운드 감사 blocker 3) |

- `h2`: **`code`는 의도된 세 곳을 빼고 불변이다** (구현 감사 blocker 4).
  Video JSON은 지금 코드가 아예 없으므로 "없음 → 있음", Multimode는
  `EMPTY_RESPONSE` → 대표 공급자 코드, **MCP는 메시지 첫 토큰 → 구조화된
  `error.code`**다. 초안은 예외를 하나, 2라운드에서는 둘로 적었고 둘 다
  자기 활성화 시나리오와 모순이었다. 나머지 **다섯 봉투**는 패치 전후
  동일해야 한다.
- `h3`: 앱 코드(`SAFETY_REFUSAL` 등)에는 두 필드가 **붙지 않는다.** `061`의
  규칙이 봉투에서도 유지된다.
- `h4`: 회귀 0. 전체 스위트 통과.

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 각 봉투의 필드 부착 | 위 여덟 카나리 | 해당 형태에 두 필드 등장 |
| Video JSON 코드 복원 | `sendError`로 오류 전달 | `code`가 응답에 존재. 패치 전에는 없음 |
| MCP 구조화 코드 우선 | `{code:"MINIMAX_X", message:"보통 문장"}` | `MINIMAX_X`. 패치 전에는 메시지 첫 토큰 |
| Multimode 대표 코드 | 전 항목 동일 실패 | 그 코드. 패치 전에는 `EMPTY_RESPONSE` |
| 앱 코드 비부착 | `SAFETY_REFUSAL` | 두 필드 없음 |

## verifier

| 명령 | 관측 대상 |
|---|---|
| `npm run typecheck` | 서버 전체 |
| `node --import tsx --test tests/error-envelope-contract.test.ts` | `h1`–`h3` |
| `npm test` | `h4` |

`cd ui && npm run build`는 이 유닛에서 **불필요하다** — UI 파일을 바꾸지 않는다.

## 이 유닛이 하지 않는 것

`resolveErrorSpec` 우선순위, 클래스별 문구, i18n, Agent 행 렌더링. 전부 `063`.
따라서 이 유닛 이후에도 **사용자에게 보이는 변화는 없다** — 필드가 도착할 뿐
아무도 아직 읽지 않는다.
