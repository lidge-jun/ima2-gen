# 050 — closeout: v3.23.0 배포 완료 (2026-09-27 KST)

## 결과

- PR #325 (desktop 통합 타이틀바): 리뷰·polish(1e4df794) 후 eba67ec4로 dev 스쿼시 머지.
- PR #327 (타이틀바 레이아웃 수정): 실기 결함(로고 클리핑/셀렉트 과밀) 수정,
  J6 e2e 계약(라벨 wrap)과 T6 sub-px 내성을 반영해 7d5c54cf로 머지.
- v3.23.0: 프로모션 #328 → release.yml(run 36265005475) → npm-stable 승인 2회 →
  npm ima2-gen@3.23.0 latest, GitHub Release(manifest+SBOM), desktop-v3.23.0
  (5플랫폼 17에셋, desktop-production 승인), pages.yml 배포 완료.

## 검증

- npm view ima2-gen version / dist-tags.latest = 3.23.0
- gh release view v3.23.0: draft=false, assets=release-manifest.json,sbom.cdx.json
- gh release view desktop-v3.23.0: draft=false, assets=17 (allowlist 일치), Latest 아님
- npm audit signatures: 88 packages verified attestations
- release.yml run 36265005475: completed success

## 남은 것

- devin PR #326(desktop chrome split)은 #327과 접근이 달라 별도 판정 필요.
- T6 aligned 체크는 width/height 0.02px 내성으로 완화됨 — flex 재분배에 robust.
