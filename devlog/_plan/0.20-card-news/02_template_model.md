# 02 Template Model

## 3층 모델

사용자가 말한 템플릿은 실제 이미지 asset이 1순위다. 기획 구조는 별도 이름으로 분리한다.

| Layer | 의미 | UI |
|---|---|---|
| Image Template | 실제 카드 배경/프레임 이미지 asset | 썸네일 grid + `+ New Image Template` |
| Role Node Template | 카드 역할/장수/흐름 구조 | short/mid/long + role chips |
| Content Prompt | 유저 주제/자료/레퍼런스 | textarea + refs 최대 5장 |

## Image Template

```ts
type ImageTemplate = {
  id: string;
  name: string;
  size: "2048x2048" | "3840x3840" | "2048x2560" | "2160x3840";
  previewFilename: string;
  baseFilename: string;
  stylePrompt: string;
  negativePrompt?: string;
  slots: TemplateSlot[];
  palette?: string[];
  typography?: TemplateTypography;
  recommendedRoleNodeIds: string[];
  createdBy: "system" | "user";
};
```

`slots`는 MVP에서 자동 추론하지 않는다. 기본 slot preset으로 시작한다.

```text
Top title / center visual / bottom CTA
Left visual / right text
Full image / bottom caption
Number stat / explanation / CTA
```

## Built-in Image Templates

MVP는 5개 정도가 적당하다.

| ID | 용도 | 디자인 방향 | 기본 size |
|---|---|---|---|
| `clean-report-square` | 리포트/요약 | 흰 배경, 얇은 라인, 숫자 강조 | 2048x2048 |
| `bold-hook-square` | 후킹/커뮤니티 | 큰 제목 영역, 강한 대비, 중앙 비주얼 | 2048x2048 |
| `academy-lesson-square` | 교육/설명 | 현대적 학습 카드 | 2048x2048 |
| `product-promo-square` | 제품 홍보 | 제품 hero zone + 하단 CTA | 2048x2048 |
| `premium-briefing-4k` | 고급 브랜드/병원/전문직 | 여백, 이미지 영역, restrained palette | 3840x3840 |

## Role Node Template

여기서 node는 graph node가 아니라 카드 역할 node다.

```ts
type RoleNodeTemplate = {
  id: string;
  name: string;
  defaultCount: 3 | 5 | 8;
  roles: Array<{
    role: "cover" | "hook" | "problem" | "data" | "tip" | "example" | "summary" | "cta";
    required: boolean;
    promptHint: string;
    preferredSlots: string[];
  }>;
};
```

기본 preset:

```text
Short 3:
hook -> core -> CTA

Mid 5:
cover -> problem -> insight -> example -> CTA

Long 8:
cover -> problem -> data -> tip1 -> tip2 -> example -> summary -> CTA
```

## Content Prompt

필드:

```text
주제
대상 독자
목표
톤
반드시 포함할 내용
금지할 내용
참고 이미지 최대 5장
참고 텍스트/URL
```

참고 이미지 역할:

```text
ref 1: 제품/인물
ref 2: 브랜드 무드
ref 3: 자료 스크린샷
ref 4: 경쟁 카드뉴스 예시
ref 5: 색감/구도 참고
```
