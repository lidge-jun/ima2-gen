# 260723 docker-pr115-release301 — 로드맵 (WP0 docs-first)

## Objective

dev(3.0.0 릴리스 직후, bf67a5b + devlog 1cfdbcd) 위에서:

1. **WP1 (010):** 이슈 #114 "不支持 docker部署吗" — Docker 배포 지원 구현
2. **WP2 (020):** PR #115 Atlas Cloud image provider — dev 위 재구축 통합
3. **WP3 (030):** v3.0.1 안정판 릴리스 + 이슈/PR 종결

사용자 승인: push/publish/PR 머지/이슈 코멘트 전부 승인, "최대한 머지하는 방향".

## Current State (2026-07-23 22:00 KST 조사)

- dev = bf67a5b(+devlog 커밋 1cfdbcd, 로컬만). origin/main==dev==preview==v3.0.0.
- npm latest=3.0.0. CI green.
- **이슈 #114:** 본문/코멘트 없음, 제목만 ("Docker 배포 지원 안 하나요?"). 중국어.
- **PR #115:** binyangzhu000-sudo, base=main(7c26c51, 릴리스 이전), 36파일 +654/-69.
  - `git merge-tree` 결과: 충돌 마커 12개, "changed in both" 26파일,
    `ui/src/components/ProviderSelect.tsx`는 **dev에서 삭제됨**(removed in local) —
    dev는 `GenProviderModelSelect.tsx`로 대체.
  - base 이후 dev에 177커밋: provider 시스템이 contracts/카탈로그 구조로 재편됨.
  - 신규 파일 2개는 깨끗함: `lib/atlasCloudImageAdapter.ts`(234줄),
    `tests/atlascloud-provider-contract.test.ts`(110줄).
  - **결정: REBUILD_ON_DEV (cherry-pick -n + 충돌 재작업)** — MERGE_AS_IS는 불가능
    (구 UI 컴포넌트 수정), CLOSE는 사용자 지시("최대한 머지")에 반함.
    Co-authored-by로 기여자 크레딧 보존.
- **Docker:** 리포에 Dockerfile 없음, 로컬 docker CLI 미설치 → build 검증은
  구조 검증 + (선택) CI로 위임. 런타임 요구: node>=20, native deps
  better-sqlite3/sharp(프리빌트), UI는 prepack 빌드 산출물, 포트 3333(IMA2_PORT),
  상태 디렉터리 ~/.ima2(IMA2_CONFIG_DIR).

## Work-phase map (dependency order)

| WP | Decade doc | 내용 | 의존 |
|----|-----------|------|------|
| WP1 | 010_docker_support.md | Dockerfile + .dockerignore + compose + README/이슈 답변 | 없음 |
| WP2 | 020_pr115_atlascloud.md | PR #115 dev 재구축(cherry-pick+재작업), 게이트, PR 처리 | 없음(파일상 독립이나 릴리스 전 필수) |
| WP3 | 030_release_301.md | dev push → CI green → release.sh 3.0.1 → 이슈/PR 종결 확인 | WP1+WP2 |

## Accept criteria → goalplan c0-c3 매핑

- c0: 이 문서 + 010/020/030 존재, A 감사 pass
- c1: Docker 파일 dev 커밋 + typecheck/구조 검증 증거
- c2: PR #115 종결(재구축 머지 + 코멘트 + close), open PR 0
- c3: npm latest=3.0.1 + refs 일치 + Release + #114 closed

## Risks

- R1: PR 재구축 시 dev 신규 provider 계약(contracts/availability)과의 정합 —
  Atlas Cloud를 구 Provider union에 추가하는 방식이 dev에서도 유효한지 020에서 검증.
- R2: docker build 무검증 리스크 — hadolint 수준 구조 검증 + 문서에 한계 명시,
  이슈 답변에 "CI 미검증, 피드백 환영" 명시.
- R3: 릴리스는 3.0.0과 동일 파이프라인 재사용(29초 전 성공 이력), 리스크 낮음.

## Loop spec (C3, spec-satisfaction, HOTL)

- Verifier: npm run typecheck/typecheck:tests/test(관련 스위트), gh pr/issue 상태,
  release-contract wait, npm dist-tags
- 자원 한도: 벽시계 4h, 서브에이전트 Sol(priority) A-리뷰어+B-워커
- Stop: DONE(c0-c3) | BLOCKED | NEEDS_HUMAN | BUDGET_EXHAUSTED
