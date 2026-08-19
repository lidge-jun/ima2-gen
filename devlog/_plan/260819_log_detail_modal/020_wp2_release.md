---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, wp2, release]
---

# 020 (WP2) — dev 푸시 + stable 릴리스

의존: wp1. 절차는 260818 유닛 030의 **검증된 최종 절차**를 그대로 따른다
(그 유닛에서 릴리스 감사 FAIL→PASS로 확정된 버전).

1. 로컬 `npm run verify:release` 선실행
2. `git push --atomic origin "<SHA>:refs/heads/main" "<SHA>:refs/heads/dev"`
   (assertBaseline: main==HEAD, main ⊇ dev, main ⊇ preview)
3. main push CI 완료 + Dependabot PR 부재 확인
4. `gh workflow run release.yml -f bump=minor -f dry_run=false -f expected_sha=<full SHA>`
   (UI feat이므로 minor: 3.6.0 → 3.7.0)
5. **승인 2회**: release.yml `tag` job + publish.yml `publish-stable` job,
   각각 `gh api .../pending_deployments -X POST -f state=approved
   -F "environment_ids[]=19898997367"`
6. 검증: npm dist-tags latest, gh release view, main/dev/preview/tag/npm
   gitHead SHA 일치 (preview proof 명시), 임시 release-candidate ref 정리 확인

주의: wp1의 게이트(typecheck/test/ui build)보다 릴리스 게이트가 넓다 —
verify:release 전체(native-deps, provider-registry, lint:pkg, install-policy,
audit:gate, package-install)를 step 1이 로컬 선실행한다.

## 수용 기준

- [ ] npm latest = 새 버전, GitHub Release 생성, main/dev/preview/tag/gitHead
  정렬 실측, release-candidate ref 정리 확인
