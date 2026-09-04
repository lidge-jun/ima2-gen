# 260904 푸시 + 배포 — 계획 (000)

## Loop specification

- Loop archetype: spec-satisfaction (릴리스 전달). work-phase 2개 예상.
- Trigger: 사용자 요청 "푸시하고 배포까지 완료하도록" (2026-09-04). 모델 셀렉트 빈 라벨
  수정(30190da8, 684af450)을 origin에 올리고 릴리스까지 완료.
- Goal: 두 커밋이 origin/dev, origin/main, origin/preview, 태그, npm latest에 동일 SHA로
  올라가고, 릴리스 게이트가 실제로 통과한 증거를 남긴다.
- Non-goals: 무관한 기능 추가, 디자인 변경, dependabot PR 일괄 처리, 강제 푸시,
  릴리스 절차 자체의 재설계.
- Verifier: `node scripts/release-cut.mjs preflight`, exact-head CI 결과,
  `gh run` 결론, `npm view ima2-gen dist-tags`, `git merge-base --is-ancestor`.
- Stop condition: 아래 수락 기준 전부 신선한 출력으로 입증.
- Memory artifact: 이 유닛 + goalplan.
- Expected terminal outcomes: DONE. 승인 게이트(npm-stable 환경)나 CI 인프라 문제 시 BLOCKED.
- Escalation: 상향 — 같은 패킷을 서로 다른 서브에이전트 둘이 실패하면 메인 회수.
- HOTL resource bounds: 쓰기 범위는 아래 FILE SCOPE + git push. 릴리스 워크플로 dispatch 허용
  (사용자가 "배포까지 완료" 명시). 강제 푸시/히스토리 재작성 금지.
- Authority: 사용자가 push와 deploy를 명시 승인했다. 이는 이 변경의 릴리스 범위에 한정된다.

## 릴리스 토폴로지 (코드에서 읽은 사실)

`.github/workflows/release.yml`은 `workflow_dispatch` 전용이며 한 실행에서 전 과정을 돈다:

```
baseline -> version commit -> 후보 전용 ref로 exact-SHA CI 게이트
  -> main push -> preview 승격 -> preview publish 증명
  -> [npm-stable 환경 승인] -> main+dev+태그 원자적 push -> stable publish
```

핵심 제약 (`scripts/release-cut.mjs:53-59` `assertBaseline`):

```js
if (main !== head) problems.push(...)          // 컷은 main에서 시작
if (!contains(dev, head)) problems.push(...)   // main이 dev를 포함해야
if (!contains(preview, head)) problems.push(...)
```

워크플로는 `ref: main`으로 체크아웃한다. 따라서 **내 커밋이 main에 있어야 릴리스가 그것을
포함한다.** 현재 상태:

| ref | SHA |
|---|---|
| origin/dev | 19a68d98 |
| origin/main | d39f9ea2 (v3.13.0) |
| origin/preview | d39f9ea2 |
| 로컬 dev | 684af450 (origin/dev보다 2 ahead) |
| npm latest | 3.13.0 |

origin/dev가 origin/main보다 1 커밋 앞서 있다(19a68d98 = v3.13.0 릴리스 증거 문서).
즉 **직전 릴리스도 dev에 docs 커밋을 남긴 뒤 main을 정렬하지 않은 상태**다.

`assertUnitProvenance`의 `REQUIRED_UNITS = ["wp9"]`는 확인했다: wp9 SHA
86bf4590이 내 HEAD의 조상이다(검증 완료).

## 선결 결함 2건 (내 변경과 무관, 릴리스를 막음)

exact-head CI가 릴리스 게이트다. 현재 v3.13.0 SHA에서 CI가 실패 중이다.
중요: 같은 SHA의 `push`/`workflow_dispatch` 실행은 **성공**했고, 실패는 9/2·9/3·9/4
`schedule` 실행 3건뿐이다. 즉 코드 회귀가 아니라 시간이 지나며 드러난 결함이다.

### 결함 A — npm audit 게이트: fast-uri 고위험

```
audit gate: 1 high+ vulnerability in root production dependencies
high fast-uri  범위 3.0.0 - 3.1.5  fixAvailable: true
```

4건의 advisory(GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf,
GHSA-jqff-g426-hqxp). 경로: `@modelcontextprotocol/sdk@1.30.0 > ajv@8.20.0 > fast-uri@3.1.5`.
수정본 4.x 존재. 전이 의존성이므로 `overrides`가 정석. 이 저장소는 a02fcf74에서
`browserslist`를 같은 방식으로 처리한 전례가 있다(감사 게이트 해소 목적).

주의: ajv가 fast-uri 3.x API에 의존할 수 있으므로 4.x override는 **런타임 검증 필요**.
override만 넣고 테스트를 안 돌리면 MCP 프로바이더 레인을 조용히 깨뜨릴 수 있다.

### 결함 B — Windows action pin gate 경로 구분자

```
not ok 21 - discovers manifests wherever a local action actually lives
error: 'discovery missed .github/workflows/a.yml;
        found .github\\actions\\x\\y\\action.yaml, .github\\workflows\\a.yml, ...'
```

`tests/action-pin-contract.test.ts`가 `join()`으로 경로를 만들고 POSIX 구분자로 비교한다.
Windows에서만 실패하는 **테스트 자체의 버그**이며 제품 코드 결함이 아니다.

## Work-phase 분할 (PHASE-SPLIT-01, 의존 순서)

- **wp2 — CI 그린 복구.** 결함 A와 B를 고쳐 exact-head CI를 통과시킨다.
  릴리스 게이트가 CI이므로 이것이 선결 조건이다. 독립 검증 가능:
  후보 SHA에서 CI 성공.
- **wp3 — 푸시 + 릴리스 실행.** dev 푸시 → main 정렬 → release.yml dispatch
  (bump=patch, dry_run=false, expected_sha 고정) → 승인 → 태그/npm 확인.

wp2를 건너뛰고 릴리스를 던지면 후보 CI 게이트에서 실패해 원격은 그대로지만 시간만
날린다. 순서는 스케줄이 아니라 의존성에서 나온다.

## FILE SCOPE

IN (wp2): `package.json` (overrides), `package-lock.json`,
`tests/action-pin-contract.test.ts` (경로 정규화).
IN (wp3): git ref 이동, 워크플로 dispatch. 소스 변경 없음.
IN: `devlog/_plan/260904_push_and_release/`.

OUT: 무관한 의존성 업그레이드, dependabot PR 병합, 릴리스 워크플로 로직 변경,
강제 푸시, 다른 기능.

## 수락 기준

1. `npm run audit:gate`가 고위험 0으로 통과하고, MCP 프로바이더 경로가 실제로 동작.
2. action pin 계약 테스트가 Windows 경로 구분자에서도 통과(POSIX에서도 회귀 없음).
3. 후보 SHA에서 exact-head CI 성공(모든 매트릭스 잡).
4. origin/dev, origin/main, origin/preview, 태그가 동일 릴리스 SHA를 공유.
5. npm latest가 새 버전이고 gitHead가 그 SHA와 일치.
6. 모델 셀렉트 수정 커밋 두 개가 릴리스 SHA의 조상.

## 우회 경로 (PLAN-BYPASS-NAMED-01)

- tier: E8 (릴리스 게이트).
- 실행 표면: GitHub Actions + npm-stable 환경 승인.
- 알려진 우회: 로컬에서 태그를 직접 밀거나 npm publish를 수동 실행하면 게이트 전체를
  건너뛴다. 나는 하지 않는다.
- 잔여 위험: 승인 게이트는 사람이 눌러야 하므로 내가 완료를 보장할 수 없다.
- 최종 집행 계층: npm-stable 환경 승인(사람).

