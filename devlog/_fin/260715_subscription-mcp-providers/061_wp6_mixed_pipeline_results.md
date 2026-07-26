# 061 — WP6 실증 결과: 혼합 파이프라인 + workflow 라우터

실행일: 2026-07-16 (야간 HOTL 2차, WP6 C-phase).

## 혼합 파이프라인 실증 (GPT 이미지 → Runway I2V)

| 단계 | 내용 | 증거 |
|---|---|---|
| 입력 | 사용자 갤러리의 실제 GPT(oauth) 생성 이미지 `1784131394336_776db756_0.png` ("모에화 지피짱") | sidecar provider=oauth |
| 컨테인먼트 | `safeGeneratedFilePath` realpath 검증 통과 (탈출 경로는 테스트로 400 고정) | tests/mcp-media-action |
| 업로드 | `init_upload`(text-only 응답: uploadId + presigned S3 PUT URL) → PUT(etag) → `complete_upload` | **실 응답 shape 판명**: structuredContent 없음, uploadId는 `(uploadId: <uuid>)` 텍스트, PUT URL은 curl 예제 안 presigned URL(`X-Amz-*`) — 파서를 이에 맞게 수정(1회 실패 `MCP_UPLOAD_INIT_INVALID` 후) |
| 생성 | seedance-2 I2V, `startFrame` = runway-hosted URL | task `5f875e43-cbe7-…` |
| 결과 | `1784137974313_ee7d841b_mcp.mp4` + 썸네일 + strict sidecar | **`parent: {filename: 1784131394336_776db756_0.png, mediaType: image, role: start-frame}`** — 혼합 chain lineage 복원 가능 (c5 충족) |

## Workflow 라우터 (tool 단위 callable)

- 결정표 테스트 11/11: extend/stitch는 fallback 고정(011 판정 — native 호출 0), upscale/edit는 live tool 존재+schema 일치 시에만 native, drift 시 unavailable(fallback 승격 금지), reframe은 unavailable.
- `/api/mcp/media-action` 신설: stitch(local ffmpeg concat, ≤12 입력, stream-copy, mismatch 시 `CONCAT_NORMALIZE_REQUIRED`), upscale-image/upscale-video/edit-video(native runway — upload→plan→poll→commit, `parent` lineage).
- 업로드 경계: 모든 presigned PUT URL에 다운로드와 동일한 public-HTTPS/IP 검증 + redirect 금지 + etag 필수.

## 운영 발견

1. **exec 세션 종료 시 백그라운드 서버가 정리됨** — nohup/disown도 무효. 관리형 exec 세션 유지 방식만 유효(codexclaw 백그라운드 실행 규약과 일치).
2. init_upload가 ChatGPT 전용 안내문을 반환 — provider가 특정 host를 가정한 응답 텍스트를 보냄. 파서는 구조/텍스트 양쪽을 tolerant하게 처리해야 함(agent-facing 계약 관점에서 070 문서에 교훈 반영).
3. WP5의 transport 오류 정규화(`MCP_UPSTREAM_REJECTED`)는 이번 사이클에서 미착수 — WP8 폴리시 pass로 이월.

크레딧 소비: seedance-2 I2V 1건 (+upload, 과금 없음 추정). 누적 실 호출: 이미지 1, 비디오 2(성공), 실패 1(gen-4-turbo).
