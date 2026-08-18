---
created: 2026-08-18
updated: 2026-08-18
tags: [ima2-gen, devlog, platform, envelope, adapter, release]
---

# 000 — 플랫폼 계약 마감 캠페인 (#151 / #150)

## 목적

열린 이슈 2건을 구현으로 마감하고 stable 릴리스까지 배포한다.

- #151 Job Envelope: 소비자 전환 (2단계)
- #150 Provider Adapter: 2번째 adapter (atlascloud)
- 소유자 결정으로 #145(조직 이전 안 함), #152(과금 예산 미승인), #153(umbrella)은
  2026-08-18에 close됨. 이 유닛의 범위 밖.

## 조사 결과 (opus-5 독립 조사 2건, 2026-08-18)

### #151 — envelope는 소비 이전에 생산이 새고 있다

생산자는 `lib/ssePublish.ts:21`의 `publishJobEvent` 단 하나. 그런데 실제
터미널 실패 경로들은 raw `publish()`를 부른다:

| 경로 | 위치 | 이벤트 |
|---|---|---|
| cancel | `lib/inflight.ts:241` (abortJob) | error/GENERATION_CANCELED |
| classic 실패 | `lib/generatePipeline.ts:65` (fail, async) | error |
| video dual-emit | `routes/video.ts:59-65` | done만 envelope, 나머지 raw |
| multimode dual-emit | `lib/multimodePipeline.ts:70-76` | 동일 |
| multimode 검증 실패 | `lib/multimodePipeline.ts:86` | error |
| video 검증 실패 | `routes/video.ts:159` | error |
| videoExtended | `routes/videoExtended.ts:265,338,376` | error/phase |

따라서 `resolvePhase`의 `cancelled`/`failed`/`timed_out` 분기는 MCP 경로
(`routes/mcpMedia.ts:288`, `routes/mcpRecover.ts:79`) 외에는 프로덕션에서
도달 불가. `tests/job-envelope-contract.test.ts:92`가 `buildEnvelope`를 직접
불러 검사하기 때문에 CI에는 안 보인다.

소비자는 0이다. `rg 'envelope' ui/src` 0건, CLI(`bin/lib/mcpJob.ts:111-130`)는
`event.event === "done"`과 `data.phase` 문자열, 복구는 별도 어휘
`normalizeTerminalStatus`를 쓴다.

어휘 4종 병존: envelope 8-phase(`cancelled`) / inflight(`canceled`) /
jobStatus(`done|error|canceled|unknown`) / UI 임시(`planning|streaming|canceling`).

### #150 — atlascloud가 유일하게 올바른 2번째 adapter

- 인터페이스: `lib/providers/adapters/types.ts:38` (auth/models/error만 필수;
  generate/edit는 #151 계약 대기로 optional)
- 등록: `lib/providers/adapters/index.ts:15-17` factory map
- 소비자: `routes/models.ts:172-192` minimaxLane
- gemini-api는 파일 수는 적지만 이중 credential(API key + Vertex SA)이라
  AuthResult 설계 변경을 강제 → 부적합. agy는 async binary 탐지라 sync
  `validateAuth()` 부적합. grok-api는 errorPrefix를 grok과 공유. oauth/api는
  errorPrefix null이라 contract가 증명력이 없음. → atlascloud 확정.
- contract 테스트(`tests/provider-adapter-v1-contract.test.ts`)는 7/9가
  등록 adapter 자동 순회라 신규 adapter가 자동 상속. line 116의 null 단언에서
  atlascloud 제거 필요. line 54가 파일명 규약 `adapters/<laneId>.ts` 강제.
- ctx 필드는 `atlasCloudApiKey`(대문자 C), lane id는 `atlascloud`. 오타 주의.

## work-phase 지도 (의존 순서)

| WP | decade | 내용 | 의존 |
|---|---|---|---|
| wp0 | 000 | 본 로드맵 (docs-only) | — |
| wp1 | 010 | #151 소비자 전환: 생산 커버리지 + CLI/UI 소비 | — |
| wp2 | 020 | #150 atlascloud adapter + core diff 실측 | wp1과 독립 (types만 공유) |
| wp3 | 030 | dev push + stable 릴리스 컷 + 검증 | wp1, wp2 |

## 검증 게이트 (전 WP 공통)

`npm run typecheck && npm run typecheck:tests && npm run test:inventory && npm test`
+ `cd ui && npm run build` (UI 변경 시). 신규 테스트 파일 추가 시
`node scripts/classify-tests.mjs`로 `docs/migration/runtime-test-inventory.md`
재생성 필수 (현재 362 테스트 파일). 릴리스는 `npm run release:minor`
(gh workflow run release.yml) + npm-stable 환경 승인 + npm dist-tags 실측.

## OUT (금지 목록 승계)

신규 provider 추가, SSE→WebSocket, history rewrite, 새 mode, 과금 canary 배선,
ruleset 재시도, 프리셋 썸네일 배포 방식 변경.
