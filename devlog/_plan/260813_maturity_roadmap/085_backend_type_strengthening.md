---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, typescript]
---

# 085 — 백엔드 타입 강화

- work-phase: WP6
- 소비: `002` C-07 (평가서 주장 반증)
- 소비되는 곳: 없음. `080`과 같은 decade지만 독립 사이클이다

## 왜 이 문서가 있나

평가서는 "TypeScript 엄격 모드 이전은 이미 끝난 과제"라며 이 영역을 로드맵에서
뺐다. `002` C-07이 반증했다. `./tsconfig.json` 13행에 `strict: true`만 있고
`noUncheckedIndexedAccess`와 `exactOptionalPropertyTypes`는 **어느
`tsconfig*.json`에도 없다**.

평가서를 검증 없이 따랐다면 이 과제는 사라졌을 것이다.

## 비용을 측정했다

추정하지 않고 실제로 켜서 셌다. 두 플래그를 `./tsconfig.json`에 넣고
`npx tsc --noEmit`을 돌린 뒤 원복했다.

| 설정 | 오류 수 |
|---|---:|
| 현재 (`strict`만) | **0** |
| `noUncheckedIndexedAccess`만 | 159 |
| `exactOptionalPropertyTypes`만 | 148 |
| 둘 다 | **312** |

159 + 148 = 307 < 312이므로 **5건은 두 플래그의 상호작용**에서 나온다. 하나씩
켜도 나머지가 남는다는 뜻이고, 순차 도입이 가능하다는 근거이기도 하다.

오류 종류 분포:

| 코드 | 건수 | 의미 |
|---|---:|---|
| TS2379 | 92 | `exactOptionalPropertyTypes` — `undefined` 할당 불가 인자 |
| TS2375 | 44 | 같은 계열 — 객체 리터럴 |
| TS2345 | 41 | 인자 타입 불일치 |
| TS18048 | 41 | `noUncheckedIndexedAccess` — 값이 `undefined`일 수 있음 |
| TS2532 | 36 | 같은 계열 — 객체가 `undefined`일 수 있음 |

가장 많이 걸린 파일:

| 파일 | 건수 |
|---|---:|
| `routes/mcpMedia.ts` | 12 |
| `lib/responsesImageAdapter.ts` | 11 |
| `lib/promptImport/promptIndex.ts` | 11 |
| `lib/spriteAtlasCompose.ts` | 10 |
| `lib/generatePipeline.ts` | 9 |

컴파일 대상은 **300개 파일**이고, 312건의 오류는 그중 **91개 파일**에 흩어져
있다(`tsc --listFilesOnly` 및 오류 경로 유니크 카운트). 초안이 적은 "대상 파일
296개"는 컴파일 대상과 영향 파일을 뒤섞은 수치였다(A phase 감사).

가장 많이 걸린 파일이 12건이므로 **한 파일에 몰려 있지 않다**. 이것이 작업의
성격을 결정한다: 국소 리팩터가 아니라 넓고 얕은 수정이며, 91개 파일을 배치로
나눠야 리뷰가 가능하다.

## 순서: 한 번에 켜지 않는다

312건을 한 커밋에 고치면 리뷰가 불가능하고 회귀를 잡을 수 없다.

| 단계 | 작업 |
|---|---|
| 1 | `noUncheckedIndexedAccess`만 켜고 159건 수정 |
| 2 | 켠 채로 커밋. CI 초록 확인 |
| 3 | `exactOptionalPropertyTypes` 추가, 나머지 수정 |
| 4 | 두 플래그 모두 `./tsconfig.json`에 영구 등록 |

1단계를 먼저 하는 이유는 **리뷰 크기와 위험 관리**다. 159건이 312건보다 다루기
쉽고, 두 플래그의 오류 성격이 달라 한 배치에 섞으면 리뷰어가 문맥을 계속
전환해야 한다.

**"인덱싱 오류가 런타임 버그 후보"라는 주장은 하지 않는다.** 초안은 그렇게
적었지만 A phase 감사가 10건을 표본 조사한 결과 대부분이 **이미 방어된 접근**
이었다: 길이를 확인한 뒤의 인덱싱(`bin/lib/characterResolve.ts:23`), 루프 범위
내 인덱싱(`bin/commands/gen.ts:279`), 필터 후 접근(`bin/commands/skill.ts:150`)
처럼 제어 흐름상 안전하지만 컴파일러가 좁히지 못하는 경우다.

즉 두 플래그 모두 주로 **타입 표현의 정밀도** 문제이고, 진짜 결함이 섞여 있을
수는 있어도 그 비율은 측정되지 않았다. `i4`가 실제 발견 건수를 기록해 이 질문에
답한다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `./tsconfig.json` | 두 플래그 추가 (단계별) |
| `lib/**`, `routes/**`, `bin/**`, `server.ts`, `config.ts` | 312건 수정 |
| `tsconfig.tests.json` | **별도 판단** — 여기는 `strictNullChecks`가 꺼져 있다. 이번 범위 밖 |

## IN / OUT

- IN: `./tsconfig.json`의 두 플래그, 그로 인해 드러난 312건의 수정.
- OUT: `tsconfig.tests.json`(별도 과제), `ui/`(별도 tsconfig 체계), 동작 변경.
  **타입을 맞추려고 로직을 바꾸지 않는다** — 바꿔야 한다면 그것은 발견된 버그이고
  별도로 기록한다.

## 수용 기준

- `i1`: `npm run typecheck`가 두 플래그를 켠 상태에서 exit 0.
- `i2`: `npm test`가 그대로 통과한다. 312건 수정이 동작을 바꾸지 않았음을 본다.
- `i3`: **타입 단언으로 때우지 않는다.** 수정 전후로 타입 단언(`as` 표현식)과
  논-널 단언(`!`) 사용 횟수를 세어 유의미하게 늘지 않음을 확인한다. 단언으로
  침묵시키면 플래그를 켠 의미가 사라진다. 세는 명령은 B에서 확정하되, 전후 비교가
  가능한 형태여야 한다.
- `i4`: 수정 중 발견한 **실제 버그를 따로 기록한다.** 312건 중 일부는
  "`undefined`일 수 있는데 처리 안 함"이고, 그중 도달 가능한 것은 진짜 결함이다.
  0건이면 그것도 기록한다 — 전부 이론적이었다는 뜻이므로.

## 조건부 경로 활성화 시나리오

이 phase는 조건부 경로를 **추가하지 않는다.** 오히려 기존 코드의 암묵적
`undefined` 경로를 드러낸다. 활성화 증거는 `i4`가 담당한다: 발견된 버그마다
그것이 실제로 도달 가능한지 판단하고, 도달 가능하면 재현 테스트를 남긴다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `npm run typecheck` | `lib/**`, `routes/**`, `bin/**`, `server.ts`, `config.ts` | **실행함** — 현재 exit 0, 두 플래그 켜면 312건 |
| `npm test` | 회귀(`i2`) | `d2fe420`에서 2118/2116 pass |
| `npm run typecheck:tests` | `tsconfig.tests.json` | 범위 밖이지만 깨지지 않아야 한다 |

측정 절차를 남긴다. `./tsconfig.json`을 백업하고 플래그를 넣은 뒤
`npx tsc --noEmit -p tsconfig.json`의 `error TS` 줄 수를 세고 원복했다.
이 유닛의 어떤 문서보다 재현이 쉬운 숫자다.
