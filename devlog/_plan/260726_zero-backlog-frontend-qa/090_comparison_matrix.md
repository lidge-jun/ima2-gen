---
title: "090 — WP9: 프롬프트 고정 비교 매트릭스 (#80)"
lane: "260726_zero-backlog-frontend-qa"
wp: 9
created: 2026-07-26
depends_on: [WP2, WP4]
issue: 80
supersedes: ["_future/260529_issue80-batch-comparison-matrix"]
criteria: [C9]
---

# WP9 — 프롬프트 고정 비교 매트릭스 (#80)

같은 프롬프트·같은 입력 이미지로 모델/추론/품질/해상도 조합을 한 번에 생성하고
표로 비교한다. 사용자 제안 이슈다.

## 승계하는 결정 (2026-06-21 인터뷰, `_future/260529_*/02_decisions.md`)

이 결정들은 사용자와 확정된 것이므로 다시 열지 않는다.

| 항목 | 확정값 |
|---|---|
| 진입점 | **Classic Mode** 확장 (Agent Mode 아님) |
| 최대 셀 수 | **9** (3축 × 3옵션) |
| 실행 방식 | `POST /api/generate`를 N회 (Agent Queue 재사용 안 함) |
| DB 변경 | 불필요 |

16셀을 9셀로 줄인 것은 화면 문제만이 아니다. 조합 폭발은 비용 폭발이다. 사용자가
실수로 4×4×4를 고르면 64회 유료 생성이 나간다. 상한이 안전장치다.

## 현재 multimode와의 델타

`lib/multimodePipeline.ts:134-173`은 요청당 **단일** quality/model/size/reasoning을
정규화한다. 여러 장을 만들지만 전부 같은 설정이다. `MultimodeSequenceState`
(`ui/src/store/storeTypes.ts:190-200`)도 순번 기반이라 조합 축이 없다.

| 축 | 현재 | 필요 |
|---|---|---|
| 여러 장 생성 | 있음 | 있음 |
| 조합(Cartesian) | 없음 | 필요 |
| 셀별 설정 메타 | 부분 | 필요 |
| 축 라벨 표시 | 없음 | 필요 |

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/comparisonMatrix.ts` | NEW | 조합 생성 + 상한 검증 |
| `ui/src/store/generatePayload.ts` | NEW | payload 구성 추출 (공유 지점) |
| `ui/src/store/storeGenImpl.ts` | MODIFY | 추출된 payload 빌더 사용 |
| `ui/src/store/storeTypes.ts` | MODIFY | 매트릭스 상태 타입 |
| `ui/src/store/storeComparisonImpl.ts` | NEW | 매트릭스 실행 슬라이스 |
| `ui/src/components/comparison/ComparisonAxisPicker.tsx` | NEW | 축 선택 UI |
| `ui/src/components/comparison/ComparisonGrid.tsx` | NEW | 결과 격자 |
| ↳ WP4 의존 | — | `ui/src/lib/provenance.ts`, `ui/src/components/ProvenanceChip.tsx` 소비 |
| `ui/src/components/composer/PromptComposerToolbar.tsx` | MODIFY | Compare 토글 |
| `ui/src/styles/comparison.css` | NEW | 격자 스타일 |
| `ui/src/i18n/{ko,en}.json` | MODIFY | 라벨 |
| `tests/comparison-matrix-contract.test.ts` | NEW | 조합/상한 계약 |
| `tests/generate-payload-parity.test.ts` | NEW | 추출 전후 payload 동일성 |

## 실행 경로 확정 (A-감사 blocker 5 반영)

최초 계획은 "부분 실패 시 성공 셀 유지"만 말하고 **누가 셀을 실행하는지**를 적지
않았다. 그래서 기존 multimode의 partial 상태와 새 매트릭스의 셀 실패가 구분되지
않았다. 확정한다.

### 무엇을 재사용하지 않는가

`lib/multimodePipeline.ts:132-149`는 요청당 단일 `quality`/`model`/`size`와
`maxImages`를 처리한다. `lib/multimodePipeline.ts:535-544`의 partial 상태는 **한 요청 안에서 기대한 장수보다
적게 돌아온 경우**를 뜻한다. 매트릭스의 "셀 3개 실패"와는 다른 개념이다.

두 개념을 같은 상태 필드로 표현하면 UI가 어느 쪽인지 구분하지 못한다. 따라서
**매트릭스는 multimode 파이프라인을 쓰지 않는다.**

### 무엇을 재사용하는가

**`runGenerateImpl`은 재사용하지 않는다** (A-감사 round 2 blocker 3 반영).

round 1은 "`runGenerateImpl` 단일 경로를 셀마다 호출한다"고 적었는데 실제 시그니처가
그것을 불가능하게 한다:

```ts
// ui/src/store/storeGenImpl.ts:268-274
export async function runGenerateImpl(
  sizeOverride: string | undefined,
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  const s = get();
  const userPrompt = composePrompt(s.prompt, s.insertedPrompts);
```

이 함수는 **스토어 상태에서 payload를 스스로 구성한다.** 프롬프트, 프리셋, 참조
이미지, 크기를 전부 `get()`으로 읽고 받는 인자는 `sizeOverride` 하나다. 셀마다 다른
model/quality/reasoning을 넘길 구멍이 없다. 넘기려면 스토어 상태를 셀마다 갈아끼워야
하는데, 그건 경합과 UI 깜빡임을 만든다.

재사용하는 것은 한 층 아래다: **`postGenerateStream(payload, { signal })`**
(`ui/src/store/storeGenImpl.ts:332`). payload를 인자로 받는 전송 함수라 셀별 호출에
적합하다. `_future` 문서의 확정 사항("`POST /api/generate`를 N회, Agent Queue 재사용
안 함")과도 정확히 일치한다.

### 공유하는 것과 공유하지 않는 것

| 요소 | 처리 |
|---|---|
| 전송 (`postGenerateStream`) | 공유 |
| payload 기본값 구성 (프롬프트/프리셋/참조) | **추출해서 공유** |
| flight 등록, 스토어 갱신, 히스토리 반영 | 매트릭스가 별도로 소유 |

### builder 계약 확정 (A-감사 round 3 blocker 4 반영)

`runGenerateImpl` 본문은 세 구간으로 나뉜다.

| 구간 | 라인 | 성격 |
|---|---|---|
| 프롬프트·프리셋 계산 | `ui/src/store/storeGenImpl.ts:274-289` | 순수 |
| flight 등록·스토어 갱신·폴링 시작 | `ui/src/store/storeGenImpl.ts:290-304` | **부작용** |
| payload 구성 | `ui/src/store/storeGenImpl.ts:307-330` | 순수 |

부작용 구간이 가운데 끼어 있지만, 순수 구간 둘은 `flightId`를 통해서만 연결된다
(`requestId: flightId`). 따라서 `flightId`를 인자로 받으면 추출이 가능하다.

```ts
// ui/src/store/generatePayload.ts (NEW)

/** builder가 읽는 스토어 필드의 최소 집합. 전체 스토어를 받지 않는다. */
export type GeneratePayloadSource = Pick<AppState,
  | "prompt" | "insertedPrompts" | "selectedPresetIds" | "provider"
  | "quality" | "format" | "moderation" | "count" | "imageModel"
  | "reasoningEffort" | "storyboardActive" | "webSearchEnabled"
  | "promptMode" | "referenceImages" | "providerUrlReference"
>;

export type GeneratePayloadOverrides = {
  requestId: string;        // 필수 — 호출자가 생성해 넘긴다
  size: string;             // 필수 — 해석된 크기
  model?: string;
  quality?: string;
  reasoningEffort?: string;
};

export function buildGeneratePayload(
  source: GeneratePayloadSource,
  overrides: GeneratePayloadOverrides,
): GeneratePayload;
```

계약 경계 네 가지:

1. **`requestId`는 override 필수 인자다.** builder가 안에서 만들지 않는다. 단일 생성은
   `flightId`를 넘기고, 매트릭스는 **셀마다 독립적인 id**를 넘긴다. 셀들이 같은
   `requestId`를 공유하면 SSE 이벤트가 서로 섞인다.
2. **`size`도 필수다.** 현재 `s.getResolvedSize()`는 스토어 메서드라 순수 함수 밖이다.
   호출자가 해석한 값을 넘긴다.
3. **`signal`은 payload가 아니다.** `postGenerateStream(payload, { signal })`의 두 번째
   인자다. builder는 취소를 모른다.
4. **부작용은 전부 builder 밖.** flight 등록(`registerFlightAbort`), `saveInFlight`,
   `set(...)`, `startInFlightPolling`, 토스트, 히스토리 저장은 각 호출자가 소유한다.
   매트릭스는 이들을 재사용하지 않고 셀 상태를 자체 관리한다.

`compiled`(프리셋 컴파일 결과)는 builder 안에서 `selectedPresetIds`+`provider`로 다시
계산한다. `compilePresets`가 순수 함수이므로 안전하고, 호출자가 중간 산물을 넘기는
것보다 계약이 단순하다. 프롬프트 합성(`composePrompt` + 프리셋 프리픽스)도 builder가
소유한다 — 이것이 두 경로가 갈라지면 안 되는 핵심 규칙이다.

추출 리팩터가 회귀를 만들 수 있으므로 `tests/generate-payload-parity.test.ts`로 고정한다:
같은 스토어 스냅샷에서 추출 전 인라인 코드가 만들던 payload와 `buildGeneratePayload`
결과가 `requestId`를 제외하고 동일해야 한다.

### 셀 오케스트레이터

`ui/src/store/storeComparisonImpl.ts`가 소유한다.

```ts
export type ComparisonCellState = {
  cell: ComparisonCell;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  item?: GenerateItem;
  error?: { code: string; message: string };
  requestId?: string;
  controller?: AbortController;
};

export async function runComparisonMatrix(cells: ComparisonCell[], base: GenerateBasePayload) {
  // 셀별 독립 AbortController, bounded concurrency로 순차 소진
  // 한 셀의 reject가 다른 셀을 취소하지 않는다 — Promise.allSettled 시맨틱
}
```

핵심 계약 세 가지:

1. **셀 하나의 실패가 다른 셀을 중단시키지 않는다.** `Promise.all`을 쓰면 첫 reject에
   나머지가 버려진다. `allSettled` 시맨틱이어야 한다.
2. **취소는 셀별 + 전체 두 층이다.** 전체 취소는 모든 `controller.abort()`를 부른다.
   이미 완료된 셀의 결과는 유지한다.
3. **재시도는 해당 셀만 다시 실행한다.** 매트릭스 전체를 다시 돌리지 않는다.

### 실패 주입 지점

`runComparisonMatrix`가 생성 함수를 주입받게 설계한다:

```ts
export function createComparisonRunner(deps: {
  generateOne: (payload: GeneratePayload, opts: { signal: AbortSignal }) => Promise<GenerateResponse>;
}) { ... }
```

프로덕션은 `postGenerateStream`을 넘기고, 테스트는 특정 셀 인덱스에서 throw하는
가짜를 넘긴다. 이것이 blocker 5가 요구한 **명시적 실패 주입 지점**이다. 주입 구멍이
없으면 부분 실패 경로는 유료 생성을 실제로 실패시켜야만 검증할 수 있고, 그건 이
세션의 자원 경계 밖이다.

## 090-1. 조합 생성기

```ts
export const MAX_COMPARISON_CELLS = 9;

export type ComparisonAxes = {
  model?: string[];
  reasoningEffort?: string[];
  quality?: string[];
  size?: string[];
};

export type ComparisonCell = {
  index: number;
  model?: string;
  reasoningEffort?: string;
  quality?: string;
  size?: string;
};

export function buildComparisonCells(
  axes: ComparisonAxes,
): { cells: ComparisonCell[] } | { error: string; code: string; wouldBe: number };
```

상한 초과 시 **잘라내지 않고 오류를 낸다**. 9개만 조용히 생성하면 사용자는 어떤
조합이 빠졌는지 모른다. `wouldBe`로 실제 조합 수를 알려 축을 줄이게 한다.

조합 순서는 결정적이어야 한다(axes 키 순서 고정). 같은 선택이 매번 같은 격자를
낳지 않으면 비교 자체가 무의미하다.

## 090-2. 실행 — 동시성 제한

9개를 동시에 던지지 않는다. 이유가 두 가지다.

- 브라우저 연결 한도. SSE 멀티플렉싱 아키텍처를 쓰는 이유가 이것이다
  (`AGENTS.md`의 "병렬 생성 최대 12건, 브라우저 연결 포화 없음").
- provider rate limit. 9개 동시 요청은 429를 부른다.

기존 병렬 생성 경로가 이미 bounded concurrency를 갖고 있으므로 그것을 재사용한다.
새 동시성 관리자를 만들지 않는다.

**부분 실패 처리.** 9개 중 3개가 실패해도 나머지 6개는 보여준다. 셀 단위로
`pending | running | done | error` 상태를 갖고, 실패 셀은 오류 코드와 재시도 버튼을
표시한다. 전체를 실패로 처리하면 성공한 생성 비용이 버려진다.

**취소.** 매트릭스 전체 취소가 필요하다. 사용자가 잘못된 조합을 시작했을 때
9번 개별 취소를 누르게 하면 안 된다.

## 090-3. 축 선택 UI

```
[Compare] 토글
  ├─ 모델      [ ] GPT-5.5  [ ] Grok  [ ] Gemini
  ├─ 추론      [ ] off  [ ] low  [ ] medium
  ├─ 품질      [ ] low  [ ] medium  [ ] high
  └─ 해상도    [ ] 1K  [ ] 2K
     → "6개 조합 생성"  (실시간 개수 표시)
```

접근성(WP1 계약 승계):

- 각 축은 `<fieldset>` + `<legend>`. 체크박스 그룹의 의미를 스크린리더에 전달한다.
- 조합 개수는 `aria-live="polite"`로 변경을 알린다. 체크할 때마다 개수가 바뀌는데
  시각적으로만 보이면 스크린리더 사용자는 9개 상한에 걸린 이유를 모른다.
- 상한 초과 시 생성 버튼을 `disabled`로만 두지 않는다 — 이유를 텍스트로 쓴다.
  비활성 버튼만 있으면 왜 안 되는지 알 수 없다.

**모델 축은 provider 호환성 검증이 필요하다.** 모델마다 지원하는 quality/size가
다르다(`resolveProviderOptions` 참조). 지원 안 되는 조합은 축 선택 단계에서
비활성화하거나, 최소한 생성 전에 경고한다. 9개를 던지고 5개가 400으로 실패하는 건
나쁜 UX다.

## 090-4. 결과 격자

```tsx
<div className="comparison-grid" role="table" aria-label={t("comparison.resultsLabel")}>
```

격자는 진짜 표다 — 행과 열이 의미를 갖는다. `role="table"`/`row`/`cell`을 쓰고,
각 셀에 조합 라벨을 텍스트로 둔다. 이미지만 있고 라벨이 툴팁에만 있으면 비교가 불가능하다.

각 셀은 WP4의 `ProvenanceChip`을 재사용한다. 매트릭스 전용 배지를 새로 만들지 않는다.

### provenance 표시 계약 (A-감사 round 2 blocker 5 반영)

round 1은 "`ProvenanceChip`을 재사용한다"고만 적고 데이터 경로를 명시하지 않아
WP9→WP4 의존이 코드 수준에서 드러나지 않았다. 확정한다.

**표시한다.** 이유가 명확하다 — 매트릭스는 조합을 비교하는 화면인데, 셀의 조합 라벨은
*요청한* 값이고 provenance는 *실제 응답의* 값이다. 둘이 다를 수 있다. provider가
요청한 모델을 대체하거나 quality를 낮춰 처리하면, 요청 라벨만 보고 비교하는 것은
잘못된 결론을 낳는다.

`ComparisonGrid.tsx`의 확정 경로는 `ui/src/components/comparison/ComparisonGrid.tsx`다.
그 위치 기준 상대 경로는 다음과 같다.

```ts
// ui/src/components/comparison/ComparisonGrid.tsx
import { buildProvenanceView } from "../../lib/provenance";      // → ui/src/lib/provenance.ts
import { ProvenanceChip } from "../ProvenanceChip";              // → ui/src/components/ProvenanceChip.tsx

{state.item && <ProvenanceChip view={buildProvenanceView(state.item)} size="sm" />}
```

`comparison/`에서 `../`는 `ui/src/components/`, `../../`는 `ui/src/`다. 따라서 위 두
경로는 각각 `ui/src/components/ProvenanceChip.tsx`와 `ui/src/lib/provenance.ts`를 정확히
가리킨다. 테스트도 같은 모듈 경로를 쓴다.

`ComparisonCellState`에 provenance 필드를 따로 두지 않는다. `item: GenerateItem`이
이미 `model`/`provider`/`videoContinuity`를 담고 있어 파생 상태를 중복 저장하면
동기화 문제만 생긴다. `buildProvenanceView`는 순수 함수라 렌더 시 계산해도 된다.

**요청 라벨과 실제 provenance가 다르면 셀에 시각적으로 구분해 표시한다.** 조합 라벨은
상단, provenance chip은 하단에 두고 불일치 시 chip에 경고 표시를 준다. 비교의 전제가
깨진 셀을 사용자가 알아야 한다 — 이 화면이 존재하는 이유와 직결된다.

따라서 WP9는 WP4의 `ui/src/lib/provenance.ts`와 `ui/src/components/ProvenanceChip.tsx`에
실제로 의존한다. WP4가 먼저 랜딩돼야 한다.

반응형(WP2 원칙): 3×3 격자가 390px에서 무너진다. 모바일에서는 1열 세로 스크롤 +
각 셀에 조합 라벨을 크게 표시한다. 3×3을 축소해서 우겨넣으면 이미지가 너무 작아
비교라는 목적 자체가 사라진다.

## 계약 테스트

```ts
test("builds the cartesian product deterministically", () => {
  const a = buildComparisonCells({ model: ["m1", "m2"], quality: ["low", "high"] });
  assert.equal(a.cells.length, 4);
  assert.deepEqual(a.cells, buildComparisonCells({ model: ["m1", "m2"], quality: ["low", "high"] }).cells);
});

test("rejects combinations above the cell cap instead of truncating", () => {
  const r = buildComparisonCells({ model: ["a","b","c"], quality: ["l","m","h"], size: ["1k","2k"] });
  assert.ok("error" in r);
  assert.equal(r.wouldBe, 18);
  assert.equal(r.code, "COMPARISON_CELL_LIMIT");
});

test("partial failure keeps successful cells", () => {
  const runner = createComparisonRunner({
    generateOne: async (payload) =>
      payload.model === "boom"
        ? Promise.reject(Object.assign(new Error("provider 500"), { code: "PROVIDER_ERROR" }))
        : okResponse(payload),
  });
  const states = await runner.run(cellsWithOneBoom, base);
  assert.equal(states.filter((s) => s.status === "done").length, 5);
  assert.equal(states.filter((s) => s.status === "error").length, 1);   // 분기 발화 증명
  assert.equal(states.find((s) => s.status === "error")?.error?.code, "PROVIDER_ERROR");
});

test("cancelling the matrix keeps already-finished cells", async () => {
  // 전체 취소 후 done 셀이 cancelled로 덮이지 않는지
});

test("retrying one cell does not re-run the others", async () => {
  let calls = 0;
  // 재시도 후 calls 증가분이 정확히 1인지
});
```

## Accept criteria (C9)

1. Classic Mode에서 Compare 토글로 축을 선택할 수 있다.
2. 조합 수가 실시간 표시되고 9 초과 시 명확한 이유와 함께 차단된다.
3. 셀 실행이 `postGenerateStream`을 셀마다 호출하며 bounded concurrency로 동작한다.
   `runGenerateImpl`이나 multimode partial 상태를 재사용하지 않는다. payload 구성은
   `buildGeneratePayload`를 두 경로가 공유하고, 추출 전후 동일성이 테스트로 고정된다.
4. **부분 실패 활성화 증거**: 셀 하나를 강제 실패시켜 나머지가 살아있고 재시도가
   해당 셀만 재실행하는 것을 주입된 생성 함수로 관찰한다.
5. 격자가 `role="table"`로 노출되고 셀마다 조합 라벨이 텍스트로 있다.
   완료 셀은 `ProvenanceChip`으로 실제 응답 provenance를 함께 보여주며, 요청 조합과
   불일치하면 시각적으로 구분된다.
6. **렌더 근거(STRICT)**: 390/1440에서 격자를 실제 렌더해 스크린샷 관찰·저장.
7. 전 게이트 green.

## 범위 경계

IN: 조합 생성기, Classic Mode 축 선택, 결과 격자, 부분 실패/취소, 계약 테스트.
OUT: Agent Mode 진입점, Agent Queue 연동, DB 스키마 변경, 조합 프리셋 저장,
매트릭스 결과 일괄 export, 프롬프트 variant 축.
