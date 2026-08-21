# 000 — 릴리스 트레인 3.10.0: Plan

## Objective
dev 다듬기 → push → dev→main PR 머지 → release.yml(canonical OIDC 경로)로
preview 승격 + npm stable 3.10.0 배포.

## Evidence base
- 현재: local dev == origin/dev (8f980340), main은 v3.9.0 (3883482f),
  origin/main..origin/dev 21커밋, preview <= main.
- 관례: dev→main PR (#165-167), 릴리스는 .github/workflows/release.yml
  workflow_dispatch(bump/dry_run/expected_sha) — version commit → main →
  preview 승격 → preview publish 증명 → stable 태그 → stable publish(OIDC).
  publish.yml만 id-token: write 보유. 직접 npm publish 금지.
- npm: latest 3.9.0. 이번 릴리스는 minor(3.10.0): canvas hover/투명화/라이트모드
  + stop/service 신기능.
- 다듬기 대상: 완료된 _plan 유닛 3개(260821b UI, 260821c stop/service,
  260821_gpt_image2_transparent_background)를 _fin으로 이동(+_fin 규칙 YYMMDD
  프리픽스 확인), README/구조문서 일관성 재확인, 사용자 dirty 파일
  docs/grok-video-i2v-research.md은 사용자 소유 — 커밋하지 않고 보존.

## Work-phase map
| WP | Slice |
|----|-------|
| rwp1 | polish(devlog 이동, 문서 점검) + 전체 게이트 + dev push |
| rwp2 | dev→main PR + CI green + merge |
| rwp3 | release.yml dispatch(minor, dry_run=false, expected_sha) + 완주 추적 + npm/SHA 정합 검증 |

## Accept criteria: goalplan rc-polish / rc-main / rc-npm 미러

## 실행 원장 (진행 중 기록)

- rwp1 DONE: devlog 3개 유닛 _fin 이관 + gitignore 정리, 게이트 전부 그린
  (typecheck/typecheck:tests/inventory/ui build/npm test 2434-0), push
  8f980340..80c2d9a0 dev.
- rwp2 DONE: PR #168 (dev→main) 생성·머지 — merge commit d862373d.
  CI: test x2/e2e/fast-gate/Analyze x2 전부 PASS. CodeQL 경보 게이트는
  routes/edit.ts의 js/missing-rate-limiting 1건(high)을 신규로 표기했으나
  이는 저장소 전반의 기존 패턴(동일 룰 open 경보 30+, express rate-limit 부재)이
  파일 수정으로 재표면화된 것 — 필수 체크 아님(main 비보호), 릴리스 비차단 판단.
  후속 과제로 원장에 기록.
