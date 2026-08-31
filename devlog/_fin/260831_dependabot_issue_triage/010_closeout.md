---
created: 2026-08-31
tags: [ima2-gen, devlog, dependencies, ci, closeout]
---

# Closeout: dependabot backlog + open-issue triage

## 처분 결과

| 항목 | 처분 | 근거 |
|---|---|---|
| #175 `@tanstack/react-virtual` 3.14.9 -> 3.14.10 | merge `4ad4ec42` | dev 재타깃 후 fast gate SUCCESS |
| #176 `@types/react-dom` 19.2.4 -> 19.2.5 | merge `10240a2e` | 같음 |
| #177 `@openai/codex` 0.147.0 -> 0.149.1 | merge `877e979f` | 같음 |
| #178 github-actions group (codeql-action v4.37.7 -> v4.37.8) | merge `d950b605` | 게이트 수정 후 fast gate SUCCESS |
| #150 Provider Adapter v1 RFC | **열어둠** | 수용 조건 6개 중 3개 미충족, 트리 근거 코멘트 기록 |
| PR #183 게이트 수정 | merge `9211ddca` | 감사 6라운드 pass |

열린 PR 0건. `origin/main` = `origin/dev` = `d950b605`.

## #178은 우리 버그였다

실패 단계는 `Run tests`, 실패 케이스는 `governance-files-contract`의
"pins CodeQL and nix actions to immutable SHAs"였습니다. 단언이 CodeQL 커밋
하나를 고정하고 있어서, 올바르게 핀된 bump도 전부 실패했습니다. #162가 nix에
대해 같은 버그를 고치고 CodeQL 두 줄을 남긴 재발이었습니다.

## 감사에서 드러난 것

원래 계획은 #162의 `[0-9a-f]{40}\b` 모양을 복사하는 것이었는데, 감사가 그
모양 자체가 게이트를 약화시킨다는 걸 보여줬습니다. 여섯 라운드에서 나온 결함:

1. `\b`는 40번째 hex와 구두점 사이에 매치되므로 `@<sha>-evil`,
   `@<sha>/evil`, `@<sha>.evil`이 통과. 전부 fork가 옮길 수 있는 ref.
2. `@vN`만 부정하면 `actions/checkout@main`이 통과. 저장소의
   `sha_pinning_required`가 `false`라 플랫폼 백스톱도 없음.
3. `release-pipeline-contract.test.ts`의 `attest-build-provenance` 리터럴이
   다음 bump에서 같은 방식으로 깨질 예정.
4. 줄 단위 파서는 유효한 YAML에 뚫림. `- { uses: attacker/action@main }`은
   줄 시작에 `uses:`가 없어 건너뛰고, `run: |` 블록 스칼라 안의 텍스트가
   핀된 스텝으로 집계됨. actionlint가 받아들이는 YAML이라 가정이 아님.
5. 반대 방향 오류. `workflow_call` 입력, matrix 차원, `with:` 값의 이름이
   `uses`일 수 있고 러너는 무시함. 이걸 거부하면 올바르게 핀된 워크플로가
   실패.
6. composite action 매니페스트 미수집. `uses: ./.github/actions/x`는 local로
   처리되어 열어보지 않으므로 그 안의 미핀 서드파티 액션이 안 보임.
7. `external > 0` 요구가 유효한 형태를 거부. local 참조만 있는 워크플로,
   JavaScript/Docker/shell-only action은 핀할 외부 ref가 없음.
8. 심볼릭 링크 디렉터리는 repo 상대 이름을 갖지만 어디로든 해석됨.

## 최종 형태

`tests/_actionPins.mjs`가 YAML AST를 읽고 러너가 실제로 해석하는 위치만
검사합니다. `jobs.<id>.steps[].uses`, `jobs.<id>.uses`,
`runs.steps[].uses`. alias는 anchor로 해석하고, ref 토큰 전체가 정확히 40자
소문자 hex여야 합니다. `pinnedManifestPaths`가 워크플로와 composite action
매니페스트를 탐색하고 local 참조를 고정점까지 따라가며, `realpathSync`로
저장소 밖을 차단합니다.

40 hex는 모양 검사이고 상류 provenance 증명이 아니라는 한계를 코드에 적어
뒀습니다. 40자 hex는 유효한 git ref 이름이기도 합니다.

## 검증

```
npm test                    2674 pass / 0 fail / 2 skipped (2676 tests, 315 suites)
typecheck / typecheck:tests / test:inventory / test:install-policy / audit:gate / lint:pkg
build:server / build:cli / ui build / test:provider-registry
assertBaseline(head=main, dev, preview)  problems: []   RELEASE PREFLIGHT: PASS
```

게이트를 실제로 뚫어봤습니다. `codeql.yml`을 `@v4`, `@main`,
`@<sha>-evil`, 7자 sha로 바꾸면 각각 실패하고, 새 40 hex 커밋이면 통과합니다.
감사가 만든 flow-map + `run:` 디코이 우회는 line 22의
`attacker/action@main`에서 잡힙니다. #178의 실제 커밋
`db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28`을 적용하면 세 파일 56/56 통과 —
전에 실패했던 그 테스트입니다.

탐색 능력도 변형 테스트로 확인했습니다. root 탐색을 빼면 `action.yml`을,
참조 추적을 빼면 `tools/local/action.yml`을, realpath 차단을 빼면 저장소 밖
`link/action.yml`을 놓치고 각각 테스트가 실패합니다.

## 남은 것

- 컨테이너 이미지는 다른 표면입니다. `Dockerfile:8,23`의
  `node:22-bookworm-slim`과 `docker-compose.yml:4`의 `ima2-gen:latest`는
  digest가 아니라 태그 핀이고, `flake.nix:5-6`의 nixpkgs 입력도 부동
  참조입니다. 이번 게이트 범위 밖이라 손대지 않았습니다.
- #150은 generate/edit 디스패치를 어댑터 경유로 돌리는 게 선행 조건입니다.
