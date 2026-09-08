---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, progrok, roadmap, plan]
---

# 000 — Grok 레인 네이티브 xAI OAuth 전환 계획

## 결론

progrok 자식 프로세스 프록시를 걷어내고, `grok` 레인이 `https://api.x.ai`를 OAuth
access token으로 직접 부르게 한다. `grok-api`(직접 키) 레인과는 자격증명 출처만
다른 단일 코드 경로가 된다. 프록시 슈퍼바이저(`lib/grokProxyLauncher.ts` 325줄),
포트 협상, probe token, `waiting-for-login` 상태 기계, advertise의 `grok.live`가
전부 사라진다. 기존 사용자의 `~/.progrok/auth.json`은 그대로 읽으므로 재로그인이
없다.

## 왜 지금인가

progrok이 ima2 안에서 실제로 담당하는 일은 두 가지뿐이다. 만료 2분 전 refresh,
그리고 `Bearer dummy`를 진짜 토큰으로 바꿔 포워딩. 로그인(device code)은
`routes/auth.ts:79-141`이 이미 자체 구현했고, quota는 `routes/quota.ts:121`이
`auth.json`을 직접 읽는다. 그 두 가지를 위해 325줄짜리 7상태 슈퍼바이저와 8곳의
`provider === "grok-api" ? ctx.xaiApiKey : undefined` 분기가 존재한다
(002_callsite_inventory.md §8). `getGrokEndpoint`(`lib/grokImageCore.ts:62`)는
`directApiKey`가 있으면 이미 직접 `api.x.ai`를 친다. OAuth 토큰을 그 자리에 넣는
것이 전환의 전부다.

## 조사 근거 (000번대)

| 문서 | 내용 | 출처 |
|---|---|---|
| 001_opencodex_port_spec.md | OpenCodex `src/oauth/xai.ts` 이식 사양, 결함 D1~D9, `lib/xaiAuth.ts` API 초안 | opus-5 explorer + Node 24 실측 |
| 002_callsite_inventory.md | 프록시 도달 경로 전수(이미지/비디오/플래너/status), readiness 소비자, 401 훅 위치 | opus-5 explorer |
| 003_removal_blast_radius.md | 삭제/수정 파일 전수, 테스트 판정, SoT/문서/site/i18n, CI 게이트 | opus-5 explorer |
| 004_xai_docs_aside_research.md | docs.x.ai 183페이지 grep, OIDC discovery 실측, progrok 원본 | Aside exec (실브라우저) |

## 확정한 결정

| # | 결정 | 근거 |
|---|---|---|
| R1 | `grok` 레인은 폐기하지 않고 직접 호출로 재배선한다 | 003 §1-2 선택지 (b). 폐기하면 registry/UI/enum 전반 연쇄, 사용자 기능 손실 |
| R2 | 자격증명 파일 경로·스키마는 `~/.progrok/auth.json` 그대로 유지 | 001 §3. 기존 사용자 무마이그레이션. `idToken`은 있으면 보존 |
| R3 | `expiresAt`은 raw epoch ms, skew 120s는 읽는 쪽에서 적용 | 001 D8. OpenCodex의 skew 선차감 방식을 따르면 이중 차감 |
| R4 | refresh 실패 시 파일을 지우지 않는다. terminal(`invalid_grant`/`refresh_token_reused`/`revoked_token`) → `GROK_AUTH_REQUIRED`, 그 외 → `GROK_AUTH_REFRESH_FAILED` | 001 §4 |
| R5 | single-flight refresh + terminal negative cache 30s | 001 §6. 병렬 12건이 refresh_token을 12번 태우지 않게 |
| R6 | 401 재시도는 `lib/grokUpstreamRetry.ts`(leaf)에 넣지 않고, 새 `lib/grokRuntime.ts`의 `fetchWithGrokAuth`가 헤더를 재구성해 정확히 1회 재시도 | 001 §4, 002 §5. `grokFetchWithRetry`는 헤더를 다시 만들 수 없음 |
| R7 | `lib/atomicWrite.ts`는 재사용하지 않는다(0600 미보장, pid 고정 tmp). `routes/auth.ts:70-73` 패턴을 `lib/xaiAuth.ts`로 옮긴다 | 001 §4 |
| R8 | `/api/grok/status` 응답 리터럴(`ready`/`no_image_model`/`error`/`offline`)은 유지하고 의미만 재매핑 | 002 §3. UI 변경 최소화 |
| R9 | advertise payload의 `grok` 키는 `{ auth: "oauth" \| "none" }`로 축소. `~/.ima2/server.json`은 외부 계약이라 키 자체는 남긴다 | 003 §1-4 |
| R10 | `findAvailablePort` export는 유지(테스트 2개 소비) | 003 §1-7 |
| R11 | `ima2 grok login/status/logout`은 네이티브 서브커맨드로 재작성. `models`/`proxy`는 제거 | 003 §1-8 |
| R12 | OpenCodex 결함 D1/D2/D3/D6은 lidge-jun/opencodex(canonical; package.json repository)에 이슈로 등록(코드 수정은 범위 밖) | 001 §5, 사용자 승인 |

## 알려진 위험

- **xAI가 OAuth→api.x.ai를 공식 문서화하지 않았다** (004 §0, §3). 문서상 OAuth를
  받는다고 명시된 엔드포인트는 `/v1/me`뿐이다. progrok이 지금까지 같은 경로로
  동작해 왔으므로 전환 자체가 위험을 새로 만들지는 않지만, 이 경로가 닫히면
  `grok-api`(키) 레인만 남는다. 이 사실을 structure/06과 README에 명기한다(wp5).
- access token 수명과 refresh rotation 정책이 미문서(004 §4). `expiresAt` 부재를
  "모름"으로 다루고 401을 신호로 쓴다(R3, 001 D5).
- pr-fast.yml에는 package install smoke와 Windows 레인이 없다(003 §5-2).
  progrok 제거의 패키징 파손은 dev push 후 ci.yml에서야 보인다. wp4 C에서
  `workflow_dispatch`로 ci.yml을 후보 SHA에 직접 돌린다.

## 워크페이즈 지도 (의존 순)

| WP | 브랜치 | PR base | 내용 | 문서 |
|---|---|---|---|---|
| wp1 | `codex/grok-native-oauth-01-roadmap` | dev | 이 유닛의 000~050 문서만 | 이 문서 |
| wp2 | `codex/grok-native-oauth-02-xai-auth` | wp1 | `lib/xaiAuth.ts` + 계약 테스트. 아직 아무도 호출하지 않음 | 010 |
| wp3 | `codex/grok-native-oauth-03-direct-lane` | wp2 | `lib/grokRuntime.ts` 재작성(`resolveGrokCredential`, `fetchWithGrokAuth`), 호출부 11곳 전환, 프록시 코드는 아직 존재하되 미사용 | 020 |
| wp4 | `codex/grok-native-oauth-04-remove-progrok` | wp3 | 슈퍼바이저/config/vendor/CLI 제거, readiness 재정의, 테스트 삭제·재작성, 생성물 게이트 | 030 |
| wp5 | `codex/grok-native-oauth-05-docs` | wp4 | structure SoT, README/docs/site/i18n, 선행 유닛 아카이브, 최종 CI green | 040 |

050_verification.md가 각 WP의 C 게이트와 최종 증거 형식을 정의한다.

각 레이어는 자기 tip에서 typecheck/test가 통과해야 한다(DEV-STACK-03). wp3 tip에서는
프록시 코드가 남아 있지만 호출자가 없으므로 컴파일·테스트가 그대로 통과한다.
wp2 tip에서는 `lib/xaiAuth.ts`가 고립 모듈이라 기존 동작에 영향이 없다.

## 범위 밖

openai-oauth 프록시 전환, 새 provider, PR #229, UI 디자인 변경, OpenCodex 코드 수정,
`grok-api` 플래너의 xAI 경유 여부(002 §4 별건), merge/release.

## SoT 동기화 대상 (wp5)

`structure/00-structure-hub.md`, `structure/01-file-function-map.md`,
`structure/02-command-reference.md`, `structure/06-infra-operations.md`,
`AGENTS.md:28`, `README.md`, `docs/{API,CLI,README.ko}.md` + zh 번역 6종,
`site/src/pages/docs/**` 12파일, `skills/ima2/SKILL.md:88`, `ui/src/i18n/*.json` 4로케일.
전체 목록은 003 §3, §6.

## OpenCodex 이슈

canonical 저장소는 lidge-jun/opencodex(package.json `repository`). 코드 수정은 이 유닛 범위 밖.

| 결함 | 이슈 | 상태 |
|---|---|---|
| D1 retry-after 2000ms 절삭 | lidge-jun/opencodex#4045 | 등록 (2026-09-09) |
| D2 retry-after HTTP-date 무시 | lidge-jun/opencodex#4046 | 등록 (2026-09-09) |
| D3 커스텀 abort reason 재시도 | lidge-jun/opencodex#4047 | 등록 (2026-09-09) |
| D6 endpoint host 검증 (서브도메인·userinfo) | lidge-jun/opencodex#4048 | 등록 (2026-09-09) |
