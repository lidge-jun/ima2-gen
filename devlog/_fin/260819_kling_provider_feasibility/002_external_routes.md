---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, research, provider, video, kling, external]
---

# 002 — 외부 경로 조사: 공식 API와 애그리게이터

조사 주체: `xai/grok-4.6` 서브에이전트 2대 (병렬, 저장소 접근 없음).
조사일 2026-08-19. 공식 API 레인 CONFIDENCE high, 애그리게이터 레인 medium.
아래에서 출처가 붙지 않은 항목은 전부 UNVERIFIED로 명시했다.

## R-1. 조사와 로컬 코드가 충돌한 지점 (중요)

애그리게이터 조사 담당 에이전트는 이렇게 결론냈다:

> "Runway MCP / `generate_video` **does not document** `kling-o3-pro`,
> `kling-3-pro`, or Kling 3.0 multishot. (...) Claiming Kling on Runway MCP
> is **not supported** by current official model list."

근거는 `docs.dev.runwayml.com/guides/models.md`의 공개 모델 목록에
kling이 0건이라는 것이었다.

**이 결론은 우리 저장소의 1차 증거와 충돌하며, 채택하지 않는다.**
2026-07-15에 인증 상태로 캡처한 `tools/list` 스냅샷의
`generate_video` 입력 스키마 model enum은 다음과 같다:

```
["seedance-2", "kling-o3-pro", "kling-3-pro", "gen-4.5", "veo-3.1", "gen-4-turbo"]
  — assets/mcp-snapshots/runway.sanitized.json, tool generate_video
```

**교훈: Runway의 공개 HTTP API 모델 목록과 Runway MCP 서버가 노출하는
모델 목록은 같지 않다.** MCP 쪽이 더 넓다. 외부 문서만 보고 "없다"고
판정하면 틀린다. 이 유닛이 인증 스냅샷을 1차 증거로 두는 이유다.

다만 스냅샷은 2026-07-15자다. 한 달 지난 값이므로 **현재도 유효한지는
재캡처로만 확인된다** — 003의 검증 항목 V1.

## 1. 공식 Kling API (1st-party)

### 1.1 엔드포인트와 지역

| 구분 | 글로벌 | 중국 본토 |
|---|---|---|
| 개발자 콘솔 | `https://kling.ai/dev` | `https://klingai.com/dev` |
| API 도메인 | `https://api-singapore.klingai.com` | `https://api-beijing.klingai.com` |
| 문서 | `https://kling.ai/document-api` | `https://klingai.com/document-api` |

구 `api.klingai.com`은 폐기되고 지역 도메인으로 갈렸다. 한국 개발자는
싱가포르 호스트가 대상이다 ("suitable for users whose servers are located
outside of China").

### 1.2 인증 — 두 세대가 공존한다

이게 구현 난이도에 직접 영향을 준다.

| 세대 | 방식 | 헤더 |
|---|---|---|
| 신규 (3.x, 경로에 모델) | **API Key 직접** | `Authorization: Bearer <API_KEY>` |
| 레거시 (`model_name` 바디 필드) | **JWT HS256 자체 서명** | `Authorization: Bearer <JWT>` |

레거시 JWT 구성: `alg=HS256`, `typ=JWT`, claims `iss`=AccessKey,
`exp`=now+1800s, `nbf`=now−5s, SecretKey로 서명. 공식 샘플에 `iat`는 없다.

**ima2 관점에서 중요한 함의:** 신규 3.x 경로만 쓰면 인증은 그냥 API key다.
즉 `lib/providers/types.ts`의 기존 `kind: "api-key"` credential 모델에
**그대로 들어맞는다.** JWT 서명 루틴(30분 만료 토큰 갱신, 시계 오차 처리)을
새로 만들 필요가 없다. 레거시 모델을 포기하는 대가로 얻는 단순함이다.

### 1.3 엔드포인트 (신규 3.x)

```
POST /text-to-video/kling-3.0-turbo
POST /text-to-video/kling-3.0
POST /image-to-video/kling-3.0-turbo
POST /image-to-video/kling-3.0
GET  /tasks?task_ids=...        (또는 ?external_task_ids=..., 콤마 배치)
POST /tasks                      (커서 목록)
```

요청 바디 (t2v): `prompt`, `settings.resolution` (`720p`/`1080p`, 기본 `720p`),
`settings.aspect_ratio` (`16:9`/`9:16`/`1:1`), `settings.duration` (기본 5, 3–15),
`options.callback_url`, `options.external_task_id`, `options.watermark_info.enabled`.
i2v는 `contents[]` 배열에 `type`=`prompt`|`first_frame` + `text`/`url`.

응답: `code`, `message`, `request_id`, `data.id`,
`data.status` ∈ {`submitted`, `processing`, `succeeded`, `failed`},
결과는 `data[].outputs[]`에 `type=video`, `url`, `watermark_url`, `duration`.

### 1.4 함정: 레거시는 status 철자가 다르다

레거시 `/v1/videos/text2video` 계열의 `task_status` enum은
`submitted`, `processing`, **`succeed`**, `failed`다 — 신규의
`succeeded`와 **철자가 다르다**. 결과 경로도 `task_result.videos[]`로 다르다.
두 세대를 한 어댑터에서 받으면 여기서 조용히 깨진다.

### 1.5 결과 URL 수명

"generated results will be cleared after **30 days**", hotlink 보호 형식.
ima2는 어차피 로컬에 다운로드해 영속화하므로
(`lib/videoArtifactPersistence.ts`, `lib/mcp/downloadMediaResult.ts`)
이 제약은 기존 파이프라인과 충돌하지 않는다.

### 1.6 과금

Unit(리소스 팩) + 현금 잔액 병용. 과금 내역이 태스크의 `billing[]`에
`charge_type`=`unit`|`cash`로 실린다. 문서 표 기준 **1 Unit ≈ $0.14**.

| 모델/조건 | 초당 | 5초 | 10초 |
|---|---|---|---|
| 2.5 Turbo / 2.6 무음 720P | $0.042 | ~$0.21 | ~$0.42 |
| 2.5 Turbo / 2.6 무음 1080P | $0.07 | ~$0.35 | ~$0.70 |
| 3.0 Turbo + 네이티브 오디오 1080P | $0.14 | ~$0.70 | ~$1.40 |
| 2.1/2.0 Master 1080P | $0.28 | ~$1.40 | ~$2.80 |
| Lip Sync | — | 0.5 Unit ($0.07)/5s | — |

### 1.7 동시성

**QPS 제한 없음.** 대신 계정/모델/팩 단위 동시 실행 슬롯 제한이고 API key
여러 개를 만들어도 공유된다. 초과 시 `code: 1303`
`"parallel task over resource pack limit"`. 비디오 태스크 1건 = 슬롯 1.

ima2는 최대 12건 병렬 생성을 표방하므로 (`AGENTS.md`), Kling 레인은
**팩 등급에 따라 그 아래에서 막힐 수 있다**. 슬롯 정수값은 UNVERIFIED.

### 1.8 콜백

폴링과 웹훅 **둘 다** 지원. 웹훅은 `webhook-signature` 헤더
(`v1,<b64>`, HMAC-SHA256) 서명 검증 옵션이 있다.
ima2는 로컬 앱이라 공개 콜백 URL이 없으므로 **폴링 경로를 쓴다**.
기존 `lib/grokVideoPoll.ts` 패턴과 동형이다.

### 1.9 SDK

**공식 Node/TypeScript SDK 없음.** 콜백 문서가 Python/Java 샘플만 제공하며
"If the official SDK is not available, you can manually verify..."라고 쓴다.
즉 직접 `fetch` 구현이다 — ima2의 기존 어댑터들과 같은 방식이라 문제는 아니다.

### 1.10 한국 개발자 접근성 — 미확인 구간

글로벌 사이트가 이메일 가입 + API key 발급을 제공하는 것까지는 확인됐다.
**UNVERIFIED:** 한국 발급 카드 결제 가능 여부, KYC/사업자 요구 여부,
리소스 팩 최소 구매액, 체험 팩 용량. 결제 페이지가 JS 앱이라 문서에서
추출되지 않았다. 이건 **사람이 직접 가입해봐야 풀리는 항목**이다.

## 2. 애그리게이터 경로

### 2.1 fal.ai

- 제출 `POST https://queue.fal.run/{model_id}`, 인증 `Authorization: Key $FAL_KEY`
- 큐 상태 `IN_QUEUE`/`IN_PROGRESS`/`COMPLETED`, 웹훅 선택
- 공식 Node SDK `@fal-ai/client` 존재
- 모델 id (원문): `fal-ai/kling-video/v3/pro/text-to-video`,
  `fal-ai/kling-video/v3/standard/image-to-video`,
  `fal-ai/kling-video/o3/pro/image-to-video`,
  `fal-ai/kling-video/o3/4k/{text,image}-to-video` 외 v2.x, lipsync, avatar, effects
- 가격: v3 std $0.084/s(무음)~$0.154/s(voice), v3 pro $0.112~$0.196/s,
  o3 pro i2v $0.112~$0.14/s

### 2.2 Replicate

- `POST https://api.replicate.com/v1/predictions`, `Authorization: Bearer $REPLICATE_API_TOKEN`
- 모델 id: `kwaivgi/kling-v3-video` (t2v+i2v+end image+`multi_prompt` 6샷+3–15s
  +`mode` standard|pro+`generate_audio`), `kwaivgi/kling-v2.5-turbo-pro`
- 공식 JS 클라이언트 `replicate` 존재
- 가격: std $0.168/s(무음)~$0.252(오디오), pro $0.224~$0.336, 4k $0.42
- **fal 대비 약 2배 비싸다** (같은 3.0 계열 기준)

### 2.3 그 외

| 벤더 | 베이스 | 인증 | 3.0 가격 | 비고 |
|---|---|---|---|---|
| PiAPI | `https://api.piapi.ai/api/v1/task` | `x-api-key` | 720p $0.10~0.15/s, 1080p $0.15~0.20/s | **월 구독 + 크레딧 이중 과금**, 동시성이 요금제에 묶임 |
| WaveSpeed | `https://api.wavespeed.ai/api/v3/{model_id}` | Bearer | Pro t2v $0.56/run | 한국어 UI, 공식 JS SDK |
| AI/ML API | `https://api.aimlapi.com/v2/video/generations` | Bearer | 2.6 pro $0.091/s | OpenAI 호환 |
| Segmind | UNVERIFIED | UNVERIFIED | UNVERIFIED | 페이지에 "via fal.ai" 명시 — **중개의 중개** |
| Eachlabs | UNVERIFIED | — | — | 문서 페이지가 빈 셸 |

### 2.4 Higgsfield (MCP / REST)

공개 REST OpenAPI (`docs.higgsfield.ai/docs/openapi.json`)의 Kling 경로는
`/kling-video/v2.1/{master,pro,standard}/...`와
`/kling-video/v2.5-turbo/{pro,standard}/...` 뿐 — **3.0은 공개 REST에 없다**.
마케팅 페이지는 "Kling 3"를 광고하지만 머신 이름을 공개하지 않는다.

반면 우리 인증 MCP 스냅샷에는 `kling3_0`, `kling3_0_turbo`가 실재한다
(001 §3). R-1과 같은 구조의 격차다: **공개 문서 < 인증 MCP 표면.**

MCP 인증은 API key가 아니라 계정 OAuth다 ("No API key... authenticate
through your Higgsfield account"). ima2는 이미 이 방식으로 연결한다
(`lib/mcp/oauthProvider.ts`).

### 2.5 Runway

R-1 참조. 공개 HTTP 모델 목록에는 Kling이 없지만 **MCP `generate_video`
enum에는 있다.** ima2가 쓰는 것은 후자다.

## 3. 비용 비교 (Kling 3 계열, 10초 1080p 기준 개략)

| 경로 | 초당 | 10초 클립 | 가입 마찰 (한국 1인 개발자) |
|---|---|---|---|
| 공식 Kling (3.0 Turbo+오디오) | $0.14 | ~$1.40 | 카드/KYC UNVERIFIED |
| fal.ai (v3 pro 무음) | $0.112 | ~$1.12 | 이메일+키, 낮음 |
| fal.ai (v3 std 무음) | $0.084 | ~$0.84 | 낮음 |
| PiAPI (3.0 1080p+오디오) | $0.20 | ~$2.00 | 월 구독 필요, 높음 |
| Replicate (v3 pro 무음) | $0.224 | ~$2.24 | 낮음 |
| Runway MCP (Kling) | 워크스페이스 크레딧 | — | **이미 연결됨** |
| Higgsfield MCP (Kling) | 플랫폼 크레딧 | — | **이미 연결됨** |

주의: MCP 두 경로는 USD/초 단가가 공개되지 않고 각 플랫폼 크레딧으로
과금된다. 직접 비교가 불가능하며, 이미 그 플랫폼을 구독 중이라면
**한계비용이 0에 가깝다**는 점이 실질적 이점이다.

## 4. UNVERIFIED 목록 (사람이 풀어야 함)

1. 공식 Kling: 한국 카드 결제 가능 여부, KYC, 최소 구매액, 체험 팩 용량
2. 공식 Kling: 팩 등급별 동시 실행 슬롯 정수
3. Higgsfield: 현재 계정이 `models_explore`에서 Kling 3.0을 반환하는지
4. Runway: 2026-08 현재도 `generate_video` enum에 Kling 2종이 있는지 (스냅샷 재캡처)
5. 애그리게이터 전반: 한국 카드 3DS 통과 여부
6. 각 경로의 실측 지연시간 — 이번 조사에서 타이밍 측정 없음
