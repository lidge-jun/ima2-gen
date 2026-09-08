---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, progrok, wp5, docs, sot]
---

# 040 — wp5: SoT·문서·i18n 동기화, 선행 유닛 아카이브, 최종 CI

브랜치 `codex/grok-native-oauth-05-docs`, base `codex/grok-native-oauth-04-remove-progrok`.
클래스 C2(문서) + 최종 검증. 003 §3, §6이 전수 목록이다.

## structure/ (SoT)

| 파일:줄 | 현재 | 변경 |
|---|---|---|
| `structure/06-infra-operations.md:61` | Mermaid `SRV --> GROK["progrok<br/>default port 18645"]` | 노드 삭제, `SRV --> XAI["api.x.ai<br/>OAuth bearer / API key"]` |
| `:77` | bundled dependencies `progrok, patched openai-oauth, zod` | `patched openai-oauth, zod` |
| `:168-170` | env 표 `IMA2_GROK_PROXY_HOST/_PORT`, `IMA2_NO_GROK_PROXY` | 삭제 + "3.16에서 제거됨, 무시됨" 한 줄 |
| `:213` | `provider: "grok"` uses bundled progrok | "`grok`는 `~/.progrok/auth.json`의 xAI OAuth 세션으로 api.x.ai를 직접 호출한다. xAI는 이 경로를 공식 문서화하지 않았다(004 §0)" |
| `:374` 변경 이력 | — | 2026-09-09 항목 추가 |
| `structure/00-structure-hub.md:13,21,38,59` | progrok 언급 4곳 | `lib/xaiAuth.ts`/`lib/grokRuntime.ts`로 재서술, Mermaid `API --> XAI` |
| `structure/02-command-reference.md:58,134,143,192` | `ima2 grok login/status/models/proxy`, "bundled progrok OAuth" | `login/status/logout`, "xAI OAuth 세션(device code)" |
| `structure/01-file-function-map.md` | :292 grokProxyLauncher 행, :293 grokRuntime 설명, :137 grok.ts, :68 | 행 삭제/설명 갱신, `lib/xaiAuth.ts`·`lib/xaiDeviceLogin.ts` 행 추가, 라인수 스크립트 재실행 |
| `structure/07-devlog-map.md` | — | 이 유닛 등재 |

## 사용자 문서

`README.md:173-174,355-357`, `docs/CLI.md:18,116,165-168,468`, `docs/API.md:65,155,166,397,882-883`,
`docs/README.ko.md:135-136,266-268`, zh-CN/zh-TW 6종 동일 위치, `skills/ima2/SKILL.md:88`,
`AGENTS.md:28` (`- Grok: xAI OAuth (device code) 또는 API key, api.x.ai 직접 호출`).
`docs/grok-video-i2v-*` 9파일은 과거 계획 문서라 손대지 않는다(003 §3-3).

README/docs에 "xAI 미문서 경로" 위험 문단 1개를 추가한다(000_plan 알려진 위험 1).

## site/ (Astro)

`site/src/pages/docs/reference/config.astro:45-47`(+ko) env 3행 삭제,
`concepts/architecture.astro`, `concepts/providers.astro`, `reference/api.astro`, `reference/cli.astro`, `docs/index.astro` (각 en+ko), `site/src/i18n/strings.ts` 4곳.
`cd site && npm run build`로 확인.

## UI i18n (4 로케일)

`ui/src/components/ResultMetadataModal.tsx:23` `"Grok OAuth / progrok"` → `"Grok OAuth"`.
en/ko/zh-Hans/zh-Hant 각각: `readiness.grokApiBody`(360), `provider.grokOffline`(740, "Grok 로그인이 필요합니다"), `provider.grokOfflineHint`(743), `grokManagedByIma2`(744), `grokCompatBody`(748), `grokEyebrow`(1326, "xAI OAuth"), `grokBody`(1328), `unsupportedHelp`(1391), 1640.
`tests/i18n-dictionary-contract.test.ts`가 키 집합을 동결하므로 키 이름은 유지하고 값만 바꾼다.

## 선행 유닛 아카이브 (003 §4-3)

`git mv devlog/_plan/260819c_grok_proxy_supervision devlog/_fin/260819_grok_proxy_supervision`.
`900_superseded.md` 추가: 054c729f가 WP2~WP4를 실제 구현했다는 사실(README:26의 "구현 미착수" 오기 정정), 이 유닛이 그 구현을 통째로 제거한다는 사실, 경로.
`devlog/_plan/README.md:26` 행 삭제, `_fin` 이동 기록 추가, 이 유닛을 Active Lane에 등재.

## 검증

`npm run typecheck && npm run typecheck:tests && npm test && npm run test:inventory && npm run docs:runtime:check && node scripts/refresh-structure-line-counts.mjs --check && (cd ui && npm run build) && (cd site && npm run build)`.
`rg -n 'progrok|18645|IMA2_GROK_PROXY|IMA2_NO_GROK_PROXY' README.md docs structure site skills AGENTS.md ui/src --glob '!docs/grok-video-i2v-*' --glob '!devlog/**'` → 0건.
최종: 050_verification.md의 스택 CI 절차.
