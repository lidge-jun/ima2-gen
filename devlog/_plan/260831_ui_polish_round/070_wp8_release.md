---
created: 2026-08-31
tags: [ima2-gen, devlog, release]
---

# 070 — wp8: 릴리스 준비 (발행은 wp10)

> 감사 wp2-F4로 범위 변경. FSM이 work-phase 등록 순서를 강제하고 wp9(모달 a11y)가
> wp8 뒤에 등록돼 있어서, 원안대로면 **모달 접근성 수정이 빠진 3.12.2를 발행**하게
> 됩니다. `cxc loop` 스티어링은 가산만 가능해 순서를 바꿀 수 없으므로,
> wp8을 **준비 전용**으로 좁히고 발행을 wp9 뒤의 **wp10**으로 옮겼습니다.
> 릴리스 노트에 "이번 판에는 모달 수정이 없다"고 적는 것으로는 산출물 출처가
> 고쳐지지 않습니다.

## 단계 분리

| 단계 | 하는 일 | 하지 않는 일 |
|---|---|---|
| wp8 | 게이트 체인 전체 실행, `assertBaseline` 확인, PR 머지와 `main` fast-forward, 버전 범프 **계획만** | 버전 커밋, 태그, 발행 |
| wp10 | wp9 머지 SHA를 `.release/required-units.json`에 기록(가드 구현은 wp2), 게이트 재실행, `main` **2차 fast-forward**, `assertBaseline` 재확인, 버전 범프 커밋, `release.yml` dispatch, 태그, npm 발행, 설치 증거 | — |

### wp10이 fast-forward를 다시 해야 하는 이유 (감사 wp2r2-F3)

wp8이 `main`을 `dev`까지 올린 뒤 wp9가 `dev`에 또 머지되므로, wp10 시작 시점에는
`main`이 `dev`보다 **뒤에 있습니다**. `assertBaseline`은 `main`이 `dev`를
포함할 것을 요구하므로 그 상태로 릴리스 preflight를 걸면 깨집니다. 앞선 판에는
2차 fast-forward 단계가 없었습니다.

wp10 시작 순서를 고정합니다.

1. wp9가 `dev`에 머지된 것을 확인.
2. 게이트 체인 전체 재실행(`npm run verify:release:source`). wp9가 소스를 바꿨으니
   wp8의 green은 재사용하지 않습니다.
3. `main`을 wp9를 포함한 `dev`까지 fast-forward.
4. `assertBaseline` 재확인 — problems `[]`.
5. 그 다음에 버전 범프와 dispatch.

### wp8이 발행하지 못하게 하는 **기계적** 제약

감사 wp2r3-F2 수용: goalplan 주석과 전역 criterion은 **집행 장치가 아닙니다**.
`wp8.criteriaIds`는 비어 있고, 주석은 원장 기록일 뿐이며, 전역 criterion은 최종
검증 시점에만 확인되므로 되돌릴 수 없는 발행을 사후에 발견하게 됩니다. 절차만으로는
부족합니다.

그래서 **릴리스 스크립트 자체에 프로베넌스 가드를 넣습니다.** 위치는 기존
`assert*` 계열과 같은 `scripts/release-cut.mjs`이고,
`.github/workflows/release.yml:69`가 `node scripts/release-cut.mjs preflight`를
부르므로 모든 릴리스 경로가 이 가드를 통과합니다.

**가드는 wp2에서 먼저 랜딩합니다**(감사 wp2r4-F1). wp10에서 만들면 wp8이 아직
무방비인 워크플로를 그대로 호출할 수 있어서, 보호 대상 단계보다 통제가 늦게
존재하게 됩니다. 순서를 뒤집습니다.

- **wp2**: `assertUnitProvenance`와 `.release/required-units.json`을 추가합니다.
  파일에는 이 라운드가 요구하는 유닛을 미리 적고 `sha`를 `null`로 둡니다.
  `null`은 "아직 머지 안 됨"이라 가드가 **fail-closed**로 동작합니다. 즉 wp2
  시점부터 wp9 없는 릴리스는 스크립트가 거부합니다.
- **wp9 머지 직후**: 그 머지 커밋 SHA를 `.release/required-units.json`에 기록합니다.
- **wp10**: 가드가 통과하는 상태에서 릴리스를 컷합니다.

fail-closed라서 wp2부터 wp9 머지 전까지는 릴리스가 아예 불가능합니다. 이 라운드는
어차피 wp10에서만 발행하므로 의도된 동작입니다.

앞선 판에는 "긴급 릴리스가 필요하면 `required-units.json`을 되돌리면 된다"고
적었는데 틀렸습니다(감사 wp2r7-F2). 초기값이 `{"wp9": null}`이라 파일을 되돌리든
지우든 가드는 계속 실패합니다. 실제 정책은 **wp9 머지 전에는 릴리스 없음**이고,
비상 탈출구는 `REQUIRED_UNITS` 상수에서 해당 유닛을 빼는 코드 커밋 하나뿐입니다.
리뷰가 붙는 소스 변경이라 조용히 우회할 수 없습니다.

wp8은 발행 경로를 아예 쓰지 않고 **베이스라인 준비만** 합니다:
`npm run verify:release:source`와 `node scripts/release-cut.mjs assert-baseline`만
실행합니다. `preflight`에는 부분 실행 모드가 없어서(현재 CLI는
`preflight | commit | assert-clean | assert-remotes-unmoved | assert-preview-proof`)
"baseline 부분까지만"이라는 호출이 성립하지 않습니다. 그래서 wp2에서
`assert-baseline` 서브커맨드를 새로 추가하고 wp8은 그것을 씁니다. 워크플로
dispatch(`npm run release:patch` 등)는 호출하지 않습니다.

가드의 **정본 스펙은 `devlog/_plan/260831_ui_polish_round/010_wp2_radius_scale.md:183`**
한 곳입니다. 이 문서에는 함수 본문을 다시 싣지 않습니다 — 앞선 판에서 여기
적어둔 사본은 `Object.entries(requiredCommits)`를 돌아서 파일이 `{}`면
루프가 0회로 끝나 fail-open이었고, `010`의 최종 스펙과 모순이었습니다
(감사 wp2r6-F1). 사본을 지우고 참조만 남깁니다.

요약하면 `010` 쪽 계약은 이렇습니다: 필요 유닛 목록은 코드 상수
`REQUIRED_UNITS`(`devlog/_plan/260831_ui_polish_round/010_wp2_radius_scale.md:198`)에
있고 JSON은 SHA만 담습니다. 객체가 아니면 거부, 키가 없으면 거부, `null`이면
거부, 40자리 hex가 아니면 거부, 그 다음에야 `contains()` 조상 검사를 합니다.
빈 파일도 실패로 떨어지므로 fail-closed입니다.

`preflight()`에서 `assertBaseline` 다음에 호출합니다. 단위 테스트와
변형 증명("`required-units.json`에 미포함 SHA를 넣으면 preflight 실패")도
wp2에서 같이 붙습니다.

wp8 쪽 제약은 그대로 유지합니다: C 단계에서 `package.json` 3.12.1 유지, 새 태그
0건, `npm view ima2-gen version` 불변을 증거로 제출해야 D로 넘어갑니다. 다만 이건
**보조** 통제이고, 실제 집행은 위 가드입니다.

wp10은 `dependsOn: [wp8, wp9]`로 등록했고, 새 완료 조건이 "발행된 버전의 태그
커밋이 wp9 머지의 후손이고 설치된 빌드에 공유 모달 포커스 훅과 Escape 스택이
들어 있을 것"을 요구합니다.

## 전제

시작 시점 기준 `origin/main` = `origin/dev` = `79ca516e`, 열린 PR 0건,
버전 3.12.1, npm latest 3.12.1, `assertBaseline` problems `[]`.

## 순서

1. 각 구현 사이클은 자기 브랜치에서 PR로 올리고, 리뷰 후 `dev`에 머지합니다.
   의존 사슬이라 스택 PR로 쌓되, PR CI는 `main`/`dev` 타깃에서만 돌기
   때문에 형제 브랜치를 타깃하면 CI가 안 붙습니다. 각 PR을 `dev`로 향하게
   하고 앞 PR이 머지된 뒤 `update-branch`로 올립니다.
2. 전부 머지된 뒤 `main`을 fast-forward로 올립니다. `dev`가 앞서 있는
   상태에서 `main`에 직접 머지하면 릴리스 preflight가 깨집니다.
3. `scripts/release-cut.mjs`의 `assertBaseline`으로 세 조건을 확인합니다:
   `origin/main`이 체크아웃과 같고, `dev`를 포함하고, `preview`를 포함.
4. (**wp10**) 버전을 올립니다: **3.12.2 (patch)**. 감사 지적대로 "사용자에게 보이는
   버그 수정이니 minor"는 근거가 아닙니다. 공개 기능이 늘지 않았고 릴리스 워크플로
   기본값도 patch입니다.
5. (**wp10**) `release.yml`을 dispatch합니다. cut 잡이 preflight를 걸고, 버전 커밋을
   만들고, `main`을 밀고, 그 SHA를 `preview`로 승격하고, preview 채널로
   `publish.yml`을 dispatch하고, npm preview 증거를 요구합니다. 그 다음 tag
   잡이 증거를 재확인하고 stable 태그를 만들어 `main`/`dev`/태그를 원자적으로
   밉니다.
6. (**wp10**) 설치 증거: 발행된 버전을 실제로 받아 `npm view ima2-gen version`과
   설치된 패키지에서 확인합니다. 추가로 설치된 번들에 wp9 산출물(공유 훅 + Escape
   스택)이 들어 있는지, 태그 커밋이 wp9 머지 커밋의 후손인지 확인합니다.

## 게이트

머지 전 각 PR에서: PR fast gate, CodeQL. 릴리스 전 로컬에서:
`npm run verify:release:source` 체인 전체(native deps, 두 typecheck, inventory,
UI 빌드, server/cli 빌드, provider registry, 전체 스위트, lint:pkg,
install policy, audit gate).

## 완료 조건

**wp8 완료 조건**: 게이트 체인 전체 green, `assertBaseline` problems `[]`,
`main`이 `dev`까지 fast-forward, 열린 PR 0건, 그리고 **발행하지 않았음의 증거** —
`package.json` 버전 3.12.1 유지, 새 태그 0건, `npm view ima2-gen version`이
3.12.1 그대로.

**wp10 완료 조건**: (wp2가 랜딩한) `assertUnitProvenance`가 실제 릴리스
경로에서 동작함을 확인하고 — `.release/required-units.json`에 wp9 머지 커밋의
**40자리 hex SHA**가 기록돼 있고 그 상태의 preflight가 통과하고, wp9 머지 후 게이트 재실행 green, `main`이 wp9 포함 `dev`까지
2차 fast-forward, `assertBaseline` problems `[]`, 3.12.2가 npm에 올라가고,
`main`/`dev`/태그가 한 SHA를 공유하고, 설치한 패키지에서 버전이 확인되고,
그 태그 커밋이 wp9 머지 커밋의 후손이며, 열린 PR이 0건.

## Implementation Log (B-phase)

Gate chain: typecheck, typecheck:tests, npm test (2732/0/2), UI build all green.
assertBaseline: verified.
main fast-forwarded: 79ca516e -> 0b22d7a4.
No publishing: package.json 3.12.1, npm latest 3.12.1, tag v3.12.1.
