---
created: 2026-08-21
tags: [ima2-gen, devlog, gpt-image-2, transparent-background, review]
---

# 020 — 적대적 리뷰 5라운드 기록

sol medium 리뷰어(read-only)에게 5라운드 감사를 받았다. **FAIL 4회 → PASS.**
막아낸 결함은 전부 "테스트는 초록인데 사용자 데이터가 조용히 파괴되는" 종류였다.

## 라운드별 결과

| R | 대상 | 판정 | 핵심 블로커 |
|---|---|---|---|
| 1 | d7f6def4 | FAIL | 알파 가드가 잘못된 필드를 감시 / 불가능 레인이 요청 수락 |
| 2 | f5410e13 | FAIL | Atlas가 응답 헤더 MIME으로 알파 안전 포맷을 덮어씀 |
| 3 | 9e58c60c | FAIL | 진짜 JPEG 바이트는 여전히 통과 |
| 4 | df5c5f74 | FAIL | 검증기가 컨테이너 능력만 확인(false positive) |
| 5 | a961f0a6 | **PASS** | — |

## 라운드 1 — 필드 불일치

정규 요청 필드는 `format`인데 나는 아무도 보내지 않는 `req.body.outputFormat`을
검증했다. 그래서 `format:"jpeg"` + transparent가 통과 → 업스트림엔 PNG 요청 →
저장은 JPEG → `embedImageMetadata`의 `sharp.toFormat()`이 알파를 평탄화.
**요청한 투명도를 저장 단계가 파괴하는 경로였다.**

또한 Grok/Gemini/Agy/MiniMax는 background 파라미터가 없고 분기가 JPEG를
강제하는데도 transparent 요청을 받아 **불투명 이미지에 과금**할 수 있었다.

## 라운드 2 — 한 단계 아래에서 뒤집힘

`effectiveFormat`을 png로 고정했지만, 그 아래 `resultFormat`이 provider가 보고한
MIME으로 재계산된다. Atlas는 그 MIME을 다운로드 응답의 Content-Type 헤더에서
가져온다. 헤더가 `image/jpeg`면 투명 PNG가 다시 JPEG로 인코딩된다.
→ 알파 요청 시 **헤더 무시하고 매직바이트**로 판정하도록 수정.

## 라운드 3 — 라벨이 아니라 실제 바이트

매직바이트 판정은 "잘못 라벨된 PNG"만 막는다. provider가 의미적으로는 요청을
수락하고 **진짜 JPEG 바이트**를 반환하면 여전히 통과했다.
→ 저장 전 알파 검증 도입.

## 라운드 4 — 능력 ≠ 투명도 (가장 중요한 지적)

헤더 기반 검증기는 PNG IHDR colorType 4/6과 WebP VP8L/VP8X를 보고 통과시켰다.
리뷰어 지적: 그건 **컨테이너가 알파를 담을 수 있다**는 증명이지
**이 이미지가 투명하다**는 증명이 아니다.

재작성 전에 실측으로 재현했다:

```
RGBA-but-fully-opaque png:
  sharp hasAlpha (container) = true
  minimum alpha across pixels = 255
  bufferCarriesAlpha verdict  = {"hasAlpha":true}
  >>> FALSE POSITIVE CONFIRMED
```

`buffer.includes("tRNS")`가 청크 파싱이 아니라는 지적, VP8X는 확장 컨테이너
표시일 뿐이라는 지적도 모두 정확했다.

→ **실제 픽셀 디코딩**으로 재작성. 알파 바이트가 전부 255면 `fully-opaque`로
거부. 한 픽셀이라도 255 미만이면 통과(유리·머리카락·안티에일리어싱 보존).
디코드 실패는 "투명하다고 가정"하지 않고 `undetectable`로 거부.

또한 배치 부분 저장 문제: 검증을 쓰기 루프 **이전**으로 옮겨, 뒤 이미지가
실패했는데 앞 이미지 파일만 남는 상황을 원천 차단했다.

## 남은 경계 (비차단, 리뷰어 확인)

16-bit 투명도가 8-bit raw 출력에서 255로 양자화되는 극단적 경우, 또는 애니메이션
후반 프레임에만 투명도가 있는 경우는 거부될 수 있다. 정적 이미지 출력 계약에는
해당하지 않는다.

## 배운 것

소스 정규식 테스트는 **함수 이름이 바뀌면 깨지지만, 배선이 죽어도 초록이다.**
실제 HTTP 파이프라인을 태우는 `transparent-background-route.test.ts`를 넣자마자
jpeg 가드와 webp 통과가 **아예 동작하지 않고 있었다**는 걸 즉시 잡아냈다
(오래된 컴파일 `.js`가 로드되고 있었다). 정규식 테스트는 전부 초록이었다.

