---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase4]
---

# 040 — wp4 CLI: 워크플로 서브커맨드

의존: 030(라우트). CLI는 서버 API의 얇은 클라이언트다 — `bin/commands/`의
기존 규약이 그렇고 comfy도 예외를 만들지 않는다.

## 변경 지도

| 파일 | 동작 |
|---|---|
| `bin/commands/comfy.ts` | MODIFY — workflow 서브커맨드군 |
| `bin/lib/modelResolver.ts` | MODIFY — comfy 모델 검증 우회 |
| `docs/CLI.md` | MODIFY |
| `tests/cli-feature-parity-contract.test.js` | MODIFY |
| `tests/comfy-cli-contract.test.ts` | NEW |

## 1. bin/commands/comfy.ts

현재 54줄, `export` 서브커맨드 하나뿐이다. `SUB` 맵에 추가한다:

      ima2 comfy <subcommand> [options]

      Subcommands:
        export <filename> [-o <out>] [--force]
        workflow ls [--json]
        workflow add <file> --id <id> [--label <text>] [--origin <url>] [--yes]
        workflow inspect <file> [--json]
        workflow bind <id> --prompt <node.input> [--size <node>] [--seed <node.input>]
                            [--ref <node.input>] [--output <node>] [--negative <node.input>]
        workflow rm <id>

`workflow add`는 `.json`(API export)과 `.png`(임베드 그래프) 둘 다 받는다.
확장자가 아니라 **매직바이트로 판정한다** — 사용자가 PNG를 .json 이름으로
저장했을 수 있다.

### 바인딩 확정 흐름

    /**
     * The CLI mirrors the settings dialog: inspect, confirm, then save.
     *
     * Auto-inference cannot settle which CLIPTextEncode is positive, so a
     * non-interactive add REFUSES rather than guessing. --yes accepts the
     * inferred binding for UNAMBIGUOUS fields only; anything ambiguous still
     * requires an explicit --prompt/--negative. Guessing would silently swap
     * positive and negative prompts, and the failure would surface to the user
     * as "the model ignores my prompt" — a bug report nobody can trace back
     * to a binding default.
     */

TTY면 후보를 보여주고 번호로 고르게 한다. 비-TTY이고 모호한 필드가
남았으면 exit 2와 함께 필요한 플래그를 안내한다.

### workflow ls 출력

    ID        LABEL          ORIGIN                  STATUS
    kukuru    쿠쿠루삥뽕      127.0.0.1:8188          ready    (queue 0)
    euh       어흐           127.0.0.1:8189          offline

`--json`은 레코드 + 헬스를 그대로 낸다. 기존 `json()` 헬퍼를 쓴다.

## 2. gen 경로

    ima2 gen "고양이" --provider comfy --model kukuru

`bin/commands/gen.ts:15`가 `deriveProviderIds()`로 provider를 검증하므로
comfy가 레지스트리에 들어간 순간(010) 자동 통과한다. **gen.ts는 변경하지
않는다.**

문제는 모델 검증이다. `bin/lib/modelResolver.ts`가
`deriveCliImageModelSet()`으로 검증하는데 comfy 모델은 거기 없다(빈 배열).

    /**
     * A comfy model is a workflow id known only at runtime, so the CLI cannot
     * validate it against the derived set. Pass it through and let the server
     * answer 404 COMFY_WORKFLOW_NOT_FOUND — the same shape a typo'd id gets in
     * the web UI. Validating here would force the CLI to call
     * /api/comfy/workflows before every single generate.
     */

provider가 comfy일 때 모델 검증을 건너뛰는 분기를 넣는다. **040의 유일한
비-comfy 파일 변경**이다.

## 3. docs/CLI.md

`tests/cli-feature-parity-contract.test.js:97`이 docs의
`--provider <auto|...|minimax>` 문자열을 파싱해 실제 provider 목록과
대조한다. comfy를 문서에 추가하지 않으면 **이 테스트가 실패한다** — 즉 문서
갱신이 선택이 아니라 게이트다.

`ima2 comfy` 절에 workflow 서브커맨드를 추가한다.

## 4. 테스트

`tests/comfy-cli-contract.test.ts`: 인자 파싱(누락 --id → exit 2),
PNG/JSON 매직바이트 판정, 모호한 바인딩 + 비-TTY + --yes → 여전히 거부,
ls의 json 출력 형태.

## Accept criteria

1. `ima2 comfy workflow ls --json`이 스텁 서버에 대해 레코드+헬스를 낸다.
2. 모호한 바인딩을 `--yes`로 밀어붙여도 거부된다. **활성화 시나리오**:
   CLIPTextEncode 2개 픽스처 + 비-TTY + `--yes` → exit 2, 메시지에
   `--prompt` 안내 포함.
3. `npm test -- cli-feature-parity` 통과 (docs 동기화 증거).
4. `ima2 gen --provider comfy --model <미등록>`이 서버 404를 그대로 전달.

## Out of scope

대화형 워크플로 편집기. 워크플로 공유/내보내기 포맷.
