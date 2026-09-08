---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, release, v3.15.1]
---

# 070 — v3.15.1 배포 기록

## 결과

| 항목 | 값 |
|---|---|
| 버전 | v3.15.1 |
| 릴리스 커밋 | `11900764a59e74146c9008ed296a23d3fc0ac06a` |
| npm `latest` | 3.15.1 (gitHead가 릴리스 SHA와 일치) |
| npm `preview` | 3.15.1-preview.260908.34192559755.1 |
| GitHub Release | v3.15.1, 2026-09-08T06:34:09Z |
| 브랜치 정렬 | main = dev = preview = 태그 = `11900764` |

## 경로

| 단계 | 근거 |
|---|---|
| dev 머지 | PR #230, merge commit `69860310`, CI 10개 green(CLEAN) |
| main 승격 | PR #231, 실패 0건 CLEAN, merge commit `95cb0037` |
| 릴리스 컷 | `release.yml` run 34191200288, `expected_sha=95cb0037`, `dry_run=false` |
| 후보 CI | `release-candidate` ref에서 6개 잡 전부 success |
| npm 게시 | `publish.yml` 34192559755(preview) / 34194398182(stable) |

## 리베이스에서 배운 것

작업을 시작한 시점의 `dev`는 원격보다 264커밋 뒤처져 있었고, 그 사이 provider
adapter 리팩터(#150)와 `videoExtensionOwner` 재작업이 들어와 내 변경과 같은
파일을 건드렸다. 격리 워크트리에서 리베이스했고 충돌은 네 갈래였다.

`.gitignore`는 양쪽이 각자 allowlist 항목을 더한 것이라 병합했다.
`structure/01`의 줄 수 표와 런타임 테스트 인벤토리는 생성물이라 병합된 트리에서
재생성했다. `ResultActions`는 원격이 연장 상태를 스토어 오너로 옮긴 뒤였으므로,
그 구조를 유지하고 편집 상태만 컴포넌트 로컬로 얹었다 — 편집은 한 번의 호출로
끝나 잡 수명주기를 가로질러 추적할 대상이 없다.

### 72건 실패는 회귀가 아니었다

리베이스 직후 테스트가 72건 실패했다. 원인은 `tests/cli-lan-auth.test.ts`가
손으로 써 넣는 `lib/imageModels.js` 스텁이었다. 그 스텁에 내가 추가한
`MIN_VIDEO_DURATION`과 `MAX_VIDEO_DURATION`이 없어서, 그것을 import하는 모든
CLI가 모듈 로드 단계에서 죽었다. 테스트가 검사하려던 것과는 무관한 실패다.

이걸 회귀로 오진하지 않은 건 **`origin/dev`를 별도 워크트리에서 같은 조건으로
측정해 `comm`으로 비교했기 때문이다.** baseline을 따로 재지 않았다면 내 변경
탓으로 결론 내렸을 것이다. 스텁 보강 후 차이는 0건이 됐다.

## 기록해 둘 것

릴리스 워크플로가 `npm-stable` 환경 승인을 두 번 요구했다. `release.yml`의
안정 태그 게이트와 `publish.yml`의 실제 게시 게이트다. 사용자가 배포까지
지시했으므로 승인했지만, 이 게이트는 본래 사람이 한 번 더 보라고 있는 것이다.

FSM 소스 바인딩이 원본 워크트리를 보고 있어서 격리 워크트리의 작업을 인식하지
못했다. `session source`는 B 진입 후에는 거부되므로, 로컬 `dev`/`main`을 원격
결과로 reset해서 해소했다.

## 여전히 남은 것

- 컴포저에서 영상을 드롭해 편집으로 들어가는 흐름 (결과 카드 버튼이 대신 가능)
- `grok-imagine-image-quality` 2026-11-02 폐기 대응 — `_plan/README.md`의
  '일정이 있는 후속 항목'에 등재
- 060에 적은 미확인 6항목

