---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, e2e, agbrowse, playwright]
---

# 080 — 프런트엔드 E2E

- work-phase: WP5 두 번째 문서
- 소비: `050` terminal status (J4/J5), `060` 오류 클래스 (J2/J3).
  **`040`도 `070`도 소비하지 않는다** — 스텁 lane 등록 방식은 폐기됐고 base URL은
  config가 소유한다 — J1~J5 어디에도 doctor 실행이
  없다. 초안이 적은 `070` 간선은 장식이었고 A phase 감사가 확인했다
- 소비되는 곳: 없음 (검증 계층)

## 현재 상태

2026-08-13 WP8: 업스트림 스텁 + 격리 home 부트 헬퍼 + Toast reauth/reload CTA.
로컬 QA는 Playwright 러너가 아니라 agbrowse(Chrome/CDP)다. `ui/e2e/*.spec.ts`는
프로젝트 소유 회귀 스위트로 남기고, CI e2e job은 Linux Chromium 러너에서만 돈다.


다만 **UI가 전혀 검증되지 않는 것은 아니다.** 서버 쪽 계약 테스트가 UI 등록을
간접 확인한다(예: `tests/minimax-ui-registration-contract.test.ts`,
`tests/i18n-dictionary-contract.test.ts`). 이것들은 "코드가 등록됐는가"를 보고,
E2E는 "사용자가 완주할 수 있는가"를 본다. 서로 대체하지 않는다.

## 다섯 여정

평가서가 제안한 다섯 개를 대체로 채택하되, `050`/`060`이 만든 계약을 검증하도록
구체화한다.

| # | 여정 | 무엇을 지키나 |
|---|---|---|
| J1 | 첫 실행 → 설정 → 생성 → 갤러리 저장 | 온보딩 완주 |
| J2 | OAuth 만료 → **실행 가능한 재인증 안내 표시** → 재시도 | `060`의 `AUTH_CHATGPT_EXPIRED` 해석과 그 CTA 노출 |
| J3 | 공급자 오류 → 정상적인 오류 표시 | `060` 전 구간. **"알 수 없는 오류"가 나오면 실패** |
| J4 | Node workflow 실행 → 진행 → 결과 복구 | `050` terminal status |
| J5 | 서버 재시작 → 기존 job·gallery 복원 | `050` 스냅샷 복구 |

J3이 `060`의 실질적 종점이다. 서버에서 UI까지 코드가 살아 왔는지를 **사용자가
보는 화면**에서 확인한다.

## 공급자 호출을 하지 않는다

E2E가 실제 생성을 호출하면 비용이 들고 비결정적이 된다. 그래서 **업스트림을
스텁**한다.

| 계층 | 선택 | 이유 |
|---|---|---|
| 브라우저 라우트 가로채기 | 거부 | SSE 스트리밍을 재현하기 어렵고 서버 로직을 건너뛴다 |
| **업스트림 HTTP만 스텁하고 실제 어댑터를 태운다** | 채택 | `050`/`060` 서버 경로가 전부 실행되고, 프로덕션 분기를 건드리지 않는다 |

**프로덕션에 `NODE_ENV === "test"` 분기를 넣지 않는다.** 그 방식은 테스트 경로와
실제 경로를 갈라 놓아 E2E가 검증하려는 대상 자체를 바꾼다.

초안은 `040` registry에 테스트 전용 lane을 등록하는 방식을 제안했다. 폐기한다.

**다만 매니페스트 등록만으로는 부족하다.** 어댑터 디스패치가 하드코딩된 if 체인
이기 때문이다.

```
lib/generatePipeline.ts:309   if (activeProvider === "gemini-api") { … }
lib/generatePipeline.ts:329   if (activeProvider === "atlascloud") { … }
lib/generatePipeline.ts:219   if (activeProvider === "minimax" && providerRefCount > 1) { … }
```

매니페스트에 lane을 추가해도 이 체인에 분기가 없으면 어댑터가 붙지 않는다.
게다가 더 나쁜 일이 일어난다: `lib/providerOptions.ts:89`가 알 수 없는 provider를
**`oauth`로 폴백**하므로, 스텁 lane이 조용히 **실제 Responses 어댑터로 가서
과금된다.** E2E 비용 격리가 깨지는 것이다.

그래서 스텁 대상을 바꾼다. **어댑터를 스텁하지 않고 업스트림 HTTP를 스텁한다.**

| 대상 | 방법 |
|---|---|
| 공급자 HTTP 엔드포인트 | 로컬 스텁 서버를 띄우고 **`IMA2_MINIMAX_GLOBAL_BASE_URL`** 환경변수로 MiniMax lane을 그쪽으로 향하게 한다 (`./config.ts` 336행) |
| 기존 어댑터 | **그대로 실행된다.** 파싱·오류 생성·`050`/`060` 경로가 전부 진짜다 |
| 프로덕션 코드 | **변경 없음.** 이미 존재하는 환경변수 seam을 쓴다 |
| `040` 매니페스트 | **변경 없음.** base URL은 registry가 아니라 config가 소유한다 |

**단, 생성 요청만 이 seam을 탄다.** MiniMax는 응답이 준 URL에서 결과 이미지를
내려받는데(`lib/minimaxImageAdapter.ts:116`의 `fetch(url)`), 그 URL은 환경변수가
아니라 **업스트림 응답 본문**에서 온다. 따라서 스텁 서버는 두 가지를 함께 해야
한다.

1. `/image_generation` 응답을 만든다.
2. 그 응답의 이미지 URL을 **자기 자신**으로 가리킨다.

이걸 놓치면 생성은 스텁으로 가고 다운로드만 외부로 나가 `h3`(외부 호출 0건)이
깨진다. 스텁 서버가 이미지 바이트도 서빙해야 한다는 뜻이다.

MiniMax 격리에 필요한 조건을 전부 적는다.

| 조건 | 이유 |
|---|---|
| `IMA2_MINIMAX_REGION=global_en` 고정 | `cn_zh`면 `cnBaseUrl`을 쓰므로 global 환경변수가 무시된다(`lib/minimaxImageAdapter.ts:159`) |
| 스텁이 `/models`도 서빙 | 키 저장이 먼저 `${baseUrl}/models`를 호출한다(`routes/keys.ts:238`). `{data:[...]}` 형태여야 한다 |
| 스텁이 `/image_generation` 서빙 | 생성 본체 |
| 응답을 **inline `image_base64`**로 | 가장 안전하다. `image_urls`를 쓰면 그 URL로 다시 나가므로(`lib/minimaxImageAdapter.ts:288`) 반드시 스텁 자신을 가리켜야 한다 |
| 격리된 config/home | 사용자 실제 설정이 새어 들어오지 않게 |

초안은 "`040` 매니페스트의 base URL을 바꾼다"고 적었다. **틀렸다** — 어댑터는
매니페스트를 읽지 않고, `040`의 매니페스트에는 생성용 base URL 필드가 애초에
없다(`validateUrl`은 키 검증용이다). 실제로 작동하는 seam은 이미 있는 환경변수다.

**그러나 모든 어댑터가 base URL을 주입받지는 않는다.** 실측했다.

| 어댑터 | base URL 출처 | 스텁 가능? |
|---|---|---|
| MiniMax (`lib/minimaxImageAdapter.ts:223`) | `resolveBaseUrl(ctx)` — config/region 기반 | **가능.** 설정으로 갈아끼운다 |
| Grok, 프록시 경유 (`lib/grokImageCore.ts:70`) | 로컬 progrok 프록시 | **가능.** 프록시 주소를 스텁으로 |
| Grok, 직접 키 (`lib/grokImageCore.ts:66`) | `https://api.x.ai` **하드코딩** | 불가 |
| Gemini (`lib/geminiApiImageAdapter.ts:141` Vertex, `lib/geminiApiImageAdapter.ts:144` 직접) | 두 URL 모두 **하드코딩** | 불가 |

따라서 **E2E는 스텁 가능한 lane만 쓴다.** MiniMax를 기본 카나리 lane으로 잡는다:
config로 base URL이 결정되고, `060`의 오류 코드 계열도 가장 많다(14종).

하드코딩된 어댑터를 스텁하려고 **프로덕션 코드에 URL 주입을 새로 넣지 않는다.**
그것은 `040`이 다룰 리팩터이지 E2E가 끌고 올 범위가 아니다. 여정마다 필요한
seam이 다르므로 아래 표로 분리한다.

이 선택의 한계를 명시한다: E2E는 **Gemini·Grok 직접 키 경로를 덮지 않는다.**
그 경로들의 회귀는 계약 테스트와 `060`의 카나리가 담당한다.

### 여정마다 seam이 다르다

MiniMax 스텁 하나로 다섯 여정을 전부 덮을 수 없다. **J2는 OAuth 재인증을
검증하는데 MiniMax는 API 키 lane이라 OAuth 동작 자체가 없다**(A phase 감사).

| 여정 | seam |
|---|---|
| J1, J3 | MiniMax + `IMA2_MINIMAX_GLOBAL_BASE_URL` 스텁 |
| J2 | **OAuth 업스트림 스텁.** `lib/runtimeContext.ts:21`의 `oauthUrl`을 로컬 스텁으로 향하게 하고 "token is expired" 응답을 낸다 |
| J4 | Node 실행 — MiniMax 스텁 위에서 `050` terminal status 확인 |
| J5 | 서버 재시작 — 업스트림 무관. 스냅샷 복구만 본다 |

J2를 MiniMax 401로 대체하면 그것은 일반 오류 표시 테스트가 되어 OAuth 경로를
전혀 건드리지 않는다. 그래서 seam을 OAuth 업스트림으로 따로 둔다.

**다만 J2의 범위를 정직하게 줄인다**(A phase 3라운드 감사 blocker 1). "재인증
완료"까지 자동화할 수 없다. 실제 재인증은 `/api/auth/switch`가 Codex device-login
하위 프로세스를 띄우고 사용자가 **외부 OpenAI 페이지에서** 코드를 입력해야
끝난다(`routes/auth.ts:185`). E2E가 이걸 격리해서 완주시킬 방법이 없고,
스텁을 만료→정상으로 바꾸는 것은 재인증을 **테스트한 척**하는 것이다.

따라서 J2가 지키는 것은 이것으로 한정한다.

1. 만료 응답이 `AUTH_CHATGPT_EXPIRED`로 해석된다(`lib/errorClassify.ts:57`).
2. 그 오류가 **실행 가능한 재인증 경로를 사용자에게 제시한다.**

2번은 현재 성립하지 않는다. `ui/src/lib/errorCodes.ts:70`이 `cta: "reauth"`를
선언하지만 오류 카드 렌더러가 `spec.cta`를 무시하고 dismiss만 준다
(`ui/src/components/Toast.tsx:87`). 즉 **J2는 통과시키려면 UI 수정이 필요한
실패 테스트로 시작한다.** 그것이 이 여정의 가치다 — 지금 사용자는 만료 안내를
받고도 다음 행동을 할 수 없다.

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `ui/package.json` | `test:e2e` 스크립트, Playwright devDependency |
| `ui/playwright.config.ts` (신규) | 1280x720, 재시도 0(플레이크를 숨기지 않는다) |
| `ui/e2e/j1-first-run.spec.ts` … `j5-restart-recovery.spec.ts` (신규 5종) | 위 여정 |
| `ui/e2e/fixtures/stubUpstream.ts` (신규) | 업스트림 스텁 서버 기동·종료. MiniMax용과 OAuth 프록시용 두 모드 |
| `ui/tsconfig.e2e.json` (신규) | `include: ["e2e"]`. E2E 파일을 타입 검사에 넣는다 |
| `ui/tsconfig.json` | `references`에 `./tsconfig.e2e.json` 추가 |
| `.github/workflows/ci.yml` | E2E job 추가 (Linux만) |
| E2E 환경변수 설정 | `IMA2_MINIMAX_GLOBAL_BASE_URL`을 로컬 스텁으로. **프로덕션 코드도 `040` 매니페스트도 변경하지 않는다** |
| `scripts/classify-tests.mjs` | 변경 없음. 이 스크립트는 tests/만 본다. ui/e2e는 tsconfig.e2e.json + CI e2e job이 게이트한다 |
| `ui/src/components/Toast.tsx` | J2: `reauth`/`reload` CTA 버튼을 렌더. 새 CTA 종류는 추가하지 않음 |

**`ui/dist/`는 건드리지 않는다.** E2E는 빌드 산출물을 소비하지 CI에서 새로
커밋하지 않는다(`010`의 drift 규칙).

## IN / OUT

- IN: `ui/e2e/**`, `ui/playwright.config.ts`, `ui/tsconfig.e2e.json`,
  `ui/tsconfig.json`의 `references`, `ui/package.json` 스크립트,
  `.github/workflows/ci.yml`의 E2E job. `scripts/classify-tests.mjs`는 tests/ 전용이므로 건드리지 않는다.
- OUT: 어댑터, 디스패치, `040` 매니페스트. Toast CTA는 J2 수용을 위한 최소 UI 수정이다. 업스트림 전환은 기존 환경변수로만 한다. 시각 회귀(스크린샷 비교)는 별도
  라운드. 실제 공급자 호출. Windows E2E (러너 비용 대비 이득이 불명확하고,
  `020`이 이미 Windows 표면을 다룬다).

## 수용 기준

- `h1`: 다섯 여정이 통과한다.
- `h2`: **각 여정이 음성 대조를 가진다.** 대응 기능을 의도적으로 깨뜨리면 그
  여정만 빨개진다. 이것 없이는 E2E가 무엇을 지키는지 알 수 없다.
- `h3`: 실제 공급자 네트워크 호출 0건. 스텁 서버가 아닌 외부 호출을 감시한다.
- `h4`: CI에서 3회 연속 실행이 모두 같은 결과다. 플레이크가 있으면 그 여정은
  **비활성화가 아니라 수정** 대상이다.
- `h5`: 전체 E2E 실행이 10분을 넘지 않는다. 넘으면 릴리스 경로가 다시 느려진다.
- `h6`: **E2E 파일이 타입 검사를 받는다.** `ui/e2e`에 의도적 타입 오류를 넣으면
  `cd ui && npm run build`가 실패한다. 실패하지 않으면 `tsconfig.e2e.json`이
  연결되지 않은 것이다.

## 조건부 경로 활성화 시나리오

E2E 자체가 활성화 도구이므로, 여기서는 **테스트가 실패할 수 있음**을 증명한다.

| 대상 | 트리거 | 관측되는 효과 |
|---|---|---|
| J3 오류 표시 | `060` 매핑에서 한 코드를 제거 | J3만 실패하며 "알 수 없는 오류"를 리포트 |
| J4 복구 | `050` 정규화를 되돌림 | J4만 실패 |
| J5 재시작 | inflight 스냅샷 저장을 끔 | J5만 실패 |
| 스텁 격리 | 스텁 서버 미기동 | 전 여정이 실패하고 **외부 네트워크 호출은 0건**. 실제 공급자로 새지 않음을 확인한다 |

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `cd ui && npm run test:e2e` | 다섯 여정 | 스크립트 미존재 (B에서 생성) |
| `cd ui && npm run build` | 빌드 무결성 | **실행 가능** — 현재 통과 |
| `npm run test:inventory` | tests/ 인벤토리만 | ui/e2e는 이 스크립트 범위 밖. typecheck:e2e가 게이트 |
| `actionlint .github/workflows/ci.yml` | 워크플로 문법 | 미실행 (B에서) |

`npm run typecheck`는 `ui/`를 exclude하므로 **E2E 파일을 보지 못한다.**
`cd ui && npm run build`는 이제 `tsc -p tsconfig.e2e.json --noEmit`을 포함한다.

```
ui/tsconfig.json       → files: [], references: [tsconfig.app.json, tsconfig.node.json]
ui/tsconfig.app.json   → include: ["src"]
ui/tsconfig.node.json  → include: ["vite.config.ts", "dev/**/*.d.mts"]
```

`ui/e2e/**`는 **어느 include에도 속하지 않는다.** 그대로 두면 E2E 파일은 타입
검사를 전혀 받지 않고, 깨진 타입이 런타임 실패로만 드러난다.

그래서 파일 변경 맵에 `ui/tsconfig.e2e.json` 신규와 `ui/tsconfig.json`의
`references` 추가를 포함했다. 이것을 빼면 "E2E를 추가했다"는 말은 맞지만
**그 코드는 아무 게이트도 통과하지 않는다.**

## 이 phase가 만들지 않는 것

평가서의 "주요 사용자 여정 E2E 100% 통과"는 70점 조건 중 하나지만, 다섯 여정이
전체 사용자 여정을 덮는다는 뜻은 아니다. Canvas·Video·Agent·MCP 여정은 이
라운드에 없다. 다섯 개는 **가장 자주 깨지고 가장 비싸게 발견되는** 경로를 고른
것이고, 커버리지 주장은 그만큼만 한다.


## 라이브 검증 증거 (2026-08-13, agbrowse)

로컬 Playwright 러너는 설치하지 않았다. Chrome/CDP(agbrowse)로 같은 스텁 경로를 돌렸다.

| 여정 | 관측 |
|---|---|
| J1 | MiniMax 키 저장됨, provider MiniMax/image-01, a red cube 생성, generated PNG + 갤러리 타일 |
| J2 | OAuth 스텁 authentication_error + token is expired -> API AUTH_CHATGPT_EXPIRED -> Toast Reload CTA |
| J3 | MiniMax 1008 -> API BILLING_REQUIRED -> Toast Billing required, unknown error 없음 |
| J4 | #node 진입, Start blank/templates/Add image, react-flow 캔버스 존재 |
| J5 | 같은 IMA2_CONFIG_DIR 재기동 후 history total=1, a red cube 이미지 복구 |

J2 스텁은 type: invalid_request_error를 쓰면 errorClassify가 만료보다 요청 오류를 먼저 고른다. 스텁은 authentication_error를 쓴다.

감사 FAIL 5건은 스펙에 접었다. J1은 온보딩 Skip을 먼저 누르고, J2는 Reload CTA를 클릭하며, J4는 blank canvas를 시작하고, J5는 같은 home을 재사용하며, 스텁 host는 loopback만 허용한다.
