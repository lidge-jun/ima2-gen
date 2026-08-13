---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, job, sse]
---

# 050 — Job 상태 계약

- work-phase: WP4 두 번째 문서
- 소비: **없음.** `040`과 병렬 가능하다 — terminal status 정규화는 공급자 데이터를
  읽지 않는다. 초안은 `040` 의존을 적었으나 A phase 감사가 그것이 장식임을
  확인했다
- 소비되는 곳: `070` doctor, `080` E2E

## 범위를 먼저 좁힌다

평가서는 "Classic·Node·Video·Agent가 공통 상태를 사용해야 한다"며 10개 상태의
단일 FSM을 제안한다. **그대로 받지 않는다.**

`003`이 실측한 어휘는 9종이고, 그중 상당수는 **정당하게 다르다.** Node의
`asset-missing`/`stale`은 그래프 노드의 자산 참조 상태이지 job 상태가 아니다.
Multimode의 `partial`/`empty`는 여러 이미지 중 일부만 온 결과 등급이다. 이것들을
하나의 job FSM으로 접으면 표현력이 사라진다.

A phase 감사도 같은 지적을 했다: UI 상태와 queue 상태까지 전부 단일 FSM이어야
한다는 **증거는 없다**.

그래서 이 phase는 **terminal status 경계 하나만** 다룬다.

## 다루는 것 — terminal status

실측된 불일치는 여기다.

| 표면 | 성공 종료 값 |
|---|---|
| `lib/inflight.ts:217` `finishJob` 기본값 | `completed` |
| `lib/mcp/commitMediaResult.ts:44` | `done` (명시적으로 넘김) |
| `bin/lib/mcpJob.ts:154` 복구 판정 | `done`만 인정 |
| `lib/db.ts:317` sprite CHECK | `complete` |
| `lib/db.ts:100` agent turns 기본값 | `complete` |

**성공 종료 호출자 실측 (P phase stale 검증).** `finishJob` 호출자를 전수
조사하면 성공 경로에서 status를 명시하는 곳은 세 군데이고(`done` 1건,
`completed` 2건), 나머지는 변수나 기본값이다.

| 호출자 | 성공 값 | CLI 복구 대상 |
|---|---|---|
| `lib/mcp/commitMediaResult.ts:44` | `done` | **예** |
| `routes/videoExtended.ts:370` | `completed` | 아니오 |
| `lib/agentQueueWorker.ts:163` | `completed` | 아니오 |
| `lib/generatePipeline.ts:622` | 변수 (`lib/generatePipeline.ts:40`에서 `completed` 초기화) | 아니오 |
| `lib/multimodePipeline.ts:561` | 변수 (`lib/multimodePipeline.ts:101`) | 아니오 |
| `lib/nodeGeneration.ts:525` | 변수 (`lib/nodeGeneration.ts:38`) | 아니오 |
| `routes/edit.ts:438` | 변수 (`routes/edit.ts:104`) | 아니오 |
| `routes/video.ts:508` | 변수 (`routes/video.ts:137`) | 아니오 |
| `lib/spriteRowPipeline.ts:26` (`finally`) | 생략 → 기본값 `completed` | 아니오 |

초판은 이 표를 세 줄로 적고 "전수"라고 주장했다. 구현 감사가 여섯 개를 더
찾았다(1라운드 blocker 1). 결론(“`done`을 쓰는 MCP 경로만 복구 대상”)은
유지되지만, 근거의 완전성 주장은 틀렸으므로 고쳐 적는다. `bin/lib/mcpJob.ts:82`가
`/api/mcp/generate` 계열에만 제출하고 MCP 성공 경로는 전부
`commitMediaResult`로 수렴하는 것이 분류의 진짜 근거다.

즉 결함은 **잠재적**이고, `e1`/`e3`은 그 잠재성을 닫는 계약 강화다.

**지금 깨지지는 않는다.** `commitMediaResult`가 `done`을 명시하기 때문이다.
그러나 그 계약을 강제하는 **타입도 테스트도 없다**. 새 MCP 라우트가
`finishJob(requestId)`를 기본값으로 부르면 그 순간 CLI 복구가 조용히 깨진다.

`003`에서 이것을 "실재하는 버그"로 적었다가 직접 확인하고 철회했다. 정당성은 더
약하지만 정직한 쪽이다: **세 글자가 다른 세 개의 성공 값이 타입 없이 문자열로
오간다.**

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `lib/jobStatus.ts` (신규) | `JobTerminalStatus` union + `normalizeTerminalStatus()`. **성공 계열**(`done`/`completed`/`complete`)을 `done`으로 정규화하고, 실패 계열은 그대로 통과시킨다 |
| `lib/inflight.ts:217` | `finishJob`의 `options.status` 타입은 **좁히지 않는다** — 아래 참조 |
| `lib/mcp/commitMediaResult.ts:44` | 문자열 리터럴 → 상수 |
| `bin/lib/mcpJob.ts:154` | `normalizeTerminalStatus()`로 판정. `completed`도 성공으로 인정 |
| `tests/job-terminal-status-contract.test.ts` (신규) | 아래 통합 경로 |

### `options.status`를 좁히지 않는 이유 (구현 감사 blocker 2)

초판은 `options.status`를 `TerminalStatus`로 좁히자고 했다. 그러면 **기존
호출자가 깨진다.** 다섯 개 파이프라인이 `let finishStatus = "completed"`로
시작해 나중에 `"error"`를 대입하므로 TypeScript는 이를 리터럴 union이 아니라
`string`으로 추론한다(`lib/generatePipeline.ts:40`, `lib/multimodePipeline.ts:101`,
`lib/nodeGeneration.ts:38`, `routes/edit.ts:104`, `routes/video.ts:137`).
`string`을 좁은 union 파라미터에 넘기면 typecheck가 실패한다.

실제로 `finishJob`에 전달되는 어휘 전체는 이렇다.

| 값 | 출처 |
|---|---|
| `done` | `lib/mcp/commitMediaResult.ts:44` |
| `completed` | `routes/videoExtended.ts:370`, `lib/agentQueueWorker.ts:163`, 다섯 파이프라인의 기본 초기값 |
| `error` | `routes/mcpMedia.ts:282` 외 파이프라인 오류 경로 |
| `canceled` | `lib/agentQueueWorker.ts:171`, 그리고 `lib/inflight.ts:217`의 `options.canceled` 우선 규칙 |
| `failed` | `lib/agentQueueWorker.ts:197` |

따라서 이 phase는 **읽는 쪽에서만 정규화한다**: `bin/lib/mcpJob.ts`가
`normalizeTerminalStatus()`로 판정하고, `finishJob`의 시그니처는 그대로 둔다.
호출자 다섯 곳을 리터럴 union으로 바꾸는 리팩터링은 이 phase의 목적(터미널
경계 계약)이 아니며, 다섯 파일의 제어 흐름을 건드리는 것은 `e4`의 회귀 0
목표와 상충한다. 타입 강화는 `085`가 다룬다.

**DB 스키마는 건드리지 않는다.** `lib/db.ts:317`의 sprite CHECK와
`lib/db.ts:100`의 agent 기본값은 각자의 도메인에서 일관되고, 마이그레이션 위험이
이득보다 크다. 정규화는 **읽는 쪽**에서 한다.

## 수용 기준

- `e1`: `bin/lib/mcpJob.ts`가 `done`과 `completed` **둘 다** 복구한다. 지금은
  `done`만 인정한다.
- `e2`: **통합 테스트가 전 구간을 잇는다.** `commitMediaResult` → inflight 스냅샷
  → CLI 복구를 실제로 태운다. 기존 replay-gap 테스트는 `{status:"done"}`을 직접
  꽂을 뿐(`tests/cli-model-resolver.test.ts:247`) 이 경계를 잇지 않는다.

  **replay gap을 강제해야 한다 (구현 감사 blocker 3).** `commitMediaResult`는
  터미널 스냅샷을 기록한 직후 live `done` 이벤트를 publish하므로, 순진하게
  `runMcpJob`을 태우면 클라이언트가 `bin/lib/mcpJob.ts:118`에서 그 live 이벤트를
  소비해 **복구 경로를 아예 타지 않는다.** 테스트는 live 터미널 이벤트를
  의도적으로 누락시키고, replay gap을 발생시킨 뒤, `listTerminalJobs()`가 만든
  실제 스냅샷을 `/api/inflight`로 제공해야 한다. 이 설계가 아니면 e2는
  통과해도 아무것도 증명하지 않는다.
- `e3`: `finishJob`을 `status` 없이 호출해도 CLI 복구가 성공한다.

  **이것은 계약 강화이지 현재 회귀가 아니다**(감사 blocker 7). 현재 MCP 성공
  경로는 전부 `commitMediaResult`를 거쳐 `done`을 명시하므로 지금 깨지는 호출자는
  없다. (status를 생략하는 현재 호출자는 sprite 정리 경로이고, 그쪽은 CLI 복구
  대상이 아니다.) 이 기준이 증명하는 것은 "새 MCP 라우트가 기본값으로 호출해도
  안전하다"이며, 실재 결함 수정이 아니다. `e1`과 `e2`가 진짜 경계 검사다.
- `e4`: **기존 동작 회귀 0** — 기존 2118개 테스트가 그대로 통과한다.

  "동작 변화 0"이라고 쓰지 않는다(A phase 2라운드 감사 blocker 6). `e1`은 복구가
  받아들이는 성공 상태를 넓히고 `e3`은 생략된 status를 다루므로 **동작은 의도적으로
  변한다.** 초록 스위트를 불변성의 증거로 제시하면 그 변화가 가려진다.

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 기본값 종료 복구 | `finishJob(requestId)`를 status 없이 부르는 MCP 라우트를 테스트에서 실행 | CLI가 성공으로 복구. **패치 전 트리에서는 이 테스트가 실패해야 한다** |
| `done` 경로 | 기존 `commitMediaResult` 경로 | 회귀 없이 복구 |
| 알 수 없는 status | `finishJob(id, {status:"weird"})` 후 CLI 복구 시도 | **런타임 판정만** 한다: `normalizeTerminalStatus()`가 성공으로 인정하지 않아 복구가 결과를 반환하지 않는다. `options`는 여전히 `any`이므로(위 "좁히지 않는 이유") 타입 거부를 주장하지 않는다 |

첫 행의 음성 대조가 핵심이다. 패치 전에 실패하지 않는 테스트는 이 phase가 무엇을
고쳤는지 증명하지 못한다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `npm run typecheck` | `lib/jobStatus.ts`, `lib/inflight.ts`, `bin/**` | include에 `lib/**`·`bin/**` 포함 — **관측함** |
| `node --test tests/job-terminal-status-contract.test.ts` | 통합 경로 | 파일 미존재 (B에서) |
| `npm test` | 회귀(`e4`) | `d2fe420`에서 2118/2116 pass |

## 미루는 것

SSE 이벤트 이름(`phase`/`partial`/`image`/`done`/`error`)의 통합, UI 상태 union
정리, `lib/eventBus.ts:3`의 `string` 타입 강화는 **하지 않는다.** 이유는
`003`에서 밝힌 대로 그것들이 다른 것이 정당한지 아직 판단할 근거가 없기
때문이다. 필요하면 `080` E2E가 실제 사용자 여정에서 어느 상태가 혼동되는지
보여준 뒤 별도 work-phase로 다룬다.
