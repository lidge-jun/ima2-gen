---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, research, provider, video, kling]
---

# 001 — 지금 코드에 Kling은 어디까지 들어와 있나 (실측)

모든 주장은 2026-08-19 기준 워킹트리에서 직접 읽은 것이다. 추정은 없다.

## 1. 세 개의 provider 레인 체계

ima2에는 성격이 다른 provider 등록부가 **두 개** 있다. 이걸 구분하지
않으면 Kling을 어디에 넣을지 판단이 흐려진다.

| 레지스트리 | 파일 | 대상 | 인증 |
|---|---|---|---|
| 코어 provider | `lib/providers/registry.ts` | 직접 HTTPS/OAuth/CLI 레인 8종 | API key, OAuth proxy, service account, local CLI |
| MCP provider | `lib/mcp/providerRegistry.ts` | 원격 MCP 서버 2종 | 서버측 OAuth |

코어 8종: `oauth`, `api`, `grok`, `grok-api`, `agy`, `gemini-api`,
`atlascloud`, `minimax` (`lib/providers/registry.ts`).
MCP 2종: `runway` (`https://mcp.runwayml.com/mcp`), `higgsfield`
(`https://mcp.higgsfield.ai/mcp`) — `lib/mcp/providerRegistry.ts:17-28`.

**Kling은 코어 8종에 없다.** 코어 레인 중 비디오 모델을 가진 것은
`grok`/`grok-api`의 `grok-imagine-video` 계열뿐이다
(`lib/providers/registry.ts:73-74`, `:96-97`). 나머지 레인은 전부
`kind: "image"`이고 `routes/models.ts`의 lane DTO에서 `video: []`를 낸다.

## 2. Runway 레인: Kling이 이미 하드코딩되어 있다

`lib/mcp/adapters/runway.ts`의 정적 카탈로그에 Kling 2종이 있다.

```
lib/mcp/adapters/runway.ts:51
  { id: "kling-o3-pro", label: "Kling O3 Pro", ... durationOptions([5, 10, 15], 10), audioParameter() }
lib/mcp/adapters/runway.ts:52
  { id: "kling-3-pro",  label: "Kling 3 Pro",  ... durationOptions([5, 10, 15], 10), audioParameter() }
```

선언된 input role:

| 모델 | inputRoles | 의미 |
|---|---|---|
| `kling-o3-pro` | text, start_image, end_image, image_references, video_references | t2v + i2v + 끝프레임 + 레퍼런스 + **v2v** |
| `kling-3-pro` | text, start_image, end_image | t2v + i2v + 끝프레임 (v2v 불가) |

이 role 선언은 장식이 아니라 **집행된다**. `validateRequest()`가
`end_image`/`video_references`/`start_image`/`image_references`를 각각
검사하고 `MCP_INPUT_ROLE_UNSUPPORTED:<model>:<role>`로 거절한다
(`lib/mcp/adapters/runway.ts:92-118`). 즉 `kling-3-pro`에 v2v 소스를
주면 어댑터가 먼저 막는다.

어댑터는 잠겨 있지 않다: `executable: true` (`lib/mcp/adapters/runway.ts:359`).
레지스트리에서 runway는 `catalogAccess: "static"`이라 연결 없이도 모델
목록이 뜬다 (`lib/mcp/providerRegistry.ts:20`).

계약 테스트도 이미 Kling id를 고정하고 있다:
`tests/mcp-models-catalog.test.ts:98` 이 video 모델 순서를
`["seedance-2", "kling-o3-pro", "kling-3-pro", "gen-4.5", "veo-3.1", "gen-4-turbo"]`로 단언한다.

### 다만 기본값은 Kling이 아니다

`DEFAULT_MODEL = { image: "nano-banana-pro", video: "seedance-2" }`
(`lib/mcp/adapters/runway.ts:61`, 같은 값이 `lib/mcp/providerRegistry.ts:21`에도).
Kling을 쓰려면 호출자가 `model`을 명시해야 한다. 이건 사고가 아니라
설계다 — 레퍼런스 이미지가 t2v/i2v에서 seedance-2와 kling-o3-pro에만
허용된다는 주석이 `:111-112`에 남아 있다.

### 그리고 multishot은 통째로 Kling 3.0이다

인증 스냅샷의 `generate_multishot_video` 설명 원문: "Powered by Kling 3.0
(standard at 720p, pro at 1080p). No `model` parameter — resolution selects
the engine." (`assets/mcp-snapshots/runway.sanitized.json:638`)
ima2의 스킬 문서도 이 문장을 그대로 싣고 있다 (`skills/ima2/SKILL.md:1326`).
즉 **해상도가 곧 Kling 티어 선택**이고, 사용자는 Kling을 쓰는 줄 모른 채 쓴다.

## 3. Higgsfield 레인: 스냅샷에는 있고 카탈로그에는 없다

인증된 73-tool 스냅샷에서 Kling 문자열을 전수 추출하면 네 종류가 나온다:
`Kling`, `kling3_0`, `kling3_0_turbo`, `kling_failed`.

- `kling3_0` / `kling3_0_turbo` — `generate_video` 설명의 모델 선택
  가이드와 `show_reference_elements`의 지원 모델 목록에 등장
  (`assets/mcp-snapshots/higgsfield.sanitized.json:2156`, `:24412`).
- `motion_control` 툴은 아예 "Kling 3.0 Motion Control" 전용이다
  (`:15453`, `:15496`). ima2 쪽에는 이 이름이
  `HIGGSFIELD_MEDIA_TOOLS` 상수에 적혀 있다
  (`lib/mcp/adapters/higgsfield.ts:34`). **다만 이 상수는 소비자가 없다** —
  전수 검색 결과 선언부 `:24` 한 곳뿐이고 `lib/`/`routes/`/`tests/` 어디서도
  읽지 않는다. 즉 ima2가 이 툴을 **노출한다는 뜻이 아니라, 메모해 뒀다는 뜻**이다.
  실제 실행 경로는 `buildGenerateCall`이 고르는 `generate_image`/`generate_video` 뿐이다
  (`lib/mcp/adapters/higgsfield.ts:74-113`, `:177-184`).
- `kling_failed` — element 상태 enum 값. Kling 파이프라인 실패가
  일급 상태로 존재한다는 뜻이다.

그런데 ima2가 컴파일해 둔 비디오 모델 목록에는 Kling이 없다:

```
lib/mcp/adapters/higgsfield.ts:62-69  HIGGSFIELD_VIDEO_MODELS
  cinematic_studio_3_0, cinematic_studio_video, cinematic_studio_video_v2,
  marketing_studio_video, clipify, higgsfield_preset
```

### 여기서 두 개의 계약을 구분해야 한다 (감사 지적 B1)

초안은 이 상수가 런타임 카탈로그에 "덮어써진다"고 썼는데 **틀렸다.**
둘은 덮어쓰기 관계가 아니라 **서로 독립된 두 계약**이다.

| 계약 | 무엇을 정하나 | 어디서 오나 |
|---|---|---|
| **광고(advertisement)** | `/api/models`에 어떤 모델이 뜨는가 | 런타임 `models_explore` 호출 |
| **실행 허용(admission)** | 미디어 실행 경로가 그 모델을 받아주는가 | `higgsfieldAdapter.models` = 이 상수 |

근거:

- `lib/mcp/modelsCatalog.ts:194-214` — higgsfield 분기는 오직
  `listHiggsfieldKind()` (= `models_explore`) 결과만 반환한다.
  같은 파일 `:7`은 `RUNWAY_MODEL_CATALOG`만 import하며,
  higgsfield 상수는 **아예 import하지 않는다.**
- 그 상수의 유일한 소비자는 `lib/mcp/adapters/higgsfield.ts:179`의
  `models: { image: [...], video: [...HIGGSFIELD_VIDEO_MODELS] }`이다.

따라서 정확한 사실관계는:

- 계정이 Kling 3.0을 쓸 수 있으면 `models_explore`가 반환하고 **상수를
  고치지 않아도 UI에 뜬다.**
- 반대로 상수만 고쳐도 **`/api/models`에는 아무 변화가 없다.**
- 두 곳이 어긋나면: 광고는 되는데 실행이 거부되거나, 그 반대가 된다.
- **그리고 캡처 시점 증거로는 광고조차 안 됐다.** 픽스처
  `tests/fixtures/mcp/higgsfield-models.sanitized.json`에는 Kling이 0건이다
  (대소문자 무시 전수 검색). 그 계정의 `models_explore`는 Kling을 주지 않았다.

이게 L2의 핵심 리스크다: 툴 설명문은 Kling을 안내하는데, 그 계정의 실제
모델 카탈로그는 Kling을 주지 않았다. 설명문과 권한이 어긋나 있다.

## 4. Kling 문자열이 존재하는 파일 전수

`rg -il kling` (생성 .js 제외) 결과 13건. 성격별로:

| 부류 | 파일 | 성격 |
|---|---|---|
| 실행 경로 | `lib/mcp/adapters/runway.ts` | **모델 id 하드코딩 (실제 동작)** |
| 증거 | `assets/mcp-snapshots/{runway,higgsfield}.sanitized.json` | 인증 tools/list 캡처 |
| 증거 | `tests/fixtures/mcp/{runway,higgsfield}-tools.sanitized.json` | 테스트 픽스처 |
| 계약 테스트 | `tests/mcp-models-catalog.test.ts`, `tests/mcp-media-kind-behavior.test.ts`, `tests/models-endpoint-contract.test.ts`, `tests/mcp-connection-routes.test.ts` | id 고정 |
| 라우트 | `routes/mcpMedia.ts` | 주석/설명 |
| 문서 | `skills/ima2/SKILL.md`, `site/src/pages/{,ko/}docs/concepts/providers.astro` | 사용자 대면 |

주목할 점: 테스트들이 쓰는 가짜 Higgsfield 모델 id가 `kling_3`다
(`tests/models-endpoint-contract.test.ts:49`, `:191`;
`tests/mcp-media-kind-behavior.test.ts:116`). 이건 실제 provider id가 아니라
**테스트용 픽션**이다. 실제 스냅샷 값은 `kling3_0`이다. 구현 유닛이
이 둘을 혼동하면 안 된다.

## 5. 사용자 대면 문서는 이미 Kling을 약속하고 있다

`site/src/pages/docs/concepts/providers.astro:178`:
"runway (Gen-4/4.5, Veo 3.1, Seedance 2, Kling — image and video)".
한국어판도 동일 (`site/.../ko/.../providers.astro:113`).

즉 **제품 문서상 Kling은 이미 지원 모델로 공표되어 있다.** L1이 실제로
동작하는지 확인하지 않은 상태에서 이 문장이 나가 있는 것은 그 자체로
검증 부채다.

## 6. 신규 코어 레인을 넣는다면 얼마나 드는가 (선례 실측)

MiniMax가 가장 최근의 코어 레인 추가 선례다. 관련 커밋:

```
7acd4aeb Add MiniMax image generation provider (text-to-image and image-to-image)
bd507eee fix(minimax): 과금성 키 검증과 모델 바꿔치기를 걷어낸다
d6fe2e1c fix(minimax): 남은 fail-open 두 곳을 막는다
9da23de9 feat(providers): central capability registry drives ids, models, and limits
a00812e1 feat(providers): add ProviderAdapter v1 with MiniMax as reference (#150)
```

한 번에 끝나지 않았다. 최초 추가 뒤 **fail-open 보안 수정이 두 번** 더 붙었다.
`rg -l minimax` 는 지금 **66개 파일**을 반환한다
(생성 `.js` 제외 시 65개, 대소문자 무시하면 79개) — 어댑터 하나가 아니라
config, routes/keys, routes/models, UI 스토어, i18n 4개 언어, 문서, doctor,
canary 스크립트까지 번진다.

Provider Adapter v1의 자기 진단이 이걸 명시한다:

> "It is a control plane, not a plugin interface: runtime behavior still lives
> in per-provider modules that routes reach into directly, so adding a provider
> still touches core, routes, UI, and tests at once."
> — `lib/providers/adapters/types.ts` 헤더 주석

게다가 현재 `ProviderAdapterV1`은 `generateImage?`/`editImage?`만
optional로 두고 있고 **비디오 생성 메서드가 아예 없다**
(`lib/providers/adapters/types.ts`). 등록된 어댑터도 minimax, atlascloud
둘 다 이미지 전용이다 (`lib/providers/adapters/index.ts:17-18`).

**결론: Kling 직접 레인(L3)은 "어댑터 하나 추가"가 아니다. 어댑터 계약에
비디오 경로가 없으므로, 계약 자체를 먼저 확장해야 한다.** 이건 #151
(job envelope) 이 정리해야 할 cancel/retry/resume 계약과 물려 있다 —
types.ts 주석이 "pinning them now would mean changing them twice"라고
명시적으로 미뤄둔 부분이다.
