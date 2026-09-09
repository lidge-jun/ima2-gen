---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, release, v3.16.0, receipt]
---

# 070 — v3.16.0 릴리스 영수증

Grok 레인의 progrok 프록시 제거가 v3.16.0으로 배포됐다. 릴리스 커밋은
`7fa7d426d92813caeeff667a458b781237029df0` ("[agent] chore: release v3.16.0")이고,
`main` / `dev` / `preview` / `v3.16.0` 태그가 전부 이 하나의 SHA를 가리킨다.

## 머지 경로

스택은 아래에서 위로 순서대로 dev에 들어갔다. 각 머지는 리뷰된 head SHA를
`--match-head-commit`으로 고정했고, 하위가 머지되면 GitHub이 다음 PR의 base를
dev로 자동 재타겟했다.

| PR | 머지 커밋 | 내용 |
|---|---|---|
| #233 | c1c11525 | 로드맵 유닛 |
| #234 | a9873e7b | `lib/xaiAuth.ts` |
| #235 | f56c72f5 | grok 레인 api.x.ai 직접 호출 |
| #236 | 44d51c04 | progrok 제거, 네이티브 CLI, readiness |
| #237 | d889acd9 | SoT·문서·i18n |

`git diff 55b3d77a..origin/dev`가 비어 있어 머지된 트렁크가 리뷰된 트리를 그대로
담고 있음을 확인했다. 이어서 승격 PR #238(dev→main)과, 릴리스 직전 기록인
#239(CodeQL 107 dismissal + 3.16.0 changelog 제목) 및 그 승격 #240이 들어갔다.

## 릴리스 실행

`release.yml` run `34304218927`, `bump=minor`, `dry_run=false`,
`expected_sha=4b2349e8`. minor인 이유는 번들 의존성 하나, config 키 7개,
CLI 서브커맨드 2개가 사라진 사용자 표면 변경이기 때문이다.

워크플로가 소유한 순서대로 진행됐다.

1. 버전 커밋 7fa7d426 생성 + `verify:release`
2. 후보 CI `34304673924` — 6/6 success (ubuntu node22/24, windows node22/24, macOS 설치, frontend e2e)
3. main/preview 이동 후 preview publish `34305686185` — `3.16.0-preview.260909.34305686185.1`, gitHead 7fa7d426
4. `npm-stable` 환경 게이트 승인 (태그 잡, 이어서 stable publish 잡)
5. stable publish `34307228141` — npm `latest` 3.16.0, GitHub Release 생성

앞선 두 번의 시도는 후보 CI의 windows node22 레인에서 이 릴리스와 무관한 플레이크로
실패했다. 첫 번째(`34300502405`)는 `mcp-job-envelope-consumer`의 20초 클라이언트
타임아웃이 느린 러너에서 먼저 터진 것이고, 두 번째(`34302358198`)는 임시 sqlite
파일 unlink의 `EBUSY`였다. 두 경우 모두 후보 ref가 정리되고 main·태그·npm은
움직이지 않았다.

## 배포 증거

```
npm view ima2-gen@latest version   -> 3.16.0
npm view ima2-gen@latest gitHead   -> 7fa7d426d92813caeeff667a458b781237029df0
npm dist-tags: latest 3.16.0, preview 3.16.0-preview.260909.34305686185.1
git rev-parse origin/main origin/dev origin/preview v3.16.0^{commit}
  -> 7fa7d426d92813caeeff667a458b781237029df0 (모두 동일)
gh release view v3.16.0 -> draft=false, assets: release-manifest.json, sbom.cdx.json
npm audit signatures -> 37 packages have verified attestations
```

릴리스 커밋에서 전체 스위트를 다시 돌려 3534개 중 3531 pass, 3 skip, 0 fail을
확인했다. Pages는 `pages.yml`을 `release_version=3.16.0`,
`release_sha=7fa7d426...`로 dispatch해 배포했다.

## 남은 것

xAI가 OAuth의 api.x.ai 접근을 `/v1/me` 외에는 문서화하지 않는다는 위험은 README와
structure/06에 남아 있다. 경로가 닫히면 `grok-api`(API 키)가 문서화된 대안이다.
OpenCodex 쪽 결함 4건(lidge-jun/opencodex#4045~#4048)은 업스트림 처리 대기 중이다.
