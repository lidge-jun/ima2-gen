# 011 — WP1 spike 결과: 계정 판정 + tool 표면 분석

조사일: 2026-07-16. 근거: 사용자 OAuth 승인 하에 캡처한 `tests/fixtures/mcp/runway-tools.sanitized.json`(14 tools, sanitizedHash `sha256:bb58208e…`)과 `tests/fixtures/mcp/higgsfield-tools.sanitized.json`(73 tools, sanitizedHash `sha256:2ca399cf…`). `tools/call`은 0회(무과금), secret scan은 bearer/email 0건.

## 계정/플랜 판정

| Provider | 판정 | 근거 | 한계 |
|---|---|---|---|
| Runway | `connected-via-user-oauth` — tools/list 14개 전체 수신 | OAuth `api:read_write` scope 승인, dynamic client registration 성공 | plan tier는 fixture로 증명 불가. 사용자 진술상 유료 plan. 생성 tool의 credit 요구량은 Tier 2에서 실증 |
| Higgsfield | **`schema-ok`** — tools/list 73개 전체 수신, 결제 없이 schema 확보 완료 | OAuth `openid email offline_access` 승인 | plan tier 미확인. `balance`/`show_plans_and_credits` tool이 존재하므로 Tier 2 진입 시 잔액·plan을 tool로 실증 가능 |

두 판정 모두 "연결·발견 가능"까지의 증명이다. `callable`(생성 실행 권한)은 인터뷰 결정대로 Tier 2 실 호출 전까지 주장하지 않는다.

## Tool 표면 → ima2 capability 매핑 판정

| Capability | Runway | Higgsfield | 판정 |
|---|---|---|---|
| image.generate | `generate_image` | `generate_image` | 양쪽 native |
| video.generate | `generate_video`, `generate_multishot_video`, `generate_product_marketing_video` | `generate_video` | 양쪽 native; Runway multishot은 별도 normalized 후보 |
| video.edit | `edit_video` | 없음 | Runway만 native |
| video.extend | **없음** | **없음** | 양쪽 fallback 확정 → last-frame I2V (060) |
| video.stitch | **없음** | **없음** | 양쪽 fallback 확정 → local ffmpeg concat (060) |
| video.reframe | 없음 | `reframe` | Higgsfield만 native |
| media.upscale | `upscale_image`, `upscale_video` | `upscale_image`, `upscale_video` | 양쪽 native |
| image.edit | 없음 | `remove_background`, `outpaint_image` | Higgsfield만 native |
| task.status | `get_task` | `job_status`, `job_display` | 양쪽 존재 |
| task.cancel | **없음** | **없음** | upstream cancel 미지원 → local wait/download 중지 + `upstreamCancelUnsupported` (050 계약대로) |
| history | `list_recent` | `show_generations`, `show_medias` | 양쪽 존재 |
| upload/reference | `init_upload`, `complete_upload` | `media_upload`, `media_import_url`, `media_confirm`, `media_upload_widget` | 양쪽 존재, 방식 상이 |
| account/credits | `whoami`, `list_workspaces` | `balance`, `transactions`, `show_plans_and_credits`, `list_workspaces`, `select_workspace` | Tier 2 billing gate에 사용 |

## Higgsfield 전용 표면 (mcp.higgsfield.* passthrough 가치)

- 미디어 확장: `generate_audio`, `generate_3d`, `animation_actions`, `motion_control`, `voice_change`, `dubbing`, `list_voices`, `create_voice`(+confirmed_audio), `personal_clipper_*`(3), `shorts_studio_*`(5), `video_analysis_*`(3), `virality_predictor`, `explainer_video`(+preset 2), `show_characters`, `show_reference_elements`, `presets_show`.
- 비미디어(웹/게임/워크플로 생성 계열): `get_game_creation_*`(2), `deploy_game`, `publish_game`, `get_workflow_*`(2), `get_website_creation_*`(2), `create_website`, `list_websites`, `website_*`(6), `deploy_website`, `publish_website`, `participate_in_contest`, `sync_agents`, `show_marketing_studio`(+generations).
- 판정: 비미디어 계열은 ima2 normalized capability 대상이 아니다. `mcp.higgsfield.*` snapshot에는 보존하되(dual namespace 원칙) normalized binding은 미디어 계열만 검토한다. billing 계열(`confirm_billing_purchase`, `cancel_trial_auto_renewal`, `confirm_trial_cancel`)은 **금전 mutation이므로 ima2 노출 기본 차단** 후보로 기록한다.

## 하류 phase에 미치는 확정 사항

1. 060 media workflows: extend/stitch는 양 provider 모두 fallback 경로가 유일하다 — native gate는 스키마 근거로 닫힘.
2. 050 adapter: cancel tool 부재가 실측 확인 — `upstreamCancelUnsupported` 경로가 기본.
3. 040 sanitizer: Runway fixture에서 redaction 1건 발생(긴 opaque 문자열) — 패턴이 실 데이터에서 작동함을 확인. Higgsfield는 0건.
4. 020 catalog: Higgsfield 73개 중 normalized binding 후보는 미디어 계열 약 25개; 나머지는 raw namespace 전용.
5. 검증 분류 기록: `tests/mcp-schema-spike-contract.test.ts`는 `scripts/lib` import라 inventory상 contract 분류 — 의도된 결정.
