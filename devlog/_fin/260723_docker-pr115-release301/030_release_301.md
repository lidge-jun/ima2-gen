# 030 WP3 — v3.0.1 릴리스 + 종결

## Preconditions

- WP1(Docker) + WP2(PR #115 재구축) 커밋이 dev에 존재
- dev push → CI 매트릭스 4/4 green 확인 (릴리스 SHA 고정)

## Steps (3.0.0과 동일 파이프라인)

1. `git push origin dev` → `gh run watch` CI green
2. `npm version patch` 성격의 버전 커밋은 release.sh가 담당:
   npm latest(3.0.0) == package.json(3.0.0)이므로 이번엔 **fresh release 경로** —
   release.sh가 main HEAD == origin/dev 검증 후 `npm version patch`(→3.0.1) 커밋 생성
3. main 워크트리(/Users/jun/.codex/worktrees/5ad7/ima2-gen)에서:
   `git fetch && git merge --ff-only origin/dev` → `./scripts/release.sh patch`
4. 파이프라인: verify:release → preview 푸시/검증 → v3.0.1 태그 + 원자 푸시 →
   OIDC publish(latest) → finalize(GitHub Release + 브랜치 동기화)
5. 종결: 이슈 #114 답변+close, PR #115 코멘트+close(재구축 커밋 참조),
   `gh pr list --state open` 빈 목록 확인

## Evidence targets (c3)

- npm dist-tags latest=3.0.1
- git ls-remote: main==dev==preview==v3.0.1 태그 SHA
- gh release view v3.0.1 published
- gh issue view 114 → CLOSED, gh pr view 115 → CLOSED

## Note

- fresh 경로는 main HEAD == origin/dev 필수 → 릴리스 직전 dev에 추가 커밋 금지.
- 로컬 dev의 devlog 커밋들도 릴리스 전에 push되어야 dev==main 정합 유지.
