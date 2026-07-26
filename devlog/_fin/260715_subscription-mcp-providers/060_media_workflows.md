# 060 — provider-native 미디어 workflow, local fallback, 혼합 파이프라인

> **Post-interview canonical (2026-07-16).** WP6. **혼합 파이프라인(cross-provider chain)의 단일 소유자다** (A-audit blocker 4): GPT/Grok 이미지 → MCP provider I2V, MCP 영상 → 다른 provider stitch 같은 chain은 이 phase의 lineage(`lib/videoContinuity.ts`, `lib/videoSeriesChain.ts`) 계약 위에서 정의되며, 각 단계의 결과 ingest 자체는 050 계약을 재사용한다. 혼합 chain의 accept 기준: 어떤 provider 조합이든 parent/root/series/input lineage가 복원되고 중간 산출물이 다음 단계의 유효 입력으로 검증된다.

## WP6 감사 round 1 반영 (2026-07-16, FAIL 4 High → canonical 재정의)

**Canonical file map (WP6 실행 범위— 아래 map이 이전 초안의 mediaActions/videoExtended/UI 행을 대체한다. UI·videoExtended 통합은 WP8):**

| Op | Path | 변경 |
|---|---|---|
| NEW | `lib/mcp/mediaWorkflowRouter.ts` | 순수 결정표 `resolveMediaAction({operation, provider, liveTools})` → native/fallback/unavailable + plan. **callable은 provider가 아니라 tool 단위**: live snapshot에서 해당 tool 존재+schemaHash 일치일 때만 native. |
| NEW | `lib/videoConcat.ts` | `videoChromaKey.ts:93-130`의 cancellable `execFile` 패턴 재사용. 입력 개수(≤12)/파일당·합계 byte 상한/duration 상한, 번호 붙은 temp, `finally` 정리, timeout, typed `FFMPEG_UNAVAILABLE`·`CONCAT_NORMALIZE_REQUIRED`. stream-copy 우선, ffprobe로 codec/container 호환 검증. |
| NEW | `lib/mcp/adapters/runwayUpload.ts` | init_upload(filename/fileSize/mimeType) → PUT(각 part etag 필수) → complete_upload. **모든 PUT URL에 다운로드와 동일한 public-HTTPS/DNS/IP 검증 + redirect 금지 + timeout + streamed 업로드** (hostile MCP 응답의 로컬 파일 유출 차단). |
| MODIFY | `lib/mcp/downloadMediaResult.ts` | `assertPublicHttps` export (upload와 공유). |
| MODIFY | `routes/mcpMedia.ts` | (a) `/api/mcp/generate`에 `startFrameFilename` — `lib/videoFrameExtract.ts:16-36`의 realpath/symlink 컨테인먼트 헬퍼 재사용 + regular file + 확장자/byte 상한 검증 후 업로드, sidecar에 **generic `parent: {filename, mediaType, role:"start-frame"}` 필드**(videoContinuity의 clip 의미론은 이미지 부모에 부적합 — 감사 4 채택). (b) NEW `POST /api/mcp/media-action` — router plan 디스패치: `stitch`(local concat), `upscale-video`/`upscale-image`/`edit-video`(native runway, 050 executor+persistence 재사용). |
| NEW | `tests/mcp-media-workflow-router.test.ts` | 결정표 진리표: native 부재 시 fallback 정확히 1회+native 호출 0, tool 단위 callable(누락/drift tool은 native 불가). |
| NEW | `tests/video-concat.test.ts` | codec mismatch→normalize-required, 순서 보존, 정리, abort, ffmpeg 부재. |
| NEW | `tests/mcp-media-action.test.ts` | upload arg 매핑(fixture schema 대조), startFrameFilename 컨테인먼트(탈출 경로 400), parent lineage sidecar, media-action 디스패치. |

혼합 chain lineage 계약: sidecar `parent` 필드로 parent/root를 복원한다(videoContinuity는 video-to-video 연속에만 유지). C-phase 실증: 실제 GPT 생성 갤러리 이미지 → upload → seedance-2 I2V → parent sidecar 확인.

## 목적

MCP가 실제 제공하는 편집 도구를 ima2 action으로 연결하고, 없는 기능은 현재 local primitive로 안전하게 보완한다. marketing page에만 있는 기능은 노출하지 않는다.

## Operation selection

```text
user action
  -> capability registry
     -> native MCP tool (verified)
     -> frame continuation fallback (last frame -> I2V)
     -> local deterministic media op (ffmpeg concat/trim)
     -> unavailable + reason
```

## File change map

> Canonical map은 위 "WP6 감사 round 1 반영" 섹션이다. 이전 초안의 mediaActions/videoExtended/videoContinuity/videoSeriesChain/UI 행은 WP8 또는 후속 사이클로 이연됐다(§WP8 이연 참조). 추가 확정(round 2): **executor 시밍** — `lib/mcp/executeMediaJob.ts`에 공유 `executeMediaPlan(manager, adapter, plan, opts)`(submit→taskId→poll 공통 경로)를 추출하고, runway adapter에 `buildActionCall(action, inputs)`(`upscale_video`/`upscale_image`/`edit_video` — runway-hosted URL 입력)를 추가한다. `/api/mcp/media-action`의 native 경로는 로컬 파일을 runwayUpload로 올린 뒤 action plan을 실행한다.

### WP8/후속 이연 (구 초안 행)

- `routes/videoExtended.ts` 통합, `videoFrameExtract`/`videoContinuity`/`videoSeriesChain` 확장, `ResultActions`/`storeVideoImpl` UI — WP8.
- `tests/videoExtendedRoute.test.ts` 확장 — WP8.

## Native 기능 gate

- Higgsfield AI Video Extender 제품이 존재한다는 사실만으로 `video.extend.native`를 켜지 않는다.
- Runway Workflow의 Stitch node가 존재한다는 사실만으로 MCP `video.stitch`를 켜지 않는다.
- provider `tools/list`에 tool이 있고 input schema가 adapter matcher를 통과해야 켠다.
- natural-language agent tool 하나만 제공하는 provider는 deterministic field mapping이 검증되지 않으면 editor lane으로 분리한다.

## Fallback contract

- `video.continue.frame`: 현재 source의 local MP4를 검증하고 마지막 프레임 PNG를 추출해 같은 provider의 I2V start frame으로 보낸다.
- `video.stitch`: local ffmpeg concat은 codec/container가 호환될 때 stream-copy를 우선하고, 불일치 시 명시적 normalize policy가 있을 때만 transcode한다.
- `video.reframe`: 단순 crop/resize와 generative outpaint를 다른 action으로 표시한다.
- fallback은 provider-native라고 metadata에 기록하지 않는다.

## Conditional activation scenarios

- Native tool absent: fixture에서 extend tool을 제거했을 때 frame fallback이 정확히 1회 실행되고 native tools/call은 0회여야 한다.
- Corrupt parent: MP4 header/probe 실패 시 frame extraction과 provider call 모두 시작하지 않는다.
- Multi-input stitch mismatch: 서로 다른 FPS/audio layout에서 silent corruption 대신 normalize-required error 또는 계획된 transcode가 실행된다.
- Cancel during upload/poll/download/ffmpeg: 각 phase에서 temp와 inflight가 정리되고 done이 발행되지 않는다.
- Orphan output: media file 저장 성공 후 lineage write 실패 시 diagnostic과 repair pointer를 남긴다.

## Acceptance criteria

- 사용자가 AI 연장과 단순 합치기를 구분할 수 있다.
- provider-native와 fallback 결과 모두 parent/root/series/input lineage를 복원할 수 있다.
- native tool이 사라져도 unrelated generation은 계속 동작한다.
- local concat은 원본 순서를 보존하고 산출물 duration이 허용 오차 안에 있다.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
npm run build:server
node --test --import tsx tests/mcp-media-workflow-router.test.ts tests/video-concat.test.ts tests/mcp-media-action.test.ts
npm test
```
