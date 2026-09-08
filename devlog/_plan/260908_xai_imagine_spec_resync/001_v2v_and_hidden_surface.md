---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, grok, xai, video, v2v, hidden-endpoints, sdk]
---

# 001 — 2차 조사: V2V 모델 귀속, 숨은 엔드포인트, SDK 격차

000_research.md 이후 사용자가 던진 세 질문에 답한다.

1. 편집/연장이 base 기준인데 그게 **1.5로 바뀐 건가?**
2. **숨은 엔드포인트**가 또 있나? X 포스팅 같은 공개 신호는?
3. GUI에 오디오/동영상 입력과 드래그앤드랍이 필요하다.

## Q1 — 편집/연장은 여전히 base 전용이다

바뀌지 않았다. 실측과 문서가 이번엔 일치한다.

| 근거 | 내용 |
|---|---|
| 실측 | `/v1/videos/edits` + 1.5 -> 400 `Video editing is not supported for this model.` |
| 실측 | `/v1/videos/extensions` + 1.5 -> 400 `Video extension is not supported for this model.` |
| 모델 메타 | base `input_modalities: [text, image, video]` / 1.5 `[text, image, audio]` |
| 편집 문서 | 전 예제가 `model="grok-imagine-video"` |
| ref2v 문서 | 'Reference-to-video cannot be combined with image-to-video or video editing.' |

### 문서의 1.5 연장 예제는 함정이 아니다

연장 문서 JS 예제에 `xai.video("grok-imagine-video-1.5")`가 나와서 1.5가 연장을
지원하는 것처럼 보인다. 실제로는 **2단계 흐름**이다. 1.5로 소스 영상을 생성한
뒤(`generateVideo`), 그 결과 URL을 base 모델로 연장한다(`mode: "extend-video"`).
두 번째 호출의 모델은 `xai.video("grok-imagine-video")`다. 실측 400과 모순되지
않는다.

### 두 모델은 입력 모달리티로 갈라져 있다

base는 영상을 받고 오디오를 못 받는다. 1.5는 오디오를 받고 영상을 못 받는다.
"가장 좋은 모델로 영상을 편집"하는 경로는 현재 존재하지 않으며, 이건 우리가
우회할 수 있는 제약이 아니라 제품에 설명해야 할 사실이다.

## Q2 — 숨은 엔드포인트: 2개 발견

서브에이전트가 프록시를 통해 후보 경로를 전수 프로브했다
(원본 로그: `evidence/hidden-endpoints-probe.txt`).

### 실재하지만 우리가 안 쓰는 엔드포인트

| 경로 | 응답 | 의미 |
|---|---|---|
| `GET /v1/custom-voices` | **200** `{"voices":[],"total_count":0,"cap":30}` | 커스텀 보이스 API가 실재한다. 계정당 상한 **30개** |
| `GET /v1/files` | **200** `{"data":[],"pagination_token":null}` | Files API가 실재한다 |

`cap: 30`은 문서 어디에도 없는 값이다. 엔드포인트가 직접 말해준다.

### 존재하지 않는 것으로 판정된 후보

`inpaint`, `upscale`, `interpolations`, `lipsync`, `restyle`, `continuations`,
`variations`, `remix`, `compose`, `image-to-video`는 전부 POST에 **405 빈 응답**,
GET에 `Malformed request ID` 400을 낸다. 후자가 결정적이다 — 이건 그 경로들이
독립 라우트가 아니라 `/v1/videos/{request_id}`의 경로 조각으로 해석된다는
뜻이다. 즉 이 프로브들로는 **독립 호출 가능한 비디오 엔드포인트를 확인하지
못했다.** 이건 부재의 증명이 아니다 — POST와 GET 두 메서드, 비인증 프록시 경로
하나만 본 결과다. 다른 메서드나 인증 형태에서 다르게 답할 가능성은 배제하지
않는다. `/v1/voices`는 정직한 404다.

### 프로브의 한계 (정직하게 기록)

편집/연장의 추가 필드 수용 여부는 **판정하지 못했다.** `video`가 required라
그것부터 400이 나고, `video`를 채우면 잘못된 URL이어도 200으로 큐잉되어
과금된다. 즉 안전한 트립와이어를 세울 수 없었다. 조사 중 실수로 유효한 편집
요청 1건이 큐잉됐다(request id `e52a3436-...`). 이 미판정 항목은 필요해질 때
비용 승인을 받고 다시 본다.

## Q3 — SDK와 서버의 격차

Aside가 xai-sdk-python 1.19.0과 @ai-sdk/xai 4.0.54를 서버 스펙과 대조했다.
우리에게 의미 있는 것만 추린다.

- **업로드 오디오 클립은 서버에 있고 두 SDK 모두 노출하지 않는다.**
  `AudioUrl.url`은 15초 이하 클립을 받지만, 문서는 'trusted partners on request'로
  게이팅한다. 스펙에는 보이고 기본 계정에서는 못 쓴다.
- **npm SDK는 `reference_images`를 자체적으로 7로 제한한다** (`.min(1).max(7)`).
  서버 OpenAPI에는 `maxItems`가 없고 실측은 14다. **SDK가 낡았다.**
  우리가 SDK를 쓰지 않고 REST를 직접 호출하는 게 여기서 이득이 된다.
- **오디오 단독 R2V를 npm SDK는 표현하지 못한다.** 우리 서버는 표현할 수 있다.
- `generate_audio`는 Python SDK에만 있고 REST 레퍼런스/OpenAPI에는 없다.
  우리는 실측 없이 구현하지 않는다(000의 판단 유지).
- 프롬프트 태그 규약이 문서 내부에서 불일치한다. 이미지는 `<IMAGE_1>`부터(1-based),
  오디오는 `<AUDIO_0>`부터(0-based). 우리 플래너 프롬프트가 어느 쪽을 쓰는지
  WP4에서 확인한다.

X/뉴스 레인에서는 레퍼런스 상한 7->14 변경이나 1.5 V2V 지원을 알리는 공개
발표를 찾지 못했다. **조용히 바뀐 변경**이라는 뜻이고, 그래서 실측이 유일한
신뢰 가능한 출처다.

## Q4 — GUI 갭 (WP3 범위 확장의 근거)

현재 상태를 코드로 확인했다.

| 표면 | 서버 | CLI | **GUI** |
|---|---|---|---|
| 레퍼런스 이미지 | 있음 | 있음 | 있음 |
| `referenceAudios` (보이스) | `routes/video.ts:523` | `bin/commands/video.ts` | **없음** |
| 동영상 입력 (edit/extend) | `routes/videoExtended.ts` | `ima2 video edit/extend` | **없음** |
| 드래그앤드랍 | — | — | 있으나 `image/*` 전용 |

`PromptComposer.tsx:200`의 `f.type.startsWith("image/")`와 `:486`의
`accept="image/*"`, `storeReferenceImpl.ts:170`의 같은 검사가 오디오/동영상
파일을 조용히 버린다. 사용자가 mp3를 끌어다 놓으면 **아무 일도 일어나지 않고
이유도 표시되지 않는다.**

즉 서버와 CLI가 이미 할 수 있는 일을 GUI만 못 한다. WP3을 GUI 입력 확장까지
포함하도록 넓히고, 분량상 WP3(비디오 컨트롤/캡)과 WP3.5(오디오·동영상 입력 +
드롭존)로 나눈다.

## 로드맵 변경

000의 D1-D11에 다음을 더한다.

| # | 항목 | 조치 |
|---|---|---|
| D12 | `/v1/custom-voices` 미사용 | capabilities에 존재와 `cap: 30`을 기록. 연동은 후속 |
| D13 | `/v1/files` 미사용 | 동일. `file_id` 입력 경로의 전제 |
| D14 | GUI 오디오 입력 없음 | WP3.5에서 보이스 선택 UI 추가 |
| D15 | GUI 동영상 입력 없음 | WP3.5에서 edit/extend 진입 UI 추가 |
| D16 | 드롭존 `image/*` 고정 | WP3.5에서 모드별 accept 확장 + 거부 사유 토스트 |
| D17 | 1.5/base 능력 분기 미설명 | WP4 문서에서 입력 모달리티 표로 명시 |



## Q5 — 공식 발표를 찾았다: @imagine 2026-09-02

Aside가 X API로 직접 확인했다. 우리 실측 14의 출처다.

- URL: `https://x.com/imagine/status/2095249317875622255`
- 계정: `@imagine` (Grok Imagine, verified), 2026-09-02T20:35:39Z
- 전문:

> You can now use up to 14 references in your videos.
>
> Images, voices, character references, and more.
>
> Use "@" to tag each reference in your prompt.

**사용자가 본 '사양 업데이트'가 이것이다.** 9월 2일 발표, 우리 실측 9월 8일,
숫자 14 일치. 다만 발표문은 "references"를 이미지·보이스·캐릭터를 아우르는
혼합 집합으로 말하고, 공개 API의 이미지 개수를 따로 명시하지 않는다. 그러므로
발표는 실측을 **뒷받침하되 대체하지 않는다.** `reference_images` 배열의 상한 14는
여전히 우리 400 응답이 유일한 정밀 근거다.

이 발표는 `x.ai/news`에도, `docs.x.ai` 릴리스 노트에도 없다. 공식 변경 통지
표면이 다섯 개로 흩어져 있고(뉴스, API 릴리스노트, 콘솔 체인지로그, Grok Build
체인지로그, grok.com 릴리스노트) 어느 것도 이 변경을 담지 않았다. 제품 계정
X 포스팅이 유일한 공개 통지였다.

### 함께 확인된 인접 발표

| 날짜 | 내용 | 우리에게 주는 의미 |
|---|---|---|
| 2026-09-01 | 'Segmentation for easier image editing' | 이미지 편집 세그멘테이션. API 노출 여부 미확인 |
| 2026-08-25 (RT) | '업로드 이미지가 first frame인지 video를 guide만 할지 선택 가능' | **우리 `videoSingleRefMode`가 이미 구현한 선택**(issue #164). 방향이 맞았다 |
| 2026-08-19 | 'Resize any picture... One click to any other ratio' | 종횡비 확장(21:9, 5:2)과 같은 흐름 |

2026-08-25 RT가 특히 의미 있다. 우리가 260820에 만든 단일 레퍼런스 모드 선택
UI가 xAI가 한 달 뒤 제품에 넣은 것과 같은 판단이었다.

### "@" 태그 규약

발표문은 프롬프트에서 각 레퍼런스를 `@`로 태그하라고 말한다. 우리 플래너는
`<IMAGE_1>`/`<AUDIO_0>` 규약을 주입한다(`lib/grokVideoPlannerPrompt.ts`).
`@`는 Grok Imagine **앱**의 UX이고 API 규약은 꺾쇠 태그다 — API 문서 예제가
전부 꺾쇠를 쓴다. 혼동하지 않도록 WP4 문서에 이 구분을 적는다.

## Q6 — 문서/SDK/실측 삼자 불일치 정리

같은 값에 세 출처가 서로 다른 답을 준다. 어느 것을 믿을지 미리 정해둔다.

| 값 | 렌더 문서 | JS SDK | Python SDK | OpenAPI | **실측** | 채택 |
|---|---|---|---|---|---|---|
| ref2v 이미지 상한 | 7 | `.max(7)` | 제한 없음 | `maxItems` 없음 | **14** | 실측 |
| 연장 길이 | 2-10 | — | 1-10 | 2-10 | **1-15** | 실측 |
| I2V `aspect_ratio` | 덮어쓰고 늘림 | — | — | 무시됨 | 미확인 | 보류 |

앞의 둘은 실측이 이긴다. 세 번째는 실측하지 않았으므로 **판정하지 않는다** —
문서 두 곳이 정면으로 충돌하는데 추측으로 코드를 쓰면 그게 다음 버그가 된다.

## 문서에 없는 런타임 값

`GET /v1/custom-voices`가 `{"voices":[],"total_count":0,"cap":30}`을 답한다.
커스텀 보이스 계정당 상한 **30개**는 문서 어디에도 없다. 엔드포인트 자신이
유일한 출처다.

