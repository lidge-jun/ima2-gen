---
created: 2026-08-18
updated: 2026-08-18
tags: [ima2-gen, devlog, wp3, release]
---

# 030 (WP3) — dev push + stable 릴리스

의존: wp1, wp2 (둘 다 D 종료 후).

## 절차 (저장소 canonical 메커니즘)

1. `git push origin dev` (사용자 승인 완료: "dev에 푸시하고 배포까지 완료")
2. dev head CI 확인 (`PR fast gate`/push 체크)
3. `npm run release:minor` → `gh workflow run release.yml -f bump=minor -f dry_run=false`
   (feat 포함이므로 minor: 3.5.3 → 3.6.0)
4. `npm-preview` publish 후 `npm-stable` 환경 승인 관문에서 tag job이
   waiting → `gh api`로 pending deployment 승인 (소유자 위임 실행)
5. 검증: npm dist-tags latest=3.6.0, gh release view v3.6.0,
   main/dev/tag SHA 일치, preview proof (npm gitHead == release SHA)

## 이슈 마감

- #151: 코멘트에 생산 커버리지 전환 목록 + 소비자 전환 증거 + 수용 조건
  체크표. 수용 조건 6개 중 충족/부분/미충족을 명시하고 close 여부는 충족
  수준으로 판단 (SSE/CLI/MCP/UI 소비 + sequence + idempotency + terminal
  복구가 충족되면 close, cancel/retry/resume 계약은 문서화로 처리).
- #150: core diff 실측표 + contract suite 자동 적용 증거. 수용 조건 6개 중
  '5파일 이하'와 'contract suite 자동 적용'이 실증되므로 부분 충족 상태
  기록. 남은 조건(UI switch 제거, 외부 패키지 로딩)은 갈 길을 명시하고
  close 여부는 결과 코멘트에서 판단.

## 수용 기준

- [ ] npm latest가 새 버전
- [ ] GitHub Release 생성, main/dev/tag 정렬
- [ ] 이슈 2건에 증거 코멘트
