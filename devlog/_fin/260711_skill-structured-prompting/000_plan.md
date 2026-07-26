# 260711 — ima2 skill 구조화 프롬프트 유도 강화 (research + reflection)

Date: 2026-07-11
Session: cxc-loop goalplan `improve-ima2-packaged-skill-skills-ima2-skill-md`
Status: ACTIVE

## 배경 / 목적

`skills/ima2/SKILL.md`(940줄)는 이미 Agent Image Prompt Protocol과 Required
Spec Fields를 갖고 있지만, 에이전트가 실제로 구조화된 프롬프트를 쓰도록
"유도"하는 힘이 약한 구간이 있다. 이번 유닛은 (1) 웹 리서치로 주요 실전
사례·공식 가이드를 Tier-2(원문 확인) 수준으로 수집하고, (2) 검증된 발견만
SKILL.md에 반영해 프롬프트 구조화를 기본 동작으로 만드는 작업이다.

리서치는 cxc-search 3-tier ladder를 따른다: Tier 1 hosted `web_search` 발견 →
Tier 2 원문 열람 증명(`agbrowse fetch --json --browser never`) → 스니펫만으로
확정 금지. 리서치 파견은 gpt-5.6-sol explorer 서브에이전트(사용자 명시 승인,
무제한)로 수행한다.

## Work Phases

| WP | 내용 | 상태 |
|---|---|---|
| wp1 | 탐사대 wave 1 파견 (5 query families) + devlog 스캐폴드 | in_progress |
| wp2 | 종합: claim ledger (URL+tier), gap 있으면 wave 2 | pending |
| wp3 | SKILL.md 반영 (>=5 Tier-2 findings, 계약 테스트 문구 보존) | pending |
| wp4 | 검증: contract test + loop validate + closeout | pending |

## Wave 1 파견 내역 (2026-07-11)

| Explorer | Query family |
|---|---|
| Gibbs | OpenAI 공식 GPT Image 프롬프팅 가이드 (docs/cookbook) |
| Russell | 구조화/필드형 프롬프트 포맷의 실증 (템플릿, 순서, JSON 여부, 길이) |
| Euclid | 이미지 내 텍스트 렌더링 + 다국어/한글 |
| Hooke | 편집/i2i/레퍼런스 프롬프팅 (delta vs final, 보존 문구, 멀티 ref) |
| Harvey | 아트디렉션 어휘, 네거티브 제약 실효성, 안티패턴 |

## 제약

- `tests/cli-skill-command-contract.test.js`가 고정하는 문구는 전부 보존한다
  (예: `There is no \`--parallel\` flag`, `Structured Video Prompt Template`,
  `beat structure scales with length`, `not a typesetting engine` 등).
- 코드/CLI/UI 변경 없음. 스킬 문서와 devlog만 수정.
- git 커밋/푸시는 사용자 요청 없이는 하지 않는다.

## 산출물

- `010_claim-ledger.md` — 검증 claim(원문 URL + tier) / 미검증 리드 분리
- `020_reflection-map.md` — claim → SKILL.md 편집 매핑
- `090_closeout.md` — 검증 증거 (테스트/validate 출력)
