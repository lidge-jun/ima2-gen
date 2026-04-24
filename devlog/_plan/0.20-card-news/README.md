# 0.20 Card News Plan

> 작성일: 2026-04-24 KST
> 상태: research
> 범위: `image_gen`에 Card News mode를 추가하기 위한 제품/기술 조사.

## 문서 구조

| 파일 | 목적 |
|---|---|
| `01_market_research.md` | Canva, Adobe Express, Gamma, 미리캔버스, Instagram carousel 패턴 조사 |
| `02_template_model.md` | Image Template asset, Role Node Template, Content Prompt 3층 모델 |
| `03_workflow.md` | 사용자가 실제로 카드뉴스를 만드는 UX 흐름 |
| `04_architecture.md` | 현재 코드베이스에 맞춘 backend/frontend 구조 |
| `05_implementation_plan.md` | 구현 단계, 리스크, MVP 범위 |
| `06_template_deep_dive.md` | 이미지 템플릿 asset 중심 후속 조사 |

## 핵심 결론

Card News는 Node mode의 graph 위에 얹지 말고 별도 mode로 만든다.

```text
Classic | Node | Card News
```

이유:

- Node mode는 이미지 변형과 lineage 추적에 강하다.
- Card News는 순서 있는 카드 세트, 카드별 역할, 문구, 일괄 생성, export가 핵심이다.
- graph로 억지 표현하면 reorder, cover card, CTA, manifest, batch retry가 어색해진다.

## 제품 모델

Card News는 아래 세 가지 입력이 합쳐져야 한다.

```text
Image Template  +  Role Node Template  +  Content Prompt
      ↓                    ↓                    ↓
              Codex Planner JSON Draft
                         ↓
                Reviewable Card Deck
                         ↓
                 Batch Image Generate
                         ↓
                 Export Bundle / ZIP
```

## MVP 방향

- 실제 2048/3840 이미지 템플릿 asset 제공
- `+ New Image Template`로 사용자 템플릿 생성
- short/mid/long role node template 제공
- content prompt + 참고 이미지 최대 5장
- Codex CLI wrapper가 먼저 JSON outline 생성
- 사용자가 카드별 headline/body/visualPrompt 검토
- lock/reorder/regenerate 가능
- batch generate
- ZIP export + `manifest.json`

## MVP에서 제외

- Canva식 완전 drag editor
- safe area 자동 추론
- 긴 한국어 본문을 이미지 생성 모델에 직접 렌더링
- scheduler/social posting
- 모든 플랫폼 resize 동시 지원

## 참고

이 폴더는 `devlog/` 아래라 repo에서 ignored 상태다. 커밋하려면 `git add -f devlog/_plan/0.20-card-news/...`가 필요하다.
