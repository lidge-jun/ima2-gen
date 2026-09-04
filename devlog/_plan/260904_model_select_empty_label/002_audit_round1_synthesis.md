# 감사 1라운드 종합 (002)

리뷰어 판정: **FAIL** (blocker 5개: High 3, Medium 1, Low 1).
판정을 수용한다. 계획 000은 버그 수정 범위를 넘어섰다.

## 근본 원인 분석 — 왜 계획이 넘쳤나

계획 000은 두 개의 서로 다른 문제를 하나로 묶었다.

- **A: 실제 버그** — comfyVideoWorkflow가 레인을 넘어 모델 표시 값을 가로챈다.
- **B: 버그가 아닌 것** — comfy 이미지 워크플로 id가 imageModel에 담긴다.

B를 "오염"이라 부른 것이 오판이었다. 리뷰어 blocker 2를 따라 서버 계약을 직접 읽었다:

`lib/providerOptions.ts:75-97`

```ts
if (provider === "comfy") {
  const comfyCheck = normalizeComfyWorkflowModel(rawModel);
  ...
  return { provider: "comfy" as const, model: comfyCheck.model, ... };
}
```

`lib/comfyImageAdapter.ts:74` — `/** Workflow id. This is what "model" means in the comfy lane. */`

즉 **comfy 레인에서 model 필드는 워크플로 id가 맞다.** imageModel에 워크플로 id가
들어가는 것은 설계된 동작이고, `storeGenImpl.ts:113`이 그것을 그대로 보내는 것이 정상
경로다. 이것을 `comfyWorkflow` 필드로 옮기면 blocker 1이 열거한 소비자
(`storeReferenceImpl.ts:47-49` 메타데이터 복원, `storeNodeGenImpl.ts:147` 노드 모드,
`cardNewsStore.ts:318,378` 카드뉴스)가 전부 워크플로를 잃고 comfy 생성이 깨진다.

**결론: B는 수정 대상이 아니다.** 남는 진짜 결함은 하나뿐 — comfy 레인을 **떠날 때**
그 레인 전용 값(비디오 워크플로, 그리고 ImageModel 유니온에 없는 워크플로 id)이
정리되지 않는다는 것.

## Blocker별 처분

| # | 심각도 | 처분 | 근거 |
|---|---|---|---|
| 1 | High | **접음(fold) — 원인 제거** | `comfyWorkflow` 필드 이관을 계획에서 완전히 삭제. 필드 체인 자체가 사라지므로 누락 소비자 문제도 사라진다. `comfyWorkflow`는 지금처럼 미사용 상태로 남긴다(별개 정리 대상). |
| 2 | High | **접음 — 원인 제거** | comfy 이미지 요청 경로를 건드리지 않는다. 서버 계약(`providerOptions.ts:75-97`)은 그대로 유지된다. 대신 "comfy를 떠날 때 워크플로 id가 GPT 요청에 남지 않는다"를 값 기반 테스트로 고정한다. |
| 3 | High | **접음 — 재현 방식 변경** | 옳은 지적이었으나 좁힌 계획에서는 comfy fixture가 **불필요하다**. 버그는 순수하게 영속 상태에서 재현된다: `ima2.generationDefaults = {provider:"oauth", comfyVideoWorkflow:"..."}`, `ima2.imageModel = "gpt-5.6-luna"`. `seedBrowser`(`e2e/fixtures/appServer.ts:21-37`)에 generationDefaults 추가 필드를 주입할 수 있게 최소 확장만 하면 comfy 서버/카탈로그 없이 렌더 증거를 얻는다. |
| 4 | Medium | **접음 — 테스트 대상 정정** | 확인했다. `useAppStore.ts:167-172`와 `:549-550`이 저장값을 직접 초기 상태로 투영하며 하이드레이션은 `setProviderImpl`을 호출하지 않는다. 따라서 이탈 정리가 새로고침에서 오발할 경로는 없다. 회귀 테스트는 "명시적 사용자 전환에서만 정리된다"와 "저장된 comfy provider는 초기값으로 워크플로를 보존한다"를 각각 검증한다. |
| 5 | Low | **접음 — B 이후 갱신** | 001의 미측정 행은 B 완료 시점에 실제 출력으로 갱신한다. |

반박(rebut)한 blocker는 없다. 5개 전부 수용했다.

## 수정된 설계 (좁힌 범위)

원칙: **표시 값과 옵션 목록을 같은 출처에서 계산하고, 레인 전용 상태는 레인을 떠날 때
정리한다.** 필드 이관도, 서버 계약 변경도, 생성 경로 변경도 없다.

### 변경 1 — 표시 값을 provider로 게이트 (순수 함수 추출)

`ui/src/lib/imageModels.ts`에 순수 함수 신설:

```ts
export function resolveCoreModelValue(input: {
  provider: Provider;
  imageModel: string;
  videoModel: string | false | null | undefined;
  comfyVideoWorkflow: string | null;
}): string
```

comfy 접두 값은 `provider === "comfy"`일 때만 반환한다. `GenProviderModelSelect.tsx`의
인라인 `coreModelValue`(`:209-211`)가 이 함수를 호출한다. 순수 함수이므로
`tests/model-default-projection-contract.test.ts`와 같은 **값 기반**(패턴 2) 검증이
가능해진다 — 001이 지적한 문자열 정규식 우회 위험을 실제로 낮추는 부분.

### 변경 2 — comfy 레인 이탈 시 정리

`storeSettingsImpl.ts`의 `setProviderImpl`: comfy에서 **다른 레인으로 나갈 때**
`comfyVideoWorkflow`를 비우고, 현재 `imageModel`이 대상 레인에서 유효하지 않으면
(= ImageModel 유니온에 없는 워크플로 id이면) 그 레인의 기본 모델로 수렴시킨다.

260823 계약 유지: 정리는 **comfy → 타 레인 전환**에서만 일어난다. comfy 재선택,
comfy 유지, 하이드레이션(애초에 이 함수를 거치지 않음)은 그대로다.

## FILE SCOPE (개정)

IN:

| 파일 | 변경 |
|---|---|
| `ui/src/lib/imageModels.ts` | `resolveCoreModelValue` 순수 함수 신설 |
| `ui/src/components/GenProviderModelSelect.tsx` | 인라인 계산을 위 함수 호출로 교체 |
| `ui/src/store/storeSettingsImpl.ts` | `setProviderImpl` comfy 이탈 정리 |
| `ui/e2e/fixtures/appServer.ts` | `seedBrowser`에 generationDefaults 추가 주입 (최소) |
| `ui/e2e/j6-model-select-label.spec.ts` | 렌더 증거용 신규 e2e |
| `tests/` 회귀 계약 | 값 기반 + 소스 계약 |
| `devlog/_plan/260904_model_select_empty_label/` | 이 유닛 |

OUT (감사 결과 명시적으로 제외): `comfyWorkflow` 필드 이관, comfy 이미지 요청 경로,
`storeReferenceImpl` 메타데이터 복원, 노드 모드, 카드뉴스, 서버 라우트/어댑터,
`lib/providerOptions.ts`, 신규 테스트 런타임.

## 활성화 시나리오 (C-ACTIVATION-GROUNDING-01)

| 조건부 경로 | 트리거 | 관찰 효과 |
|---|---|---|
| `resolveCoreModelValue` provider 게이트 | provider=oauth + comfyVideoWorkflow 잔존 | 반환값이 `gpt-5.6-luna` (comfy-video: 아님) → 트리거 라벨 `5.6l` |
| comfy 이탈 정리 | provider comfy → oauth 전환 | `comfyVideoWorkflow === null` |
| imageModel 수렴 | comfy 워크플로 id 보유 상태에서 oauth 전환 | `imageModel === DEFAULT_IMAGE_MODEL` |
| comfy 보존 (회귀 방지) | comfy → comfy 재선택 | `comfyVideoWorkflow` 불변 |

## 검증기 (개정)

`npm run typecheck`는 UI를 관찰하지 않으므로 이 유닛의 게이트가 아니다(001).
실제 게이트: `cd ui && npm run build`, 값 기반 node:test, Playwright e2e 렌더 관찰.

