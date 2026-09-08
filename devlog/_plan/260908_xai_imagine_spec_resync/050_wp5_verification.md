---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, verification, wp5]
---

# 050 — WP5 최종 검증 및 종결

## 게이트

```bash
npm run typecheck
npm run typecheck:tests
npm test              # 1094+ cases
npm run test:inventory
cd ui && npm run build
```

전부 통과해야 한다. `test:inventory`는 새 테스트 파일이 레지스트리에 등재됐는지
검사하므로, 신규 테스트를 추가한 이번 유닛에서 특히 의미가 있다.

## 라이브 재확인

빌드는 코드가 컴파일된다는 증거일 뿐이다. 계약이 맞다는 증거는 실측이다.
WP2-WP4가 끝난 뒤 **다시 한 번** 프록시로 확인한다.

```
1. 레퍼런스 14장 + duration 16 -> 우리 서버가 400을 내는가, 아니면 xAI까지 갔다 오는가
   (우리가 먼저 막아야 한다: 시작 호출은 재시도되지 않으므로 예측 가능한 400은
    로컬에서 끝내는 게 사용자에게 이득이다)
2. base + ref2v + 11초 -> 로컬 400 INVALID_VIDEO_DURATION
3. grok-imagine-video-1.5-2026-05-30 로 요청 -> 정규화되어 통과
4. GET /api/capabilities -> maxReferences 14, durationRangeByModel 존재
5. GUI: 이미지/오디오/영상 드롭 3종 + 보이스 선택 (031 기록)
```

1-4는 로컬 서버만으로 확인 가능하고 과금이 없다. 5는 브라우저가 필요하다.

## 회귀 위험

이번 변경이 **깨뜨릴 수 있는** 기존 동작을 미리 적는다.

| 위험 | 왜 | 확인 |
|---|---|---|
| 260820의 '길이 클램프 금지' 테스트 | ref2v 길이 상한을 다시 넣는다 | 그 테스트를 모델별 상한 검사로 뒤집는다(010) |
| 트레이 캡 상향 | 14장 첨부 시 UI 레이아웃 | 실제로 14장 붙여본다 |
| 이미지 5장 상향 | grok 외 레인에 새지 않았는지 | registry 항목별 확인 |
| 드롭 분기 | 기존 이미지 드롭이 여전히 동작 | 회귀 테스트 |

## 종결

- `devlog/_plan/260908_xai_imagine_spec_resync/` -> `_fin/260908_...`
- `devlog/_plan/README.md`의 Active Lane 표 갱신
- `grok-imagine-image-quality` 11/2 폐기를 후속 항목으로 등재
- 미판정으로 남긴 것 명시: 편집/연장의 추가 필드 수용 여부(안전한 트립와이어 부재),
  업로드 오디오 클립의 계정 등급, `generate_audio` 필드

마지막 항목이 D 페이즈의 LOOP-PESSIMIST-01에 해당한다. 무엇을 확인하지 못했는지
적지 않으면 다음 사람이 그것들을 확인된 것으로 읽는다.



---

# 감사 반영 (002_wp1_audit.md) — 종료 그렙 게이트

로드맵대로 고쳐도 사본이 남으면 미완성이다. 다음이 **비어야** 종료다.

```bash
# ref2v 레퍼런스 상한 7
rg -n "Maximum allowed is 7|max 7 ref|최대 7|2-7|2–7" docs site skills tests lib ui routes bin

# 연장 2-10
rg -n "2-10|2–10|between 2 and 10" bin routes docs site skills tests

# 모델 무관 ref2v 15초
rg -n "MAX_REF2V_DURATION|ref2v.*15s" lib ui | rg -v "MAX_REF2V_DURATION_(15|BASE)"

# grok 이미지 편집 3장
rg -n "grok.*edit.*3|editing <= 3" lib ui tests docs
```

무관한 매치가 섞이므로 결과를 눈으로 확인하고, 남긴 것은 이유를 적는다.
(예: `docs/grok-video-i2v-research.md`는 과거 조사 기록으로 의도적 보존)

## 추가 회귀 확인

| 항목 | 확인 |
|---|---|
| comfy 비디오 요청이 Grok 길이/해상도 규칙에 걸리지 않는다 | A3 |
| 오디오만 있는 요청이 ref2v로 라우팅된다 | A8 |
| 11-15초 선택 후 base 전환 시 clamp + 토스트 1회 | A6 |
| grok-api 이미지 편집 5장 | A7 (실측 가능하면) |

