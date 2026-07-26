# 090 — Closeout (2026-07-11)

터미널 결과: **DONE** (검증 통과, 모든 criteria 충족)

## 반영 요약 (R1-R11 → skills/ima2/SKILL.md)

| # | 편집 | 근거 |
|---|---|---|
| R1 | `### Structured Prompt Contract` 신설 — 라벨 섹션 강제, 공식 필드 순서(scene→subject→details→constraints), 순서=우선순위 신호, JSON 포장 금지 | OpenAI 1.5 guide, FLUX docs (T2) |
| R2 | attribute-binding + 공간 관계 명시 규칙 (Contract 내) | 4o 발표문 (T2) |
| R3 | `### Prompt Anti-Patterns` 표 신설 — keyword soup, 무동기 품질 토큰, 정밀 스펙 맹신, 모순 제약, 전면 재작성 | OpenAI/HF/Imagen (T2) |
| R4 | 네거티브 제약 모델별 문법 경고 (GPT Image=산문형, Imagen=개념 나열) | OpenAI/Google (T2) |
| R5 | verbatim 텍스트 블록(`EXACT, verbatim, no extra characters` + appears once) + letter-by-letter + text-heavy엔 medium/high | cookbook #2/#55 (T2) |
| R6 | 로컬라이제이션 편집 규칙 (verbatim 번역, reflow 회피) | cookbook #42 (T2) |
| R7 | `### Structured Edit Brief` 신설 — Desired result/Change only/Preserve exactly(lock list)/Do not add-remove | edit guide (T2) |
| R8 | `### Multi-Reference Rules` 신설 — 인덱스+역할 지칭, identity-critical 첫 번째, 다얼굴 합성 레퍼런스, compositing 조화 명세 | high input fidelity cookbook (T2) |
| R9 | Prompt Iteration에 clean baseline + restate-on-drift 추가 | 공통 (T2) |
| R10 | 비디오 `**Shot discipline**` 블록 — 샷당 카메라무브1+액션1, timed beats, 오디오 채널 분리, I2V는 모션만, anchor 문구 재사용, 실패 복구 사다리 | Sora 2/Veo/Runway (T2) |
| R11 | 한글 섹션 — 영어 장면+따옴표 한글 휴리스틱(사례 명시), 짧은 문구 우선, 텍스트 영역 edit 패스, 후합성 프로덕션 경로 | 챗대리/Carat (T2 practitioner) |

반영하지 않은 것: 폰트 지정 효과·성공률 수치 등 검증 안 된 주장(과장 금지),
Kling/Midjourney(원문 차단으로 T1에 머묾), 마스크 API 세부(ima2 CLI 미노출).

## 검증 증거

- `node --test tests/cli-skill-command-contract.test.js` → tests 4, pass 4, fail 0
- `cxc loop validate --slug improve-ima2-packaged-skill-skills-ima2-skill-md`
  → `OK — complete + all met criteria carry evidence`
- 계약 고정 문구 전수 보존 확인 (테스트가 regex로 강제)

## 리서치 운영 노트

- 서브에이전트 7기 전원 gpt-5.6-sol. 서브에이전트 환경에서 hosted
  `web_search`가 404를 반환했고 `agbrowse`는 node 경로 문제 또는
  developers.openai.com rss.xml 미스라우팅으로 부분 실패 → 전원 native
  browser fallback으로 Tier-2 원문 검증 수행 (cxc-search ladder rung 3).
  스니펫 승격 0건.
- agbrowse rss.xml 미스라우팅은 별도 개선 후보 (cxc-search 스킬 소관).
