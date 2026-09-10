---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, grok, xai, video, reference-to-video, imagine, spec-resync]
---

# 000 — xAI Imagine 사양 재조사 (2026-09-08 실측)

## 질문

'Grok 이매진이 또 ref2v 사양 업데이트했고 1.5 중간 태그 같은 것도 늘어났다.'

답: **ref2v 사양은 실제로 바뀌었다.** 레퍼런스 이미지 상한이 7 -> 14로 두 배가
됐고, ref2v 길이 상한이 모델별로 갈라졌다. 다만 '1.5 중간 태그가 늘었다'는
부분은 실측상 근거가 약하다 — 새 모델 id는 없고, 우리가 몰랐던 날짜 별칭
`grok-imagine-video-1.5-2026-05-30` 하나가 있을 뿐이다. 그 대신 조사 과정에서
**이미지 레인 쪽 미반영 변경이 더 크게** 나왔다.

## 조사 경로

세 레인을 병렬로 돌렸고, 충돌 시 실측이 이긴다는 원칙을 유지했다.

1. **공식 문서 원문** — aside exec 파견으로 docs.x.ai의 `.md` 원문과
   `openapi.json`을 직접 수집. 페이지 HTML은 SPA 셸이라 렌더링만으로는 값이
   안 나온다.
2. **OpenAPI 스키마** — `https://docs.x.ai/openapi.json` (219KB) 직접 파싱.
3. **로컬 progrok 프록시 실측** — `127.0.0.1:18645` -> api.x.ai. 과금을 피하려고
   경계 초과값이나 트립와이어(존재하지 않는 `voice_id`, `n:99`)를 함께 실어
   **통과하더라도 400으로 끝나게** 설계했다. 실제 영상 생성 과금이 발생한
   요청은 2건(refs8, filetag_ref)뿐이고, 둘 다 상한 판정에 필요했던 요청이다.

원본 응답: `evidence/ima2_probe*_results.txt`,
모델 목록 스냅샷: `evidence/video-generation-models.json`,
`evidence/image-generation-models.json`.

## 실측 결과 — 비디오 (2026-09-08)

| 시나리오 | 요청 | 결과 |
|---|---|---|
| 레퍼런스 8장 | 1.5, 8장, 5s, 720p | **200** (2026-08-20에는 400이었다) |
| 레퍼런스 15장 | 1.5 / base, 15장 | **400** `Too many reference images: 15. Maximum allowed is 14.` |
| 레퍼런스 14장 | 1.5 / base, 14장 | 이미지 상한 통과 (뒤의 duration 트립와이어에서 걸림) |
| ref2v duration 16 | **1.5** | **400** `Duration 16s exceeds the maximum allowed for reference-to-video, which is 15s.` |
| ref2v duration 16 | **base** | **400** `Duration 16s exceeds the maximum allowed for reference-to-video, which is 10s.` |
| ref2v duration 11 | base | **400** 같은 메시지 (10s) |
| ref2v 1080p | 1.5, 2장 | **400** `1080p video resolution is not supported for reference-to-video requests.` |
| reference_audios | **base** 모델 | **400** `` `reference_audios` is not supported for this model. `` |
| reference_audios 4개 | 1.5 | **400** `Too many reference audio clips: 4. Maximum allowed is 3.` |
| 잘못된 voice_id | 1.5 | **400** + 유효 보이스 26개 전체 나열 (아래) |
| duration 16 (T2V/I2V) | 1.5 / base | **400** `Duration must be between 1 and 15 seconds` |
| aspect_ratio auto | 1.5 | **422** `unknown variant auto, expected one of 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3` |
| `grok-imagine-video-2.0` | — | **404** 존재하지 않음 |
| `grok-imagine-video-1.5-2026-05-30` | 별칭 | duration 검증까지 도달 = **유효한 별칭** |
| image + reference_images 동시 | 1.5 | ref2v로 판정됨 (duration 15s 규칙 적용) |

### 상한 판정의 논리

14라는 숫자는 추측이 아니다. 30장을 보내면 `Maximum allowed is 14`가 그
숫자를 직접 말하고, 15장은 400, 14장은 그 검사를 통과해 다음 검증(duration)에서
걸린다. 모델을 바꿔도 같은 14가 나오므로 **모델 무관 상한**이다.

ref2v 길이는 반대로 **모델별로 다르다.** 같은 16초 요청이 1.5에서는 '최대 15s',
base에서는 '최대 10s'라고 답한다. 우리 코드에는 이 구분이 없다.

### 프리셋 보이스 — 400 응답이 권위 있는 명단

```
ara, eve, leo, rex, sal, carina, zagan, helix, orion, luna, iris, altair,
zenith, perseus, helios, lux, kepler, rigel, cosmo, celeste, ursa, sirius,
lumen, castor, naksh, atlas
```

26개다. 우리 `lib/capabilities.ts`의 `knownPresets`와 정확히 일치한다.
공식 TTS 문서 로스터에는 `aurora`, `liora`가 더 있지만, **비디오 엔드포인트가
거부 응답에서 직접 나열하는 명단에는 없다.** 광고할 명단은 후자다.
400 본문은 또 하나를 알려준다: `Custom voice ids created via the
/v1/custom-voices API are also accepted.` — `presetsAreAuthoritative: false`가
맞았다는 뜻이고, 커스텀 보이스 경로의 출처가 이제 명시됐다.

## 실측 결과 — 이미지 (2026-09-08)

| 시나리오 | 결과 |
|---|---|
| `/v1/images/edits` 입력 6장 | **400** `This model supports at most 5 input image(s), but 6 were provided.` |
| 입력 5장 | 그 검사를 통과 (`n` 트립와이어에서 걸림) |
| `quality: ultra` | **422** `expected one of low, medium, high, auto` |
| `aspect_ratio: 7:3` | **422** — 유효 목록에 `21:9`, `5:2` 포함 |
| `resolution: 4k` | **422** `expected 1k or 2k` |
| `n: 99` | **400** `must be between 1 and 10 inclusive` |

유효 종횡비 전체: `1:1, 3:4, 4:3, 9:16, 16:9, 2:3, 3:2, 9:19.5, 19.5:9, 9:20,
20:9, 1:2, 2:1, 21:9, 5:2, auto`.

## 모델 목록 실측

`GET /v1/video-generation-models`:

| id | aliases | input_modalities |
|---|---|---|
| `grok-imagine-video` | (없음) | text, image, **video** |
| `grok-imagine-video-1.5` | `-preview`, **`-2026-05-30`** | text, image, **audio** |

새 모델도, 1.5.x 포인트 릴리스도, `-fast`/`-pro` 같은 티어 태그도 없다.
사용자가 본 '중간 태그'는 날짜 별칭 `grok-imagine-video-1.5-2026-05-30`일
가능성이 높고, 그건 우리가 실제로 모르던 값이 맞다.

`GET /v1/image-generation-models`은 `grok-imagine-image`(별칭
`grok-imagine-image-2026-03-02`), `grok-imagine-image-2.0`,
`grok-imagine-image-quality`(별칭 `-20260403`, `-latest`, **`-pro`**)를 답한다.
2.0은 `pricing` 배열로 quality x resolution 조합별 단가를 노출한다.

## 공식 문서에서만 확인되는 사실

실측으로 값을 확인하지 못했지만 문서가 명시하는 것들이다. 근거 URL을 함께 남긴다.

- **`grok-imagine-image-quality` 2026-11-02 폐기.** 'On November 2, 2026,
  `grok-imagine-image-quality` is retired. Requests to the slug will be served by
  `grok-imagine-image-2.0` with `quality` set to `low`.' —
  `https://docs.x.ai/developers/release-notes`
- **이미지 편집 5장.** 'Image editing now accepts up to 5 source images per
  request (was 3).' — 같은 문서. 실측 400과 일치한다.
- **auto quality 기본값.** 'the default when `quality` is omitted has moved from
  `medium` to `auto`.' — 같은 문서.
- **새 종횡비.** 'Image generation and editing accept `21:9` ... and `5:2`' — 같은 문서.
- **오디오 단독 ref2v.** 'May be provided without `reference_images`
  (audio-only reference-to-video) — at least one reference of either kind
  selects the reference-to-video mode.' — `openapi.json` `GenerateVideoRequest`.
- **사용자 오디오 클립.** `reference_audios[].url`은 15초 이하 클립을 받지만
  'available to trusted partners, on request' — ref2v 문서.
- **`file_id` 입력.** `reference_images[].file_id`, `image.file_id`로 Files API
  참조 가능. URL과 상호 배타.
- **`storage_options`** — 생성물을 Files API에 영구 저장 + 공개 URL 발급.
- **`generate_audio`** — 생성 가이드에만 있고 REST 레퍼런스/OpenAPI에는 없다.
  문서 자체의 불일치이므로 실측 없이 구현하지 않는다.

### 문서와 실측이 어긋나는 지점

ref2v 문서의 렌더링 페이지는 여전히 '최대 7장'을 말한다(페이지 하단
'Last updated: August 20, 2026'). **실측은 14를 반환한다.** 문서가 낡았다.
마찬가지로 `aspect_ratio`의 `auto`는 이미지에만 있고 비디오에는 없는데,
우리 코드는 비디오 기본값을 auto로 두고 전송 시 생략하는 방식으로
이미 올바르게 처리하고 있다.

## 현재 코드와의 델타

| # | 항목 | 현재 코드 | 실측/문서 | 영향 |
|---|---|---|---|---|
| D1 | ref2v 레퍼런스 상한 | `MAX_REF2V_REFERENCES = 7` | **14** | 사용자가 쓸 수 있는 레퍼런스의 절반을 잃는다 |
| D2 | ref2v 길이 상한 | 모델 무관 15초 | 1.5=15s, **base=10s** | base + 11초 요청이 업스트림 400으로 실패한다 |
| D3 | `reference_audios` 모델 가드 | 1.5 전용 (정확) | 동일 | 이미 맞음 |
| D4 | 날짜 별칭 | `-preview`만 | `-2026-05-30` 추가 | 유효 모델이 `INVALID_GROK_VIDEO_MODEL`로 거부된다 |
| D5 | 이미지 편집 입력 상한 | registry `edit: 3` | **5** | 첨부 트레이가 2장을 덜 받는다 |
| D6 | 이미지 종횡비 | `21:9` 부분 지원, `5:2` 없음 | 둘 다 유효 | 선택지 누락 |
| D7 | quality 열거 | low/medium 중심 | low/medium/**high/auto** | auto 기본값 변경 미반영 |
| D8 | `grok-imagine-image-quality` | 기본 폴백 모델로 사용 | 11/2 폐기 예정 | 폐기 후 조용히 다른 모델로 서빙된다 |
| D9 | capabilities 광고 | `maxReferences: 7`, ref2v 15s | 14 / 모델별 | 클라이언트가 광고를 믿으면 틀린 UI를 그린다 |
| D10 | 스킬 문서 | 'max 7 refs', '2-7' | 14 | 에이전트가 잘못된 상한을 학습한다 |

D8은 이번 스코프에서 **경고만** 남긴다. 모델 폐기 대응은 별도 판단이 필요하고,
11월 2일까지 시간이 있다.

## 판정

사용자의 보고는 맞다. 다만 정확히는 'ref2v 사양이 바뀌었다'이고, '1.5 중간
태그가 늘었다'는 날짜 별칭 1건이다. 그리고 조사하면서 **이미지 레인 쪽에 더 큰
미반영 델타(D5-D8)** 가 드러났다. 총 10개 델타를 WP2-WP5로 나눠 반영한다.

## 부록 — 동영상 입력 (V2V) 실측

'동영상 인풋은 아직 못 받나'라는 질문에 맞춰 별도로 확인했다. 답은 **받는다.**
단 생성 엔드포인트가 아니라 편집/연장 엔드포인트이고, base 모델 전용이다.

| 시나리오 | 결과 |
|---|---|
| `/v1/videos/edits` + **1.5** | **400** `Video editing is not supported for this model.` |
| `/v1/videos/edits` + base | **200** |
| `/v1/videos/extensions` + **1.5** | **400** `Video extension is not supported for this model.` |
| `/v1/videos/extensions` + base | **200** |
| `/v1/videos/generations` + `video` 필드 | 무시됨 (duration 검증까지 진행) |
| 연장 duration 0 | **400** `Duration must be between 1 and 15 seconds` |
| 연장 duration 1 / 2 / 10 / 11 | **200** |
| 연장 duration 16 | **400** 같은 메시지 |

모델 목록의 `input_modalities`가 이 분기를 그대로 설명한다. base는
`text, image, video`, 1.5는 `text, image, audio`다. 두 모델은 서로 다른 입력
모달리티로 갈라져 있고, 1.5로 영상을 편집하는 경로는 존재하지 않는다.

### 델타 D11 — 연장 길이 안내가 틀렸다

`bin/commands/video.ts`가 `--duration <2-10>`, 'Extension: 2-10s'라고 안내하고
OpenAPI `ExtendVideoRequest`도 '(2-10)'이라고 적었지만, **실측은 1초와 11초를
모두 200으로 받고 0초와 16초에서만 400**을 낸다. 실제 경계는 생성과 같은
1-15초다. 문서(우리 것과 xAI 것 모두)가 실제보다 좁게 적혀 있다.

`edit`에 `duration`이나 `resolution`을 실어도 400이 나지 않는다. 스키마에 없는
필드라 무시되는 것으로 보이며, 출력은 소스 영상의 값을 따른다는 기존 기술과
모순되지 않는다. CLI의 '입력 mp4 최대 8.7초'는 우리 자체 측정값이고 업스트림이
강제하는 값이 아니므로, 그 성격을 문서에 분명히 적는다.

