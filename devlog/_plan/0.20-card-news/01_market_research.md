# 01 Market Research

## 공통 패턴

시중 도구들은 거의 같은 구조를 가진다.

| 도구 | 관찰한 패턴 | Card News에 줄 시사점 |
|---|---|---|
| Canva | size preset, Brand Kit, Bulk Create, Magic Resize | 카드뉴스는 한 장보다 세트/캠페인 단위가 중요 |
| Adobe Express | social templates, generated template, page duplicate | 같은 프로젝트 안에서 page/card를 복제하며 일관성 유지 |
| Gamma | card를 presentation/document/webpage의 기본 단위로 모델링 | CardItem을 이미지 row가 아니라 문서 단위로 봐야 함 |
| 미리캔버스 | 카드뉴스 템플릿은 가독성과 전달력 중심 | 한국어 문구 구조와 읽기 흐름이 핵심 |
| Meta / Instagram | carousel은 여러 media를 한 post/ad로 묶음 | card count, order, cover, aspect ratio가 핵심 데이터 |

## Canva에서 가져올 점

Canva의 강점은 Brand Kit, Brand Templates, Bulk Create, Magic Resize 흐름이다. 핵심은 "한 장 만들기"가 아니라 같은 브랜드/레이아웃을 여러 카드와 여러 포맷으로 반복 적용하는 것이다.

Card News 적용:

- Image Template은 단순 프롬프트가 아니라 재사용 asset이어야 한다.
- Template metadata에 safe area, palette, text slots, recommended roles가 필요하다.
- 나중에 브랜드 키트와 연결할 수 있게 `brandRef`를 열어둔다.
- Bulk Create처럼 JSON outline을 여러 카드 이미지로 채우는 batch flow가 필요하다.

## Adobe Express에서 가져올 점

Adobe Express는 template 선택, upload/import, stock, AI, generated template, scheduler를 한 editor에 묶는다. Carousel은 같은 프로젝트 안에서 page를 duplicate하면서 aesthetic/branding을 유지하는 방식이 중요하다.

Card News 적용:

- `+ New Image Template`는 "generate image"가 아니라 "generate reusable template"이어야 한다.
- 카드 output은 독립 이미지지만 편집 경험은 한 프로젝트 안의 deck이어야 한다.
- Duplicate/remix flow가 필요하다.
- Scheduler는 MVP 밖이지만 export metadata는 platform-ready하게 둔다.

## Gamma에서 가져올 점

Gamma는 card를 문서/발표/웹페이지의 building block으로 본다. Card News도 이미지 history가 아니라 card document로 다뤄야 한다.

Card News 적용:

- `CardItem`은 headline/body/role/visualPrompt/status를 가진 문서 단위다.
- 먼저 outline을 만들고, 이미지 생성은 나중에 붙인다.
- 카드 순서와 역할이 export manifest의 핵심이다.

## 참고 링크

- Canva Brand Kit: https://www.canva.com/pro/brand-kit/
- Canva Instagram sizes: https://www.canva.com/sizes/instagram/
- Canva Visual Suite / Bulk Create / Magic Resize: https://www.canva.com/newsroom/news/canva-create-2025/
- Adobe Express social post maker: https://www.adobe.com/express/create/post
- Adobe Express social media templates: https://www.adobe.com/express/collections/social-media-marketing
- Gamma cards: https://help.gamma.app/en/articles/11016396-what-are-cards-in-gamma-and-how-to-do-they-work
- Gamma export: https://help.gamma.app/en/articles/8022861-what-s-the-easiest-way-to-export-my-gamma
- Meta carousel ad format: https://www.facebook.com/business/ads/carousel-ad-format
