---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, errors]
---

# 061 — 서버 오류 코드 보존

- work-phase: `060`을 분할한 첫 유닛
- 소비: 없음
- 소비되는 곳: `062` 전송 봉투, `063` UI 소비

`060`의 배경·측정·설계 근거는 그 문서를 따른다. 여기서는 **서버가 공급자 코드를
잃지 않게 하는 것**만 한다. 봉투도 UI도 건드리지 않는다.

## 고치는 것: 두 유실 지점

구현 감사가 실행으로 확인한 두 지점이다.

```
status=402  errorCodeFrom=INVALID_REQUEST              normalized=INVALID_REQUEST
status=502  errorCodeFrom=MINIMAX_INSUFFICIENT_BALANCE normalized=UNKNOWN
```

| 지점 | 조건 | 지금 `code` | 이후 `code` | 이후 `rawCode` |
|---|---|---|---|---|
| `lib/generationErrors.ts:122` | 4xx 공급자 오류 | `INVALID_REQUEST` | **그대로** | 원문 보존 |
| `lib/generationErrors.ts:238` | 그 외 미인식 코드 | `UNKNOWN` | **그대로** | 원문 보존 |

**`errorCodeFrom`은 고치지 않는다 (구현 감사 blocker 1).** 4xx 분기가 공급자
코드를 우선하게 만들면 그 코드가 `normalizeGenerationFailure`의 passthrough
화이트리스트(`lib/generationErrors.ts:179`)를 통과하지 못해
`lib/generationErrors.ts:236`의 `UNKNOWN` 폴백으로 떨어진다. 즉 `code`가
`INVALID_REQUEST`에서 `UNKNOWN`으로 **더 나빠진다**. 내 초안이 정확히 그
설계였고 감사가 실행으로 잡았다.

올바른 서버 전용 설계는 **분류를 바꾸지 않고 장식만 추가**하는 것이다:
`normalizeGenerationFailure`가 반환하는 **모든 분기**의 err 객체를 장식 함수에
통과시킨다. passthrough 분기(`lib/generationErrors.ts:179`)도 포함이다 —
402 카나리가 바로 그리로 가기 때문이다.

**장식은 `providerMap`에 있는 코드에만 붙는다 (2라운드 감사 blocker 1).**
매핑에 없으면 `rawCode`/`errorClass`를 **아예 달지 않는다**. 잔여 클래스를
미매핑 코드에 적용하면 `AUTH_CHATGPT_EXPIRED`(passthrough,
`lib/generationErrors.ts:179`), `SAFETY_REFUSAL`(`lib/generationErrors.ts:191`),
진단 코드(`lib/generationErrors.ts:200`) 같은 **기존 앱 코드가
`INTERNAL_STATE_ERROR`로 오분류된다**. 이것들은 공급자 오류가 아니라 이미
의미가 확정된 앱 코드이고, 그 매핑은 이 유닛의 범위가 아니다.

따라서 `INTERNAL_STATE_ERROR`는 **`providerMap` 안에서만** 잔여 클래스다:
공급자 접두사를 가졌지만 어느 클래스에도 맞지 않는 코드에 쓴다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `lib/errors/classes.ts` (신규) | 10개 공통 클래스 union + 타입. `INTERNAL_STATE_ERROR`는 **`providerMap` 내부의** 잔여 클래스다 (위 참조) |
| `lib/errors/providerMap.ts` (신규) | 공급자 코드 → 클래스 매핑. **권위 목록**이며 동적 생성 지점의 전개 집합도 여기 명시한다. 대상은 **여섯 공급자 전부**: MiniMax 14, Gemini 7, Grok 27, **Agy 8, AtlasCloud 8** (구현 감사 blocker 2 — `060`의 48종 집계는 Classic/Node가 직접 부르는 Agy·AtlasCloud를 빠뜨렸다. `lib/generatePipeline.ts:322`, `lib/generatePipeline.ts:331`, `lib/nodeGeneration.ts:279`, `lib/nodeGeneration.ts:287`). 최소 64종 |
| `lib/generationErrors.ts:105` `errorCodeFrom` | **변경 없음** — 분류를 바꾸면 `code`가 더 나빠진다 |
| `lib/generationErrors.ts:177` `normalizeGenerationFailure` | **모든 반환 분기**(passthrough `lib/generationErrors.ts:179`, safety, 진단, `lib/generationErrors.ts:236` 폴백)에 원본 `lastErr.code` 기반 `rawCode`/`errorClass`를 부착 |
| `tests/error-class-coverage.test.ts` (신규) | 아래 `g1` |
| `tests/server-code-preservation.test.ts` (신규) | 아래 `g2` |

**`code` 필드는 건드리지 않는다.** 기존 소비자가 의존하는 의미를 이 유닛에서
바꾸면 회귀 범위가 봉투 전체로 번진다. 새 정보는 **추가 필드**로만 실어
보내고, `code`/`rawCode`/`class`의 우선순위 계약은 `062`가 정의한다.

`errorClass`라는 이름을 쓴다 — `class`는 예약어라 객체 리터럴 밖에서 다루기
불편하다.

## 수용 기준

- `g1`: **커버리지 테스트가 세 방향을 검사한다.**
  (a) `providerMap`의 모든 키가 클래스를 가진다.
  (b) 어휘 스캔으로 찾은 코드 중 매핑에 없는 것은 명시적 예외 목록에 있다.
  (c) **동적 생성 지점의 전개 집합**이 매핑과 일치한다. 지점 목록만 고정하면
  `lib/grokImageCore.ts:88`의 접두사 도메인을 넓히는 것만으로 새 코드가 새어
  나가므로(3라운드 감사), 각 지점의 접두사 도메인 × 접미사를 전개해 대조한다.
  현존 동적 지점은 `lib/grokImageCore.ts:92` 하나이고 전개 집합은
  `{GROK_SEARCH_BAD_REQUEST, GROK_PLANNER_BAD_REQUEST}`다.
- `g2`: **두 유실 지점 각각에 음성 대조가 있다.**

  | 케이스 | 입력 | `code` (전=후) | 추가되는 `rawCode` | `errorClass` |
  |---|---|---|---|---|
  | passthrough 4xx | `{code:"MINIMAX_INSUFFICIENT_BALANCE", status:402}` | `INVALID_REQUEST` | `MINIMAX_INSUFFICIENT_BALANCE` | `BILLING_REQUIRED` |
  | UNKNOWN 폴백 | `{code:"GROK_UPSTREAM_ERROR", status:502}` | `UNKNOWN` | `GROK_UPSTREAM_ERROR` | `NETWORK_FAILURE` |

  두 케이스는 서로 다른 코드 경로이므로 하나로 묶지 않는다. `code`가 **양쪽
  모두 패치 전후 동일**함을 명시적으로 단정한다 — 그것이 이 유닛의 무해성
  주장이다.

  **분기 커버리지도 단정한다 (2라운드 감사 blocker 2).** "모든 반환 분기를
  장식한다"는 계약은 두 카나리만으로 증명되지 않는다. 테스트는 네 분기를 각각
  통과시킨다: passthrough(`lib/generationErrors.ts:179`),
  safety(`lib/generationErrors.ts:191`), 진단(`lib/generationErrors.ts:200`),
  empty-response(`lib/generationErrors.ts:213`), 그리고 폴백
  (`lib/generationErrors.ts:236`). 공급자 코드가 원인인 경우 장식이 붙고,
  앱 코드인 경우 붙지 않음을 각 분기에서 확인한다.
- `g3`: **기존 분류와 재시도 동작이 바뀌지 않는다.** 장식만 추가하므로 자명해
  보이지만, 재시도는 `isNonRetryableGenerationError`(`lib/generationErrors.ts:130`)가
  `errorCodeFrom` 출력으로 판단하고 두 파이프라인이 그것으로 재시도를 멈춘다
  (`lib/generatePipeline.ts:396`, `lib/nodeGeneration.ts:366`). 기계 단정으로
  고정한다 (구현 감사 blocker 3).

  | 단정 | 기대 |
  |---|---|
  | 공급자 400/402/429 | 여전히 non-retryable |
  | 공급자 502 | 여전히 retryable |
  | `MINIMAX_BAD_REQUEST`, `MINIMAX_REF_TOO_MANY`, `GEMINI_API_BAD_REQUEST`, `GROK_BAD_REQUEST` | `code`는 `INVALID_REQUEST` 유지, `rawCode`만 추가 |
  | `SAFETY_REFUSAL`, `EMPTY_RESPONSE`, 진단 코드 | 기존과 동일 |
- `g4`: 전체 스위트 통과.

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 4xx 보존 분기 | 402 MiniMax 오류 | `rawCode: "MINIMAX_INSUFFICIENT_BALANCE"`. 패치 전 `INVALID_REQUEST` |
| 화이트리스트 미스 보존 | 502 Grok 오류 | 같은 보존. 패치 전 `UNKNOWN` |
| 접두사 없는 4xx | `{code:"SOMETHING", status:400}` | 여전히 `INVALID_REQUEST` (`g3`) |
| 매핑 누락 | 새 `MINIMAX_FOO` 추가 | `g1`(b) 실패 |
| 동적 도메인 확장 | `grokStageError`의 stage에 새 값 추가 | `g1`(c) 실패 |

## verifier

| 명령 | 관측 대상 |
|---|---|
| `npm run typecheck` | `lib/errors/**`, `lib/generationErrors.ts` |
| `node --import tsx --test tests/error-class-coverage.test.ts tests/server-code-preservation.test.ts` | `g1`, `g2` |
| `npm test` | `g3`, `g4` |

## 이 유닛이 하지 않는 것

봉투 변경, UI 변경, `code` 필드 의미 변경. 따라서 **사용자에게 보이는 변화는
아직 없다.** 이 유닛의 산출물은 "서버가 코드를 들고 있다"이고, 그것을 실어
나르는 것은 `062`, 보여주는 것은 `063`이다.
