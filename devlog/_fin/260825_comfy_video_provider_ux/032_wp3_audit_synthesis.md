---
created: 2026-08-25
tags: [ima2-gen, devlog, phase3, audit, synthesis]
---

# 032 — wp3 A: 감사 합성

리뷰어: 독립 explorer (anthropic/claude-fable-5), 약 12분.
`VERDICT: GO-WITH-FIXES (blockers=5)`. **5건 전부 ACCEPT.**

리뷰어가 031의 전제 반증(030의 두 가정이 틀렸다는 실측)을 독립적으로 재확인했다.
그 부분은 블로커 없음.

## B1 [High] lane 상태의 출처와 async 배선이 명시되지 않았다 — ACCEPT

재확인: `buildIma2Capabilities`는 동기 함수이고 `{appConfig, packageVersion, source,
server}`만 받는다 — `RuntimeContext`가 없다. lane 상태는 `routes/models.ts`의
**export되지 않은** async 함수들이 만든다 (`buildCoreLanes:325`, `comfyLane:279`가
`probeComfyOrigins`를 await). `/api/capabilities` 핸들러(:9)는 동기 클로저다.

031의 "서버 안에서 실행되므로 함께 실을 수 있다"는 세 가지 실제 변경을 뭉갰다:
라우트를 async로 만들기, lane 상태를 `/api/models`와 **같은 계산**에서 가져오기,
그리고 매 capabilities GET마다 comfy 프로브와 agy spawn 탐지가 도는 비용.

가장 중요한 지적: **`lib/capabilities.ts` 안에서 lane 상태를 재구현하면 wp3가
없애려는 바로 그 이중 출처 드리프트를 만든다.**

수정:

- lane 상태 빌더를 `lib/`로 옮기거나 export한다. `/api/models`와 capabilities가
  **같은 함수**를 부른다.
- capabilities 라우트를 async + try/catch로 바꾼다.
- 지연 정책: `/api/models`가 이미 하는 프로브를 **짧은 TTL로 캐시**한다. UI가
  capabilities를 호출하므로 매번 원격 프로브를 도는 것은 받아들일 수 없다.

## B2 [Medium] "video help에 전부 열거"는 stale을 misleading으로 바꿀 뿐 — ACCEPT

재확인: registry가 모델별 `kind: "video"`를 갖고 있다 (`registry.ts:73-74`),
comfy는 `catalogAccess: "runtime"` + `models: []`로 **의도적으로** 비어 있다 (:230-236).

031의 "video 가능 lane 추리기는 런타임 카탈로그가 필요하다"는 **틀렸다.** 정적으로
유도 가능하다: `kind:"video"` 모델을 가진 core lane ∪ `catalogAccess:"runtime"` lane
∪ MCP video lane. 이 술어는 현재의 `grok|grok-api|comfy|runway|higgsfield`를 정확히
재현하고, 다음 video lane이 자동으로 합류한다.

gen.ts 패턴을 그대로 쓰면 `--provider oauth`를 video help가 광고하고 resolver가
거절한다 — stale보다 나쁜 misleading이다.

수정: registry 유도 video-capable 술어를 쓴다. 검증은 modelResolver가 계속 맡는다.

## B3 [Medium] lanes 키 도메인이 valid.providers와 충돌 — ACCEPT

재확인: `valid.providers`는 `["auto", ...core 10]`이라 `auto`를 **포함**하고
runway/higgsfield를 **누락**한다. `/api/models`의 lane 맵은 12개이고 `auto`가 없다.
같은 문서 안에서 lane 없는 provider와 provider 없는 lane이 동시에 존재하게 된다.

또한 `ModelLaneStatus`를 `routes/`에서 import하면 layering이 뒤집힌다 (지금은
routes → lib 방향뿐).

수정: `lanes` 키 = `/api/models` lane id 집합임을 명시한다. `valid.providers`는
**CLI 플래그 어휘**, `lanes`는 **런타임 lane 맵**이라고 structure/03에 한 줄 적는다.
`ModelLaneStatus` 타입을 `lib/`로 옮긴다.

## B4 [Medium] 드리프트 인벤토리가 같은 부류 3곳을 놓쳤다 — ACCEPT

1. `skills/ima2/SKILL.md:709-710` — "Runway is available when connected; Higgsfield
   remains locked..." 는 **런타임 상태 주장을 산문에 얼려둔 것**이다. G1이 "실행 중인
   서버만 알 수 있다"고 말한 바로 그 종류의 사실이다. 계획은 :695만 고쳤다.
2. `bin/commands/multimode.ts:53` — 손으로 관리하는 12개 모델 리터럴.
   `edit.ts:50`은 이미 `KNOWN_IMAGE_MODELS`로 올바르게 한다. 한 줄 패턴 적용이면 된다.
3. `docs/CLI.md:76,79,90` — 손으로 쓴 provider 목록. 생성 스크립트가 없음을 리뷰어가
   확인했다.

수정: 1과 2는 파일 맵에 넣는다. 3(docs/CLI.md + 번역본)은 **명시적으로 범위 밖**으로
선언하고 후속으로 남긴다 — 번역 3종까지 포함하면 별도 work-phase 크기다. 범위 밖임을
적는 것과 놓치는 것은 다르다.

## B5 [Low] lanes 생략은 source와의 결합을 계약으로 고정해야 한다 — ACCEPT

재확인: payload에 이미 `source: "local" | "server"`가 있다. 따라서 생략이 추측된
`unknown` 마커보다 낫다 — 단, 테스트가 **쌍조건**(`lanes` 존재 ⟺ `source === "server"`)을
단언하고, 스킬이 에이전트에게 lane 부재를 믿기 전에 `source`를 보라고 지시할 때만.

리뷰어가 count-only 설계는 **지지**했다: 이 층위의 결정은 lane 선택이고, 모델 선택은
어차피 `ima2 models`가 필요하다. `video: 0` vs `video: 2`가 실행 가능한 정보다.
`reason` 필드가 진짜 하중을 받는 부분이므로 non-ready lane에는 필수로 유지한다.

## 깨질 테스트 (리뷰어 표에서 확인)

| 파일 | 깨지는가 |
|---|---|
| `tests/cli-video-command-contract.test.js:118` | **예** — video.ts:130과 함께 바뀐다 |
| `tests/cli-capabilities-contract.test.js:30` | VALID_PROVIDERS 줄을 건드리면 |
| 나머지 capabilities 계약 테스트 | 아니오 — 추가는 안전 |
| `tests/contract-docs-projection.test.ts` | 아니오 — 마커 밖 산문은 안전 |

## 판정

5건 전부 구체적 수정으로 접혔다. B1이 가장 중요하다: 그것을 무시하면 wp3가 자기
목적을 배반한다. main 판정: **pass**.
