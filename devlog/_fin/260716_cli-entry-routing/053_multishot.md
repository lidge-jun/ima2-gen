# 053 — wp5 슬라이스 2: generate_multishot_video 실행 경로 (diff-level)

상위 스펙: 051 결정 4, 050 multishot 행. wp5c-multishot work-phase 명세.

## 051 결정점 해소 (2026-07-20, 현재 트리 근거)

**결정: 독립 표면.** 근거: ima2의 storyboard는 Grok 비디오 플래너의 프롬프트 플래그
(routes/video.ts:178-182, per-shot 구조 없음)이고 node-studio branch도 shot 리스트
데이터 모델이 아니다. 매핑할 shots[] 소스가 존재하지 않으므로 결합은 데이터 모델
선행 없이는 불가 — multishot은 auto(storyPrompt)/custom(--shot[])을 직접 받는
독립 경로로 두고, storyboard 결합은 shots 데이터 모델이 생기면 별도 유닛으로 연다.

## 스키마 확정 (runway.json snapshot, 2026-07-20)

`generate_multishot_video`: mode auto|custom, storyPrompt(auto 필수),
shots[](custom 필수, 3-5), duration 5|10|15, aspectRatio 16:9|1:1|9:16,
resolution 720p|1080p(기본 720p=Standard), sound(기본 true),
firstSceneImage 선택.

## 설계 — 전용 라우트 (media-action 부적합)

media-action은 files[](소스) 필수인데 multishot은 무소스 생성이다.
새 라우트 모듈로 분리하고 잡 파이프라인은 재사용한다.

### 1. MODIFY `lib/mcp/adapters/runway.ts`

`buildMultishotCall(input: { storyPrompt?: string; shots?: string[];
duration?: 5|10|15; aspectRatio?: string; resolution?: "720p"|"1080p";
sound?: boolean; firstSceneImageUrl?: string }): ToolCallPlan` 추가:

- mode = shots?.length ? "custom" : "auto"
- custom인데 shots가 3-5가 아니면 throw MCP_REQUEST_INVALID(큰따옴표 계약 —
  adapter의 기존 invalid 패턴 준용).
- args = { rationale, mode, ...(auto ? { storyPrompt } : { shots }),
  ...(duration ? { duration } : {}), ...(aspectRatio ? { aspectRatio } : {}),
  ...(resolution ? { resolution } : {}), ...(sound !== undefined ? { sound } : {}),
  ...(firstSceneImageUrl ? { firstSceneImage: { url } } : {}) }

### 2. NEW `routes/mcpMultishot.ts`

`POST /api/mcp/multishot` — mcpMedia.ts의 generate 골격을 따른다:

- executable/connected 가드 동일(MCP_EXECUTION_LOCKED/MCP_NOT_CONNECTED).
- body: prompt(storyPrompt) | shots[](3-5), duration, aspectRatio, resolution,
  sound, firstSceneFilename?(갤러리 이미지 → localMediaPath → upload).
- 검증: prompt 없고 shots 없으면 400 INVALID_MULTISHOT; shots 3-5 외 400.
- 실행: executePlan(manager, runwayAdapter, buildMultishotCall(...)) →
  download → commitMediaResult. meta: workflow: "video.multishot",
  mcpParameters: { mode, duration, resolution, shotCount? }.
- server.ts(또는 routes 등록부)에 registerMcpMultishotRoutes 추가.

### 3. CLI — MODIFY `bin/commands/video.ts` + `bin/lib/videoMcp.ts`

- MCP 레인 전용 플래그: `--multishot`(storyPrompt로 prompt 사용),
  `--shot <prompt>`(repeatable, 3-5 → custom), `--duration 5|10|15`,
  `--sound/--no-sound`, `--first-scene <generated-file>`.
- `--multishot`/`--shot`은 POST /api/mcp/multishot으로 라우팅(mcpJob 변형 —
  post 경로만 다름, editVideo의 runMcpActionJob을 공유화: postPath 인자).
- 코어 레인에서 사용 시 FLAG_NOT_SUPPORTED(기존 rejectMcpOnlyFlags 패턴).
- 기본값은 최저 설정: duration 생략 시 5를 명시, resolution 생략 시 720p 명시
  (CLI는 과금 친화적 기본을 강제 — UI/직접 API는 서버 기본).

### 4. UI — 범위 최소

multishot UI는 이번 슬라이스에서 만들지 않는다(CLI+API 먼저).
결과 카드는 일반 비디오 결과로 자연 표시. UI 표면은 후속 슬라이스 — 060에 기록.

## 계약 테스트 — NEW `tests/mcp-multishot.test.ts`

1. auto plan: storyPrompt+duration:5+resolution:720p 기본 주입.
2. custom plan: shots 3 → mode custom; shots 2 → 400; shots 6 → 400.
3. prompt/shots 동시 부재 → 400 INVALID_MULTISHOT.
4. firstSceneFilename → upload 호출 + firstSceneImage.url.
5. 실행 커밋 meta: workflow=video.multishot + mcpParameters.
6. higgsfield lane → MCP_EXECUTION_LOCKED(라우트 가드 회귀).

## Activation 시나리오

- custom/auto 분기: 테스트 1-2. firstScene 업로드: 테스트 4(upload 호출 관측).
- 라이브(최저 설정): mode auto, 짧은 storyPrompt, duration 5, 720p, 3 shots.
  과금 카운트: multishot 1.

## Accept

typecheck 2종 + 테스트 6건 + 라이브 1건 sidecar 증거(workflow/mcpParameters).
