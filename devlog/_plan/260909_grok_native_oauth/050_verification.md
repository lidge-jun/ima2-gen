---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, verification, ci, stacked-pr]
---

# 050 — 검증과 전달 절차

## 스택 규약

수동 체인(DEV-STACK-06). GitHub native stack 사용 안 함. 각 PR body에 스택 맵 표
(DEV-STACK-03). 하위 레이어를 고치면 `git rebase --update-refs`로 상위까지 cascade 후
`--force-with-lease` (DEV-STACK-02), 그리고 `git merge-base --is-ancestor <lower> <upper>`로 확인.

| # | 브랜치 | base | PR |
|---|---|---|---|
| 1 | `codex/grok-native-oauth-01-roadmap` | dev | 문서만 |
| 2 | `codex/grok-native-oauth-02-xai-auth` | 01 | lib/xaiAuth.ts + 테스트 |
| 3 | `codex/grok-native-oauth-03-direct-lane` | 02 | 레인 전환 |
| 4 | `codex/grok-native-oauth-04-remove-progrok` | 03 | 제거·CLI·readiness |
| 5 | `codex/grok-native-oauth-05-docs` | 04 | SoT·문서 |

push와 PR 생성은 사용자가 이 세션에서 "작업하면서 올리고"로 승인했다. merge는 승인되지 않았다.

## 레이어별 C 게이트

모든 레이어 공통: `npm run typecheck`, `npm run typecheck:tests`, `npm test`, `npm run test:inventory`,
`node scripts/refresh-structure-line-counts.mjs --check`, `node scripts/generate-provider-types.mjs --check`.
각 명령의 exit code와 tail을 `cxc receipt test`로 남긴다.

| WP | 추가 게이트 |
|---|---|
| wp1 | `scripts/check-devlog-citations.mjs` (있으면), 문서 링크 존재 확인 |
| wp2 | `tests/xai-auth-contract.test.ts` 15 시나리오 전부, 0600 퍼미션 단정 |
| wp3 | `tests/grok-direct-lane-contract.test.ts`, `grok-execution-parity`; 격리 HOME 라이브 `/api/grok/status` |
| wp4 | `npm run lint:pkg`, `npm run test:package-install`, `npm run test:install-policy`; `rg progrok` 0건; `gh workflow run ci.yml -f sha=<head>` |
| wp5 | `cd ui && npm run build`, `cd site && npm run build`; 문서 rg 0건 |

## CI 후행 추적

PR마다 pr-fast.yml이 자동으로 돈다. 중간 레이어의 실패는 진단용이고, 최종 판정은
스택 top(05) head SHA의 pr-fast `gate` job success + 같은 SHA에 `workflow_dispatch`한 ci.yml
전 job success다. skipped/cancelled는 통과가 아니다.

`gh pr checks <n> --watch`, `gh run list --commit <sha>`, `gh run view <id> --json jobs`로 job 단위로 기록한다.

## 최종 증거 형식 (D)

- 5개 PR URL과 head SHA, base 관계
- 최종 head의 pr-fast run id + ci.yml dispatch run id, 각 job conclusion
- 로컬 게이트 5개 명령 exit code
- `rg progrok` 결과
- 격리 HOME 부팅 로그(refresh 1회 발생 라인)
- OpenCodex 이슈 번호 4개(000_plan 표 갱신)
