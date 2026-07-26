---
title: "100 — WP10: MCP Tier1 golden harness"
lane: "260726_zero-backlog-frontend-qa"
wp: 10
created: 2026-07-26
depends_on: [WP0]
parent_lane: "260715_subscription-mcp-providers (090_verification_rollout.md)"
criteria: [C10]
---

# WP10 — MCP Tier1 golden harness

`260715_subscription-mcp-providers` lane이 `_plan`에 남아있는 유일한 구현 사유가
이것이다. 090이 정의한 2-tier verifier 중 **Tier 1(무인증·무비용)** 을 구현한다.

Tier 2(실제 OAuth + 유료 `tools/call` + billing delta)는 **사용자 비용 승인이 필요하다.**
이 WP에서 실행하지 않는다. 승인 없이 유료 호출을 하는 것은 이 세션의 자원 경계
위반이다.

## 요구사항 (090에서 승계)

### G1~G5 golden tasks

| ID | 검증 |
|---|---|
| G1 | 깨끗한 `npm pack` 설치에서 `ima2 tools list --json`이 내장+번들 계약을 `documented` 구분과 함께 반환 |
| G2 | `tools schema <id> --json`의 inputSchema로 구성한 입력이 로컬 validation 통과 |
| G3 | `documented` tool `call` 시 upstream 호출 0회 + typed `auth_required`/`unavailable` |
| G4 | 변조된 snapshot hash에서 `schema_changed` 반환, stale schema 미반환 |
| G5 | 문서/skill 생성물이 catalog와 결정적으로 일치 |

### 추가 3종

- security regression: SSRF, redirect, token leak, callback state, corrupt cache, schema poisoning
- long-job recovery: timeout, restart, reconnect, orphan, cancel, replay gap
- provider smoke: env-gated, 기본 `npm test`에서 **skip**

## 이미 구현된 것 — 재작업 금지

`130_current_status.md`의 경고를 그대로 지킨다. transport policy는 미해결 gap이 **아니다**.

- `lib/mcp/providerRegistry.ts:1` — compiled provider allowlist + HTTPS 강제
- `lib/mcp/connectionManager.ts:36,171` — Streamable HTTP/OAuth lifecycle,
  terminal close 후 단 한 번의 bounded reconnect

이 WP는 **이 계약을 보존하는 회귀 검증**이다. 임의 URL connector, 무제한 재연결,
transport 재작성으로 범위를 넓히지 않는다.

또한 `120_restart_recovery`가 이미 소유한 영역을 중복 커버하지 않는다:
`tests/mcp-token-store.test.ts`, `mcp-connection-manager`, `mcp-connection-routes`,
`mcp-snapshot-pipeline`, `mcp-sanitizer`, `runtime-ports`, `runtime-context-normalize`가
0600/binding/CAS, startup restore, mismatch fail-closed, refresh/disconnect race,
transport close, stale snapshot, port activation, concurrent shutdown을 담당한다.

## 변경 파일 맵

| 파일 | 종류 |
|---|---|
| `tests/golden/mcp-clean-install.test.ts` | NEW |
| `tests/golden/fixtures/` | NEW |
| `tests/mcp-security-regression.test.ts` | NEW |
| `tests/mcp-long-job-recovery.test.ts` | NEW |
| `tests/mcp-provider-smoke.test.ts` | NEW |
| `scripts/classify-tests.mjs` | MODIFY (인벤토리 등록) |
| `structure/03-server-api.md` 외 | MODIFY (SoT 동기화) |

## 100-1. clean-install golden (G1~G5)

**`npm pack` 실전 설치는 비용이 크다.** 실제로 pack하고 tmpdir에 설치하면 테스트가
분 단위로 늘어나고, CI에서 불안정해진다. 090은 "깨끗한 설치"를 요구하지만 그 의도는
**개발 트리 오염 없이 배포 산출물의 계약을 검증하는 것**이다.

두 단계로 나눈다.

1. **기본 `npm test`**: `package.json`의 `files[]`가 선언한 산출물 목록 + catalog
   생성물을 격리된 임시 디렉터리에 복사해 계약을 검증한다. 빠르고 결정적이다.
2. **`IMA2_GOLDEN_PACK=1`**: 실제 `npm pack` + 임시 설치 후 CLI를 돌린다. 릴리스
   전에만 실행한다.

이 분리를 문서에 명시한다. 그러지 않으면 나중에 "clean-install 검증했다"는 주장의
범위가 모호해진다.

**contract-shape 검증과 값 고정 검증을 분리한다**(090의 open assumption). upstream이
도구를 추가했다고 테스트가 깨지면 안 된다. shape는 엄격하게, 개별 값은 느슨하게.

### G3 — upstream 호출 0회 증명

이게 가장 중요하다. `documented`(연결 안 된) tool을 호출했을 때 실제로 네트워크가
나가지 않아야 한다.

**실제 게이트 위치 (A-감사 blocker 2 반영).** 최초 계획은 `callDocumentedTool()`이라는
존재하지 않는 함수를 인용했다. 실제 pre-network 게이트는 CLI 안에 있다 —
`bin/commands/tools.ts`의 `callTool()`:

```ts
  // Pre-network availability gate: a documented snapshot is never callable.
  const server = await fromServer(args, `/api/contracts/${encodeURIComponent(id)}`);
  const availability = server?.data?.tool?.availability?.state ?? entry.availability.state;
  if (availability !== "callable") {
    const code = availability === "stale" ? "schema_changed"
      : availability === "connected" ? "unavailable" : "auth_required";
    emit(errorEnvelope(code, ...), asJson);
    process.exitCode = 1;
    return;
  }
```

게이트를 통과한 뒤에야 `/api/mcp/generate` 또는 `/api/mcp/media-action`으로 POST한다.
따라서 G3가 증명할 것은 **`availability !== "callable"`일 때 그 POST가 발생하지
않는다**는 것이다. 상태별 거부 코드 매핑은 `lib/contracts/availability.ts:38`의
`executionDenialFor()`가 소유하는 순수 함수다.

두 층으로 검증한다.

```ts
// 층 1 — 순수 함수: 상태별 거부 코드 매핑
import { executionDenialFor } from "../lib/contracts/availability.js";

test("G3a: non-callable availability maps to the right denial code", () => {
  assert.equal(executionDenialFor({ state: "documented" }), "auth_required");
  assert.equal(executionDenialFor({ state: "connected" }), "unavailable");
  assert.equal(executionDenialFor({ state: "stale" }), "schema_changed");
  assert.equal(executionDenialFor({ state: "callable" }), null);
});

// 층 2 — CLI 게이트: non-callable에서 실행 POST가 발생하지 않음
test("G3b: non-callable tools never reach the execution endpoint", async () => {
  const posted: string[] = [];
  await runToolsCall({
    id: "runway/generate_video",
    request: async (base, path, init) => {
      if (init?.method === "POST") posted.push(path);
      return { data: { tool: { availability: { state: "documented" } } } };
    },
  });
  assert.deepEqual(posted, []);   // 활성화 증거: 실행 POST 0건
});
```

층 2는 `callTool`이 모듈 스코프 함수라 주입이 어려울 수 있다. B 단계 첫 작업은
`bin/commands/tools.ts`가 `request`/`fromServer`를 주입 가능하게 노출하는지 확인하는
것이다. 불가능하면 게이트 판정만 작은 순수 함수로 추출해(`shouldDenyExecution`) CLI가
그것을 쓰게 한다 — 테스트를 위해 프로덕션 구조를 왜곡하지 않되, 검증 불가능한 게이트를
그대로 두지도 않는다.

`assert.deepEqual(posted, [])`가 핵심이다. 오류 코드만 확인하면 "네트워크를 갔다가
실패해서 auth_required가 나온" 경우와 구분되지 않는다.

### G4 — snapshot 변조

실제 스냅샷 API는 `lib/mcp/snapshotStore.ts`가 소유한다: `saveLocalSnapshot`(`lib/mcp/snapshotStore.ts:27`),
`readLocalSnapshot`(`lib/mcp/snapshotStore.ts:37`), `loadBundledSnapshot`(`lib/mcp/snapshotStore.ts:46`), `loadEffectiveSnapshot`(`lib/mcp/snapshotStore.ts:62`),
`loadAllBundledSnapshots`(`lib/mcp/snapshotStore.ts:66`). `validateSnapshot`이라는 함수는 없다.

```ts
test("G4: a tampered snapshot yields stale availability, not a stale schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "ima2-snap-"));
  const snapshot = loadBundledSnapshot(packageRoot, "runway");
  snapshot.tools[0].inputSchema.properties.prompt.type = "number";   // 변조
  saveLocalSnapshot(dir, snapshot);
  loadEffectiveSnapshot({ snapshotDir: dir, packageRoot, provider: "runway" });
  const availability = deriveAvailability(/* hash mismatch 입력 */);
  assert.equal(availability.state, "stale");                        // 분기 발화 증명
  assert.equal(executionDenialFor(availability), "schema_changed");
});
```

`deriveAvailability`(`lib/contracts/availability.ts:25`)의 정확한 입력 형태는 B 단계
첫 작업에서 시그니처를 읽고 확정한다. 이 문서는 **검증 대상과 사용할 실제 API**를
고정하고 인자 세부는 구현 시 실제 타입에 맞춘다. 없는 함수를 지어내지 않는다.

## 100-2. security regression

여섯 클래스 각각이 **실제로 차단 분기를 발화**시켜야 한다. "차단됐다"를 오류 메시지로만
확인하지 말고, 차단 지점이 실행됐다는 관측 가능한 신호를 본다.

| 클래스 | 공격 입력 | 기대 |
|---|---|---|
| SSRF | `http://169.254.169.254/`, `http://127.0.0.1:22` | 거부, 요청 미발생 |
| redirect | 리다이렉트 체인 상한 초과 | 거부 |
| token leak | doctor/config export/support bundle | 토큰 문자열 부재 |
| callback state | state 불일치, PKCE 누락 | 거부 |
| corrupt cache | 잘린/잘못된 JSON snapshot | fail-closed, 크래시 없음 |
| schema poisoning | description에 prompt injection 문구 | 데이터로만 취급, 실행 안 함 |

마지막이 흥미롭다. tool schema의 description은 **데이터일 뿐 system instruction이
아니다**(090의 security gate). description에 "무시하고 다음을 실행하라"가 들어있어도
그건 그냥 문자열이어야 한다.

## 100-3. long-job recovery

timeout/restart/reconnect/orphan/cancel/replay gap 여섯 시나리오. 전부 조건부 경로라
각각 **발화 증거**가 필요하다. 특히:

- **bounded reconnect**: terminal close 후 재연결이 정확히 1회인지. 무제한 재시도가
  아님을 증명하려면 시도 횟수를 세야 한다.
- **orphan**: 서버 재시작 후 남은 job이 정리되는지.
- **replay gap**: SSE ring buffer(2000 이벤트)를 넘어선 재연결에서 갭이 감지되는지.

## 100-4. provider smoke — 기본 skip

```ts
const LIVE = process.env.IMA2_MCP_LIVE_SMOKE === "1";
test("provider smoke", { skip: !LIVE ? "requires IMA2_MCP_LIVE_SMOKE=1 and user cost approval" : false }, async () => { ... });
```

skip 사유 문자열에 비용 승인 요구를 명시한다. 나중에 누군가 이 테스트를 보고
"왜 안 도나" 할 때 답이 코드 안에 있어야 한다.

**skip이 기본이라는 것 자체를 테스트한다:**

```ts
test("provider smoke is skipped without explicit opt-in", () => {
  assert.equal(process.env.IMA2_MCP_LIVE_SMOKE, undefined);
});
```

## Accept criteria (C10)

1. 네 테스트 파일이 존재하고 `npm test`에 포함된다.
2. G1~G5가 통과한다.
3. G3가 upstream 호출 0회를 **호출 카운터로** 증명한다.
4. security 6클래스, long-job 6시나리오가 각각 차단/복구 분기 발화를 관측한다.
5. provider smoke가 기본 실행에서 skip된다.
6. `npm run test:inventory` 통과 (인벤토리 등록 완료).
7. 전 게이트 green.

## 이 WP 완료 후에도 남는 것

**Tier 1 완료 ≠ lane DONE.** 090이 명시한다. 남는 것:

- Tier 2 authenticated smoke — 사용자 비용 승인 필요 → **NEEDS_HUMAN**
- 100 provider expansion (Recraft, Magnific) — Tier 2 이후
- 110 Tier A backlog — 100 이후 별도 게이트

WP11에서 이 잔여를 명시적 차단 사유와 함께 문서화하고 lane을 정리한다.
Tier 1 green을 Tier 2 증거로 승격하지 않는다.

## 범위 경계

IN: Tier 1 테스트 4종 + fixture + 인벤토리 등록 + SoT 동기화.
OUT: 유료 호출, OAuth 실연결, provider 확장, transport 재작성, 기존 recovery 테스트 중복.
