---
created: 2026-08-23
updated: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, roadmap]
aliases: [comfy provider lane, ComfyUI 프로바이더 레인]
---

# 000 — ComfyUI provider lane: 로드맵과 근거

## Objective

ima2가 로컬 ComfyUI를 **호출해서** 이미지를 받아오는 provider 레인
`comfy`를 만든다. 셀렉터에서 oauth/api/grok/grok-api/agy/gemini-api/
atlascloud/minimax 옆에 서고, 등록된 워크플로 하나가 모델 한 줄이 된다.

이 유닛은 docs-only다. 프로덕션 코드는 다음 사이클(wp1)부터 건드린다.

## 왜 지금 이게 없는가 (실측)

현재 저장소의 comfy 표면은 **둘 다 ima2가 생성 주체**다.

| 방향 | 구현 | 근거 |
|---|---|---|
| ComfyUI → ima2 | 커스텀 노드가 `POST /api/generate` 호출 | `integrations/comfyui/ima2_gen_bridge/nodes.py:120` |
| ima2 → ComfyUI | 완성 이미지를 `/upload/image`로 업로드 | `lib/comfyBridge.ts:219` `exportImageToComfy` |

"ima2가 ComfyUI에 생성을 시켜서 결과를 받는" 경로는 **한 줄도 없다**.
셀렉터에 comfy가 없는 건 누락이 아니라 그 방향이 구현된 적이 없어서다.

## v1 shim을 쓰지 않는 이유

grok 레인은 `progrok`이라는 **이미 존재하는** OpenAI 호환 `/v1` 바이너리를
번들하고 ima2는 감시만 한다(`lib/grokProxyLauncher.ts`: spawn, 지수 백오프,
`waiting-for-login` 상태 분리, 리슨 라인 파싱 — 325줄).

ComfyUI에는 그런 게 없다. 현재 master 트리(1236 파일)에 `/v1/images`
경로가 존재하지 않는다. `comfy_api_nodes/nodes_openai.py`는 OpenAI를
**호출하는** 파트너 노드이고, `comfy_api/v0_0_1`은 내부 노드 API
버저닝이지 REST `/v1`이 아니다.

따라서 shim을 만든다면 워크플로 바인딩과 폴링 로직을 **똑같이** 작성한
뒤 spawn·포트충돌·재시작 백오프·헬스프로브를 추가로 떠안는 구조가 된다.
게다가 OpenAI 이미지 스키마에는 "어느 워크플로의 어느 노드에 바인딩"을
표현할 자리가 없다. 껍데기 값이 마이너스다.

**결정: 네이티브 어댑터(L1). 추가 프로세스 0개.**

## ComfyUI 프로토콜 사실 (2026-08-23 조사, 2차 근거)

출처: `comfyanonymous/ComfyUI` master 소스 + docs.comfy.org.
최초 작성 시점에는 로컬 인스턴스가 없어 2차 근거뿐이었으나, 같은 사이클에서
`ssh lidge`(RTX 5090)에 ComfyUI 0.27.0을 띄워 **실기 검증을 마쳤다** —
제출·폴링·수신·취소·PNG 임베드까지. 기록은 `001_live_probe_evidence.md`,
생성물은 `evidence/001_live_generate_768.png`.

다만 **다중 인스턴스 시나리오는 여전히 미검증**이다(8189는 ComfyUI가 아닌
`comfyui_hooking_server`가 점유). origin-per-record 설계의 N대 부분과
prompt_id의 인스턴스 로컬성은 2차 근거로 남는다.

| 엔드포인트 | 계약 | 근거 |
|---|---|---|
| `POST /prompt` | `{prompt, client_id?, prompt_id?, extra_data?, front?, number?}` → `{prompt_id, number, node_errors}` | server.py:1072-1144 |
| `GET /history/{id}` | 완료 후에만 키 존재. `{outputs, status:{status_str,completed,messages}}` | server.py:1045, execution.py:1281 |
| `GET /view` | `?filename&subfolder&type` (output/input/temp) | server.py:516 |
| `GET /queue` | `{queue_running[], queue_pending[]}`, 항목은 튜플, `[1]`이 prompt_id | server.py:1064 |
| `POST /interrupt` | 빈 body면 전역 중단. `{prompt_id}`면 **running일 때만** | server.py:1146 |
| `POST /queue {delete:[id]}` | **pending만** 삭제. running은 못 건드림 | execution.py:1346 |
| `GET /system_stats` | `{system, devices[]}`. 큐 부작용 없음 | server.py:686 |
| `POST /upload/image` | multipart `image`, `type`, `subfolder`, `overwrite` → `{name, subfolder, type}` | server.py:397 |
| API-format 그래프 | `{"3":{inputs, class_type, _meta}}` 평면 맵 | workflow-api-format.md |
| PNG 메타 | tEXt `prompt` = API 그래프, `workflow` = UI 저장본 | nodes.py:1699 |
| 동시성 | 워커 스레드 1개, 힙에서 하나씩 blocking 실행 | main.py:378-421 |

### 설계를 바꾼 사실 셋

**(1) `prompt_id`를 클라이언트가 지정할 수 있다.** canonical UUID면 받는다
(아니면 400 `invalid_prompt_id`). 즉 ima2의 `requestId`가 UUID 형식이면
그대로 넘겨 상관 추적을 단순화할 수 있다 — 단 requestId 형식 검증이 선행
과제다. 형식이 안 맞으면 서버 생성 id를 받아 meta에 저장한다.

**(2) 취소는 상태에 따라 엔드포인트가 갈린다.** running이면 `/interrupt`,
pending이면 `/queue {delete}`. **문서와 코드가 불일치**한다(docs는 /queue가
running도 지운다고 적었지만 코드는 pending만 지운다). 코드가 맞다 —
실기로 확인했다: running에 delete를 쏘면 **HTTP 200을 받고도 작업이 계속
돈다**(001 §검증4). 성공 응답이 취소를 의미하지 않으므로, 취소 확인은
응답 코드가 아니라 `/queue` 재조회로 해야 한다.

추가 실측: 중단된 작업도 history에 남고 `status_str: "error"`,
`completed: false`다. **history 존재만으로 성공을 판정하면 안 된다.**

**(3) `/history`는 완료 전에는 키 자체가 없다.** 404가 아니라 `{}`.
"없음"은 "실행 중"과 "존재한 적 없음"을 구분하지 못하므로, 폴링 루프는
`/queue`로 존재를 교차 확인해야 유령 대기를 피한다.

### 로컬 코드와 충돌한 사전 가정 하나

앞선 대화에서 "저장소에 PNG-info 파서가 이미 있으니 ComfyUI PNG에서
워크플로를 추출할 수 있다"고 판단했다. **틀렸다.** `lib/pngInfo.ts`는
26줄이고 IHDR만 읽는다(width/height/bitDepth/colorType). tEXt 청크
파싱은 없다. → `--from-image`는 신규 tEXt 리더 구현이 필요하고,
wp1으로 배정한다.

## 정적 레지스트리 문제 (핵심 결정 #1)

`lib/providers/registry.ts`는 `as const satisfies`이고
`CoreProviderId`가 거기서 파생된다. comfy 모델은 런타임 등록이다.

### 실측된 마찰 지점

9번째 레인이 건드리는 지점 전수 목록이다. 초판은 이 표에 4곳만 적었는데,
`=== "minimax"` 형태의 **명시 비교만** grep한 결과였다. A-phase 감사가
**default 분기와 전수 순회**를 짚어냈다(002 §RC-1).

테스트(6):

| 파일:행 | 어서션 |
|---|---|
| `tests/provider-registry-contract.test.ts:17` | 8-id 배열 정확 일치 |
| `tests/provider-registry-parity.test.ts:12` | `CORE_IDS` 8개 |
| `tests/provider-registry-parity.test.ts:55` | 레인별 모델 **개수** 맵 |
| `tests/doctor-provider-contract.test.ts:25` | `lanes.length === 8` |
| `tests/models-endpoint-contract.test.ts:118` | lanes 키 10개 정확 일치 |
| `tests/provider-adapter-v1-contract.test.ts:57,87,134` | 어댑터 전수 순회 + **키 있음/없음 2상태** |
| `tests/cli-feature-parity-contract.test.js:97` | docs/CLI.md provider 목록 |

프로덕션(4) — 전부 **default 분기**라 컴파일 에러 없이 조용히 오작동한다:

| 파일:행 | default가 하는 일 | 증상 |
|---|---|---|
| `bin/lib/doctor-providers.ts:87` | `inspectLocalCli` → URL에 `existsSync` | "local CLI override missing" |
| `ui/src/lib/imageModels.ts:95` | `OPENAI_IMAGE_MODEL_OPTIONS` | comfy 선택 시 GPT 모델 목록 |
| `ui/src/store/storeSettingsImpl.ts:383` | 긴 부정 조건의 else | 모델이 `gpt-5.6-luna`로 남음 |
| `lib/providerOptions.ts:89` | `provider === "api" ? "api" : "oauth"` | **comfy가 조용히 oauth로 대체** |

마지막 항목이 가장 위험하다. 사용자는 ComfyUI를 골랐는데 GPT가 생성한
이미지를 받고, 아무 에러도 보지 못한다. 030이 comfy 분기를 넣어 generate/
edit는 막지만, multimode/node/agent는 이번 범위 밖이므로 **명시적 거부
가드**를 넣는다(030 §6.5).

그리고 UI 타입에 함정이 있다. `ui/src/types.ts:16-20`은
`Extract<ImageModelId, \`prefix-${string}\`>` 패턴이다. 모델이 0개인
prefix를 새로 만들면 그 별칭은 `never`가 되고, 그 타입으로 옵션을
할당하는 순간 TS가 깨진다. → **comfy는 새 prefix 별칭을 만들지 않는다.**

### 채택안: models: [] + 런타임 카탈로그 오버레이

`REGISTRY`에 comfy를 `models: []`로 등록하고, 실제 목록은
`routes/models.ts`의 lane 빌더가 워크플로 스토어에서 읽어 채운다.

근거: 같은 성격의 문제를 이 저장소가 이미 한 번 풀었다.
`lib/mcp/providerRegistry.ts`의 `catalogAccess: "connected"`(higgsfield)가
"연결 전에는 빈 목록, 연결 후 런타임 조회"다(`routes/models.ts:310-320`).

**단 같은 필드가 아니다.** MCP 쪽은 `McpCatalogAccess = "static" | "connected"`
이고 별도 모듈의 별도 타입이다. 코어 매니페스트에 넣는 것은
`"static" | "runtime"`으로 **새로 정의하는 필드**다. 이름이 비슷해
`routes/models.ts`의 MCP 분기에 코어 레인을 잘못 물리기 쉽다 — 두 분기를
섞지 않는다.

`deriveModelsFrom`은 빈 배열에 대해 빈 Set을 반환하고 예외를 던지지
않는다(`lib/providers/deriveCore.ts`) — 즉 빈 models는 파생 계층에서
합법이다.

### 기각한 대안

- **레지스트리를 런타임 가변으로 바꾸기**: `CoreProviderId` 리터럴 유니온이
  붕괴해 14개 임포터가 전부 `string`으로 느슨해진다. 손해가 이득보다 크다.
- **워크플로마다 provider id 생성**: 사용자 결정과 정면 충돌(#1: 워크플로는
  모델이지 provider가 아니다). 코드젠·UI·설정이 전부 N배로 늘어난다.
- **모델 검증을 우회(아무 문자열 허용)**: `normalizeXImageModel` 계열의
  거부 계약이 comfy에서만 사라져 오타가 500으로 나타난다.

## 워크플로 = 모델, origin은 레코드마다

```jsonc
// ~/.ima2/comfy/workflows.json
{
  "id": "kukuru",
  "label": "쿠쿠루삥뽕",
  "origin": "http://127.0.0.1:8188",
  "graph": { "3": { "class_type": "KSampler", "inputs": { } } },
  "bind": {
    "prompt": { "node": "6", "input": "text" },
    "width":  { "node": "5", "input": "width" },
    "height": { "node": "5", "input": "height" },
    "seed":   { "node": "3", "input": "seed" },
    "refImage": { "node": "10", "input": "image" },
    "output": { "node": "9" }
  },
  "params": [ /* 바인딩되지 않은 입력의 파라미터 계약 */ ]
}
```

origin을 레코드에 넣는 이유: 인스턴스 1대와 N대(8188 SDXL + 8189 Flux)가
**같은 코드 경로**가 된다. `config.comfy.defaultUrl`(config.ts:388)은
등록 시 기본값으로 강등한다. 기존 `export-image`는 그대로 둔다.

`normalizeComfyOrigin()`(lib/comfyBridge.ts:33)이 이미 http + 루프백 +
포트 필수를 강제하므로 검증기를 그대로 재사용한다.

바인딩 후보는 `class_type`으로 추론하되 **사용자 확정**이 필요하다.
`CLIPTextEncode`가 보통 positive/negative 2개라 자동 판별이 불가능하다.

## 큐잉 책임 분담

```
ima2 inflight (MAX_CONCURRENT_JOBS=24)   ComfyUI /prompt 큐
= 접수 창구                              = 실제 작업대 (워커 1개, 순차)
```

GPU 스케줄링은 ComfyUI가 한다. ima2가 1개씩 직렬화하면 방해다.
작업 추적은 ima2가 한다 — SSE·인플라이트·취소·재접속 복구가 전부
`requestId` 기준이기 때문이다.

**prompt_id는 origin과 쌍으로 저장한다.** prompt_id는 인스턴스 로컬이라
8188의 id를 8189에 물으면 없다고 나온다.

### 미해결 위험: TTL vs 깊은 GPU 큐

`purgeStaleJobs`(lib/inflight.ts:438)는 TTL(90분) 초과 행을 DELETE만 하고
**워커를 중단시키지 않는다**. 로컬 GPU 대기열은 밤새 쌓일 수 있다.
grok 비디오에서 10분 TTL이 살아있는 잡을 지운 사고가 config.ts:275 주석에
남아 있다. wp3에서 이 상호작용을 실측하고 처분을 기록한다.

## Work-phase map (의존 순서)

| WP | decade | 내용 | 의존 |
|---|---|---|---|
| wp0 | 000 | 본 로드맵 (docs-only) | — |
| wp1 | 010 | 워크플로 스키마·스토어·레지스트리 이음매·tEXt 리더 | — |
| wp2 | 020 | `comfyImageAdapter` 제출/폴링/수신/취소/헬스 | 010 |
| wp3 | 030 | 파이프라인·라우트·inflight meta | 020 |
| wp4 | 040 | CLI 워크플로 서브커맨드 | 030 |
| wp5 | 050 | UI 설정 관리자·셀렉터·동적 파라미터·4개국어 | 030 |
| wp6 | 060 | 문서/SoT·전체 게이트·dev 머지 | 040,050 |
| wp7 | 070 | multimode/node/agent 표면 — **이번 머지 범위 밖, 060 이후로 이연** | 060 |

wp7은 A-phase 감사(#10)에서 추가됐다. **이번 유닛의 머지 경계는 wp6까지**다:
classic generate + edit만 comfy를 지원하고, 나머지 세 표면은 명시적
400으로 거부한다(030 §6.5).

070 문서는 지금 **diff-level이 아니며**, 그 사실을 문서 안에 명시했다.
대상 코드가 wp1~wp6에서 이동하기 때문이다. DIFFLEVEL-ROADMAP-01 기준으로
이는 **미충족 상태를 라벨한 것**이지 면제가 아니고, 승격 시점은 wp7의 P다.

각 WP는 독립적으로 검증 가능하다: wp1은 스토어 계약 테스트, wp2는 stub
fetch 어댑터 테스트, wp3은 라우트 계약, wp4는 CLI parity, wp5는 i18n
coverage + 렌더 관찰, wp6은 전체 게이트.

## Scope

**IN**: `lib/providers/*`, `lib/comfyImageAdapter.ts`(신규),
`lib/comfyWorkflowStore.ts`(신규), `lib/comfyGraphBind.ts`(신규),
`lib/comfyPngWorkflow.ts`(신규), `lib/comfyBridge.ts`,
`lib/generatePipeline.ts`, `lib/providerOptions.ts`, `lib/imageModels.ts`,
`routes/comfy.ts`, `routes/models.ts`, `routes/edit.ts`, `config.ts`,
`lib/configKeys.ts`, `bin/commands/comfy.ts`, `ui/src` 설정·셀렉터,
i18n 4종, `tests/`, `docs/API.md`, `docs/CLI.md`, `structure/`.

**OUT**: push·원격 브랜치·태그·publish·릴리스·버전 범프. 사용자 dirty
파일 `docs/grok-video-i2v-research.md` 무수정. 추가 자식 프로세스.
`/v1` shim. runway/higgsfield MCP 어댑터 변경. 비디오 생성(ComfyUI
비디오 워크플로는 후속 유닛).

## Verifier (실행 확인 완료)

| 명령 | 이 유닛의 대상을 읽는가 |
|---|---|
| `npm run typecheck` | wp1+ 예 — 단 **server만**. include는 server/config/lib/routes/bin/types이고 `ui`가 없다 |
| `cd ui && npx tsc -p tsconfig.app.json --noEmit` | wp5 예 — **UI 타입을 증명하는 유일한 명령** |
| `node scripts/refresh-structure-line-counts.mjs --check` | wp6 예 (01 파일맵 등재 후) |
| `npm run typecheck:tests` | wp1+ 예 |
| `npm test` | 예 |
| `npm run test:inventory` | 신규 테스트 파일 등록 강제 |
| `node scripts/generate-provider-types.mjs --check` | **예 — registry.ts 변경 시 필수** |
| `cd ui && npm run build` | wp5 예 |
| i18n-coverage-contract | wp5 예 (4개국어 강제) |
| api-docs-contract / cli-feature-parity | wp4/wp6 예 |

wp0(본 문서)은 프로덕션 코드를 바꾸지 않으므로 위 게이트가 관찰하는
대상이 없다. **이 유닛의 accept는 문서 존재와 diff-level 충족이며,
게이트가 지켜주지 않는다** — 사람 리뷰 항목이다.

## Enforcement bypass (PLAN-BYPASS-NAMED-01)

| 항목 | 값 |
|---|---|
| tier | E2 (CI 스크립트 게이트) |
| 실행 표면 | `.github/workflows/ci.yml:70`, `pr-fast.yml:44` |
| 알려진 우회 | 로컬 커밋은 CI를 거치지 않는다. 이 유닛은 push하지 않으므로 **로컬에서 게이트가 자동 실행되지 않는다** |
| 잔여 위험 | 수동으로 게이트를 돌리지 않으면 stale 생성 파일이 로컬 dev에 머문다 |
| 문구 강등 | "enforcement"가 아니라 **early warning**. wp6에서 게이트를 손으로 실행해 증거를 남긴다 |
| 최종 강제 계층 | none (push 전까지) |
