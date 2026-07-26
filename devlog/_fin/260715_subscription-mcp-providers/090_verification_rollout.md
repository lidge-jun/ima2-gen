# 090 — 보안·과금·실 provider 검증과 rollout

> **Post-interview canonical (2026-07-16).** WP9. 인터뷰 Round 6에서 확정된 **2-tier verifier**의 소유 phase다: Tier 1 clean-install golden-task 하네스(fixture 배치·CI 명령 포함)와 Tier 2 authenticated smoke protocol이 여기 산다 (A-audit blocker 4 반영).

## 목적

mock green만으로 완료하지 않고 OAuth/token/과금/장시간 job/결과 보존을 실제 provider에서 최소 비용으로 검증한다. 연결별 kill switch와 rollback을 확보한 뒤 기본 UI에 노출한다.

## 2-tier verifier

### Tier 1 — clean-install golden tasks (CI, 자동, 무인증)

대상 표면은 070의 `ima2 tools` CLI다. 인증·credit 없이 재현 가능한 것만 검증한다.

| Golden task | 기대 증거 |
|---|---|
| G1 발견 | 깨끗한 `npm pack` 설치에서 `ima2 tools list --json`이 내장 + 번들 provider 계약을 `documented` 구분과 함께 반환 |
| G2 입력 구성 | `tools schema <id> --json`의 inputSchema로 유효 입력을 구성하면 로컬 validation을 통과 |
| G3 오판 방지 | `documented` tool `call` 시 upstream 호출 0회 + typed `auth_required`/`unavailable` |
| G4 drift | 변조된 snapshot hash에서 `schema_changed` 반환, stale schema 미반환 |
| G5 projection | 문서/skill 생성물이 catalog와 결정적으로 일치 |

파일: `tests/golden/mcp-clean-install.test.ts` (+ `tests/golden/fixtures/`), CI 명령은 `npm test` 기본 포함. contract-shape 검증과 값 고정 검증을 분리해 upstream 진화를 회귀로 오인하지 않는다(인터뷰 open assumption 반영).

### Tier 2 — authenticated smoke (수동/반자동 게이트, 사용자 계정)

사용자 승인 하에 실제 OAuth 연결·`tools/call`·결과 ingest·혼합 파이프라인(GPT 이미지→MCP 영상 1건)을 provider당 최소 비용으로 실행한다. 증거는 sanitized 아티팩트(`devlog` evidence 문서 + secret-free fixture)로 남긴다. 아래 Billing gate와 Fresh verification matrix가 Tier 2의 세부 절차다. Tier 2 없이 Tier 1만으로 provider 통합을 `DONE`으로 선언하지 않는다.

## File/SoT change map

### 2026-07-17 recovery coverage boundary

`120_restart_recovery/`는 별도 미래 test 파일을 만들지 않고 현재 inventory의 `tests/mcp-token-store.test.ts`, `tests/mcp-connection-manager.test.ts`, `tests/mcp-connection-routes.test.ts`, `tests/mcp-snapshot-pipeline.test.ts`, `tests/mcp-sanitizer.test.ts`, `tests/runtime-ports.test.ts`, `tests/runtime-context-normalize.test.ts`를 확장했다. 이 묶음은 0600/binding/CAS, same-binding startup restore, mismatch fail-closed, refresh/disconnect/callback race, transport close/error, stale snapshot, actual-port activation, concurrent shutdown을 소유한다.

아래 `tests/golden/mcp-clean-install.test.ts`, `tests/mcp-security-regression.test.ts`, `tests/mcp-long-job-recovery.test.ts`, `tests/mcp-provider-smoke.test.ts`는 여전히 WP9의 계획/미구현 범위다. 특히 authenticated provider smoke와 비용 발생 작업은 사용자 승인 전 실행하지 않으며, 이번 recovery closeout은 paid call 0건이다.

| Op | Path | 변경 |
|---|---|---|
| NEW | `tests/mcp-security-regression.test.ts` | SSRF, redirect, token leak, callback state, corrupt cache, schema poisoning. |
| NEW | `tests/mcp-long-job-recovery.test.ts` | timeout/restart/reconnect/orphan/cancel/replay gap. |
| NEW | `tests/mcp-provider-smoke.test.ts` | env-gated real provider smoke; default test run에서는 skip. |
| MODIFY | `scripts/classify-tests.mjs` | 새 tests inventory 등록. |
| MODIFY | `structure/03-server-api.md` | connection/generation/workflow API와 error/event 계약. |
| MODIFY | `structure/04-frontend-architecture.md` | provider registry와 capability-driven UI. |
| MODIFY | `structure/06-infra-operations.md` | dependency, config, token path, doctor/kill switch, provider 운영법. |
| MODIFY | `structure/01-file-function-map.md` | 새 MCP modules/routes/tests ownership. |
| MODIFY | `docs/API.md` | public local API와 CLI examples. |
| MODIFY | `skills/ima2/SKILL.md` | MCP provider 사용·연결·과금·fallback semantics. |
| MODIFY | `devlog/_plan/README.md` | active/complete 상태 갱신; 전 phase 완료 시 folder를 `_fin/`으로 이동. |

## Security gate

- Endpoint는 compiled allowlist만 사용한다. 사용자 임의 URL connector는 별도 future scope다.
- Remote result fetch는 HTTPS, redirect 상한, private/link-local IP 거부, size/content-type/timeout 검증을 적용한다.
- OAuth state/PKCE/redirect URI exact match를 검증한다.
- token file은 0600이며 config export/doctor/support bundle에 포함되지 않는다.
- MCP tool result의 text/URL을 log에 원문 dump하지 않는다.
- tool schema description은 데이터일 뿐 prompt/system instruction으로 실행하지 않는다.

## Billing gate

실 provider smoke는 사용자 승인 뒤 다음 순서로 한다.

1. account/credits read tool이 있으면 시작 balance를 기록한다.
2. 가장 저렴한 image 1건을 생성하고 실제 차감을 확인한다.
3. video는 provider별 1건만, 최소 허용 duration/resolution로 실행한다.
4. 실패·취소 시 차감 정책을 관찰하되 반복 호출하지 않는다.
5. 결과 문서에는 token/account id가 아닌 provider, operation, model, 시작/종료 balance delta만 남긴다.

## Rollout order

1. open-source local MCP client boundary와 official-MCP-only gate 검증.
2. hidden feature flag + CLI/status only.
3. Settings connection UI.
4. Higgsfield/Runway generation (2026-07-16 결정: 실행 pilot 2곳).
5. verified native workflows.
6. Recraft·Magnific 확장 — `100_provider_expansion.md` (Magnific은 entitlement + open-source MCP client 허용 근거 확인 후).
7. Krea/Ideogram/BFL 등 OAuth Tier A — `110_tier_a_backlog.md`.
8. HeyGen/Rendley 전문 mode는 별도 제품 결정 후 추가. Canva는 policy gate 전 disabled.
9. API-key official MCP는 secondary opt-in lane에서만 추가.
10. Pika는 experimental canary에서만 평가하고 production default에는 포함하지 않는다.

## Kill switches

- global `IMA2_MCP_PROVIDERS_ENABLED=0`.
- provider allowlist에서 개별 id 제거.
- capability별 remote disable: generation/edit/workflow.
- schema hash mismatch 시 자동 fail-closed.
- local fallback은 별도 flag로 꺼서 provider regression과 분리 진단한다.

## Fresh verification matrix

```bash
npm run typecheck
npm run typecheck:tests
npm test
npm run test:inventory
cd ui && npm run build
```

| 시나리오 | 증거 |
|---|---|
| OAuth first connect/refresh/restart/disconnect | route log tail + secret-free status fixture |
| Schema drift | changed fixture hash + disabled capability assertion |
| Image generation | local file, sidecar, history/gallery open |
| Video generation | local MP4 probe, thumbnail, SSE done |
| Native extend가 있는 provider | tools/list tool+schema, source/result lineage |
| Native extend가 없는 provider | last-frame fallback hit assertion |
| Stitch | native tool 또는 local concat임을 metadata로 구분 |
| Cancel | upstream cancel supported/unsupported 두 경로 |
| Expired URL | result refresh 1회 후 local save |
| Server restart | inflight reconcile와 orphan diagnostic |
| Mobile/desktop UI | 상태별 screenshot과 console/network clean |

## Done criteria

- 우선 provider의 실제 connection/generation smoke가 통과한다.
- token/prompt/signed URL leak scan이 0건이다.
- 비용 전후가 설명 가능하고 “무료/무제한” 같은 추측 copy가 없다.
- native workflow와 fallback이 UI·metadata·lineage에서 구분된다.
- 전체 test/typecheck/build가 green이고 현재 구조 문서가 동기화된다.
- 남은 후보는 채택/후순위/제외 사유와 재평가 조건이 적힌다.

## Pessimist record template

- 개선되지 않은 것:
- 틀린 가설:
- provider schema가 바뀐 흔적:
- 현재 방향이 틀렸음을 보여줄 증거:
- 다음 cycle에서 재검증할 조건:
