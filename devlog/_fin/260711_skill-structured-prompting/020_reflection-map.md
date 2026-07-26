# 020 — Reflection Map (claim → SKILL.md 편집)

원칙: Tier-2 확인 claim만 반영. `tests/cli-skill-command-contract.test.js`가
고정한 문구는 전부 보존. 편집 대상은 `skills/ima2/SKILL.md`.

| # | 반영 내용 | 근거 claim (010 참조) | 위치 |
|---|---|---|---|
| R1 | "Structured Prompt Contract" 도입: 모든 에이전트 프롬프트는 라벨 섹션 브리프로 작성. 공식 순서(scene → subject → key details → constraints)를 기본값으로, identity/product 중심 작업은 subject-first 허용. 필드 순서 = 우선순위 신호 | E2 Russell (OpenAI 1.5 guide, FLUX) | Agent Image Prompt Protocol 서두 |
| R2 | Attribute-binding 규칙: 객체 속성은 객체 옆에 붙이고 공간 관계(foreground/behind/left)를 명시 | E1 Gibbs (4o 발표문) | Specificity Rules 앞 |
| R3 | 안티패턴 표 추가: keyword soup, 무동기 품질 토큰(8K/masterpiece), 모순 제약, 정밀 스펙 맹신(mm/Kelvin은 look cue), JSON 포장 | E2, E5 (OpenAI/HF/FLUX) | Specificity Rules 뒤 |
| R4 | 네거티브 제약 규칙: GPT Image는 산문형("No extra text, no watermark") — 모델별 문법 상이(Imagen은 개념 나열) 명시 | E5 Harvey | 안티패턴 표 근처 |
| R5 | 텍스트 렌더링 강화: `EXACT, verbatim, no extra characters` + appears once + 인용부호/ALL CAPS + letter-by-letter(브랜드명) + medium/high quality + VISIBLE TEXT 구조 블록 | E3 Euclid (cookbook #2, #55) | Korean Text 섹션 앞/내부 |
| R6 | 로컬라이제이션 편집 규칙: 텍스트 외 전부 보존, verbatim 번역, 단어 추가 금지, reflow 회피 | E3 Euclid (#42) | 텍스트 섹션 |
| R7 | 구조화 편집 브리프 템플릿: Desired result / Change only / Preserve exactly(구체적 lock list) / Do not add-remove | E4 Hooke | Reference / I2I Workflows |
| R8 | 멀티 레퍼런스 규칙: 인덱스+역할 지칭(Image 1: ...), identity-critical 입력 첫 번째, 다수 얼굴은 합성 레퍼런스 1장 | E4 Hooke (high input fidelity cookbook) | Reference / I2I Workflows |
| R9 | 반복 규율 보강: 드리프트 감지 시 핵심 제약 재명시(공식 문구), 시작은 깔끔한 베이스라인 | E2/E3/E4 공통 | Prompt Iteration |
| R10 | (wave 2 대기) 비디오 프롬프트 구조 보강 | Locke | Structured Video Prompt Template 주변 |
| R11 | (wave 2 대기) 한글 렌더링 실전 사례 보강 | Boyle | Korean Text in Images |

보존 확인 대상(계약 테스트 고정 문구): `There is no \`--parallel\` flag`,
`generic OpenAI image-generation`, `GPT Image 2`, `exact words in the target
language`, `reduce garbled lettering`, `manga panel`, `webtoon style`,
`photorealistic product photo`, `not a typesetting engine`, `Structured Video
Prompt Template`, `duration pacing`, `beat structure scales with length`,
`Motivated movement`, `Dialogue`, `Settling final frame`, `no background
music`, `specific SFX`, `self-explanatory for continuation`, `Video
edit/extend: grok-imagine-video only`, `ima2 edit input.png --prompt`,
`--quality high`, `ima2 capabilities --json`, `ima2 defaults --json`.
