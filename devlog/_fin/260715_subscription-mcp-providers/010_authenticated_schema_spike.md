# 010 — 완전조사: 계정 요건 + 인증된 MCP schema spike

> **Post-interview canonical (2026-07-16).** 인터뷰 결정(dual namespace, ima2-owned execution, full-schema 번들, 2-tier verifier)을 전제로 한 WP1 조사 phase다. 이 phase의 sanitized snapshot은 040 번들 파이프라인의 입력이 된다.
>
> **Scope 축소 (2026-07-16 사용자 결정):** 이 phase의 실행 대상은 **Higgsfield·Runway 두 곳**이다. Runway는 사용자 유료 계정으로 연결하고, Higgsfield는 현재 계정으로 먼저 시도해 세 갈래(`schema-ok | plan-locked | auth-blocked`)로 판정한다. Recraft·Magnific spike는 `100_provider_expansion.md`로 이연됐다.

## 목적

크레딧을 쓰지 않고 Higgsfield·Runway에 연결해 실제 `tools/list`와 OAuth 흐름을 검증한다. 이 phase가 끝날 때까지 marketing page의 기능을 MCP tool 계약으로 사용하지 않는다.

## 계정/플랜 요건 매트릭스 (조사 대상)

공개 문서 기준의 현재 판단과, 이 phase에서 실증으로 확정해야 할 항목. "필요 계정"은 사용자 본인 계정이며 ima2 운영자 계정이 아니다.

| Provider | 필요 계정/플랜 (공개 문서 기준) | OAuth 방식 | 이 phase에서 실증할 것 |
|---|---|---|---|
| Higgsfield | Higgsfield 계정. MCP 페이지는 "no API key required" | 계정 OAuth (`mcp.higgsfield.ai/mcp`) | **판정 완료(2026-07-16): `schema-ok`** — 현재 사용자 계정으로 73 tools 전체 수신, 결제 불필요. 잔액 조회 tool(`balance`, `show_plans_and_credits`) 존재 확인. 상세: `011_spike_results.md` |
| Runway | Runway 계정 + 유료 plan credits (Explore Mode 제외 명시) | 계정 OAuth (`mcp.runwayml.com/mcp`), Streamable HTTP only | **판정 완료(2026-07-16): `connected-via-user-oauth`** — 14 tools 전체 수신. plan tier는 fixture로 증명 불가(사용자 진술 유료). 상세: `011_spike_results.md` |
| Magnific | 모든 유료 plan. MCP 호출은 항상 account credits 소비 명시 | OAuth 2.1 (`mcp.magnific.com`) | 무과금으로 tools/list만 가능한지, tool 목록이 공개 docs와 일치하는지 |
| Recraft | web subscription credits 계정 | OAuth (`mcp.recraft.ai/mcp`) | 공개 tool 문서와 live schema의 파라미터 단위 대조 (control fixture) |

Magnific·Recraft 행은 100 phase에서 실행한다. 이 phase에서는 두 행을 `deferred-to-100`으로 기록만 한다.

판정 기록 규칙: 각 provider에 `account-free-listable | paid-plan-required | auth-blocked | terms-blocked` 중 하나를 증거와 함께 남긴다. 사용자 계정이 없는 provider는 `auth-required`로 남기고 fake fixture를 만들지 않는다.

## Scope

### IN

- stable MCP SDK 1.x를 사용한 임시/격리 client.
- OAuth discovery, browser authorization, callback, token refresh.
- `initialize`, pagination된 `tools/list`, server instructions 수집.
- secret/result 예시를 제거한 sanitized schema artifact.
- snapshot별 provenance 기록: provider, endpoint, fetchedAt, protocol version, 계정 plan/entitlement tag, original/sanitized hash (040 번들 입력 요건).

### OUT

- `tools/call` generation 호출.
- provider selector/UI 변경.
- token을 repo artifact에 저장.
- 실제 영상/이미지 생성과 credit 소비.
- Recraft·Magnific spike와 fixture 생성, Recraft 공개 docs와 live schema의 control 대조 → `100_provider_expansion.md`로 이연 (2026-07-16).

## File change map

| Op | Path | 변경 |
|---|---|---|
| NEW | `scripts/mcp-schema-spike.mjs` | endpoint 하나에 연결해 OAuth를 완료하고 `tools/list`를 sanitize/hash하는 dev-only script. generation tool 호출은 hard deny. |
| NEW | `tests/fixtures/mcp/higgsfield-tools.sanitized.json` | 사용자가 인증을 승인한 경우에만 생성. tool name/description/inputSchema + provenance tag 보존. |
| NEW | `tests/fixtures/mcp/runway-tools.sanitized.json` | 같은 규칙의 Runway schema fixture. |
| NEW | `tests/mcp-schema-spike-contract.test.ts` | sanitizer가 token, URL query, user id, output example을 제거하고 generation call을 차단하는지 검증. |
| MODIFY | `package.json` | 구현 시점 stable `@modelcontextprotocol/sdk` 1.x를 exact pin하고 test inventory에 새 test를 등록. |

## Before → after

- Before: `devlog/_fin/260531_video-provider-expansion/00_research.md`에 exact schema처럼 적힌 값이 있으나 authenticated `tools/list` artifact가 없다.
- After: 각 pilot provider에 대해 endpoint, protocol version, tool schema hash, tool 목록, capability 판정, 조사 시각이 증거 파일로 남는다. secrets와 account content는 남지 않는다.

## 안전 규칙

- OAuth token은 `${IMA2_CONFIG_DIR}/mcp-spike/<provider>.json`에 0600으로 저장하고 artifact 생성 후 삭제 가능해야 한다.
- script는 allowlist method `initialize`, `notifications/initialized`, `tools/list`, `ping`만 허용한다.
- `tools/call`, resources read, prompts read를 호출하면 process가 실패해야 한다.
- callback state/PKCE verifier 불일치는 token exchange 전에 거부한다.
- browser URL과 log에 access/refresh token을 출력하지 않는다.

## Acceptance criteria

0. 계정/플랜 요건 매트릭스의 "실증할 것" 열이 provider별 판정값과 증거로 채워진다.
1. 두 pilot endpoint(Higgsfield·Runway)의 unauthorized response와 OAuth metadata를 기록한다.
2. 사용자가 승인한 provider는 `tools/list` 전체 페이지를 받는다.
3. Higgsfield 계정 판정이 `schema-ok | plan-locked | auth-blocked` 중 하나로 증거와 함께 기록되고, plan-locked/auth-blocked인 경우 사용자 결제 후 재실행 절차가 명시된다.
4. Higgsfield/Runway에서 `extend`, `stitch`, `reframe`, `upscale`, `edit`, `history`, `task/status/cancel` 계열 tool의 존재/부재를 이름과 schema로 판정한다.
5. schema fixture와 로그에 bearer token, refresh token, email, account id, signed output URL이 없다.
6. generation tool 차단 테스트가 실제로 `MCP_SPIKE_MUTATION_DENIED`를 발생시킨다.

## Verification

```bash
npm run typecheck:tests
node --test --import tsx tests/mcp-schema-spike-contract.test.ts
node scripts/mcp-schema-spike.mjs --provider runway --list-only
```

Higgsfield/Runway 명령은 사용자의 OAuth 승인과 해당 account entitlement가 있을 때만 실행한다. 승인하지 않은 상태는 `auth-required`로 남기며 fake fixture를 만들지 않는다. Recraft·Magnific·Pika 등 나머지 provider는 100번대 확장 레인에서 다룬다.
