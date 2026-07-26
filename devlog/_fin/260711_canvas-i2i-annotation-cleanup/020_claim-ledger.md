# 020 — Claim Ledger (sol 탐사대 2기, 2026-07-11)

cxc-search ladder 준수. Tier 2 = 원문 열람 확인. 두 탐사대 모두 hosted
`web_search` 404로 native browser fallback 사용(반환문에 명시).

## E1 Archimedes — 주석 이미지 i2i 편집 지침

| Claim | 출처 | Tier |
|---|---|---|
| 벤더 공식에 화살표/노트 전용 문법은 없음 — "Change only X. Keep everything else exactly the same" + 원치 않는 텍스트/변경 금지가 공식 패턴 | https://openai.com/academy/image-generation/ (2026-04-10) | T2 |
| Gemini 공식 시맨틱 마스킹 템플릿도 clean 소스 + "change only... keep everything else exactly the same" | https://ai.google.dev/gemini-api/docs/image-generation | T2 |
| Adobe/Imagen 공식 구조는 마크업을 픽셀에 굽지 않고 selection/mask 메타데이터로 분리 — clean 소스 + 텍스트 지시 아키텍처의 간접 증거 | https://helpx.adobe.com/sg/firefly/web/work-with-images/edit-images/generative-fill.html (2026-06-19) | T2 |
| practitioner 문구: "Follow and remove the annotations marked on the image; ... Do not change any other part" | https://www.rundiffusion.com/multi-image-prompt-guide | T2 |
| 비렌더링 규칙은 편집 목록 앞에 두고 뒤에서 한 번 반복; "ignore annotations"는 모호(지시 의미까지 무시할 수 있음) | 종합 (T2 근거) | T2 추론 |
| 시각 지시 편집은 아직 미성숙 (17모델 벤치마크 "early-stage") → 프롬프트만으로 보장 불가, 검증/재시도 필요 | https://arxiv.org/abs/2602.01851 (2026-05-21) | T2 |
| 구운 주석을 자동으로 "출력 제외 지시"로 인식하는 보장 메커니즘은 어느 벤더에도 문서화 안 됨 | 종합 | T2 추론 |

## E2 Aristotle — 제거 편집 프롬프트

| Claim | 출처 | Tier |
|---|---|---|
| OpenAI 마스크 편집 공식 예시는 편집 후 전체 장면을 서술 ("A sunlit indoor lounge area with a pool containing a flamingo") | https://developers.openai.com/api/docs/guides/image-generation | T2 |
| OpenAI 선택 영역은 픽셀 잠금이 아님 — "edits may extend beyond the area you selected" | https://help.openai.com/en/articles/11084440-chatgpt-image-library | T2 |
| 제거는 "remove X"보다 대체 배경의 긍정 기술이 권장 — "focus your prompt on describing the background that should replace it" | https://runware.ai/docs/learn/image-inpainting | T2 (vendor) |
| 마스크는 제거 대상의 모든 시각 흔적(획·테두리·그림자)을 덮되 최소 확장 | https://docs.aws.amazon.com/nova/latest/userguide/prompting-image-inpainting.html | T2 |
| 실패 시 프롬프트 증량보다 다중 후보 → 최선 선택 → 잔존부만 2차 편집 → 반복 무늬면 결정적 도구 전환 | Adobe Firefly/Content-Aware Fill 문서 | T2 |
| 보존 조건과 재구성 조건을 분리 서술 (preserve exactly / reconstruct matching texture-perspective-illumination / no residue) | 종합 | T2 |

## 반영 매핑

| 반영 | 근거 |
|---|---|
| memoPrompt 서두 "temporary editing instructions ... not image content" | E1 (비렌더링 규칙 선행 배치, RunDiffusion 패턴) |
| memoPrompt 말미 "remove all annotation markup ... reconstructed to match the surrounding texture, lighting, and perspective, with no residue" | E1 + E2 (제거+재구성+잔존물 금지) |
| memoPrompt 보존 조항 "Keep everything not named ... exactly the same" | E1 (OpenAI/Gemini 공식 페어) |
| L1/L2 clean 소스 라우팅 | E1 (clean 소스 + 텍스트 지시가 가장 안전한 프로덕션 설계) |
| 컴포저 칩(G2) | E1 (주석 의도를 텍스트 지시로 변환해 전달) |
| PROMPT_STUDIO 문서 "무엇이 보여야 하는지로 서술 + 다중 후보 + 잔존부 재편집" | E2 |
| SKILL.md Annotated inputs / Removal edits 섹션 | E1 + E2 |
