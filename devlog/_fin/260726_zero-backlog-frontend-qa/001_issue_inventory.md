---
title: "001 — 이슈 인벤토리와 실제 코드 대조"
lane: "260726_zero-backlog-frontend-qa"
created: 2026-07-26
kind: research
manifest_frozen_at: "2026-07-26T16:46:18Z"
evidence: "explorer 2기(gpt-5.6-sol) 병렬 read-only 조사 + gh issue view"
---

# 001 — 이슈 인벤토리와 실제 코드 대조

2026-07-26T16:46:18Z 시점의 `gh issue list --state open` 9건을 실제 소스와 대조했다.
가장 중요한 발견은 **이슈 본문 다수가 현재 코드보다 오래됐다**는 것이다. 본문을
그대로 믿고 구현하면 이미 있는 것을 다시 만들게 된다.

## 처분 매트릭스

| 이슈 | 제목 | 코드 대조 판정 | 처분 | 담당 WP |
|---:|---|---|---|---|
| #27 | Canvas SVG export | 미구현 | 구현 | WP5 |
| #28 | Canvas PPTX export | 미구현. `pptxgenjs` 미설치 | 구현 | WP5 |
| #31 | provider-backed masked edit | 로컬 전부 구현, upstream 계약 미검증 | BLOCKED 근거 코멘트 후 close | WP11 |
| #80 | batch comparison matrix | multimode는 단일 조합만 | 구현 | WP9 |
| #84 | common video pipeline | `VideoGenerateRequest` 이미 존재, 경로별 미공유 | 구현(범위 축소) | WP7 |
| #85 | asset ID model | `assetsStore`에 assetId 있음, GenerateItem은 filename | 구현(범위 축소) | WP8 |
| #88 | V2V last-frame | 서버 ffmpeg 추출 **이미 존재** | 구현(추상화만) | WP6 |
| #90 | provenance chip | 데이터 전부 존재, 표시만 없음 | 구현 | WP4 |
| #98 | storyboard planner skill | 4라운드 중 3라운드 이미 랜딩 | 잔여 확인 후 close | WP11 |

## 이슈 본문과 코드의 불일치 (닫을 때 코멘트에 인용할 근거)

### #88 — "server ffmpeg → browser canvas 폴백이 필요하다"

서버 ffmpeg 추출은 이미 구현되어 있다.

- `lib/videoFrameExtract.ts:70-87` — `execFile("ffmpeg")` 기반 프레임 추출
- `lib/videoFrameExtract.ts:16-27` — `FFMPEG_UNAVAILABLE`/timeout 오류 분류
- `routes/videoExtended.ts:410-430` — `/api/video/frame` 라우트

따라서 실제 gap은 추출 구현이 아니라 **서비스 추상화와 폴백 오케스트레이션**이다.
ffmpeg는 npm 의존성이 아니라 PATH 실행 파일 의존성이라는 점도 문서화되지 않았다.

### #90 — "backend 완료, UI만 남았다"

이 서술은 맞다. 다만 이슈가 지목한 컴포넌트 5개는 모두 실재하며 일부는 이미 정보를
표시한다.

- `ui/src/components/ImageNode.tsx:185` — model short label 이미 표시
- `ui/src/components/GalleryModal.tsx:190,201-204` — model/provider/videoContinuity 매핑은 하지만 표시하지 않음
- `ui/src/store/storeVideoImpl.ts:166-168` — 노드 완료 시 `model: null`로 덮어씀 (**실제 버그**)

마지막 항목이 이 이슈의 진짜 핵심이다. 표시 컴포넌트를 만들어도 노드 경로에서는
model이 이미 지워져 있다.

### #84 — "공통 타입이 없다"

`ui/src/lib/api-generation.ts:245-267`에 `VideoGenerateRequest`가 이미 있다.
실제 문제는 타입 부재가 아니라 Agent가 `generateVideoViaGrok`를 직접 호출해
라우트를 우회한다는 것이다(`lib/agentImageVideoGen.ts:254-280`).

`/api/video/extend`와 `/api/video/edit`는 `videoUrl`/`operation`/`sourceVideoId`
계약이 달라 같은 타입에 합치면 안 된다(`routes/videoExtended.ts:202-244`).
WP7은 generate 경로만 통합한다.

### #85 — "assetId가 없다"

`routes/assets.ts`와 `lib/assetsStore.ts`는 이미 asset ID를 쓴다. filename 중심인
것은 `GenerateItem`, video source, canvas recovery 경로다. 전면 마이그레이션이
아니라 이 세 경로에 참조를 얹는 작업이다.

### #98 — 4라운드 중 3라운드 완료

| 라운드 | 상태 | 근거 |
|---|---|---|
| 1. CLI `--planner-model` | 완료 | `bin/commands/video.ts:84-86,264-265,307-308`, `routes/video.ts:382-403` |
| 2. planner 캐릭터/대사 프롬프트 | 완료 | `lib/grokVideoPlannerPrompt.ts:122`, `lib/grokImageAdapter.ts:99` |
| 3. i2v 스킬 가이드 | 완료 | `skills/ima2/SKILL.md:736,823-827,863` |
| 4. storyboard UI/파이프라인 | 부분 | `ui/src/store/useAppStore.ts:288,620`, `ui/src/components/composer/PromptComposerToolbar.tsx:108-111`, `lib/generatePipeline.ts:89-90,185`, `routes/video.ts:178-199` |

4라운드는 storyboard 플래그·프롬프트 프리픽스·소스 이미지 경로가 동작한다. 계획
문서가 추가로 요구한 `ui/src/lib/storyboard.ts`와 자동 keyframe 체이닝은 없다.
이 잔여는 별도 이슈 가치가 없을 만큼 작고, 현재 UX는 이미 사용 가능하다.

### #31 — 외부 계약 차단

로컬은 전부 구현됐다.

- `ui/src/lib/canvas/maskRenderer.ts:21-56` — 마스크 PNG 생성
- `routes/edit.ts:78-96` — PNG/base64/알파/치수 검증
- `routes/edit.ts:180-192` — provider별 마스크 차단 분기
- `lib/oauthProxy/multimodeGenerators.ts:176-190` — 플래그가 켜져도 upstream payload 미구현이라 `EDIT_MASK_NOT_SUPPORTED` 반환

`lib/oauthProxy/multimodeGenerators.ts:185` 주석이 "STEP-0 verification 후 활성화"를 명시한다.
업스트림 계약(필드명, multipart/JSON, 알파 의미)을 확인하지 않고 payload를 추측해
보내는 것은 조용한 열화(silent degradation) 위험이 있고, 이슈 자체가 그것을 금지한다.
사용자 승인 없이 유료 OAuth 실호출로 계약을 탐침할 수도 없다. → BLOCKED.

## 통합(merge) 판단

- **#27 + #28**: 같은 Canvas export 표면. 하나의 format dispatcher + 툴바 메뉴로
  구현한다(WP5). 이슈는 각각 닫되 같은 커밋을 근거로 삼는다.
- **#84 + #85 + #88**: video 요청 경로라는 축을 공유한다. 하지만 의존 방향이
  #88(추출 추상화) → #84(요청 통합) → #85(참조 모델)로 명확해 **순서를 가진 별도
  work-phase**로 둔다. 한 사이클에 몰면 롤백 단위가 사라진다.
- **#80**: 독립. multimode 파이프라인 위에 얹는다.
