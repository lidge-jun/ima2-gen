# 감사 종합 + 릴리스 실행 사양 (012)

리뷰어 판정: **GO-WITH-FIXES (blockers=1)**. 접었다. 반박 0건.

## Blocker 1 (High) — main 정렬 단계가 계획에 없었다 → 접음

리뷰어 증거: `release.yml:66-79`는 `ref: main`으로 체크아웃하고
`scripts/release-cut.mjs:53-59`의 `assertBaseline`이 `main !== head`면 거부한다.
따라서 **워크플로는 스스로 main을 807b5ef0으로 옮길 수 없다.** 워크플로가 나중에
main에 push하는 것은 "버전 커밋"을 올리는 단계이지 초기 정렬이 아니다.

확정 순서:

```
1. git push origin 807b5ef0:refs/heads/main     (fast-forward, 정렬)
2. gh workflow run release.yml --ref main \
     -f bump=patch -f dry_run=false \
     -f expected_sha=807b5ef05e5732f97a271f316fffaeb48eb84d13
```

리뷰어가 함께 확인해준 것:

- `origin/preview`(d39f9ea2)는 807b5ef0의 조상이므로 `contains(preview, head)` 통과.
- 과거 릴리스 태그 부모가 전부 단일 부모 선형 커밋(v3.13.0←a02fcf74,
  v3.12.3←21e11f06, v3.12.2←bd569da2, v3.12.1←555e3051)이라 fast-forward 토폴로지가 관례에 맞다.
- `bump=patch`가 변경 성격에 맞다(v3.13.0 → v3.13.1).
- `expected_sha`는 정렬 후의 전체 SHA이며, 워크플로가 만드는 버전 커밋 SHA와 혼동 금지.

실행 직전 branch protection을 읽기 전용으로 재확인하라는 권고도 접수했다.

## 리뷰어가 blocker 없음으로 확인한 것

- **fast-uri override 안전.** 공식 advisory 4건 모두 3.x patched version이 **3.1.6**이라
  3.1.7은 범위 밖. 2026-09-02 이후 3.1.7에 영향 주는 새 advisory 없음.
  ajv 런타임 동작 직접 실행 확인. `npm audit --omit=dev` high 0 / critical 0.
- **lockfile diff가 fast-uri version/resolved/integrity 3줄뿐.** 무관한 업그레이드 없음.
- **action-pin 정규화가 전 경로 커버.** workflow 후보, `.github/actions` 재귀,
  `localManifestCandidates` 중복 제거, `containedInRoot`, 이후 `readFileSync` 모두 정상.
- **CI 수정의 릴리스 포함이 적절.** 과거에도 a02fcf74(audit gate), bd569da2, ad2e0a14
  같은 CI 수정이 릴리스 라인에 포함됐다.

## 감사 후 발견 — Windows는 애초에 릴리스를 막지 않았다

dev 푸시 후 CI를 관찰하다 내 전제가 틀렸음을 알았다. Windows 잡은 실패가 아니라
**skipped**였고, `.github/workflows/ci.yml:161-162`가 이유를 말한다:

```yaml
if: github.event_name == 'schedule'
```

주석(`ci.yml:149-159`)이 의도를 명시한다:

> Windows is a supported install target, so its coverage is kept — but it is off
> the release path. ... `schedule` only: never on push, and never on the
> workflow_dispatch that release.yml uses for its candidate gate. A regression
> here is caught within a day and fixed on its own merit instead of stopping a
> release.

즉 **결함 B는 릴리스 차단 요인이 아니었다.** 계획 000이 "릴리스를 막는다"고 적은 것은
틀렸다. 이 문서가 그 서술을 대체한다.

수정 자체는 유지한다 — 매일 빨간 예약 실행을 남기는 실제 버그이고, 릴리스 경로가
아니라는 것이 고치지 말아야 할 이유는 아니다. 다만 **릴리스의 선결 조건은 아니었으며**,
그 검증은 릴리스와 무관하게 다음 예약 실행(또는 수동 schedule 트리거)이 준다.

결함 A(fast-uri)는 릴리스 경로의 `verify:release`가 `audit:gate`를 포함하므로
(`package.json:39`) **진짜 차단 요인이 맞았다.**

## 남은 정직한 미검증

Windows 네이티브 filesystem/symlink 동작. macOS에서 `path.win32`로 경로 정규화 계약은
재현했지만 네이티브 실행은 아니다. 릴리스를 막지 않으므로 릴리스 완료를 보류할 이유는
없으며, 다음 예약 CI가 증거를 준다.

