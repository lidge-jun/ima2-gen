# 054 — wp5 슬라이스 3: upscale 파라미터 노출 + UI/CLI (diff-level)

상위 스펙: 051 결정 1/3, 050 upscale 행. wp5d-upscale work-phase 명세.

## 스키마 확정 (runway.json snapshot, 2026-07-20)

`upscale_image`: image.url 필수, scaleFactor 2|4|8|16(기본 2, 2 초과는 flavor
sublime 필요), flavor sublime|photo|photo_denoiser, sharpen/smartGrain/
ultraDetail 0-100(기본 10/10/30). `upscale_video`: video.url만 — 파라미터 없음.

## 설계

### 1. MODIFY `lib/mcp/adapters/runway.ts` — buildRunwayActionCall

upscale-image args 확장: 입력에 `upscale?: { scaleFactor?: 2|4|8|16;
flavor?: "sublime"|"photo"|"photo_denoiser"; sharpen?: number;
smartGrain?: number; ultraDetail?: number }`를 받아 존재하는 키만 args에 추가.
scaleFactor>2 && flavor && flavor!=="sublime" → throw MCP_REQUEST_INVALID
(스키마 제약의 클라이언트 가드).

### 2. MODIFY `routes/mcpMedia.ts` — handleMediaAction

- body에 `parameters?` 수용(기존 parseMcpPresetRecord로 bounded scalar 검증 재사용 —
  단 upscale 키만 허용하는 allowlist 필터: scaleFactor/flavor/sharpen/smartGrain/
  ultraDetail; 그 외 키는 400 INVALID_MEDIA_PARAMETERS).
- image.upscale일 때만 parameters를 plan에 전달. video.upscale에 parameters가
  오면 400(스키마에 파라미터 없음 — 조용한 무시 금지).
- 커밋 meta의 mcpParameters에 upscale 파라미터 기록.

### 3. UI — MODIFY `ui/src/components/ResultActions.tsx`

- 이미지 결과 + runway 연결 시 "Upscale" 액션: 작은 파라미터 팝오버
  (scaleFactor 2/4/8/16 버튼열, flavor 3옵션, sharpen/smartGrain/ultraDetail
  슬라이더 0-100) → POST /api/mcp/media-action { action: "upscale-image",
  files: [filename], parameters }. stage/filmstrip 컨텍스트 호환(현재 카드
  액션 패턴 준용).
- 비디오 결과의 Upscale은 파라미터 없이 즉시 실행.

### 4. CLI — NEW `bin/commands/upscale.ts` (`ima2 upscale`)

- `ima2 upscale <generated-file> [--scale-factor 2|4|8|16] [--flavor ...]
  [--sharpen n] [--smart-grain n] [--ultra-detail n] [--json]`
- 파일 확장자로 kind 결정(png/jpg/webp → upscale-image, mp4/mov → upscale-video,
  video에 파라미터 주면 exit 2).
- bin/lib/mcpJob.ts의 runMcpActionJob(052에서 도입)으로 POST+SSE 대기.
- video.ts에도 `ima2 video --upscale` 같은 걸 추가하지 않는다 — 단일 진입점.

## 계약 테스트 — NEW `tests/mcp-upscale-params.test.ts`

1. plan에 scaleFactor/flavor/슬라이더 3종이 존재 시에만 포함.
2. scaleFactor 4 + flavor photo → adapter throw(MCP_REQUEST_INVALID).
3. 허용 외 parameters 키 → 400 INVALID_MEDIA_PARAMETERS.
4. video.upscale + parameters → 400.
5. 커밋 meta mcpParameters 기록.
6. CLI: mp4에 --scale-factor → exit 2; png에 정상 플래그 → body parameters 확인
   (cli-commands mock 서버 패턴).

## Activation 시나리오

- 파라미터 가드: 테스트 2-4. CLI 분기: 테스트 6.
- 라이브(최소 과금): 기존 갤러리 png를 scaleFactor 2로 image upscale 1건.
  과금 카운트: upscale 1.

## Accept

typecheck 2종 + 테스트 6건 + ui build + 라이브 1건 sidecar 증거(mcpParameters).
