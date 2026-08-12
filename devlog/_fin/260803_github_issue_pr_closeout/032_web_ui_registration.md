# 032 — WP5: Web UI 등록 (F1) + CLI edit allowlist

대응 work-phase: `wp5` / 대응 기준: `g-ui`

## 디자인 판단 (cxc-dev-uiux-design)

### Design Read

```yaml
---
name: ima2-gen — MiniMax provider 등록
surface: 기존 설정/사이드바 표면에 provider 한 줄 추가
---
```

이건 새 화면을 만드는 일이 아니라 **기존 provider 목록에 한 항목을 더하는 일**이다.
`grok`, `gemini-api`, `atlascloud`가 이미 같은 자리에 같은 모양으로 앉아 있고,
그 패턴이 지배적인 디자인 시스템이다.

**Concept generation 건너뜀 (UX-CONCEPT-GEN-01).** 이 스킬은 "governing design
system이 있으면 새 브랜드 가시 구성이 남지 않는 한 생성을 건너뛴다"고 규정한다.
여기서 결정할 시각적 선택지가 없다 — provider 칩 하나, 모델 두 줄, 키 입력 한 칸이
전부이고 각각의 형태는 이미 코드에 정해져 있다. 새 디자인 언어를 도입하는 것이
오히려 일관성을 깨는 회귀다.

### Dial Setting

```
DESIGN_VARIANCE: 2   (기존 시스템 준수, 새 시각 요소 0)
MOTION_INTENSITY: 1  (모션 추가 없음)
Product density profile: D4 (SaaS 설정 화면)
Reasoning: 지배적 디자인 시스템에 항목 하나를 추가하는 작업이므로
변주 여지가 없고, 있어서도 안 된다.
```

### 준수 사항

- 라벨은 기존 표기 체계를 따른다. `atlascloud`가 picker에서 `Atlas`, 설정에서
  `Atlas Cloud`, 메타데이터에서 `Atlas Cloud API`인 것처럼 minimax도
  picker `MiniMax`, 설정 `MiniMax`, 메타데이터 `MiniMax API`로 맞춘다.
- 모델 shortLabel은 기존 관례(`atlas`, `atlas edit`, `nb2 api`)를 따라
  소문자 축약형: `minimax`, `minimax live`.
- 이모지를 UI 요소로 쓰지 않는다.
- 새 색상·아이콘·간격 토큰을 만들지 않는다.

## 스코프

IN — `ui/src/**` 등록 지점 9곳 + i18n 2개 + CLI 1곳

OUT — 새 컴포넌트, 레이아웃 변경, 다른 provider 표기 수정

## 변경 맵

### 1. `ui/src/types.ts`

```diff
-export type Provider = "oauth" | "api" | "grok" | "grok-api" | "agy" | "gemini-api" | "atlascloud";
+export type Provider = "oauth" | "api" | "grok" | "grok-api" | "agy" | "gemini-api" | "atlascloud" | "minimax";
```

```diff
 export type AtlasCloudImageModel = "openai/gpt-image-2/text-to-image" | "openai/gpt-image-2/edit";
-export type ImageModel = OpenAIImageModel | GrokImageModel | GeminiImageModel | AtlasCloudImageModel;
+export type MinimaxImageModel = "image-01" | "image-01-live";
+export type ImageModel = OpenAIImageModel | GrokImageModel | GeminiImageModel | AtlasCloudImageModel | MinimaxImageModel;
```

### 2. `ui/src/lib/imageModels.ts`

`IMAGE_MODEL_OPTIONS` 배열 끝(atlascloud 두 줄 다음)에 추가:

```ts
{ value: "image-01", shortLabel: "minimax", fullLabelKey: "settings.imageModel.minimaxImage01", providerHint: "minimax" },
{ value: "image-01-live", shortLabel: "minimax live", fullLabelKey: "settings.imageModel.minimaxImage01Live", providerHint: "minimax" },
```

값 집합과 파생 목록:

```ts
const MINIMAX_MODEL_VALUES = new Set<string>(["image-01", "image-01-live"]);
export const MINIMAX_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter(
  (option) => option.providerHint === "minimax",
);
export function isMinimaxImageModel(value: unknown): boolean {
  return typeof value === "string" && MINIMAX_MODEL_VALUES.has(value);
}
```

`getImageModelOptionsForProvider`에 분기 추가:

```diff
   if (provider === "atlascloud") return ATLASCLOUD_IMAGE_MODEL_OPTIONS;
+  if (provider === "minimax") return MINIMAX_IMAGE_MODEL_OPTIONS;
```

`getImageModelShortLabel`에도 atlascloud와 같은 형태로 분기를 추가한다.

주의: `OPENAI_IMAGE_MODEL_OPTIONS`가 `providerHint` 없는 항목만 거르는지 확인하고,
minimax 항목이 OpenAI 목록에 새어 들어가지 않게 한다. B 단계에서 필터 조건을 읽고
맞춘다.

### 3. `ui/src/lib/referenceLimits.ts`

MiniMax는 subject reference를 1개만 받는다(어댑터가 `MINIMAX_REF_TOO_MANY`로 거부).
서버 400 대신 attach 시점에 막는 것이 이 파일의 목적이다.

```diff
 export const GROK_FAMILY_IMAGE_REF_LIMIT = 3;
+export const MINIMAX_IMAGE_REF_LIMIT = 1;
```

```diff
 export function effectiveReferenceLimit(input: {...}): number {
   if (input.mcpProvider) return MCP_REFERENCE_LIMIT;
   if (input.videoModelSelected) return Math.min(input.serverLimit, GROK_VIDEO_REF_LIMIT);
+  if (input.provider === "minimax") {
+    return Math.min(input.serverLimit, MINIMAX_IMAGE_REF_LIMIT);
+  }
   if (LIMITED_IMAGE_PROVIDERS.has(input.provider)) {
```

파일 상단 주석 목록에도 `lib/minimaxImageAdapter.ts: subject_reference <= 1` 줄을
추가한다. 그 주석이 각 상한의 출처를 기록하는 자리다.

### 4. `ui/src/components/GenProviderModelSelect.tsx`

```diff
   { value: "atlascloud", label: "Atlas" },
+  { value: "minimax", label: "MiniMax" },
```

### 5. `ui/src/hooks/useKeyStatus.ts`

```diff
-export type KeyStatus = Record<"openai" | "xai" | "gemini" | "atlascloud" | "vertex", KeyStatusEntry> & {
+export type KeyStatus = Record<"openai" | "xai" | "gemini" | "atlascloud" | "minimax" | "vertex", KeyStatusEntry> & {
```

### 6. `ui/src/hooks/useProviderAvailability.ts`

```diff
   const atlasCloudKeyOk = keyStatus?.atlascloud?.valid === true;
+  const minimaxKeyOk = keyStatus?.minimax?.valid === true;
```

```diff
     atlascloud: {
       ok: atlasCloudKeyOk,
       reason: atlasCloudKeyOk ? "" : t("provider.atlasCloudApiKeyRequired"),
     },
+    minimax: {
+      ok: minimaxKeyOk,
+      reason: minimaxKeyOk ? "" : t("provider.minimaxApiKeyRequired"),
+    },
```

### 7. `ui/src/components/ApiKeyInput.tsx`

```diff
-  provider: "openai" | "xai" | "gemini" | "atlascloud";
+  provider: "openai" | "xai" | "gemini" | "atlascloud" | "minimax";
```

### 8. `ui/src/components/AccountSettings.tsx`

atlascloud 블록 바로 다음에 같은 형태로 추가:

```tsx
<ApiKeyInput
  provider="minimax"
  label={t("settings.apiKeys.minimax.label")}
  placeholder={t("settings.apiKeys.minimax.placeholder")}
  maskedKey={keyStatus.minimax?.maskedKey ?? null}
  source={keyStatus.minimax?.source ?? "none"}
  configured={keyStatus.minimax?.configured ?? false}
  onSaved={mutateKeys}
/>
```

### 9. `ui/src/store/storePersistence.ts`

```diff
-  return value === "oauth" || ... || value === "atlascloud";
+  return value === "oauth" || ... || value === "atlascloud" || value === "minimax";
```

### 10. `ui/src/store/storeSettingsImpl.ts`, `storeHelpers.ts`

A 단계에서 "같게 처리"의 구체 내용을 확정했다. 다섯 가지다:

| # | 지점 | 필요한 동작 |
|---|------|-------------|
| 1 | `storeSettingsImpl.ts` import | `isMinimaxImageModel`을 가져온다 |
| 2 | provider → model 보정 | provider가 `minimax`인데 현재 모델이 MiniMax 모델이 아니면 `image-01`로 맞춘다 |
| 3 | provider 이탈 보정 | MiniMax 모델을 든 채 core provider(oauth/api)로 가면 GPT 기본 모델로 복원한다 |
| 4 | 모델 → provider 전환 | MiniMax 모델을 고르면 provider를 `minimax`로 바꾸고 `saveGenerationDefaultsPatch`를 호출한다 |
| 5 | core 모델 선택 시 복원 | core 이미지 모델을 고르면 `minimax` provider를 `oauth`로 되돌린다 |

`storeHelpers.ts:345`에서는 custom-size 확인을 건너뛰는 provider 목록에 `minimax`를
추가한다. atlascloud와 같은 취급이다.

각 항목을 개별 테스트로 고정한다. "atlascloud와 같게"라는 서술만으로는 누락을
잡을 수 없다.

### 11. `ui/src/components/ResultMetadataModal.tsx`, `home/HomePromptComposer.tsx`

provider 표시 라벨 맵에 추가:

```diff
   atlascloud: "Atlas Cloud API",
+  minimax: "MiniMax API",
```

```diff
   atlascloud: "Atlas Cloud",
+  minimax: "MiniMax",
```

### 12. `ui/src/components/settings/ProviderStatusSelect.tsx`

```diff
   { value: "atlascloud", provider: "Atlas Cloud", method: "API" },
+  { value: "minimax", provider: "MiniMax", method: "API" },
```

### 13. i18n (`ui/src/i18n/en.json`, `ko.json`)

| 키 | en | ko |
|----|----|----|
| `provider.minimaxApiKeyRequired` | `MiniMax API key required` | `MiniMax API 키가 필요합니다` |
| `settings.imageModel.minimaxImage01` | `MiniMax image-01` | `MiniMax image-01` |
| `settings.imageModel.minimaxImage01Live` | `MiniMax image-01-live` | `MiniMax image-01-live` |
| `settings.apiKeys.minimax.label` | `MiniMax` | `MiniMax` |
| `settings.apiKeys.minimax.placeholder` | `Paste your MiniMax API key` | `MiniMax API 키를 붙여넣으세요` |

모델명은 제품 식별자이므로 번역하지 않는다. atlascloud도 같은 방식이다.

### 13-1. i18n 계약 registry 갱신

`tests/i18n-dictionary-contract.test.ts:65` 근처의 동적 모델-키 registry 두 곳이
MiniMax 키를 모른다. 현재 테스트는 미사용 사전 키를 검사하지 않아 **실패하지 않는
false negative**다. 즉 그냥 두면 조용히 커버리지 구멍이 남는다. 두 registry에
MiniMax 모델 키를 등록한다.

`tests/reference-limits.test.ts:8`도 provider별 상한을 고정하므로 MiniMax 1-reference
케이스를 추가한다.

### 14. `bin/commands/edit.ts` — 모델 allowlist

PR은 provider만 추가하고 모델 allowlist를 갱신하지 않아 실행이 거부된다:

```
$ node bin/ima2.js edit fake.png --prompt x --provider minimax --model image-01-live
✗ --model must be one of: ... nano-banana-pro
exit 2
```

`origin/pr-118:bin/commands/edit.ts:13-14,48-50,69-74`를 읽고 allowlist 배열에
`image-01`, `image-01-live`를 추가한다.

### 15. 스코프 밖 명시 — Agent / Node 분기 선택기

`ui/src/components/node-canvas/NodeBranchDialog.tsx:19`와
`ui/src/components/agent/agentTypes.ts:22`는 provider union이 좁다
(oauth/api/grok/gemini-api). **atlascloud도 여기에 없다.** 기존의 의도적 제한으로
보이므로 MiniMax도 넣지 않는다. Atlas와 동등한 수준까지만 등록하는 것이 이번 스코프다.

이 결정을 명시적으로 기록해 둔다. 나중에 "왜 빠졌지?"가 되지 않도록.

### 16. F9 오류 코드를 UI 레지스트리에 등록 (A-phase 라운드 2 blocker)

`031`의 F9는 `MINIMAX_MODEL_REQUIRES_REFERENCE`로 "reference를 붙이거나 image-01로
바꾸라"는 안내를 던진다. 그런데 그 코드가 UI 레지스트리에 없으면 안내가 사라진다:

- SSE 계층은 code와 message를 보존한다 (`ui/src/lib/sseStreamError.ts:10`).
- 하지만 `ui/src/lib/errorCodes.ts:5`의 `ImaErrorCode` union과 `errorCodes` 레지스트리
  (`:52-83`)에 없는 코드는 `resolveErrorSpec()`이 `UNKNOWN`으로 접는다 (`:167-176`).
- `UNKNOWN`의 `toast.generateFailed`가 서버 메시지를 덮는다
  (`ui/src/lib/errorHandler.ts:14`).
- classic·multimode 모두 이 중앙 핸들러를 탄다 (`ui/src/store/storeGenImpl.ts:399`, `:209-235`).

결과적으로 사용자는 "Generation failed"만 본다. F9가 없애려던 "원인 모를 실패"가
그대로 남는다. 서버에서 좋은 메시지를 만들어도 UI가 버리면 의미가 없다.

#### 변경

`ui/src/lib/errorCodes.ts`:

```diff
 export type ImaErrorCode =
   | "REF_TOO_LARGE"
   ...
+  | "MINIMAX_MODEL_REQUIRES_REFERENCE"
```

```diff
 export const errorCodes: Record<ImaErrorCode, ErrorSpec> = {
   ...
+  MINIMAX_MODEL_REQUIRES_REFERENCE: {
+    surface: "toast",
+    toastKey: "toast.minimaxModelRequiresReference",
+  },
```

`toast`를 쓰는 이유: 사용자가 즉시 고칠 수 있는 입력 문제다. `REF_TOO_MANY`가
같은 성격이고 toast로 처리된다. 카드는 재시도/재인증처럼 흐름이 끊기는 오류의 자리다.

i18n 추가:

| 키 | en | ko |
|----|----|----|
| `toast.minimaxModelRequiresReference` | `image-01-live needs a reference image outside China. Attach one or switch to image-01.` | `image-01-live는 중국 리전 밖에서 참조 이미지가 필요합니다. 참조를 추가하거나 image-01로 바꾸세요.` |

#### 테스트

`parseSseErrorPayload → resolveErrorSpec → handleError` 경계를 통과시켜, 이 코드가
`UNKNOWN`으로 접히지 않고 전용 문구가 나오는지 고정한다. 단순히 레지스트리에
키가 있는지 검사하는 정적 테스트로는 부족하다 — 실제 해석 경로를 태운다.

## 활성화 증거 (C-ACTIVATION-GROUNDING-01)

정적 diff로는 "등록됐다"를 증명할 수 없다. WP1과 같은 격리 서버 + agbrowse 절차를 쓴다.

절차는 `010_phase1_select_scroll_guard.md`의 실행 경계 절을 그대로 따른다:
UI 선빌드 → 격리 환경변수로 `node server.js` → 관측 → teardown.
모든 관측은 `evaluate(발생)` → `wait` → `evaluate(읽기)` 3단계로 나눈다.

| 관측 | 방법 | 기대 |
|------|------|------|
| provider picker에 MiniMax | `#sidebar-generation-provider` 열고 옵션 텍스트 수집 | `MiniMax` 포함 |
| provider 선택 가능 | MiniMax 옵션 클릭 후 트리거 라벨 읽기 | `MiniMax` |
| 모델 목록 전환 | `#sidebar-generation-model` 열고 옵션 수집 | `image-01`, `image-01-live` |
| 설정에 키 입력칸 | 설정 → providers 섹션에서 MiniMax 라벨 탐색 | 입력 요소 존재 |

키 없이도 목록에 나타나되 사용 불가 사유가 뜨는 것이 기존 provider 동작이므로,
`ok:false` + reason 문구가 함께 보이는지도 확인한다.

## 검증

```
npm run typecheck
npm --prefix ui run build
node --import tsx --test tests/models-endpoint-contract.test.ts
node bin/ima2.js edit --help
```

UI 계약 테스트(`tests/mcp-provider-ui-contract.test.js` 등)가 provider 목록을 정규식으로
고정하고 있을 수 있다. B 단계에서 전체 테스트를 돌려 확인하고, 걸리면 계약의 의도를
판단해 갱신한다.

A 단계 확인 결과, MiniMax 추가로 즉시 깨지는 provider 정규식 테스트는 없다. CLI 고정
목록 테스트(`cli-feature-parity-contract`, `cli-capabilities-contract`,
`models-endpoint-contract`)는 PR 커밋이 이미 MiniMax까지 갱신해 두었다. 실제로 손봐야
할 것은 위 13-1의 i18n registry와 reference-limits다.
