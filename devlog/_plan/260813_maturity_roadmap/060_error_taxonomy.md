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
  → 진단 코드/EMPTY_RESPONSE만 통과, 나머지는 upstream 분류로 접힘
lib/generationErrors.ts:236  normalizeGenerationFailure()
  → "Unrecognized errors → UNKNOWN"  ← err.code = "UNKNOWN"
lib/generatePipeline.ts:598
  → 그 UNKNOWN을 SSE로 발행
```

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
| Grok | 28 | **0** | 전부 유실 |

사용자에게는 잔액 부족과 안전 필터 차단이 **같은 "알 수 없는 오류"**로 보인다.

**즉 필요한 것은 새 taxonomy가 아니라 이미 발행되는 코드를 잃지 않는 것이다.**
새 코드 체계를 설계하면 49종을 10종으로 접으면서 정보를 한 번 더 버린다.

## 설계: 2계층

```
공급자 고유 코드         →  공통 클래스        →  UI 문구/조치
MINIMAX_INSUFFICIENT_BALANCE  BILLING_REQUIRED     "잔액이 부족합니다" + 충전 링크
GROK_RATE_LIMITED             RATE_LIMITED         "잠시 후 재시도"
GEMINI_API_SAFETY_BLOCKED     CONTENT_REJECTED     "프롬프트가 정책에 걸렸습니다"
```

고유 코드는 **버리지 않고 함께 전달한다.** 클래스는 UI가 무엇을 보여줄지 정하고,
고유 코드는 진단·로그·이슈 신고에 남는다. 지금은 둘 다 잃는다.

공통 클래스는 평가서의 10개를 대체로 채택한다: `AUTH_INVALID`, `AUTH_EXPIRED`,
`BILLING_REQUIRED`, `MODEL_UNAVAILABLE`, `CAPABILITY_UNSUPPORTED`,
`CONTENT_REJECTED`, `RATE_LIMITED`, `PROVIDER_TIMEOUT`, `NETWORK_FAILURE`,
`INTERNAL_STATE_ERROR`. 다만 **기존 31개 UI 코드를 지우지 않는다** — 그것들은
이미 세밀한 문구를 가지고 있고, 클래스는 그 위에 얹힌다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `lib/errors/classes.ts` (신규) | 10개 공통 클래스 union |
| `lib/errors/providerMap.ts` (신규) | 49개 고유 코드 → 클래스 매핑. `040`의 `errorPrefix`로 미매핑 코드를 탐지 |
| `lib/generationErrors.ts:105` `errorCodeFrom` | 공급자 접두사 코드를 **통과시킨다** (지금은 접힘) |
| `lib/generationErrors.ts:236` `normalizeGenerationFailure` | `UNKNOWN`으로 덮기 전에 `rawCode`를 보존하고 `class`를 파생 |
| `lib/generatePipeline.ts:598` 및 node/multimode의 대응 지점 | `{ code, rawCode, class }`를 발행 |
| `routes/video.ts:499` | 코드는 이미 통과하므로 `class` 파생만 추가 |
| `lib/grokMultimodeAdapter.ts:69` | 항목별 실패 코드를 삼키지 않고 집계까지 전달 |
| `lib/multimodePipeline.ts:455` | 전 항목 실패 시 `EMPTY_RESPONSE` 대신 대표 코드 선택 |
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
| Classic (`lib/generatePipeline.ts:598`) | 서버 정규화 | 미인식 코드가 `UNKNOWN`으로 접힘 |
| Node (`lib/nodeGeneration.ts`) | 같음 | 동일 |
| Video (`routes/video.ts:499`) | **UI만** | `GROK_VIDEO_*`가 그대로 나가고 UI에서 접힘 |
| Multimode (`lib/multimodePipeline.ts:455`) | **집계 단계** | 항목별 Grok 오류를 `lib/grokMultimodeAdapter.ts:69`이 삼키고, 전부 실패하면 `EMPTY_RESPONSE`가 나감 |
| MCP (`routes/mcpMedia.ts:45`) | **자체 생성** | `errorCode()`가 `error.code`를 무시하고 메시지 앞부분을 잘라 코드로 만든다. `routes/mcpRecover.ts:28`, `routes/mcpMultishot.ts:102`도 동일 |
| Edit (`routes/edit.ts:228`, `routes/edit.ts:393`) | 자체 JSON 봉투 | SSE가 아니라 JSON 응답 |
| Agent (`lib/agentImageVideoGen.ts:96`, `lib/agentQueueWorker.ts:168`) | queue 상태 | SSE가 아니라 `err.code`를 큐에 저장 |

**초안은 Multimode·Video·MCP가 어댑터 코드를 그대로 전달한다고 적었다. 틀렸다**
(2라운드 감사 blocker 3). Video만 그렇고, Multimode는 집계에서 삼키며 MCP는
구조화된 코드를 보지 않고 문자열에서 새로 만든다.

초안은 또한 **Edit과 Agent 경로를 통째로 빠뜨렸다**(blocker 4). 둘 다 MiniMax·
Gemini·Grok 어댑터를 직접 부르는 사용자 표면이고 봉투 형태가 각각 다르다.

따라서 작업이 봉투 계열별로 나뉜다.

| 계열 | 할 일 |
|---|---|
| Classic/Node SSE | 서버 정규화가 코드를 접지 않게 고친다 (주 작업) |
| Video SSE | `class` 파생만 추가. 코드는 이미 통과 |
| Multimode 집계 | 항목별 실패 코드를 집계까지 보존한 뒤 대표 코드를 고른다 |
| MCP SSE | `errorCode()`가 `error.code`를 먼저 보게 하고 메시지 파싱은 폴백으로 |
| Edit JSON | 봉투에 `rawCode`/`class` 추가 |
| Agent queue | 저장하는 `err.code`에 `class` 동반 |
| `tests/error-class-coverage.test.ts` (신규) | 아래 |

`resolveErrorSpec`의 순서가 이 phase의 실질이다. 지금은 `등록됨 → 아니면 메시지
추측`이고, 이후는 `등록됨 → class → 메시지 추측`이다.

## 수용 기준

- `f1`: **모든 공급자 고유 코드가 클래스를 가진다.** `tests/error-class-coverage.test.ts`가
  `lib/errors/providerMap.ts`의 매핑 키를 기준으로 소스의 코드를 대조하고, 매핑
  없는 코드가 하나라도 있으면 실패한다. `040`의 `errorPrefix`가 있으면 스캔이
  간편해지지만 **전제는 아니다** — registry 없이도 이 테스트는 성립한다.
  새 공급자 코드를 추가하고 매핑을 잊으면 CI가 잡는다.
- `f2`: `UNKNOWN`으로 접히는 비율이 **경로별로** 측정된다. 실측 기준선은 49종 중
  **48종 미등록**이다(MiniMax 1종만 등록, Gemini·Grok 0종). 초안의 42는 산술
  오류였다(감사 blocker 4). 여기에 더해 **서버 정규화 단계의 유실을 경로별로
  따로 측정한다** — UI 등록 여부와 서버측 유실은 다른 손실이고, 후자가 더 앞선다.
  경로별 유실 지점은 위 매트릭스를 그대로 따른다: Classic/Node는 서버 정규화,
  Multimode는 집계, MCP는 코드 자체 생성, **Video만 UI 전용**, Edit/Agent는
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
  | Classic/Node | MiniMax 잔액 부족 | UI SSE 페이로드 |
  | Video | `GROK_VIDEO_*` 하나 | UI SSE 페이로드 |
  | Multimode | 전 항목 실패 | 대표 코드가 `EMPTY_RESPONSE`가 아님 |
  | MCP | 구조화된 `error.code` | 메시지 파싱을 이김 |
  | Edit | Gemini 오류 하나 | **JSON 응답** → UI 클라이언트 |
  | Agent | MiniMax 오류 하나 | **큐 행** → UI |

  각 카나리는 패치 전 음성 대조를 먼저 관측한다.
- `f4`: 기존 31개 코드의 문구가 바뀌지 않는다. 회귀 0.

## 조건부 경로 활성화 시나리오

오류 경로는 정상 실행에서 발화하지 않는다. 전부 강제해야 한다.

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 서버 정규화 통과 | MiniMax 어댑터에서 잔액 부족 오류 발생 | SSE 페이로드에 `rawCode: "MINIMAX_INSUFFICIENT_BALANCE"`. **패치 전에는 `UNKNOWN`** |
| 미등록 코드 → class 해석 | 위 페이로드가 UI에 도착 | `BILLING_REQUIRED` 문구. 패치 전에는 "알 수 없는 오류" |
| 등록 코드 우선 | `AUTH_CHATGPT_EXPIRED` 주입 | 기존 문구 그대로 (class가 덮어쓰지 않음) |
| class도 코드도 없음 | `{message:"boom"}` 주입 | 기존 메시지 휴리스틱으로 폴백 |
| 매핑 누락 탐지 | 소스에 새 `MINIMAX_FOO` 추가 | `f1` 테스트 실패 |

첫 행의 음성 대조가 이 phase의 활성화 증거다. 패치 전 트리에서 같은 주입이
`UNKNOWN`으로 접히는 것을 **먼저 관측한 뒤** 패치한다.

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
