---
created: 2026-08-25
tags: [ima2-gen, devlog, phase3, cli, skills, capability-discovery, diff-level]
---

# 030 — wp3: CLI help와 skill의 동적 capability 노출

## 목표

CLI help와 packaged skill이 "현재 무엇을 쓸 수 있는지"를 하드코딩 산문이 아니라
live registry에서 유도한다. 산문이 드리프트하면 사용자는 없는 lane을 시도하고,
에이전트는 없는 모델을 부른다.

## Tier-2 근거

| 사실 | 출처 |
|---|---|
| MCP는 tools/list + notifications/tools/list_changed로 live 능력 발견을 규범화한다 | modelcontextprotocol.io 2025-06-18 스펙 |
| Agent Skills 스펙은 SKILL.md 안에 live registry를 두지 않는다; 정적 메타 + progressive disclosure + 런타임 조회가 규범 | agentskills.io/specification |
| argparse류는 등록된 커맨드 트리에서 help를 렌더한다 — 등록이 곧 help의 원천 | docs.python.org argparse |
| tool_search/defer_loading은 큰 인벤토리를 지연 로드한다 | developers.openai.com tools 가이드 |

결론: **2계층 계약**이 맞다. SKILL.md는 안정적인 워크플로와 *발견 방법*을 담고,
현재 상태는 런타임 조회로 얻는다. 스킬 본문에 lane 목록을 박아 넣지 않는다.

## 현재 드리프트 실측

| 위치 | 하드코딩된 내용 | 실제 |
|---|---|---|
| skills/ima2/SKILL.md:679-710 | "Grok 또는 MCP lane", provider 목록 grok/grok-api/runway/higgsfield | comfy가 wp1 이후 video 가능해짐 |
| skills/ima2/SKILL.md:60-61 | lane/model 예시가 산문에 고정 | 카탈로그는 12 lane |
| bin/commands/*.ts의 HELP 상수 | provider 열거가 문자열 리터럴 | registry가 원천 |

## File change map

### 1. lib/capabilities.ts — MODIFY (또는 신설 lib/capabilitySummary.ts)

lane/model/capability를 한 줄 요약으로 만드는 **단일 규칙**을 export한다. 현재
bin/commands/models.ts의 capText가 이 규칙을 사적으로 갖고 있고, wp2가 UI에서
같은 규칙을 필요로 한다. 세 소비자(UI, CLI, skill 렌더러)가 한 구현을 공유한다.

### 2. bin/commands/capabilities.ts — MODIFY

이미 존재하는 커맨드를 skill/agent 소비에 맞게 확장한다. 새 서브커맨드:

    ima2 capabilities --json          # 전체 lane/model/capability 스냅샷
    ima2 capabilities --summary       # 사람이 읽는 짧은 표

서버가 죽어 있으면 정직하게 실패한다 — 캐시된 산문으로 대체하지 않는다. 이것이
이 유닛 전체를 관통하는 정직성 원칙이다.

### 3. bin/lib/help.ts — NEW (또는 기존 output.ts 확장)

HELP 문자열 안의 provider/모델 열거 자리에 런타임 치환 슬롯을 둔다. 서버 도달이
불가하면 슬롯을 "run 'ima2 capabilities' for the live list"로 접는다 — 거짓 목록을
보여주느니 조회 방법을 알린다.

영향 커맨드: gen, video, models, defaults, edit, multimode. 각 HELP의 provider 열거를
슬롯으로 교체한다.

### 4. skills/ima2/SKILL.md — MODIFY

lane/provider 열거 산문을 **발견 지시**로 교체한다. 예: "현재 사용 가능한 video lane은
`ima2 capabilities --json`으로 확인한다"로 바꾸고, 고정 목록은 예시임을 명시한다.
skills/ima2-front, ima2-uiux도 같은 원칙으로 provider 언급 부분만 손댄다.

tests/skill-video-claims-contract.test.ts가 이미 스킬의 video 주장을 검사한다 —
이 테스트를 새 계약(하드코딩 목록 부재)으로 확장한다.

### 5. scripts/generate-contract-docs.mjs — MODIFY

docs/CLI.md 등 파생 문서가 이 스크립트에서 나온다. 슬롯 도입 후 파생 문서가
여전히 일관되게 생성되는지 확인하고, tests/contract-docs-projection.test.ts를 맞춘다.

## Activation scenario (C-ACTIVATION-GROUNDING-01)

| 조건부 경로 | 트리거 | 증거 |
|---|---|---|
| 런타임 치환 슬롯 | 서버 살아있는 상태에서 ima2 gen --help | 실제 lane 목록이 출력에 등장 |
| 서버 부재 폴백 | 서버 정지 후 같은 명령 | 폴백 문구가 출력, 거짓 목록 없음 |
| lane 상태 변화 반영 | comfy origin down/up 두 상태 | 두 출력의 diff (c-5의 핵심 증거) |

## Accept criteria

1. ima2 capabilities --json이 live lane/model/capability를 낸다 (c-5).
2. CLI help의 provider 열거가 런타임 유도다 (c-5).
3. 서버 부재 시 거짓 목록 대신 조회 안내가 나온다 (c-5).
4. 스킬 본문에 드리프트 가능한 고정 lane 목록이 없다 (c-5).
5. 두 lane 상태에서의 출력 diff가 캡처된다 (c-5).

## SoT sync target

structure/02-command-reference.md, structure/03-server-api.md.
