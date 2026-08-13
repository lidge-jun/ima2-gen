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
| `./.gitignore` 29행 | `/bin/commands/*.js` → `/bin/commands/**/*.js` (아래 참조) |
| `./package.json` `files` 배열 | **변경 없음** — 아래 위험 참조 |
| `tests/release-pipeline-contract.test.ts` | 추적된 `.ts`-paired `.js` 0건을 강제하는 케이스 추가 |
| `scripts/paired-generated-paths.txt` | 신규 — 18개 경로의 **단일 원본 목록**. 추적 해제·상태 검증·롤백·pack 단정이 전부 이 파일을 읽는다 (구현 감사 4라운드 blocker 3) |

`server.js`는 이미 추적되지 않는다(`git ls-files server.ts server.js` → `server.ts`
만 반환). 즉 **이 패턴은 이미 부분적으로 적용돼 있다**. 18쌍은 남은 잔여다.

**ignore 규칙은 이미 거의 다 있다 — 구현 감사가 잡은 진짜 구멍은 중첩
디렉터리다 (A phase 구현 감사 blocker 1).** `./.gitignore` 24–30행이
`/config.js`, `/lib/**/*.js`, `/routes/**/*.js`, `/bin/ima2.js`,
`/bin/commands/*.js`, `/bin/lib/*.js`를 이미 덮는다. 그런데
`/bin/commands/*.js`는 gitignore 규칙상 중첩 경로에 매치되지 않아
`bin/commands/prompt-sub/build.js`가 UNMATCHED다 (`git check-ignore
--no-index -v`로 재현). 이 파일을 추적 해제만 하면 미추적 생성물로 다시 떠서
clean-worktree 기준을 깬다. 29행을 `/bin/commands/**/*.js`로 고치고, B에서
18개 전체에 `git check-ignore --no-index` 매치를 확인한다.

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

### B 실행 순서와 롤백 (구현 감사 blocker 4 반영)

초안의 "보호막 확인 → 추적 해제 → pack 확인"은 회귀 테스트의 RED 관측과
롤백이 빠져 있었다. 실행 순서를 고정한다.

1. 회귀 테스트를 **먼저** 추가하고 현재 트리에서 실패(RED)를 관측한다 (`a5`).
2. `.gitignore` 29행을 `/bin/commands/**/*.js`로 고치고 18개 경로 전부에
   `git check-ignore --no-index` 매치를 확인한다.
3. `git rm --cached --pathspec-from-file=scripts/paired-generated-paths.txt`로
   18개를 추적 해제한다. 디렉터리 pathspec이 아니라 목록 파일을 쓴다 (구현
   감사 4라운드 blocker 3 — `bin lib routes` 같은 디렉터리 pathspec은 무관한
   파일까지 함께 건드린다).
4. `npm run build:server && npm run build:cli`로 재생성한 뒤 인덱스 상태를
   검증한다 (구현 감사 3라운드 blocker 1): `git rm --cached`는 18개의
   **staged 삭제**를 만들므로 porcelain 전체가 비는 것은 커밋 후에만
   가능하다. 올바른 단정은 두 개다 — staged `D` 엔트리가 정확히 18개이고,
   그 경로들에 대해 unstaged 변경이나 untracked(`??`) 엔트리가 0개.

   ```
   diff <(git status --porcelain -- $(cat scripts/paired-generated-paths.txt) | sort) \
        <(sed 's/^/D  /' scripts/paired-generated-paths.txt | sort)
   # exit 0 = 정확히 18개 staged 삭제뿐. 한 글자라도 다르면 exit 1
   ```

   목록 파일이 기대값의 원본이므로 "18개 D"가 맞는지뿐 아니라 **어느
   경로인지**까지 기계 비교한다 (구현 감사 4라운드 blocker 1).
5. `npm pack --ignore-scripts --json --pack-destination "$TMPDIR_PACK"`의
   매니페스트로 18개 전부를 단정한다 (`a2`). `--ignore-scripts`는 prepack 전체
   UI 빌드를 걸어뛰기 위함이다 — 4번에서 이미 재생성했으므로 매니페스트
   검증에는 충분하다. `--pack-destination`는 필수다(구현 감사 2라운드
   blocker 2): `--pack-destination` 없이 pack하면 `ima2-gen-*.tgz`가 작업
   트리에 생기는데 `*.tgz`는 gitignore 대상이라 `git status`가 이 잔여물을
   보여 주지 못한다. 임시 디렉터리에 pack하고 그 tarball을 6번의 두 설치
   검증에 그대로 넘긴다. 기존 스모크 두 개
   (`tests/package-install-smoke.mjs:123`,
   `scripts/package-global-update-smoke.mjs:57`)도 같은 패턴을 쓴다.
6. 5번에서 만든 tarball을 **환경변수로 명시 바인딩**해 두 설치 검증에
   넘긴다 (구현 감사 3라운드 blocker 3 — 바인딩 없이 실행하면 두 스모크가
   각자 다시 pack한다, `tests/package-install-smoke.mjs:119` 참조):

   ```
   export IMA2_PACKAGE_TARBALL="$TMPDIR_PACK/$(ls "$TMPDIR_PACK" | head -1)"
   npm run test:package-install
   npm install -g "$IMA2_PACKAGE_TARBALL" --prefix "$TMPDIR_PREFIX"
   "$TMPDIR_PREFIX/bin/ima2" --version   # Windows는 "$TMPDIR_PREFIX/ima2.cmd"
   ```

   `export`는 두 명령이 같은 tarball을 보게 하기 위함이다 (구현 감사 4라운드
   blocker 2 — 명령 앞 임시 대입은 첫 명령에만 적용된다). pack destination에
   tgz가 하나뿐이므로 `ls`로 파일명을 얻는다.
7. tarball 삭제는 모든 빌드/pack 검증이 끝난 **마지막**에 하고, 삭제 커밋을
   분리한다.

**롤백 (구현 감사 2라운드 blocker 3 반영 — 커밋 전 모든 단계를 덮는다).**
1–3번(테스트 추가, gitignore, 추적 해제)은 **경로 한정** 롤백이다 (구현 감사
3라운드 blocker 4 — 무인자 `git reset`은 무관한 staged 작업까지 unstage한다):

```
git reset -q --pathspec-from-file=scripts/paired-generated-paths.txt
git reset -q -- .gitignore tests/release-pipeline-contract.test.ts
git checkout -- .gitignore tests/release-pipeline-contract.test.ts
rm -f scripts/check-pack-manifest.mjs scripts/paired-generated-paths.txt  # 신규 파일 둘은 untracked이므로 삭제
```

`.gitignore`와 테스트 파일은 **B 시작 시점에 미수정 상태였음을 먼저 확인한
뒤**에만 checkout으로 되돌린다 (사용자의 미커밋 변경이 있으면 checkout 대신
보존하고 사용자에게 알린다). 목록 파일 pathspec은 18개 생성물 외의 staged
변경을 건드리지 않는다 (구현 감사 4라운드 blocker 3). 4번 이후가 문제다: `build:server`/`build:cli`가 18개 `.js`의 **작업 트리
내용**을 덮어쓰므로 인덱스만 되돌리면 재추적되는 바이트와 작업 트리가 어긋날
수 있다. 완전 롤백은 `git reset -q
--pathspec-from-file=scripts/paired-generated-paths.txt && git checkout
--pathspec-from-file=scripts/paired-generated-paths.txt`다 — 18개 경로의
인덱스와 작업 트리를 HEAD로 함께 되돌린다 (생성물은 같은 `.ts`에서 다시
만들 수 있으므로 checkout 복원이 안전하다). 5–6번의 임시 pack/install 디렉터리는
삭제한다. tarball 삭제는 별도 커밋이고 HEAD에서만 일어나므로 blob은 히스토리에
남고 이전 커밋에서 checkout으로 복구 가능하다.

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

- IN: `./.gitignore` 29행 수정, 18개 `.js` 추적 해제, devlog tarball 2개 삭제,
  `tests/release-pipeline-contract.test.ts` 케이스 추가,
  `scripts/paired-generated-paths.txt`, `scripts/check-pack-manifest.mjs` 신규.
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
  **기계 판정**(구현 감사 blocker 3 반영): 신규
  `scripts/check-pack-manifest.mjs`가 `npm pack --ignore-scripts --json
  --pack-destination <mktemp>`의 파일 목록에서 18개 기대 경로를 전부 찾고,
  누락 시 목록과 함께 exit 1이다. 임시 디렉터리 생성과 삭제는 스크립트가
  소유한다 (구현 감사 3라운드 blocker 2 — destination 없이 pack하면
  gitignore된 `*.tgz` 잔여물이 작업 트리 루트에 남는다). 이미 만든
  tarball이 있으면 `IMA2_PACKAGE_TARBALL`로 받아 pack을 건어뛴다.
  기존 `tests/package-smoke.test.js`는 대표 6개만 본다.
- `a3`: 패키지된 tarball에서 전역 설치한 `ima2 --version`이 성공한다. `a2`가
  파일 존재만 보므로 실행 가능성은 따로 본다. **실행 방법 교정**(구현 감사 blocker 2 반영):
  `tests/package-install-smoke.mjs`는 로컬 설치 + packed CLI 실행
  (`grok --help`, `status`, `doctor`, `serve`)이지 전역 설치도 `--version`도
  아니다. `a3`는 C에서 실제로 수행한다: `npm install -g <tarball>
  --prefix <tmp>` 후 shim을 실행한 증거. shim 경로는 플랫폼 의존이다(구현
  감사 2라운드 blocker 4): POSIX는 `<tmp>/bin/ima2`, Windows는
  `<tmp>/ima2.cmd` — 저장소의 표준 해석이
  `scripts/package-global-update-smoke.mjs:75`에 있다. C는 이 호스트
  (macOS, POSIX)에서 실행 증거를 남기고, Windows shim 경로는 문서 명시로
  처리한다. 사용자 전역 환경은 건드리지 않는다.
- `a4`: `git cat-file -s`로 확인한 두 tarball blob이 HEAD에서 사라지고,
  작업 트리 `devlog/` 크기가 약 228MB → 약 102MB로 줄어든다.
- `a4b`: 삭제 후, **`devlog/_fin/260714_git-index-fix/` 안에서** 두 파일명을
  언급하는 파일이 `artifacts/README.md` **뿐**이다 (기계 판정 — 구현 감사
  blocker 3 반영: 초안의 rg는 출력을 사람이 해석해야 해서 기계 판정이
  불가능했다).

  ```
  rg -l --no-ignore 'wt7174-untracked|gitdir-foreign-files' \
     devlog/_fin/260714_git-index-fix/
  # 기대 출력(정확히 1건): devlog/_fin/260714_git-index-fix/artifacts/README.md
  ```

  판정 규칙(구현 감사 2라운드 blocker 1 반영 — 사람 비교가 아니라 셸
  비교로 기계화한다):

  ```
  test "$(rg -l --no-ignore 'wt7174-untracked|gitdir-foreign-files' \
     devlog/_fin/260714_git-index-fix/)" = \
     "devlog/_fin/260714_git-index-fix/artifacts/README.md"
  # exit 0 = 통과, 그 외(추가 파일/0건) = 실패
  ```

  `010_cleanup-plan.md`와 `020_cleanup-record.md`는 tarball을 가리키는 대신
  README를 가리키도록 고친다.

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
