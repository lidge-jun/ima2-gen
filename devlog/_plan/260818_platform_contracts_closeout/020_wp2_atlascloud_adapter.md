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
| 2 | `lib/providers/adapters/index.ts` | [MOD] factory map에 `atlascloud: createAtlasCloudAdapter` 1줄 | core |
| 3 | `routes/models.ts` | [MOD] atlasCloudLane(:163-170)이 adapter 경유 (minimaxLane :172-192 패턴 복제, null-adapter 폴백 유지) | core |
| 4 | `tests/provider-adapter-v1-contract.test.ts` | [MOD] :116 null 단언 목록에서 "atlascloud" 제거 | test |
| 5 | `tests/models-endpoint-contract.test.ts` | [MOD] atlascloud lane 키 없음/있음 2상태 DTO 단언 (minimax 전례 :208-233) | test |

**core 3 / 전체 5.** 수용 조건 "core 변경 5개 파일 이하"를 실제 `git diff
--stat`으로 측정해 이슈에 기록한다. 신규 테스트 파일이 없으므로
test:inventory 재생성 불필요 — 단 실측으로 확인한다.

## 테스트 헬퍼 확장 (감사 블로커 5)

단순 문자열 삭제로는 auth 검증이 공허해진다:

- `tests/provider-adapter-v1-contract.test.ts`의 `contextWith()`(line 17)가
  `minimaxApiKey`만 만든다 → `atlasCloudApiKey`도 채워 with-key 상태에서
  atlascloud `validateAuth().ok === true`가 실제로 단언되게 확장.
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

## 수용 기준

- [ ] contract suite 9건이 atlascloud 포함 자동 통과 (자동 순회 7건 상속)
- [ ] /api/models atlascloud DTO 형태 불변 (2상태 단언)
- [ ] core diff ≤ 5 파일 실측 기록
- [ ] 전체 게이트 통과
