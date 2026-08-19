---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, research, provider, video, kling, decision]
---

# 003 — 세 가지 도입안과 권고

001(코드 실측)과 002(외부 계약)를 합쳐 실행 가능한 안으로 정리한다.
각 안은 **실제 변경 파일 경로**를 명시한다. 추정 파일은 넣지 않는다.

## 전제: 세 안은 배타적이지 않다

L1 → L2 → L3 순서로 의존한다기보다, **비용과 확실성이 다른 세 층**이다.
L1은 이미 코드에 있으므로 사실상 "검증 부채 상환"이고, L3만이 진짜
"신규 provider 도입"이다.

---

## 안 L1 — Runway MCP의 Kling을 검증하고 노출한다

### 무엇을 하나

코드는 이미 `kling-o3-pro`, `kling-3-pro`를 안다 (001 §2).
하지 않은 것은 **한 번도 실제로 돌려본 적이 있다는 증거가 없다**는 것.
`assets/mcp-snapshots/`는 `tools/list` 캡처지 생성 결과가 아니다.

### 변경 파일

| 파일 | 변경 |
|---|---|
| — | **프로덕션 코드 변경 없음** |
| `assets/mcp-snapshots/runway.sanitized.json` | 재캡처 (enum 유효성 확인) |
| `devlog/_plan/<unit>/0X0_*.md` | 라이브 생성 증거 기록 |

### 비용

코드 0줄. Runway 워크스페이스 크레딧 소모 1~2건.

### 리스크

- 스냅샷이 2026-07-15자다. Runway가 enum에서 Kling을 뺐다면 계약 테스트
  `tests/mcp-models-catalog.test.ts:98`이 **거짓을 단언하고 있는 상태**가 된다.
  이 테스트는 정적 카탈로그를 검사하므로 upstream이 바뀌어도 초록색이다.
- `kling-3-pro`는 v2v 미지원인데 `kling-o3-pro`는 지원한다. UI가 이
  차이를 사용자에게 보여주지 않으면 `MCP_INPUT_ROLE_UNSUPPORTED` 에러로만
  드러난다.

### 이 안의 진짜 가치

제품 문서가 이미 "Kling 지원"을 공표하고 있다 (001 §5,
`site/src/pages/docs/concepts/providers.astro:178`). L1은 새 기능이 아니라
**이미 한 약속이 참인지 확인하는 일**이다. 세 안 중 유일하게 하지 않을
이유가 없다.

---

## 안 L2 — Higgsfield의 Kling 3.0을 카탈로그에 반영한다

### 무엇을 하나

`kling3_0`, `kling3_0_turbo`가 인증 스냅샷에 있으나
`HIGGSFIELD_VIDEO_MODELS` 상수에는 없다 (001 §3).

`motion_control` (Kling 3.0 전용 툴)은 `HIGGSFIELD_MEDIA_TOOLS`에
이름만 적혀 있고 (`lib/mcp/adapters/higgsfield.ts:34`) **소비자가 없다.**
ima2가 이 기능을 노출하고 있다는 뜻이 아니다 — 001 §3 참조.

### 선행 조건 (이것 없이는 시작 금지)

연결된 Higgsfield 계정에서 `models_explore`를 호출해 Kling 3.0이
실제로 반환되는지 확인. 픽스처
`tests/fixtures/mcp/higgsfield-models.sanitized.json`에는 Kling이 0건이므로,
**현재 증거로는 반환되지 않는다고 봐야 한다.**

### 변경 파일 (선행 조건 충족 시)

| 파일 | 변경 | 어느 계약 |
|---|---|---|
| `lib/mcp/adapters/higgsfield.ts:62-69` | `HIGGSFIELD_VIDEO_MODELS`에 2종 추가 | **실행 허용**만. `/api/models`는 안 바뀜 |
| `tests/fixtures/mcp/higgsfield-models.sanitized.json` | Kling 포함 재캡처 | **광고** 증거 |
| `assets/mcp-snapshots/higgsfield.sanitized.json` | 재캡처 | 증거 |
| `tests/mcp-models-catalog.test.ts` | 카탈로그 단언 갱신 | 계약 테스트 |

**두 계약을 같이 손대야 한다.** 상수만 고치면 실행은 허용되나 UI에 안 뜨고,
`models_explore`만 Kling을 주면 UI에 뜨는데 실행에서 거부된다.
어느 쪽도 반쪽짜리다 (001 §3의 표 참조).

### 함정

1. **`kling_3` ≠ `kling3_0`.** 테스트 3곳이 쓰는 `kling_3`는 픽션이다
   (001 §4). 실제 id를 넣는다고 테스트 픽션을 바꾸면 안 된다.
2. `kling3_0`는 **`start_image` 없이는 reference element를 존중하지 않는다.**
   스냅샷 원문: "`kling3_0` only honors reference elements when an explicit
   `start_image` is provided". 이건 어댑터가 강제해야 할 조건인데
   현재 higgsfield 어댑터에는 Runway 같은 role 검증이 없다.
   Runway는 `validateRequest()`가 role을 전수 검사하지만
   (`lib/mcp/adapters/runway.ts:93-117`), higgsfield의
   `buildGenerateCall`은 파라미터 화이트리스트만 보고 media role은
   그대로 전달한다 (`lib/mcp/adapters/higgsfield.ts:74-113`).
3. 상수와 런타임 카탈로그는 **덮어쓰기 관계가 아니라 독립된 두 계약**이다
   (001 §3). `lib/mcp/modelsCatalog.ts:7`은 higgsfield 상수를 import조차
   하지 않는다. 상수만 고치면 `/api/models`는 그대로다.

---

## 안 L3 — Kling 직접 API 레인 신설

### 무엇을 하나

`lib/providers/registry.ts`에 9번째 코어 레인 `kling`을 추가하고,
`https://api-singapore.klingai.com` 신규 3.x 경로를 직접 호출한다.

### 왜 지금은 막혀 있나 — 계약에 비디오가 없다

`ProviderAdapterV1`은 `generateImage?`, `editImage?`만 갖고
**비디오 메서드가 없다** (`lib/providers/adapters/types.ts`).
등록된 두 어댑터(minimax, atlascloud)도 이미지 전용이다.
계약 주석이 그 이유를 밝힌다:

> "Generation and editing stay optional here because their signature depends
> on the cancel/retry/resume contract that #151 has not fixed yet — pinning
> them now would mean changing them twice."

즉 **Kling 직접 레인은 #151(job envelope)의 종속 작업이다.** 지금 만들면
두 번 만들게 된다고 계약 자체가 경고하고 있다.

### 변경 파일 (MiniMax 선례 기준 실측)

`rg -l minimax` = **66개 파일** (생성 `.js` 제외 65, 대소문자 무시 79).
Kling은 **비디오라서 더 넓다.**

| 계층 | 파일 |
|---|---|
| 코어 등록 | `lib/providers/registry.ts`, `lib/providers/types.ts` (`KeyProviderId`, `ProviderVendor` 확장) |
| 생성 타입 | `ui/src/generated/providers.ts` (via `scripts/generate-provider-types.mjs`) |
| 어댑터 | `lib/providers/adapters/kling.ts` (신규), `lib/providers/adapters/index.ts`, `lib/providers/adapters/types.ts` (**비디오 메서드 신설**) |
| 런타임 | `lib/klingVideoAdapter.ts` + `poll`/`download` (grokVideo* 6파일 패턴) |
| 설정 | `config.ts`, `lib/runtimeContext.ts` |
| 라우트 | `routes/keys.ts`, `routes/models.ts`, `routes/video.ts` |
| 모델 정규화 | `lib/imageModels.ts` (`normalize*Video*` 계열) |
| UI | `ui/src/store/storeSettingsImpl.ts`, `ui/src/hooks/useKeyStatus.ts`, `ui/src/lib/imageModels.ts`, `ui/src/lib/referenceLimits.ts` |
| i18n | `ui/src/i18n/{en,ko,zh-Hans,zh-Hant}.json` |
| 문서 | `docs/CLI*.md` 4종, `site/.../providers.astro` 2종, `skills/ima2/SKILL.md` |
| 운영 | `bin/lib/doctor-providers.ts`, `scripts/provider-canary.mjs` |
| 테스트 | `tests/provider-registry-contract.test.ts`, `tests/provider-adapter-v1-contract.test.ts`, `tests/models-endpoint-contract.test.ts`, 신규 계약 테스트 |

### 추가 리스크

- **fail-open 전례.** MiniMax는 최초 추가 후 보안 수정이 2회 더 붙었다
  (`bd507eee` 과금성 키 검증, `d6fe2e1c` fail-open 2곳). 신규 레인은
  키 검증 경로에서 같은 실수를 반복하기 쉽다.
- **status 철자 이중화** (002 §1.4): `succeed` vs `succeeded`.
- **동시성 상한**: Kling은 팩 등급별 슬롯 제한이 있고 ima2는 12건 병렬을
  표방한다 (002 §1.7). `code: 1303` 처리 경로가 필요하다.
- **한국 결제 가능 여부 미확인** (002 §1.10). 이게 안 되면 안 전체가 무의미하다.

### 대안: 애그리게이터 경유 (L3')

공식 API 대신 fal.ai를 코어 레인으로 넣는 변형. 장점은 `@fal-ai/client`
공식 Node SDK, 초당 $0.084~$0.196의 공개 단가, Kling 외 다른 모델도 함께
열린다는 것. 단점은 **Kling 레인이 아니라 fal 레인이 된다** — 모델 하나를
위해 중개자 하나를 영구히 떠안는 결정이다. 코드 비용은 L3와 같다.

---

## 권고

### 지금 할 것: L1

코드 변경 0, 크레딧 소모 최소, 그리고 **이미 공표한 약속을 검증**한다.
실패하면 그 자체로 중요한 발견이다 (계약 테스트가 거짓을 지키고 있다는 뜻).

검증 항목:

| id | 항목 | 방법 |
|---|---|---|
| V1 | Runway `generate_video` enum에 Kling 2종이 아직 있는가 | `tools/list` 재캡처 후 enum diff |
| V2 | `kling-o3-pro` t2v 1건이 실제로 완료되는가 | 라이브 생성 + 다운로드 |
| V3 | `kling-3-pro`에 v2v를 주면 어댑터가 막는가 | `MCP_INPUT_ROLE_UNSUPPORTED` 관측 |
| V4 | multishot이 Kling 3.0으로 도는가 | 720p/1080p 각 1건 |

### 조건부로 할 것: L2

선행 조건은 단 하나 — 연결된 계정의 `models_explore`가 Kling 3.0을
반환하는가. 반환하면 상수 2줄 + 픽스처 재캡처로 끝난다.
반환하지 않으면 **하지 않는다**. 상수에 넣어도 런타임 카탈로그가 덮는다.

### 지금 하지 말 것: L3

세 가지가 동시에 미해결이다:

1. `ProviderAdapterV1`에 비디오 계약이 없고, 그 부재는 #151 대기 때문이다
2. 한국 결제 가능 여부가 미확인이다
3. L1/L2가 이미 Kling 접근을 제공할 수 있는데 검증되지 않았다

3번이 특히 중요하다. **Kling에 이미 닿을 수 있는지 모르는 채로 Kling
직접 레인을 만드는 것은 순서가 틀렸다.** L1 검증 결과가 L3의 필요성 자체를
바꾼다 — L1이 잘 동작하면 L3는 "비용 절감"과 "기능 확장"(lip-sync,
video-extend, effects 등 MCP에 없는 1st-party 전용 기능) 문제로 축소되고,
L1이 죽어 있으면 L3는 "Kling 지원 복구" 문제가 된다. 완전히 다른 안건이다.
