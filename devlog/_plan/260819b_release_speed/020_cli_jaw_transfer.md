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
