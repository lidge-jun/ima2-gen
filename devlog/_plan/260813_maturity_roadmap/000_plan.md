---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, roadmap, maturity, release]
aliases: [ima2 maturity roadmap, 58/80 roadmap, 성숙도 로드맵]
---

# 000 — 성숙도 로드맵 유닛 계획

- 유닛: `devlog/_plan/260813_maturity_roadmap/`
- 세션: `019ff6f2-542f-7e21-a3ba-22d4fcc0397e`
- 루프: cxc-loop HOTL, goalplan slug `docs-only-diff-level-patch-roadmap-for-ima2-gen`
- 기준 트리: `dev` @ `ac1cace` (clean worktree, `main`/`preview`도 같은 SHA)
- 입력: 외부 성숙도 평가 (절대 58/80, 12개월 목표 70~72/80)

## 이 유닛이 하는 일

외부 평가가 지목한 문제를 **문서로만** 실행 가능한 형태로 바꾼다. 이 유닛에서
production 코드는 한 줄도 고치지 않는다. 산출물은 두 가지다.

1. `_plan`에 남아 있던 완료 유닛의 `_fin` 이관과 인덱스 정합성 회복.
2. 각 구현 phase마다 diff-level 십의 자리 문서 — 파일 변경 맵, IN/OUT 경계,
   검증 가능한 수용 기준, 조건부 경로별 활성화 시나리오, 실제로 실행해 본
   verifier 명령.

평가서를 그대로 옮겨 적지 않는다. 평가서의 모든 주장은 `002`의 원장에서
`verified` / `refuted` / `unverifiable`로 판정한 뒤에만 로드맵에 들어간다.

| 평가서 주장 | 판정 | 근거 |
|---|---|---|
| "최신 npm publish 워크플로가 실패했다" | verified | run `31605449399` failure, Windows Node24/npm12 `test:package-global-update` 15분 타임아웃 |
| "UI에 별도 테스트 스크립트가 없다" | verified | `ui/package.json` scripts = `dev`/`build`/`preview`만 존재 |
| "백엔드가 이미 `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`다" | **refuted** | `./tsconfig.json` 13행에 `strict: true`만 있다. 두 플래그는 `tsconfig*.json` 어디에도 없다 (`rg` 0건) |
| "저장소가 약 358MiB다" | 부분 verified | `git rev-parse --is-shallow-repository` = `false`. 해석된 gitdir `/Users/jun/Developer/new/.git/modules/700_projects/ima2-gen` = **415M**. 평가서의 358MiB와 측정 정의가 다를 수 있으나 "수백 MB"라는 요지는 성립한다 |

**이 표가 이 유닛의 존재 이유를 증명한다.** 세 번째 행은 원래 `verified`로 적혀
있었다. 평가서 문장을 확인 없이 옮긴 것이고, A phase 독립 감사가 `tsconfig.json`을
직접 읽어 반증했다. 평가서는 신뢰할 만하지만 **무오류가 아니다**. 검증 없이 통과한
주장 하나가 "strict 이전은 끝난 과제"라며 실재하는 타입 안전성 부채를 로드맵에서
지워버릴 뻔했다.

## work-phase 맵 (의존 순서, PHASE-SPLIT-01)

효율이나 성과 속도로 자르지 않는다. 각 phase는 앞 phase가 **검증한 산출물**을
소비한다. 소비 관계가 없는 곳에는 의존이 있다고 쓰지 않는다.

| WP | 문서 | 소비하는 선행 산출물 | 독립 검증 |
|----|------|----------------------|-----------|
| WP1 | 이 문서 + 아카이빙 | — | `_plan`/`_fin` 트리 + 인덱스 일치 |
| WP2 | `001`–`004` 연구 | WP1의 상태 스냅샷 | 주장별 증거 포인터 100% |
| WP3 | `010` 빌드 산출물 결정성, `020` 릴리스 컷 결정성, `030` 릴리스 채널 계약 | WP2의 실패 로그 원장 | 각 문서의 verifier 실행 결과 |
| WP4 | `040` provider registry, `050` job FSM, `060` 오류 분류 | WP2의 아키텍처 인벤토리 | 계약 문서 + 파일 변경 맵 |
| WP5 | `070` doctor/온보딩, `080` 프런트 E2E | WP4의 registry·FSM·오류 코드 | 시나리오별 활성화 근거 |
| WP6 | `085` 백엔드 타입 강화, `090` 거버넌스·공급망, 클로즈아웃 | **부분** — `085`는 WP2의 C-07 tsconfig 인벤토리를 소비. 공급망 절은 WP3의 `030`을 소비. 거버넌스 문서는 소비 없음 | 독립 감사 verdict |

**`010`이 소유하는 것 (WP2 감사 blocker 2 반영).** `010`은 "빌드 산출물 결정성"
이고, 여기에 추적된 18쌍 `.js`/`.ts` drift 제거와 devlog 백업 tarball 126MB 처리가
포함된다. 백엔드 컴파일러 플래그 강화(`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`)는 `080` E2E와 성격이 달라 `085`로 분리했다. 근거는
`002`의 "phase 귀속" 절.

**`085`의 위치.** `085`는 `080`–`089` decade **안의 하위 문서**이지 십의 자리
사이의 새 자리가 아니다(2라운드 감사 정정). 다만 `080`의 하위 단계가 아니라
**독립 사이클**로 돌린다: E2E와 컴파일러 플래그는 변경 표면도 검증 방식도 다르고,
`085`는 `080`의 산출물을 소비하지 않는다. 같은 decade를 공유할 뿐 순서 의존이
없으므로 병렬 가능하다. 소비하는 것은 WP2의 C-07 검증 결과다.

**의존 근거 (A phase 감사 blocker 4 반영, 재작성).**

처음 이 표는 WP3→WP4→WP5→WP6을 하나의 사슬로 그렸고, 감사가 그 사슬이 가짜라고
지적했다. 맞는 지적이다. provider registry는 릴리스 채널 계약을 **소비하지
않는다**. 실제 간선만 남기면 이렇다.

```
WP2 (증거 원장)
  ├─→ WP3: 010 빌드 산출물 결정성 → 020 릴리스 컷 → 030 채널 계약   (사슬)
  │        └─→ WP6: 090 공급망 (provenance/서명은 030의 발행 경로를 소비)
  ├─→ WP4: 040 registry → 050 job FSM → 060 오류 분류              (사슬)
  │        └─→ WP5: 070 doctor, 080 E2E (registry·FSM·오류 코드를 읽음)
  └─→ WP6: 085 백엔드 타입 강화 (C-07 tsconfig 인벤토리를 소비, 독립)
```

WP3 사슬과 WP4 사슬은 **서로 독립**이며 병렬 가능하다. 실행 순서를 WP3 먼저로
두는 것은 의존이 아니라 **위험 우선순위**다 — 지금 릴리스가 빨간 상태이고, 릴리스가
결정적이지 않으면 그 뒤 모든 phase의 검증이 "CI에서 초록이었다"는 재현 불가능한
주장으로 퇴화하기 때문이다. 이 문장이 우선순위 근거이지 의존 근거인 척하지
않는다는 점을 명시한다.

또한 감사가 지적한 대로 **소스/빌드 drift는 릴리스 결정성의 하위가 아니라
선행 조건**이다. 실패한 release run `31604716464`이 바로 그 증거다: 추적되는
생성 산출물(`ui/tsconfig.node.tsbuildinfo`)이 검증 단계에서 더럽혀져 컷이
멈췄다. 그래서 drift는 맨 뒤 `080`이 아니라 WP3의 **첫 문서 `010`**으로 옮겼다.

WP6의 거버넌스 문서는 WP3–WP5 전체를 소비하지 않는다. 공급망 부분만 `030`의
발행 경로를 소비하고, `CONTRIBUTING`/`SECURITY`/`CODEOWNERS`는 어느 것도
소비하지 않는 독립 항목이다.

## WP1 — diff-level 계획

### 파일 변경 맵

| 경로 | 동작 | 근거 |
|---|---|---|
| `devlog/_plan/260803_github_issue_pr_closeout/` | `mv` + `git add -f` → `devlog/_fin/260803_github_issue_pr_closeout/` (`git mv` 불가, 아래 "Git 추적 현실" 참조) | 이슈 #119 `CLOSED` (2026-08-04), PR #118 `CLOSED`, open issue/PR 0건, MiniMax 보수 커밋이 현재 `dev`의 조상 |
| `devlog/_plan/260812_navrail_grok_autotag/` | **유지 (이관하지 않음)** | 릴리스 lane이 실증되지 않았다. 아래 참조 |
| `devlog/_plan/260812_navrail_grok_autotag/060_release_activation_residual.md` | 신규 | 잔여 릴리스 활성화 항목을 명시적으로 기록 |
| `devlog/_plan/README.md` | 편집 | active lane 표, 아카이브 기록, 현재 유닛 등록 |
| `structure/07-devlog-map.md` | 편집 | 2026-07-26 기준 문장이 스테일 |
| `devlog/_plan/_future/` | 유지 | 대응 이슈 없음 + 구현 0건. 옮기면 정리가 아니라 은폐 |

### 260812를 옮기지 않는 이유 (A phase 감사 blocker 2 반영)

처음 계획은 이 유닛도 이관 대상으로 잡았다. `050`이 WP0–WP3 전부 `DONE`이라고
선언했기 때문이다. 감사가 `050`의 마지막 절을 직접 읽고 반증했다.

> `release.yml`은 저장소에 놓였지만 **실행하지 않았다**. […] 첫 실전 릴리스는
> 사용자 판단이다. — `devlog/_plan/260812_navrail_grok_autotag/050_release_automation_closeout.md`

그 뒤 실제로 실행됐고 **실패했다**.

| 증거 | 값 |
|---|---|
| release run | `31604716464` — `assert-clean`에서 `M ui/tsconfig.node.tsbuildinfo` |
| publish run | `31605449399` — Windows Node24/npm12 `test:package-global-update` 15분 타임아웃 |
| npm `preview` | `3.0.6-preview.260812.31603578657.1`, `gitHead` = `97b32ce` |
| 현재 HEAD | `ac1cace` — 성공한 preview 발행이 **없다** |

`_plan/README.md`가 금지하는 것이 정확히 이 상황이다: 폴더 위치로 완료를 주장하고
빨간 릴리스를 시야에서 치우는 것. `040`의 `NEEDS_HUMAN`은 승인으로 해소됐지만
`050`이 만든 워크플로 자체는 아직 초록인 적이 없다. 이 유닛은 `_plan`에 남고,
`060`으로 잔여 항목을 명시한다. 이관은 WP3의 `010`/`020`이 컷을 초록으로 만든
뒤에 한다.

### Git 추적 현실 (A phase 2라운드 감사 blocker 1 반영)

**`devlog/_plan/*`는 gitignore 대상이다** (`./.gitignore` 10행). 그래서:

```
$ git check-ignore -v devlog/_plan/260803_github_issue_pr_closeout/000_plan.md
.gitignore:10:devlog/_plan/*   devlog/_plan/260803_github_issue_pr_closeout/000_plan.md
```

이 유닛들의 파일은 **추적되지 않는다**. 따라서 원래 계획대로 `git mv`를 쓰면
실패한다 — `git mv`는 추적된 소스를 요구한다. `git status --porcelain`도 이
파일들을 보지 못하므로 `c1-a`의 검증자로 부적절하다.

반면 기존 `devlog/_fin/260726_zero-backlog-frontend-qa/`는 **추적된다**. 추적이
ignore를 이긴 상태이며, 과거에 강제 추가된 결과다. 새 `_fin` 경로는
`./.gitignore` 8행(`devlog/*`)에 걸리므로 자동으로 추적되지 않는다.

**수정된 실행 절차:**

```
mv devlog/_plan/260803_github_issue_pr_closeout devlog/_fin/260803_github_issue_pr_closeout
git add -f devlog/_fin/260803_github_issue_pr_closeout
git add -f devlog/_plan/260813_maturity_roadmap
git add -f devlog/_plan/260812_navrail_grok_autotag/060_release_activation_residual.md
git add devlog/_plan/README.md structure/07-devlog-map.md
```

`git mv`가 아니라 일반 `mv` + `git add -f`다. 새 `060` 잔여 문서도 `-f` 없이는
커밋에 들어가지 않는다. 이 지점을 감사가 잡지 않았다면 B phase에서 명령이
실패하거나, 더 나쁘게는 잔여 문서가 조용히 커밋에서 빠져 "기록했다"는 주장만
남았을 것이다.

### 인덱스 외 참조 (A phase 1라운드 감사 blocker 1 반영)

감사가 저장소 전역 `rg`로 두 유닛을 가리키는 인덱스 밖 참조 4건을 찾았다.

| 파일 | 가리키는 유닛 |
|---|---|
| `scripts/audit-exceptions.json:15` | 260812 |
| `tests/navrail-hover-label-contract.test.ts:3` | 260812 |
| `lib/grokUpstreamRetry.ts:10` | 260812 |
| `lib/grokImageCore.ts:203` | 260812 |

2라운드 감사가 `--no-ignore`로 재확인해 생성 산출물 2건을 추가로 찾았다:
`lib/grokUpstreamRetry.js` 10행, `lib/grokImageCore.js` 136행 (각각 대응 `.ts`에서
생성됨).

**여섯 건 모두 260812를 가리키고, 260812는 이번에 움직이지 않는다.** 따라서 이
WP의 이동으로 깨지는 참조는 0건이다. 260803을 가리키는 devlog 밖 참조는 없다
(`rg -n '260803_github_issue_pr_closeout' --glob '!node_modules' --glob '!devlog/**' .`
→ exit 1, 0건).

이것은 내가 추가 작업으로 해결한 것이 아니라 blocker 2의 결정에서 따라온
결과이므로 그대로 기록한다. **부채는 남는다**: 이 6개 참조는 260812가 나중에
이관될 때 깨지고, `.js` 2건은 소스 수정 후 재생성이 필요하다. 그 처리는 이관을
실제로 수행하는 WP3 클로즈아웃의 수용 기준에 포함한다.

### IN / OUT

- IN: `devlog/**`, `structure/07-devlog-map.md`, `mv` + `git add -f`, 로컬 커밋.
- OUT: `routes/`, `lib/`, `ui/src/`, `bin/`, `scripts/`, `.github/workflows/`,
  `package.json`. push, PR/이슈 생성, npm publish, workflow dispatch 전부 금지.

### 수용 기준

- `c1-a`: `devlog/_plan/` 직속에 남은 항목이 `README.md`, `_future/`,
  `260812_navrail_grok_autotag/`, `260813_maturity_roadmap/` 뿐이다.
  `ls devlog/_plan`으로 확인한다. `git status --porcelain`은 이 유닛들이
  ignore 대상이라 **쓰지 않는다**; 대신 `git add -f` 이후
  `git diff --cached --name-only`로 커밋 진입을 확인한다.
- `c1-b`: 이관한 유닛의 종결 근거(이슈/PR 상태 + 커밋 SHA)를 `README.md`
  아카이브 기록에 남긴다. 폴더 위치만으로 완료를 주장하지 않는다.
- `c1-c`: 260812가 `_plan`에 남아 있고, `060`이 실패한 run id 두 개와 재개
  조건을 명시한다. 이 기준이 충족되지 않으면 아카이빙은 은폐다.
- `c2-a`: 이관 후 다음 명령이 **exit 1 (0건)** 이다.

  ```
  rg -n --no-ignore -g '!node_modules' -g '!.git' -g '!devlog/**' \
     '_plan/260803_github_issue_pr_closeout' .
  ```

  세 개의 glob이 각각 필요하다. `--no-ignore`가 없으면 기본 `rg`가
  `.gitignore`를 존중해 devlog 유닛 자체를 건너뛰므로 실제로 깨지는 파일을
  보지 못한 채 통과한다(2라운드 감사 blocker 3). `-g '!devlog/**'`가 없으면
  devlog 내부의 **역사적** 언급 때문에 이관 후에도 영원히 0건이 되지 않아
  기계 판정이 불가능하다(3라운드 감사 blocker 1). 기준은 "devlog 밖 0건"이고,
  devlog 내부의 과거 기록은 보존 대상이지 위반이 아니다.
- `c2-b`: `devlog/_plan/README.md`와 `structure/07-devlog-map.md`가 이관 후
  트리를 가리키고, 260812를 active lane으로 표기한다.

### 조건부 경로 활성화 시나리오

이 WP가 추가하는 조건부 코드 경로는 없다(문서·파일 이동뿐). 대신 아카이빙
판정 자체가 조건부다: **"완료 근거가 없으면 옮기지 않는다"**.

이 가드는 이번 사이클에서 **실제로 발화했다**. 그것이 활성화 증거다. 260812는
원래 이관 대상이었고, 독립 감사가 `050`의 미실행 자백과 실패한 run 두 건을
제시해 가드가 걸렸다. 관측 가능한 효과: 이관 대상이 2건에서 1건으로 줄었고
`060` 잔여 문서가 생겼다. `_future/` 2건과 외부 차단 5건이 남는 것은 보조
증거다 — 그것만으로는 가드가 발화했는지 알 수 없고(원래도 안 옮겼으므로),
260812 사례만이 살아 있는 가드를 증명한다.

### verifier

```
node scripts/check-devlog-citations.mjs devlog/_plan/260813_maturity_roadmap
```

A phase 1라운드에서 exit 0이었으나, blocker 반영으로 문서를 고친 뒤 2라운드
감사가 **exit 1**을 재현했다. 내가 추가한 인용 3건이 축약형이었다.

세 건은 `bare-filename` 1건(디렉터리 없는 `tsconfig` 참조)과 `bare-line` 2건
(경로 없는 줄 번호 참조)이었고, 전부 repo-root-relative 형태로 고쳤다.

게이트가 **자기 자신을 고치는 과정에 새로 생긴 위반을 잡았다** — 이것이 이
게이트의 실제 활성화 증거다. 한 번 더 발화했다: 위반 로그를 그대로 인용문으로
붙여 넣었더니 그 인용문 자체가 축약 인용으로 걸려 다시 exit 1이 났다. 그래서
원문 대신 위반 **종류**로 기술한다. 게이트가 문서 본문을 진짜로 읽고 있다는
증거이기도 하다.

이 명령은 인자로 받은 디렉터리의 `.md`를 재귀적으로 직접 읽으므로 이 유닛의
변경 대상을 관측한다 (`./scripts/check-devlog-citations.mjs` 28행이 `process.argv`를
읽고 21–41행이 순회한다 — 최초 계획이 적은 27행은 감사가 잡은 한 줄 오차였다).

**이 게이트가 보호하지 못하는 것을 명시한다.** 잡는 것은 인용 **형식**뿐이다.
사실성, 아카이빙 판정의 정당성, git 추적 가능성은 하나도 검사하지 않는다. 두
라운드에 걸친 9개 blocker 중 이 게이트가 잡은 것은 1건(형식 위반)뿐이고, 나머지
8건은 전부 독립 감사가 잡았다. 따라서 `c1-b`, `c1-c`는 **자동 게이트가 아니라
사람/에이전트 리뷰**로 분류한다. `c1-a`와 `c2-a`만 명령 출력으로 기계 판정이
가능하다.

`ls devlog/_plan devlog/_fin`과 `git diff --cached --name-only`가 `c1-a`의
검증자다.

## 스코프 밖이지만 기록해 두는 판단

평가서의 "제품 포지셔닝을 한 문장으로 좁혀라"는 제안은 사용자만 내릴 수 있는
결정이다. 로드맵은 이 결정을 대신 내리지 않고 `090`에서 결정 지점으로만
표시한다.
