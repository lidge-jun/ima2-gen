---
title: "closeout — 2026-07-26 zero-backlog 사이클"
created: 2026-07-26
lane_status: archived
---

# closeout: 260715_subscription-mcp-providers

## 이 lane이 active였던 이유

`130_current_status.md` 기준 WP1~WP8과 restart recovery는 완료였고, 남은 것은
090의 2-tier verifier와 100 provider expansion이었다.

## 이번 사이클에서 처리한 것

**Tier 1(무인증·무비용) 4종을 구현했다** — 커밋 `c3fa674`.

| 파일 | 내용 |
|---|---|
| `tests/golden/mcp-clean-install.test.ts` | G1~G5 (7건) |
| `tests/mcp-security-regression.test.ts` | SSRF/토큰유출/스키마포이즈닝/손상캐시 (8건) |
| `tests/mcp-long-job-recovery.test.ts` | 취소/tombstone/중복admission/orphan (6건) |
| `tests/mcp-provider-smoke.test.ts` | env-gated, 기본 skip |

`scripts/classify-tests.mjs` 인벤토리에 등록했고 `npm test` 기본 실행에 포함된다.
결과: 1998 tests / 1996 pass / 0 fail / 2 skipped(유료).

계획 초안이 인용한 `callDocumentedTool()`/`validateSnapshot()`은 존재하지 않는
함수였다(A-감사 적발). 실제 소유자로 교체했다 — `lib/contracts/availability.ts`,
`lib/mcp/snapshotStore.ts`, `lib/mcp/sanitizer.ts`, `lib/mcp/downloadMediaResult.ts`,
`lib/mcp/providerRegistry.ts`, `lib/inflight.ts`.

## 남은 것 — 외부 승인 필요

**Tier 2 authenticated smoke: NEEDS_HUMAN.** 실제 OAuth 연결, 유료 `tools/call`,
결과 ingest, GPT 이미지→MCP 영상 혼합 파이프라인, billing delta 기록이 전부
사용자 비용 승인 사항이다. `tests/mcp-provider-smoke.test.ts`에 절차를 주석으로
남겼고 `IMA2_MCP_LIVE_SMOKE=1` 없이는 실행되지 않는다.

**100 provider expansion(Recraft, Magnific): Tier 2 이후.** 090이 정한 순서다.

**실물 `npm pack` 설치 검증:** 이번에는 `package.json` files[] 포함 검증과 번들
스냅샷 로드로 대체했다. 실제 pack/install은 릴리스 게이트 소관.

**Tier 1 green은 lane DONE이 아니다.** 090이 명시한 대로 Tier 2 증거 없이 provider
통합을 완료로 선언하지 않는다. 이 lane을 `_fin`으로 옮기는 것은 Tier 1 구현이
끝났다는 뜻이며, 위 잔여는 `_plan/README.md`에 차단 사유로 남긴다.
