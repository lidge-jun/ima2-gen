---
created: 2026-08-25
tags: [ima2-gen, devlog, outcome, issues, closeout]
---

# 090 — outcome: 이슈 4건 + PR 3건

terminal outcome: **DONE** (open PR 0, open issue 1 — 의도적)

## 처리 결과

| 항목 | 처리 | 근거 |
|---|---|---|
| #170 `-d`+`-o` | 수정·종료 | 재현 통과, 3개 호출부 |
| #171 frame 로컬 경로 | 수정·종료 | 재현 통과, 업로드 경로 신설 |
| #172 i2v/t2v 메타 | 수정·종료 | 두 분기 sidecar 검증 |
| #173 크기 nudge | 3제안 전부 반영·종료 | 실측 재현 |
| #160, #161 | 병합 | CI green |
| #162 | 종료 (대체) | 동일 SHA를 dev에 반영 |
| #150 | **열어둠** | 수용 조건 6개 중 3개 미충족 |

## #162 — PR이 아니라 게이트가 틀렸다

실패 로그를 읽으니 `not ok 5 - pins CodeQL and nix actions to immutable SHAs`였다.
`tests/governance-files-contract.test.ts:64`가 **특정 커밋 하나를 하드코딩**하고
있어서, 올바르게 SHA로 핀된 bump조차 전부 이 게이트에서 죽었다.

규칙은 "불변 커밋에 핀"이지 "영원히 이 커밋에 핀"이 아니다. 단언을 40자 커밋
해시로 바꾸고 태그 참조는 계속 거절하게 했다. dependabot이 제안한 SHA를
`gh api`로 upstream v31.11.1 태그와 대조해 확인한 뒤 dev에 반영했다.

dependabot이 옳았고 우리 테스트가 틀렸다.

## #150 — 세지 않고 재봤다

0/0을 만들려면 닫으면 됐지만, 수용 조건을 실제 코드로 하나씩 확인했다.

결정적 근거: `ProviderAdapterV1`의 `generateImage`/`editImage`가 optional인데
**구현한 어댑터가 하나도 없다**. 실제 생성은 여전히 `generatePipeline.ts`와
`routes/*`가 lane별로 분기한다. UI에는 provider 분기가 17곳 남아 있고
`packages/`는 존재하지 않는다.

이번 주 comfy video 작업이 이 이슈의 논거를 강화하는 실측 사례이기도 하다:
lane 하나 붙이는 데 11개 파일을 건드렸다.

남은 작업이 실재하므로 열어뒀다. 숫자를 맞추려 닫는 것은 보고가 아니라 분식이다.

## 공통 패턴

네 이슈 모두 "기능이 없다"가 아니라 **"이미 있는 정보를 버리고 있다"** 였다.

- #170: 경로를 알고 있는데 안 쓴다
- #172: mode를 판정해놓고 안 남긴다
- #173: 실제 크기를 파일이 알고 있는데 안 읽는다

#171만 구조적 제약(서버가 사용자 cwd를 못 봄)이라 새 경로가 필요했다.
