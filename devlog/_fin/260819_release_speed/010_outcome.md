---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, release, outcome]
---

# 010 — 실측 결과 (v3.7.1 컷)

| 지표 | v3.7.0 (변경 전) | v3.7.1 (변경 후) |
|---|---|---|
| stable publish 레인 | 806초 | **252초** (-69%) |
| windows-consumer | preview + stable 2회 | preview 1회 |

## 라이브 컷이 잡아낸 것 2건

1. **Windows Node 22 레인 flaky**: preview 레인의 tarball-install이 deadline
   초과 (동일 tarball의 Node 24 레인은 통과, 직전 7연속 run 통과). rerun으로
   해소. 러너 소음이지 회귀 아님.
2. **transitive skip 결함**: success()가 needs 체인 전체에 전이되어, 스킵된
   windows-consumer가 publish-stable을 넘어 create-github-release까지
   스킵시켰다 (태그·npm은 발행됐는데 GH Release 부재). `!failure() &&
   !cancelled() && needs.publish-stable.result == 'success'`로 수정하고
   contract pin (e) 추가 (c5784b86). v3.7.1 Release는
   `release-contract.mjs ensure-github-release`로 생성.

## 남은 후속 (별도 유닛 후보)

- `verify:release:source` stable 중복 3.2분 — preview 전용화 가능 (감사 4절)
- cut 레인의 candidate CI(4.8분)/로컬 verify(2.6분) 재설계 — release-cut 계약 변경 필요
