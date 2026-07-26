# 051 — WP5 실증 결과: Runway 실 생성 + Higgsfield 모델 카탈로그

실행일: 2026-07-16 (야간 HOTL 2차, WP5 C-phase). 서버: 신규 코드로 :3435 테스트 인스턴스 기동, `IMA2_MCP_TOKEN_DIR=~/.ima2/mcp-spike`(spike refresh 토큰 재사용 — **브라우저 재승인 없이 연결 성공**).

## Runway 실 생성 (사용자 사전 승인: "마음껏 테스트")

| 시도 | 요청 | 결과 | 비고 |
|---|---|---|---|
| connect | `POST /api/mcp/providers/runway/connect` | `connected`, toolCount 14, **snapshotDiff {0,0,0}** | refresh 토큰만으로 연결. live schema가 번들 snapshot과 canonical hash 완전 일치 — WP4 drift 파이프라인 실전 검증 |
| 이미지 | `POST /api/mcp/generate` kind=image, model 기본(nano-banana-pro), prompt "watercolor fox…" | **done, 32초** → `1784136118735_1ec72481_mcp.png` + sidecar + 썸네일, 갤러리 자동 편입 | taskId/poll 파서가 실 응답에 1차 시도로 작동. phase 전이 queued→provider-running→downloading→done |
| 비디오 1 | kind=video, **model=gen-4-turbo** | **error: "Streamable HTTP error"** (~30초, submit 단계) | upstream이 해당 조합 거부로 추정(free-plan용 모델 안내 문구와 연관 가능). typed error로 안전 종료, done 미발행 — 원자성 계약 검증 |
| 비디오 2 | kind=video, model 기본(**seedance-2**), t2v | **done, ~5분** → `1784136638376_ca7f46a1_mcp.mp4` + sidecar + 썸네일 | poll backoff(3s→12s) 정상, 장시간 job에서 SSE/inflight 위상 보고 정상 |

크레딧 소비: 이미지 1건 + 비디오 1건 + 실패 1건(과금 여부 미확인 — Tier 2 billing gate에서 `whoami`/workspace 조회로 추적 예정). 서명 URL은 sidecar에 미저장(query 제거 origin+path만) — 계약 준수 확인.

### 후속 판정

- `gen-4-turbo` 실패는 060/080에서 모델별 capability 표에 반영: **모델 enum에 있어도 계정/모드 조합으로 거부될 수 있음** → typed error를 UI 사유 표시로 전달해야 함(080).
- transport 오류 문자열("Streamable HTTP error")이 그대로 errorCode로 노출됨 → executor에서 `MCP_UPSTREAM_REJECTED`로 정규화하는 개선을 060 사이클에 편입.

## Higgsfield 모델 카탈로그 (무과금 read-only)

`models_explore {action:"list"}` 호출 1회(구조화 응답, 과금 없음) → `tests/fixtures/mcp/higgsfield-models.sanitized.json` (35KB, sanitized).

**20개 모델**: 이미지 12 — `nano_banana_2`, `nano_banana_pro`(Google), `gpt_image_2`(OpenAI), `soul_2`, `soul_cinematic`, `soul_cast`, `soul_location`, `cinematic_studio_2_5`, `marketing_studio_image`, `ms_image`, `image_auto`, `autosprite`(Higgsfield) / 비디오 6 — `cinematic_studio_3_0`, `cinematic_studio_video`, `cinematic_studio_video_v2`, `marketing_studio_video`, `clipify`, `higgsfield_preset` / 3D 2 — `sam_3_3d`(Meta), `image_to_3d`(Meshy).

모델마다 `parameters`(resolution 1k/2k/4k 등), `aspect_ratios`(최대 10종), `tags`, `medias`(role) 스키마가 구조화되어 있어 **080 모델 드롭다운을 catalog 파생으로 만들 데이터가 이미 확보됨**. 어댑터는 executable=false 유지(무료 플랜) — 모델 목록만 노출하고 생성 시도는 `MCP_EXECUTION_LOCKED`.

## 계약 준수 체크

- [x] 과금 호출: Runway 생성 2건(승인 범위), Higgsfield 과금 호출 0.
- [x] 원자적 commit: 실패 경로에서 media 롤백 + done 미발행 (mcp-live-vid-1 + 통합 테스트).
- [x] snapshotDiff 실전 0/0/0 (양 provider).
- [x] 서명 URL sidecar 미저장.
