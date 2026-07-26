---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, mcp, providers, oauth, image, video]
aliases: [subscription mcp providers, 구독형 MCP provider]
---

# 구독형 미디어 MCP provider 통합 계획

> **Interview closed — 2026-07-16.** 요구사항 기록은 `005_interview_tool_contract_abstraction.md`(6 rounds)가 소유하고, 이 문서가 canonical roadmap이다. 확정 결정:
>
> 1. **Dual contract namespace** — `ima2.*` normalized contract + `mcp.<provider>.*` sanitized/executable passthrough mirror.
> 2. **ExecutionOwner = ima2 runtime** — AI host는 provider MCP를 직접 설치하지 않고 ima2 CLI surface만 소비한다. OAuth·tools/call·cancel/status는 ima2 server가 소유한다.
> 3. **Full-schema snapshot 번들** — 전 pilot provider의 tool 계약을 sanitize + provenance/entitlement tag 후 npm에 동봉(`documented` 층 고정). live tools/list가 항상 우선하며 drift를 감지한다. npm 배포 전 provider별 약관 재확인 + 이의 시 제거 정책이 게이트다(Runway/Higgsfield ToS 문구는 수용된 잔여 리스크).
> 4. **2-tier verifier** — Tier 1: clean-install golden tasks(CI, 무인증), Tier 2: 사용자 계정 authenticated smoke(실 tools/call + 혼합 파이프라인).

## Loop spec

- Loop archetype: 외부 provider 계약 조사 → 인증된 schema spike → 공통 runtime → provider adapter → media workflow → UI/운영 검증.
- Trigger: Higgsfield·Runway 등 기존 구독 크레딧을 ima2-gen 생성 화면에서 직접 쓰고, provider가 MCP로 공개한 편집 도구도 재사용한다.
- Goal: 사용자가 ima2-gen 안에서 MCP provider를 선택하고 이미지·영상을 생성하며, 실제 공개된 경우 이어가기·리프레임·업스케일·편집 기능도 같은 결과/히스토리/SSE 계약으로 사용한다.
- Non-goals: 이번 조사 pass에서 코드 구현, OAuth 로그인, 크레딧 소비, 비공식 웹 자동화, 인증 전 `tools/list`를 추측한 hardcode, 모든 후보 동시 지원.
- Verifier: 공식 원문 URL 재확인, 모든 계획 경로의 실재 여부 확인, 인증 spike에서 `initialize`/`tools/list`/무과금 호출 증거, 구현 phase별 typecheck·tests·UI build·실제 provider smoke.
- Stop condition: 후보가 증거 등급으로 분류되고, 우선순위와 제외 사유가 기록되며, 후속 work-phase가 diff-level 문서로 완성된다.
- Memory artifact: 이 폴더의 `000`~`090` 문서와 향후 `artifacts/<provider>/tools-list.sanitized.json`.
- Expected terminal outcomes: `pilot-ready`, `schema-blocked`, `terms-blocked`, `provider-deferred`, `integration-shipped`.
- Escalation condition: OAuth callback/토큰 저장 정책, 구독 계정의 앱 내 호출 허용 약관, 과금 예측 불가, provider가 MCP client가 아닌 대화형 agent만 허용하는 경우 사용자 결정을 받는다.

## 현재 판정

이번 pass는 C5 조사/계획이다. 실제 구현은 새 MCP SDK 의존성, 원격 OAuth, refresh token, 외부 과금 호출을 포함하므로 C4로 재분류한다.

## 제품 포지션

ima2-gen은 provider 기능을 재판매하는 hosted SaaS나 API proxy가 아니다. 사용자가 자신의 계정으로 공식 MCP server에 연결하고, 공개된 tool을 이미지·영상 작업 흐름에서 안전하게 쓰도록 돕는 오픈소스 local MCP client다.

후보의 hard gate는 다음과 같다.

1. provider가 직접 운영·배포한 공식 MCP가 있어야 한다. 공식 MCP가 없고 REST API만 있는 서비스는 이 레인에서 제외한다.
2. remote MCP는 사용자 OAuth가 최우선이다. official MCP가 API key만 지원하면 secondary compatibility lane에는 둘 수 있지만 구독 OAuth provider와 같은 기본 UX로 묶지 않는다.
3. ima2-gen은 `initialize`/`tools/list`/`tools/call`을 직접 수행하고 사용자의 provider entitlement와 credits를 그대로 쓴다.
4. provider model이나 숨은 endpoint를 복제하지 않고 live MCP schema와 공개 capability만 UI에 투영한다.
5. token·cookie·account를 ima2 운영자와 공유하지 않는다. 로컬 사용자 config에만 저장하며 사용자가 연결을 끊을 수 있어야 한다.

가장 먼저 검증할 pilot cohort는 다음 네 곳이다.

1. Higgsfield — 사용자 요구의 핵심. 이미지·영상·다중 모델·MCP 내장 앱 범위가 넓지만 공개 tool schema가 없다.
2. Runway — 사용자 요구의 핵심. 기존 플랜 크레딧과 원격 OAuth는 확인됐지만 Stitch/Workflow tool의 MCP 노출 여부가 공개되지 않았다.
3. Magnific — 이번 Luna 병렬 조사에서 가장 가까운 신규 peer로 확인됐다. 유료 플랜 OAuth, 이미지·영상 생성/편집, video project/clip editor, upscale, 공개된 video concatenation 범위를 갖는다. 단, 공식 문서가 제품/파이프라인 통합에는 API를 안내하므로 schema 열람 이후 adapter 착수 전 서면 허용 또는 적용 가능한 약관 근거가 필요하다.
4. Recraft — 공개 tool 이름·파라미터·구독 크레딧 과금이 문서화되어 공통 runtime의 image control provider로 적합하다.

> **2026-07-16 scope 축소:** 실행 pilot은 사용자 계정이 준비된 **Higgsfield·Runway** 두 곳이다. Magnific·Recraft는 후보 지위를 유지하되 `100_provider_expansion.md`로 이연됐다.

Krea와 Ideogram은 pilot 직후의 Tier A다. Pika는 `Extend Video`와 `Stitch Videos`까지 공식 페이지에 표시하지만 provider 자체가 experimental/rough 상태로 명시하므로 격리된 기술 spike로만 다룬다. BFL은 이미지 전문 OAuth lane, HeyGen·Rendley는 avatar/video-editor workflow lane으로 분리한다. Canva는 기능상 design workflow 후보지만 정책 검토 전에는 disabled catalog entry로만 둔다. fal·Replicate·Leonardo·HiAPI·MiniMax·Hera·Golpo처럼 official MCP가 API key를 요구하는 후보는 secondary compatibility lane이며, API만 있고 공식 MCP가 없는 서비스는 제외한다.

## 구조 결정

### Context

현재 provider 값은 UI union과 여러 생성 파이프라인 분기에 박혀 있고, video generate는 Grok 계열만 허용한다. MCP provider를 각각 분기문으로 추가하면 이미지/영상/Node/Agent/CLI 경로가 다시 갈라진다.

### Rejected alternatives

- provider마다 route에서 MCP tool 이름을 직접 호출: tool rename/schema drift가 전체 앱에 전파된다.
- MCP 서버의 자연어 agent를 한 번 더 호출: 사용자가 입력한 구조화 설정을 잃고 결과/오류/과금 계약을 제어하기 어렵다.
- 브라우저 자동화로 구독 웹 UI 조작: 공식 MCP가 있는 후보에서 불필요하고 세션/약관/신뢰성이 나쁘다.
- 모든 MCP tool을 UI에 그대로 노출: provider별 저수준 schema가 제품 UX를 지배한다.

### Chosen move

`contract catalog SoT → remote MCP client runtime → snapshot lifecycle → provider adapter → ima2 capability/discovery surface`의 구조를 둔다.

- 하나의 canonical contract model(020)이 내장 tool과 provider tool을 모두 기술하고, 기존 `AGENT_TOOL_MANIFEST`·`ima2 capabilities`·skill 문서는 여기서 파생되는 projection으로 이관한다(제4의 SoT를 만들지 않는다).
- UI와 기존 파이프라인은 `image.generate`, `video.generate`, `video.extend`, `video.stitch`, `video.reframe`, `media.upscale` 같은 normalized capability를 본다.
- AI-facing CLI(070)는 normalized `ima2.*`와 raw `mcp.<provider>.*` 양쪽을 machine-readable JSON으로 노출하되, availability(`documented/connected/callable/stale/blocked`)를 구조적으로 구분한다.

### Consequences

- 새 의존성은 구현 시점의 stable `@modelcontextprotocol/sdk` 1.x로 고정한다. 2026-07-15 npm `latest`는 `1.29.0`; v2 pre-alpha 경로는 사용하지 않는다.
- OAuth token은 repo나 일반 `config.json`에 넣지 않고 `${IMA2_CONFIG_DIR}/mcp/` 아래 provider별 0600 atomic file에 저장한다.
- `tools/list` 결과는 연결마다 재검증하고, UI는 capability가 없는 action을 숨기거나 disabled reason을 표시한다.
- MCP가 native extend/stitch를 제공하지 않으면 기존 last-frame→I2V와 local ffmpeg를 명시적 fallback으로 사용한다.

## Work-phase map

2026-07-16 개정 — dependency-ordered (PHASE-SPLIT-01). 각 구현 work-phase는 별도 PABCD cycle이다.

| WP | 문서 | 독립 완료 결과 | 선행 |
|---:|---|---|---|
| 0 | `001`~`005` | 후보 원장, Luna sweep, 인터뷰 기록(닫힘) | 없음 |
| 1 | `010_authenticated_schema_spike.md` | **Higgsfield·Runway 한정**(2026-07-16) 계정/플랜 요건 매트릭스 + 인증 후 sanitized `tools/list` snapshot + 무과금 capability 판정 | 조사 |
| 2 | `020_contract_catalog_sot.md` | canonical contract model + dual namespace + availability 상태기계 + 기존 manifest/capabilities projection 이관 | WP1 fixture |
| 3 | `030_mcp_runtime_auth.md` | 공통 Streamable HTTP/OAuth/token/connection runtime | WP2 |
| 4 | `040_snapshot_lifecycle_bundle.md` | 획득→sanitize→tag→로컬 캐시/npm 번들→drift 감지·잠금 파이프라인 | WP2~3 |
| 5 | `050_provider_adapters_generation.md` | provider adapter + 생성 파이프라인 연결 + **결과 ingest 소유**(artifact/sidecar/history/SSE/lineage) | WP3~4 |
| 6 | `060_media_workflows.md` | native extend/stitch/reframe/upscale + local fallback + **혼합 파이프라인 소유**(GPT 이미지→MCP 영상 등 cross-provider chain) | WP5 |
| 7 | `070_ai_discovery_cli.md` | AI-facing machine contract entrypoint(`ima2 tools …`), skill/docs projection 생성 | WP2, WP4 |
| 8 | `080_ui_observability.md` | 연결/모델/action UI, SSE/inflight/metadata 표면 | WP5~6 |
| 9 | `090_verification_rollout.md` | **Tier 1 clean-install golden-task 하네스 소유** + Tier 2 authenticated smoke + 보안·과금·rollout | WP1~8 |
| 10 | `100_provider_expansion.md` | Recraft·Magnific 확장 — 010~090 재사용 계약으로 provider 추가 절차 검증 | WP9 |
| 11 | `110_tier_a_backlog.md` | Krea/Ideogram/BFL 등 Tier A·specialist gated backlog 원장 | WP10 |

WP1이 Higgsfield/Runway/Magnific의 실제 tool schema를 확정하기 전에는 WP5·WP6의 tool mapping을 구현하지 않는다.

## Scope boundary

### IN

- 공식 원격 MCP 또는 provider 공식 MCP package.
- ima2-gen 서버가 MCP client로 직접 `tools/list`와 `tools/call`을 수행.
- 오픈소스 local client에서 사용자가 자신의 OAuth/account entitlement로 연결하는 방식.
- 기존 구독 OAuth/credits를 쓰는 provider와 API-key/paygo provider의 명확한 분리.
- 이미지·영상 결과의 즉시 로컬 저장, sidecar provenance, SSE/inflight/cancel 정규화.
- provider-native workflow와 local fallback의 capability 기반 선택.

### OUT

- 비공식 Midjourney/Luma/Kling 웹 래퍼. Pika의 공식 experimental MCP는 별도 unstable lane에서만 평가한다.
- 공식 MCP 없이 provider REST API만 ima2 adapter로 직접 붙이는 작업.
- provider 계정·크레딧을 ima2 운영자가 중개하거나 재판매하는 hosted gateway.
- 구독 세션 cookie 탈취/재사용.
- provider의 숨은 REST endpoint 직접 호출.
- SaaS 다중 사용자 계정 공유.
- 인증된 schema 증거 없이 marketing page 기능을 MCP tool로 단정.

## SoT sync target

구현 완료 시 `structure/03-server-api.md`, `structure/04-frontend-architecture.md`, `structure/06-infra-operations.md`, `structure/01-file-function-map.md`, `docs/API.md`, `skills/ima2/SKILL.md`, `devlog/_plan/README.md`를 현재 계약에 맞춘다.

## 조사 pass 완료 기록

- 2026-07-15: 공개 공식 자료 기준 후보 조사와 Luna 5-lane 병렬 sweep 완료. 인증/과금/tool schema 신뢰도에 따라 Tier A~C/experimental/lead로 분류했다.
- 2026-07-16: 인터뷰 6 rounds 종료(005). 약관 Luna 5-lane sweep — MCP 생태계는 tool 계약 재게시를 표준 관행으로 문서화(스펙 public cache scope, Registry CC0, Glama/PulseMCP), 4개 pilot provider 모두 임의 MCP client 공식 환영. Runway/Higgsfield 일반 ToS의 재게시 금지 문구는 수용된 잔여 리스크로 기록.
- 미해결: Higgsfield·Runway·Magnific의 실제 `tools/list`, Higgsfield/Runway native `video.extend`/`video.stitch` 공개 여부, Pika experimental 안정성, 구독 계정을 로컬 앱 client에서 호출하는 약관 범위.
