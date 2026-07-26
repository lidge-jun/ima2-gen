# 052 — wp5 슬라이스 1: edit_video keyframe 2단 워크플로 (diff-level)

상위 스펙: 051 결정 1/2/3, 050 edit_video 행. wp5b-edit-video work-phase 명세.

## 스키마 확정 (runway.json snapshot, 2026-07-20)

`edit_video`: promptText 필수, video.url(Runway-hosted), keyframeTimestampSeconds,
keyframeImage(키프레임 단계에서 반환된 preview URL), keyframeModel(기본
nano-banana-pro), extraMotionPrompt, skipPreview, textOnly.
2단 흐름: ①키프레임 단계 호출(promptText+video+keyframeTimestampSeconds) →
편집된 키프레임 이미지 preview 반환 ②preview를 keyframeImage로 다시 호출 →
본편 비디오 편집. skipPreview=true면 ①에서 바로 본편 제출.

## 설계 — 승인 표면은 결과 카드 (051 결정 3)

preview를 갤러리 이미지로 커밋하고, 본편 제출은 그 카드의 액션으로 트리거한다.
별도 승인 모달을 만들지 않는다.

### 1. MODIFY `lib/mcp/mediaWorkflowRouter.ts`

operation 추가:

```ts
| "video.edit.preview"   // stage 1: keyframe preview 생성
| "video.edit.submit"    // stage 2: preview 승인 → 본편 편집
```

`"video.edit.preview": { runway: "edit_video" }`,
`"video.edit.submit": { runway: "edit_video" }` — 도구는 같고 plan 구성이 다르다.

### 2. MODIFY `lib/mcp/adapters/runway.ts` — buildRunwayActionCall

RunwayMediaAction에 `"edit-video-preview" | "edit-video-submit"` 추가:

- edit-video-preview: args = `{ rationale, promptText, video: { url },
  ...(keyframeTimestampSeconds !== undefined ? { keyframeTimestampSeconds } : {}) }`
  (skipPreview 미지정 — 프리뷰가 기본 동작)
- edit-video-submit: args = `{ rationale, promptText, video: { url }, keyframeImage: { url },
  ...(keyframeTimestampSeconds ? { keyframeTimestampSeconds } : {}) }`
  (skipPreview 불필요 — keyframeImage 존재 자체가 stage-2 신호.
  A-gate blocker: 스키마상 skipPreview는 stage-1에서 승인 없이 바로 제출할 때만 쓰이고
  stage-2에서 재전송하면 런웨이가 무시하거나 혼동할 수 있다. 제거.)
- 기존 edit-video(textOnly 경로)는 유지 — 입력 타입을
  `{ url, prompt, keyframeTimestampSeconds?, keyframeImageUrl? }`로 확장.

### 3. MODIFY `routes/mcpMedia.ts`

- ACTION_TO_OPERATION에 `"edit-video-preview"`/`"edit-video-submit"` 매핑 추가.
- handleMediaAction: req.body에 `keyframeTimestampSeconds?`, `previewUrl?`,
  `previewFilename?` 수용. submit은 previewUrl(Runway-hosted)을 그대로 plan에
  전달(재업로드 불필요 — 이미 provider-hosted).
- preview 결과 커밋(stage 1): 결과가 이미지 URL이면 kind=image로 commitMediaResult,
  meta에 `previewOf: <submit 의도 requestId>` 대신 `approvalStatus: "pending"`,
  `workflow: "video.edit.preview"`, parent(소스 비디오) 기록.
- ~~stage-1 응답 shape은 미검증(unverified)~~ → **2026-07-20 라이브 캡처로 확정
  (proven)**: stage-1은 동기 응답 `structuredContent.kind === "keyframe_preview"`
  + `keyframeUrl` + `nextArguments`(stage-2 인자 사전). task가 생성되지 않는다
  ("The video edit has NOT been submitted yet"가 응답 텍스트에 명시). 구현은
  `lib/mcp/editVideoPreview.ts`(동기 실행 + 504 재시도)로 분기하고 polling을
  타지 않는다. preview sidecar에는 `keyframeSubmit: nextArguments`를 기록한다.
- submit 커밋: meta에 `approvalOf: <previewFilename>`, `workflow: "video.edit.submit"`.
  preview sidecar의 approvalStatus를 "approved"로 갱신(헬퍼
  `markPreviewApproved(generatedDir, previewFilename)` — sidecar JSON 읽기-쓰기).

### 3-1. 라이브 검증 상태 (2026-07-20)

- stage-1 shape: proven (raw 캡처 보존 — 서버 로그 `[edit_video RAW SUBMIT]`).
- stage-1 라이브 재현: Runway edit_video 엔드포인트가 CloudFront 30s 게이트웨이
  상한으로 간헐적 504를 반환(동기 keyframe 생성이 30초를 넘는 경우). 계약 테스트와
  재시도 로직으로 흡수하고, 제공자 회복 시간대에 재검증한다.
- stage-2 submit: 계획/키프레임 전달까지는 정상 — Runway 응답이
  "Runway workspace limit reached"를 반환. **워크스페이스 한도(과금/동시성)
  문제로 사용자 판단 필요**(NEEDS_HUMAN). 코드 결함 아님.

### 4. UI — MODIFY `ui/src/components/ResultActions.tsx`

- 비디오 결과 + runway 연결 시 "Edit video" 액션: prompt 입력 →
  POST /api/mcp/media-action { action: "edit-video-preview", files: [filename],
  prompt, keyframeTimestampSeconds? }.
- preview 이미지(sidecar에 workflow=video.edit.preview)에는 "Create final edit"
  액션: POST { action: "edit-video-submit", files: [원본 비디오], prompt: 동일,
  previewUrl: sidecar.providerUrl, keyframeTimestampSeconds }.
- approvalStatus 표시는 ResultMetadataModal의 메타 표기에 의존(신규 표면 없음).

### 5. CLI — NEW `bin/commands/editVideo.ts` (`ima2 edit-video`)

- `ima2 edit-video <generated-video> "<edit prompt>" [--keyframe-ts <sec>] [--submit <preview-file>]`
- preview 모드(기본): media-action edit-video-preview 호출 → SSE 대기 → 결과 표시.
- `--submit <preview-filename>`: 해당 preview의 sidecar를 읽어 providerUrl/prompt를
  이어받아 edit-video-submit 호출. 서버 응답 코드는 그대로 통과.
- bin/lib/mcpJob.ts에 `runMcpActionJob`(media-action POST + SSE 대기) 추가 —
  runMcpJob과 SSE 대기 공유, POST 경로만 다름.

## 계약 테스트 — NEW `tests/mcp-edit-video.test.ts`

1. preview plan 구성: promptText+video.url+keyframeTimestampSeconds, skipPreview 없음.
2. submit plan 구성: keyframeImage.url+skipPreview:true.
3. preview 커밋 meta: approvalStatus pending + workflow + parent.
4. submit 시 preview sidecar가 approved로 갱신(stub fs).
5. previewUrl 없는 submit → 400 INVALID_PREVIEW.
6. 라우트 미등록 action → 400 INVALID_ACTION 회귀.

## Activation 시나리오

- stage-1 응답 파싱: 테스트 3이 image-URL stub 응답으로 커밋까지 증명.
- 승인 갱신: 테스트 4가 approved 전이를 실제로 일으킴.
- 라이브(최저 설정): 짧은 소스 비디오(기존 갤러리 5초 이하 mp4)로 preview 1건.
  과금 카운트: edit_video 1.

## Accept

typecheck 2종 + 테스트 6건 + 라이브 1건 sidecar 증거(approvalStatus/parent).
