---
created: 2026-08-21
tags: [ima2-gen, devlog, gpt-image-2, transparent-background]
---

# 000 — GPT-Image-2 투명 배경 라이브 프로브 결과

## 계기

OpenAI Developers 공지(2026-08-21): API에서 GPT-Image-2 투명 배경이 preview로 제공.
`image_generation` 툴에 `background: "transparent"`, 출력은 png(기본)/webp,
jpeg는 투명 배경과 함께 지원되지 않음. gpt-image-1.5는 이미 지원하던 기능이고
gpt-image-2가 이제 따라온 것.

## 프로브 (2026-08-21, 로컬 OAuth 프록시 127.0.0.1:10531)

### 1. `background:"transparent"` 강제 → 전 모델 400

```
gpt-5.6-luna  -> 400 Transparent background is not supported for this model. [invalid_value]
gpt-5.6-sol   -> 400 (동일)
gpt-5.6-terra -> 400 (동일)
gpt-5.5       -> 400 (동일)
gpt-5.4       -> 400 (동일)
gpt-5.4-mini  -> 400 (동일)
```

**대조군 (프록시가 파라미터를 삼키는 게 아님을 증명):**
```
zzz_bogus:"nope" -> 400 Unknown parameter: 'tools[0].zzz_bogus'. [unknown_parameter]
```
에러 종류가 다르다 = transparent 거부는 상류의 진짜 의미론적 거부이지
ima2/프록시의 스키마 누락이 아니다.

### 2. 원인 — OAuth 경로는 `gpt-image-2-codex`에 고정된다

응답의 tools 에코:
```json
{"type":"image_generation","background":"auto","model":"gpt-image-2-codex",
 "moderation":"low","n":1,"output_compression":100,"output_format":"png",
 "quality":"auto","size":"auto"}
```
ChatGPT OAuth(Codex) 세션은 `gpt-image-2-codex` 변형을 쓴다. 이 변형이
`background:"transparent"` **강제**를 거부한다. 툴에 `model`을 직접 넣어
gpt-image-2 / gpt-image-1.5를 요구해도 동일하게 400 (무시되고 codex 변형 유지).

### 3. 결정적 발견 — `background:"auto"` + 프롬프트 넛지는 **실제로 작동한다**

`auto`는 400이 아니라 200으로 통과하고 응답에 그대로 에코된다.
ima2 실제 생성 경로(`ima2 gen --provider oauth --model luna --mode direct`)로
컷아웃 프롬프트를 넣은 결과:

| 항목 | 값 |
|---|---|
| format | png |
| channels | **4** |
| hasAlpha | **true** |
| 완전 투명 픽셀 | **720,330 / 1,571,940 (45.82%)** |
| 부분 투명(안티에일리어싱) | 851,165 |
| 완전 불투명 | 445 |
| 코너 TL/TR/BL/BR alpha | **0 / 0 / 0 / 0** |

**VERDICT: REAL TRANSPARENCY.**
증거 파일: `evidence/oauth-nudge-apple.png`,
매트 합성 확인본 `evidence/oauth-nudge-apple-magenta-matte.png`.

### 4. 대조군 — 넛지가 레버라는 증명

같은 경로·같은 설정에 장면 프롬프트("나무 식탁 위 사과, 사진 배경"):
```
format=png channels=3 hasAlpha=false -> NO ALPHA CHANNEL
```
즉 알파는 항상 붙는 게 아니라 **프롬프트 의도에 따라 모델이 선택**한다.
`background:"auto"`는 그 선택을 허용하는 스위치다.

## 결론 — 정정

초기 판단("OAuth 경로는 투명 배경 불가, Atlas Cloud API 키가 있어야 함")은 **틀렸다**.
정확한 결론:

| 경로 | `background:"transparent"` 강제 | `background:"auto"` + 넛지 |
|---|---|---|
| OAuth (gpt-image-2-codex) | 400 거부 | **동작. 실제 알파 확인** |
| Atlas Cloud (gpt-image-2 API) | 지원 예상(공지 기준), 미검증 — API 키 없음 | — |

**따라서 이 기능은 API 키 없이 오늘 바로 출시 가능하다.**

## ima2의 현재 격차

1. `lib/responsesTools.ts` `ImageGenOptions`에 `background`가 아예 없다 →
   ima2는 이 파라미터를 **한 번도 보낸 적이 없다**. 위 성공은 프록시 기본값
   `auto`에 우연히 올라탄 결과이고, 사용자가 제어할 수단이 없다.
2. `lib/backgroundPresets.ts`는 chroma-green/white/black 3종뿐 —
   "단색 배경 뒤 색상 키로 제거" 우회 전략 전용. `transparent`가 없다.
3. `lib/atlasCloudImageAdapter.ts:206`이 `output_format: options.outputFormat || "jpeg"`로
   하드코딩 — jpeg는 알파를 담을 수 없어 gpt-image-2 API 경로는 **구조적으로** 투명 불가.
   `outputFormat`은 어떤 호출자도 넘겨주지 않는다(전 저장소에서 이 2줄이 유일한 등장).
4. 문서가 반대로 적혀 있다 (이제 사실이 아님):
   - `skills/ima2/SKILL.md:266` "GPT Image 2 does not reliably produce true transparent (alpha) backgrounds."
   - `skills/ima2-front/references/asset-requirements.md:325-328` 동일 주장 + solid-bg-then-remove 강제
   - `skills/ima2-uiux/SKILL.md` "solid-bg-then-remove is mandatory"
   - `lib/promptImport/gptImageHints.ts:47` 투명 요청 시 `transparent-unsupported-gpt-image-2` 경고 방출

