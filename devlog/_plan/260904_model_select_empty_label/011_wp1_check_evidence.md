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

---

## 6. 최종 검증 감사 (독립 리뷰어, 커밋 30190da8 대상)

계획 감사와 다른 **새 리뷰어**를 붙여 실제 구현을 감사했다.
판정: **GO-WITH-FIXES (blockers=1)**.

### 리뷰어가 독립 확인해준 것 (blocker 없음)

- **전환 순서 버그 없음.** 새 이탈 분기가 `imageModel`을 쓴 뒤 아래 분기들이 stale한
  `currentModel` 변수로 판단하지만, 최종 `(provider, imageModel)`은 모든 레인에서 정확.
  나도 독립적으로 실행 확인했다(아래 §7).
- 다중 `set()` 호출은 zustand 동기 merge라 중간 상태가 렌더에 노출되지 않음.
- J6-S2가 실제로 provider 메뉴를 열고 GPT 옵션을 클릭하므로 `setProviderImpl`을 태움.
- 260823 comfy 계약 유지.
- MCP 분기는 미지 모델에 임시 행을 만들어 이미 안전.

### Blocker 1 (High) — 레인 게이트만으로는 부족하다 → 접음

리뷰어 지적: resolver가 **레인만** 검사하고 실제 옵션 집합 **멤버십**은 검사하지 않는다.
따라서 커밋 메시지의 "현재 레인이 제시하는 값만 반환한다"는 주장이 완전히는 성립하지 않는다.

실행으로 검증했다(추론이 아니라):

```
loadVideoDefaults().model for unknown id: false
normalizeVideoModelValue('stale-video-id'): false
resolver grok + stale: video:stale-video-id
resolver comfy + unknown wf: comfy-video:deleted-wf
```

판정이 갈렸다:

- **grok stale 비디오 id**: 도달 불가. `normalizeVideoModelValue`가 영속 경계에서
  `false`로 걸러낸다. 리뷰어의 이 예시는 실제로는 재현되지 않는다.
- **comfy 삭제된 워크플로**: **도달 가능**. `comfyVideoWorkflow`는 멤버십 검사 없이
  원문 저장된다(`storePersistence.ts:387-389`). 사용자가 워크플로를 지우거나 서버가
  이번 세션에 등록하지 않았으면 값은 남고 행은 사라진다 → 같은 빈 라벨.

즉 blocker는 **부분적으로 실재**하고, 실재하는 절반은 고칠 가치가 있다. 레인 게이트는
"다른 레인의 값"을 막지만 "이 레인의 값인데 목록에서 사라진 것"은 못 막는다.

수정: 컴포넌트가 `modelGroups`의 flat 값 집합을 만들고, `coreModelValue`가 거기 없으면
그 값을 위한 행을 앞에 추가한다. 이 파일의 MCP 분기(`:330-334`)가 이미 하는 것과
같은 원리다. 원시 id를 보여주는 것이 아무것도 안 보여주는 것보다 낫고, 선택 가능하게
남겨 사용자가 갇히지 않는다.

**렌더 관찰이 이 수정을 한 번 더 고쳤다.** 첫 구현은 `sub: t("mcp.unavailable")`를
달았는데, 스크린샷을 읽어보니 좁은 트리거에서 배지가 이름을 밀어내
`ᵥUnavailable`만 남고 워크플로 이름이 사라졌다. 문제를 설명하느라 정작 사용자가
알아야 할 사실을 가린 셈이다. 배지를 `title`(툴팁)로 옮겨 이름에 공간을 주었다:
이제 `wf-delete…`로 렌더된다. 테스트는 두 경우 모두 통과했으므로,
이 결함은 **렌더를 읽지 않았으면 잡지 못했다**.

증거: `devlog/_artifacts/260904_model_select_empty_label/j6-s3-unlisted-workflow.png`,
e2e J6-S3.

## 7. 전환 순서 실행 검증 (독립)

리뷰어 항목 2를 추론이 아니라 실행으로 확인했다. `setProviderImpl`을 esbuild로 번들해
(store 모듈은 `import.meta.env` 때문에 Node에서 맨 import 불가) localStorage 셰임 위에서
직접 호출했다:

```
comfy(stranded wf) -> oauth:      provider=oauth      imageModel=gpt-5.6-luna                   cw=null cvw=null
comfy(stranded wf) -> grok:       provider=grok       imageModel=grok-imagine-image-2.0         cw=null cvw=null
comfy(stranded wf) -> gemini-api: provider=gemini-api imageModel=nano-banana-pro                cw=null cvw=null
comfy(stranded wf) -> nai:        provider=nai        imageModel=nai-diffusion-5-full           cw=null cvw=null
comfy(stranded wf) -> atlascloud: provider=atlascloud imageModel=openai/gpt-image-2/text-to-image cw=null cvw=null
comfy(stranded wf) -> minimax:    provider=minimax    imageModel=image-01                       cw=null cvw=null
comfy(stranded wf) -> api:        provider=api        imageModel=gpt-5.6-luna                   cw=null cvw=null
--- 260823 preservation
comfy -> comfy:                   provider=comfy      imageModel=wf-still-1  cw=wf-still-1 cvw=wf-anim-1
--- non-comfy origin unaffected
oauth -> comfy:                   provider=comfy      imageModel=gpt-5.6-luna cw=null cvw=null
```

7개 이탈 레인 전부 올바른 최종 쌍. comfy 재선택은 워크플로 보존. 순서 버그 없음 확인.

## 8. 최종 게이트 (보강 후 재실행)

| 명령 | 결과 |
|---|---|
| `npm test` | **2786 tests / 2784 pass / 0 fail / 2 skipped**, exit 0 |
| `cd ui && npm run build` | exit 0 |
| `npm run typecheck` / `typecheck:tests` | exit 0 |
| `npx playwright test j6-model-select-label` | **3 passed** (S1/S2/S3) |
| `tests/model-select-lane-gating.test.ts` | 10/10 |

