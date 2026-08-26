---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase6]
---

# 060 — wp6 마무리: 문서 · SoT · 전체 게이트 · dev 머지

의존: 040 + 050 둘 다.

## 1. 문서 (게이트가 감시함)

| 파일 | 내용 | 감시 테스트 |
|---|---|---|
| `docs/API.md` | comfy 신규 6개(workflows GET/POST/DELETE, bind, inspect, probe) + 기존 export-image | `api-docs-contract` |
| `docs/CLI.md` | workflow 서브커맨드 + `--provider comfy` | `cli-feature-parity-contract` |

두 계약 테스트가 라우트/CLI 표면과 문서의 드리프트를 잡는다. 문서 갱신은
선택이 아니다.

## 2. SoT 패치 (SOT-SYNC-01)

| 파일 | 내용 |
|---|---|
| `structure/00-structure-hub.md` | 스냅샷 노트 + provider 목록 |
| `structure/01-file-function-map.md` | 신규 lib/route 파일 + 줄 수 |
| `structure/03-server-api.md` | comfy 라우트 계약 |
| `structure/04-frontend-architecture.md` | 워크플로 관리자 |

`npm run docs:refresh-line-counts`가 01의 줄 수를 갱신한다.
`tests/structure-line-counts-contract.test.js`가 `--check`로 감시한다.

## 3. 전체 게이트 — 실행하고 출력을 남긴다

    npm run typecheck
    npm run typecheck:tests
    npm test
    npm run test:inventory
    node scripts/generate-provider-types.mjs --check
    node scripts/refresh-structure-line-counts.mjs --check
    cd ui && npm run build

각각 exit code를 캡처한다. **하나라도 0이 아니면 wp6은 끝나지 않는다.**

000의 bypass 분석대로 이 게이트들은 CI(E2)에 걸려 있고 로컬 커밋은 CI를
거치지 않는다. push하지 않으므로 **여기서 손으로 돌리는 것이 유일한 실행
기회**다.

## 4. dev 머지

작업은 `codex/comfy-provider-lane` 브랜치에서 진행하고 dev로 머지한다.

    git checkout -b codex/comfy-provider-lane   # wp1 시작 시
    ... wp1~wp5 각 단계마다 원자적 커밋 (DEV-GIT-COMMIT-01)
    git checkout dev
    git merge --no-ff codex/comfy-provider-lane

**push하지 않는다.** 사용자 요청은 "dev에 머지"까지다. 원격 반영은 별도
승인 사항이다(DEV-GIT-PUSH-01).

### 사용자 dirty 파일 보존

`docs/grok-video-i2v-research.md`는 사용자 소유의 미커밋 변경이다.
**커밋하지 않고 건드리지 않는다.** 매 커밋 전 `git status`로 확인하고,
최종 `git diff --stat`에 이 파일이 없음을 증거로 남긴다.

## 5. 유닛 정리

`090_outcome.md`를 쓴다: 달성/미달성, 실기 검증 등급, 남은 위험, 다음 결정.

특히 명시할 것:
- 다중 인스턴스 시나리오의 검증 등급(2차 근거에 머물렀는지)
- TTL 상호작용 조사 결과와 처분
- WS 진행률/마스크 인페인팅 등 후속 유닛으로 미룬 항목

## Accept criteria

1. 7개 게이트 전부 exit 0, 출력 캡처.
2. 문서 2개 + SoT 4개 갱신, 계약 테스트 통과.
3. `git log dev`에 머지 커밋, `git diff --stat`에 사용자 dirty 파일 없음.
4. 원격 ref 생성 없음 — `git log origin/dev..dev`가 로컬 전용임을 보인다.
5. 090 작성 완료.
