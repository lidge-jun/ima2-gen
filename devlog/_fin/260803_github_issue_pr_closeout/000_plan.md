# 000 — GitHub 이슈/PR 클로즈아웃 로드맵

- 유닛: `devlog/_plan/260803_github_issue_pr_closeout/`
- 생성일: 2026-08-03
- 루프: cxc-loop HOTL, goalplan slug `ima2-gen-119-pr-118-minimax-provider-hotl-pabcd`
- 세션: `019fc81b-a873-7b92-82af-0509df9863e0`

## 목표

현재 열려 있는 GitHub 항목 두 건을 증거 기반으로 종결 가능한 상태까지 만든다.

| 항목 | 제목 | 상태 |
|------|------|------|
| 이슈 #119 | 3.0.4 이미지 모델 드롭다운 내부 스크롤 시 메뉴가 닫힘 | OPEN |
| PR #118 | Add MiniMax image generation provider | OPEN, base=main, MERGEABLE/UNSTABLE |

## 제약

- 원격 push, PR 머지/클로즈, GitHub 코멘트 작성, 릴리스 태깅, 배포, npm publish는 전부 스코프 밖이다.
  사용자 명시 승인 전까지 로컬 커밋까지만 수행한다.
- 기존 dirty worktree 변경은 보존한다. 메인 체크아웃에서 브랜치 전환/스태시/리셋을 하지 않는다.
- 파일 500줄, 함수 50줄 한도 유지. ES Module 전용.

## work-phase 맵

**두 개의 독립 lane임을 명시한다 (A-phase 감사 blocker 5 반영).**
이 유닛은 "하나의 기능을 의존 순서로 쪼갠 로드맵"이 아니라 "같은 목표(열린 GitHub 항목 종결)
아래 서로 독립인 두 lane"이다. WP2는 WP1의 산출물을 소비하지 않는다. 파일이 겹치지 않는다는
사실은 순서의 근거가 아니라 **병렬 가능성의 근거**다. 실행 순서는 사용자 영향도(회귀 버그가
릴리스된 상태)로 정하며, 이는 의존 순서 주장이 아니다.

| WP | lane | 문서 | 대상 | 독립 검증 |
|----|------|------|------|-----------|
| WP0 | — | 이 문서 + `001` | 조사/로드맵 (코드 변경 없음) | 문서 존재 + 코드 변경 0 |
| WP1 | A (버그 수정) | `010_phase1_select_scroll_guard.md` | `ui/src/components/controls/Select.tsx` 캡처 스크롤 가드 + 회귀 테스트 | 실제 브라우저 시나리오 관측 + 전체 CI 게이트 |
| WP2 | B (외부 기여 심사) | `020_phase2_pr118_minimax_review.md` | PR #118 실증 리뷰/판정 | PR worktree 게이트 출력 + 판정 문서 |

`Select`는 14개 파일에서 19회 렌더되는 기반 컴포넌트이고, 그중 포털 모드를 켜는 활성 호출은
6개다(`001` 참조). WP1은 그 공용 계층 한 곳만 고친다.

## 수용 기준

- `c-docs`: WP0 종료 시 이 유닛에 `000`/`001`/`010`/`020`이 각자의 역할에 맞는 완성도로
  존재하고(연구 문서 `001`은 diff 없이 근거 중심, 구현 phase 문서 `010`은 diff-level),
  코드 변경은 없다.
- `c-scroll-activation`: 실제 실행 중인 UI에서 포털 드롭다운을 열고 목록 내부를 스크롤했을 때
  메뉴가 열린 채 유지되고(`aria-expanded="true"` + `scrollTop` 증가), 외부(사이드바/페이지)를
  스크롤하면 닫히는 것(`aria-expanded="false"`)을 **관측**한다. 순수 함수 단위 테스트와
  정적 regex는 보조 증거일 뿐 이 기준을 단독으로 만족하지 못한다
  (C-ACTIVATION-GROUNDING-01, A-phase 감사 blocker 1 반영).
- `c-gates`: WP1에 해당하는 CI 게이트 subset이 fresh 출력으로 exit 0:
  `node scripts/refresh-structure-line-counts.mjs --check`, `npm run typecheck`,
  `npm run typecheck:tests`, `npm run test:inventory`, `npm run build:server`,
  `npm run build:cli`, `npm --prefix ui run build`, `npm test`
  (`.github/workflows/ci.yml:48-49,63-77`). CI 전체 매트릭스(OS × npm, 패키징/릴리스
  게이트)는 로컬에서 재현하지 않으며, 이를 "CI 전부 통과"로 주장하지 않는다.
- `c-pr-verdict`: PR #118 판정이 실제 체크아웃과 명령 출력에 근거해 기록된다.

## 터미널 아웃컴 기준

- `DONE`: 위 4개 기준이 모두 fresh 증거로 충족.
- `NEEDS_HUMAN`: PR #118 수용 여부처럼 제품 판단이 필요한 잔여가 남는 경우 — 판정과 근거는 제출하되
  실제 머지/클로즈는 사용자 결정으로 남긴다.
- `BLOCKED`: 원격 권한이나 승인 부재로 진행 불가.

## SoT 동기화 대상 (SOT-SYNC-01)

- `structure/01-file-function-map.md`는 line count 계약으로 강제된다
  (`tests/structure-line-counts-contract.test.js`). 파일 길이가 바뀌면 WP1의 C에서
  `npm run docs:refresh-line-counts`로 갱신한다.
- 테스트 인벤토리(`docs/migration/runtime-test-inventory.md`)는 생성물이다. 새 테스트 추가 시
  `node scripts/classify-tests.mjs`로 **먼저 생성**한 뒤 `npm run test:inventory`로 검사한다.
  손으로 편집하지 않는다.
