# 감사 2라운드 종합 + 최종 구현 사양 (003)

리뷰어 판정: **GO-WITH-FIXES (blockers=3)**. 3개 전부 접었다. 반박 0건.
철회 판단(comfyWorkflow 이관 취소)과 하이드레이션 안전성은 리뷰어가 명시적으로 승인했다.

## Blocker 처분

### B1 (High) — imageModel 수렴 규칙이 모호했다 → 접음, 규칙 확정

리뷰어 증거: `storeSettingsImpl.ts:412-414`의 기존 fallback은 **알려진 타 프로바이더
모델**(grok/gemini/atlas/minimax/nai)일 때만 기본값으로 되돌린다. comfy 워크플로 id는
그 어느 술어에도 걸리지 않으므로 조건을 통과하지 못하고 그대로 남는다. 그 결과 comfy
이미지 워크플로 선택 → oauth 전환 → 생성 시 워크플로 id가 GPT 요청의 model로 나간다
(`storeGenImpl.ts:113,320`).

확정 규칙: **comfy 레인을 떠날 때, `isImageModel(currentModel)`이 거짓이면
`DEFAULT_IMAGE_MODEL`로 set + save 한다.** 술어 열거 방식이 아니라 유니온 멤버십
검사이므로 comfy 워크플로 id를 포함해 미래의 어떤 비유니온 값도 잡는다.

`isImageModel`은 이미 `ui/src/lib/imageModels.ts:80-82`에 있고
`IMAGE_MODEL_OPTIONS` 멤버십을 본다. `storeSettingsImpl.ts`는 이 모듈에서 이미
여러 술어를 import하고 있으므로 import 한 개만 추가한다.

### B2 (Medium) — videoModel도 provider 게이트가 필요하다 → 접음

리뷰어 증거: `GenProviderModelSelect.tsx:209-211`은 `videoModel`도 provider와 무관하게
우선한다. comfy 접두만 게이트하면 **stale Grok 비디오 모델**이 oauth/api 레인에 남은
경우 같은 빈 라벨이 재현된다. 계획 000이 가설 4를 "정상 경로에서는 발생하지 않는다"고
기각했던 것은 정상 경로 한정이었고, 함수 계약 차원에서는 구멍이 맞다.

확정 규칙: `resolveCoreModelValue`는 세 값 모두를 레인으로 게이트한다.

```
provider === "comfy"                      -> comfyVideoWorkflow 있으면 comfy-video:<id>
provider === "grok" || "grok-api"         -> videoModel 있으면 video:<id>
그 외                                      -> imageModel
```

이 함수는 이제 "어떤 상태 조합이 와도 현재 레인이 실제로 제시하는 값만 반환한다"는
전역 불변식을 갖는다. 표시 층 방어가 상태 층 결함과 독립적으로 성립한다.

### B3 (Medium) — e2e가 초기 렌더만 보면 상태 층이 실행되지 않는다 → 접음

리뷰어 증거: `seedBrowser`(`appServer.ts:17-37`)는 초기 localStorage만 주입하고,
하이드레이션은 `setProviderImpl`을 호출하지 않는다(`useAppStore.ts:167-172, 549-550`).
따라서 초기 렌더만 검증하면 이탈 정리 코드가 **한 줄도 실행되지 않은 채** 통과한다.

확정: e2e를 두 시나리오로 나눈다.

- **S1 (표시 층)**: comfyVideoWorkflow가 남은 oauth 영속 상태를 seed → 초기 렌더에서
  모델 트리거가 `5.6l`. 이것이 사용자 스크린샷의 직접 재현/수정 증거.
- **S2 (상태 층)**: provider 셀렉트를 실제로 클릭해 comfy → GPT 전환 → 전환 후
  localStorage의 `comfyVideoWorkflow`가 비고 `imageModel`이 유효값으로 수렴.
  실제 UI 상호작용이므로 `setProviderImpl`이 진짜로 실행된다.

S2는 provider 목록에 comfy 행이 필요하다. comfy 행은 `/api/models` 레인 카탈로그가
아니라 **라벨 맵 폴백**(`GenProviderModelSelect.tsx:281-284`: 카탈로그가 비면
`CORE_PROVIDER_OPTIONS`를 사용)으로도 렌더되므로, comfy 서버 없이도 선택 가능하다.
이것이 blocker 3의 원래 우려(comfy fixture 구축)를 우회하는 근거다. 만약 실제 실행에서
comfy 행이 disabled로 나오면, S2는 store 함수 직접 호출 값 테스트로 대체하고 그 사실을
증거 문서에 기록한다(추측 금지, 실측 후 기록).

## 최종 구현 사양

### 1. `ui/src/lib/imageModels.ts` — 신규 순수 함수

```ts
export const COMFY_VIDEO_VALUE_PREFIX = "comfy-video:";
export const VIDEO_VALUE_PREFIX = "video:";

export function resolveCoreModelValue(input: {
  provider: Provider;
  imageModel: string;
  videoModel: string | false | null;
  comfyVideoWorkflow: string | null;
}): string;
```

`videoModel` 타입은 `storeTypes.ts:530`의 `videoModelSelected: string | false`를 따른다
(리뷰어가 시그니처 수용 확인). 컴포넌트가 쓰는 접두 상수도 이 모듈로 옮겨 단일 출처로 만든다.

### 2. `ui/src/components/GenProviderModelSelect.tsx`

`:209-211` 인라인 계산을 `resolveCoreModelValue({...})` 호출로 교체.
`COMFY_VIDEO_PREFIX`/`VIDEO_PREFIX` 로컬 상수는 lib에서 import해 재사용(중복 정의 제거).

### 3. `ui/src/store/storeSettingsImpl.ts` — `setProviderImpl` comfy 이탈 분기

기존 comfy 분기(`:391-412`)는 그대로 두고, **comfy에서 나가는** 경우를 처리한다.
`get().provider === "comfy" && provider !== "comfy"`일 때:
`comfyVideoWorkflow: null`, `comfyWorkflow: null`, 그리고
`!isImageModel(currentModel)`이면 `imageModel: DEFAULT_IMAGE_MODEL` + `saveImageModel`.
`saveGenerationDefaultsPatch`로 영속화한다.

260823 계약 유지 근거(리뷰어 확인): comfy→comfy 재선택은 `:410` 조건이 그대로 보존하고,
하이드레이션은 이 함수를 거치지 않는다.

### 4. 테스트

- **값 기반**(패턴 2, 우회 불가): `resolveCoreModelValue`를 직접 import해
  레인×상태 조합 매트릭스 검증. B1/B2 활성화 시나리오 포함.
- **소스 계약**(패턴 1): `setProviderImpl`의 이탈 정리와 260823 보존 조건 공존 검증.
- **e2e**: S1/S2.

## 활성화 시나리오 최종 (C-ACTIVATION-GROUNDING-01)

| # | 경로 | 트리거 | 관찰 효과 |
|---|---|---|---|
| 1 | comfy 접두 게이트 | provider=oauth + comfyVideoWorkflow="wf-1" | 반환 `gpt-5.6-luna`; 렌더 라벨 `5.6l` |
| 2 | video 접두 게이트 (B2) | provider=oauth + videoModel="grok-imagine-video-1.5" | 반환 `gpt-5.6-luna` |
| 3 | comfy 레인 유지 | provider=comfy + comfyVideoWorkflow="wf-1" | 반환 `comfy-video:wf-1` |
| 4 | grok 레인 유지 | provider=grok + videoModel 설정 | 반환 `video:...` |
| 5 | 이탈 정리 (B1) | comfy → oauth 전환 | `comfyVideoWorkflow===null` |
| 6 | 수렴 (B1) | comfy 워크플로 id 보유 → oauth 전환 | `imageModel===DEFAULT_IMAGE_MODEL` |
| 7 | 보존 (260823 회귀) | comfy → comfy 재선택 | `comfyVideoWorkflow` 불변 |

## 검증기

게이트: `cd ui && npm run build` (UI 타입의 유일한 정적 게이트), 값 기반 node:test,
Playwright S1/S2. `npm run typecheck`는 UI 미관찰이므로 서버 회귀 감시용(001).

