# 001 — 무과금 live contract 조사

## Read-only probe

- 2026-07-16, 기존 OAuth refresh token으로 Higgsfield `models_explore(action=list,type=image|video,limit=100)`만 호출했다.
- 결과: image 31 + video 30 = 61 entries. 모든 페이지 item 원문에서 발견한 top-level field는 `id`, `name`, `provider_name`, `description`, `output_type`, `parameters`, `medias`, `aspect_ratios`, `durations`, `duration_range`, `tags`다.
- parameter type은 `string`, `number`, `bool`, `string_array`; media role은 `start_image`, `end_image`, `image`, `image_references`, `video_references`, `audio_references`, `input_video`, `input_audio`, `input_images`다.
- generation/billing/upload tool은 호출하지 않았다. `$HOME/.ima2/mcp-spike/*.json` 내용은 읽거나 출력하지 않았다.

## Representative provider facts

- Higgsfield `nano_banana_2`: ratios 10종, resolution `1k|2k|4k`, default `1k`, image role.
- Higgsfield `seedance_2_0`: duration 4..15 default 5, resolution `480p|720p|1080p|4k` default 720p, mode `std|fast`, bitrate, genre, audio, start/end/reference image/video/audio roles.
- Higgsfield `kling3_0_turbo`: duration 3..15 default 5, resolution `720p|1080p` default 720p, start-image role.
- Higgsfield `veo3_1`: duration `4|6|8` default 8, quality `basic|high|ultra`, variant options, start-image role.
- Runway sanitized `generate_image` description: image model별 exact ratio 표와 model default.
- Runway sanitized `generate_video` description: 6개 모델의 t2v/i2v/v2v/end/refs/audio matrix, duration 표, Seedance/Veo resolution 표. exact per-model video ratio는 선언이 부족해 공통 안전 교집합 `16:9|9:16|1:1`만 provider-verified fallback으로 둔다.

## Provenance rule

- Higgsfield: runtime `models_explore` item의 선언값을 `provider-declared`로 보존한다.
- Runway: repository에 저장된 authenticated sanitized schema description을 versioned static projection으로 사용하고 `verified-contract`로 태그한다.
- 모르는 resolution/default/ratio는 만들지 않는다. UI는 field를 숨기거나 Auto/provider default로 남긴다.
- provider capability와 ima2 executable capability는 분리한다. Higgsfield catalog가 완전해져도 generation lock은 그대로다.

