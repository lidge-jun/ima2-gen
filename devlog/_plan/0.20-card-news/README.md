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
| `10_frontend_delivery_gap.md` | 생성 결과가 기존 Classic/Node처럼 즉시 프런트 상태로 들어오지 않는 문제 |
| `11_gallery_session_history_gap.md` | Card News 결과가 갤러리/세션 히스토리에 기록되지 않는 문제 |
| `12_generation_progress_gap.md` | Card News 생성 중 spinner/progress/in-flight 표시가 없는 문제 |
| `13_codex_planner_json_output.md` | 하드코딩 scaffold 대신 Codex planner JSON output으로 초안을 만드는 문제 |
| `30_text_field_data_model.md` | 이미지에 실제 렌더링될 텍스트 박스 데이터 모델 |
| `31_language_preservation_policy.md` | 영어 강제/한국어 특례를 제거하고 입력 언어를 보존하는 planner 정책 |
| `32_rendered_text_prompting.md` | `headline` 자동 렌더링을 제거하고 `textFields` 기반 프롬프트 조립 |
| `33_frontend_text_box_ux.md` | raw textarea 중심 UI를 텍스트 박스 편집 UX로 전환 |
| `34_template_slot_labels.md` | 템플릿 slot에 placement/label/maxChars 의미 부여 |
| `35_text_field_contract_tests.md` | 30~34 변경을 고정하는 backend/frontend contract tests |
| `40_smoke_qa_harness.md` | 30~35 이후 실제 Card News wiring을 source-contract smoke로 검증 |
| `41_prompt_quality_iteration.md` | correctness 재작업이 아닌 planner 품질 corpus/rubric/prompt iteration |
| `42_frontend_editor_polish.md` | Card News editor UX를 제품 수준으로 다듬는 작업 |
| `43_gallery_export_reopen.md` | 이미 구현된 reopen을 기준으로 export/folder/gallery polish 확정 |
| `44_template_registry_authoring.md` | normalization 반복이 아닌 registry discovery/authoring/picker 전략 |
| `45_generation_control_retry_cancel.md` | retry/cancel/concurrency/cost control의 API/store/UI 계약 |
| `46_release_readiness.md` | npm global, package assets, feature flag, migration smoke 검증 |
| `47_docs_presets_public_ux.md` | 44 이후 docs, presets, public UX 정리 |

## 40-series 진행 순서

| 단계 | 상태 | 의존성 | 메모 |
|---|---|---|---|
| `40` | implemented | 30~35 | 실제 generation을 호출하지 않는 source-contract smoke safety net |
| `41` | implemented | 40 | prompt correctness가 아니라 output quality iteration |
| `42` | implemented | 40 | editor polish, selected text field UX 포함 |
| `43` | implemented | 40 | reopen baseline + manifest download/folder path polish |
| `44` | implemented | 40 | explicit registry와 authoring metadata 검증 |
| `45` | planned | 40 | cancel/retry/concurrency 계약을 먼저 고정 |
| `46` | planned | 40, 43, 44 | package/runtime 검증과 migration fixture |
| `47` | planned | 44, 46 | 실제 preset 추가는 44 registry 완료 후 진행 |

## 핵심 결론

Card News는 Node mode의 graph 위에 얹지 말고 별도 mode로 만든다.

```text
Classic | Node | Card News
```

이유:

- Node mode는 이미지 변형과 lineage 추적에 강하다.
- Card News는 순서 있는 카드 세트, 카드별 역할, 문구, 일괄 생성, export가 핵심이다.
- graph로 억지 표현하면 reorder, cover card, CTA, manifest, batch retry가 어색해진다.

생성 전략은 `template-guided parallel i2i`를 기본값으로 둔다.

```text
공통 image template asset + 공통 style context
        ↓
카드별 prompt / role / copy
        ↓
각 카드 독립 생성, 병렬 요청
```

여기서 i2i는 "이전 카드 결과를 다음 카드에 먹이는 순차 생성"이 아니라, 같은 이미지 템플릿 asset을 모든 카드의 공통 기준으로 쓰는 방식이다. 순차 i2i chain은 느리고 오류 전파가 커서 기본값으로 두지 않는다.

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
- built-in Image Template만 활성화
- `+ New Image Template`는 UI placeholder/disabled 상태로 두고 0.21로 보류
- short/mid/long role node template 제공
- content prompt + 참고 이미지 최대 5장
- structured-output planner가 먼저 JSON outline 생성
- 사용자가 카드별 headline/body/visualPrompt와 이미지에 표시될 text field를 검토
- lock/reorder/regenerate 가능
- template-guided parallel i2i batch generate
- 선택 카드 i2i regenerate
- sequential continuity mode는 고급 옵션으로 보류
- ZIP export + `manifest.json`

## MVP에서 제외

- Canva식 완전 drag editor
- safe area 자동 추론
- 긴 한국어 본문을 이미지 생성 모델에 직접 렌더링
- 완전한 deterministic text overlay editor
- scheduler/social posting
- 모든 플랫폼 resize 동시 지원
- npm package runtime 지원. 0.20 MVP는 `npm run dev` 개발 환경에서만 실행되도록 feature gate를 설정한다.

## 참고

이 폴더는 `devlog/` 아래라 repo에서 ignored 상태다. 커밋하려면 `git add -f devlog/_plan/0.20-card-news/...`가 필요하다.
