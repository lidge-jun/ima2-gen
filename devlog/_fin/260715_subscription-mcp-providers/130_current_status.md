---
created: 2026-07-18
updated: 2026-07-18
status: active — implementation closeout complete; verification and expansion remain
tags: [ima2-gen, mcp, providers, verification, rollout, resume]
aliases: [subscription mcp current status, 구독형 MCP 현재 상태, MCP provider resume]
---

# 130 — 구독형 MCP provider 현재 상태와 재개 안내

> **2026-07-18 closeout-sweep 기준.** WP1~WP8과 restart recovery는 구현 완료이며, 이 parent lane을 계속 active로 두는 이유는 WP9의 2-tier verifier와 후속 provider 확장에 있다. 구현 완료와 실제 유료 provider 검증을 혼동하지 않는다.

## 현재 상태

| 범위 | 상태 | 근거 / 다음 경계 |
|---|---|---|
| WP1~WP8: catalog → runtime → snapshot → adapter → workflow → UI | 완료 | 구현 receipt: catalog `91f0a33b`, runtime `706c5870`, snapshot `3f382d90`, adapter `512bfc79`, workflow `dbd5385c`, UI `6b07145b`. 재구현 대상이 아니다. |
| capability contract-catalog 요약 및 MCP config | 완료 | 2026-07-18 `0cc560d`; `config.js`에 `mcp.enabledProviders`, `mcp.tokenDir`, `mcp.snapshotDir`을 반영했다. |
| 120 restart recovery | 완료 | `716fdbb`/`53656b5`/`4b15ec7`/`a9b70e1`; committed-tree MCP 138/138, focused lifecycle/port 55/55. receipt는 `120_restart_recovery/000_plan.md:72` 이하에 있다. |
| 090: Tier 1 golden harness 4종 | 미구현 | `tests/golden/mcp-clean-install.test.ts`, `tests/mcp-security-regression.test.ts`, `tests/mcp-long-job-recovery.test.ts`, `tests/mcp-provider-smoke.test.ts`가 아직 계획 범위다 (`090_verification_rollout.md:35`). |
| 090: Tier 2 authenticated/billing smoke | 미실행 | 실제 OAuth, `tools/call`, result ingest, GPT 이미지→MCP 영상 혼합 smoke와 billing before/after 증거가 없다. Tier 1만으로 `DONE` 선언 불가 (`090_verification_rollout.md:25`, `:115`). |
| 100: Recraft·Magnific 확장 | 미착수 | provider별 live schema, entitlement/약관, snapshot, adapter, smoke가 남아 있다 (`100_provider_expansion.md:17`). |
| 110: Tier A/specialist | gated backlog | Krea·Ideogram·BFL 및 specialist 후보는 100 이후 별도 진입 게이트를 만족할 때만 시작한다 (`110_tier_a_backlog.md:1`). |

> [!WARNING]
> **이미 구현된 것을 다시 만들지 말 것.** transport policy는 미해결 gap이 아니다. `lib/mcp/providerRegistry.ts:1`의 compiled provider allowlist와 HTTPS 강제, `lib/mcp/connectionManager.ts:36,171`의 Streamable HTTP/OAuth lifecycle 및 terminal close 뒤 단 한 번의 bounded reconnect가 이미 구현돼 있다. 새 작업은 이 계약을 보존하는 회귀 검증이어야 하며, 임의 URL connector·무제한 재연결·별도 transport 재작성으로 범위를 넓히지 않는다.

## 남은 작업 — 의존성 순서

1. **Tier 1 golden harness 4종을 구현한다.**
   - clean-install G1~G5를 `tests/golden/mcp-clean-install.test.ts`와 fixture로 고정한다.
   - security regression(SSRF/redirect/token leak/callback state/corrupt cache/schema poisoning), long-job recovery(timeout/restart/reconnect/orphan/cancel/replay gap), env-gated provider smoke를 각각 추가한다.
   - inventory 등록과 CI 기본 `npm test` 포함 여부를 함께 갱신한다. real provider smoke는 기본 실행에서 skip이어야 한다.
2. **Tier 2 authenticated smoke를 실행한다 — 사용자 비용 승인 후에만.**
   - 이것은 명시적 사용자 승인 없이는 시작하지 않는다. OAuth와 실제 `tools/call`, image/video 생성은 credit을 소비할 수 있다.
   - 승인 뒤 provider별 최소 호출로 시작/종료 balance, operation/model, 실제 차감, result ingest, GPT 이미지→MCP 영상 1건의 sanitized 증거를 남긴다. token/account ID는 기록하지 않는다.
   - Tier 1 green은 Tier 2의 대체물이 아니다. Tier 2 증거가 있어야 provider 통합을 `DONE`으로 선언할 수 있다.
3. **100 provider expansion: Recraft, Magnific 순으로 진행한다.**
   - 각 provider에서 공식 문서와 live schema/entitlement/약관을 다시 대조한 뒤, registry → sanitized snapshot → adapter matcher → media workflow projection → Tier 1/Tier 2 증거 순으로 확장한다.
   - core route/CLI/UI 분기문을 늘리지 않고 catalog 파생 구조를 유지한다. 110 backlog는 이 단계가 끝나고 각 provider의 별도 gate를 통과할 때만 연다.

## 재개 절차와 검증 게이트

1. 시작 전 `090_verification_rollout.md`와 이 문서의 경계를 읽고, 이미 완료된 runtime/transport/recovery 파일을 변경 대상으로 잡지 않는다.
2. Tier 1의 네 테스트 파일과 필요한 fixture/inventory만 작은 단위로 구현한다. 무인증 테스트는 network·credential·유료 호출 없이 재현 가능해야 한다.
3. 변경 범위에 맞춰 `npm run typecheck`, `npm run typecheck:tests`, `npm run test:inventory`, `npm test`를 실행한다. UI를 변경한 경우에만 `cd ui && npm run build`를 추가한다.
4. Tier 1의 G1~G5와 security/long-job/skip 계약을 모두 통과한 evidence를 남긴다. 여기까지의 결과는 **Tier 1 complete**이지 lane `DONE`이 아니다.
5. Tier 2 직전에 비용·인증 실행에 대한 사용자의 명시적 승인을 다시 받는다. 승인 후 Billing gate의 시작 balance → 최소 image → provider당 최소 video → 종료 balance 순서를 지키고, 실패/취소에서 반복 호출하지 않는다.
6. Tier 2의 real tool call, result ingest, 혼합 파이프라인과 billing delta가 모두 sanitized 증거로 남은 뒤에만 100 확장 또는 parent closeout 판단으로 진행한다.

## 재개 시 확인할 SoT

- verifier와 비용 게이트: `090_verification_rollout.md`
- provider 확장 절차: `100_provider_expansion.md`
- Tier A/specialist 진입 게이트: `110_tier_a_backlog.md`
- recovery 구현 receipt와 검증 수치: `120_restart_recovery/000_plan.md:72`
