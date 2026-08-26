---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, release, ci, speed]
---

# 000 — 릴리스 소요 시간 단축

## v3.7.0 실측 분해 (dispatch → npm latest 37분)

| 구간 | 시간 | 내용 |
|---|---|---|
| cut: verify:release 재실행 | 2.6분 | 후보 커밋 로컬 검증 |
| cut: candidate CI gate | 4.8분 | release-candidate ref에 ci.yml 재실행 |
| cut: preview publish 대기 | **14.7분** | publish.yml 풀런 (package 3.2분 + **windows-consumer 매트릭스 7분** + publish) |
| (승인 1) | — | npm-stable tag gate |
| tag: stable publish 대기 | **13.4분** | publish.yml **또 풀런** — 같은 SHA에 package 3.2분 + **windows 7분 재실행** + publish |
| (승인 2) | — | publish-stable gate |

핵심 중복: **같은 gitHead를 preview 레인이 이미 완주(소스 검증 + Windows 설치
스모크 2종)했는데, stable 레인이 몇 분 뒤 동일 검증을 전부 반복**한다.

## opencodex 참조 (../opencodex/.github/workflows/release.yml)

opencodex는 릴리스에서 검증을 **재실행하지 않는다**: 해당 SHA의 기존 push CI
성공 run을 `gh run list --commit`으로 **조회만** 하고, publish job 하나가
15분 timeout 안에 publish + registry smoke + GH release까지 끝낸다.
"이미 증명된 SHA는 다시 증명하지 않는다"가 원칙.

ima2 선례도 같은 방향: 커밋 9830cdde "ci: take Windows off the release path".

## 변경 (C3, 최소 위험)

**stable 레인의 windows-consumer 스킵.** 근거: stable을 태그하기 전에
release.yml이 preview proof(같은 gitHead의 npm preview 존재)를 강제하고,
publish.yml prepare도 latest 채널에서 `verifyPreviewProof`를 재확인한다.
그 preview는 같은 SHA에서 windows-consumer 매트릭스를 이미 통과했다.
stable 아티팩트와의 차이는 package.json version 문자열뿐이다.

감사(r5) 반영: 기존 단언은 **깨지지 않는다** — 전역 regex라 preview 쪽 문자열이
계속 매치돼 조용히 초록으로 남는 것이 진짜 결함. job-scoped 불변식이 필수다.
"preview publish ⇒ windows-consumer 통과" 추론은 publish.yml 본문에만 살아
있으므로 publish-preview의 의존 고정이 이 변경의 하중을 받는 단언이다.

| 파일 | 변경 |
|---|---|
| `.github/workflows/publish.yml` | windows-consumer `if`에 `channel == 'preview'` 추가; publish-stable `if`를 `${{ !failure() && !cancelled() && ... }}`로 (`${{ }}` 필수 — bare `!`는 YAML 태그). create-github-release는 **무변경** (publish-stable이 실제 실행되므로 skip 전파 없음; always() 추가는 다운그레이드) |
| `tests/release-pipeline-contract.test.ts` | job-scoped 불변식: (a) publish-preview가 `needs: [prepare, package, windows-consumer]` 유지 — 하중 단언, (b) windows-consumer가 `channel == 'preview'` 조건 보유, (c) publish-stable이 같은 needs 유지 + `!failure() && !cancelled()` 보유, (d) publish-stable 블록에 `always()` 부재 |

package job은 stable에서도 유지 — stable tarball은 version 문자열이 달라
digest 체인(verify-artifact/guard-publish)이 자체 아티팩트를 요구한다.
`verify:release:source` 3.2분의 stable 중복 제거는 별도 후속 유닛.
예상 단축: tag 레인 13.4분 → 6~8분 (감사 보정치).

cut 레인(23분)의 candidate CI/로컬 verify 중복은 이번 범위 밖 — release-cut
계약 재설계가 필요해 별도 유닛. 이번 변경만으로 tag 레인 13.4분 → 약 6분.

## 검증

actionlint + npm test (release-pipeline-contract 포함) + 실제 릴리스 컷으로
단축 실측 (v3.7.1 patch — 워크플로 변경만이라 runtime 무변경 릴리스).
