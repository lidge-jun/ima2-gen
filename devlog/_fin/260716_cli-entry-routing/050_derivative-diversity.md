# 050 — wp5: 파생 제작 다양성 (스냅샷 실측 tool 분류와 도입 우선순위)

동기: "영상 제작 다양성이 Higgsfield/Runway만 못하다"의 나머지 절반 — 생성 이후의 **파생 편집** 표면.
스냅샷(2026-07-16, tools/list 실측) 기준 분류. 공개 문서로 스키마가 확인된 것만 proven 표기.

## Runway (14 tools 중 파생 계열)

| Tool | 실측 계약 요점 | ima2 도입 판단 |
|------|----------------|----------------|
| edit_video (Aleph 2.0) | promptText 필수, keyframeTimestampSeconds+keyframeImage 2단 워크플로(프리뷰 승인), textOnly 폴백, keyframeModel 기본 nano-banana-pro | **P1** — "이 장면만 바꿔" UX. 프리뷰 승인 단계가 ima2 결과 카드와 자연 결합 |
| generate_multishot_video | Kling 3.0, 3-5샷, mode auto(storyPrompt)/custom(shots[] maxItems=5), duration 5/10/15, 720p=standard/1080p=pro, firstSceneImage 앵커 | **P1** — 스토리보드 기능과 직결. ima2 storyboard→shots[] 매핑 |
| upscale_image | scaleFactor 2/4/8/16, flavor sublime/photo/photo_denoiser, sharpen/smartGrain/ultraDetail 0-100 | **P2** — 기존 media-action(image.upscale) 라우트에 파라미터만 확장 |
| upscale_video | 소스 URL만, 최대 4K | **P2** — 동일 (video.upscale 확장) |
| generate_product_marketing_video | productUrl/productImages+referenceImages, 10/15s, 내부 storyboard 2단계 | **P3** — 니치. cardnews/마케팅 플로와 겹칠 때 재평가 |

기존 060 media-action 라우터(video.upscale/image.upscale/video.edit 등)가 이미 있으므로 P1/P2는
ADAPTERS 확장 + UI 액션 버튼 + (wp1) CLI `ima2 edit-video`/`ima2 upscale` 진입으로 수렴한다.

## Higgsfield (73 tools 중 파생 계열, 전부 결제 후 Tier2)

| Tool | 실측 계약 요점 | 판단 |
|------|----------------|------|
| motion_control | Kling 3.0: 캐릭터 스틸(image_id)+모션 레퍼런스 영상(motion_video_id)으로 퍼펫티어링 | **P1(결제 후)** — 040 캐릭터와 결합 시 차별화 최대 |
| reframe | 영상 종횡비 확장/리프레임, image refs로 채움 가이드 | P2 |
| voice_change / dubbing / list_voices | 목소리 교체·립싱크 더빙(언어 현지화) | P2 — 오디오 파생 신설 영역 |
| explainer_video | 클립+보이스 테이크 조립(블록 고정 길이, 순서 스티칭) | P3 — ima2 시퀀스/스티치와 부분 중복 |
| personal_clipper / shorts_studio | YouTube URL→쇼츠 클리핑, 프리셋 | P3 — 범위 밖 성격(소스 수집기) |
| video_analysis | 영상 분석 job | P3 |
| remove_background / outpaint / upscale_* | 이미지·영상 유틸 | P2 — 기존 media-action과 동형 |

## 도입 로드맵 제안

1. **wp5a (Runway P1)**: edit_video 2단 워크플로 + multishot(스토리보드 연동). media-action 라우터 확장 + 결과 카드 액션.
2. **wp5b (Runway P2)**: upscale 파라미터 노출(UI 슬라이더 3종 + CLI 플래그).
3. **wp5c (Higgsfield, 결제 후)**: motion_control+reframe 우선 — 040 soul/캐릭터 트랙과 같은 사이클에 붙이는 게 효율적.
4. 오디오 파생(voice/dubbing)은 별도 유닛으로 분리 권장 — 입력(영상 내 음성) 검증·언어 선택 UI가 독립 표면.

## 소스 근거

- 전 tool 계약: ~/.ima2/mcp/snapshots/{runway,higgsfield}.json (2026-07-16 tools/list 실측) — proven
- Seedance 2.0 v2v/레퍼런스 동작: help.runwayml.com Creating with Seedance 2.0 (2026-07-16) — proven
- 살아있는 MCP 서버의 공개 스키마 문서: runwayml.com/mcp — 미제공(unverified), GitHub의 runway-api-mcp-server는 구세대 서버로 현 스키마의 증거 아님
- Higgsfield 파생 tool 공개 문서: 미발견 — 스냅샷 desc만 근거 (unverified 표기 유지)

## Accept (wp5 구현 사이클들)

각 서브 phase가 자체 PABCD로: 계약 테스트(플랜 구성) + 무과금 검증 경로 + 실행 1건(승인 시) + devlog 기록.
