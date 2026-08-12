---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, provider, registry]
---

# 040 — Provider Capability Registry

- work-phase: WP4 첫 문서
- 소비: `003` 아키텍처 인벤토리 (중복 지점 실측)
- 소비되는 곳: `060` 오류 분류(소스 스캔 편의), `070` doctor, `080` E2E

**`050`은 이 문서를 소비하지 않는다**(A phase 감사 blocker 6). 초안은 의존 간선을
그렸지만 terminal status 정규화는 공급자 데이터를 전혀 읽지 않는다. `040`과 `050`은
**병렬 가능**하다. `060`의 의존도 약하다 — `errorPrefix`는 소스에서 코드를 수집할
때의 편의이지 런타임 전제가 아니며, 매핑 키를 직접 열거해도 된다. 가짜 의존을
적어 두면 필요 없는 직렬화가 생긴다.

## 문제 (측정값)

공급자 id 목록이 **9곳**에 독립적으로 존재하고, 어휘도 하나가 아니다.
`routes/keys.ts:36`은 auth 관점(`openai`/`xai`)을, 나머지는 lane 관점
(`oauth`/`grok-api`)을 쓴다. 모델 목록은 4곳, 참조 상한은 5곳에 흩어져 있다.
`supportsEdit`/`supportsMask`/`supportsStreaming`/`maxReferences`를 담은 **기계
판독 가능한 객체는 없다**.

가장 단순한 공급자 MiniMax를 추가하는 데 소스·테스트 54개 파일이 필요했다.

## 이미 있는 것에서 출발한다

**새 패턴을 발명하지 않는다.** 이 저장소에는 이미 registry 선례가 둘 있다.

| 선례 | 무엇을 하나 |
|---|---|
| `lib/mcp/providerRegistry.ts:16` | MCP 공급자의 `REGISTRY` 레코드. endpoint, executable, catalogAccess, defaults를 한 객체에 |
| `lib/contracts/catalog.ts:8` | 스냅샷을 계약 엔트리로 투영하고 중복 id를 startup에서 throw |

MCP 공급자는 이미 이 구조를 쓰고 core 공급자만 병렬 목록으로 남아 있다. `040`은
**core 공급자를 같은 자리로 데려오는 일**이지 새 아키텍처가 아니다.

## 매니페스트 형태

평가서가 제안한 인터페이스를 그대로 쓰지 않는다. 이 저장소의 실제 필요에 맞춘다.

```ts
export interface CoreProviderManifest {
  id: CoreProviderId;              // lane 어휘: "oauth" | "api" | "grok-api" | ...
  vendor: "openai" | "xai" | "google" | "atlascloud" | "minimax";  // 벤더 정체성

  // 자격증명은 0..N개다. 스칼라로 표현할 수 없다.
  // keyVocabulary는 routes/keys.ts:36 어휘이며, 키를 쓰지 않는 수단에는 없다.
  credentials: Array<
    | { kind: "api-key"; keyVocabulary: KeyProviderId; envVars: string[];
        keyPrefix?: string; validateUrl?: string; configKey?: string }
    | { kind: "oauth-proxy"; envVars: string[]; configKey?: string }
    | { kind: "service-account"; envVars: string[]; configKey?: string }  // Vertex
    | { kind: "local-cli"; envVars: string[] }                            // agy
  >;

  models: Array<{
    id: string;
    aliases?: string[];
    kind: "image" | "video";
    supports: { edit: boolean; mask: boolean; streaming: boolean };
  }>;

  // 참조 상한은 계층형이다. 이 필드는 lane/mode 계층 하나만 소유한다.
  referenceLimits: Partial<Record<"image" | "edit" | "video", number>>;

  elementTaxonomy: "gpt" | "gemini" | "grok" | null;  // 세 번째 어휘. 아래 참조
  limits: { timeoutMs: number; maxInputBytes?: number };
  errorPrefix: string | null;      // "MINIMAX_" — 060의 소스 스캔 편의용(선택)
}
```

### 자격증명은 0..N개이고, 벤더와 키 어휘는 다른 축이다

초안은 `keyVocabulary`를 스칼라로 뒀다. 실측하면 표현되지 않는 경우가 있다.

| lane | 자격증명 | 스칼라로 되나 |
|---|---|---|
| `oauth` | OAuth 프록시 (**OpenAI 키를 쓰지 않는다**) | 아니오 — `openai`로 적으면 거짓 |
| `api` | `openai` 키 | 예 |
| `grok` | 프록시 (**xAI 키를 쓰지 않는다**) | 아니오 |
| `grok-api` | `xai` 키 | 예 |
| `gemini-api` | Gemini API 키 **또는** Vertex 서비스 계정 | 아니오 — 둘 중 하나 |
| `agy` | 로컬 CLI, 키 없음 | 예(`null`) |

두 가지를 분리한다. **`vendor`**는 정체성(`oauth`와 `api` 모두 `openai` 벤더),
**`credentials[].keyVocabulary`**는 `routes/keys.ts:36`의 키 어휘다. 프록시
수단에는 `keyVocabulary`가 **아예 없다** — 있으면
`byKeyVocabulary("openai")`가 OAuth lane까지 반환해 키 관리 화면이 잘못된다.

Vertex는 `KeyProviderId`에 없으므로 `service-account`라는 별도 kind를 가진다.
`KeyProviderId`에 억지로 넣지 않는다.

`byKeyVocabulary(id)`는 배열을 반환한다. `openai` 키는 `api` lane에만 걸리지만,
같은 함수 형태를 유지해 다대일이 생겨도 깨지지 않게 한다.

### 참조 상한은 4계층이다

초안은 모델별 숫자 하나로 뒀다. 실측하면 계층이 넷이다.

| 계층 | 값 | 소유 |
|---|---|---|
| 코어 전역 상한 | 기본 5 (`./config.ts` 94행, `lib/refs.ts:88`) | config — registry가 가져오지 않는다 |
| lane/모드 상한 | Grok 이미지 3, Grok 비디오 7, MiniMax 1 (`ui/src/lib/referenceLimits.ts:12`) | **`referenceLimits` — 이 phase가 통합** |
| element capacity | gpt/gemini/grok × image/edit/video, 총량·개당 (`lib/elementCompiler.ts:57`) | `elementCompiler` — `elementTaxonomy`로 연결만 |
| MCP transport 상한 | 3 (`routes/mcpMedia.ts:381`, `ui/src/components/settings/McpReferenceSlots.tsx:18`) | MCP registry — 코어 lane 밖 |

**`referenceLimits`는 두 번째 계층만 소유한다.** 나머지 셋은 각자 주인이 있고,
registry가 전부 흡수하면 축이 다른 값들이 한 표에 뭉개진다. 이 표를 문서에 남기는
이유는, 적지 않으면 다음 사람이 "registry가 상한을 다 가진다"고 믿고 잘못된 값을
읽기 때문이다.

`d2` 패리티 테스트는 **네 계층을 각각** 현재 값과 대조한다.

어휘를 **한 레코드 안에서 잇는 것**이 이 설계의 핵심이다. `credentials[]`가
`routes/keys.ts:36`의 키 어휘와 lane 어휘 사이 수동 매핑을 없앤다. 이 매핑이
지금 공급자 추가 비용의 큰 부분이다.

### 세 번째 어휘: element capacity

`lib/elementCompiler.ts:4`는 또 다른 분류 `gpt | gemini | grok`을 쓰고, 상한이
**모드별**(image/edit/video)로 다르다: GPT `6/6/1`, Gemini `6/6/3`, Grok `4/4/1`
(`lib/elementCompiler.ts:57`).

이것은 `referenceLimits`로도 표현되지 않는다. 축이 (분류 × 모드 × 총량/개당)로
하나 더 많기 때문이다. 그래서 `elementTaxonomy`
필드로 **연결만 하고 값은 옮기지 않는다.** 이 phase는 값을 한 곳으로 모으는
것이 목표이지만, element capacity는 축(모드 × 분류)이 달라 같은 표에 넣으면
둘 다 왜곡된다. registry는 "이 lane은 어느 element 분류에 속하는가"만 답하고,
용량 표는 `elementCompiler`가 계속 소유한다.

이 판단을 적어 두는 이유: 적지 않으면 다음 사람이 "registry가 상한을 다 가진다"고
믿고 element 경로에서 잘못된 값을 읽는다.

## 파일 변경 맵

### 신규

| 경로 | 내용 |
|---|---|
| `lib/providers/types.ts` | 위 인터페이스 + `CoreProviderId`, `KeyProviderId` |
| `lib/providers/registry.ts` | 8개 lane 매니페스트. `listProviders()`, `getProvider(id)`, `byKeyVocabulary(id): CoreProviderManifest[]` (**배열** — 다대일이므로) |
| `lib/providers/derive.ts` | registry에서 파생 목록을 만드는 순수 함수들 (id 배열, 모델 Set, 참조 상한 맵) |
| `tests/provider-registry-contract.test.ts` | 매니페스트 불변식 |
| `tests/provider-registry-parity.test.ts` | **파생값이 현재 하드코딩 값과 정확히 일치**하는지 |

### 소비자로 전환 (이 phase에서는 파생값을 읽기만)

| 경로 | 현재 | 이후 |
|---|---|---|
| `lib/capabilities.ts:13` | `VALID_PROVIDERS` 리터럴 | `deriveProviderIds()` |
| `lib/agentSettings.ts:4` | `PROVIDERS` Set | 파생 Set |
| `bin/lib/modelResolver.ts:25` | `LANES` 배열 | 파생 배열 (+ MCP lane 병합) |
| `lib/imageModels.ts:3` 이하 6개 Set | 리터럴 Set | 파생 Set |
| `ui/src/types.ts:5` | `Provider` union | **생성된 파일에서 import** (아래) |
| `ui/src/lib/referenceLimits.ts:12` | 리터럴 상한 | 생성된 맵 |

### UI 경계

UI는 서버 `lib/`를 import할 수 없다. 두 선택지 중 **생성**을 택한다.

| 방법 | 판단 |
|---|---|
| 런타임에 `/api/models`로 받기 | 거부. 타입이 사라지고 첫 렌더 전에 값이 없다 |
| **빌드 시 생성** (`scripts/generate-provider-types.mjs` → `ui/src/generated/providers.ts`) | 채택. 타입 유지, 런타임 비용 0 |

생성 파일은 추적하되 **`010`의 drift 규칙과 충돌하지 않게** 한다: `.ts`이고
대응하는 `.ts` 소스가 없으므로 `010`의 "`.ts` 짝이 있는 `.js`" 검사에 걸리지
않는다. 대신 CI가 재생성 후 diff 없음을 확인한다.

## IN / OUT

- IN: `lib/providers/**` 신규, 위 소비자들의 **리터럴 → 파생 전환**,
  `scripts/generate-provider-types.mjs`, `ui/src/generated/providers.ts`, 테스트 2종.
- OUT: 공급자 **추가·제거**, 어댑터 구현 변경(`lib/*ImageAdapter.ts`), 오류 코드
  정규화(`060` 소유), job 상태(`050` 소유), `routes/keys.ts`의 검증 로직 자체.
  이 phase는 **값을 한 곳으로 모으는 것**이지 동작을 바꾸는 것이 아니다.

## 수용 기준

- `d1`: **동작 변화 0.** 전체 테스트가 패치 전후 동일하게 통과한다. registry
  도입은 리팩터링이지 기능 변경이 아니다.
- `d2`: **패리티 테스트가 음성 대조를 가진다.** `tests/provider-registry-parity.test.ts`가
  파생값과 현재 하드코딩 값을 비교하고, 매니페스트에서 값 하나를 일부러 바꾸면
  실패한다. 이 테스트가 registry 전환의 유일한 안전망이다.
- `d3`: 공급자 id 목록의 **리터럴 정의가 1개**다.
  `rg -n 'minimax' lib/ bin/ routes/ --glob '!*.js'`가 반환하는 id 배열 정의가
  `lib/providers/registry.ts` 하나뿐이다.
- `d4`: `ui/src/generated/providers.ts`를 재생성해도 diff가 없다.
- `d5`: **신규 공급자 추가 비용 실측.** 가상의 lane을 매니페스트에만 추가하고,
  기존 파일 수정 없이 `/api/models` 목록과 CLI 모델 검증에 나타나는지 확인한다.

  **"신규 3파일, 기존 수정 0"은 이 phase의 목표가 아니다.** registry는 *선언적
  데이터*(id, 모델, 상한, 키 어휘)만 통합한다. 실제 생성을 하려면 여전히 다음이
  필요하다.

  | 남는 작업 | 왜 registry가 못 없애나 |
  |---|---|
  | 어댑터 구현 (`lib/*ImageAdapter.ts`) | HTTP 형태·응답 파싱이 공급자마다 다르다 |
  | 어댑터 디스패치 (`lib/generatePipeline.ts` 등) | 어느 어댑터를 부를지 결정 |
  | 키 검증 요청 (`routes/keys.ts`) | URL은 매니페스트가 주지만 응답 해석은 별개 |
  | lane별 readiness 생성자와 `buildCoreLanes` (`routes/models.ts:108`, `routes/models.ts:185`) | lane마다 준비 상태 판정이 다르다 |
  | `resolveProviderOptions`의 공급자 분기 (`lib/providerOptions.ts:13`) | 모델·크기·검색 옵션 정규화가 공급자마다 다르다 |
  | 키 저장·핫업데이트 분기 (`routes/keys.ts:205`) | 런타임 반영 경로 |
  | 전용 엔드포인트가 필요한 경우 라우트 등록 (`routes/index.ts:49`) | |

  A phase 감사가 이 네 개를 추가로 짚었다. 초안의 표는 남는 작업을 과소평가했다.

  따라서 정직한 `d5` 목표는 **선언적 계층에서 기존 파일 수정 0**이다: id 목록,
  모델 Set, 참조 상한, 키 접두사/URL, UI 타입이 전부 파생값이 되어 손댈 곳이
  없어야 한다. 어댑터와 디스패치는 남는다. 달성 못 한 계층은 기록한다 — 실패해도
  측정값이 다음 라운드의 입력이다.

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 중복 id 거부 | 매니페스트에 같은 id를 두 번 | startup에서 throw (`lib/contracts/catalog.ts:8`의 기존 패턴과 동일) |
| 키 없는 lane | `agy`로 키 조회 | 빈 배열. 호출부가 키 없음으로 처리 |
| 프록시 lane 제외 | `byKeyVocabulary("openai")` | `api`만 반환하고 **`oauth`는 반환하지 않는다**. OAuth는 키를 쓰지 않는다 |
| 다중 자격증명 | `gemini-api`의 credentials | API 키와 Vertex 서비스 계정 **둘 다** 표현된다 |
| lane/모드 참조 상한 | MiniMax에 참조 2장 전달 | 기존과 동일한 거부. **파생값이 기존 상한과 같음을 `d2`가 보장** |
| 생성 파일 stale | 매니페스트만 바꾸고 재생성 안 함 | CI가 diff를 발견하고 실패 |

세 번째 행이 중요하다. registry가 잘못된 상한을 만들면 **조용히 열리거나 조용히
막힌다**. 그래서 `d2`의 패리티 테스트가 없으면 이 phase는 검증 불가다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `npm run typecheck` | `lib/providers/**`, 소비자 전환 | `tsconfig.json` include에 `lib/**/*.ts` 포함 — **관측함** |
| `npm test` | 동작 불변(`d1`) | `d2fe420`에서 2118/2116 pass |
| `node --test tests/provider-registry-parity.test.ts` | 파생값 == 현재 값 | 파일 미존재 (B에서 생성) |
| `cd ui && npm run build` | 생성 파일 타입 정합 | 미실행 (B에서) |

`npm run typecheck`는 `ui/`를 `exclude`하므로 **UI 쪽 전환은 보지 못한다**.
UI는 `cd ui && npm run build`(`tsc -b && vite build`)가 담당한다. 두 게이트를
모두 돌려야 이 phase가 덮인다.

## 이 phase를 하지 말아야 할 조건

평가서는 "Provider Registry 전에 신규 프로바이더를 추가하지 말라"고 했다.
동의한다. 반대로 **registry를 만든다고 공급자가 늘어나는 것도 아니다.** `d5`가
실패하면(수정 파일이 여전히 10개 이상) registry는 이름만 registry이고 비용은
그대로다. 그 경우 **선언적 계층 중 무엇이 남았는지 기록하고 이 phase를 다시
계획한다.**

`050`이나 `060`을 막지 않는다. 둘 다 이 문서를 소비하지 않으므로(위 헤더 참조)
`d5` 실패를 이유로 직렬화하면 근거 없는 대기가 생긴다. 초안은 여기서 "`050`/`060`
으로 넘어가기 전에"라고 적어 헤더의 병렬 선언과 모순됐다(A phase 2라운드 감사
blocker 5).
