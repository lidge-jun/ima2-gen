# 030 — PR #118 직접 수정 로드맵

대응 work-phase: `wp3`(이 문서) → `wp4` → `wp5` → `wp6`
goalplan: `ima2-gen-pr-118-minimax-provider-blocker-ci-dev`

## 결정 사항

기여자에게 변경 요청을 되돌리는 대신 **우리가 PR 브랜치를 직접 이어받아 완성한다.**
사용자가 CI 실행, 푸시, 머지, 배포를 모두 승인했다.

## CI 실증 (승인 후 실제 실행)

워크플로 run `30551464222`를 승인해 실행했다. 결과는 **전 매트릭스 실패**다.

```
test (ubuntu-latest,  node 22.23.0, npm 11.18.0)  failure
test (windows-latest, node 22.23.0, npm 11.18.0)  failure
test (ubuntu-latest,  node 24.17.0, npm 12.0.0)   failure
test (windows-latest, node 24.17.0, npm 12.0.0)   failure
```

실패 스텝은 전부 첫 번째 `Structure line-count drift (fast fail)`:

```
structure/01 line-count drift (11 files):
  server.ts: doc=545 actual=567
  config.ts: doc=388 actual=398
  routes/edit.ts: doc=433 actual=448
  lib/generatePipeline.ts: doc=619 actual=638
  ... (11개)
##[error]Process completed with exit code 1.
```

즉 F6이 fast-fail이라 나머지 게이트는 **실행조차 되지 않았다.** 021의 로컬 실측
(`npm test` 2052건 중 1 실패 = 같은 계약)과 일치한다. CI는 이 PR을 검증한 적이 없다.

## 통합 전략

### 기준 브랜치는 로컬 dev가 아니라 `origin/dev` (A-phase blocker 2 반영)

로컬 `dev`를 기준으로 삼으면 안 된다. 실측:

```
$ git rev-list --left-right --count HEAD...origin/dev
2	2                      # 서로 갈라져 있음. 어느 쪽도 상대의 ancestor가 아님

$ node -p "require('./package.json').version"
3.0.3                      # 로컬

$ git show origin/dev:package.json | rg version
"version": "3.0.4"         # 원격
```

로컬 dev 위에서 브랜치를 만들면 **v3.0.4를 v3.0.3으로 되돌리는 diff**가 섞인다.
`scripts/release.sh:93`은 이미 공개된 버전이면 릴리스를 중단시키므로 배포까지 깨진다.

또 `origin/pr-118`의 실제 merge-base는 `b9e8737`이지 `f06db10`이 아니다.
`git merge-tree b9e8737 HEAD origin/pr-118`은 `docs/migration/runtime-test-inventory.md`
에서 충돌을 낸다. 다만 그 파일은 `node scripts/classify-tests.mjs` 생성물이므로
수동 병합 대상이 아니라 **모든 테스트 추가가 끝난 뒤 재생성**하면 된다.

### 절차

```bash
git fetch origin
git rev-parse origin/dev            # 기준 sha 고정
git switch -c codex/minimax-provider-repair origin/dev
git cherry-pick 9f3ca4a             # 이슈 #119 수정
git cherry-pick 521ff853            # 기여자의 MiniMax provider 커밋
# inventory 충돌 시: node scripts/classify-tests.mjs 로 재생성 후 계속
```

그 위에 우리 수정 커밋을 쌓는다. 이렇게 하면:

- 기여자 커밋(`521ff853`)의 저작자 정보가 히스토리에 보존된다.
- 우리 수정이 별도 커밋으로 분리돼 무엇을 고쳤는지 리뷰 가능하다.
- 버전 회귀 없이 이슈 #119 수정과 MiniMax provider가 함께 올라간다.

로컬 `dev` 브랜치 자체는 건드리지 않는다. 사용자의 브랜치 상태를 바꾸지 않는다.

## work-phase 맵 (의존 순서)

빌드 순서는 "데이터/계약 계층 → 사용자 표면 → 게이트/배포"다. WP5의 UI 등록은
WP4가 확정한 모델 목록과 provenance 계약을 소비하므로 WP4가 먼저다.

| WP | 문서 | 대상 | 독립 검증 |
|----|------|------|-----------|
| WP3 | 이 문서 + `031` + `032` | 로드맵 (코드 변경 없음) | 문서 존재 + 코드 변경 0 |
| WP4 | `031_adapter_server_repair.md` | 어댑터/서버 결함 F2 F3 F4 F5 F8 F9 + 계약 테스트 | 각 분기 활성화 테스트 |
| WP5 | `032_web_ui_registration.md` | Web UI 등록 F1 + F9 오류 코드 + CLI edit allowlist | 실브라우저 관측 |
| WP6 | 이 문서 §게이트/배포 | F6 갱신, 전체 게이트, CI, 푸시/머지/배포 | CI success + 원격 상태 |

## WP6 게이트/배포 계획

### 로컬 게이트 (CI 순서 그대로)

```
node scripts/refresh-structure-line-counts.mjs --check
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm run build:server
npm run build:cli
npm --prefix ui run build
npm test
npm run lint:pkg
node scripts/audit-gate.mjs --audit-level high --omit dev
node scripts/audit-gate.mjs --prefix ui --audit-level high
```

F6은 `npm run docs:refresh-line-counts`로 갱신한다. 수동 편집하지 않는다.
구조 문서는 **모든 코드 변경이 끝난 뒤 마지막에** 갱신한다. 중간에 갱신하면
이후 수정으로 다시 drift가 난다.

### 푸시 → CI → 머지

`ci.yml:6-10`의 트리거는 `push: [main, dev]` + `pull_request: [main, dev]`다.
feature 브랜치 push만으로는 CI가 돌지 않는다. 따라서 **dev를 대상으로 하는 PR을
열어 pull_request CI를 태운다.** 머지 전 검증이 목적이므로 이 경로로 확정한다.

1. 작업 브랜치를 origin에 푸시한다.
2. `gh pr create --base dev`로 PR을 연다.
3. CI success를 확인한다. 우리는 첫 기여자가 아니므로 승인 대기가 없어야 한다.
4. CI success 후 dev로 머지한다.
5. PR #118 처리: 우리 브랜치에 기여자 커밋이 cherry-pick으로 포함되므로 GitHub가
   자동으로 merged 처리하지 않는다. 반영 커밋을 명시하며 수동으로 닫는다.

### 배포

실제 릴리스 경로(감사에서 확인):

- `scripts/release.sh`는 clean `main`에서만 돌고, main이 `origin/dev`와 `origin/preview`
  를 포함해야 한다(`:21`, `:76-85`).
- 버전이 이미 npm에 공개돼 있으면 중단한다(`:93`).
- preview push가 검증 publish를, tag push가 stable npm publish를 트리거한다
  (`scripts/release-preview.sh:18`, `.github/workflows/publish.yml:3`).

**버전 수준은 patch가 기본이다.** 초안의 "minor" 판단은 이 저장소 관례와 어긋난다:
`release.sh:89`의 기본 인자가 `patch`이고, Atlas·Gemini provider 추가도 각각 patch
릴리스에 실렸다. 따라서 3.0.5 patch로 간다. minor로 올리는 것은 별도 제품 판단이므로
임의로 결정하지 않는다.

배포는 dev 머지가 끝난 뒤 main 동기화 상태를 확인하고 진행한다. main이 조건을
만족하지 않으면 그 사실과 필요한 선행 작업을 보고한다.

## 수용 기준

- `g-docs`: 이 유닛에 `030`/`031`/`032`가 존재하고 WP3 종료 시 코드 변경 0.
- `g-adapter`: F2/F3/F4/F5/F8/F9 각각이 해당 분기를 실제 발화시키는 테스트로 증명된다.
  F2는 판정 순수 함수뿐 아니라 실제 Express route가 GET을 쓰고 실패 시 config를
  저장하지 않는 배선까지 확인한다(키 저장은 C4 경계다).
- `g-ui`: 실행 중인 웹 UI에서 minimax provider/모델 선택과 키 입력이 관측된다.
- `g-gates`: 위 로컬 게이트 전부 exit 0.
- `g-ci`: GitHub CI가 대상 HEAD에 대해 success.
- `g-merge`: dev에 반영되고 원격에 푸시됨.
- `g-deploy`: 배포 완료 또는 결정 필요 사유 보고.

## 리스크

- 기여자 커밋을 cherry-pick하면 PR #118은 GitHub가 자동으로 "merged"로 인식하지
  않는다. 수동으로 닫고 반영 커밋을 명시해야 한다.
- MiniMax 실 API 키가 없어 실제 생성 경로는 검증할 수 없다. 어댑터 수정은 요청
  조립/응답 파싱/에러 매핑 단위 테스트로 검증하고, 그 한계를 명시한다.
- 로컬 `dev`는 원격과 갈라진 채로 남는다(v3.0.3). 이 루프의 스코프가 아니므로
  건드리지 않고, 최종 보고에 상태를 알린다.
