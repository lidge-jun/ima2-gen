# 010 release-train-3.0.0 결과 (D 요약)

## Outcome: DONE

ima2-gen v3.0.0이 npm latest로 배포 완료. 릴리스 SHA = bf67a5b880237f4dc358a48f5532d934dd23fe60.

## Evidence

- **A 감사:** Sol(gpt-5.6-sol, priority) 리뷰어 — VERDICT: PASS, 블로커 0건.
  publish.yml이 7c26c51↔bf67a5b 간 무변경(blob 34ba898) 검증, 재개 경로/워크트리
  안전성 확인.
- **verify:release (로컬, 릴리스 SHA):** node:test 1821 pass / 0 fail, typecheck ×2,
  ui:build, build:server/cli, lint:pkg, install-policy, npm audit high 0건
  (omit=dev; MCP SDK의 hono/body-parser moderate·low는 게이트 통과),
  package-install smoke pass. 로그: /tmp/ima2-release-3.0.0.log
- **preview 채널:** run 30007005011 → 3.0.0-preview.260723.30007005011.1 발행,
  release-contract verify-channel 통과.
- **stable publish:** run 30007972033 success — npmTag=latest,
  signatureVerified=true, gitHead=bf67a5b, integrity sha512-sgTZL2nQ....
- **사후 검증:** npm dist-tags { latest: 3.0.0, preview: 3.0.0-preview.260723... };
  git ls-remote: main==dev==preview==v3.0.0 태그==bf67a5b;
  gh release v3.0.0 published 2026-07-23T12:52:30Z (isDraft=false).
- **finalize:** "✅ ima2-gen@3.0.0 published and fully finalized".

## Notes / Residuals

- 첫 release.sh 시도는 이 워크트리의 sparse한 node_modules(270개)로 tsc가 MCP SDK
  타입을 못 찾아 실패 → `npm ci`(288개) 재설치 후 재실행으로 해결. 코드 수정 없음.
- Sol 감사의 비차단 지적 2건: (1) 워크트리 node_modules "부재" 표현은 부정확 →
  재현성 위해 npm ci 수행으로 정정, (2) allowScripts는 sharp 항목만 제거된 것
  (better-sqlite3/esbuild/fsevents 잔존). 문서 기록만으로 처리.
- npm audit: root는 omit=dev 기준 0건. MCP SDK 경유 moderate 2건(low 1건)은
  audit-level=high 게이트 아래라 통과 — 차기 dev 사이클에서 SDK 업데이트 고려.
- 로컬 dev 체크아웃은 origin/dev와 동일 SHA 유지(푸시가 동일 SHA라 변화 없음).

## LOOP-PESSIMIST-01

- 죽은 가설 없음(단일 경로 성공). 잘못될 수 있었던 지점: 워크트리 의존성 불일치가
  릴리스 게이트 실패로 위장 — 신선한 `npm ci`가 릴리스 전 필수라는 교훈 재확인.
