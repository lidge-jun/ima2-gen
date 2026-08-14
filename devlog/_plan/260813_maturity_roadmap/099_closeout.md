---
created: 2026-08-13
updated: 2026-08-14
tags: [ima2-gen, devlog, closeout]
---
# 099 — 클로즈아웃

- 세션: `019ff6f2-542f-7e21-a3ba-22d4fcc0397e`
- 기준: `dev` @ `9c0e70a` (문서 작성 시작 시 `ac1cace`)
- 터미널 아웃컴: **DONE** (문서화 목표에 한해)

## 무엇을 만들었나

| 문서 | 내용 |
|---|---|
| `000` | 유닛 계획, work-phase 맵, 의존 그래프 |
| `001` | 평가서 수용 범위와 제외 범위 |
| `002` | 주장 원장 19건 (verified / refuted / partial / unverifiable) |
| `003` | 아키텍처 인벤토리 (fanout, 중복, job 어휘, 오류, 크기) |
| `004` | 릴리스 상태 + opencodex 대조 |
| `010` | 빌드 산출물 결정성 |
| `020` | 릴리스 컷 결정성 |
| `030` | 릴리스 채널 계약 (main → preview → latest) |
| `040` | Provider Capability Registry |
| `050` | Job terminal status 계약 |
| `060` | 공급자 오류 분류 |
| `070` | doctor 확장 |
| `080` | 프런트엔드 E2E |
| `085` | 백엔드 타입 강화 |
| `090` | 거버넌스와 공급망 |

아카이빙: `260803_github_issue_pr_closeout` → `_fin`.
`260812_navrail_grok_autotag`는 **남겼다** — 릴리스 활성화가 증명되지 않았다.

## 감사가 이 유닛을 만들었다

6개 work-phase, 독립 감사 13라운드, 블로커 **52건**. 전부 접었고 하나도 반박하지
않았다. 라운드별로는 WP1 11건, WP2 9건, WP3 14건, WP4 18건, WP5 13건, WP6 5건이다.

감사가 없었다면 나갔을 잘못된 계획들:

| 무엇 | 왜 틀렸나 |
|---|---|
| 260812를 `_fin`으로 이관 | 릴리스가 한 번도 초록인 적이 없다 |
| `git mv`로 아카이빙 | `devlog/_plan/*`가 gitignore라 추적되지 않는다 |
| "버전 커밋에는 CI가 안 돈다" | `gh run list`에 축약 SHA를 넘겨 0건이 나온 것 |
| `taskkill` 사후 정리 | `spawnSync`는 자식이 죽은 뒤 반환해 정리할 뿌리가 없다 |
| UI에서 오류 코드 복원 | 코드는 서버 정규화에서 이미 사라진다 |
| 스텁 lane을 registry에 등록 | 미지 provider가 `oauth`로 접혀 **실제 과금**된다 |
| doctor에 포트 검사 추가 | 이미 있다 |
| "doctor는 과금하지 않는다" | `image-probe`가 실제 생성을 2회+ 호출한다 |
| "인덱싱 오류는 런타임 버그 후보" | 표본 10건 대부분이 이미 방어돼 있었다 |

마지막 세 줄이 이 유닛의 성격을 보여준다. **내가 확인 없이 적은 문장이 가장
자주 틀렸다.**

## 평가서에서 틀린 것

| 평가서 | 실제 |
|---|---|
| "strict 이전은 끝난 과제" | 두 플래그 없음. 켜면 312건 |
| "`ima2 doctor` 구현" | 이미 있다. 확장 과제다 |
| "npm provenance" (미래 과제) | 이미 있고 더 엄격하다 |
| "저장소 크기는 패키징 범위 탓" | devlog 백업 tarball 2개가 126MB |
| "Windows 타임아웃" | 예산 부족이 아니라 stall. 중앙값 6:03, 실패 15:03 |

평가서는 대체로 옳지만 **무오류가 아니다.** 그대로 실행했다면 이미 있는 것
두 개를 다시 만들고, 살아 있는 타입 부채를 지웠을 것이다.

## 반복된 실패

**정정을 덧붙이면서 낡은 문장을 지우지 않았다.** WP3·WP4·WP5에서 세 번 발생했고,
매번 감사가 "문서가 자기모순"이라고 잡았다. 한 번은 `apply_patch` 훅이 조용히
실패했는데 성공한 줄 알고 넘어가, 문서가 존재하지 않는 인터페이스를 설명하는
상태가 됐다.

대응: 구조적 편집 뒤에는 **디스크에서 다시 읽어 확인**한다. 패치 결과를 믿지
않는다.

## 다음 사람이 알아야 할 것

### 착수 가능

`010` → `020` → `030` 사슬. 릴리스가 지금 빨갛고, 세 문서가 그 원인을 각각
짚는다. `040`~`060`은 이와 **독립**이므로 병렬 가능하다.

### 사용자 승인이 필요한 지점

| 지점 | 문서 |
|---|---|
| 첫 dry-run dispatch | `030` |
| ruleset 적용 | `030` |
| 첫 실전 릴리스 컷 | `030` |
| Security Advisory / vulnerability alerts 활성화 | `090` |
| CodeQL 활성화 (Actions 사용량) | `090` |
| `CODEOWNERS` 명단 | `090` |

### 이 로드맵이 하지 못하는 것

평가서의 70점 조건 8개 중 4개(메인테이너 3명, 커밋 점유율, 외부 기여 비중, 이슈
응답 시간)는 **엔지니어링 산출물이 아니다.** 전 phase를 완주해도 움직이지 않는다.
이 유닛을 다 끝내고 "70점에 도달했다"고 적으면 그것은 거짓이다.

## 남은 부채

| 항목 | 어디서 |
|---|---|
| 260812 이관 시 깨질 참조 6건 | `060_release_activation_residual.md` |
| `tsconfig.tests.json`의 `strictNullChecks: false` | `085` 범위 밖 |
| 149개 `.js` 테스트의 `.ts` 이전 | `002` C-08 |
| Canvas·Video·Agent·MCP E2E 여정 | `080` 범위 밖 |
| 성능 계측과 벤치마크 | `001`에서 이번 라운드 제외 |

## 구현 클로즈아웃 (2026-08-14)

- 세션: `019ffa3f-5cfb-7060-85ca-dd8230eac6a2`
- 기준: `origin/dev` @ `09660557` (+ pending install-policy fix for Playwright `fsevents@2.3.2`)
- `origin/main` / `origin/preview`: 여전히 `ac1cace` (3.0.5). 승격하지 않았다.
- npm: `latest=3.0.5`, `preview=3.0.6-preview.260812.31603578657.1`. dist-tag 변경 없음.
- 터미널 아웃컴: **DONE for code-only #122 phases**. **NOT a release.**

### 구현된 phase

| phase | issue | landing |
|---|---|---|
| 010 | #123 CLOSED | 2e914f80 |
| 020 | #124 CLOSED | e62fd89d |
| 030 코드 | #125 CLOSED | 18c1366f. dry-run dispatch는 승인 대기 |
| 040 | #126 CLOSED | 9da23de9 |
| 050 | #127 CLOSED | 1757dc86 / 546eb813 |
| 061/062/063 | #128 CLOSED | aaf2e912 / 8dff256e / dfd492a5 |
| 070 | #129 CLOSED | f73f95f0 / 0ebbb402 |
| 080 | #130 CLOSED | 2e7ef9f3. local QA = agbrowse |
| 085 | #131 CLOSED | a2809034 / 8449e79d |
| 090 코드 | #132 CLOSED | 09660557. 설정 변경은 승인 대기 |

### 배포 준비 — 아직 승인 필요

| 항목 | 상태 |
|---|---|
| `gh workflow run release.yml` dry-run / canary / 실전 | 안 함 |
| main / preview 승격 | 안 함. 둘 다 `ac1cace` |
| npm publish / dist-tag | 안 함 |
| Security Advisory / vulnerability alerts | 안 함 |
| CODEOWNERS ruleset | 파일만 있음 |
| CodeQL 첫 실행 결과 | 워크플로는 커밋됨. 결과는 CI가 남긴다 |

### 로컬 게이트 (099)

- `npm run typecheck` 0
- `npm run typecheck:tests` 0
- `npm test` 2198 pass / 0 fail / 2 skip (09660557)
- `npm run test:install-policy` was red on CI and locally: ui Playwright pulled `fsevents@2.3.2`. Approval added in this closeout.

#122 remains OPEN. 005 said 099 is not its own issue and cannot close the umbrella without a real release.

## 2026-08-14 후기

"릴리스 활성화 미증명"이라는 판단은 작성 시점에 옳았다. 그날 안에 `8bc4468e`가
들어가고 v3.0.6, v3.0.7이 발행되면서 조건이 충족됐다.

| 항목 | 값 |
|---|---|
| release run | `31778196224` success |
| publish run | `31780064187` success |
| npm `latest` | `3.0.7` |
| `main`/`dev`/`preview` | `11bb9b87` 정렬 |

`260812_navrail_grok_autotag`는 이제 `_fin` 이관 가능하다.

#122는 여전히 열려 있다. 하위 #123–#132가 닫힌 것과 우산이 닫히는 것은 다르다 —
우산의 완료 조건에 "실제 릴리스"가 포함돼 있었고 그것이 이제 두 번 일어났다.
#122 클로즈아웃은 `260814_issue_pr_zeroing_release/060`에서 완료 조건 7개를
대조한 뒤 처리한다.

이 유닛의 `000`, `004`, `020`에도 2026-08-14 정정 블록을 넣었다. 후기 한 곳만
고치면 정작 근거 문서가 실패 상태를 현재형으로 서술한 채 남는다.
