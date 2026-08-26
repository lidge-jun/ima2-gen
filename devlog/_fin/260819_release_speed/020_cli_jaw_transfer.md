---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, release, cross-repo]
---

# 020 — 동일 원칙의 cli-jaw 이식 (기록)

ima2-gen 010의 "검증된 SHA는 재검증하지 않는다"를 cli-jaw 릴리스 경로에
적용했다. 작업 자체는 `../cli-jaw`에서 수행 (PR #390, squash f7cfa278).

| 항목 | 값 |
|---|---|
| 실측 병목 | v2.17.5: promotion PR 생성→npm 20.2분, 그중 main push CI 대기 9.2분 |
| 변경 | promote-to-main.sh 트리 동일성 fast path (불일치 시 기존 대기 폴백) + publish.yml certified-sha 경로 |
| 감사 | opus-5 2라운드 (r7 NEAR-PASS 4건 반영, r8 PASS). #386-388 오진 정정 포함 |
| 계획 문서 | cli-jaw devlog 서브모듈 `_plan/260819_release_speed/000_plan.md` (17434f05) |
| 예상 효과 | ~20분 → ~11분 (다음 stable 승격에서 실측 예정) |

## v2.17.6 실측 (2026-08-19, fast path 첫 실전)

| 항목 | 값 |
|---|---|
| promote-to-main.sh 전체 | **433초 (7.2분)** — v2.17.5는 PR 생성→publish dispatch만 ~18분 |
| fast path 발동 로그 | `tree-identity: merge 7052c0c3 tree matches certified PR head 072200f7; skipping the main CI wait` |
| 결과 | npm latest=2.17.6, GH Release v2.17.6, main=tag=7052c0c3 |
| 잡힌 엣지 | publish의 platform 게이트가 PR-head platform run과 레이스 (PR run이 아직 in-flight일 때 dispatch됨) → recovery-1 runbook으로 재dispatch 1회. 후속 개선 후보: promote가 dispatch 전에 PR-head platform run 완료를 확인 |
| 절차상 배움 | promote 전에 main→preview back-merge가 필요 (ancestry 가드), 임시 clone은 node-pty gyp 재빌드 필요 (node-gyp@11) |
