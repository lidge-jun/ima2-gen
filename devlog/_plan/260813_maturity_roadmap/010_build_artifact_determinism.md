---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, release, drift]
---

# 010 — 빌드 산출물 결정성

- work-phase: WP3 첫 문서
- 소비하는 선행 산출물: `002` 주장 원장, `003` 크기/drift 실측, `004` 실패 로그
- 소비되는 곳: `020` 릴리스 컷 결정성

## 왜 이것이 첫 번째인가

실패한 release run `31604716464`이 근거다. 컷은 코드 오류가 아니라 **검증 단계가
추적 파일을 다시 써서** 멈췄다.

```
[release-cut] release verification changed tracked output; commit generated artifacts and retry:
 M ui/tsconfig.node.tsbuildinfo
```

`scripts/release-cut.mjs:142`의 `assertClean()`은 `git status --porcelain`이 비어
있기를 요구한다. 빌드가 커밋된 산출물을 재생성하면 **승격하려는 커밋이 검증한
것과 달라지므로** 이 가드는 옳다. 문제는 가드가 아니라 추적되는 생성물이 있다는
사실이다.

즉 릴리스 결정성은 drift 제거를 **소비한다**. 순서가 반대일 수 없다.

## 파일 변경 맵

### A. tsbuildinfo — 이미 제거됨, 재발 방지만 확인

| 경로 | 동작 | 현재 상태 |
|---|---|---|
| `./.gitignore` 14–15행 | 변경 없음 | 두 tsbuildinfo 이미 등재 |
| `tests/release-pipeline-contract.test.ts:309` | 변경 없음 | 추적된 `.tsbuildinfo` 발견 시 실패하는 회귀 테스트 존재 |

**이 절의 작업량은 0이다.** `ac1cace`가 이미 해결했다. 남은 것은 검증뿐이며 그것은
`020`의 dry-run이 담당한다. 여기 적어 두는 이유는 "고쳤다"와 "고쳐진 것을 봤다"를
구분하기 위해서다(C-15).

### B. 추적된 18쌍 `.js`/`.ts`

| 경로 | 동작 |
|---|---|
| `bin/ima2.js`, `bin/commands/capabilities.js`, `bin/commands/grok.js`, `bin/commands/prompt-sub/build.js` | 추적 해제 |
| `config.js` | 추적 해제 |
| `lib/capabilities.js`, `lib/imageModels.js`, `lib/generationRequestLog.js`, `lib/grokProxyLauncher.js`, `lib/grokVideoAdapter.js`, `lib/grokVideoCanvas.js`, `lib/grokVideoDownload.js`, `lib/grokVideoPlannerPrompt.js`, `lib/oauthLauncher.js` | 추적 해제 |
| `routes/generate.js`, `routes/generationRequestLog.js`, `routes/index.js`, `routes/quota.js` | 추적 해제 |
| `./.gitignore` | 위 패턴 추가 |
| `./package.json` `files` 배열 | **변경 없음** — 아래 위험 참조 |
| `tests/release-pipeline-contract.test.ts` | 추적된 `.ts`-paired `.js` 0건을 강제하는 케이스 추가 |

`server.js`는 이미 추적되지 않는다(`git ls-files server.ts server.js` → `server.ts`
만 반환). 즉 **이 패턴은 이미 부분적으로 적용돼 있다**. 18쌍은 남은 잔여다.

**위험 (반드시 먼저 확인).** `package.json`의 `files`는 `bin/**/*.js`,
`lib/**/*.js`, `routes/**/*.js`, `server.js`, `config.js`를 포함한다. 이 파일들은
npm tarball의 **실제 런타임**이다. 추적 해제해도 `prepack`
(`npm run ui:build && npm run build:server && npm run build:cli`)이 생성하므로
패키지에는 남아야 한다. 추적 해제와 패키지 누락을 혼동하면 **설치는 되지만 실행이
안 되는 릴리스**가 나간다.

이미 추적 해제된 `server.js`가 정상 발행되고 있다는 사실이 이 경로가 작동한다는
선례다. 그래도 순서를 고정한다.

1. `npm run test:package-install`이 tarball의 `bin/ima2.js`를 실제로 실행하는지
   확인한다. **확인했다**: `tests/package-install-smoke.mjs:138`이
   `node_modules/ima2-gen/bin/ima2.js`를 `cliPath`로 잡아 실행한다. 따라서 이
   보호막은 이미 존재하며 새로 만들 필요가 없다.
2. 그 다음 추적 해제한다.
3. `npm pack` 산출물에 18개 파일이 모두 있는지 확인한다.

### C. devlog 백업 tarball 126MB

| 경로 | 바이트 | 동작 |
|---|---:|---|
| `devlog/_fin/260714_git-index-fix/artifacts/wt7174-untracked.tar.gz` | 94,146,560 | 삭제 |
| `devlog/_fin/260714_git-index-fix/artifacts/gitdir-foreign-files.tar.gz` | 32,103,190 | 삭제 |
| `devlog/_fin/260714_git-index-fix/artifacts/README.md` | 신규 | 무엇이 있었고 왜 지웠는지 기록 |
| `devlog/_fin/260714_git-index-fix/010_cleanup-plan.md` 32행 | 편집 | 죽은 링크를 README로 돌린다 |
| `devlog/_fin/260714_git-index-fix/020_cleanup-record.md` 11행 | 편집 | 같은 이유 |
| `devlog/_plan/260813_maturity_roadmap/003_architecture_inventory.md` | 편집 | 이 로드맵 자신도 두 파일을 가리킨다 |

**"아무도 참조하지 않는다"는 초안의 전제는 거짓이었다(A phase 감사 blocker 5).**
종결된 사고 기록 두 곳이 이 아카이브를 복구 증거로 지목한다.

```
devlog/_fin/260714_git-index-fix/010_cleanup-plan.md:32
devlog/_fin/260714_git-index-fix/020_cleanup-record.md:11
```

처음 확인할 때 `rg`가 0건을 반환해서 참조가 없다고 적었다. `devlog/`가 gitignore
대상이라 기본 `rg`가 통째로 건너뛴 것이다 — `--no-ignore`를 붙이면 나온다.
**이 유닛에서 같은 함정에 두 번 걸렸다**(WP1의 `c2-a` 기준도 같은 이유로
고쳤다). 이 저장소에서 devlog를 검색할 때는 `--no-ignore`가 기본이어야 한다.

그래서 삭제만으로 끝내지 않는다. 두 기록을 고쳐 **payload 복구가 의도적으로
종료됐다**고 명시하고, 남는 `.patch`·`.txt` 증거를 가리킨다. 죽은 링크를 남기는
것은 아카이브를 지우는 것보다 나쁘다.

2026-07-14 git index 사고 때 만든 백업이다. 그 사고는 종결됐고 같은 디렉터리의
`.patch`·`.txt` 증거 파일들이 남아 서사를 보존한다. 다만 정확히 말하면 그 파일들이
tarball을 **대체하지는 않는다**: 미추적 파일 payload와 foreign gitdir 스냅샷 자체는
사라진다. 그래서 삭제 전에 그 파일들이 현재 소스나 히스토리에 존재함을 확인하고,
확인 결과를 README에 적는다.

**히스토리 재작성은 하지 않는다.** `git filter-repo`로 과거 커밋에서 지우면 clone
크기가 실제로 줄지만 모든 SHA가 바뀌고, `main`/`dev`/`preview`가 한 SHA여야 하는
릴리스 계약과 이미 발행된 npm `gitHead`가 전부 깨진다. HEAD에서 삭제하면 향후
체크아웃 작업 트리는 126MB 가벼워지고 clone은 그대로다. 그 절충을 명시적으로
선택한다.

## IN / OUT

- IN: `./.gitignore`, 18개 `.js` 추적 해제, devlog tarball 2개 삭제,
  `tests/release-pipeline-contract.test.ts` 케이스 추가.
- OUT: `package.json`의 `files` 배열 수정, `.ts` 소스 내용 변경, 149개 `.js`
  테스트를 `.ts`로 이전(별개 과제), 히스토리 재작성, workflow 파일 수정(`020` 소유).

## 수용 기준

- `a1`: `git ls-files '*.js'`에서 `ui/`·`vendor/` 제외 후 같은 이름 `.ts`가 함께
  추적되는 파일이 **0건**이다.

  ```
  for f in $(git ls-files '*.js' | grep -vE '^(ui/|vendor/|node_modules)'); do
    git ls-files --error-unmatch "${f%.js}.ts" >/dev/null 2>&1 && echo "$f"
  done | wc -l          # 현재 18 → 목표 0
  ```

- `a2`: `npm pack` 후 tarball에 18개 런타임 `.js`가 **전부 존재**한다. 추적
  해제가 패키지 누락으로 번지지 않았음을 확인한다.
- `a3`: 패키지된 tarball에서 전역 설치한 `ima2 --version`이 성공한다. `a2`가
  파일 존재만 보므로 실행 가능성은 따로 본다.
- `a4`: `git cat-file -s`로 확인한 두 tarball blob이 HEAD에서 사라지고,
  작업 트리 `devlog/` 크기가 약 228MB → 약 102MB로 줄어든다.
- `a4b`: 삭제 후, **`devlog/_fin/260714_git-index-fix/` 안에서** 두 파일명을
  언급하는 모든 줄이 "보관 종료" 설명이거나 README를 가리킨다. 존재하지 않는
  파일을 살아 있는 복구 경로처럼 가리키는 줄이 0건이다.

  ```
  rg -n --no-ignore 'wt7174-untracked|gitdir-foreign-files' \
     devlog/_fin/260714_git-index-fix/
  ```

  검사 범위를 그 사고 유닛으로 **한정한다**(2라운드 감사 blocker 5). 저장소 전역
  0건은 달성 불가능한 기준이다: 이 로드맵의 `003`과 `010` 자신이 삭제 대상으로
  두 파일명을 적고 있고, 그것은 죽은 링크가 아니라 **삭제 기록**이다. 기준을
  "전역 0건"으로 두면 영원히 빨갛거나, 통과시키려고 자기 문서에서 근거를 지우게
  된다.

  `--no-ignore`는 여전히 필수다. `devlog/`가 gitignore 대상이라 기본 `rg`는 이
  디렉터리를 통째로 건너뛰고 **무조건 통과**한다.
- `a5`: 새 회귀 테스트가 **패치 전 트리에서 실패하고 패치 후 통과한다**. 음성
  대조 없이 통과만 확인하면 그 테스트가 무엇이든 잡는지 알 수 없다.

## 조건부 경로 활성화 시나리오

이 phase가 추가하는 조건부 경로는 회귀 테스트의 실패 분기 하나다.

| 조건부 경로 | 활성화 방법 | 관측되는 효과 |
|---|---|---|
| "`.ts` 짝이 있는 `.js`가 추적되면 실패" | 임시로 `lib/capabilities.js`를 `git add -f` 한 뒤 테스트 실행 | 테스트가 그 경로명을 지목하며 실패. 되돌린 뒤 통과 |
| `assertClean()`의 dirty 분기 | 이 phase에서는 트리거하지 않는다 | `020`이 dry-run으로 관측 |

두 번째 행이 중요하다. `assertClean`의 실패 분기는 **이미 한 번 실전에서
발화했고**(run `31604716464`) 그 로그가 증거다. 이 phase에서 다시 인위적으로
터뜨릴 필요는 없다. 필요한 것은 **성공 분기의 관측**이며 그것은 `020`이 한다.

## verifier

| 명령 | 무엇을 관측하나 | 실행 여부 |
|---|---|---|
| 위 `a1` 페어링 루프 | 변경 대상을 직접 관측 (추적 목록) | **실행함**, 현재 18 |
| `npm run test:inventory` | 테스트 파일 분류. 149개 `.js` 테스트가 등록 상태인지 | 미실행 (B에서) |
| `npm run lint:pkg` | `package.json` `files`의 필수 항목 존재 | 미실행 (B에서) |
| `npm run test:package-install` | tarball 설치 스모크 | 미실행 (B에서) |
| `npm test` | 전체 회귀 | `d2fe420`에서 2118/2116 pass, exit 0 |

**`npm run lint:pkg`는 이 변경을 관측하지 못한다.** 그것은 `files` 배열에 특정
glob이 **들어 있는지**만 검사하고 tarball의 실제 내용은 보지 않는다
(`package.json`의 `lint:pkg` 정의를 읽어 확인했다). 따라서 `a2`의 검증자는
`lint:pkg`가 아니라 `npm pack` 산출물을 직접 여는 것이어야 한다. 이 구분을 적지
않으면 존재하지 않는 게이트를 믿게 된다.
