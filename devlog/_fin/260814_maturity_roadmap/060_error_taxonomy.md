---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, errors]
---

# 060 — 공급자 오류 분류

- work-phase: WP4 세 번째 문서
- 소비: 없음. `040`의 `errorPrefix`는 **선택적 편의**다 — 매핑 키를 직접 열거하면
  registry 없이도 성립한다. 두 phase는 병렬 가능하다
- 소비되는 곳: `070` doctor, `080` E2E

## 문제는 taxonomy 부재가 아니다

평가서는 10개 공통 코드를 새로 설계하자고 제안한다. 측정해 보면 **문제가 다르다.**

공급자들은 이미 성실하게 타입된 코드를 발행한다.

```
sed -n '/export const errorCodes:/,/^};/p' ui/src/lib/errorCodes.ts \
  | rg -c '^\s+[A-Z0-9_]+:'                                        → 31
rg -o '"MINIMAX_[A-Z0-9_]+"'    lib/minimaxImageAdapter.ts   | sort -u | wc -l → 14
rg -o '"GEMINI_API_[A-Z0-9_]+"' lib/geminiApiImageAdapter.ts | sort -u | wc -l →  7
rg -o '"GROK_[A-Z0-9_]+"'       lib/grok*.ts | sed 's/.*://'  | sort -u | wc -l → 28
```

### 유실은 UI가 아니라 서버에서 먼저 일어난다

초안은 UI의 `resolveErrorSpec`을 고칠 자리로 지목했다. **틀렸다**(A phase 감사
blocker 3). 공급자 코드는 SSE에 닿기 **전에** 서버에서 이미 사라진다.

```
lib/generationErrors.ts:105  errorCodeFrom()
  → 4xx 상태면 lib/generationErrors.ts:122에서 INVALID_REQUEST로 접는다.
    그 분기를 피한 코드만 lib/generationErrors.ts:125의 원문 폴백에 닿는다
lib/generationErrors.ts:177  normalizeGenerationFailure()
  → 그 코드를 PASSTHROUGH/SAFETY/RESPONSE_DIAGNOSTIC 화이트리스트와 대조하고,
    어디에도 없으면 lib/generationErrors.ts:238에서 err.code = "UNKNOWN"으로 덮는다
lib/generatePipeline.ts:405 / lib/nodeGeneration.ts:382
  → 그 UNKNOWN을 throw하고, 파이프라인이 SSE로 발행한다
```

**두 번 정정했다. 유실 지점은 두 개다.**

초안은 `errorCodeFrom`이 코드를 접는다고 적었다. P phase에서 나는 그것이 틀렸고
`normalizeGenerationFailure`만 문제라고 정정했다. **그 정정도 불완전했다** —
구현 감사가 실행 증거로 잡았다.

```
status=402  errorCodeFrom=INVALID_REQUEST              normalized=INVALID_REQUEST
status=502  errorCodeFrom=MINIMAX_INSUFFICIENT_BALANCE normalized=UNKNOWN
```

`MINIMAX_INSUFFICIENT_BALANCE`는 HTTP **402**로 던져진다
(`lib/minimaxImageAdapter.ts:277`). `errorCodeFrom`의 일반 4xx 분기
(`lib/generationErrors.ts:122`)가 원문 폴백(`lib/generationErrors.ts:125`)보다
**먼저** 실행되어 `INVALID_REQUEST`를 반환한다. 그 뒤 `normalizeGenerationFailure`는
`INVALID_REQUEST`를 화이트리스트로 통과시키므로 `lib/generationErrors.ts:238`의 `UNKNOWN` 덮어쓰기에
도달조차 하지 않는다.

| 유실 지점 | 조건 | 결과 |
|---|---|---|
| `lib/generationErrors.ts:122` | 4xx 상태의 공급자 오류 | `INVALID_REQUEST`로 접힘 |
| `lib/generationErrors.ts:238` | 그 외 미인식 코드 | `UNKNOWN`으로 덮임 |

따라서 **두 곳 다 고쳐야 한다.** 4xx 분기만 두면 잔액 부족·인증 실패 같은 가장
흔한 공급자 오류가 그대로 사라지고, 카나리(`f5`의 MiniMax 잔액 부족)는 애초에
성립하지 않는다.

즉 `MINIMAX_INSUFFICIENT_BALANCE`는 UI에 도착조차 하지 않는다. UI만 고치면
**아무 일도 일어나지 않는다.** 고칠 자리는 서버 정규화 경계다.

UI 쪽도 손해가 있긴 하다. `ui/src/lib/errorCodes.ts:169`의 `resolveErrorSpec`은

등록되지 않은 코드를 반환값에서 버린다.

```ts
const code = (rawCode && rawCode in errorCodes ? (rawCode as ImaErrorCode) : classifyError(rawMessage));
return { code, spec, message: rawMessage, moderationStage };
```

`rawCode`를 담는 필드가 없다. `message` 원문은 살아남으므로 "전부 잃는다"는
과장이지만, 앱이 분기 판단에 쓸 구조화된 식별자는 사라진다.

**따라서 유실 지점이 두 개다.** 서버(주)와 UI(부). 서버를 고치지 않으면 UI
수정은 도달하지 않는 코드를 기다리는 셈이다.

| 공급자 | 발행 | UI 등록 | 결과 |
|---|---:|---:|---|
| OAuth/OpenAI | 다수 | 대부분 | 정상 |
| Agy | 6 | 6 | 정상 |
| MiniMax | 14 | **1** | 13종 유실 |
| Gemini | 7 | **0** | 전부 유실 |
| Grok | 27 | **0** | 전부 유실 |

사용자에게는 잔액 부족과 안전 필터 차단이 **같은 "알 수 없는 오류"**로 보인다.

**즉 필요한 것은 새 taxonomy가 아니라 이미 발행되는 코드를 잃지 않는 것이다.**
새 코드 체계를 설계하면 48종을 10종으로 접으면서 정보를 한 번 더 버린다.

## 이 문서는 세 개 유닛으로 분할됐다 (3라운드 감사 후 P 복귀)

구현 감사가 3라운드를 돌면서 blocker가 4 → 5 → 6으로 **늘었다**. 문서 품질
문제가 아니라 **범위 문제**다. 이 phase는 서버 정규화, 여섯 종의 전송 봉투,
UI 렌더링 계약을 한 사이클에 묶었고, 한 곳을 고칠 때마다 다른 곳과의 모순이
새로 드러났다. LOOP-REPAIR-01(같은 실패가 3회 반복되면 계획을 바꾼다)에 따라
쪼갠다.

| 유닛 | 범위 | 왜 독립인가 |
|---|---|---|
| `061` 서버 코드 보존 | `lib/generationErrors.ts`의 두 유실 지점, `lib/errors/{classes,providerMap}.ts`, 커버리지 테스트 | 봉투와 무관하다. 완료되면 "서버가 코드를 잃지 않는다"가 참이 된다 |
| `062` 전송 봉투 | 여덟 봉투(Classic/Node SSE, Video SSE, **Video JSON**, Multimode 집계, MCP, Edit JSON, Agent queue)가 `rawCode`/`class`를 통과시키게 | `061`의 보존된 코드를 소비한다. 봉투별 카나리와 음성 대조가 여기 산다 |
| `063` UI 소비 | `resolveErrorSpec` 우선순위, 클래스 스펙 표, i18n, Agent 행 렌더링 | `062`가 필드를 실어 보낸 뒤에만 검증 가능하다 |

**미해결 설계 질문은 `061`이 아니라 해당 유닛에서 답한다.** 3라운드 감사가
남긴 것들이다.

1. `code`/`rawCode`/`class`의 **우선순위 계약** — 402 카나리는 현재
   `code: INVALID_REQUEST`로 나가고, 그것은 UI에 등록된 코드라 클래스보다
   먼저 이긴다. `code`를 공급자 코드로 바꾸면 기존 의미가 깨지고, 그대로 두면
   `BILLING_REQUIRED`가 영원히 안 쓰인다. → `062`가 봉투 계약으로 정의한다.
2. **동적 코드 생성의 출력 집합** — 생성 지점만 고정하면
   `lib/grokImageCore.ts:88`의 접두사 도메인을 넓히는 것만으로 새 코드가
   샌다. 각 동적 지점의 전개 집합을 `providerMap`과 기계 대조해야 한다.
   → `061`이 커버리지 테스트로 해결한다.
3. **토스트 표면의 CTA** — `ui/src/lib/errorHandler.ts:18`은 toast에서
   `toastKey`만 쓰고 `ui/src/components/Toast.tsx:111`은 닫기만 렌더한다.
   클래스 표를 문구 전용으로 줄이거나 렌더러 작업을 명시해야 한다.
   → `063`이 결정한다.
4. **Agent UI 소비자** — `ui/src/components/agent/agentTypes.ts:75`의 큐 타입과
   `ui/src/components/agent/AgentQueueRow.tsx:26`은 `resolveErrorSpec`을
   부르지 않고 `errorCode`를 직접 렌더한다. 서버 저장만으로는 보이지 않는다.
   → `063`이 다룬다.

아래 내용은 세 유닛의 공통 배경으로 남긴다.

## 설계: 2계층

```
공급자 고유 코드         →  공통 클래스        →  UI 문구/조치
MINIMAX_INSUFFICIENT_BALANCE  BILLING_REQUIRED     "잔액이 부족합니다" + 충전 링크
GROK_RATE_LIMITED             RATE_LIMITED         "잠시 후 재시도"
GEMINI_API_SAFETY_BLOCKED     CONTENT_REJECTED     "프롬프트가 정책에 걸렸습니다"
```

고유 코드는 **버리지 않고 함께 전달한다.** 클래스는 UI가 무엇을 보여줄지 정하고,
고유 코드는 진단·로그·이슈 신고에 남는다. 지금은 둘 다 잃는다.

**UI 매핑은 기존 구조 안에서 한다 (구현 감사 2라운드 blocker 5).** 위 표의
"충전 링크"는 현재 지원되지 않는 동작이다: `ui/src/lib/errorCodes.ts:50`의
`cta` union은 `reauth | reload | retry | dismiss`뿐이고 `ui/src/components/Toast.tsx:111`의
카드 렌더링도 닫기만 노출한다. 새 CTA 종류를 추가하는 것은 UI 동작 변경이며
이 phase의 `f4`(회귀 0)와 충돌한다.

따라서 클래스는 **기존 `ErrorSpec` 형태로만** 매핑한다.

| 클래스 | `surface` | 문구 키 | `cta` |
|---|---|---|---|
| `AUTH_INVALID` / `AUTH_EXPIRED` | card | 신규 i18n 키 | `reauth` |
| `BILLING_REQUIRED` | card | 신규 i18n 키 (충전 안내 **문구**) | 없음 |
| `RATE_LIMITED` / `PROVIDER_TIMEOUT` / `NETWORK_FAILURE` | toast | 신규 i18n 키 | `retry` |
| `CONTENT_REJECTED` / `CAPABILITY_UNSUPPORTED` / `MODEL_UNAVAILABLE` | toast | 신규 i18n 키 | 없음 |
| `INTERNAL_STATE_ERROR` | toast | 신규 i18n 키 | `reload` |

`lib/errors/classes.ts`의 union과 짝을 이루는 `ui/src/lib/errorClassSpecs.ts`가
이 표를 소유하고, i18n 파일에 10개 키를 추가한다. `resolveErrorSpec`은 등록된
코드가 없을 때 이 표를 보고, 그것도 없으면 기존 메시지 휴리스틱으로 간다.

공통 클래스는 평가서의 10개를 대체로 채택한다: `AUTH_INVALID`, `AUTH_EXPIRED`,
`BILLING_REQUIRED`, `MODEL_UNAVAILABLE`, `CAPABILITY_UNSUPPORTED`,
`CONTENT_REJECTED`, `RATE_LIMITED`, `PROVIDER_TIMEOUT`, `NETWORK_FAILURE`,
`INTERNAL_STATE_ERROR`. 다만 **기존 31개 UI 코드를 지우지 않는다** — 그것들은
이미 세밀한 문구를 가지고 있고, 클래스는 그 위에 얹힌다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `lib/errors/classes.ts` (신규) | 10개 공통 클래스 union |
| `ui/src/lib/errorClassSpecs.ts` (신규) | 클래스 → `ErrorSpec` 표 (위 매핑). 기존 `cta` union만 사용 |
| i18n 문구 파일 | 클래스별 키 10개 추가 |
| `lib/errors/providerMap.ts` (신규) | 48개 고유 코드 → 클래스 매핑 (아래 집계 정정). `040`의 `errorPrefix`로 미매핑 코드를 탐지 |
| `lib/generationErrors.ts:122` `errorCodeFrom`의 4xx 분기 | 공급자 접두사 코드를 `INVALID_REQUEST`로 접기 전에 **원문 코드를 우선**한다 (구현 감사 1라운드 blocker 1) |
| `lib/generationErrors.ts:177` `normalizeGenerationFailure` | 화이트리스트 미스 시 `lib/generationErrors.ts:238`에서 `UNKNOWN`으로 덮기 전에 `rawCode`를 보존하고 `class`를 파생 |
| `lib/generatePipeline.ts:405`, `lib/nodeGeneration.ts:382` 및 파이프라인 발행 지점 | `{ code, rawCode, class }`를 발행 |
| `routes/video.ts:503` | 코드는 이미 통과하므로 `class` 파생만 추가 |
| `routes/videoExtended.ts:83`, `routes/videoExtended.ts:92` `sendError()` | **필수** (구현 감사 blocker 4): 마지막 분기가 `err.code`를 아예 버리고 `{error}`만 보낸다. legacy video edit/native extension 실패가 여기로 나가므로, 이 경로만 두면 Video 계열의 "코드 보존" 주장이 거짓이 된다. `routes/videoExtended.ts:374`(last-frame extension)는 이미 보존한다 |
| `lib/grokMultimodeAdapter.ts:86` | 항목별 실패 코드를 삼키지 않고 집계까지 전달 |
| `lib/multimodePipeline.ts:461` | 전 항목 실패 시 `EMPTY_RESPONSE` 대신 대표 코드 선택 |
| `routes/mcpMedia.ts:45` `errorCode()` | `error.code`를 먼저 보고 메시지 파싱은 폴백. `routes/mcpRecover.ts:28`, `routes/mcpMultishot.ts:102` 동일 |
| `routes/edit.ts:228`, `routes/edit.ts:393` | JSON 오류 봉투에 `rawCode`/`class` |
| `ui/src/lib/api-core.ts:7` `jsonFetch()` | **필수.** 현재 `status`/`code`/`currentVersion`만 Error에 옮긴다. `rawCode`/`class`를 추가하지 않으면 Edit 봉투의 새 필드가 클라이언트에서 버려진다 |
| `lib/agentImageVideoGen.ts:96`, `lib/agentQueueWorker.ts:168` | 큐 상태에 `class` 동반 |
| `lib/agentQueueStore.ts:180` `failAgentQueueItem()` | **필수.** 현재 `{code, message}`만 받는다. `class`를 담을 인자가 없다 |
| `lib/agentTypes.ts:60` 큐 행 타입 | `errorCode`/`errorMessage`만 있다. 저장 필드 추가 |
| `ui/src/components/agent/AgentQueueRow.tsx:26` | 큐 행 UI 타입에 `class` 없음 |

**Edit과 Agent는 서버만 고치면 아무 일도 일어나지 않는다**(3라운드 감사 blocker
1·2). 두 경로 모두 소비자 체인이 새 필드를 통과시키지 않는다. Edit은 공용 JSON
클라이언트에서, Agent는 저장 함수·행 타입·UI에서 각각 막힌다.

Agent 쪽은 대안이 있다: 저장은 `errorCode`만 하고 **직렬화 시점에 `class`를
파생**하면 스키마를 건드리지 않는다. 매핑이 순수 함수이므로 가능하다. B에서 두
방식의 비용을 비교하고 선택한 이유를 기록한다.
| SSE 오류 페이로드 | `{ code, rawCode, class, message }` — 기존 `code` 의미는 유지 |
| `ui/src/lib/sseStreamError.ts` | `rawCode`/`class` 파싱 추가 |
| `ui/src/lib/errorCodes.ts:169` | 반환 타입에 `rawCode` 추가. 미등록 코드일 때 **메시지 휴리스틱 전에 `class`를 먼저 본다** |

**작업 순서가 고정돼 있다**: 서버 → SSE → UI. 반대로 하면 UI 변경을 검증할
데이터가 없다.

### 경로마다 유실 정도가 다르다

`lib/generationErrors.ts`를 **모든 경로가 거치지는 않는다.** 확인했다.

```
rg -c 'normalizeGenerationFailure|errorCodeFrom' <file>
  lib/nodeGeneration.ts     → 2
  lib/multimodePipeline.ts  → 0
  routes/video.ts           → 0
  routes/mcpMedia.ts        → 0
```

그러나 **`generationErrors`를 거치지 않는다고 코드가 보존되는 것은 아니다.**
경로마다 자기 방식으로 잃는다.

| 경로 | 유실 지점 | 지금 무엇이 나가나 |
|---|---|---|
| Classic (`lib/generatePipeline.ts:405`) | 서버 정규화 | 미인식 코드가 `UNKNOWN`으로 접힘 |
| Node (`lib/nodeGeneration.ts`) | 같음 | 동일 |
| Video (`routes/video.ts:503`, `routes/videoExtended.ts:83`) | **서버 일부 + UI** | 주 생성과 last-frame extension은 코드를 보존하지만, legacy edit/native extension은 `sendError()`가 `err.code`를 버린다. 보존된 것도 UI에서 접힘 |
| Multimode (`lib/multimodePipeline.ts:461`) | **집계 단계** | 항목별 Grok 오류를 `lib/grokMultimodeAdapter.ts:86`의 catch가 삼키고, 전부 실패하면 `EMPTY_RESPONSE`가 나감 |
| MCP (`routes/mcpMedia.ts:45`) | **자체 생성** | `errorCode()`가 `error.code`를 무시하고 메시지 앞부분을 잘라 코드로 만든다. `routes/mcpRecover.ts:28`, `routes/mcpMultishot.ts:102`도 동일 |
| Edit (`routes/edit.ts:228`, `routes/edit.ts:393`) | 자체 JSON 봉투 | SSE가 아니라 JSON 응답 |
| Agent (`lib/agentImageVideoGen.ts:96`, `lib/agentQueueWorker.ts:168`) | queue 상태 | SSE가 아니라 `err.code`를 큐에 저장 |

**초안은 Multimode·Video·MCP가 어댑터 코드를 그대로 전달한다고 적었다. 틀렸다**
(2라운드 감사 blocker 3). Multimode는 집계에서 삼키고 MCP는 구조화된 코드를
보지 않고 문자열에서 새로 만든다. Video도 **부분적으로만** 전달한다 — 구현 감사
2라운드가 `sendError()`의 코드 유실을 잡았다.

초안은 또한 **Edit과 Agent 경로를 통째로 빠뜨렸다**(blocker 4). 둘 다 MiniMax·
Gemini·Grok 어댑터를 직접 부르는 사용자 표면이고 봉투 형태가 각각 다르다.

따라서 작업이 봉투 계열별로 나뉜다.

| 계열 | 할 일 |
|---|---|
| Classic/Node SSE | 서버 정규화가 코드를 접지 않게 고친다 (주 작업) |
| Video SSE/JSON | `sendError()`가 `err.code`를 봉투에 싣게 고치고(`routes/videoExtended.ts:83`), 이미 통과하는 경로에는 `class` 파생을 추가 |
| Multimode 집계 | 항목별 실패 코드를 집계까지 보존한 뒤 대표 코드를 고른다 |
| MCP SSE | `errorCode()`가 `error.code`를 먼저 보게 하고 메시지 파싱은 폴백으로 |
| Edit JSON | 봉투에 `rawCode`/`class` 추가 |
| Agent queue | 저장하는 `err.code`에 `class` 동반 |
| `tests/error-class-coverage.test.ts` (신규) | 아래 |

`resolveErrorSpec`의 순서가 이 phase의 실질이다. 지금은 `등록됨 → 아니면 메시지
추측`이고, 이후는 `등록됨 → class → 메시지 추측`이다.

## 수용 기준

- `f1`: **모든 공급자 고유 코드가 클래스를 가진다.** 기준 집합은 **어휘 스캔이
  아니라 명시적 권위 목록**이다 (구현 감사 blocker 2). 정규식 스캔은 양쪽으로
  틀린다: `lib/grokImageCore.ts:88`의 `GROK_SEARCH`/`GROK_PLANNER`는 접두사
  변수일 뿐 발행되는 코드가 아니고, 반대로 실제 발행되는
  `GROK_SEARCH_BAD_REQUEST`는 템플릿 리터럴(`lib/grokImageCore.ts:92`)이라
  스캔에 잡히지 않는다. 숫자가 우연히 49로 맞아떨어져도 **집합이 틀렸다**.

  따라서 `lib/errors/providerMap.ts`가 권위 목록을 소유하고,
  `tests/error-class-coverage.test.ts`는 세 방향을 검사한다: (a) 매핑의 모든
  키가 클래스를 가진다, (b) 어휘 스캔으로 찾은 코드 중 매핑에 없는 것은
  **명시적 예외 목록**(접두사 변수 등)에 있어야 한다, (c) **동적 생성 지점이
  늘어나지 않았는지** 확인한다 — 템플릿 리터럴로 코드를 만드는 곳
  (`lib/grokImageCore.ts:92`가 유일한 현존 사례)을 정규식으로 찾아 알려진
  목록과 대조하고, 새 동적 생성이 나타나면 실패한다.

  (c)가 필요한 이유는 (b)만으로는 **새로 추가된 동적 코드를 영원히 놓치기**
  때문이다(구현 감사 blocker 3). 이상적으로는 발행부가 권위 목록의 상수를
  참조하게 만드는 것이지만, 그 리팩터링은 여섯 어댑터를 건드리므로 이 phase의
  범위 밖이다. 대신 동적 생성 지점 자체를 고정해 CI가 증가를 잡는다.
  새 공급자 코드를 추가하고 매핑을 잊으면 CI가 잡는다. `040`의 `errorPrefix`가 있으면 스캔이
  간편해지지만 **전제는 아니다** — registry 없이도 이 테스트는 성립한다.
  새 공급자 코드를 추가하고 매핑을 잊으면 CI가 잡는다.
- `f2`: `UNKNOWN`으로 접히는 비율이 **경로별로** 측정된다. 실측 기준선은 **48종 중 47종 미등록**이다
  (MiniMax 14 중 1종만 등록, Gemini 7 전부 미등록, Grok 27 전부 미등록).
  초안의 42는 산술 오류였고, 그것을 고친 49도 틀렸다(구현 감사 2라운드
  blocker 2): 어휘 스캔의 28에서 접두사 변수
  `GROK_SEARCH`/`GROK_PLANNER`(`lib/grokImageCore.ts:88`) 둘을 빼고, 스캔이
  놓친 동적 `GROK_SEARCH_BAD_REQUEST`(`lib/grokImageCore.ts:92`) 하나를 더하면
  27이다. `GROK_PLANNER_BAD_REQUEST`는 이미 리터럴로 존재한다
  (`lib/grokVideoAdapter.ts:201`). 여기에 더해 **서버 정규화 단계의 유실을 경로별로
  따로 측정한다** — UI 등록 여부와 서버측 유실은 다른 손실이고, 후자가 더 앞선다.
  경로별 유실 지점은 위 매트릭스를 그대로 따른다: Classic/Node는 서버 정규화,
  Multimode는 집계, MCP는 코드 자체 생성, **Video는 서버 일부(sendError)와 UI 양쪽**, Edit/Agent는
  SSE가 아닌 별도 봉투.
- `f3`: 고유 코드가 **유실되지 않는다.** UI가 클래스로 문구를 고르더라도 진단
  정보에는 `MINIMAX_INSUFFICIENT_BALANCE`가 남는다.
  구체적으로 `resolveErrorSpec`의 반환 타입에 `rawCode` 필드를 추가한다. 지금은
  담을 자리 자체가 없다.
- `f5`: **봉투 계열마다 하나씩** 전 구간 통과를 관측한다. Classic 카나리 하나로는
  부족하다 — 여섯 계열의 코드 경로가 서로 다르므로 하나가 통과해도 나머지는
  아무것도 증명되지 않는다. Edit과 Agent는 SSE 경로가 아니라는 점도 명시한다.

  | 계열 | 카나리 | 종점 |
  |---|---|---|
  | Classic | MiniMax 잔액 부족 | UI SSE 페이로드 (**flat** `{error, code}`) |
  | Node | MiniMax 잔액 부족 | UI SSE 페이로드 (**nested** `{error:{code,message}}`) |
  | Video | `GROK_VIDEO_*` 하나 | UI SSE 페이로드 |
  | Multimode | 전 항목 실패 | 대표 코드가 `EMPTY_RESPONSE`가 아님 |
  | MCP | 구조화된 `error.code` | 메시지 파싱을 이김 |
  | Edit | Gemini 오류 하나 | **JSON 응답** → UI 클라이언트 |
  | Agent | MiniMax 오류 하나 | **큐 행** → UI |

  **Classic과 Node를 하나로 묶지 않는다** (구현 감사 blocker 3): Classic은
  `lib/generatePipeline.ts:615`에서 평면 `{error, code}`를 발행하고 Node는
  `lib/nodeHelpers.ts:53`을 거쳐 중첩 `{error:{code,message}}`를 발행한다.
  UI 파서도 두 형태를 각각 다른 분기로 다룬다(`ui/src/lib/sseStreamError.ts:10`,
  `ui/src/lib/sseStreamError.ts:12`). 한쪽 카나리는 다른 쪽을 증명하지 못하므로
  전송 봉투 기준 카나리는 **최소 일곱 개**다.

  각 카나리는 패치 전 음성 대조를 먼저 관측한다.
- `f4`: 기존 31개 코드의 문구가 바뀌지 않는다. 회귀 0.

## 조건부 경로 활성화 시나리오

오류 경로는 정상 실행에서 발화하지 않는다. 전부 강제해야 한다.

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 4xx 분기 통과 | MiniMax 잔액 부족(402, `lib/minimaxImageAdapter.ts:277`) | SSE 페이로드에 `rawCode: "MINIMAX_INSUFFICIENT_BALANCE"`. **패치 전에는 `INVALID_REQUEST`** (402가 `lib/generationErrors.ts:122`에 걸린다) |
| 화이트리스트 미스 통과 | 502로 던져지는 공급자 오류(예: `GROK_UPSTREAM_ERROR`) | 같은 `rawCode` 보존. **패치 전에는 `UNKNOWN`** (`lib/generationErrors.ts:238`) |
| 미등록 코드 → class 해석 | 위 페이로드가 UI에 도착 | `BILLING_REQUIRED` 문구. 패치 전에는 "알 수 없는 오류" |
| 등록 코드 우선 | `AUTH_CHATGPT_EXPIRED` 주입 | 기존 문구 그대로 (class가 덮어쓰지 않음) |
| class도 코드도 없음 | `{message:"boom"}` 주입 | 기존 메시지 휴리스틱으로 폴백 |
| 매핑 누락 탐지 | 소스에 새 `MINIMAX_FOO` 추가 | `f1` 테스트 실패 |

**앞의 두 행이 서로 다른 음성 대조**라는 점이 중요하다. 4xx 오류는 패치 전에
`INVALID_REQUEST`로, 그 외는 `UNKNOWN`으로 접힌다. 한 쪽만 관측하면 나머지
유실 지점은 검증되지 않은 채 남는다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `npm run typecheck` | `lib/errors/**`, `lib/generationErrors.ts` | include에 `lib/**` — **관측함** |
| `cd ui && npm run build` | `ui/src/lib/errorCodes.ts`, `sseStreamError.ts` | 서버 typecheck는 `ui/`를 exclude하므로 **이쪽이 필수** |
| `node --test tests/error-class-coverage.test.ts` | 매핑 완전성 | 파일 미존재 (B에서) |
| `npm test` | 회귀(`f4`) | `d2fe420`에서 2118/2116 pass |

## 이 phase가 증명하지 못하는 것

"운영 오류의 95%가 공통 코드로 분류된다"는 평가서 종료 조건은 **측정할 수 없다.**
운영 오류 분포 데이터가 없기 때문이다. 대신 측정 가능한 것으로 바꾼다:
**소스에서 발행되는 코드의 100%가 클래스를 가진다**(`f1`). 실제 사용자가 어떤
오류를 얼마나 만나는지는 텔레메트리 결정 이후의 문제다.
