---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, release, ci]
---

# 020 — 릴리스 컷 결정성

- work-phase: WP3 두 번째 문서
- 소비: `010`의 drift 제거 (추적 산출물이 없어야 `assertClean`이 통과 가능)
- 소비되는 곳: `030` 릴리스 채널 계약

## 문제

publish run `31605449399`에서 Windows Node24/npm12의
`test:package-global-update`가 15분 단계 상한에 걸렸다. 같은 단계의 성공 실측:

| run | Node/npm | 소요 |
|---|---|---:|
| 31605449399 | 24/12 | **15:03 타임아웃** |
| 31603578657 | 24/12 | 5:58 |
| 31600717390 | 24/12 | 6:33 |
| 30875635806 | 24/12 | 6:03 |
| 30874968178 | 24/12 | 4:52 |
| 30303574819 | 24/12 | 8:16 |

성공 중앙값 6:03, 최대 8:16. **15분은 빠듯한 예산이 아니라 넉넉한 상한이었고,
평소 6분짜리 작업이 2.5배를 넘겨 매달린 것이다.**

따라서 상한을 올리는 처방은 틀렸다. 올리면 다음 stall에서 25분을 기다린 뒤 같은
자리에서 실패하고, 원인은 여전히 모른다.

## 진짜 결함: 계측 부재

`scripts/package-global-update-smoke.mjs`의 자식들에게 **개별 timeout이 하나도
지정돼 있지 않다.** 결함의 위치를 정확히 짚는다: `spawnNpmSync`
(`scripts/npm-subprocess.mjs:21`)는 `...options`로 **이미 `timeout`을 전달한다.**
실측했다.

```
spawnNpmSync(["--version"], { encoding: "utf8", timeout: 1 })
  → error.code === "ETIMEDOUT"
```

따라서 헬퍼는 **변경하지 않는다.** 문제는 호출부가 값을 주지 않는 것이다:
`commandOptions()`(`scripts/package-global-update-smoke.mjs:11`)가 `timeout`을
설정하지 않아 전달 경로는 살아 있는데 값이 비어 있다. 초안은 헬퍼를 고치자고
했고, 그것은 이미 되는 것을 건드리면서 진짜 원인을 놓치는 처방이었다
(A phase 2라운드 감사 blocker 2).

**정본 인벤토리 — CI 13개, 로컬 14개.**

| 개수 | 하위 프로세스 | 자손을 만드나 | 네트워크 |
|---:|---|---|---|
| 3 | `npm --version` | 아니오 | 아니오 |
| 3 | `npm install --global --prefix …` | **예** (라이프사이클 스크립트, 네이티브 빌드) | **예** (baseline은 레지스트리 수신) |
| 2 | `npm root --global --prefix …` | 아니오 | 아니오 |
| 2 | 설치된 `ima2 --version` | 아니오 | 아니오 |
| 1 | 번들 `codex login status` | **예** | 아니오 |
| 1 | 설치된 `ima2 status` | **예** (중첩 Codex probe) | 아니오 |
| 1 | 설치된 `ima2 doctor` | **예** (중첩 Codex probe) | 아니오 |
| **1 (로컬 전용)** | `npm pack` | **예** (`prepack`이 UI·서버·CLI 빌드) | 아니오 |

마지막 행은 `IMA2_PACKAGE_TARBALL`이 없을 때만 실행된다
(`scripts/package-global-update-smoke.mjs:50`). CI는 tarball을 넘겨 건너뛰므로
실패한 run에는 없었지만, 수용 기준 `b4`가 로컬 실행을 요구하므로 예산과 로깅에
포함해야 한다. 실제로는 **가장 무거운 자식**이다.

실패 로그는 바깥 단계 타임아웃만 남기고 **어느 자식이 매달렸는지 알려주지
않는다.** 그래서 지금은 원인을 추정만 할 수 있다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `scripts/npm-subprocess.mjs` | **변경 없음** — 이미 `timeout`을 전달한다 (실측 확인) |
| `scripts/package-global-update-smoke.mjs` | `commandOptions()`에 기본 timeout 도입, 단계별 `[smoke] <label> start/done <ms>` 로깅, 타임아웃 시 label을 지목하는 오류. 자손을 만드는 자식은 아래 러너로 이관 |
| `scripts/subprocess-deadline.mjs` | 신규. async `spawn` + 자체 타이머 + 트리 정리(Windows `taskkill /T`, POSIX 프로세스 그룹 kill) |
| `.github/workflows/publish.yml` `timeout-minutes` 값 | **변경 없음** — 아래 참조 |
| `.github/workflows/publish.yml` `windows-consumer` job | 스코프 **안**. 손자 생존 계약 테스트를 실행하는 영구 단계 추가 |
| `tests/package-global-update-smoke-contract.test.ts` | 신규. 모든 호출부의 timeout 지정과 label 오류를 고정 |
| `tests/subprocess-deadline-contract.test.ts` | 신규. 손자 생존 음성 대조 |

**`timeout-minutes: 15`를 그대로 두는 이유.** 하위 프로세스 deadline을 합이 15분을
넘지 않게 잡으면 단계 상한은 안전망으로만 남는다. 상한을 먼저 올리면 계측이
붙기도 전에 증상이 가려진다. 상한 조정은 계측이 실제 소요 분포를 보여준 **뒤**의
판단이며, 이 phase의 작업이 아니다.

### 하위 프로세스별 deadline (제안값)

| 대상 | 개수 | deadline | 실행 방식 | 근거 |
|---|---:|---:|---|---|
| `npm --version` | 3 | 60s | sync | 로컬. 60초를 넘으면 그 자체가 이상 신호 |
| `npm root --global` | 2 | 60s | sync | 로컬 |
| `ima2 --version` | 2 | 60s | sync | 버전 출력만. 자손 없음 |
| `npm install --global` (tarball) | 2 | 300s | **async** | 라이프사이클 스크립트가 자손을 만든다 |
| `npm install --global` (`ima2-gen@latest`) | 1 | 420s | **async** | 유일한 레지스트리 의존 + 자손 |
| `codex login status` | 1 | 120s | **async** | Codex 자손. `lib/codexDetect.ts`의 2초 기본값은 이 직접 호출에 적용되지 않는다 |
| `ima2 status` | 1 | 120s | **async** | 중첩 Codex probe |
| `ima2 doctor` | 1 | 120s | **async** | 중첩 Codex probe |
| `npm pack` (로컬 전용) | 1 | 900s | **async** | `prepack`이 UI·서버·CLI를 전부 빌드. 가장 무거운 자식 |

최악 합계는 두 경로가 다르다.

| 경로 | 합계 |
|---|---:|
| CI (13개, tarball 제공) | 60×3 + 60×2 + 60×2 + 300×2 + 420 + 120×3 = **1,800s = 30분** |
| 로컬 (14개, `npm pack` 포함) | 위 + 900 = **2,700s = 45분** |

둘 다 단계 상한 15분을 넘는다. **그러므로 합계가 아니라 개별 deadline이
목적이다**: 어느 하나가 비정상적으로 길면 그 지점에서 명확한 오류로 죽고 로그가
범인을 지목한다. 15분 상한은 그대로 최종 안전망이며, CI 경로의 성공 실측 중앙값이
6:03이므로 정상 실행은 이 예산 근처에도 가지 않는다.

이 값들은 성공 실측의 넉넉한 배수이지 정밀한 예산이 아니다. `b2`의 로깅이 실제
분포를 보여준 뒤 조여야 한다.

이 값들은 성공 실측(중앙값 6:03, 최대 8:16)의 넉넉한 배수이지 정밀한 예산이
아니다. `b2`의 로깅이 실제 분포를 보여준 뒤 조여야 하며, 지금 정밀한 값을
주장하면 근거 없는 숫자가 된다.

### `spawnSync` timeout이 해결하지 못하는 것 (Windows)

`spawnSync`의 `timeout`은 **직접 자식**에게 신호를 보낼 뿐 프로세스 트리를 정리하지
않는다. `npm install --global`은 npm → node → 라이프사이클 스크립트로 이어지고
이 프로젝트는 `better-sqlite3`·`sharp` 같은 네이티브 의존성을 설치한다
(`scripts/package-global-update-smoke.mjs`가 npm 12에서
`--allow-scripts=ima2-gen,better-sqlite3,sharp`를 붙이는 이유다).

Windows에는 프로세스 그룹 신호가 없으므로 부모가 timeout으로 죽어도 **손자
프로세스가 살아남을 수 있다.** 그러면 다음 단계가 잠긴 파일이나 점유된 prefix를
만나 또 매달린다 — 증상만 옮겨간 것이다.

**초안의 처방은 작동하지 않는다(A phase 감사 blocker 1).** 초안은 timeout 뒤에
`taskkill /pid <pid> /T /F`를 부르자고 했다. 그런데 `spawnSync`는 timeout이 되면
**직접 자식을 먼저 죽이고 그 자식이 닫힐 때까지 반환하지 않는다.** 제어가 우리에게
돌아왔을 때 그 PID는 이미 사라져 있고, `/T`가 자손을 열거할 **뿌리가 없다.**
죽은 부모의 PID로 taskkill을 부르는 것은 아무것도 정리하지 못한다.

동기 실행으로는 이 문제를 풀 수 없다. 트리를 정리하려면 **timeout 시점에 뿌리가
살아 있어야** 하고, 그러려면 우리가 kill 시점을 통제해야 한다.

따라서 설계를 바꾼다.

1. **자손을 만드는 모든 자식**을 `spawnSync`가 아니라 **비동기 `spawn` + 자체
   타이머**로 실행한다. 출력은 모아서 기존과 같은 형태로 반환해 호출부 변경을
   최소화한다.
2. 타이머가 만료되면 **자식이 아직 살아 있는 상태에서** 정리한다.
   - Windows: `taskkill /pid <pid> /T /F`
   - POSIX: `detached: true`로 띄우고 `process.kill(-pid, "SIGKILL")`
3. 정리 후 뿌리와 자손이 실제로 사라졌는지 확인하고 결과를 로그에 남긴다. 정리
   실패도 진단 정보다.
4. 나머지만 `spawnSync` + `timeout`으로 둔다.

**정본 분기 — 기준은 소요 시간이 아니라 프로세스 트리다.**

| 실행 방식 | 대상 (총 14) |
|---|---|
| **async + 트리 소유** (8) | `npm install --global` ×3, `npm pack` ×1(로컬), `codex login status` ×1, `ima2 status` ×1, `ima2 doctor` ×1 |
| `spawnSync` + `timeout` (7 CI / 7 로컬) | `npm --version` ×3, `npm root --global` ×2, `ima2 --version` ×2 |

초안은 "장시간·네트워크"로 갈랐고, 그러면 `codex login status`·`ima2 status`·
`ima2 doctor`가 동기 쪽에 남는다. 이 셋은 Codex 하위 프로세스를 띄운다
(`bin/ima2.ts:274`의 `showStatus`와 `bin/commands/doctor.ts:208`이
`detectCodexAuth`를 부르고 그것이 `lib/codexDetect.ts:63`에서 자식을 실행한다).
짧다는 이유로 동기에 두면 **정확히 고치려던 고아 프로세스 결함이 그대로 남는다**
(A phase 3라운드 감사 blocker 2).

`b4`의 로컬 통과만으로는 이 설계를 증명하지 못한다. **문제는 Windows 고유이고,
macOS에서 프로세스 그룹 kill이 동작한다는 사실은 Windows 증거가 아니다.** 그래서
수용 기준에 Windows 실측을 넣는다(`b5`).

## IN / OUT

- IN: `scripts/package-global-update-smoke.mjs`, 신규
  `scripts/subprocess-deadline.mjs`, 신규 `tests/package-global-update-smoke-contract.test.ts`,
  신규 `tests/subprocess-deadline-contract.test.ts`,
  `.github/workflows/publish.yml`의 `windows-consumer` job에 테스트 실행 단계 추가.
- OUT: `scripts/npm-subprocess.mjs`(**변경 불필요** — 이미 timeout을 전달한다),
  `.github/workflows/publish.yml`의 `timeout-minutes` **값** 변경, 릴리스 워크플로
  입력 추가(`030` 소유), 스모크가 검사하는 **내용**의 변경.

## 수용 기준

- `b1`: **모든 14개 호출 지점**(CI 13 + 로컬 `npm pack` 1)이 `timeout`을 넘긴다.
  헬퍼가 아니라 호출부가 검사 대상이다. 계약 테스트는 `commandOptions()` 결과에
  `timeout`이 항상 존재하는지 확인한다.
- `b2`: 정상 실행 로그에 각 단계의 label과 소요 ms가 남는다. 성공한 실행에서도
  분포를 볼 수 있어야 다음 판단이 가능하다.
- `b3`: 하위 프로세스가 deadline을 넘기면 오류 메시지가 **label을 지목**한다.
  `ETIMEDOUT`만 남기면 지금과 다를 바 없다.
- `b4`: 로컬 macOS에서 `npm run test:package-global-update` 전체가 통과하고,
  로그의 단계별 소요 합이 실제 wall-clock과 일치한다. 이때 `npm pack` 경로도
  포함되므로 14개 자식 전부의 소요가 보인다.
- `b5`: **Windows 러너에서 자손 생존 음성 대조를 관측한다.** 손자를 만드는 자식을
  짧은 deadline으로 실행하고, 정리 후 그 손자 PID가 살아 있지 않음을 확인한다.
  직접 자식 PID만 확인하는 테스트는 이 기준을 만족하지 못한다 — 정확히 그 부분이
  Windows에서 깨지기 때문이다.

  이 검사는 **임시 단계가 아니라 영구 테스트**다
  (`tests/subprocess-deadline-contract.test.ts`). `windows-consumer` job에 실행
  단계를 추가하므로 `.github/workflows/publish.yml`은 이 phase의 스코프 **안**이다.
  임시 단계로 1회만 보고 지우면 다음 회귀를 아무도 잡지 못한다
  (2라운드 감사 blocker 4).

## 조건부 경로 활성화 시나리오 (C-ACTIVATION-GROUNDING-01)

timeout 분기는 정상 실행에서 **절대 발화하지 않는다.** 따라서 "테스트가 다
통과했다"는 이 phase의 증거가 될 수 없다. 강제로 터뜨려야 한다.

| 조건부 경로 | 트리거 방법 | 관측되는 효과 |
|---|---|---|
| 하위 프로세스 timeout | `IMA2_SMOKE_TIMEOUT_MS=1`로 실제 호출을 강제 초과 | 오류 메시지가 해당 label을 포함, 종료 코드 비0 |
| timeout 후 프로세스 트리 정리 | **손자를 만드는** 자식을 짧은 deadline으로 실행 (부모가 `node -e "spawn(...)"`으로 매달리는 손자를 띄운다) | 정리 후 **손자** PID가 살아 있지 않음. 직접 자식만 확인하면 이 경로를 검증한 것이 아니다 |
| 비동기 kill 경로의 뿌리 생존 | 타이머 만료 시점에 자식 PID가 아직 살아 있는지 로그로 확인 | 살아 있어야 `/T` 열거가 성립한다. 죽어 있으면 설계가 초안으로 되돌아간 것 |
| 단계별 로깅 | 정상 실행 | stdout에 `[smoke] baseline-install done 41234ms` 형태 라인이 단계 수만큼 |
| 호출부의 timeout 지정 | `commandOptions()` 반환값을 직접 검사 | 모든 호출에 `timeout`이 존재 |

마지막 행에 **fake `spawnSync` 주입을 쓰지 않는다.** `scripts/npm-subprocess.mjs`는
`node:child_process`를 정적 import하므로 주입 seam이 없다(2라운드 감사 지적).
헬퍼의 전달 동작은 이미 실측으로 확인했으므로, 검사할 것은 **호출부가 값을
주는지**뿐이고 그것은 `commandOptions()` 반환값으로 직접 볼 수 있다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `node --test tests/package-global-update-smoke-contract.test.ts` | 신규 계약 (timeout 전달, label 오류) | 파일 미존재 (B에서 생성) |
| `npm run test:package-global-update` | 스모크 전체 경로 | 로컬 미실행 — 전역 설치 3회 수행하므로 B에서 격리 실행 |
| `npm run typecheck` | 스크립트는 `tsconfig.json`의 `exclude`에 `scripts`가 있어 **관측하지 못한다** | — |

마지막 행을 명시한다. `./tsconfig.json`의 `exclude`에 `scripts`가 들어 있으므로
`npm run typecheck`는 이 phase가 바꾸는 파일을 **하나도 보지 않는다**. 이 phase의
타입 안전성은 게이트가 아니라 계약 테스트와 리뷰가 담당한다. 이것을 적지 않으면
typecheck 초록을 이 변경의 보증으로 착각하게 된다.

## 이 phase가 증명하지 못하는 것

계측을 붙여도 **run `31605449399`의 원인은 소급 규명되지 않는다.** 그 로그는 이미
지나갔고 어느 자식이 매달렸는지 기록이 없다. 이 phase의 산출물은 "다음에 같은 일이
생기면 범인을 안다"이지 "이번 stall을 고쳤다"가 아니다.

stall이 우리 하위 프로세스가 아니라 러너나 레지스트리 쪽이었다면 deadline은 원인
제거가 아니라 **빠른 실패와 정확한 지목**만 제공한다. 그것도 충분한 가치지만,
과장하지 않는다.
