# 260723 release-train-3.0.0 — dev 검증 → preview/main 머지 → npm v3.0.0 배포

## Objective

dev(bf67a5b, origin/dev 동기화)를 검증하고 preview/main으로 승격하여 npm 안정판
v3.0.0을 배포한다. 사용자 승인: "main preview 머지후 배포까지 진행해봐" —
release.sh 워크플로 범위 내 push/publish 승인됨.

## Current State (verified 2026-07-23 21:20 KST)

- 로컬 브랜치: `dev` @ bf67a5b == origin/dev, 워크트리 clean (`git status` 무변경)
- `origin/main` = 7c26c51 (`fix(ci): inject GH_TOKEN into release and verify jobs`)
- `origin/preview` == origin/main (rev-list count main..preview = 0)
- dev는 origin/main 기준 176 커밋 앞, main/preview 모두 dev의 조상 → FF 머지 가능
- npm dist-tags: latest=2.0.20, preview=2.0.21-preview.260716...
- package.json version = **3.0.0** (09e12c7에서 bump, npm 미발행 — E404 확인)
- 원격 태그 v3.0.0 없음 (`git tag` 최신 = v2.0.20)
- dev HEAD CI: run 29975663387 — ubuntu/windows × node22/24 매트릭스 4/4 success
  (직전 3개 run failure는 sharp/fast-uri audit 게이트 → bf67a5b에서 해소됨)
- 툴체인: node 24.17.0 / npm 11.18.0 — `release-contract.mjs assert-toolchain` PASS
- gh CLI 인증됨 (lidge-jun)
- main 체크아웃 위치: `/Users/jun/.codex/worktrees/5ad7/ima2-gen` (clean, 별도 워크트리)

## Release Path (release.sh 분기 분석)

`PKG_VERSION(3.0.0) != NPM_LATEST(2.0.20)`, v3.0.0 미발행 && 원격 태그 없음
→ **"Resuming unpublished candidate v3.0.0"** 경로. 버전 bump 커밋 없이 현재
HEAD(= dev SHA로 FF된 main)를 그대로 릴리스 SHA로 사용한다.

시퀀스:
1. `npm run verify:release` (typecheck ×2, inventory, ui:build, build:server,
   build:cli, node:test 전체, lint:pkg, install-policy, audit high ×2,
   package-install smoke)
2. `release-preview.sh` — preview 브랜치로 push → OIDC publish 워크플로가
   preview 채널 패키지 발행 → `release-contract.mjs wait`로 npm 증거 대기
3. `v3.0.0` 태그 → `main/dev/tag` 원자 푸시 → publish 워크플로(latest) 대기
4. `finalize` — GitHub Release 보장 + dev/preview 브랜치 동기화

## Diff-level Change Map

- 소스 코드 변경: **없음** (릴리스 전용 사이클)
- `/Users/jun/.codex/worktrees/5ad7/ima2-gen` (main 워크트리):
  - `git merge --ff-only bf67a5b` — main을 dev SHA로 전진 (로컬)
  - `npm ci` + `npm --prefix ui ci` — 깨끗한 의존성 설치 (node_modules 부재)
  - `./scripts/release.sh patch` 실행 — 단 3.0.0은 미발행 후보이므로 bump 없이
    재개 경로를 탄다 (BUMP_ARG는 이 경로에서 미사용)
- 원격 변경 (스크립트가 수행, 승인됨): `refs/heads/preview`, `refs/heads/main`,
  `refs/heads/dev`, `refs/tags/v3.0.0`, npm 채널 preview/latest, GitHub Release

## Accept Criteria (goalplan c1-c4)

- c1: verify:release 성공 로그 (릴리스 SHA에서)
- c2: `npm view ima2-gen dist-tags` → latest=3.0.0
- c3: `git ls-remote origin` → main/dev/preview/v3.0.0 태그 동일 SHA
- c4: `gh release view v3.0.0` 존재 + publish 워크플로 success

## Risks / Mitigations

- **R1 워크트리 의존성 부재:** 5ad7 워크트리는 fresh checkout → `npm ci` 필수.
  native deps(sharp, better-sqlite3)는 prebuilt이므로 스크립트 승인 불필요
  (d8e0896에서 allowScripts 제거됨).
- **R2 verify:release 소요시간:** 전체 스위트 1094 케이스 + 이중 빌드, 로컬
  15-25분 예상. 백그라운드 세션으로 실행하고 폴링한다.
- **R3 preview 채널 wait:** GitHub Actions OIDC publish까지 스크립트가 대기.
  Actions 장애 시 BLOCKED 보고.
- **R4 dev 워크트리(현 CWD)와의 충돌:** 릴리스는 5ad7 워크트리에서 실행하므로
  현 dev 체크아웃은 건드리지 않음. 마지막 finalize의 dev push는 origin만 갱신
  → 이후 로컬 dev는 `git pull --ff-only`로 맞춘다.
- **R5 메이저 점프(2.0.20→3.0.0):** 09e12c7 "docs(cli)!: v3 fail-closed
  contract" breaking-change 커밋에 의한 의도된 bump. 임의 재조정 금지.

## Out of Scope

- dev 신규 기능/리팩터링, UI 코드 수정, 릴리스 게이트 실패의 범위 밖 수리
  (2회 동일 실패 반복 시 NEEDS_HUMAN)

## Loop Spec (C3, spec-satisfaction)

- Archetype: spec-satisfaction repair / Trigger: 사용자 배포 요청
- Verifier: release.sh 내장 게이트 + release-contract.mjs wait + 사후 npm/gh 검증
- Stop: DONE(c1-c4 충족) | BLOCKED(업스트림) | NEEDS_HUMAN(게이트 반복 실패)
  | BUDGET_EXHAUSTED(3h)
- Memory artifact: 이 문서 + goalplan ledger
- Delegation: A-phase 리뷰어 = Sol(gpt-5.6-sol, priority) explorer, read-only
