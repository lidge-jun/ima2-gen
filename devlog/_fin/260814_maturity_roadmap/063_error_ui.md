---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, errors, ui]
---

# 063 — 오류 UI 소비

- work-phase: `060`을 분할한 세 번째 유닛
- 소비: `062`가 실은 `code` / `rawCode` / `errorClass`
- 이 유닛이 답하는 질문: 세 필드가 동시에 도착했을 때 UI가 무엇을 보여 주는가

`062`는 필드를 실어 보냈다. 이 유닛은 그걸 **읽는다.** 서버 봉투는 건드리지 않는다.

## 현재 상태 (P stale 검증, 2026-08-13, HEAD 129e3d14)

| 표면 | 경로 | 지금 하는 일 |
|---|---|---|
| 해석기 | `ui/src/lib/errorCodes.ts:169` `resolveErrorSpec` | `err.code`가 `errorCodes`에 등록돼 있으면 그걸 쓰고, 아니면 메시지로 추측. `rawCode`/`errorClass`는 타입에도 없다 |
| SSE 파서 | `ui/src/lib/sseStreamError.ts:10` | 평면 `data.code`와 중첩 `data.error.code`만 올린다. `rawCode`/`errorClass`는 버린다 |
| JSON 클라이언트 | `ui/src/lib/api-core.ts:15` `jsonFetch` | `status`/`code`/`currentVersion`만 복사한다. `rawCode`/`errorClass`는 버린다 |
| 카드 저장 | `ui/src/store/storeUIImpl.ts:183` | `ImaErrorCode`만 저장. Toast는 `errorCodes[card.code]`로 다시 해석한다 |
| 디스패처 | `ui/src/lib/errorHandler.ts:18` | spec.surface가 card면 ErrorCard, 아니면 toastKey |
| 토스트 | `ui/src/components/Toast.tsx:111` | 문구 + 닫기. `cta` union(`reauth\|reload\|retry\|dismiss`)은 선언만 있고 버튼이 없다 |
| ErrorCard | `ui/src/components/ErrorCard.tsx` | `return null`. 실제 렌더는 Toast 카드 행 |
| Agent 행 | `ui/src/components/agent/AgentQueueRow.tsx:26` | `errorCode`/`errorMessage`를 `<small>`로 그대로 찍는다. `resolveErrorSpec`을 부르지 않는다 |
| Agent 타입 | `ui/src/components/agent/agentTypes.ts:83` | `errorCode`/`errorMessage`만. 서버가 보내는 `errorClass`를 받을 자리가 없다 |

402 카나리는 지금도 `code: INVALID_REQUEST`로 도착한다. 그 코드는 `errorCodes`에 등록돼 있어서 클래스가 와도 현재 해석기는 절대 `BILLING_REQUIRED`를 보지 않는다. 이것이 이 유닛의 핵심 결정이다.

## 설계 결정: 우선순위

**등록된 앱 코드가 클래스보다 이긴다. 예외는 클래스가 과금/인증일 때뿐이다.**

순서:

1. `code`가 `errorCodes`에 있으면 그 spec을 쓴다.
2. 다만 `errorClass`가 `BILLING_REQUIRED` / `AUTH_INVALID` / `AUTH_EXPIRED`이면 클래스 spec이 1을 이긴다. MiniMax 402가 `INVALID_REQUEST` 카드로 남는 바로 그 구멍을 막기 위해서다.
3. `code`가 미등록이면 `errorClass` spec.
4. 그것도 없으면 기존 `classifyError(message)` 휴리스틱.

`rawCode`는 화면에 기본으로 그리지 않는다. `resolveErrorSpec` 반환값에만 실어 진단/상세에 쓴다.

이 순서를 고른 이유: 기존 31개 UI 코드의 문구를 유지하면서, 서버가 접어 버린 공급자 코드만 클래스로 살린다. 클래스 전면 승리는 등록된 `SAFETY_REFUSAL` 같은 앱 코드를 토스트로 강등시킨다.

## 클래스 스펙 표

`ui/src/lib/errorClassSpecs.ts`가 `lib/errors/classes.ts`의 10개 union과 짝을 이룬다. 새 CTA 종류는 만들지 않는다 (`060` 결정, `cta` union 유지).

| 클래스 | surface | i18n 키 | cta |
|---|---|---|---|
| AUTH_INVALID / AUTH_EXPIRED | card | `errorCard.authClass.*` | `reauth` |
| BILLING_REQUIRED | card | `errorCard.billingRequired.*` | 없음 (충전 링크 없음) |
| RATE_LIMITED / PROVIDER_TIMEOUT / NETWORK_FAILURE | toast | `toast.errorClass.*` | `retry` (선언만, 렌더러는 닫기) |
| CONTENT_REJECTED / CAPABILITY_UNSUPPORTED / MODEL_UNAVAILABLE | toast | `toast.errorClass.*` | 없음 |
| INTERNAL_STATE_ERROR | toast | `toast.errorClass.*` | `reload` (선언만) |

토스트 CTA를 실제로 그리는 일은 이 유닛 밖이다. 문구와 spec만 넣는다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `ui/src/lib/errorClassSpecs.ts` (신규) | 10개 클래스 → ErrorSpec |
| `ui/src/lib/errorCodes.ts` `resolveErrorSpec` | 위 우선순위. 반환에 `rawCode?: string`, `errorClass?: string`, 선택된 `spec` |
| `ui/src/lib/sseStreamError.ts` | 평면/중첩 모두에서 `rawCode`/`errorClass`를 Error 객체에 복사. 충돌 시 중첩 객체가 이긴다 (Node 봉투의 권위) |
| `ui/src/lib/api-core.ts` `jsonFetch` | 평면과 중첩 모두에서 두 필드를 Error에 복사. Edit JSON이 여기를 통과한다 |
| `ui/src/lib/errorHandler.ts` | `showErrorCard`에 선택된 `cardKey`를 함께 넘긴다 |
| `ui/src/store/storeTypes.ts`, `ui/src/store/storeUIImpl.ts` | `ErrorCardEntry`에 `cardKey`를 저장 |
| `ui/src/components/Toast.tsx` | 저장된 `cardKey`로 문구를 고른다. `errorCodes[card.code]`로 재해석하지 않는다 |
| `ui/src/i18n/ko.json`, `ui/src/i18n/en.json` | 클래스 문구 10세트 |
| `ui/src/components/agent/agentTypes.ts` | `errorClass?: string` 또는 null |
| `ui/src/lib/agentQueueError.ts` (신규) | 큐 행 문구 해석. 클래스가 있을 때만 사람 문구 |
| `ui/src/components/agent/AgentQueueRow.tsx` | `resolveErrorSpec({ code: errorCode, errorClass, message: errorMessage })`로 문구를 고른다. 원본 코드는 details에 남긴다 |
| `tests/error-ui-consumption.test.ts` (신규) | 아래 카나리 |
| `tests/i18n-dictionary-contract.test.ts` | 새 cardKey/toastKey와 Agent 행 동적 t()를 레지스트리에 등록 |

서버 파일은 OUT. `062` 봉투를 다시 열지 않는다.

## 수용 기준

- `u1`: MiniMax 402 페이로드 `{ code: "INVALID_REQUEST", rawCode: "MINIMAX_INSUFFICIENT_BALANCE", errorClass: "BILLING_REQUIRED" }`는 `BILLING_REQUIRED` spec을 고르고, **저장된 cardKey / Toast 문구가 billing 키**다. `resolveErrorSpec`만 초록이면 안 된다.
- `u1b`: `code`만 있는 `INVALID_REQUEST`는 기존 invalidRequest 카드를 유지한다.
- `u2`: 등록된 앱 코드 `SAFETY_REFUSAL`은 클래스가 없어도, 엉뚱한 클래스(`NETWORK_FAILURE`)가 붙어도 기존 moderation 카드를 유지한다.
- `u3`: SSE 파서가 평면 Classic과 중첩 Node에서 `rawCode`/`errorClass`를 모두 살린다. 둘 다 있으면 중첩이 이긴다.
- `u3b`: Edit JSON `{error, code, rawCode, errorClass}`가 `jsonFetch`를 지나 `resolveErrorSpec`까지 두 필드를 유지한다. 패치 전 `api-core`는 필드를 버린다 (음성 대조).
- `u4`: Agent 행이 `errorClass: BILLING_REQUIRED`를 사람 문구로 렌더하고, details에 원본 코드를 남긴다. 클래스 없는 timeout 행은 지금처럼 코드를 그대로 보여 준다.
- `u6`: 알 수 없는 `errorClass`는 무시하고 기존 휴리스틱으로 간다. 코드/클래스 없는 메시지는 지금과 같다.
- `u5`: 회귀 0.

## 조건부 경로 활성화

| 경로 | 트리거 | 관측 |
|---|---|---|
| 클래스 우선 (과금/인증) | 402 카나리 페이로드 | resolve + 저장된 cardKey가 billing |
| 등록 코드 우선 | SAFETY_REFUSAL + dummy class | 기존 moderation 카드 |
| JSON 필드 보존 | Edit JSON fixture → jsonFetch | Error.rawCode/errorClass 존재 |
| SSE 필드 보존 | 평면/중첩 fixture | Error 필드 존재, 충돌 시 중첩 |
| 미지 클래스 | errorClass: "NOT_A_CLASS" | 메시지 휴리스틱 |
| Agent 문구 | errorClass 있는 실패 행 | i18n 문구, details에 원본 코드 |

## verifier

| 명령 | 관측 |
|---|---|
| `node --import tsx --test tests/error-ui-consumption.test.ts` | u1–u4, u6. 이 파일이 변경 대상을 import한다 |
| `cd ui && npm run build` | UI 타입/번들 |
| `npm run typecheck:tests` | 신규 테스트 타입 |
| `node --import tsx --test tests/minimax-ui-registration-contract.test.ts tests/frontend-sse-risk-contract.test.js tests/i18n-dictionary-contract.test.ts` | 기존 UI/SSE/i18n 계약 |

`npm run typecheck`는 `ui/`와 `tests/`를 보지 않는다. 회귀 게이트로 쓰지 않는다. 전체 `npm test`는 C에서 한 번.

## 이 유닛이 하지 않는 것

토스트에 retry/reauth 버튼을 그리는 일, 충전 링크, 서버 봉투 재설계, `errorCodes`의 기존 31개 문구 삭제.

## 구현 잔여 (C, dfd492a5)

`handleError`/`showErrorCardImpl`/`Toast`/`AgentQueueRow`는 `import.meta.env`와 zustand 스토어를 끌어 루트 `node:test`에서 실행할 수 없다. u1/u4의 소비 경로는 헬퍼 실행 + 소스 핀으로 증명한다. 브라우저 E2E는 080의 몫이다.
