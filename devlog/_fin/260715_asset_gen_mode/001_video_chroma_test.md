---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, feasibility, chroma, video]
status: 실행 중 — 첫 비디오 테스트 2026-07-15 발사
---

# 001 — 크로마 feasibility 테스트 프로토콜 + 결과

이 유닛에서 가장 위험한 가정을 검증한다: **프롬프트만으로 키잉 가능한 수준의
균일 그린 배경이 나오는가.** 특히 비디오(프레임 간 흔들림)가 게이트.

## 프로토콜

### T1 — Grok 비디오 (게이트, Q4 결정 근거)

```bash
node bin/ima2.js video "A single red apple slowly rotating in place, perfectly centered, \
  on a completely uniform solid chroma key green background, pure flat green like a \
  professional green screen, flat even studio lighting, no shadows cast on the background, \
  no camera movement, no background texture" \
  --duration 5 --resolution 720p --aspect-ratio 1:1 -d <출력디렉토리>
```

측정 (ffmpeg 프레임 추출 후 sharp/PIL 픽셀 샘플):

- 프레임 0/중간/끝 3장에서 배경 영역(모서리 4점 + 변 중앙 4점, 피사체 제외) RGB 샘플
- 판정 기준: G 채널 우세(G > R+40, G > B+40) 샘플 비율 ≥ 95%, 프레임 간 배경 평균색 드리프트 ΔRGB ≤ 15
- 실패 시: 프롬프트 강화 1회 재시도 → 그래도 실패면 비디오 스코프 제외 권고

### T2 — GPT 이미지 크로마

```bash
node bin/ima2.js gen "flat vector icon of a blue water droplet, on a completely uniform \
  solid chroma key green background, no shadows, no gradient" --size 1024x1024
```

### T3 — Grok 이미지 크로마 (T2와 동일 프롬프트, provider만 grok)

### T4 — GPT 네이티브 투명 (Q2 조사와 연동)

현 생성 경로가 `background: transparent`를 통과시키는지 코드 조사 후, 가능하면
API 직접 호출로 알파 PNG 산출 확인.

## 판정 매트릭스

| 결과 | 플랜 반영 |
|---|---|
| T1 통과 | 비디오 1차 스코프 포함 (Q4=포함) |
| T1 실패, T2/T3 통과 | 이미지만 1차, 비디오는 후속 연구 |
| T2/T3도 불균일 | 크로마 대신 GPT 네이티브 투명 우선 + Grok는 white/black만 |

## 결과 기록

### 2026-07-15 T1 실행 1차 — **PASS**

- 조건: grok video, 720p, 5s, 1:1, 사과 회전 + 크로마 그린 프롬프트 (프로토콜 원문)
- 소요: 51.2s, 산출물 `1784048388456_761fc841.mp4` (xai request `9cd6e6d2-dd8c-9536-9ec1-21af69fe8516`)
- 측정 (프레임 0/60/119, 배경 8점 샘플링, sharp raw):
  - green-dominant: **24/24 (100%)** — 기준 ≥95% 통과
  - 프레임 간 배경 평균색: [46,179,47] → [48,178,47] → [48,178,47], **ΔRGB ≤ 2** — 기준 ≤15 통과
  - 프레임 내 편차: G 168–188 (모서리↔변 완만한 조명 기울기), 표준 키어 tolerance로 충분히 흡수 가능
- 육안: 순수 그린스크린 품질. 피사체 하단 접촉 그림자만 존재(정상, 키잉 무해)
- 판정: **비디오 1차 스코프 포함 가능 (Q4=포함 권고)**. 프롬프트 재시도 불필요

### 남은 실행: T2(GPT 이미지) · T3(Grok 이미지) · T4(GPT 네이티브 투명 조사)

### 2026-07-15 T2/T3 실행 — **PASS** (WP4)

- T2 GPT `--bg chroma-green`: 8/8 green-dominant, RGB≈[10,248,15] (순수 그린 수준)
- T3 Grok(플래너 재작성 경유): 8/8, [48,159,65] — constraint 라인 생존
- T4는 유저 확인으로 종결 (gpt-image-2 네이티브 투명 불가)

### 2026-07-15 비디오 n=3 재검증 — **PASS** (WP9, verify:chroma 스크립트)

| # | 피사체 | 생성 | 키잉(WebM 알파) |
|---|---|---|---|
| T1-2 | 세라믹 머그 (기물) | 24/24, ΔRGB≤1 | border-alpha0 8/8 ×3, center 255 |
| T1-3 | 금붕어 (생물) | 8/8 ×3, drift≤1 | 8/8 ×3, center 255 |
| T1-4 | "IMA2" 텍스트 로고 | 8/8 ×3, drift 0 | 8/8 ×3, center 255 |

발견/수정: (1) ffmpeg chromakey similarity 0.18은 저채도 피사체 과키잉 → 0.10
캘리브레이션(tolerance 40 매핑). (2) ffprobe pix_fmt는 VP9 알파를 못 봄(side-data)
→ 검증은 libvpx 디코드+픽셀 알파. (3) keyColor 미지정 API 호출이 순수 그린
기본값으로 무키잉 → 서버가 첫 프레임 모서리 자동 샘플로 수정 (WP9 회귀 수정).
