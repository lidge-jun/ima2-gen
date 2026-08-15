---
created: 2026-04-23
updated: 2026-08-14
tags: [ima2-gen, devlog, roadmap]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 앞으로 구현하거나 검증할 일이 남은 항목만 둔다. 구현 근거와
테스트가 확인된 항목은 `_fin`으로 이동한다. 완료 여부는 폴더 위치만이 아니라
현재 코드, 테스트, GitHub issue 상태, closeout 증거를 같이 본다.

## Naming Standard

`_plan/` 직속 active 폴더는 다음 두 패턴 중 하나를 따른다.

- `YYMMDD_issue<NN>-<kebab-slug>`: 단일 GitHub 이슈가 canonical scope일 때.
- `YYMMDD_<kebab-slug>`: 단일 이슈가 없는 연구, triage, 다중 이슈 map일 때.

Deferred / 미래 항목은 `_plan/` 직속이 아니라 `_plan/_future/`에 둔다.

## 현재 Active Lane

| 경로 | 상태 |
|---|---|
| `260815_open_issues_platform/` | 진행 중. 열린 이슈 6건 + envelope/adapter 1단계 |
| `260814_issue_pr_zeroing_release/` | v3.1.0으로 완료. 이관 판정은 다음 사이클 |
| `260814b_maturity_ops_measurement/` | v3.2.0으로 완료. 이관 판정은 다음 사이클 |

### 2026-08-15 — 260814b 사이클 결과

성숙도 로드맵 #153의 P0 항목을 실행하고 **v3.2.0**을 발행했다.
릴리스 SHA `0a0ce25c61173a82b38bad397213ca76478526a5`, npm `latest` = `3.2.0`.

| 이슈 | 결과 |
|---|---|
| #146 npm stable 승인 관문 | **closed.** 실제 컷에서 `tag` job이 push 전에 `waiting`으로 멈추는 것 확인 |
| #148 CI fast gate | **closed.** PR 940초 → 177초 |
| #149 패키지 측정 | **closed.** 지표 7종 + blob 예산 + 5%/10% 임계, 실패 경로까지 실증 |
| #147 포지셔닝 | open. `Provider Integration` 카테고리만 UI 수동 필요 |
| #152 provider canary | open. 무과금 단계만 구현, 과금 2단계는 비용 승인 대기 |
| #150 #151 RFC | open. 의존 순서(#151 → #150) 근거 코멘트 |
| #145 브랜치 ruleset | open. **개인 저장소에서 달성 불가로 판정** |

#145는 네 가지 구성을 실측하고 되돌렸다. 개인 계정 저장소에서는 App bypass가
422로 거부되고, admin role bypass는 소유자 push까지 통과시키며, bypass 없는
구성은 릴리스 워크플로의 atomic push도 막는다. evaluate 모드는 Enterprise
전용이다. 근거는 `260814b_maturity_ops_measurement/060_wp6_branch_ruleset.md`
부록 B에 있다.

측정이 드러낸 것 하나: npm tarball 99.6MB 중 94.5MB가
`ui/dist/presets/thumbs` PNG 45장이다. 저장소 history보다 이쪽이 사용자에게
직접 닿는다. 배포 방식 변경은 다음 사이클 판단이다.

### 2026-08-14 아카이브 기록

`_fin`으로 이동:

- `260812_navrail_grok_autotag/` → `_fin/260814_navrail_grok_autotag/`
  `060`의 재개 조건 두 가지가 모두 충족됐다. release run `31778196224`가
  `assert-clean`을 통과해 preview까지 승격됐고 npm preview의 `gitHead`가 컷 SHA와
  일치한다. Windows `test:package-global-update`는 publish run `31780064187`에서
  단계 상한 내에 끝났다. 이 유닛이 걸어둔 `.js` 2건 재생성 조건은 `/lib/**/*.js`가
  gitignore된 빌드 산출물이라 해당 없음(`git ls-files`로 확인).
- `260813_maturity_roadmap/` → `_fin/260814_maturity_roadmap/`
  우산 이슈 #122의 완료 조건 7개를 실측 대조한 뒤 닫았다.

`260814_issue_pr_zeroing_release/`는 **남긴다.** 이 유닛의 이관 판정은 다음
사이클이 한다 — 자기 유닛을 자기가 완료 처리하는 것은 이 README가 금지하는 바다.

### 2026-08-14 정정 — 이전 기록은 stale이었다

아래 세 주장은 모두 틀렸다. 실측으로 정정한다.

| 이전 기록 | 실제 |
|---|---|
| "open issue와 open PR은 여전히 0건" | issue 1건(#122), PR 6건(#133–#138) |
| "현재 릴리스 컷과 publish 워크플로가 둘 다 빨갛다" | 둘 다 success |
| "`origin/main`과 `origin/preview`는 아직 `ac1cace`(3.0.5)" | 셋 다 `11bb9b87`(3.0.7) |

| 항목 | 값 | 확인 명령 |
|---|---|---|
| `main` = `dev` = `preview` | `11bb9b870828e38fd65c425e5a9fe31ce5d6aae1` | `git rev-parse` |
| npm `latest` | `3.0.7` (`gitHead` = `11bb9b87…`) | `npm view ima2-gen@3.0.7 gitHead` |
| npm `preview` | `3.0.7-preview.260814.31779318312.1` | `npm view ima2-gen dist-tags` |
| GitHub Release | `v3.0.7` (2026-08-14T07:42:51Z) | `gh release list` |
| release run | `31778196224` success | `gh run list --workflow release.yml` |
| publish run | `31780064187`, `31779318312` success | `gh run list --workflow publish.yml` |

릴리스를 고친 것은 `8bc4468e fix(release): verify provenance against the dispatch
host ref`다. 그 뒤 v3.0.6, v3.0.7이 연달아 나갔다.

열린 이슈가 없다는 것과 릴리스가 건강하다는 것이 다른 문제라는 원래 지적은
여전히 옳다. 다만 이번에는 **반대 방향**이다 — 릴리스는 건강해졌고 열린 항목이
생겼다. 어느 쪽이든 폴더 위치나 카운트로 상태를 주장하지 않는다.

## 외부 차단으로 미완료인 항목

여기 있는 것들은 코드를 더 써서 해결되지 않는다. 외부 승인이나 제공자 상태
회복이 선행 조건이다.

| 항목 | 사유 | 재개 조건 | 근거 문서 |
|---|---|---|---|
| MCP Tier 2 authenticated smoke | 실제 OAuth + 유료 `tools/call` + billing delta | 사용자 비용 승인 | `_fin/260715_subscription-mcp-providers/140_closeout.md` |
| MCP 100 provider expansion (Recraft, Magnific) | Tier 2 이후 순서 | Tier 2 완료 | 같은 문서 |
| Runway `edit_video` 라이브 full-flow | stage-2가 workspace limit 반환 | 제공자 한도 회복 | `_fin/260716_cli-entry-routing/070_closeout.md` |
| `bin/commands/editVideo.ts`, multishot CLI 플래그 | 라이브 검증 불가 상태에서 표면만 추가하면 확인 못 하는 코드가 남음 | 위와 동일 | 같은 문서 |
| Canvas provider-backed masked edit (#31) | 업스트림 마스크 계약 미검증. 추측 payload는 조용한 열화 위험 | 계약 문서화 또는 탐침 승인 | `_fin/260430_issue31-provider-masked-edit/` |

## Deferred (`_plan/_future/`)

| 유닛 | 사유 |
|---|---|
| `260715_icon_pipeline/` | 대응 GitHub 이슈 없음, 구현 0건 handoff |
| `260719_higgsfield-open-ledger.md` | 업스트림 이월 원장 |

이 둘은 숫자를 맞추려고 `_fin`으로 옮기지 않았다. 대응 이슈가 없고 구현 착수도
없어서, 옮기면 그건 정리가 아니라 은폐다.

## 2026-08-13 아카이브 기록

`_fin`으로 이동:

- `260803_github_issue_pr_closeout/` — 이슈 #119 `CLOSED`(2026-08-04), PR #118
  `CLOSED`(미머지, 메인테이너가 별도로 보수 반영). 확인 시점 기준 open issue 0건,
  open PR 0건. MiniMax 보수 커밋이 현재 `dev`/`main`/`preview`(`ac1cace`)의 조상.

`_plan`에 **남긴** 것:

- `260812_navrail_grok_autotag/` — `050`이 WP0–WP3 전부 `DONE`이라고 적었지만
  같은 문서가 `release.yml`을 실행한 적 없다고 밝혔고, 이후 실제 실행에서 release
  run `31604716464`(tsbuildinfo drift)와 publish run `31605449399`(Windows
  Node24/npm12 15분 타임아웃)가 모두 실패했다. 구현은 끝났고 활성화가 증명되지
  않았다. 잔여는 `060_release_activation_residual.md`.

이 판단은 독립 감사가 뒤집은 것이다. 처음 계획은 두 유닛을 모두 옮기는 것이었다.
폴더 위치로 완료를 주장하는 것이 이 README가 금지하는 바로 그 행위다.

## 2026-07-26 아카이브 기록

`_fin`으로 이동:

- `260715_subscription-mcp-providers/` — Tier 1 golden harness 4종 구현(`c3fa674`), Tier 2는 NEEDS_HUMAN
- `260716_cli-entry-routing/` — WP1~WP4 완료, WP5 잔여는 Runway 한도 차단
- `260718_closeout-sweep/` — historical audit로서 완결
- `_future/260430_issue27-canvas-svg-export/` — `f0815f5`로 구현
- `_future/260430_issue28-canvas-pptx-export/` — `f0815f5`로 구현
- `_future/260430_issue31-provider-masked-edit/` — BLOCKED 근거 기록 후 이슈 close
- `_future/260529_issue80-batch-comparison-matrix/` — `d8bb7c6`로 코어 구현
- `_future/260602_storyboard-planner-skill/` — 4라운드 중 3라운드 기랜딩 확인 후 이슈 close
- `260726_zero-backlog-frontend-qa/` — 이 사이클의 계획·증거 유닛 (12 work-phase 완료)
- `260726_model-defaults-ui-cleaning/` — Grok 4.5·Luna 기본값과 UI 클리닝, 전체 게이트·렌더 증거

## 이전 기록

2026-07-25 archival sweep과 그 이전 이력은
`_fin/260725_devlog_archival/000_archival_record.md`에 있다.
