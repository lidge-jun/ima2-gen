# 010 — wp1: CLI strict 라우팅 구현 (diff-level)

목표: bare `ima2 gen`/`ima2 video`가 kind별 기본 모델 계약으로만 실행되고, 레인 id 네임스페이스로
코어+MCP 전 모델을 CLI에서 호출 가능하게 한다. fail-closed, 자동 라우팅 없음.

## 1. NEW `bin/lib/modelResolver.ts`

단일 해석 진입점. gen.ts/video.ts가 공유.

```ts
export type Lane = "oauth"|"api"|"grok"|"grok-api"|"agy"|"gemini-api"|"runway"|"higgsfield";
export type ResolvedTarget = { lane: Lane; model: string; transport: "core"|"mcp" };

resolveTarget(kind: "image"|"video", flags: { model?: string; provider?: string }, catalog: ModelCatalog, defaults: CliDefaults): ResolvedTarget
```

해석 순서(인터뷰 A1/A2 확정):
1. `--model <lane>/<id>` → lane 확정, 카탈로그 존재+kind 일치 검증. 불일치 시 `MODEL_NOT_FOUND`/`KIND_MISMATCH`.
2. `--model <bare-id>` → 카탈로그에서 kind 내 유일하면 채택, 2개 이상이면 `MODEL_AMBIGUOUS`(+후보 나열), `--provider`가 있으면 그 lane으로 한정.
3. `--provider`만 → 그 lane의 kind 기본 모델(카탈로그 `laneDefault`)이 있으면 채택, 없으면 `NO_DEFAULT_MODEL`.
4. 아무것도 없음 → `defaults.<kind>` 조회. 없으면 `NO_DEFAULT_MODEL` (exit 2, 봉투 §5).
5. 해석된 lane이 locked/disconnected/key-missing → `LANE_UNAVAILABLE` (exit 2, 사유 포함). 자동 폴백 금지.

## 2. NEW `bin/commands/models.ts` + dispatch (`bin/ima2.ts`)

```
ima2 models [--kind image|video] [--lane <lane>] [--json]
```

- 데이터: `GET /api/capabilities`(코어) + `GET /api/mcp/providers` + `GET /api/mcp/providers/:id/models`(연결된 것만).
- 출력(사람): lane 그룹 테이블 — `lane  model-id  status  caps요약(duration/resolution/ratio)`.
- 출력(--json): `{ ok, kinds: { image: [...], video: [...] } }`, 각 항목 `{ lane, id, label, status: "ready"|"locked"|"disconnected"|"key-missing", capabilities }`. **stable contract — 에이전트 소비 전제, 필드 제거는 breaking.**
- 서버 다운: exit 3 + `{"ok":false,"code":"SERVER_UNREACHABLE"}` — 로컬 캐시 폴백 없음(stale 카탈로그로 defaults 설정 사고 방지).

## 3. MODIFY `bin/commands/defaults.ts`

- 신규 키: `defaults set image <lane>/<model>` / `defaults set video <lane>/<model>` / `reset image|video`.
- set 시 models 카탈로그로 검증: 존재+kind 일치+lane status ready 아닐 때 거부(exit 2, 사유). locked lane은 `--force`로도 불가(과금·계약 불가 상태).
- `defaults ls`에 image/video 기본값 표시. 저장 위치: 기존 CLI config 파일(`bin/commands/config.ts`가 쓰는 동일 스토어)에 `defaults.image`/`defaults.video` 키 — 신규 파일 만들지 않음(재스캔 모순 #4 해소).
- 기존 GPT oauth/api model/effort 키는 유지(하위호환), grok 기본 모델도 이 표면에서 조회 가능하게 노출만 추가.

## 4. MODIFY `bin/commands/gen.ts` / `bin/commands/video.ts`

gen.ts:
- `--provider` enum에 runway|higgsfield 추가. `--model`이 레인 id 문법 수용.
- 실행 전 `resolveTarget("image", ...)` 호출. transport "mcp"면 §6 경로로 분기, core면 기존 요청에 lane 매핑(oauth→provider oauth 등, 기존 body 계약 불변).
- zero-config 폴백(현행 서버 auto) **제거** — resolver가 유일한 진입.

video.ts:
- `provider:"grok"` 하드코딩 제거, resolver 사용. grok lane이면 기존 SSE 경로 그대로(요청 body 불변), runway lane이면 §6.
- `--duration/--resolution/--ar` 등 기존 플래그는 MCP 모델일 때 capability 검증을 **클라이언트에서 선실행**(카탈로그 parameters로) 후 `parameters`로 전달 — 서버 400 봉투(MCP_PARAMETER_*)는 그대로 표면화.
- grok 전용 플래그(planner-model 등)는 grok lane에서만 허용, 타 lane이면 exit 2 `FLAG_NOT_SUPPORTED`.

## 5. NEW JSON 에러 봉투 — MODIFY `bin/lib/output.ts`

```ts
failJson(code: string, extra?: object, exitCode = 2): never
// --json이면 stdout에 {"ok":false,"code",...extra} 출력 후 exit, 아니면 기존 die() 텍스트.
```

- `NO_DEFAULT_MODEL` 봉투에 `models`(=ima2 models --json의 해당 kind 축약)와 `fix` 명령 2줄 포함.
- exit code 계약: 2=사용자 해결 가능(설정/플래그), 3=서버/연결, 1=생성 실패(기존 유지). gen/video/models/defaults 4개 명령의 die() 호출을 failJson 경유로 정리(다른 명령은 wp 범위 밖).

## 6. NEW `bin/lib/mcpJob.ts` — MCP 비동기 브리지

- `POST /api/mcp/generate` → 202 `{requestId}` 수신.
- `GET /api/events?lastEventId=0` SSE 구독(routes/events.ts 계약: id/event/data+jobId), `jobId===requestId` 필터로 progress(phase) 표시 → `done`에서 filename/메타 수신, `error`에서 code 표면화.
- 타임아웃: image 5분/video 12분(서버 executeMediaJob과 동일값), `ima2 cancel <requestId>` 기존 명령과 연동되도록 requestId를 시작 직후 stderr(사람)/JSON(agent)에 즉시 출력.
- 결과 파일은 서버가 저장(generatedDir) — CLI는 `-o/--out-dir` 지정 시 다운로드 복사(`GET /files/<filename>`).

## 7. 테스트 (NEW `tests/cli-model-resolver.test.ts`, MODIFY `tests/cli-capabilities-contract.test.js`)

- resolver 단위: 5규칙×(성공/실패), 모호 id, kind 불일치, locked lane 거부.
- 봉투 계약: NO_DEFAULT_MODEL JSON shape, exit code 2/3 구분.
- models --json shape 고정(스냅샷성 계약), defaults set 검증 거부 경로.
- mcpJob: fake SSE 서버로 done/error/timeout 3경로.

## Accept (wp1)

1. bare `ima2 gen`/`ima2 video`가 기본값 없으면 exit 2 + 그룹 리스트 + fix 명령(사람/JSON 양쪽).
2. `ima2 gen -p .. --model runway/gen-4` 와 `ima2 video --model runway/veo-3.1 --duration 8`이 202→SSE 대기→파일 경로 출력까지 동작(스모크는 무과금 에러/검증 경로, 실생성은 승인 시 1건).
3. `ima2 models --json`이 lane 가용성 분리 표기로 코어+MCP 전 모델 반환.
4. typecheck + 신규 계약 테스트 + 기존 스위트 green.

## A-gate 감사 반영 (sol R1 FAIL → 계획 수정, 2026-07-16)

sol 리뷰어(gpt-5.6-sol high) R1 블로커 8건 전부 수용. 아래가 §1~§7을 덮어쓰는 확정 계약이다.

### R1-1/R1-2. NEW `routes/models.ts` — 서버 lane DTO (write scope 확장)

CLI가 3~4개 엔드포인트를 조합하는 대신 서버가 단일 canonical DTO를 소유한다.

```
GET /api/models → { ok, lanes: { [lane]: {
  status: "ready"|"locked"|"disconnected"|"key-missing",
  reason?: string,
  defaults: { image?: string, video?: string },
  models: { image: ModelEntry[], video: ModelEntry[] }
} } }
```

- 코어 6레인 status 소스: oauth(=codexDetect/oauth status), api(OpenAI key), grok(oauth 세션)/grok-api(xAI key), agy(설치 감지), gemini-api(key). 기존 `routes/health.ts:27`의 `/api/providers`보다 넓은 판정 — 각 lane의 실제 준비신호를 사용.
- MCP 2레인: `adapter.executable`을 providerRegistry/adapters에서 서버가 소유해 `locked` 판정 (`higgsfield.ts:32`), manager.status로 disconnected 판정. `/api/mcp/providers` 응답에도 `executable`+lock reason 추가(UI 하드코딩 `GenProviderModelSelect.tsx:137` 제거는 후속).
- **disconnected 카탈로그 계약**: 정적(스냅샷) 모델은 항상 나열, 동적(models_explore) 모델은 연결 시에만. `ima2 models` accept 기준을 "전 정적 모델 + 연결 시 동적 모델"로 조정.
- 코어 lane 기본 모델: oauth/api는 config 기본(imageModels.default/apiProvider.defaultImageModel), grok는 grokProvider.defaultImageModel + GROK_VIDEO_MODEL_BASE(video), agy/gemini-api는 nano-banana 계열 기본. laneDefault는 이 DTO의 `defaults`가 유일 소스.
- `ima2 models`는 이 엔드포인트 하나만 호출. 서버 다운 시 exit 3 유지.

### R1-3. 플래그 호환성 매트릭스 (transport별 확정)

| 플래그 | core lane | mcp lane |
|--------|-----------|----------|
| `--provider auto` | **v3 제거** — exit 2 `PROVIDER_AUTO_REMOVED` + fix 안내 | 동일 |
| `--provider X --model Y/..` (lane 불일치) | exit 2 `LANE_CONFLICT` | 동일 |
| `--model` alias(luna 등) | 세그먼트 단위 canonicalize (`oauth/luna` → `oauth/gpt-5.6-luna`) | MCP id는 alias 없음 |
| gen `--quality/--size/--bg/--reasoning-effort/--web-search/--mode/--moderation/--session` | 기존 유지 | exit 2 `FLAG_NOT_SUPPORTED` (mcp 계약에 없는 것 전부) |
| gen `-n` | 기존 유지 | 1만 허용(초과 시 FLAG_NOT_SUPPORTED) |
| gen/video `--ref` | 기존 base64 경로 유지 | filename 기반 `references`로 변환 — 생성 갤러리 파일명만 허용, 로컬 임의 경로는 exit 2 `MCP_REF_MUST_BE_GENERATED`(030에서 업로드 확장) |
| video `--planner-model/--storyboard/--topic` | grok 전용 유지 | exit 2 `FLAG_NOT_SUPPORTED` |
| video subcommands(edit/extend/continue/frame/analyze) | **resolver 통합 없음** — 기존 dispatch(video.ts:152) 앞단 유지, 이번 wp 불변 | — |
| video `--provider` | **신규 추가** (기존엔 없음) | 동일 |

### R1-4. 명시/암묵 플래그 구분

video SPEC의 `duration:"5"`, `resolution:"480p"`, `aspect-ratio:"auto"` 기본값을 SPEC에서 제거하고 resolver 이후 lane별 적용: grok lane이면 기존 기본값 주입(현행 동작 보존), mcp lane이면 **명시된 플래그만** 카탈로그 parameters로 검증해 전달, 미지정은 카탈로그 기본값에 위임. inputRoles 검증(start frame 필수 모델 등)도 클라이언트 선검증에 포함.

### R1-5. defaults 저장/읽기

`bin/lib/config-store.ts`에 `loadCliDefaults(): { image?: string, video?: string }` 추가 — **raw 파일 레이어**(loadFileCfg)에서 `defaults.image/video`를 직접 읽는다(buildEffectiveConfig는 runtime config만 반환하므로 사용 불가, config.ts 스키마 확장 안 함). CLI 전용 키이므로 restartNotice 출력 금지. WRITABLE_CONFIG_KEYS에 `defaults.image`/`defaults.video` 추가.

### R1-6. 에러 봉투 API 확정

```ts
fail(opts: { json: boolean; code: string; message: string; extra?: object; exitCode?: number }): never
```

- json=true → stdout에 **정확히 1개** JSON 문서 `{"ok":false,"code",...extra}` 후 exit. json=false → 기존 die() 스타일 stderr.
- exit 2/3/1 계약은 **신규 코드 경로(resolver/models/defaults/mcpJob)에만** 적용. 기존 `exitCodeForError` 4~8 매핑(cli-lib.test.ts:101)은 불변.

### R1-7. mcpJob 레이스/다운로드 수정

- requestId는 **클라이언트 생성**(createCliRequestId 재사용, 라우트가 수용함 mcpMedia.ts:279).
- 순서: ① SSE `GET /api/events?lastEventId=<now>` 연결+헤더 확인 → ② POST /api/mcp/generate(동일 requestId) → ③ jobId 필터로 done/error 대기. 이 순서로 replay-to-subscribe 레이스 제거.
- `bin/lib/sse.ts` 확장: SSE `id:` 필드 파싱 노출 + GET 스트림 + 재연결 커서(lastEventId) + `replay-gap` 이벤트 처리. 기존 POST 사용처 불변.
- done payload의 `url`(`/generated/...`)에서 다운로드(safe fallback `/generated/<filename>`). `/files/` 아님.
- 클라이언트 타임아웃 = 서버 executor 한도(5/12분) + 90초 grace(다운로드/영속화 여유).
- requestId/progress는 stderr 전용 — stdout은 최종 JSON 1문서 계약(cli-commands.test.js:169) 유지.

### R1-8. 테스트/write 매니페스트 확장

- write scope 추가: `routes/models.ts`(NEW), `routes/mcpConnections.ts`(executable 노출), `lib/mcp/providerRegistry.ts`, `bin/lib/sse.ts`, `bin/lib/config-store.ts`, `lib/configKeys.ts`.
- 기존 스위트 갱신: `tests/cli-commands.test.js`, `tests/cli-video-command-contract.test.js`, `tests/cli-lib.test.ts`, `tests/event-bus.test.ts`, `tests/mcp-generation-integration.test.ts`, `tests/mcp-models-catalog.test.ts`.
- 신규 케이스: provider/model 충돌, 세그먼트 alias, 명시/암묵 파라미터, MCP ref 거부, stdout 단일 JSON, POST/SSE 레이스(스트림 선연결), 재연결/replay-gap, done 다운로드 경로, lanes DTO 계약(`tests/models-endpoint-contract.test.ts` NEW).

### R2 잔여 반영 (sol NEAR-PASS → 확정, 2026-07-16)

1. **라우트 등록**: `routes/index.ts`를 write scope에 추가. `/api/models` 등록을 신규 엔드포인트 테스트에서 단언.
2. **SSE 오픈/복구 계약**: 초기 연결은 커서 생략(replay 불필요 — 연결 후 POST하므로). `openSse()`는 헤더 수신 시 resolve하는 open 시그널 제공(제너레이터 첫 이벤트 대기로 연결 증명 불가). 재연결 커서는 마지막 파싱된 SSE `id`. `replay-gap` 수신 시 `GET /api/inflight`(terminal 상태)를 조회해 done/error를 복구, 불가하면 typed error `SSE_REPLAY_GAP`. POST 거부 시/매칭 done·error 직후 스트림 즉시 abort. 클라이언트 데드라인 = executor 한도 + 120s(서버 미디어 다운로드 허용치) + 30s 영속화 마진.
3. **플래그 매트릭스 보강**: gen `--no-save`/`--force` → MCP에서 exit 2 FLAG_NOT_SUPPORTED. video `--bg`/`--session` → MCP에서 FLAG_NOT_SUPPORTED. `--out`/`--out-dir`은 transport 중립(다운로드 목적지). MCP video ref 매핑: 모델이 `start_image` role을 요구하면 첫 generated filename → `startFrameFilename`, 추가 ref는 `image_references` role 지원 시에만 `references`로, 아니면 exit 2.
4. **defaults 키 소유권**: `defaults.image/video`는 `ima2 defaults` 전용 소유 — WRITABLE_CONFIG_KEYS에 **추가하지 않음**(config set/get 표면 비노출, 재스캔 모순 방지). R1-5의 해당 문구 폐기.
5. **lane status 우선순위**: `locked > key-missing|disconnected > ready` 결정적 순서(끊긴 Higgsfield도 locked 유지). agy ready 의미 = "binary 설치됨(로그인 프로브 불가)"을 reason에 명기. `grok-api` 기본 이미지 모델 = grok lane과 동일(grokProvider.defaultImageModel), video 기본 = GROK_VIDEO_MODEL_BASE.
