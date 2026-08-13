---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, release, channel, opencodex]
---

# 030 — 릴리스 채널 계약 (main → preview → latest)

- work-phase: WP3 세 번째 문서
- 소비: `010` drift 제거, `020` 계측된 스모크
- 소비되는 곳: `090` 공급망 절

## 현재 승격 경로 (이미 존재하는 것)

```
dispatch(bump)
  ├ preflight        HEAD == origin/main, dev·preview가 조상
  ├ assert-toolchain Node/npm 정확 일치
  ├ commit           버전 계산, npm 기공개·기존 태그 거부, package.json/lock만 커밋
  ├ verify:release   전체 게이트 (45분 상한)
  ├ assert-clean     추적 산출물이 바뀌었으면 거부          ← 010이 이 통과를 가능하게 함
  ├ push             main ← 버전 커밋,  preview ← 같은 SHA
  ├ dispatch         publish.yml(preview, SHA) → 대기       ← 020이 이 단계를 계측
  ├ preview-proof    npm preview의 gitHead == 그 SHA
  ├ tag job          원격 미이동 재확인 → main/dev/tag 원자적 push
  └ dispatch         publish.yml(tag, SHA) → npm latest
```

**이 계약은 이미 강하다.** 발행 가능한 ref는 두 가지뿐이고
(`scripts/release-contract.mjs:145`), `id-token: write`는 최종 publish job에만
있으며 package job은 OIDC 토큰 부재를 능동적으로 증명한다
(`.github/workflows/publish.yml` 90행과 194행). npm provenance도 이미 있다
(`.github/workflows/publish.yml:231`).

따라서 이 phase는 **재설계가 아니라 세 개의 구멍을 메우는 것**이다.

## opencodex에서 가져올 것 (3개)

`004`의 대조표에서 채택으로 판정된 것만 옮긴다. 나머지 5개는 ima2-gen이 이미
갖췄거나 더 엄격하므로 손대지 않는다.

### 1. dry-run dispatch (기본 true)

| 경로 | 동작 |
|---|---|
| `.github/workflows/release.yml` `inputs` | `dry_run: choice [true, canary, false], default: true` 추가. 세 모드는 아래 참조 |
| `.github/workflows/release.yml` cut job | dry-run이면 원격 변경 단계(main push, preview push, publish dispatch, preview-proof)를 각각 `if`로 건너뛴다. preflight → commit(**로컬 커밋은 그대로 생성**) → `verify:release` → `assert-clean`까지는 정상 수행 |
| `.github/workflows/release.yml` cut job `outputs` | `dry_run: ${{ inputs.dry_run }}` 출력 추가 |
| `.github/workflows/release.yml` **tag job** | `if: needs.cut.outputs.dry_run == 'false'` **필수** — 아래 참조 |
| `scripts/release-cut.mjs` | `commit`은 그대로 로컬 커밋을 만든다. dry-run에서도 커밋해야 `assert-clean`이 의미를 갖는다 |

**조건은 `!= 'true'`가 아니라 `== 'false'`다 (구현 감사 1라운드 blocker 1).**
`!= 'true'`로 쓰면 `canary`에서 식이 참이 되어 canary 실행이 `main`/`dev`/태그
push와 stable 발행 dispatch까지 수행한다 — canary 계약(임시 candidate ref 외
불변)의 정면 위반이다. 세 모드 전부를 계약 테스트로 고정한다.

**`tag` job을 반드시 별도로 막아야 한다.** `cut` 안의 단계를 건너뛰는 것만으로는
부족하다. `tag`는 `.github/workflows/release.yml:100`의 **독립 job**이고 조건이
`needs: cut`뿐이다. `cut`이 성공으로 끝나면 `tag`가 그대로 실행되어 태그를 만들고
`main`/`dev`/태그를 push한 뒤 stable 발행까지 dispatch한다.

즉 job 수준 `if`를 빠뜨리면 **dry-run이 실제 릴리스를 수행한다.** 이 phase에서
가장 위험한 실패 모드이며, A phase 감사가 초안에서 이것을 잡았다.

**로컬 커밋은 되돌리지 않는다.** 초안은 "커밋을 남기지 않거나 즉시 되돌린다"고
적었는데, 그러면 `assert-clean`이 검사할 후보 트리가 사라진다.
`scripts/release-cut.mjs:142`의 `assertClean()`은 검증이 추적 산출물을 바꿨는지를
보는 것이므로 **버전 커밋이 존재하는 상태**에서 돌아야 한다. dry-run에서 안전한
이유는 커밋이 없어서가 아니라 **push하지 않기 때문**이다. 러너의 작업 디렉터리는
실행이 끝나면 사라진다.
| `./package.json` `release:patch`/`release:minor`/`release:major` | **반드시 함께 수정** — 아래 참조 |

**기존 스크립트가 조용히 no-op이 된다.** `package.json`의 `release:patch`는
`gh workflow run release.yml -f bump=patch`이고 `dry_run`을 넘기지 않는다.
기본값을 true로 바꾸는 순간 이 명령은 **아무것도 발행하지 않으면서 성공한다.**

릴리스가 조용히 안 되는 것은 릴리스가 시끄럽게 실패하는 것보다 나쁘다. 그래서 세
스크립트를 함께 바꾼다.

```
release:dry     → gh workflow run release.yml -f bump=patch -f dry_run=true
release:canary  → gh workflow run release.yml -f bump=patch -f dry_run=canary
release:patch   → gh workflow run release.yml -f bump=patch -f dry_run=false
release:minor   → gh workflow run release.yml -f bump=minor -f dry_run=false
release:major   → gh workflow run release.yml -f bump=major -f dry_run=false
```

워크플로 기본값은 true(UI에서 실수로 누르는 경우를 막는다), 명명된 스크립트는
의도를 명시한다. 이 두 변경은 **같은 커밋에 있어야 한다.**

**기본값을 true로 두는 이유.** 지금 `release:patch`는 곧바로 실전 릴리스다.
`050_release_automation_closeout.md`가 "첫 실전 릴리스는 사용자 판단"이라고
적고 실행을 미룬 것도 그래서다. 되돌릴 수 없는 동작이 기본값이면 사람이 워크플로를
시험하지 못한다.

평가서는 "preview publish 10회 연속 성공"을 종료 조건으로 제시했다. 채택하지
않는다. 컷마다 preview가 한 번 발행되므로 10회를 채우려면 의미 없는 버전 10개를
npm에 남겨야 한다. **dry-run 10회가 같은 결정성을 발행 없이 증명한다.**

### 2. `expected_sha` 입력

| 경로 | 동작 |
|---|---|
| `.github/workflows/release.yml` `inputs` | `expected_sha: string, required: false` |
| `.github/workflows/release.yml` cut job | 비어 있지 않고 `origin/main`과 다르면 즉시 실패 |

현재 컷은 **컷 이후**의 원격 이동만 막는다(`.github/workflows/release.yml:119`).
사람이 특정 SHA를 보고 릴리스를 결정한 뒤 dispatch하기까지의 간격은 보호되지
않는다. opencodex는 이 간격을 입력 하나로 막는다.

### 3. 정확 SHA CI 성공 게이트

| 경로 | 동작 |
|---|---|
| `.github/workflows/ci.yml` | `workflow_dispatch`/`workflow_call` 트리거 추가 (SHA 입력). **checkout이 그 입력을 소비해야 한다** (구현 감사 1라운드 blocker 2): `actions/checkout`에 `ref: ${{ inputs.sha || github.sha }}`를 지정하고, 체크아웃 직후 `git rev-parse HEAD`가 입력의 **전체 40자** SHA와 같은지 단정한다. 입력만 추가하고 checkout을 안 고치면 dispatch가 기본 브랜치를 검사하고 초록을 반환한다 |
| `.github/workflows/release.yml` cut job, **`main` push 이전** | 버전 커밋을 `refs/heads/release-candidate`로 push, 그 SHA로 `ci.yml` dispatch, 성공까지 대기. 실패면 `main`·`preview`가 움직이기 전에 멈춘다. dispatch는 반드시 `gh workflow run ci.yml --ref release-candidate -f sha=<전체 SHA>`로 한다 (구현 감사 2라운드 blocker 1): `--ref` 없이 입력만 넘기면 run이 기본 브랜치에 만들어져 run 메타데이터의 `headSha`가 후보 SHA가 아니게 되고, headSha 상관으로 기다리는 waiter가 영원히 못 찾는다. 대기 중 상관은 run의 `headSha == 후보 전체 SHA`와 checkout 직후 `git rev-parse HEAD` 단정 둘 다로 한다 |
| `.github/workflows/release.yml` cut job, 성공 후 | candidate ref 정리 (성공·실패 양쪽에서) |
| 같은 job, candidate push **전후** | stale ref 처리와 소유권 안전 정리 (구현 감사 1라운드 blocker 3 + 2라운드 blocker 2). push: 기존 원격 SHA를 관측한 뒤 `git push --force-with-lease=refs/heads/release-candidate:<관측값>`으로 원자적으로 대치한다 (무조건 삭제는 남의 ref를 지울 수 있다). 관측값이 없으면(없는 ref) empty-lease로 "없어야 함"을 단정한다. 정리 시: 원격 ref가 **이번 실행이 push한 SHA와 같을 때만** 삭제한다 — 누군가 수동으로 갈아 끼운 ref를 지우지 않기 위한 expected-SHA 리스다 |

현재는 릴리스 job **안에서** 후보를 검증할 뿐, 그 SHA에 대한 독립 CI 성공 실행을
조회하지 않는다. 자기 자신을 검증하는 것과 별도 워크플로가 검증한 기록을 확인하는
것은 다른 보증이다.

### 초안이 틀렸고 감사가 잡았다 — 기록해 둔다

이 절의 첫 판은 "버전 커밋에는 CI가 안 돈다"고 단정하고 게이트 대상을 **부모
SHA**로 바꿨다. 근거로 든 측정이 이랬다.

```
gh run list --workflow=ci.yml --commit a864e87     → 0건
```

**이 측정이 틀렸다.** `--commit`에 축약 SHA를 넘기면 매칭되지 않는다. 전체 SHA로
다시 조회하면 성공 실행이 두 건 나온다.

```
gh run list --workflow=ci.yml --commit a864e878dadf4e4c5191a8b4a58314176d87f979
  success  [agent] chore: release v3.0.5  CI  main  push  30875635884  13m59s
  success  [agent] chore: release v3.0.5  CI  dev   push  30875635828  15m16s
```

즉 버전 커밋은 CI를 **정상적으로 받는다.** (당시 컷은 `release.sh`가 개인 토큰으로
push했기 때문이다. `GITHUB_TOKEN` push가 워크플로를 안 만든다는 일반론은 맞지만,
그것을 이 커밋에 적용한 것은 검증 없는 추론이었다.)

따라서 부모 SHA 대체는 **불필요할 뿐 아니라 목적을 훼손한다.** "정확 SHA 게이트"를
표방하면서 실제로는 발행되지 않는 트리를 검사하게 되기 때문이다.

### 그러나 새 컷에서는 CI가 돌지 않는다 — 관측을 기다릴 문제가 아니다

과거 컷은 `release.sh`가 **개인 토큰**으로 push했기 때문에 CI가 돌았다. 새
`release.yml`은 워크플로 안에서 **`GITHUB_TOKEN`으로** push한다
(`.github/workflows/release.yml` 74행). GitHub은 `GITHUB_TOKEN` push가 다른
워크플로 실행을 만들지 않는다고 **명시적으로 보장한다.** 이 저장소도 같은 이유로
`publish.yml`을 dispatch로 부른다(`.github/workflows/publish.yml` 상단 주석).

그래서 초안이 제안한 "첫 실전 컷에서 관측한 뒤 결정한다"는 틀렸다
(2라운드 감사 blocker 1). 관측하려면 먼저 실전 컷을 돌려야 하고, 그 컷은
**게이트 없이 `main`과 `preview`를 이미 움직인 뒤**다. 게이트를 만들기 위해
게이트 없는 릴리스를 한 번 하는 셈이다. 게다가 결과는 문서로 이미 알 수 있다.

**따라서 게이트는 `c6` 이전에 완성한다.**

| 경로 | 동작 |
|---|---|
| `.github/workflows/ci.yml` | `workflow_dispatch`(또는 `workflow_call`) 트리거 추가. `ref`/`sha` 입력을 받는다 |
| `.github/workflows/release.yml` cut job | 버전 커밋 생성 후 **`main` push 이전**에 그 SHA로 CI를 dispatch하고 성공까지 대기 |

### 승격 순서를 바꾼다

현재 순서는 `main` push → `preview` push다. 게이트를 넣으려면 **`main`을
움직이기 전에** 검증 대상 SHA가 원격에 존재해야 한다. 그래서:

```
버전 커밋 생성 (로컬)
  → refs/heads/release-candidate 로 push      ← preview가 아니다
  → ci.yml을 그 SHA로 dispatch
  → 성공 대기                                  ← 실패해도 main·preview 그대로
  → main push
  → 같은 SHA를 preview로 push
  → publish dispatch(preview)
  → …
```

게이트가 막으면 `main`과 `preview`는 움직이지 않았고 candidate ref만 지우면 된다.

**후보 ref로 `preview`를 재사용하면 안 된다.** 이것이 이 순서 변경에서 가장
위험한 지점이다. `scripts/release-cut.mjs:53`의 `assertBaseline`은 매 컷마다
`main`이 `origin/preview`를 **포함**할 것을 요구한다. CI 게이트가 실패한 채
`preview`에 후보를 밀어 두면 `preview`가 `main`보다 앞서고, 그 뒤로 **모든 컷이
preflight에서 막힌다.** 되돌리려면 사람이 `preview`를 강제로 되감아야 한다.
전용 candidate ref는 어떤 기존 단언에도 등장하지 않으므로 실패해도 아무것도
막지 않는다.

발행 계약은 그대로다. `scripts/release-contract.mjs:411`은 preview 발행 시
`origin/main`이 후보 SHA의 **조상**일 것을 요구하는데, 위 순서에서 preview push는
main push 이후이고 후보 SHA는 baseline + 버전 커밋이므로 이 단언은 성립한다.
게이트는 push 순서만 바꾸고 분류·발행 계약은 건드리지 않는다.

## 브랜치 보호 (순서가 중요)

`main`, `preview`, `dev` 모두 classic protection이 없고(각각 HTTP 404) ruleset도
비어 있다.

**보호를 먼저 켜면 릴리스가 막힌다.** 릴리스 워크플로 자신이 세 브랜치를 직접
push하기 때문이다(`.github/workflows/release.yml` 74행과 126행). 그래서 순서를
고정한다.

1. dry-run으로 컷 경로가 초록임을 확인한다.
2. GitHub App/Actions 주체를 bypass 목록에 넣은 ruleset을 만든다.
3. 필수 체크로 `ci.yml`의 4개 매트릭스 job을 지정한다.
4. 다시 dry-run을 돌려 **보호가 릴리스를 막지 않는지** 확인한다.
5. 그 다음에야 직접 push를 제한한다.

4단계를 건너뛰면 첫 실전 릴리스에서 보호 규칙과 릴리스 자동화가 처음 충돌한다.

## IN / OUT

- IN: `.github/workflows/release.yml` 입력·게이트 추가, `.github/workflows/ci.yml`
  dispatch 트리거, `scripts/release-cut.mjs` dry-run 경로,
  `./package.json`의 release 스크립트 5종,
  `tests/release-pipeline-contract.test.ts` 케이스, ruleset 설정 절차 문서화.
- OUT: `publish.yml`의 발행 로직, `release-contract.mjs`의 ref 분류(이미 옳다),
  provenance/OIDC(이미 있다), dist-tag 선택 입력(자동 결정이 더 강하다),
  concurrency(이미 있다), timeout 값(`020` 소유).

## 수용 기준

- `c1`: `dry_run=true` dispatch가 **원격 상태를 하나도 바꾸지 않는다.** 실행 후
  `git ls-remote --heads origin`의 세 브랜치 SHA와 `npm view ima2-gen dist-tags`가
  실행 전과 동일하고 `refs/heads/release-candidate`도 생기지 않는다. 이것이 이
  phase에서 가장 중요한 기준이다.
- `c1c`: `dry_run=canary` 실행 후 `release-candidate` ref가 **남아 있지 않고**,
  세 브랜치와 dist-tag는 불변이다. 실행을 중도 취소해도 마찬가지다.
- `c1b`: `npm run release:patch`가 여전히 **실제 릴리스를 수행한다.** 기본값
  변경이 기존 명령을 no-op으로 만들지 않았음을 확인한다. 계약 테스트는
  다섯 스크립트의 **정확한 bump/dry_run 쌍**을 단정한다 (구현 감사 1라운드
  blocker 4 — "dry_run 플래그 존재"만 검사하면 `release:patch`에
  `dry_run=true`가 붙은 조용한 no-op도 통과한다): `release:dry`=(patch,true),
  `release:canary`=(patch,canary), `release:patch`=(patch,false),
  `release:minor`=(minor,false), `release:major`=(major,false).
- `c2`: `dry_run=true`가 10회 연속 성공한다. 실패하면 결정성이 없는 것이다.
- `c3`: `expected_sha`에 낡은 SHA를 주면 컷이 **버전 커밋 전에** 실패한다.
- `c4`: 게이트는 **발행될 SHA 자신**의 CI 성공을 요구한다. 부모나 baseline으로
  대체하지 않는다. 조회는 반드시 **전체 40자 SHA**로 한다 — 축약 SHA는 조용히
  0건을 반환해 게이트를 무의미하게 만든다(이번 감사가 잡은 실수).
- `c4b`: 게이트는 **`c6` 이전에 `dry_run=canary`로 한 번 실행돼 검증된다.**
  `ci.yml`에 dispatch 트리거가 있고, 컷이 버전 커밋 SHA로 그것을 부르고 성공을
  기다린다. 기본 `dry_run=true`에서는 이 단계가 skip이다 — 이유는 아래
  "dry-run은 세 모드다".
- `c4c`: CI가 실패하도록 만든 SHA로 canary를 돌리면 **`main`이 이동하지 않은 채**
  컷이 멈춘다. `git ls-remote --heads origin main`이 실행 전후 동일하다.
- `c4d`: CI 게이트 실패 후 **다음 컷이 정상적으로 시작된다.** `preview`가 `main`을
  앞지르지 않았음을 `scripts/release-cut.mjs:53`의 preflight가 통과하는 것으로
  확인한다. candidate ref를 preview로 재사용했다면 이 기준이 빨개진다.
- `c5`: ruleset 적용 후 dry-run이 여전히 통과한다.
- `c6`: 실전 컷 1회가 preview 발행까지 도달하고 npm `preview`의 `gitHead`가 그
  컷의 SHA와 일치한다. 이때 비로소 `010`의 tsbuildinfo 수정과 `020`의 계측이
  **관측으로** 확인된다.

## 조건부 경로 활성화 시나리오

### dry-run은 세 모드다 (3라운드 감사 blocker 1)

감사가 실제 모순을 짚었다. `c1`은 dry-run이 원격을 **하나도** 바꾸지 않기를
요구했고, `c4b`는 같은 dry-run이 정확 SHA CI 게이트를 실행하기를 요구했다. 그런데
별도 워크플로는 **다른 러너의 로컬 클론에만 있는 커밋을 checkout할 수 없다.**
검증하려면 그 SHA가 원격 어딘가에 있어야 한다. 두 기준은 동시에 만족될 수 없었다.

한쪽을 고르는 대신 모드를 나눈다.

| 모드 | 원격 효과 | 무엇을 증명하나 |
|---|---|---|
| `dry_run=true` (기본) | **없음** | preflight, 버전 계산, `verify:release`, `assert-clean`. CI 게이트 단계는 skip |
| `dry_run=canary` | `release-candidate` ref가 실행 중에만 존재 | 위 전부 + 정확 SHA CI dispatch와 대기 |
| `dry_run=false` | 실제 릴리스 | 전 구간 |

게이트 자체를 실전 전에 한 번은 돌려 봐야 한다. 그러나 그것을 기본 dry-run에
넣으면 "아무것도 바꾸지 않는다"는 가장 중요한 보증이 깨진다. 그래서 기본값은
완전히 무해하게 두고, 게이트 리허설은 **의도적으로 선택**하게 한다.

`canary`의 원격 효과를 정확히 정의한다: `refs/heads/release-candidate`가 실행
중에만 존재하고, 성공·실패·취소 어느 경우에도 `always()` 정리 단계가 지운다.
`main`, `dev`, `preview`, 태그, npm은 어느 것도 바뀌지 않는다.

이 phase는 조건부 경로만 추가한다. 전부 강제로 발화시켜야 한다.

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| dry-run 분기 (cut) | `dry_run=true` dispatch | main push, preview push, publish dispatch, preview-proof 단계가 skip 표시 |
| canary 분기 | `dry_run=canary` dispatch | candidate ref push와 CI dispatch·대기가 실행된 뒤 정리 단계가 ref를 지운다 |
| candidate ref 정리 | canary 실행을 중도 취소 | `always()` 정리가 돌아 ref가 남지 않는다 |
| dry-run 분기 (**tag job**) | 같은 실행 | `tag` job 전체가 skipped로 표시. 이것을 별도로 확인하지 않으면 dry-run이 실제 릴리스를 수행할 수 있다 |
| dry-run에서도 도는 것 | 같은 실행 | preflight, 버전 커밋, `verify:release`, `assert-clean`은 정상 실행되어 초록 |
| `expected_sha` 불일치 | 직전 커밋 SHA를 넣고 dispatch | 버전 커밋 이전 단계에서 실패, 오류가 두 SHA를 모두 출력 |
| `expected_sha` 미지정 | 값 없이 dispatch | 경고만 남기고 진행 (opencodex와 동일한 선택적 동작) |
| CI 게이트 미충족 | CI 실행이 없는 SHA로 조회 | 태그 job 이전에 실패, 조회한 **전체** SHA를 명시 |
| 축약 SHA 오용 방지 | 게이트 구현에 40자 미만 SHA를 넣는 단위 테스트 | 게이트가 "0건"을 성공으로 오인하지 않고 오류를 낸다 |
| ruleset bypass | 보호 적용 후 dry-run | Actions 주체의 push가 거부되지 않음 |

`c1`의 "원격 불변"은 **음성 대조**다. dry-run이 성공했다는 사실만으로는 그것이
아무것도 바꾸지 않았음을 증명하지 못한다. 실행 전후의 원격 SHA와 dist-tag를
비교해야 한다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `actionlint .github/workflows/release.yml` | 워크플로 문법 | `050`이 기존 워크플로에 실행해 exit 0 기록 |
| `node --test tests/release-pipeline-contract.test.ts` | 릴리스 계약 회귀 | 기존 파일 존재. 현재 통과 |
| `git ls-remote --heads origin` | dry-run 전후 원격 불변 (`c1`) | **실행함** — `dev`/`main`/`preview` 모두 `ac1cace` |
| `npm view ima2-gen dist-tags` | 같은 목적 | **실행함** — `latest 3.0.5`, `preview 3.0.6-preview.260812.31603578657.1` |

워크플로 변경은 **로컬 게이트로 검증할 수 없다.** `actionlint`는 문법만 보고,
실제 동작은 dispatch해야만 관측된다. 그래서 `c1`–`c5`의 검증자는 로컬 명령이
아니라 **실제 dry-run dispatch와 그 전후 상태 비교**다. 이 phase는 사용자 승인이
필요한 첫 지점이기도 하다: dry-run이라도 dispatch는 GitHub Actions를 실행시킨다.

## 사용자 결정이 필요한 지점

1. **첫 dry-run dispatch 승인.** 원격을 바꾸지 않지만 Actions를 소비한다.
2. **ruleset 적용.** 저장소 설정 변경이며 되돌리기 쉽지만 관리자 권한이 필요하다.
3. **첫 실전 컷(`c6`).** 실제 버전이 발행된다. `050`이 미뤄 둔 바로 그 결정이다.

이 세 가지는 코드로 해결되지 않는다. 로드맵은 여기까지 준비하고 멈춘다.
