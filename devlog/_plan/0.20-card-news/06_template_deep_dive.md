# 06 Template Deep Dive

## 핵심

Image Template은 실제 이미지 asset과 metadata를 함께 가진다. 이미지 파일만 있으면 Codex planner가 어디에 headline/body/CTA를 넣어야 할지 모른다.

## Template Asset Bundle

```text
image-template/
  preview.png
  base.png
  template.json
```

`template.json`:

```json
{
  "id": "clean-report-square",
  "name": "Clean Report Square",
  "size": "2048x2048",
  "stylePrompt": "clean editorial report card, white background, subtle grid, strong numeric focus",
  "negativePrompt": "busy layout, tiny text, excessive decoration",
  "slots": [
    { "id": "title", "kind": "title", "x": 160, "y": 160, "w": 1728, "h": 260, "required": true },
    { "id": "visual", "kind": "image", "x": 160, "y": 500, "w": 1728, "h": 980, "required": true },
    { "id": "cta", "kind": "cta", "x": 160, "y": 1620, "w": 1728, "h": 260, "required": false }
  ],
  "recommendedRoleNodeIds": ["report-mid", "summary-short"]
}
```

## Template 생성 프롬프트

`+ New Image Template`는 일반 이미지 생성과 다른 프롬프트를 써야 한다.

좋은 생성 조건:

- card frame / layout 중심
- text-free or minimal placeholder
- safe empty areas
- consistent palette
- no tiny illegible typography
- reusable background, not one-off illustration

나쁜 생성 조건:

- 특정 문구를 이미지 안에 직접 넣으라고 함
- 본문 텍스트까지 이미지 모델에 맡김
- 매 카드마다 layout이 달라짐
- 배경과 텍스트 영역이 구분되지 않음

## 템플릿 적용 방식

카드별 최종 visual prompt는 아래처럼 조립한다.

```text
imageTemplate.stylePrompt
+ roleNode.promptHint
+ card.visualPrompt
+ reference image instructions
+ size/platform constraints
+ imageTemplate.negativePrompt
```

이때 headline/body는 이미지 프롬프트에 짧게만 반영하고, 실제 본문은 sidecar로 보관한다.

0.20 MVP에서 템플릿은 모든 카드 생성 요청의 공통 i2i 기준 이미지다.

```text
base.png + card visual prompt + role hint → generated card
```

각 카드는 같은 `base.png`를 참조하지만, 서로의 생성 결과를 참조하지 않는다.

```text
좋음:
base.png → card-01.png
base.png → card-02.png
base.png → card-03.png

기본값으로 피함:
card-01.png → card-02.png → card-03.png
```

순차 chain은 동일 캐릭터/제품 연속성이 필요한 특수 세트에서만 `Continuity mode`로 검토한다.

## 왜 safe area 자동 검출을 미루는가

초기부터 safe area 자동 검출을 넣으면 이미지 분석, 좌표 보정, UI editor가 모두 필요하다. MVP에서는 slot preset을 먼저 제공하는 편이 낫다.

초기 slot preset:

```text
top-title-center-image-bottom-cta
left-visual-right-copy
full-bleed-image-bottom-caption
stat-number-explanation-cta
```

## 나중에 붙일 기능

- template variant generation
- brand kit import
- palette lock
- typography lock
- safe area editor
- contact sheet
- platform resize
