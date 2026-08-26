---
created: 2026-08-18
updated: 2026-08-18
tags: [ima2-gen, devlog, wp2, provider, adapter]
---

# 020 (WP2) — #150 2단계: atlascloud adapter + core diff 실측

의존: 없음 (wp1과 독립; adapters/types.ts는 읽기만).

## 선정 근거 (000 참조)

atlascloud: 단일 API key(`ctx.atlasCloudApiKey`), 고유 errorPrefix
`ATLASCLOUD_`, image 전용, sync 판독 가능. gemini-api(이중 credential),
agy(async binary), grok-api(prefix 공유), oauth/api(prefix null)는 부적합.

## 파일 맵 (minimax 전례를 그대로)

| # | 파일 | 변경 | core? |
|---|---|---|---|
| 1 | `lib/providers/adapters/atlascloud.ts` | [NEW] createAtlasCloudAdapter(ctx). 파일명은 lane id와 정확히 일치해야 함 (contract test :54 규약) | core |
| 2 | `lib/providers/adapters/index.ts` | [MOD] import + factory map 항목 + **헤더 주석 갱신** ("Only MiniMax is registered"가 거짓이 되므로 — wp2 감사 C) | core |
| 3 | `routes/models.ts` | [MOD] atlasCloudLane(:163-170)이 adapter 경유 (minimaxLane :172-192 패턴 복제, null-adapter 폴백 유지) | core |
| 4 | `tests/provider-adapter-v1-contract.test.ts` | [MOD] :116 null 단언 목록에서 "atlascloud" 제거 | test |
| 5 | `tests/models-endpoint-contract.test.ts` | [MOD] atlascloud lane 키 없음/있음 2상태 DTO 단언 (minimax 전례 :208-233) | test |

**core 3 / 전체 5.** 수용 조건 "core 변경 5개 파일 이하"를 실제 `git diff
--stat`으로 측정해 이슈에 기록한다. 신규 테스트 파일이 없으므로
test:inventory 재생성 불필요 — 단 실측으로 확인한다.

## 테스트 헬퍼 확장 (감사 블로커 5)

단순 문자열 삭제로는 auth 검증이 공허해진다:

- `tests/provider-adapter-v1-contract.test.ts`의 `contextWith()`(line 17)가
  `minimaxApiKey`만 만든다 → `atlasCloudApiKey`도 채운다. **단 fixture 확장만으로는
  단언이 생기지 않는다** (wp2 감사 A: 자동 순회 6건은 auth 결과를 단언하지 않고,
  실제 auth 단언 line 71-83은 minimax 하드코딩). auth two-state 블록을
  **lane 순회형으로 일반화**하거나 atlascloud 전용 블록을 추가해
  `ok === true`/"Atlas Cloud API key missing" reason이 실제로 단언되게 한다.
- `tests/models-endpoint-contract.test.ts`의 `withApp` 옵션에
  `atlasCloudApiKey`를 추가해 2상태 DTO 단언이 실제로 성립하게 확장.

## adapter 내용

minimax.ts를 전례로:

- `laneId = "atlascloud"`, `ERROR_PREFIX = "ATLASCLOUD_"`
- `validateAuth()`: `ctx.atlasCloudApiKey` 존재 여부만. reason 문구는
  models.ts 현행 그대로 "Atlas Cloud API key missing" (DTO 불변)
- `listModels()`: `getProvider("atlascloud").models` 파생 (registry가 정본)
- `normalizeError()`: RETRYABLE_STATUSES 동일 세트, code에 prefix 강제,
  `ATLASCLOUD_API_KEY_MISSING` → 401 비재시도 (기존
  `tests/atlascloud-provider-contract.test.ts`와 일관)
- generate/edit는 미구현 (optional; #151 계약 뒤)
- 주의 (감사 블로커 4): contract test는 lane의 **모든 registry 모델** 리터럴을
  검사한다. atlascloud는 `openai/gpt-image-2/text-to-image`와
  `openai/gpt-image-2/edit` **둘 다** 하드코딩 금지. listModels는 registry
  파생으로만 만든다.

## 알려진 한계 (wp2 감사 D)

`ATLASCLOUD_UNKNOWN`은 `PROVIDER_ERROR_MAP`에 키가 없어
`providerErrorClass()`가 undefined를 반환한다. `MINIMAX_UNKNOWN`도 동일한
기존 구멍이며, 이번 유닛은 minimax 패리티를 유지한다(맵 확장은 범위 밖).

## 수용 기준

- [ ] contract suite가 atlascloud 포함 통과 (자동 순회 6건 상속 + auth two-state 실단언)
- [ ] /api/models atlascloud DTO 형태 불변 (2상태 단언)
- [ ] core diff ≤ 5 파일 실측 기록
- [ ] 전체 게이트 통과
