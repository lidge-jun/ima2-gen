---
created: 2026-08-13
updated: 2026-08-14
stale-checked: 2026-08-14
tags: [ima2-gen, devlog, phase, governance, supply-chain]
---

# 090 — 거버넌스와 공급망

- work-phase: WP6
- 소비: **공급망 절만** `030`의 발행 경로. 거버넌스 문서는 아무것도 소비하지 않는다
- 소비되는 곳: 없음

## 두 부분은 성격이 다르다

한 문서에 있지만 의존도 성격도 다르다. 섞어서 읽지 않도록 먼저 가른다.

| 부분 | 소비 | 성격 |
|---|---|---|
| 거버넌스 문서 | 없음 | 지금 당장 가능. 파일 추가 |
| 공급망 강화 | `030` 발행 경로 | 릴리스가 초록이 된 뒤 |

## 이미 있는 것을 다시 만들지 않는다

평가서 Phase 4의 공급망 목록에서 **이미 있는 것을 뺀다**(`002` C-13).

| 평가서 제안 | 상태 |
|---|---|
| npm provenance | **있음** — `.github/workflows/publish.yml:231`의 `--provenance` |
| npm registry attestation 검증 | **있음** — `scripts/release-contract.mjs:202`가 npm 레지스트리 attestation을 받아 SLSA predicate·workflow 경로·소스 ref·커밋·SHA-512 subject·빌더 신원·실행 id를 검증한다. **이것은 npm provenance이지 GitHub artifact attestation이 아니다** |
| **GitHub artifact attestation** | 없음 — `actions/attest-build-provenance` 미사용. 해당 SHA의 GitHub attestation 조회는 404 |
| SBOM | **있음** — `.github/workflows/publish.yml:107` |
| Actions SHA 고정 | **부분** — 대부분 40자 SHA로 고정됐지만 `.github/workflows/nix.yml:18`의 `cachix/install-nix-action@v30`은 태그다 |
| audit gate | **있음** — 만료되는 advisory 예외 포함 |
| **CodeQL** | 없음 |
| **Dependabot / Renovate** | 없음 — `gh api`로 확인 시 `dependabot_security_updates`가 `disabled` |
| **비공개 취약점 신고 경로** | 없음 (`SECURITY.md` 부재) |
| secret scanning | **있음** — 저장소 설정에서 이미 활성. push protection도 켜져 있다 |
| **서명된 릴리스 매니페스트** | 부분 — provenance는 있으나 매니페스트 자체 서명은 없음 |
| **lockfile 변경 감시** | 없음 |
| vulnerability alerts | **꺼져 있음** — Dependabot 보안 동작의 전제 |
| LTS 릴리스 브랜치 | 보류 — 아래 참조 |

**실제로 없는 것은 7개다**(GitHub artifact attestation과 nix 액션 고정이 추가됐다). 평가서 목록을 그대로 실행했다면 이미 있는 3개를 다시
만들었을 것이다.

## 거버넌스 파일

`.github/`에는 지금 `workflows/`만 있다(`002` C-06).

| 경로 | 내용 |
|---|---|
| `SECURITY.md` | 지원 버전, 비공개 신고 경로(GitHub Security Advisory), 응답 목표 |
| `CONTRIBUTING.md` | 개발 환경, `npm run verify:release:source`, devlog 규약, PR 기대치 |
| `CODEOWNERS` | 현재는 소유자 1명. 그래도 둔다 — 리뷰 라우팅이 아니라 **경계 표시**가 목적 |
| `.github/ISSUE_TEMPLATE/bug.yml` | `ima2 doctor` 출력 요구(`070`의 진단 번들과 연결) |
| `.github/ISSUE_TEMPLATE/feature.yml` | |
| `.github/pull_request_template.md` | 검증 명령 체크리스트 |

`CONTRIBUTING.md`는 **단계별 검증**을 안내한다. `verify:release:source`를 첫
지시로 주지 않는다 — 그것은 11개 명령을 연쇄한다.

```
test:native-deps → typecheck → typecheck:tests → test:inventory → ui:build
→ build:server → build:cli → test → lint:pkg → test:install-policy → audit:gate
```

네이티브 의존성(`better-sqlite3`, `sharp`) 로드, UI 빌드, 2118개 테스트, 네트워크가
필요한 audit까지 포함한다. 처음 기여하는 사람에게 이걸 먼저 시키면 자기 변경과
무관한 곳에서 막힌다.

| 단계 | 명령 | 언제 |
|---|---|---|
| 1 | `npm run typecheck` | 항상. 빠르다 |
| 2 | `npm test` | 항상 |
| 3 | `cd ui && npm run build` | UI를 건드렸을 때 |
| 4 | `npm run verify:release:source` | PR 올리기 전 **선택**. 시간이 든다 |

전체 게이트는 CI가 어차피 돌린다. 로컬 전체 실행은 권장이지 요구가 아니다.

### 이 파일들이 하지 못하는 것

평가서의 70점 조건 8개 중 4개(메인테이너 3명, 커밋 점유율 80% 미만, 외부 기여
25%, 이슈 응답 48시간)는 **이 문서들로 달성되지 않는다**(`001`). 문서는 외부
기여를 **가능하게** 만들 뿐 발생시키지 않는다. 이 phase의 완료가 거버넌스 점수
상승을 뜻하지 않는다는 점을 명시한다.

## 공급망 5건

| 항목 | 작업 |
|---|---|
| CodeQL | `.github/workflows/codeql.yml`. JS/TS. PR과 주간 스케줄 |
| Dependabot | `.github/dependabot.yml`. npm + github-actions. 그룹화해 PR 폭증 방지 |
| 비공개 신고 | `SECURITY.md` + 저장소 설정에서 Security Advisory 활성화 |
| 서명된 매니페스트 | `030`의 발행 경로가 초록이 된 뒤. provenance와 중복되지 않는 범위만 |
| lockfile 감시 | `package-lock.json`/`ui/package-lock.json` 변경 시 리뷰 필수화 (CODEOWNERS 또는 라벨) |

**LTS 릴리스 브랜치는 보류한다.** 메인테이너가 1명인 상태에서 브랜치를 늘리면
백포트 부담만 커진다. 평가서도 메인테이너 분산을 선행 조건으로 든다.

## IN / OUT

- IN: `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`,
  `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`,
  `.github/workflows/codeql.yml`, `.github/dependabot.yml`,
  `.github/workflows/nix.yml`의 액션 SHA 고정, lockfile CODEOWNERS 감시,
  GitHub artifact attestation 보강(publish.yml package job, 이미 있는 npm
  provenance와 겹치지 않는 경로만).
- OUT: LTS 브랜치, 메인테이너 추가, npm provenance/SBOM 재구현,
  **저장소 설정 변경**(Security Advisory / vulnerability alerts / default
  setup). 이슈 #132가 설정 변경을 승인 경계로 고정한다.

`j5`는 이 사이클에서 **문서화 + 현재 설정 스냅샷**으로만 닫는다. Advisory를
여기서 켜지 않는다. 켜는 순간은 별도 승인이다.

## 파일 변경 맵 (2026-08-14 stale check)

기준: origin/dev `8449e79d`. `.github/`에는 `workflows/`만 있다.

| 경로 | 동작 |
|---|---|
| `SECURITY.md` | NEW. 지원 버전 = published npm latest. 신고는 GitHub Security Advisory. 응답 목표는 "best effort, no SLA" — 1인 메인테이너가 48시간을 약속하지 않는다. |
| `CONTRIBUTING.md` | NEW. 1 `npm run typecheck` / 2 `npm test` / 3 `cd ui && npm run build`(UI만) / 4 `verify:release:source`는 선택. 문서가 4단계를 필수로 적으면 FAIL. |
| `.github/CODEOWNERS` | NEW. `* @lidge-jun`. lockfile 두 줄도 같은 소유자. 리뷰 강제 여부는 저장소 ruleset 승인 전엔 문서 표시만. |
| `.github/ISSUE_TEMPLATE/bug.yml` | NEW. `ima2 doctor --bundle` / `ima2 doctor image-probe --json` 필드. 둘 다 이미 CLI에 있다. 비밀·쿠키·토큰 첨부 금지 문구. |
| `.github/ISSUE_TEMPLATE/feature.yml` | NEW. 한 화면/한 계약. |
| `.github/ISSUE_TEMPLATE/config.yml` | NEW. blank issues 유지. |
| `.github/pull_request_template.md` | NEW. typecheck / test / UI build 체크. publish·dist-tag·dispatch는 체크하지 않음. |
| `.github/workflows/codeql.yml` | NEW. JS/TS only, build-mode none. checkout는 기존 `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5` (v4). CodeQL은 `github/codeql-action/{init,analyze}@ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd` (v4.37.7, 2026-08-13). permissions: contents read + security-events write. |
| `.github/dependabot.yml` | NEW. npm (root + /ui) + github-actions. weekly. groups: production-npm / development-npm / github-actions. open-pull-requests-limit 5. |
| `.github/workflows/nix.yml` | MODIFY 1줄. `cachix/install-nix-action@v30` → `cachix/install-nix-action@08dcb3a5e62fa31e2da3d490afc4176ef55ecd72` # v30. |
| `.github/workflows/publish.yml` | MODIFY. **package job이 아니라 create-github-release job**. package job은 `Prove package job has no OIDC token`과 `id-token: write` 1회 계약을 깨면 안 된다. attestation은 GitHub Release 업로드 직후, subject = 이미 검증된 tarball+manifest+sbom. `actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8` (v4.2.2). npm `--provenance`는 publish job에 그대로 둔다. |
| `tests/governance-files-contract.test.ts` | NEW. 위 파일 존재 + CODEOWNERS 소유자 + nix SHA + dependabot groups + CONTRIBUTING 1-3단계 명령이 package.json scripts에 실재. |

서명된 매니페스트: 새 포맷을 만들지 않는다. 이미 `release-manifest.json` + npm
provenance가 있다. 이번 사이클은 그 아티팩트에 GitHub attestation을 얹는 것
뿐이다. publish job의 `id-token: write` 1회 계약은 유지한다. package job에는
OIDC를 주지 않는다. create-github-release job에 `id-token: write` +
`attestations: write`를 추가하고, 계약 테스트의 "only publish job may mint
OIDC tokens" 단언을 "publish.yml may mint OIDC only in publish and
create-github-release jobs"로 갱신한다.

## 수용 기준

- `j1`: 6개 거버넌스 파일이 존재하고 GitHub UI가 인식한다(이슈 템플릿이 선택지로
  뜨고, PR 템플릿이 자동 채워진다).
- `j2`: CodeQL 워크플로가 트리에 있고 SHA-pinned다. 첫 실행 결과는 숨기지 않고
  이슈 #132에 기록한다. 기존 발견이 있어도 이 사이클에서 지우지 않는다.
- `j3`: Dependabot 설정이 groups + open-pull-requests-limit 5를 가진다. 실제
  주간 PR 수는 설정 활성화 후에만 관측된다.
- `j4`: `CONTRIBUTING.md`의 **1~3단계 명령이 실제로 동작한다.** 4단계 전체
  게이트는 선택으로 표시했으므로 문서가 그것을 요구처럼 적지 않았는지도 함께
  확인한다.
- `j5`: `SECURITY.md`가 Advisory 경로를 가리키고, 현재 저장소 설정 스냅샷을
  이슈에 남긴다. Advisory/vulnerability alerts는 승인 전에는 켜지 않는다.
  2026-08-14 스냅샷: secret_scanning=enabled, push_protection=enabled,
  dependabot_security_updates=disabled.

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| CodeQL 경보 | 의도적 취약 패턴을 PR에 넣음 | PR에 경보. 되돌리면 사라진다 |
| Dependabot 그룹화 | 여러 의존성 동시 갱신 | PR 1건으로 묶임 |
| lockfile 감시 | lockfile만 바꾸는 PR | 리뷰 요구가 발동 |
| 이슈 템플릿 | 새 이슈 작성 | doctor 출력 필드가 필수로 표시 |

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `actionlint .github/workflows/codeql.yml` | 워크플로 문법 | 파일 미존재 (B에서) |
| `npm run verify:release:source` | `j4`의 안내가 실제로 동작하는지 | 미실행 — 전체 게이트라 시간이 든다. B에서 1회 |
| GitHub UI 확인 | 템플릿·Advisory 활성화 | **자동 게이트 없음.** 사람이 본다 |

거버넌스 파일 대부분은 **자동으로 검증되지 않는다.** `j1`과 `j5`는 GitHub UI를
눈으로 확인해야 하고, 그 사실을 적어 두는 것이 "체크리스트를 다 채웠으니
됐다"는 착각을 막는다.

## 사용자 결정이 필요한 지점

1. **Security Advisory(비공개 신고) 활성화** — 저장소 설정. 관리자 권한.
   secret scanning과 push protection은 **이미 켜져 있다**(`gh api` 확인).
   **이 사이클에서 켜지 않는다.**
2. **CodeQL 활성화** — Actions 사용량이 늘어난다. 워크플로 파일은 커밋한다.
   default setup 토글은 승인 대상이다.
3. **`CODEOWNERS`에 누구를 넣을지** — 현재 사실상 1명. 이름을 적는 것 자체가
   소유자 결정이다. 이 사이클은 `@lidge-jun`만 적는다.
4. **취약점 신고 응답 목표 시간** — 지킬 수 있는 값을 소유자가 정해야 한다.
   지키지 못할 약속을 문서에 적으면 없느니만 못하다. 이 사이클은 SLA를 적지 않는다.
