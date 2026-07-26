---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, video, ffmpeg, wp8]
status: diff-level 확정 (WP8)
---

# 031 — WP8: ffmpeg chromakey 알파 WebM async job + 프레임 프리뷰

결정: 그린 mp4는 canonical 유지, 파생 알파 WebM(VP9+alpha)을 별도 저장 (Q6).
threshold는 프레임 1장 클라이언트 프리뷰로 확정 후 서버 재인코딩 (ASSUMPTION 16).

## 전제 (코드 확인)

- ffmpeg 사용 전례: `lib/videoFrameExtract.ts:56-66` (execFile, timeout/maxBuffer/try-finally) —
  chromakey/alpha 인코딩 경로는 없음 (Mind HIGH #1).
- 프레임 추출 API: `routes/videoExtended.ts:223-241` (PNG 프레임 반환) — 프리뷰 소스로 재사용.
- async job + SSE 패턴: video 생성 경로의 `dualEmitVideo`/`setJobPhase` (`routes/video.ts:305-312`),
  `lib/inflight.ts` 잡 추적.
- `.mp4` 전제 지점들: `ui/src/lib/videoMedia.ts:23-61`, `routes/videoExtended.ts:255` —
  WebM은 **파생 에셋으로만** 취급해 이 경로들을 건드리지 않음 (continuation/extend 입력은 mp4 유지).

## 파이프라인

```
결과 카드 "배경 제거(비디오)" → 프레임 1장 추출(기존 API) → KeyingPanel 재사용(colorKey.ts, 021)
  → threshold 확정 → POST /api/video/keying  (async 202)
  → 서버 ffmpeg: mp4 → yuva420p VP9 WebM (chromakey+despill)
  → SSE progress → 완료 시 파생 에셋 등록 (022 계약 재사용)
```

## 파일 변경 맵

### NEW — `lib/videoChromaKey.ts` (~140줄)

```ts
export type VideoKeyParams = { keyColor: string /*0xRRGGBB*/; similarity: number /*0.01-1*/; blend: number /*0-1*/ };
export function mapClientParamsToFfmpeg(p: ColorKeyParams): VideoKeyParams;
// tolerance→similarity, softness→blend 매핑 (동일 프리뷰-결과 근사 계약, 문서화된 변환식)
export async function keyVideoToWebm(srcAbs: string, outAbs: string, p: VideoKeyParams,
  onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<void>;
// execFile("ffmpeg", ["-i", src, "-vf", `chromakey=0x..:${sim}:${blend},despill=type=green`,
//   "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-an", out])
// videoFrameExtract.ts 안전 관례 준수: argv 배열, timeout(10분), stderr 파싱으로 progress(frame=/time=),
//   try/finally 임시파일 정리, ENOENT → "ffmpeg not installed" 진단
```

### NEW — `routes/videoKeying.ts` (~130줄)

```
POST /api/video/keying { source: <rel mp4>, keyParams, projectId? }
  → 202 { requestId } + inflight 등록 + eventBus로 progress/done/error dual-emit
  → 완료: <basename>-keyed-<ts>.webm 저장 + 사이드카(derivedFrom, kind: keyed-webm, keyParams)
    + asset 레코드 (metadata.derivedFrom, folderId=projectId)
GET  (기존 /api/events 채널로 수신 — 신규 SSE 엔드포인트 없음)
```

등록: `server.ts` 라우트 등록부 + `routes/assetDerived.ts`의 kind에 `keyed-webm` 허용.

### MODIFY

| 파일 | 변경 |
|---|---|
| `ui/src/components/assetgen/KeyingPanel.tsx` | 비디오 타깃 지원: 프레임 추출 API로 첫 프레임 로드 → 동일 슬라이더 프리뷰 → "알파 WebM 생성" 버튼 → `/api/video/keying` 호출, SSE 진행 바 표시 |
| `ui/src/lib/api-assets.ts` | `requestVideoKeying(input)` 추가 |
| `ui/src/store/storeAssetGenImpl.ts` | keyed-webm 완료 이벤트 수신 → 파생 카드 추가 |
| `tests/video-chroma-key.test.ts` (NEW ~110줄) | `mapClientParamsToFfmpeg` 변환식 스냅샷 / `keyVideoToWebm` argv 조립 검증(fake execFile 주입) / ENOENT 진단 / route 400 케이스 (없는 source, 잘못된 params) |

## Accept criteria (WP8 C 게이트)

0. **선결 스파이크** (감사 폴드): B 착수 전 로컬 ffmpeg로 T1 mp4 1건을 실제 명령
   (`chromakey=...:despill=type=green`, `libvpx-vp9`, `yuva420p`)으로 인코딩하고
   `ffprobe`로 알파 플레인 확인 — 필터/인코더 호환이 확인되어야 래퍼 구현 시작.
   despill은 chromakey 뒤(알파 생성 후 spill 억제) 순서로 고정하고 스파이크에서 검증.
1. E2E: 크로마 비디오(WP7 산출물) → 프레임 프리뷰 threshold → WebM job 완주 (SSE progress 관측, 활성화 증거).
2. 산출 WebM: `ffprobe -show_streams`에서 `pix_fmt=yuva420p` + alpha 확인, 브라우저 재생 시 투명 배경 (체커보드 위 스크린샷).
3. 원본 mp4 무변경 + 파생 사이드카/asset 레코드(derivedFrom) 생성.
4. 실패 경로 활성화 3종: (a) ffmpeg 부재(PATH 조작) → ENOENT 진단, (b) nonzero exit
   (깨진 입력 파일 주입) → stderr 요약이 잡 에러로 전파, (c) 잘못된 필터 파라미터
   (similarity 범위 밖) → 사전 검증 400 (ffmpeg 도달 전). 각각 테스트로 구동.
5. tests 통과 + typecheck + ui build.
