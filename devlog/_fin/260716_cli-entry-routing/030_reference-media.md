# 030 — wp3: 레퍼런스 미디어 파이프라인 (영상 다양성 격차 해소)

동기: Runway/Higgsfield 대비 ima2 영상 제작의 다양성 부족은 모델 수가 아니라 **입력 표면** 격차.
우리는 start frame 1장만 넘기는데, 계약상 받을 수 있는 게 훨씬 많다 (스냅샷 ~/.ima2/mcp/snapshots 실측, 2026-07-16).

## 실측 tool 표면 (근거)

Runway `generate_video` args(스냅샷 원문): `promptText(필수) | model | ratio | duration | resolution | generateAudio | startFrame{url} | startImageFile | endFrame{url} | referenceImages[{url,tag}] | referenceVideo{url} | referenceVideoFile | rationale`.
- endFrame은 startFrame 필수 전제, 지원 모델 seedance-2/kling-o3-pro/kling-3-pro/veo-3.1 (스키마 desc 명시).
- referenceImages는 seedance-2/kling-o3-pro만 (스키마 desc 명시). maxItems 미선언 → 개수 상한은 unverified, 보수적으로 3 제한.
- referenceVideo는 v2v(편집/리스타일) 의미. `*File` 변형은 ChatGPT 전용 파라미터라 ima2는 URL 계열만 사용.
Runway `generate_image` args(스냅샷 원문): `promptText(필수) | model | ratio | count(1-4) | referenceImages[{url,tag}] | referenceImageFile | rationale`. 편집=referenceImages[0]에 원본 (별도 edit tool 없음).
주의: 오디오 레퍼런스 입력은 generate_video 스키마에 **존재하지 않음** — 기존 카탈로그 inputRoles의 audio_references 표기는 과잉이므로 카탈로그에서 제거 대상(wp3에서 수정).
업로드: `init_upload`/`complete_upload` (기존 lib/mcp/adapters/runwayUpload.ts가 이미 구현)
모델별 허용 롤은 카탈로그 inputRoles로 이미 보유: seedance-2(text+start+end+image_refs+video_refs+audio_refs), kling-o3-pro(…video_refs), veo-3.1(start+end), gen-4.5(start만), gen-4-turbo(start만).
Higgsfield: `media_upload → media_confirm → generate_*(params)` + `show_reference_elements`/`show_characters(soul_id)` — 결제 후 Tier2.

## 1. 서버 계약 확장 — MODIFY routes/mcpMedia.ts, lib/mcp/providerAdapter.ts, adapters/runway.ts

- `POST /api/mcp/generate` body 확장:
  `endFrameFilename?`, `referenceImageFilenames?: string[]`(≤3 보수 상한, 스키마 maxItems 미선언), `referenceVideoFilename?` — 모두 갤러리/assets 파일명, 기존 startFrameFilename과 동일한 containment 검증(safeGeneratedFilePath)+크기 제한. referenceImages에는 항목별 `tag`(캐릭터/씬 라벨) 선택 지원.
- MediaJobRequest에 `endFrameUrl? / referenceImages?: {url,tag?}[] / referenceVideoUrl?` 추가.
- runway adapter buildGenerateCall: inputRoles 게이트 — 모델이 해당 롤 미선언이면 **업로드 전** reject(`MCP_INPUT_ROLE_UNSUPPORTED:<model>:<role>`, 기존 pre-validation 훅이 자동 커버되도록 placeholder URL 검증 확장). 선언된 롤만 args로 매핑(startFrame:{url}, endFrame:{url}, referenceImages:[{url}...], referenceVideo:{url}).
- 업로드 순서: 검증 통과 후 파일별 순차 init/complete(기존 upload dep 재사용), 진행 이벤트 phase "uploading" (n/m) 표기.
- 스키마 상세(레퍼런스 개수 상한, 파일 포맷/크기 제한)는 스냅샷 inputSchema 원문으로 B-phase에서 확정 — 문서상 ≤3은 잠정.

## 2. UI — MODIFY McpGenerationControls + composer 첨부 표면

- MCP 레인에서 Tool inputs 태그(현재 표시 전용)를 **첨부 슬롯**으로 승격: 모델 inputRoles에 따라 start/end/refs/video-ref 슬롯 활성화, 갤러리·assets에서 선택(기존 start-frame 체인/parent lineage 패턴 재사용, role별 lineage 기록).
- 비선언 롤 슬롯은 렌더하지 않음(모델 전환 시 stale 첨부는 reconcile로 제거 — 프리셋 정규화와 동일 규약).
- Est. 표시: video_references는 과금 가중이 있을 수 있어 슬롯에 안내 문구.

## 3. CLI — MODIFY bin/commands/gen.ts / video.ts (wp1 resolver 위에)

- gen: 기존 `--ref <file>`(≤5)를 MCP lane에서 referenceImages로 매핑(로컬 파일이면 선업로드).
- video 신규 플래그: `--start <file|filename>`, `--end <file>`, `--ref <file>`(반복, image refs, `--ref file:tag` 문법 지원), `--video-ref <file>`.
- resolver 단계에서 카탈로그 inputRoles로 선검증 → 미지원 롤 플래그는 exit 2 `INPUT_ROLE_UNSUPPORTED` + 지원 모델 안내(예: video-ref는 seedance-2/kling-o3-pro만).

## 4. 테스트

- adapter: 롤 게이트(모델×롤 매트릭스), 업로드-전-거부, args 매핑 shape.
- route: 다중 파일 containment/개수 제한, 업로드 순서와 phase 이벤트.
- CLI: 플래그→롤 매핑, 미지원 롤 exit 2 봉투.

## 5. Higgsfield 트랙 (백로그, 결제 후)

- media_upload/confirm 브리지 + generate params 매핑, show_characters(soul_id) 연동은 별도 040 후보.
- 040 후보(같은 동기): edit_video(keyframe), generate_multishot_video(shots/storyPrompt), upscale_* — "제작 다양성" 2탄.

## 이 문서의 지위

이 문서는 wp3 **구현 사이클**의 diff-level 계획이다. 현재 진행 중인 로드맵 docs-only 사이클은 이 문서를 쓰는 것까지가 범위이며, 아래 Accept의 실생성 검증은 wp3 사이클에서 사용자 승인 하에 수행한다.

## 소스 근거

- Runway MCP tool inputSchema 원문: ~/.ima2/mcp/snapshots/runway.json (2026-07-16 로컬 스냅샷, tools/list 실측) — proven
- referenceImages 모델 제한·endFrame 모델 목록: 같은 스냅샷 desc 필드 — proven
- 개수/파일 크기 상한: 스키마 미선언 — unverified (wp3 B에서 실호출 400 응답으로 확정)

## Accept (wp3)

1. seedance-2로 start+end+image refs 조합이 CLI/UI 양쪽에서 업로드→생성까지 통과(실생성 1건, 승인 시).
2. gen-4-turbo에 --end 주면 업로드 없이 즉시 exit 2 / UI에선 슬롯 자체가 없음.
3. 롤 매트릭스 계약 테스트 green, typecheck green, devlog 증거.
