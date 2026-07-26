---
created: 2026-07-16
updated: 2026-07-16
status: closed — 2026-07-16 Round 6에서 I-phase 종료, 000_plan.md가 canonical roadmap
tags: [ima2-gen, interview, ai-cli, tool-contract, mcp, abstraction]
---

# 005 — AI-facing tool contract 추상화 인터뷰 기록

## 문서 지위

- IPABCD phase: `I (INTERVIEW)`.
- Sub-mode: Clarification.
- Unit residence: `devlog/_plan/260715_subscription-mcp-providers/`.
- Loop archetype: verifier가 done을 판정할 수 있는 **spec work**.
- Multi-cycle 예상: yes. 계약 SoT, acquisition, normalization, CLI discovery, execution, 검증이 독립 work-phase로 갈릴 가능성이 높다.
- 이 문서는 사용자 발화와 현재 repo 사실을 기록한다. decade phase 계획이나 구현 승인이 아니다.
- `000_plan.md`의 provider runtime 중심 구조와 010~090은 인터뷰 전 가설이다. 이 인터뷰가 끝날 때까지 canonical implementation plan이 아니다.

## 인터뷰 경과

사용자 요구는 다음 순서로 구체화됐다.

1. Higgsfield·Runway 같은 공식 MCP를 ima2에서 활용할 수 있는지 조사한다.
2. ima2-gen은 provider 기능을 재판매하는 서비스가 아니라 open-source 도구다.
3. ima2 CLI는 사람이 아니라 AI가 주로 읽으므로, 명령 목록만이 아니라 MCP처럼 machine-readable tool contract를 노출해야 한다.
4. 공식 MCP에서 tool 이름·설명·input schema를 가져와 문서화·저장한다.
5. 연결되거나 사용 가능한 MCP tool은 ima2의 AI-facing CLI surface에서 발견할 수 있어야 한다.
6. 목표는 Higgsfield/Runway별 wrapper를 늘리는 것이 아니라 이 흐름 전체를 더 높은 수준으로 추상화하는 것이다.

핵심 사용자 표현:

> “ima2 cli는 보통 ai가 보는 거니까 mcp처럼 내장 tool 계약을 노출하는 것도 필요하다.”

> “higgsfield나 runway mcp를 다운받고 거기 있는 tool은 문서화 저장, mcp 사용 시는 노출시키는 게 필요하다.”

여기서 “MCP를 다운받는다”는 말은 아직 두 경우로 열려 있다.

- hosted remote MCP: OAuth 후 `tools/list`로 contract snapshot 획득.
- official local MCP package: package 설치 후 local transport에서 `tools/list` 획득.

server code를 복제하는 것과 contract를 가져오는 것은 같은 행위로 간주하지 않는다.

## Interview answer ledger

### Round 1 — canonical contract

- Question: AI가 발견하는 canonical tool contract를 normalized ima2 tool, sanitized upstream mirror, dual namespace 중 어디에 둘 것인가.
- User answer: **dual contract namespace**.
- Decision:
  - `ima2.*`는 ima2가 안정성을 책임지는 normalized contract다.
  - `mcp.<provider>.*`는 provider 고유 기능과 schema를 보존하는 sanitized mirror다.
  - snapshot이 존재한다는 사실만으로 `callable`이 되지 않는다.
- Effect: Goal은 충분히 구체화됐고 Ontology는 raw/normalized 이중 층으로 좁혀졌다.

### Round 2 — execution authority

- Question: `ima2.*`와 `mcp.<provider>.*`의 실제 실행 주체(caller)를 누구로 둘 것인가.
- User answer (2026-07-16, 음성): **ima2가 유일한 MCP client다.** AI host(Claude/Codex 등)는 Higgsfield·Runway MCP를 직접 설치하지 않는다. ima2 connector가 provider MCP에 대한 OAuth와 `tools/call`을 소유하고, 사용자는 ima2 하나로 "거의 동일한 동작 + Grok/GPT와 혼합하는 더 나은 동작"을 얻는다. 이미지 생성 쪽에서는 Higgsfield를 API처럼 소비하고, CLI 쪽에서는 MCP tool을 native하게 쓰는 감각을 기대한다.
- Decision:
  - `ExecutionOwner` = ima2 runtime. server가 provider MCP session(OAuth, initialize, tools/call, cancel/status)을 소유하고, CLI는 server에 위임한다. external AI host는 ima2 CLI/contract surface만 소비하며 MCP transport를 직접 열지 않는다.
  - `mcp.<provider>.*`는 reference-only mirror가 아니라 **ima2를 통해 실행 가능한 passthrough**다. 단, callable 전이는 여전히 live 증거(연결·entitlement)가 필요하다.
  - 혼합 파이프라인(예: GPT 이미지 → Higgsfield animate → provider stitch)은 ima2 내장 provider와 MCP provider가 같은 result/history/SSE 계약을 공유해야 성립한다. result ingestion contract는 core 요구사항으로 승격된다.
- Feasibility note (기록): MCP는 공개 프로토콜이므로 provider 내부 프로세스가 black box여도 문제가 없다. host가 아는 것은 어차피 contract(`tools/list`)와 결과뿐이고, ima2도 같은 위치에 설 수 있다. 한계는 (1) provider가 MCP tool로 노출한 표면까지만 재현 가능(웹 전용 기능 제외), (2) OAuth 2.1 client 구현이 최대 공사, (3) provider가 client를 차단/화이트리스트할 가능성은 provider별 확인 필요.
- Effect: rescan round 2의 High cluster 1·2·3(caller 부재, passthrough 여부, result owner 부재)이 해소 방향으로 닫혔다. 남은 High는 callable 증거 기준, snapshot 배포 범위, verifier oracle이다.

### Round 3 — snapshot 배포 범위

- Question: contract snapshot을 bundled, live-only, bundled+live 중 어떻게 배포할 것인가.
- User answer (2026-07-16): "어차피 MCP는 공개되고 다운로드 받을 수 있는 거고, 내부를 뜯자는 게 아니라 내부에 있는 tool 계약을 넣자는 거다."
- Decision: **bundled + live 갱신.** tool contract는 provider의 공개 인터페이스 메타데이터로 취급한다. sanitized snapshot을 package에 동봉해 미연결 clean install에서도 `documented` 상태로 발견 가능하게 하고, OAuth 연결 후 live `tools/list`가 항상 우선하며 drift를 감지한다.
- Caveat (open assumption으로 유지): remote OAuth server는 인증 전 `tools/list`가 불가능하므로 "공개"의 실질 의미는 provider별로 다르다. account/plan별 tool 표면 차이가 확인되면 해당 provider snapshot은 provider-wide가 아니라 entitlement-tagged로 저장한다.
- Effect: Constraint의 마지막 open이던 배포 범위가 닫혔다. 남은 High는 callable 증거 기준과 verifier oracle이다.

### Round 4 — 번들 범위 refinement: 약관 증거 (lunasearch sweep)

- Question: OAuth 계정 파생 tools/list snapshot까지 npm에 번들할 것인가, provider 공개 문서 기반 계약만 번들할 것인가.
- User direction (2026-07-16): "codex나 claude code 쪽에도 MCP로 바로 다운로드할 수 있게 한 거 보면 별로 문제는 안 될 것" — 번들 쪽으로 기울되, lunasearch로 약관 확인을 지시.
- Evidence (Luna 5-lane sweep + 주요 원문 직접 재확인, 2026-07-16):
  - **생태계 규범은 번들을 지지한다.** MCP draft 스펙은 `tools/list` 결과의 캐싱과 cache scope(공개 스코프 포함)를 명시한다(modelcontextprotocol.io/specification/draft/server/utilities/caching — Cache Scope 섹션 직접 확인). 공식 MCP Registry 약관은 server metadata를 CC0 공개로 선언하고 aggregator의 scrape·재게시를 명시적으로 허용한다. Glama·PulseMCP는 auth-gated server의 tool schema까지 재게시하는 관행을 문서화했다. schema 재게시 관련 provider 분쟁 사례는 발견되지 않았다.
  - **provider 4곳 모두 임의 MCP client를 공식 환영한다.** Higgsfield MCP 페이지 meta에 "any MCP-compatible client" 문구 직접 확인. Runway help는 Claude/ChatGPT/Cursor/Replit + "any MCP-capable agent". Magnific·Recraft도 generic Streamable HTTP client 지원 명시. client whitelist 증거 없음. → ima2가 MCP client가 되는 것 자체는 전 provider에서 문제없음.
  - **단, 일반 ToS에 재게시 금지 조항이 있다.** Runway ToU(2026-05-11): (e) website 페이지 scrape 금지, (f) "no part of the Services may be copied, reproduced, distributed, republished..." — 원문 직접 확인. Higgsfield ToU(2025-08-30): Service의 reproduce/distribute/host 금지, API는 personal/internal use 한정(Luna 확인, 원문 재확인은 미실시). schema를 명시하지는 않지만 문구가 넓어 계약상 hook은 존재한다.
  - **Recraft·Magnific은 provider 스스로 tool 이름/파라미터를 공개 문서화한다** (recraft.ai/docs/mcp-reference/tools, docs.magnific.com/modelcontextprotocol). 이 둘은 공개 문서 기반 번들에 재배포 리스크가 사실상 없다.
- Provisional decision (사용자 최종 확인 대기):
  - **risk-tiered bundle 정책.** Green(provider가 tool 문서를 스스로 공개: Recraft, Magnific) = sanitized full contract 번들. Yellow(개방적이나 ToS 문구가 넓음: Higgsfield, Runway) = provider 공개 문서에서 파생한 capability 요약 + tool 이름만 번들하고, full schema snapshot은 첫 OAuth 연결 시 로컬 캐시로 생성.
  - 모든 번들 entry는 sanitize + provenance/entitlement tag + `documented` 고정. npm 배포 전 provider별 약관 재확인과 이의 시 제거(takedown) 정책을 계획 게이트로 유지.
- Effect: 사용자 직관(생태계 관행상 문제 없음)은 규범 증거로 뒷받침됐고, Higgsfield/Runway full-schema 번들만 계약 문구상 잔여 리스크로 남는다. 최종 선택지는 full bundle vs risk-tiered bundle 두 개로 좁혀졌다.

### Round 5 — 번들 범위 최종 결정

- Question: risk-tiered bundle(Higgsfield/Runway는 요약만) vs 전 provider full-schema bundle.
- User answer (2026-07-16): **전 provider full-schema 번들.** "tool은 다운받으면 어차피 다 공개되는 거고, 문서화(재게시)가 아니라 프로그램에 MCP를 내장하는 것" — MCP client가 tool 계약을 캐시하는 것과 같은 성질로 본다. 관행상 리스크 낮음, 이의 시 제거 정책 전제.
- Decision:
  - Higgsfield·Runway 포함 모든 pilot provider의 tool contract를 sanitize + provenance/entitlement tag 후 npm에 번들한다. 번들 entry는 항상 `documented` 층(callable 아님)이다.
  - npm 배포 게이트: provider별 약관 재확인 기록 + 이의 접수 시 해당 snapshot 즉시 제거(takedown) 정책을 릴리스 문서에 명시한다.
  - Round 4의 ToS hook(Runway (f), Higgsfield ToU)은 해소된 것이 아니라 **수용된 잔여 리스크**로 risk ledger에 남긴다.
- Rescan note: 이 답은 rescan round 3 High cluster 3(번들 출처/ToS)의 마지막 분기를 닫는다. 새 표면 없음 — 관련 medium 항목(entitlement tag, sanitizer 범위, 재배포 게이트)은 이미 OPEN ASSUMPTIONS/게이트로 기록되어 있다. Constraint dimension 4/4 완결.
- 남은 유일한 I-phase blocker: **verifier tiering** (Success criteria).

### Round 6 — verifier tiering (최종)

- Question: 완료 증명을 어떻게 계층화할 것인가.
- User answer (2026-07-16): **2층 검증 승인** ("ㅇㅇ ㄱㄱ").
- Decision:
  - Tier 1 (CI, 자동): clean-install golden tasks — 인증 없는 환경의 AI가 contract entrypoint를 발견하고, 입력을 구성하고, `auth_required`/`unavailable`/`schema_changed` typed 오류를 올바르게 받는지 검증.
  - Tier 2 (수동/반자동 게이트): 사용자 계정 OAuth로 실제 `tools/call`, 결과 ingest, 혼합 파이프라인(GPT 이미지→Higgsfield 영상 등) smoke. 증거는 sanitized 아티팩트로 저장.
- Effect: Success criteria dimension 닫힘. **I-phase 종료** — Goal 4/4, Constraint 4/4, Success criteria 4/4, Ontology(availability 축은 P에서 설계 항목으로 이관) 충족. canonical 결정: dual namespace, ima2-owned execution, full-schema bundle + tag + takedown 게이트, 2-tier verifier.

## Goal

ima2가 자신의 내장 tool과 연결된 외부 공식 MCP tool을 하나의 AI-facing contract system에서 발견·설명·검증할 수 있게 한다.

목표의 중심은 provider 호출 UI가 아니라 다음 질문에 답하는 것이다.

> 깨끗한 환경의 AI가 별도 대화 설명 없이 ima2 CLI를 보고, 현재 알려진 tool과 지금 호출 가능한 tool을 구분하고, 올바른 입력을 구성할 수 있는가?

## Constraints

### 확정

- AI가 primary consumer다. human help text만으로 완료하지 않는다.
- tool contract는 machine-readable JSON 형태가 필요하다.
- provider별 raw contract를 문서화·저장하되 ima2 공통 개념으로 추상화할 수 있어야 한다.
- 공식 provider MCP 또는 official package만 acquisition source가 될 수 있다.
- token, refresh token, API key, account id, email, signed URL, result payload는 배포 contract에 저장하지 않는다.
- provider별 schema drift를 감지해야 한다.
- 특정 provider wrapper를 core abstraction으로 만들지 않는다.
- 현재 인터뷰에서는 구현하지 않는다.

### 아직 확정되지 않음

> 2026-07-16 인터뷰 종료 시점 정합화: 아래 항목은 모두 해소됐다.

- ~~bundled vs live snapshot~~ → Round 3/5: 둘 다. bundled(전 provider full-schema) + live 갱신 우선.
- ~~disconnected tool 노출~~ → rescan round 3 설계: 항상 `documented` 층으로 노출하되 callable과 구조적으로 분리.
- ~~description의 AI context 투영~~ → rescan round 3 설계: quoted data + trust label로만 투영, instruction 병합 금지.
- ~~callable 판정 증거~~ → live 세션 + live tools/list 존재 + schema hash 일치. call-time 거부는 typed error로 처리(020 문서가 상세 소유).

### Round 2에서 확정으로 승격

- 실제 MCP `tools/call`의 주체는 **ima2 runtime**이다. AI host는 ima2 CLI surface만 소비한다.
- `mcp.<provider>.*`는 executable passthrough이며, upstream 결과는 ima2 artifact/history/lineage로 ingest되어야 한다(혼합 파이프라인의 전제).

## Success criteria 초안

아직 사용자 확인 전인 인터뷰 초안이다.

- clean-install AI가 `ima2`의 machine contract entrypoint를 스스로 발견한다.
- AI가 ima2 내장 tool, 설치된 provider tool, 연결된 provider tool, 지금 호출 가능한 tool을 구분한다.
- tool마다 name, description, input schema, output contract, error contract, execution owner, availability가 구조화되어 있다.
- provider-specific 기능을 raw namespace에서 잃지 않으면서, 공통 작업은 stable ima2 namespace로 사용할 수 있다.
- live schema가 snapshot과 달라지면 stale contract로 실행하지 않고 typed `schema_changed`를 반환한다.
- OAuth가 없거나 권한이 없을 때 AI가 tool 부재로 추측하지 않고 typed `auth_required` 또는 `unavailable`을 처리한다.
- 계약 snapshot만 읽고 실행 권한이 있다고 오판하지 않는다.
- provider 하나를 추가할 때 core CLI 분기문을 늘리지 않고 contract source/binding 단위로 확장할 수 있다.

## Ontology 초안

| 용어 | 의미 | 상태 |
|---|---|---|
| `Ima2ToolContract` | ima2가 직접 소유하는 stable AI-facing tool 계약 | 이름 확정 전 |
| `UpstreamMcpTool` | provider `tools/list`에서 받은 원본 tool entry | 개념 확정 |
| `SanitizedSnapshot` | 비밀·계정 데이터를 제거하고 provenance/hash를 붙인 보존본 | 개념 확정 |
| `NormalizedCapability` | `image.generate`, `video.extend` 같은 ima2 공통 의미 | 기존 계획에서 사용 중 |
| `ToolBinding` | normalized capability와 특정 upstream tool/schema를 연결 | 개념 후보 |
| `ContractCatalog` | 알려진 내장/외부 tool을 검색하는 목록 | 개념 후보 |
| `Availability` | `documented`, `installed`, `connected`, `callable`, `stale`, `blocked` 상태 | 구분 필요 |
| `ExecutionOwner` | CLI, ima2 server, Agent Runtime, external AI host 중 실제 호출 주체 | 미결정 |
| `ExposurePolicy` | 어떤 contract를 어떤 AI context에 보여줄지 결정 | 미결정 |
| `Provenance` | provider, endpoint/package, fetchedAt, protocol version, original/sanitized hash | 필요 |

## 현재 repo 사실

새 체계를 0에서 만들 필요는 없다. 이미 세 개의 AI-facing contract surface가 있다.

### `AGENT_TOOL_MANIFEST`

- `lib/agentToolManifest.ts:3-10`은 name, description, parameters를 가진 tool manifest를 정의하고 Agent planner와 `/api/agent/tools`, capabilities의 단일 SoT라고 선언한다.
- `routes/agent.ts:61-63`은 `/api/agent/tools`로 이 manifest를 노출한다.
- 현재 tool contract는 input parameters 중심이며 output/error/execution owner/availability는 명시하지 않는다.

### `ima2 capabilities --json`

- `bin/ima2.ts:330`은 이를 “Agent capability metadata”로 소개한다.
- `bin/commands/capabilities.ts:49-56`은 server 조회 실패 시 local package metadata로 fallback한다.
- `lib/capabilities.ts:12-26`의 command surface는 argument/result schema가 없는 문자열 목록이다.
- `lib/capabilities.ts:113-120`의 Agent tool surface는 `uiOnly: true`, `cliCommand: null`이다.
- 따라서 현재 output은 “알려진 기능”과 “지금 호출 가능함”을 충분히 구분하지 못한다.

### `ima2 skill`

- `bin/ima2.ts:333-344`와 `skills/ima2/SKILL.md:21-33`은 AI가 skill과 references를 설치·읽는 현재 discovery path를 제공한다.
- `bin/commands/skill.ts:384-394`의 `--json`은 structured tool contract가 아니라 Markdown 전체를 `content` 문자열로 감싼다.
- `package.json:56-66`상 npm package에는 `skills/`와 `docs/`가 들어가지만 devlog fixture는 들어가지 않는다.

### 확인된 구조 문제

- Agent manifest, capabilities command list, skill Markdown, 향후 MCP snapshot이 서로 다른 SoT가 될 위험이 있다.
- 기존 MCP 계획은 raw tool을 adapter 뒤에 숨기지만, 이번 인터뷰 요구는 raw provider contract도 AI가 발견할 수 있어야 한다.
- 기존 provider runtime 계획은 “contract catalog” 문제를 “MCP transport/OAuth integration” 문제로 바꿔 놓았다.

## 추상화 후보

아직 선택하지 않았다. 비교를 위해 세 방향을 기록한다.

### A — normalized ima2 contract only

- AI는 `ima2.image.generate`, `ima2.video.extend` 같은 stable contract만 본다.
- 장점: 단순하고 schema drift를 격리하기 쉽다.
- 단점: Reframe, Motion Control, provider-specific editor처럼 공통 ontology에 없는 기능을 잃는다.

### B — sanitized upstream mirror only

- AI는 provider raw tool namespace와 input schema를 그대로 본다.
- 장점: 새 provider 기능을 빠르게 노출할 수 있다.
- 단점: schema drift, AI 인지 부담, account별 차이, 안전하지 않은 descriptions가 그대로 전파된다.

### C — dual contract namespace — **SELECTED**

- stable ima2 tool과 namespaced upstream tool을 분리해 동시에 노출한다.
- 예: `ima2.video.extend`와 `mcp.higgsfield.<upstream-tool>`.
- normalized contract는 안정적인 공통 작업을 소유한다.
- upstream snapshot은 provider 고유 기능의 reference/discovery를 보존한다.
- live binding이 확인된 경우에만 snapshot이 callable 상태가 된다.
- 장점: 사용자 요구인 “더 추상화”와 “원본 tool 보존”을 같이 만족시킬 가능성이 높다.
- 단점: 두 contract의 권위·binding·중복·문서 생성 규칙을 명확히 정의해야 한다.

2026-07-16 Interview Round 1에서 C가 선택됐다. 다음 인터뷰는 두 namespace의 실행 authority와 snapshot lifecycle을 좁힌다.

## 잠정 작업 묶음

아래는 phase 계획이 아니라 인터뷰에서 파악한 problem bundle이다.

| 묶음 | 질문 | 예상 산출물 |
|---|---|---|
| Contract SoT | 기존 manifest/capabilities/skill 중 무엇을 canonical schema에서 파생할 것인가 | single contract model과 generated projections |
| Acquisition | remote/local official MCP contract를 어떻게 획득하는가 | `tools/list` capture protocol, source provenance |
| Sanitization & trust | secret 제거와 prompt/schema poisoning을 어떻게 분리 처리하는가 | sanitizer, trust labels, redaction evidence |
| Snapshot lifecycle | provider/account/version별 snapshot을 어디에 저장하고 언제 폐기하는가 | local cache, distributable snapshot policy, schema hash |
| Normalization | raw provider tool을 stable ima2 ontology에 어떻게 binding하는가 | capability vocabulary, binding rules |
| AI discovery CLI | AI가 list/show/schema를 어떻게 찾고 machine-readable하게 읽는가 | CLI JSON contract와 typed status |
| Skill/docs projection | package skill과 provider docs를 canonical contract에서 어떻게 생성하는가 | generated references, package inclusion rule |
| Execution ownership | 실제 `tools/call`과 auth/cancel/status를 누가 수행하는가 | runtime boundary decision |
| Conditional exposure | documented/connected/callable/stale/blocked를 어떻게 구분하는가 | availability state machine |
| Result contract | upstream result를 ima2 artifact/history/lineage로 어떻게 연결하는가 | output/error/ingest contract |
| Drift & revocation | schema 변경·disconnect·권한 변경 시 무엇을 잠그는가 | refresh/diff/invalidation policy |
| AI usability verification | clean-install AI가 실제로 발견·입력 구성·오류 처리하는지 어떻게 증명하는가 | golden tasks와 verifier |

## Contradiction ledger

### High

- ~~**Execution owner 미결정**~~ — Round 2에서 해소: ima2 runtime이 caller다.
- **Callable 전이 미결정:** snapshot만으로 실행 권한이 생기지 않는다는 부정 조건은 확정됐지만, 어떤 live 증거가 callable을 만드는지는 정해지지 않았다.
- **Static skill과 live discovery 충돌:** 설치된 Markdown은 재현 가능하지만 entitlement와 schema drift를 반영하지 못한다.
- **Advertised와 callable 혼동:** 현재 capabilities fallback은 server 연결이 없어도 local static metadata를 반환한다.
- **Trust boundary 누락:** official description도 AI instruction으로는 untrusted input일 수 있다.
- **Distribution scope 미결정:** account-derived snapshot을 npm package에 넣을 수 있는지와 provider-wide contract인지가 불명확하다.
- **Verifier oracle 미결정:** clean install은 인증이 없어 외부 call을 증명할 수 없고, authenticated smoke만으로는 재현성이 없다.

### Medium

- 특정 사용자 OAuth에서 얻은 tool list를 provider 보편 계약으로 배포해도 되는지 불명확하다.
- original response hash와 sanitized snapshot hash의 provenance 관계가 정의되지 않았다.
- disconnected tool을 숨기면 discovery가 안 되고, 보여주면 callable로 오해할 수 있다.
- “다운로드”가 MCP package 설치인지 authenticated contract snapshot인지 provider별로 다르다.

## Dimension ledger

| Dimension | Readiness | Known | Open |
|---|---:|---|---|
| Goal | 4/4 | AI-facing dual contract system과 external MCP abstraction | 없음 |
| Constraint | 3/4 | official source, secret-free, AI-first, provider-generic, ima2-owned execution | snapshot 배포 범위 |
| Success criteria | 1/4 | clean-install AI discoverability가 필요 | 실제 verifier와 callable 완료 기준 |
| Ontology | 3/4 | `ima2.*` normalized + `mcp.<provider>.*` executable passthrough, ExecutionOwner=ima2 | availability 축, callable predicate |

## OPEN ASSUMPTIONS

- machine contract는 human Markdown보다 권위가 높은 SoT projection이 될 가능성이 높다.
- availability는 단일 enum이 아니라 provenance, freshness, auth, entitlement, caller 축으로 갈릴 가능성이 높다.
- remote endpoint와 local MCP package는 같은 provider라도 별도 source identity가 필요하다.
- public redistribution 허용이 확인되지 않은 upstream snapshot은 npm package에 bundle하지 않는다.
- secret sanitization과 AI trust/prompt-injection 검사는 별도 단계로 둔다.
- exact callable predicate는 execution authority 답변 뒤에 정의한다.
- 이 작업은 docs-first multi-cycle unit으로 다룬다.
- 현재 기록은 local worktree에는 존재하지만 아직 commit되지 않았다. durable handoff 완료로 간주하지 않는다.

## Contradiction rescan evidence

### Rescan round 1 — after dual-contract answer

- Lenses: AI usability/success, execution authority, contract lifecycle/distribution.
- High contradiction clusters: 3.
  1. `ima2.*`와 `mcp.*`를 실제로 실행하는 authority chain이 미정이다.
  2. bundled reference와 account-local live snapshot의 배포·권한 경계가 미정이다.
  3. `callable`과 end-to-end AI success를 판정할 machine verifier가 미정이다.
- Medium items recorded as open assumptions:
  - availability는 단일 enum보다 provenance/freshness/auth/entitlement/caller 축으로 분리될 가능성이 높다.
  - remote endpoint와 local package는 같은 provider라도 별도 source identity가 필요하다.
  - public redistribution 허용이 확인되지 않은 snapshot은 npm bundle에 넣지 않는다.
  - sanitization과 AI trust/prompt-injection 검사는 별도 단계다.
- Result: I-phase 유지. 다음 질문은 execution authority를 결정한다.

### Rescan round 2 — execution-authority question unanswered

- 입력: execution authority 선택 질문에 선택값이 기록되지 않음.
- Lenses: pending execution authority, pause integrity.
- High contradiction clusters: 4.
  1. caller가 정해지지 않아 `callable`의 truth value가 없다.
  2. `mcp.<provider>.*`가 reference인지 executable passthrough인지 미정이다.
  3. result/error/cancel/history 보장의 owner가 없다.
  4. clean-install discovery와 authenticated execution을 잇는 verifier oracle이 없다.
- Documentation corrections:
  - 010~090 각 문서에 pre-interview hypothesis banner를 둔다.
  - Round 1 결정과 OPEN ASSUMPTION을 분리한다.
  - uncommitted worktree 상태를 handoff risk로 기록한다.
- Result: Plan readiness blocked. I-phase에서 안전하게 pause한다.

### Rescan round 3 — after execution-authority + bundled-distribution answers

- 입력: Round 2(ExecutionOwner=ima2 runtime, mcp.* executable passthrough)와 Round 3(bundled + live 갱신) 답변.
- Lenses (Mind 3기 dispatch, read-only): verifier/success-criteria, availability/callable ontology, trust/distribution.
- High contradiction clusters: 4.
  1. **Verifier oracle 분열** — clean-install CI는 OAuth/credits가 없어 discovery까지만 증명하고 `tools/call`·혼합 파이프라인(GPT 이미지→Higgsfield 영상)의 end-to-end 성공은 증명할 수 없다. golden task는 entitlement/credit/outage에 따라 실패 원인이 모호해진다. → **사용자 질문 대상.**
  2. **documented ≠ callable 노출 구조** — 번들 snapshot이 항상 존재하므로, 노출 계약이 구조적으로 분리되지 않으면 AI가 발견 가능성을 실행 권한으로 오인한다. `connected`조차 tool-level entitlement를 보장하지 않는다. → 설계로 해소: 번들 entry는 영구히 `documented`(callable=false) 층이고, callable은 live 세션 + live tools/list 존재 + schema hash 일치에서만 참이며, call-time 거부는 typed error로 남는다. Round 2의 부정 조건(“snapshot만으로 실행 권한 없음”)의 구체화이므로 재질문 불필요.
  3. **번들 snapshot 출처/ToS** — remote OAuth server는 인증 후에만 tools/list가 가능해 “공개”가 균일하지 않고, 특정 계정 entitlement가 반영된 목록을 provider-wide 계약처럼 npm 재배포할 권한은 자동으로 생기지 않는다. → **사용자 질문 대상(번들 범위 refinement).**
  4. **Prompt-injection 신뢰 경계** — 공식 description도 AI context에 투영되면 untrusted instruction이 될 수 있다. → 설계로 해소: upstream description은 항상 quoted data + trust label로만 투영하고 instruction context에 병합하지 않는다. sanitizer는 secret 제거와 semantic/injection 검사를 별도 단계로 유지.
- Medium/Low → OPEN ASSUMPTIONS에 병합:
  - drift 감지의 live 비교 동작은 clean-install 테스트로 증명 불가 — authenticated tier에서만 검증 가능.
  - entitlement 차이와 schema drift를 verifier가 구분해야 한다(snapshot에 entitlement tag 필요).
  - `installed`는 remote endpoint에는 부적합한 축 — source identity(remote/package)별로 availability 축이 갈린다.
  - `blocked`는 원인 축(auth/entitlement/revocation/drift)으로 분해해 typed status(`auth_required`/`unavailable`/`schema_changed`)에 매핑한다.
  - golden task는 upstream 진화와 회귀를 구분하도록 contract-shape 검증과 값 고정 검증을 분리한다.
  - `ima2.*`와 `mcp.*`가 충돌할 때 안전성 판단의 최종 권위는 normalized 층이다(후속 확정 필요).
- Result: I-phase 유지. 남은 사용자 질문은 verifier tiering과 번들 범위 refinement 두 개다.

## 다음 인터뷰 질문

없음 — 두 pending 질문 모두 답변됐다. 번들 범위는 Round 5(전 provider full-schema 번들), verifier tiering은 Round 6(2층 검증)에서 확정됐고 I-phase는 종료됐다. 이후의 canonical roadmap은 `000_plan.md`, phase 상세는 010~090 decade 문서다.
