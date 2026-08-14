---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, release, residual]
---

# 060 — 릴리스 활성화 잔여

- 작성: 2026-08-13, 세션 `019ff6f2-542f-7e21-a3ba-22d4fcc0397e`
- 기준: `dev` @ `ac1cace`
- 상태: **이 유닛은 `_fin`으로 가지 않는다**

## 왜 이 문서가 있나

2026-08-13 아카이빙 사이클에서 이 유닛은 원래 `_fin` 이관 대상이었다. `050`이
WP0–WP3 전부 `DONE`이라고 선언했기 때문이다. 독립 감사가 `050` 자신의 마지막
절을 근거로 그 판정을 뒤집었다.

> `release.yml`은 저장소에 놓였지만 **실행하지 않았다**. […] 첫 실전 릴리스는
> 사용자 판단이다. — `devlog/_plan/260812_navrail_grok_autotag/050_release_automation_closeout.md`

그 뒤 실제로 실행됐고, 두 워크플로가 모두 실패했다. 구현은 끝났지만 **활성화가
증명되지 않았다**. `_plan/README.md`가 금지하는 것이 정확히 이 상태를 폴더 이동으로
가리는 것이다.

## 실패 증거

| 항목 | 값 |
|---|---|
| release run | `31604716464` (HEAD `97b32ce`) — `assert-clean` 단계에서 `M ui/tsconfig.node.tsbuildinfo` |
| publish run | `31605449399` (HEAD `ac1cace`) — Windows Node24/npm12 `test:package-global-update`가 15분 타임아웃 |
| npm `latest` | `3.0.5` |
| npm `preview` | `3.0.6-preview.260812.31603578657.1`, `gitHead` = `97b32ce` |
| 현재 HEAD | `ac1cace` — 성공한 preview 발행이 **없다** |
| 원격 | `dev`/`main`/`preview` 모두 `ac1cace` |

## 두 실패의 성격이 다르다

**tsbuildinfo drift (release run).** `ac1cace`가 `ui/tsconfig.node.tsbuildinfo`를
추적 해제했고 `./.gitignore` 14–15행에 두 tsbuildinfo가 들어 있다. `git ls-files`로
확인하면 추적되는 tsbuildinfo는 0건이다. 즉 **원인은 제거됐다.** 다만 그 뒤
release 컷을 다시 돌린 적이 없어 초록이 재현되지 않았다. 고쳤다는 주장과 고쳐진
것을 관측한 것은 다르다.

**Windows 글로벌 업데이트 타임아웃 (publish run).** 이쪽은 원인이 제거되지
않았다. `scripts/package-global-update-smoke.mjs`는 `npm install --global`을
세 번 수행하고(clean prefix, baseline `ima2-gen@latest`, 후보 tarball) 그중
baseline 설치는 **네트워크에서 실제 레지스트리 tarball**을 받는다. 어느
하위 프로세스에도 개별 timeout이 없다 — `spawnSync` 호출 어디에도 `timeout`
옵션이 없고, 유일한 상한은 워크플로 단계의 `timeout-minutes: 15`
(`.github/workflows/publish.yml` 188행)다. 그래서 하나가 매달리면 단계 전체가
타임아웃되고, **어느 하위 단계가 매달렸는지 알려주는 계측이 없다.**

## 재개 조건

이 유닛은 다음 두 가지가 모두 관측된 뒤에 `_fin`으로 간다.

1. release 컷이 `assert-clean`을 통과해 preview까지 승격되고, npm `preview`의
   `gitHead`가 그 컷의 SHA와 일치한다.
2. Windows Node24/npm12에서 `test:package-global-update`가 단계 타임아웃 안에
   끝나거나, 하위 프로세스별 timeout·계측이 들어가 **어디서 매달리는지가
   기록된다**.

두 항목의 diff-level 계획은 `devlog/_plan/260813_maturity_roadmap/`의 `010`과
`020`이 소유한다.

## 이관 시 함께 처리할 부채

이 유닛 경로를 가리키는 devlog 밖 참조가 6건 있다. 이관하면 전부 깨진다.

| 파일 | 종류 |
|---|---|
| `scripts/audit-exceptions.json` | 예외 evidence 필드 |
| `tests/navrail-hover-label-contract.test.ts` | 주석 |
| `lib/grokUpstreamRetry.ts` | 주석 |
| `lib/grokImageCore.ts` | 주석 |
| `lib/grokUpstreamRetry.js` | 위 `.ts`에서 생성된 산출물 |
| `lib/grokImageCore.js` | 위 `.ts`에서 생성된 산출물 |

`.js` 2건은 소스를 고친 뒤 재생성해야 한다. 이관을 수행하는 work-phase의 수용
기준에 포함한다.

## 2026-08-14 — 재개 조건 충족

| 조건 | 상태 | 증거 |
|---|---|---|
| 1. release 컷이 `assert-clean` 통과 → preview 승격 → npm preview `gitHead` = 컷 SHA | **충족** | release run `31778196224` success. npm preview `3.0.7-preview.260814.31779318312.1`. `npm view ima2-gen@3.0.7 gitHead` = `11bb9b870828e38fd65c425e5a9fe31ce5d6aae1` |
| 2. Windows Node24/npm12 `test:package-global-update`가 단계 타임아웃 내 완료 | **충족** | publish run `31780064187` success |

릴리스를 고친 커밋은 `8bc4468e fix(release): verify provenance against the dispatch
host ref`다. 그 뒤 v3.0.6, v3.0.7이 연달아 발행됐다.

### 이 문서의 분석은 옳았다

두 실패의 성격을 다르게 진단한 것이 맞았다.

- **tsbuildinfo drift**: "원인은 제거됐다. 다만 재현되지 않았다" → 재현됐다.
- **Windows 타임아웃**: "원인이 제거되지 않았다" → 이번에는 상한 안에 들어왔다.

두 번째는 `해소`이지 `원인 제거`가 아닐 수 있다. #138 CI에서 Windows Node24/npm12가
15분 상한에 **14m43s**로 통과했다 — 여유 17초다. 이 문서가 지적한 계측 부재
(`spawnSync` 하위 프로세스에 개별 timeout 없음, 어느 단계가 매달렸는지 알 수단 없음)는
**여전히 유효하다**.

### 판정

이 유닛은 `_fin` 이관 가능하다. 이관은 `260814_issue_pr_zeroing_release/060`의
WP6에서 다른 아카이빙과 함께 한다. 위에 적힌 `.js` 2건 재생성 조건도 그 work-phase의
수용 기준에 포함한다.

계측 부재는 이 유닛의 재개 조건이 아니었으므로 이관을 막지 않는다. 대신
`260814.../060`에 **이월 항목**으로 기록한다 — 문제를 폴더 이동으로 지우지 않는다.
