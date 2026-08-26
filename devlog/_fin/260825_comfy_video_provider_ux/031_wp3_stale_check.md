---
created: 2026-08-25
tags: [ima2-gen, devlog, phase3, stale-check, capability]
---

# 031 — wp3 P: stale check + 설계 확정

## 030 대조: 실측이 계획을 상당히 뒤집는다

| 030의 가정 | 실측 | 판정 |
|---|---|---|
| CLI help의 provider 열거가 문자열 리터럴 | `gen.ts:74`, `multimode.ts:55`는 **이미** `PROVIDER_VALUES.join("|")`로 보간 | **부분 무효** |
| `ima2 capabilities` 확장 필요 | 이미 존재하고 provider를 registry에서 유도한다 | **부분 무효** |
| skills/ima2/SKILL.md에 고정 목록 | `:695` `--provider <grok\|grok-api\|runway\|higgsfield>` 등 실재 | 유효 |
| bin/commands/video.ts 하드코딩 | wp1에서 comfy를 추가했지만 여전히 손으로 관리하는 문자열 | 유효 |

`multimode.ts:13`과 `edit.ts:14`는 `["auto", ...deriveProviderIds()]`로 이미 registry
유도다. 즉 **이 저장소에는 이미 올바른 패턴이 있고**, 일부 표면만 그 패턴을 따르지
않는다. 새 메커니즘을 발명할 일이 아니라 기존 패턴을 마저 적용할 일이다.

이건 계획을 축소하는 게 아니라 정확하게 만드는 것이다. 이미 동적인 것을 "동적으로
만들었다"고 적는 것이야말로 거짓 보고다.

## 진짜 남은 격차

### G1. capabilities가 lane **상태**를 말하지 않는다

`ima2 capabilities --json`의 최상위 키에 `lanes`가 없다. `providers:`는 registry가
아는 id 목록일 뿐, 지금 쓸 수 있는지는 말하지 않는다. wp2가 UI에 준 정보를 에이전트는
못 받는다.

실측: `providers: auto, oauth, api, grok, grok-api, agy, gemini-api, atlascloud,
minimax, nai, comfy` — 11개 전부 동등하게 나열된다. 실제로는 4개가 키 없음,
1개가 연결 끊김인데도.

이게 wp3의 핵심이다. 에이전트가 `ima2 capabilities`를 읽고 `minimax`를 고르면
키가 없어 실패한다. lane 상태를 실으면 그 왕복이 사라진다.

### G2. bin/commands/video.ts의 provider 열거가 수동 관리

`:130`이 손으로 쓴 문자열이다. wp1에서 comfy를 추가할 때 내가 직접 고쳤는데, 그건
다음 lane에서 또 같은 일이 반복된다는 뜻이다. `gen.ts` 패턴을 적용한다.

### G3. skills/ima2/SKILL.md의 고정 목록

`:695`가 `<grok|grok-api|runway|higgsfield>`로 못박아서 wp1 이후 이미 틀렸다 —
comfy가 빠져 있다. 스킬 본문에 lane 목록을 박는 것 자체가 드리프트 원천이다.

Tier-2 근거(030): Agent Skills 스펙은 SKILL.md에 live registry를 두지 않는다.
정적 지시 + 런타임 조회가 규범이다. 따라서 목록을 갱신하는 게 아니라 **조회 지시로
교체**한다.

## File change map

### 1. lib/capabilities.ts — MODIFY

`buildIma2Capabilities`에 optional `lanes` 필드를 추가한다. 서버 경로에서는
`/api/capabilities`가 이미 서버 안에서 실행되므로 lane 카탈로그를 함께 실을 수 있다.

    lanes?: Record<string, { status: ModelLaneStatus; reason?: string; image: number; video: number }>

모델 id 전체가 아니라 **개수**만 싣는다. 전체 목록은 이미 `ima2 models`가 답하고,
capabilities는 "무엇을 쓸 수 있는가"의 요약이다. 두 곳에서 같은 목록을 유지하면
그것이 새 드리프트 원천이 된다.

로컬 폴백(서버 미가동)에서는 `lanes`를 **생략**한다. 상태는 실행 중인 서버만 알 수
있다. 추측한 상태를 싣느니 없는 편이 정직하다.

### 2. bin/commands/capabilities.ts — MODIFY

`printText`에 lane 섹션을 추가한다. ready lane은 이름만, 그 외는 사유와 함께.

### 3. bin/commands/video.ts — MODIFY

`:130` 열거를 `gen.ts`처럼 registry 유도로 바꾼다. video 가능 lane만 추리는 것은
런타임 카탈로그가 필요하므로, help에서는 전체를 열거하고 검증은 modelResolver가 한다
(현행 동작 유지).

### 4. skills/ima2/SKILL.md — MODIFY

`:695`의 고정 목록을 조회 지시로 교체한다. 다른 고정 목록도 같은 원칙으로 훑는다.
예시는 예시임을 명시하고, 현재 상태는 `ima2 capabilities`로 확인하게 한다.

### 5. tests/ — MODIFY/NEW

- `tests/capabilities-contract.test.*`: lanes 필드의 존재/부재 계약.
- `tests/cli-video-command-contract.test.js`: help의 provider 열거가 registry 유도.
- `tests/skill-video-claims-contract.test.ts`: 스킬에 고정 lane 목록이 없을 것.

## Activation scenario (C-ACTIVATION-GROUNDING-01)

| 조건부 경로 | 트리거 | 증거 |
|---|---|---|
| lanes 필드 존재 | 서버 가동 중 `ima2 capabilities --json` | lanes 키와 실제 상태 |
| lanes 필드 생략 | 서버 정지 후 같은 명령 | lanes 부재 + 거짓 상태 없음 |
| 상태 변화 반영 | comfy origin down/up 두 상태 | **두 출력의 diff** (c-5의 핵심) |
| video help 열거 | `ima2 video --help` | comfy 포함, 손수정 없이 |

## Accept criteria

1. `ima2 capabilities --json`이 lane 상태를 낸다 (c-5).
2. 서버 부재 시 lanes를 생략하고 거짓 상태를 만들지 않는다 (c-5).
3. 두 lane 상태에서의 출력 diff가 캡처된다 (c-5).
4. video help의 provider 열거가 registry 유도다 (c-5).
5. 스킬 본문에 드리프트하는 고정 lane 목록이 없다 (c-5).

## SoT sync target

`structure/02-command-reference.md`, `structure/03-server-api.md`.
