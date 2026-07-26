# 042 — wp4 슬라이스 1: characterBindings 저장 모델 (diff-level)

상위 스펙: 040(조사 결론) + 041(amendment, 결정 1/불변식). 이 문서는 wp3-storage
work-phase의 실행 명세다. 충돌 시 041 우선.

## MODIFY `lib/assetsStore.ts`

### 1. 타입 추가 (ELEMENT_KINDS 아래)

```ts
export const CHARACTER_BINDING_PROVIDERS = ["runway", "higgsfield"] as const;
export type CharacterBindingProvider = (typeof CHARACTER_BINDING_PROVIDERS)[number];
export const CHARACTER_BINDING_MODES = ["stateless-refs", "trained-id"] as const;
export type CharacterBindingStatus = "ready" | "training" | "failed";

export type CharacterProviderBinding = {
  provider: CharacterBindingProvider;
  mode: (typeof CHARACTER_BINDING_MODES)[number];
  externalId?: string;          // higgsfield soul_id (opaque)
  tag?: string;                 // runway @tag
  status?: CharacterBindingStatus;
  trainedAt?: string;           // ISO8601
  trainedFromRefs?: string[];   // 파생 스냅샷(기록용) — canonical 저장소 아님
};
```

### 2. `assertElementMetadata` 확장 (~line 167 이후)

`metadata.characterBindings !== undefined`이면 검증:

- 배열, 최대 2개, provider당 1개(중복 provider → 400).
- 각 entry: provider ∈ CHARACTER_BINDING_PROVIDERS, mode ∈ CHARACTER_BINDING_MODES.
- runway는 mode=stateless-refs만 허용. higgsfield는 mode=trained-id만 허용
  (잘못된 조합 → 400 `INVALID_ELEMENT_METADATA`).
- externalId/tag는 string(있으면), tag는 1-32자 `[A-Za-z0-9_-]`.
- status ∈ ready|training|failed, trainedAt은 string, trainedFromRefs는 string[](≤6 — element.refs 상한과 같은 값; refs를 스냅샷하는 필드이므로 상한을 공유한다).
- kind=character가 아닌 element에 characterBindings → 400.

위반은 전부 기존과 같은 `storeError(400, "INVALID_ELEMENT_METADATA", ...)` 경로.

### 3. refs 보존 가드 — 헬퍼 + `updateAsset` (~line 368)

```ts
export function bindingReferencedRefs(metadata: Record<string, unknown> | null): string[] {
  // metadata.characterBindings가 1개 이상이면 현재 refs 전체가 "바인딩이 참조하는
  // refs"다(바인딩은 refs 인덱스가 아니라 element 자체를 가리킨다 — 041 불변식 1).
}
```

`updateAsset`에서 kind=element이고 기존 metadata에 characterBindings가 있을 때,
제거를 집합 차분으로 정의한다: `removed = oldRefs.filter(r => !newRefs.includes(r))`.
`removed.length > 0`이면 refs 제거 시도로 보고
`storeError(409, "REFS_BOUND_TO_CHARACTER", "remove the character binding first (unlink)")`.
단, 같은 호출에서 characterBindings도 함께 제거/갱신되면(명시적 unlink) 허용.
refs 추가/순서 변경은 허용(집합 기준이므로 순서 변경은 removed=∅).
비교 단위는 refs 문자열(파일 경로) 그 자체다 — dedupe/rename/asset move로
문자열이 바뀌면 제거로 간주된다(041 불변식 1의 cleanup/dedupe/move 금지와 정합).

### 4. drift 헬퍼 (신규 export)

```ts
export function bindingDrift(currentRefs: string[], binding: CharacterProviderBinding): boolean {
  // trained-id + trainedFromRefs가 있으면 현재 refs와 다를 때 true (041 불변식 2)
}
```

## routes 변경 없음

기존 `PATCH /api/assets/:id`(routes/assets.ts:271-289)가 updateAsset을 그대로
부륯므로 검증/가드는 store 층에서 모두 동작한다. 라우트는 409 storeError를
기존 에러 매핑으로 낸다(매핑이 400만 특정하는지 B에서 확인, 필요시 409 패스스루 추가).

## 계약 테스트 — NEW `tests/asset-character-bindings.test.ts`

1. binding 저장/조회 roundtrip (runway stateless-refs + tag).
2. 잘못된 조합(runway + trained-id, 중복 provider, 3개 초과) → 400.
3. binding 있는 element의 refs 제거 → 409 REFS_BOUND_TO_CHARACTER.
4. 같은 호출에서 bindings 제거 + refs 제거(unlink) → 성공.
5. refs 추가는 binding 유지한 채 성공.
6. bindingDrift: trainedFromRefs와 refs 다름 → true, 같음 → false,
   trainedFromRefs 없음(stateless) → false.

## Activation 시나리오

- 409 가드: 테스트 3이 refs 제거를 실제로 시도해 409를 관측.
- drift: 테스트 6이 trainedFromRefs 스냅샷과 현재 refs를 다르게 구성.

## Accept

`npm run typecheck` green + 위 테스트 6건 green. UI/CLI는 후속 슬라이스.
