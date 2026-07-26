# 000 — MCP 모델별 capability preset 계획

## Loop spec

- Archetype: spec-satisfaction repair.
- Trigger: Runway/Higgsfield 모델 목록은 보이지만 선택 모델의 해상도, 길이, 비율, 입력 역할이 사라져 있고 Runway 생성 경로는 ratio만 전달한다.
- Goal: 모델 선택이 provider가 선언한 capability를 우측 Settings에 즉시 투영하고, Runway payload에는 검증된 값만 전달한다.
- Non-goals: Higgsfield 생성 unlock, 유료 generation smoke, end-frame/video-to-video 업로드 UX, 코어 GPT/Grok/Gemini 설정 재설계, MCP audio/3d catalog.
- Verifier: `npm run typecheck`, `npm run typecheck:tests`, `npm run build:server`, focused MCP tests, `cd ui && npm run build`, localhost read-only API probe, browser screenshot/keyboard QA.
- Stop: 대표 Runway/Higgsfield image/video 모델을 바꿀 때 controls/options/default가 실제 capability대로 달라지고, unsupported/stale 값은 upstream call 전에 제거 또는 거부된다.
- Memory: 이 폴더의 001/002/010 문서, `.codexclaw/goalplans/ima2-gen-mcp-capability-runway-higgsfield-durati/ledger.jsonl`, C 스크린샷.
- Terminal outcomes: DONE/NOOP/BLOCKED/UNSAFE/NEEDS_HUMAN/BUDGET_EXHAUSTED는 host goal objective 정의를 따른다.
- Escalation: 위로는 동일 packet을 두 agent가 실패하면 main이 회수한다. 아래로는 P에서 명시한 read-only 조사/감사만 위임한다. B 도중 새 write lane을 임의로 위임하지 않는다.
- HOTL bounds: `$HOME/.ima2/mcp-spike` OAuth 자격은 기존 refresh용으로만 사용하며 출력하지 않는다. Higgsfield는 `models_explore action=list`만 호출한다. 유료 tool call 0건/0원. write scope는 아래 파일표와 devlog/goalplan뿐이다. wall-clock 90분.

## 현재 원인

1. `lib/mcp/modelsCatalog.ts:30-48`은 Higgsfield `models_explore` item에서 `id/name/description`만 남긴다. live 61개 item에 있는 `aspect_ratios`, `parameters`, `medias`, `durations`, `duration_range`가 여기서 소실된다.
2. `ui/src/lib/mcpSelection.ts:16-27`은 provider 사실이 아닌 공통 3개 ratio만 whitelist한다. 21:9, 4:3, 3:4 등 실제 지원값을 Auto로 떨어뜨린다.
3. `ui/src/components/settings/McpGenerationControls.tsx:106-148`은 우측 패널에서 모델 전체를 다시 2열 grid로 반복하고 Runway 공통 ratio만 보인다. Higgsfield 61모델에서는 확장되지 않는다.
4. `lib/mcp/providerAdapter.ts:5-14`와 `routes/mcpMedia.ts:201-243`에는 generic preset parameter carrier가 없다. `lib/mcp/adapters/runway.ts:17-46`은 duration/resolution/audio를 전달하지 않는다.

## No-code 옵션 판정

- Do nothing: latest user requirement를 충족하지 못해 기각.
- Delete: 우측 중복 모델 grid는 삭제 가능하고 010에 포함한다. preset control 자체는 삭제로 해결되지 않는다.
- Configure: provider가 이미 capability를 내려주지만 현재 projection이 버리므로 config만으로 복구 불가.
- Reuse: 기존 `/api/mcp/providers/:id/models`, `models_explore`, `Select`/`option-btn`, Zustand generation defaults, `buildMcpGenerationInput`, adapter boundary를 그대로 확장한다. 새 query library나 form dependency는 추가하지 않는다.

## Threat model

- Assets: OAuth refresh token, provider account/credits, local generated history, tool allowlist.
- Entrypoints: browser `/api/mcp/providers/:id/models`, browser `/api/mcp/generate`, untrusted provider `models_explore` result.
- Attacker/error capability: malformed provider item, local/LAN caller가 arbitrary parameter/tool name 주입, stale localStorage, schema drift.
- Controls: upstream tool name은 계속 상수 `models_explore`; catalog parser는 길이/타입/개수 제한; generation route는 scalar record만 허용; Runway adapter는 selected model capability whitelist로 ratio/parameter를 검증; Higgsfield `executable:false`와 billing denylist 유지; secrets는 응답/로그/devlog에 미포함.
- Blast radius: invalid optional preset은 해당 job만 typed error로 종료하며 provider call을 실행하지 않는다. catalog completeness가 execution entitlement를 바꾸지 않는다.

## Work-phase

이 단위는 한 개의 수직 work-phase다. capability contract, UI state, adapter forwarding은 각각 따로 배포 가능한 기능이 아니라 같은 user-visible 선택 계약의 producer/consumer라 한 PABCD에서 닫는다.

## SoT sync

`structure/01-file-function-map.md`는 이 사이클 시작 전부터 다른 작업이 수정 중이라 write/commit scope에서 제외한다. 이 단위의 SoT는 010 data contract, exported types, focused contract tests, 011 implementation record로 닫고, structure 문서는 병행 변경이 정리된 뒤 별도 sync한다.
