# 260904 모델 셀렉트 빈 라벨 — 계획 (000)

## Loop specification

- Loop archetype: spec-satisfaction (버그 수정). 단일 work-phase(wp1) HOTL 루프.
- Trigger: 사용자 스크린샷 (2026-09-04) — GPT 레인에서 imageModel이 luna인데 모델
  셀렉트 트리거 라벨이 공백. 프로바이더 트리거 "GPT"와 reasoning 트리거 "off"는 정상.
- Goal: 어떤 영속/전환 상태에서도 모델 셀렉트 트리거가 실제로 전송될 모델을 표시하고,
  레인과 무관한 모델 값이 생성 요청으로 새어 나가지 않는다.
- Non-goals: 서버 라우트/어댑터 동작 변경, 신규 모델 추가, 디자인 리뉴얼,
  jsdom 테스트 런타임 신규 도입, 릴리스/푸시.
- Verifier: `npm run typecheck`, `npm run typecheck:tests`,
  `node --experimental-strip-types --test tests/<대상>`, `npm run test:inventory`,
  `cd ui && npm run build`, 그리고 실제 브라우저 렌더 관찰(C-RENDER-GROUNDING-01).
- Stop condition: goalplan c-1..c-6이 캡처된 증거로 met.
- Memory artifact: 이 유닛 + `.codexclaw/goalplans/ima2-gen-ui-gpt-oauth-imagemodel-gpt-5-6-luna-ge/`.
- Expected terminal outcomes: DONE. 서버/외부 의존 없음이라 BLOCKED 가능성 낮음.
- Escalation: 상향 — 같은 패킷을 서로 다른 서브에이전트 둘이 실패하면 메인이 회수.
  하향 — 슬라이스를 워커에 넘기는 것은 P 단계 수정이며 B 중 즉흥 위임 금지.
- HOTL resource bounds: 쓰기 범위는 아래 FILE SCOPE. 네트워크 불필요.
  로컬 커밋 허용, push 금지(사용자 미승인).
- Authority: 사용자 요청은 "고쳐줘"까지. 릴리스/푸시 권한 없음.

## 근본 원인 (조사 증거)

병렬 조사 레인 2개(explorer, 상속 모델)를 파견해 확정했다.

### 원인 1 (주) — comfyVideoWorkflow가 레인을 넘어 모델 값을 가로챈다

`ui/src/components/GenProviderModelSelect.tsx:209-214`

```ts
const coreModelValue = comfyVideoWorkflow
  ? `${COMFY_VIDEO_PREFIX}${comfyVideoWorkflow}`
  : videoModel ? `${VIDEO_PREFIX}${videoModel}` : imageModel;
```

`comfyVideoWorkflow`가 provider보다 먼저 검사된다. 그런데
`ui/src/store/storeSettingsImpl.ts:391-412`의 `setProviderImpl`은 comfy로 **들어올 때만**
두 comfy 필드를 비우고, comfy에서 **나갈 때는** 비우지 않는다(260823이 의도적으로
"이미 comfy면 지우지 않는다"로 좁힌 결과, 나가는 경로가 비게 되었다).

따라서 comfy 비디오 워크플로를 고른 뒤 GPT로 전환하면 modelValue는
`comfy-video:<id>`로 남고, GPT 레인의 modelGroups
(`GenProviderModelSelect.tsx:349-410`)에는 그 값이 없다.
`ui/src/components/controls/Select.tsx:117,349`에서
`selected = flat.find(it => it.value === value)`가 undefined가 되고 트리거는
`triggerLabel ?? selected?.label ?? placeholder ?? ""` 의 마지막 분기로 떨어져 공백.

영속성: `storeSettingsImpl.ts:517-523`가 `saveGenerationDefaultsPatch({comfyVideoWorkflow})`로
저장하고 `storePersistence.ts:381-389` + `useAppStore.ts:549`가 복원하므로
**새로고침 후에도 재현된다.** 스크린샷 증상(GPT / off / 모델만 공백)과 정확히 일치.

### 원인 2 (동반) — comfy 이미지 워크플로 id가 imageModel을 오염시킨다

`GenProviderModelSelect.tsx:365-371`은 comfy 이미지 워크플로 행을 prefix 없이
`value: entry.id`로 만든다. `onModelChange`(`:252-275`)는 `comfy-video:`만 특수 처리하므로
comfy 이미지 워크플로 id가 `setImageModel(value)`로 흘러
`setImageModelImpl`(`storeSettingsImpl.ts:457-498`)이 그대로 `imageModel`에 쓴다.

파급: `ui/src/store/storeGenImpl.ts:113`과 `:320`이 `model: s.imageModel`을 그대로
요청 본문에 넣는다. 즉 GPT 레인으로 돌아온 뒤 생성하면 comfy 워크플로 id가 GPT
요청의 model로 전송된다. 화면은 공백 라벨, 요청은 잘못된 모델 — 조용한 오작동.

영속성: `storePersistence.ts:173-179`의 `isImageModel` 가드 덕에 새로고침은 살아남지
못한다. 그러나 새로고침 전 세션 내내 잘못된 요청을 보낸다.

### 기각한 가설

- provider/imageModel 영속 키 desync(가설 3): `loadImageModel`의 `isImageModel` 가드가
  비정상 값을 차단하므로 정상 저장 경로로는 재현 불가. 다만 방어는 추가한다.
- `videoModelSelected` 잔존(가설 4): `setProviderImpl:364-367`이 non-grok 전환 시 해제하고,
  남아 있어도 VIDEO 그룹에 대응 옵션이 있어 공백이 되지 않음.
- MCP 선택(가설 5): 미지 모델도 `:330-334`가 임시 행을 만들어 id를 라벨로 보여줌.

## 설계 결정

핵심은 "표시 값과 옵션 목록을 같은 출처에서 계산한다"이다. 두 층으로 고친다.

1. **표시 층(방어)**: `coreModelValue`를 provider로 게이트한다. comfy 접두 값은
   `provider === "comfy"`일 때만 사용한다. 이러면 상태가 어떻게 어긋나 있든 GPT 레인
   트리거가 공백이 되지 않는다.
2. **상태 층(근본)**: comfy 레인을 **떠날 때** comfy 선택을 정리하고, comfy 이미지
   워크플로가 `imageModel`을 오염시키지 못하게 전용 경로로 라우팅한다.

260823 결정과의 충돌 회피: 그 유닛이 지킨 것은 "comfy를 재선택하거나 하이드레이션할 때
사용자의 워크플로 선택을 버리지 않는다"이다. comfy → 다른 레인으로 **나가는** 전환에서
정리하는 것은 그 결정을 깨지 않는다. comfy로 되돌아오면 사용자가 다시 고르며,
새로고침 시 provider가 comfy이면 워크플로는 그대로 복원된다.

comfy 이미지 워크플로에는 `comfyWorkflow` 상태 필드가 이미 존재하지만
(`storeTypes.ts:213`, `useAppStore.ts:550`, `storePersistence.ts:384`) **쓰는 곳이 없다** —
`storeSettingsImpl.ts:399`의 주석이 언급하는 `setComfyWorkflowImpl`은 실재하지 않는다.
이번에 그 미완성 배선을 완성한다.

## FILE SCOPE

IN:

| 파일 | 변경 |
|---|---|
| `ui/src/components/GenProviderModelSelect.tsx` | `coreModelValue` provider 게이트; comfy 이미지 행에 `comfy-image:` prefix 부여; `onModelChange`에 comfy 이미지 분기 추가 |
| `ui/src/store/storeSettingsImpl.ts` | `setProviderImpl`의 comfy 이탈 시 정리; `setComfyWorkflowImpl` 신설; `setImageModelImpl`에 비정상 값 방어 |
| `ui/src/store/storeTypes.ts` | `setComfyWorkflow` 액션 시그니처 |
| `ui/src/store/useAppStore.ts` | 액션 배선 + 하이드레이션 정합성 |
| `ui/src/store/storeGenImpl.ts` | comfy 레인 이미지 요청이 `comfyWorkflow`를 model로 사용 (필요 시) |
| `tests/comfy-ui-contract.test.ts` 등 | 회귀 계약 추가 |
| `devlog/_plan/260904_model_select_empty_label/` | 이 유닛 문서 |

OUT: 서버 라우트/어댑터, 프로바이더 레지스트리, 신규 모델, 디자인 변경, i18n 신규 키
(불필요), 릴리스/푸시, jsdom 도입.

## 필드 체인 (PLAN-FIELD-CHAIN-01)

`comfyWorkflow` (기존 필드, 이번에 실사용 개시):

| 단계 | 위치 |
|---|---|
| 생성 | `GenProviderModelSelect.onModelChange` comfy-image 분기 → `setComfyWorkflow` |
| 직렬화 | `storeSettingsImpl.setComfyWorkflowImpl` → `saveGenerationDefaultsPatch({comfyWorkflow})` |
| 역직렬화 | `storePersistence.ts:384-386` (이미 존재) |
| 소비자 | `useAppStore.ts:550` 초기값, `GenProviderModelSelect` 선택 표시, `storeGenImpl` 요청 model, `setProviderImpl` 레인 이탈 정리 |

`COMFY_IMAGE_PREFIX` (신규 상수):

| 단계 | 위치 |
|---|---|
| 생성 | comfy 이미지 옵션 행 value |
| 소비 | `onModelChange` 분기, `coreModelValue` 계산 |
| N/A | 서버 전송 없음 — prefix는 UI 셀렉트 내부 인코딩이며 요청 본문에는 벗겨진 워크플로 id만 나간다 |

## 검증기 실측 (PLAN-VERIFIER-REAL-01)

B 진입 전 실제로 실행해 exit code와 "대상을 읽는가"를 기록한다. 기록은 021 문서에 남긴다.

| 검증기 | 대상을 읽는가 |
|---|---|
| `npm run typecheck` | tsconfig include에 ui/src 포함 여부를 확인 후 기록 |
| `npm run typecheck:tests` | tests/*.ts |
| `node --experimental-strip-types --test tests/comfy-ui-contract.test.ts ...` | 변경 파일을 readFileSync로 직접 읽음 |
| `cd ui && npm run build` | ui/src 전체 |
| 브라우저 렌더 | 실제 실행 화면 |

## 우회 경로 (PLAN-BYPASS-NAMED-01)

- tier: E1 (테스트 계약).
- 실행 표면: `npm test` / node:test.
- 알려진 우회: 이 저장소의 UI 계약 테스트는 소스 문자열 정규식이라, 동작을 바꾸지 않고
  문자열만 맞추면 통과한다.
- 잔여 위험: 문자열 계약은 조기 경보지 실행 보증이 아니다.
- 완화: 순수 함수(`getImageModelOptionsForProvider`, 신설 셀렉터 헬퍼)는 직접 import해
  값으로 검증하고, 최종 보증은 C 단계 실제 렌더 관찰이 맡는다.
- 최종 집행 계층: 실제 렌더 관찰 (자동 게이트 아님). 자동 집행은 `none`.

## 수락 기준

1. comfy 비디오 워크플로 선택 → GPT 전환 → 새로고침해도 모델 트리거가 `5.6l` 표시.
2. comfy 이미지 워크플로 선택이 `imageModel`을 오염시키지 않는다 (요청 model 정상).
3. comfy 레인 재선택/하이드레이션에서 워크플로 선택이 사라지지 않는다 (260823 유지).
4. 신규 회귀 테스트가 수정 전 FAIL → 수정 후 PASS (실제 출력으로 증명).
5. typecheck / typecheck:tests / 대상 테스트 / ui build 전부 exit 0.
6. 실제 브라우저에서 재현 상태를 만든 뒤 라벨이 채워지는 스크린샷을 devlog에 저장.

각 조건부 경로의 활성화 시나리오 (C-ACTIVATION-GROUNDING-01):

- provider 게이트: comfy-video 잔존 상태에서 provider를 oauth로 두고 렌더 → 트리거가
  imageModel 라벨. 관찰 효과: 공백이 아닌 `5.6l`.
- comfy 이탈 정리: comfy → oauth 전환 후 store 상태에서 `comfyVideoWorkflow === null`.
- comfy 이미지 라우팅: comfy 이미지 워크플로 선택 후 `imageModel`이 불변,
  `comfyWorkflow`가 해당 id.

## SoT 동기화 (SOT-SYNC-01)

`structure/04-ui-frontend.md` (또는 UI를 서술하는 실제 structure 문서)를 C에서 확인해
모델 셀렉트의 값 계산 규칙을 반영한다. 대상 문서는 B 착수 시 확정한다.

