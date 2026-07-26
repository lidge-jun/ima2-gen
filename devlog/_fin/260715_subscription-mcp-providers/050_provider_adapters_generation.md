# 050 — 구독형 provider adapter와 생성 파이프라인

> **Post-interview canonical (2026-07-16, 감사 round 3 정합).** WP5. **결과 persistence의 단일 소유자는 `routes/mcpMedia.ts`다**: executor(`executeMediaJob`)는 실행·폴링만, downloader(`downloadMediaResult`)는 temp 파일까지만 소유하고, artifact 저장·strict sidecar·thumbnail·history invalidate·`done` 발행은 mcpMedia route가 commit 순서대로 수행한다. 기존 파이프라인(`generatePipeline.ts`, `routes/video.ts`)은 WP5에서 미수정(WP8 이연). cross-provider 혼합 chain은 060 소유.

## WP5 감사 round 1 반영 (2026-07-16, FAIL 5 High → 구조 수정)

1. **Manager 호출 표면 (High 1):** `McpConnectionManager.callTool(provider, name, args, {signal})` 추가 — connected 상태 강제, AbortSignal 전파, MCP `isError` 결과를 typed error로 정규화. executor는 private session에 접근하지 않는다.
2. **전용 라우트로 단일 소유 (High 2·3 통합 해소):** `routes/video.ts`/`lib/generatePipeline.ts`를 WP5에서 확장하지 않는다. NEW `routes/mcpMedia.ts` — `POST /api/mcp/generate` (kind image|video, provider, prompt, model?, ratio?, startFrameUrl?) → 202 `{requestId}` + eventBus 진행 이벤트 → executor → downloader(temp) → **route가 유일한 persistence 소유자**: generatedDir 저장 + **strict sidecar(`atomicWriteJson`; 실패 시 media 롤백+typed error — `safeWriteSidecar`처럼 실패를 삼키는 헬퍼 금지)** + thumbnail + `invalidateHistoryIndex()` + commit 후에만 `publishJobEvent(requestId,"done")`. 기존 계약과의 동일성은 file map의 터미널 봉투/사이드카 core 필드로 고정한다.
3. **executor는 순수 실행기 (High 3):** `executeMediaJob`은 tools/call + `get_task`/`job_status` 폴링(backoff+timeout+abort)까지만 소유하고 normalized `{taskId, outputUrls[], raw…sanitized}`를 반환한다. 저장/이벤트/히스토리는 건드리지 않는다.
4. **다운로드 경계 (High 4):** `downloadMediaResult` — HTTPS-only, redirect 상한 + 매 hop 재검증, DNS/IP가 private/loopback/link-local이면 거부, stream 단위 byte 상한, content-type 검증, temp 파일 반환. **서명 URL은 어디에도 저장하지 않는다** — sidecar `providerUrl`은 query 제거한 origin+path만.
5. **UI/persistence 결합은 WP8로 명시 이연 (High 2·5 부분):** `ui/src/lib/api-generation.ts`의 Grok 강제 제출, `storeVideoImpl` provider 부재, `storePersistence`의 provider 검증, 분리 셀렉터는 WP8 결정 사항이다. WP5의 소비자는 API 직접 호출(CLI/curl)과 C-phase 실증이다. `routes/video.ts` capability guard 교체는 UI가 provider를 제출하게 되는 WP8에서 함께 수행한다(단독 교체는 무의미 — 감사 근거 채택).
6. **빌드/모듈성 (High 5):** 검증 매트릭스에 `npm run build:server` 추가. 새 코드는 전부 신규 파일(각 <500줄, 함수 <50줄)로 두고 기존 대형 파일(generatePipeline 579줄, video 519줄)은 WP5에서 미수정.

## 목적

WP1에서 official MCP schema가 확인되고 open-source MCP client 사용 조건을 통과한 Tier A provider를 기존 ima2 이미지·영상 생성 계약에 연결한다. adapter는 REST API client가 아니라 MCP tool schema를 ima2 capability로 번역하는 얇은 계층이다. 기본 범위는 Higgsfield·Runway다. Magnific은 가장 가까운 multi-model 비교군이지만 공식 문서가 제품/파이프라인에는 API를 안내하므로 open-source local MCP client 사용이 허용된다는 근거 없이는 이 phase에 진입하지 않는다. Recraft는 control image provider다. Krea·Ideogram·BFL은 동일 adapter 계약을 통과한 뒤 별도 작은 cycle로 추가할 수 있다. Pika experimental은 production adapter 범위 밖이다.

## Entry gate

- 해당 provider의 sanitized `tools/list` fixture가 존재한다.
- generation tool과 result/status tool이 식별됐다.
- 기존 plan credits 또는 별도 과금 방식이 UI copy에 확정됐다.
- output URL/embedded resource의 보존 정책이 확인됐다.

## File change map

> 2026-07-16 감사 round 2 정합화: 아래 map이 canonical이다(WP5 실행 범위). 이전 초안의 generatePipeline/multimode/node/agent/edit/video/UI MODIFY 행은 **WP8 이연 목록**으로 이동했다.

| Op | Path | 변경 |
|---|---|---|
| NEW | `lib/mcp/providerAdapter.ts` | image/video request normalization과 result polling/download interface. |
| NEW | `lib/mcp/adapters/higgsfield.ts` | **카탈로그/모델 메타데이터 매핑만**(무료 계정 — 과금 tool 호출 경로 잠금). verified tool schema만 사용. |
| NEW | `lib/mcp/adapters/runway.ts` | verified Runway generation/status/result mapping. |
| NEW | `lib/mcp/executeMediaJob.ts` | tools/call + `get_task`/`job_status` 폴링(backoff+timeout+abort), normalized `{taskId, outputUrls}` 반환. 저장/이벤트 없음. |
| NEW | `lib/mcp/downloadMediaResult.ts` | HTTPS-only, redirect 상한+hop별 private/loopback IP 거부, stream byte 상한, content-type 검증, temp 파일 반환. 서명 URL 미저장. |
| NEW | `routes/mcpMedia.ts` | `POST /api/mcp/generate` — 202 `{requestId}` + eventBus, **유일한 persistence 소유자**: temp→generatedDir 이동 + strict sidecar(`atomicWriteJson`, 실패 시 media 롤백 후 error — `safeWriteSidecar` 금지) + thumbnail + `invalidateHistoryIndex()` + commit 후에만 `publishJobEvent("done")`. 터미널 payload는 기존 봉투(`requestId, filename, url, mediaType, provider, model`) + sidecar core 필드. |
| MODIFY | `routes/index.ts` | mcpMedia route 등록. |
| MODIFY | `lib/mcp/connectionManager.ts` | `callTool(provider, name, args, {signal})` — connected 강제, abort 전파, `isError` typed 정규화. |
| NEW | `tests/mcp-provider-adapters.test.ts` | fixture별 request/result/error normalization. |
| NEW | `tests/mcp-generation-integration.test.ts` | mock MCP→download→**원자적 commit**(sidecar 실패 시 media 롤백+error, done 미발행)→터미널 봉투/사이드카 core 필드 검증. |

### WP8 이연 (UI/legacy 결합)

- `lib/generatePipeline.ts`/`lib/multimodePipeline.ts`/`lib/nodeGeneration.ts`/`lib/agentImageVideoGen.ts`/`routes/edit.ts`/`routes/video.ts` capability guard, `ui/src/types.ts` provider union, `storePersistence` 검증, `api-generation.ts` Grok 강제 제출 — 분리 셀렉터와 함께 WP8에서.
- `lib/mcp/adapters/{magnific,recraft}.ts` — 100 확장 레인. `lib/providerOptions.ts`/`lib/capabilities.ts` 노출 확장도 WP8.

## Metadata contract

```json
{
  "provider": "higgsfield-mcp",
  "providerTransport": "mcp-streamable-http",
  "providerTool": "<verified tool name>",
  "providerToolSchemaHash": "sha256:...",
  "model": "<effective model>",
  "upstreamJobId": "<safe id>",
  "providerUrl": "<non-secret canonical page or omitted>",
  "billingMode": "subscription-credits",
  "capabilitiesUsed": ["video.generate"]
}
```

signed download query와 token은 sidecar에 저장하지 않는다.

## Conditional activation scenarios

- Result URL 만료: mock URL 첫 응답이 403이면 provider result tool을 한 번 재조회하고 새 URL을 즉시 내려받는다.
- MIME mismatch: video tool이 image content-type을 반환하면 파일 쓰기 전에 `MCP_RESULT_TYPE_MISMATCH`로 실패한다.
- Partial batch: 4개 중 1개 실패 시 기존 allSettled contract로 3개를 저장하고 failure summary를 낸다.
- Schema hash mismatch: request 전에 현재 hash가 fixture/adapter hash와 다르면 tools/call을 하지 않는다.
- Cancel: provider task cancel tool이 있으면 upstream cancel; 없으면 local wait/download만 중지하고 `upstreamCancelUnsupported`를 기록한다.

## Acceptance criteria

- MCP 호출 코드는 adapter/executor 한 곳에만 존재한다. (Classic/Node/Agent/Multimode 파이프라인 통합은 WP8 이연 — WP5에서는 `/api/mcp/generate`가 유일한 소비 표면이다.)
- 생성 결과는 signed URL이 만료되기 전에 local generatedDir에 저장된다.
- 기존 history/gallery/metadata에서 MCP 산출물이 GPT/Grok 산출물과 동일하게 열린다.
- provider tool text payload가 prompt 또는 token을 log에 노출하지 않는다.
- 실제 credit을 쓰는 smoke는 사용자 승인 후 provider당 최소 image 1건/video 1건으로 제한하고 비용 전후를 기록한다.
- 모든 upstream media 호출이 official MCP `tools/call`을 거치며 provider REST endpoint 직접 호출이 없다.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
npm run build:server
node --test --import tsx tests/mcp-provider-adapters.test.ts tests/mcp-generation-integration.test.ts
npm test
npm run test:inventory
```
