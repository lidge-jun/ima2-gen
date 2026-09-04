# wp1 검증 증거 (011)

모든 출력은 이 유닛의 변경이 트리에 있는 상태에서 새로 실행한 것이다.

## 1. 회귀 테스트 FAIL → PASS (수락 기준 4)

핵심 증명. `resolveCoreModelValue`의 본문만 **옛 게이트 없는 우선순위**로 되돌리고
(export와 테스트는 그대로) 실행한 결과:

```
▶ model select value: lane gating
  ✖ ignores a comfy video workflow stranded outside the comfy lane
  ✖ ignores a stale grok video model outside the grok lanes
  ...
ℹ pass 7
ℹ fail 2

AssertionError [ERR_ASSERTION]: oauth must not display a comfy workflow
+ actual - expected

+ 'comfy-video:wf-anim-1'
- 'gpt-5.6-luna'
```

`+ 'comfy-video:wf-anim-1'`가 정확히 사용자 화면을 비웠던 값이다. GPT 레인에는 이 값을
가진 옵션 행이 없으므로 `Select`의 `selected`가 undefined가 되고 라벨이 빈 문자열이 된다.

수정을 복원한 뒤:

```
ℹ pass 9
ℹ fail 0
```

테스트는 **값 단언**이지 소스 정규식이 아니다. 001이 지적한 문자열 계약 우회
(동작을 바꾸지 않고 문자열만 맞춰 통과) 가 이 6개 케이스에는 통하지 않는다.

## 2. 게이트 실행 결과

| 명령 | exit | 비고 |
|---|---|---|
| `cd ui && npm run build` | 0 | UI 타입의 유일한 정적 게이트(001). `tsc -b` + e2e tsc + vite build |
| `npm test` | 0 | **2785 tests / 2783 pass / 0 fail / 2 skipped** |
| `npm run typecheck` | 0 | 서버 회귀 감시 (UI 미관찰) |
| `npm run typecheck:tests` | 0 | |
| `npm run test:inventory` | 0 | `classify-tests.mjs` 재생성 후 `--check` 통과 |
| `npx playwright test j6-model-select-label` | 0 | 2 passed |
| `cxc receipt test` | 0 | `.codexclaw/evidence/01a06caa-.../test-receipt.json` |

전체 스위트 첫 실행에서 1건 실패했다: `structure-line-counts-contract`가
`ui/src/lib/imageModels.ts: doc=168 actual=215` 드리프트를 잡았다. 이것은 회귀가 아니라
저장소가 문서-코드 동기화를 강제하는 게이트가 정상 작동한 것이며,
`structure/01-file-function-map.md`를 갱신해 해소했다(SOT-SYNC-01). 재실행 exit 0.

## 3. 렌더 관찰 (C-RENDER-GROUNDING-01, 수락 기준 6)

Playwright 1280x720, 실제 서버 + 실제 브라우저. 스크린샷을 **읽고** 확인했다.

- `ui/e2e-artifacts/j6-s1-gpt-label.png` — S1 표시 층.
  영속 상태에 comfyVideoWorkflow가 남은 채 GPT 레인으로 초기 렌더.
  좌상단 컨트롤 스트립: `GPT` / `5.6l off`.
  사용자 스크린샷에서 같은 자리가 공백이었다.
- `ui/e2e-artifacts/j6-s2-after-lane-exit.png` — S2 상태 층.
  provider 셀렉트를 실제로 클릭해 comfy → GPT 전환. 전환 후 라벨 `5.6l`,
  localStorage의 `comfyVideoWorkflow`/`comfyWorkflow` 모두 null.

S2가 중요한 이유(감사 R2 blocker 3): 하이드레이션은 `setProviderImpl`을 호출하지
않으므로(`useAppStore.ts:167-172, 549-550`) 초기 렌더만 검증했다면 상태층 수정이
**한 줄도 실행되지 않은 채** 통과했을 것이다. S2는 실제 클릭으로 그 경로를 태운다.

감사에서 남겨둔 미측정 잔여(“comfy provider 행이 라이브 카탈로그 없이 선택 가능한가”)는
실측으로 해소되었다: S2가 실제로 comfy에서 GPT로 전환하는 데 성공했다.

## 4. 수락 기준 대조

| # | 기준 | 증거 |
|---|---|---|
| 1 | comfy 비디오 워크플로 후 GPT 전환/재로드 시 라벨 표시 | J6-S1(재로드 상태), J6-S2(전환), 값 테스트 케이스 1 |
| 2 | desync 영속 상태에서 유효 값 수렴 | `resolveCoreModelValue` 케이스 1·2 + 이탈 정리 union 수렴 |
| 3 | comfy 워크플로 선택이 왕복에서 사라지지 않음 (260823) | `comfy-selection-persistence`/`comfy-ui-contract` 통과, 신규 테스트의 보존 케이스 |
| 4 | 잘못된 레인 모델이 요청으로 나가지 않음 | 이탈 시 `!isImageModel` → `DEFAULT_IMAGE_MODEL` 수렴 + save. `storeGenImpl`이 보내는 `imageModel`이 항상 유니온 멤버 |
| 5 | 회귀 테스트 FAIL→PASS | 위 §1 |
| 6 | 렌더 스크린샷 증거 | 위 §3 |

## 5. 범위 준수

감사에서 OUT으로 확정한 것들을 실제로 건드리지 않았다: `comfyWorkflow` 필드 이관 없음,
comfy 이미지 요청 경로 불변, `storeReferenceImpl`/노드 모드/카드뉴스/서버 라우트/
`lib/providerOptions.ts` 무변경. push/릴리스 없음.

