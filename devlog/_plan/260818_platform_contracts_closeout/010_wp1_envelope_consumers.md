---
created: 2026-08-18
updated: 2026-08-18
tags: [ima2-gen, devlog, wp1, jobs, envelope]
---

# 010 (WP1) — #151 2단계: 터미널 생산 커버리지 + 소비자 전환

의존: 없음 (030_wp3_envelope_phase1 완료 상태에서 출발).

## 설계 원칙

1단계와 같다: **additive, 접촉면 최소화.** raw `publish()` 호출을
`publishJobEvent`로 바꾸는 것은 wire에 `envelope` 필드를 추가할 뿐
`data`를 건드리지 않는다. 소비자 전환은 envelope가 있으면 쓰고 없으면
기존 로직으로 폴백한다 — 구버전 서버에 새 CLI가 붙어도 죽지 않는다.

## 단계 A — 터미널 생산 커버리지 (프로덕션 도달성)

현재 `cancelled`/`failed` envelope는 MCP 경로에서만 생산된다. 전환할 call site:

| # | 파일 | 위치 | 변경 |
|---|---|---|---|
| 1 | `lib/inflight.ts` | :241 abortJob | `publish(requestId,"error",{...})` → `publishJobEvent` |
| 2 | `lib/generatePipeline.ts` | :65 fail() async 분기 | 동일 치환 |
| 3 | `routes/video.ts` | :59-65 dualEmitVideo | error도 `publishJobEvent` 경유 |
| 4 | `routes/video.ts` | :159 검증 실패 | 동일 치환 |
| 5 | `lib/multimodePipeline.ts` | :70-76 dualEmitMultimode | error도 `publishJobEvent` 경유 |
| 6 | `lib/multimodePipeline.ts` | :86 respondMultimodeValidationError | 동일 치환 |
| 7 | `routes/videoExtended.ts` | :265, :376 error publish | 동일 치환 |
| 8 | `lib/nodeHelpers.ts` | :61 writeNodeError | node mode 터미널 error 경로 (감사 블로커 2). `ssePublish.publishJobEvent` import. **payload 형태 주의 (재감사 블로커):** writeNodeError는 중첩 `{error:{code,message},status}` 형태인데 `errorFromData`/`resolvePhase`는 최상위 `data.code`/`data.error` 문자열을 읽는다. 그대로 넘기면 node cancel이 `failed`로 찍히고 envelope.error가 사라진다. **publish 레코드에 code/error 문자열을 평탄화해 실어서** (`{...payload, code, error: message}`) buildEnvelope가 올바른 phase(cancelled/timed_out)를 판정하게 한다. bus 소비자용 `data` 원형(중첩)은 유지 — 평탄화 필드는 additive. `tests/node-diagnostics-contract.test.js:24`가 nodeHelpers 소스 텍스트를 읽으므로 수정 후 그 단언 확인 |

**주의 (import 순환/DB 오염):** `inflight.ts`가 `ssePublish`를 import하면
순환이 생긴다 (`ssePublish` → `inflight`). abortJob은 이미 inflight 내부라
`getJobPhase`/`isJobCanceled`를 직접 알고, terminal 스냅샷 저장 직전이므로
**inflight에는 `buildEnvelope` 콜백을 직접 조립해 `publish(..., {buildEnvelope})`
를 부른다** — `ssePublish`를 import하지 않고 `jobs/envelope.js`만 추가 import.
envelope.ts는 import가 0건이므로 순환 없음 (감사에서 직접 확인).

**nodeHelpers 검토 (감사 블로커 2):** `lib/nodeHelpers.ts`는 현재 inflight를
import하지 않는다. `publishJobEvent`(ssePublish) import는 nodeHelpers를 쓰는
모든 소비자가 이미 inflight에 의존하는 라우트/파이프라인이므로 테스트 DB 오염
표면을 넓히지 않는다. 만약 typecheck/테스트에서 새 오염이 발견되면 inflight와
같은 콜백 조립 패턴으로 폴백한다.

**dual-emit 헬퍼의 주의:** `publishJobEvent`는 done-after-cancel 억제가 있다.
error 이벤트에는 억제가 없으므로 (`event === "done"` 조건) error 치환은
동작 불변 + envelope 추가다. progress/phase/partial 스트림 이벤트는 1단계
결정대로 raw `publish` 유지 — 전환 대상은 **terminal(error) 이벤트만**이다.
videoExtended :338의 phase 이벤트는 대상 아님.

## 단계 B — CLI 소비 전환 (`bin/lib/mcpJob.ts`)

`matchingOutcome` (:111-130)이 terminal 판정을 envelope 우선으로 바꾼다:

envelope 분기는 **progress 분기 뒤, done/error 분기 앞**에 둔다 (감사 블로커 6:
progress 콜백이 계속 도달해야 함). envelope 분기는 `terminal === true`일 때만
early-return하고, 그 외에는 기존 분기로 흘려보낸다:

```ts
// progress 분기(:115-118)는 그대로 유지. 그 다음에:
const envelope = asRecord(data.envelope);
if (envelope && envelope.terminal === true) {
  const phase = String(envelope.phase ?? "");
  if (phase === "completed") return doneResult(data);
  const envErr = asRecord(envelope.error);
  return { kind: "error", error: new McpJobError(
    typeof envErr?.code === "string" ? envErr.code
      : typeof data.code === "string" ? data.code
      : fallbackCode(phase),
    errorMessage(data)) };
}
// fallback: 기존 done/error 분기 유지 (envelope 없는 서버 호환)
```

- `cancelled`/`timed_out`/`failed` phase를 각각 `GENERATION_CANCELED`/
  `MCP_JOB_TIMEOUT`/`MCP_JOB_FAILED` 폴백 코드로 매핑. envelope.error.code가
  있으면 그것을 우선. (감사 블로커 7: MCP 발행자는 항상 code를 실으므로 폴백은
  방어선이다. cancel 시 CLI 메시지가 "MCP job failed" → "Generation canceled"로
  바뀌는 것은 의도된 개선이며 "동작 불변" 주장에서 제외한다.)
- progress 콜백은 `envelope.phase`(canonical)가 있으면 그걸 쓰고 없으면
  기존 `data.phase`.
- SSE wire에서 envelope는 `data.envelope`로 온다 (`routes/events.ts:20-22`
  formatSse가 payload 최상위에 붙임 → 파서의 event.data 안에 들어옴).

## 단계 C — UI 소비 전환 (최소 슬라이스, 감사 블로커 1 반영 재설계)

감사가 확인한 사실: `storeInflightImpl.ts`는 REST 폴링 리컨실러라 SSE
envelope가 도달하지 않는다. 실제 SSE 소비자는 `ui/src/lib/api-generation.ts`,
`nodeApi.ts` 등이다.

재설계: UI 슬라이스는 **`ui/src/lib/api-generation.ts`의 error/done 종결
판정**을 envelope 우선으로 전환한다 (CLI 단계 B와 같은 패턴: envelope.terminal
이 있으면 canonical phase로 판정, 없으면 기존 로직). eventChannel의 dispatch는
`data.envelope`를 이미 data 안에 그대로 전달하므로 (formatSse가 data에 합침)
eventChannel 수정은 불필요 — 소비자 쪽에서 읽기만 하면 된다.

범위 제한: storeInflightImpl(REST 경로), storeVideoImpl의
`planning`/`streaming` 리터럴, EVENT_TYPES 목록은 건드리지 않는다.

## 단계 D — cancel/retry/resume 계약 문서화

`structure/`에 새 문서를 만들지 않고 이슈 코멘트에 계약 형태를 기록한다:
cancel = DELETE /api/inflight/:id → error(GENERATION_CANCELED) + envelope
phase=cancelled; resume = Last-Event-ID 전역 커서 + 폴백 폴링(현행 유지);
retry = idempotency key(1단계 완료)가 generate 경로에 배선됨. jobSeq 기반
per-job 커서는 후속 결정으로 남긴다.

## 테스트

| 파일 | 변경 |
|---|---|
| `tests/job-envelope-terminal-coverage.test.ts` | [NEW] abortJob→cancelled envelope, generatePipeline fail 경로/dual-emit error 경로가 envelope를 싣는지 subscribe로 검증 |
| `tests/mcp-job-envelope-consumer.test.ts` | [NEW] matchingOutcome이 envelope terminal을 우선 소비 + envelope 부재 폴백 + progress 도달성 |
| 기존 `tests/job-envelope-contract.test.ts` | 불변 (buildEnvelope 계약 유지) |
| `docs/migration/runtime-test-inventory.md` | [MOD] 신규 테스트 2건 등록 — `node scripts/classify-tests.mjs` 재생성 (감사 블로커 3: 빠뜨리면 test:inventory 게이트가 릴리스 verify에서 실패) |

inflight를 import하는 신규 테스트는 기존 terminal-status 테스트의 임시 DB
패턴을 따른다 (`tests/job-terminal-status-contract.test.ts` 참조).

## 수용 기준

- [ ] cancel된 job의 SSE error 이벤트에 phase=cancelled envelope가 실림 (통합 테스트)
- [ ] node mode error 경로(writeNodeError)도 envelope를 실음 — node cancel이 phase=cancelled로 찍히는 것을 테스트로 고정
- [ ] CLI mcpJob이 envelope.terminal로 종료 판정 (단위 테스트)
- [ ] UI api-generation이 envelope terminal을 우선 소비 (ui build 통과)
- [ ] 전체 게이트 통과 (test:inventory 포함) + 기존 362 테스트 파일 무회귀
