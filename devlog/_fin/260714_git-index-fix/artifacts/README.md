---
created: 2026-08-13
tags: [ima2-gen, devlog, archive-retirement]
---

# artifacts README — tarball 보관 종료 기록

이 디렉터리에는 원래 대형 tarball 2개가 있었다. 2026-08-13에 **의도적으로
보관 종료**했다 (로드맵 `devlog/_plan/260813_maturity_roadmap/010`).

| 파일 | 바이트 | 내용 | 종료 근거 |
|---|---:|---|---|
| `wt7174-untracked.tar.gz` | 94,146,560 | 2026-07-14 git index 사고 당시 worktree 7174의 미추적 파일 24개 + 목록 | payload 표본 9개(`lib/assetsStore.ts`, `lib/presetCompiler.ts`, `routes/assets.ts`, `presets/*.json` 3개, `ui/public/fonts/ClashDisplay-600.woff2`, `ui/public/presets/thumbs/anime.png`, `tests/assets-routes-contract.test.ts`) 전부 현재 HEAD에 존재함을 `git cat-file -e`로 확인. 유일 사본이었던 `260713_issue110-windows-installer-npm/` devlog는 사고 당시 이미 이 체크아웃의 `devlog/_fin/`으로 구조됨 |
| `gitdir-foreign-files.tar.gz` | 32,103,190 | 사고 때 module git dir 안에 물질화된 외래 작업 트리 파일 38개 스냅샷 (1,436 엔트리) | 외래 파일의 정본은 ref/히스토리에 있고 git dir는 이미 정화됨 (`020_cleanup-record.md`). 인벤토리 텍스트 `gitdir-foreign-files.txt`는 유지 |

## 무엇이 사라졌나

미추적 payload의 바이트 스냅샷 자체다. `.patch`·`.txt` 증거(이 디렉터리에
유지)는 변경 내용과 인벤토리를 보존하지만 tarball 안 파일 원본의 바이트는
사라진다. HEAD에 없는 미추적 파일이 나중에 필요해지면 이 tarball만이 답이
었다 — 그 가능성을 받아들이고 지운다. blob은 이 저장소의 git 히스토리에
남아 있으므로, clone을 새로 받지 않는 한 로컬에서는
`git cat-file`로 복구할 수 있다.

## 왜 지웠나

126MB가 매 체크아웃 작업 트리에 따라다녔다. 히스토리 재작성은 SHA와
npm `gitHead` 계약을 깨므로 하지 않고, HEAD에서만 삭제한다.
