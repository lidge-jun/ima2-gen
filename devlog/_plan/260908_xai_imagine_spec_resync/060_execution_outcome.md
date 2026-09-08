---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, verification, closeout]
---

# 060 — 실행 결과와 검증 기록

로드맵(010-050)을 실행한 결과다. 계획과 달라진 지점, 구현 중에 드러난 사실,
그리고 확인하지 못한 채 남긴 것을 함께 적는다.

## 커밋

| 커밋 | 내용 |
|---|---|
| `005493f6` | 조사 + difflevel 로드맵 (docs-only, 32 files) |
| `b8a0b5ca` | 서버 계약: 상한 14, 모델별 ref2v 길이, 별칭, 오디오 단독 ref2v, 이미지 5장 |
| `2307ba63` | 연장 길이 2-10 -> 1-15 (라우트 + CLI) |
| `a164e4b5` | UI 길이 상한, clamp/토스트, UI 별칭 동기화 |
| `34c0ac26` | 드래그앤드랍 모드별 분류와 거부 사유 |
| (본 커밋) | VoicePicker + 문서 전수 정정 |

## 최종 게이트

```
npm run typecheck        clean
npm run typecheck:tests  clean
npm test                 2810 pass / 0 fail
npm run test:inventory   clean
cd ui && npm run build   ✓
```

050의 종료 그렙(낡은 리터럴 잔존 검사)은 **0건**을 반환한다.

## 신규 회귀 테스트

| 파일 | 검사 |
|---|---|
| `xai-video-model-alias-contract` (5) | 별칭 3종이 모든 게이트에서 동일 동작, 서버/UI 값 동일성, comfy는 null |
| `dropped-media-sorting-contract` (8) | 모드별 파일 분류, 거부 사유 5종의 4개 언어 메시지 존재 |
| `voice-picker-contract` (7) | 로스터가 서버에서 옴(하드코딩 0), 상한 3, base 비활성, AUDIO 인덱스 |
| `video-duration-per-model-contract` 상당 | 기존 260820 테스트를 모델별 상한 검사로 반전 |

## 계획과 달라진 것

### 1. 전역 상한이 provider 상한을 가린다 (계획에 없던 발견)

grok 이미지 상한을 5로 올리자 서버 전역 `limits.maxRefCount`(5)와 같아졌다.
그 결과 6장 요청에서 `GROK_REF_TOO_MANY`가 아니라 전역 `REF_TOO_MANY`가 먼저
걸린다. 테스트를 실제 순서에 맞췄지만, **구조 자체는 그대로 남았다** —
provider 상한이 전역 상한보다 크거나 같으면 provider 메시지는 영원히 도달하지
않는다. 지금은 두 값이 같아 무해하지만, 다음에 xAI가 7장으로 올리면
`maxRefCount`도 함께 올려야 한다는 숨은 결합이다.

### 2. 스킬 문서에 실측이 반증한 주장이 하나 더 있었다

`skills/ima2/SKILL.md:1274`가 "연장 범위 밖 duration은 200을 받고 poll에서
비동기 실패한다"고 적고 있었다. 실측은 11초가 그냥 성공하고 0과 16만 400을
낸다. 감사 인벤토리에 없던 항목이고, 문서를 읽다가 발견했다.

### 3. GUI 동영상 입력은 안내로 대체했다

영상 드롭 시 편집/연장 UI를 띄우는 대신 CLI 경로를 안내하는 토스트를 넣었다.
편집/연장 라우트는 이미 존재하지만 GUI 진입점을 만들려면 소스 슬롯, 모드 선택,
결과 처리까지 필요하고 이는 별도 유닛 규모다. **현재 상태는 "안 된다"가 아니라
"여기가 아니라 CLI에서 된다"를 말한다.**

### 4. 컴포넌트 분리는 저장소 규약이 강제했다

`PromptComposer.tsx`의 500줄 예산과 i18n literal-key 가드 때문에 드롭 처리를
`useComposerDrop` 훅으로, 거부 사유 매핑을 lookup table에서 exhaustive switch로
바꿔야 했다. 결과적으로 더 나은 구조가 됐다 — 가드가 옳았다.

## 확인하지 못한 채 남긴 것

이 목록을 적지 않으면 다음 사람이 이것들을 확인된 것으로 읽는다.

| 항목 | 왜 미확인인가 |
|---|---|
| `grok-api` 레인의 이미지 5장 | 프록시(oauth) 경로만 실측. 동일 업스트림 가정을 registry 주석에 명시 |
| 편집/연장의 추가 필드 수용 | 안전한 트립와이어 부재 — `video`가 required이고 채우면 200 과금 |
| 업로드 오디오 클립 | 'trusted partners on request' 게이팅. 우리 계정 등급 불명 |
| `generate_audio` | 가이드에만 있고 REST/OpenAPI에 없음. 실측 없이 구현 안 함 |
| I2V `aspect_ratio` 실동작 | 문서 두 곳이 정면 충돌(무시 vs 덮어쓰기). 추측 금지 |
| 숨은 엔드포인트 부재 | POST/GET 두 메서드, 비인증 경로 하나만 확인 |

## 후속 일정이 있는 항목

**`grok-imagine-image-quality`는 2026-11-02에 폐기된다.** 폐기 후 요청은
`grok-imagine-image-2.0` + `quality: low`로 서빙된다. 우리는 이 모델을 세 곳에서
기본 폴백으로 쓰고 있다(`lib/grokImageAdapter.ts`). 이번에 바꾸지 않은 이유는
사용자의 기존 결과물과 단가가 조용히 달라지기 때문이고, 그건 사양 동기화가 아니라
제품 결정이다. **11월 전에 다시 봐야 한다.**

