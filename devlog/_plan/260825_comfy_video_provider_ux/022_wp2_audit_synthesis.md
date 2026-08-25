---
created: 2026-08-25
tags: [ima2-gen, devlog, phase2, audit, synthesis]
---

# 022 — wp2 A: 감사 합성

리뷰어: 독립 explorer (anthropic/claude-fable-5). `VERDICT: GO-WITH-FIXES (blockers=8)`.
main이 High 3건을 실제 소스로 재검증했다. **8건 전부 ACCEPT.**

## B1 [High] 카탈로그 유도 providerSupportsVideo가 comfy 아래에 Grok 목록을 흘린다

재확인: `:319`의 `if (providerSupportsVideo || videoModel)` 블록이 렌더하는 items는
`VIDEO_MODEL_OPTIONS` — grok 전용 정적 목록이다. 그 행들은 `VIDEO_PREFIX`를 쓰므로
클릭이 `selectVideoModel`로 가고, 거기서 wp1이 문서화한 바로 그 강제 치환이 일어난다
(storeSettingsImpl.ts:493-499).

즉 020 §3대로 플래그만 카탈로그 유도로 바꾸면: comfy는 vid=1이므로 플래그가 참이 되고,
comfy 전용 video 그룹(:304-318)과 Grok video 그룹이 **동시에** 렌더된다. 사용자가
ComfyUI를 고른 상태에서 Grok 행을 누르면 조용히 grok으로 넘어간다. wp1이 막은 함정을
wp2가 다시 여는 셈이다.

수정: 플래그가 아니라 **items를 lane별 카탈로그에서 유도한다.** video 그룹은
`catalog[provider].models.video`로 만들고, comfy는 `COMFY_VIDEO_PREFIX` 경로를
유지한다. 021의 "comfy 특수 분기의 존재 이유도 사라진다"는 서술을 **철회한다** —
그 분기가 comfy를 normalizeVideoModelValue 강제 치환에서 떼어놓는 장치다.

## B2 [High] 12 lane에는 MCP lane 2개가 섞여 있다

재확인: `routes/models.ts:37` `ModelLaneId = CoreProviderId | "runway" | "higgsfield"`.
MCP 선택은 `mcp:` 접두와 `setMcpProviderImpl`을 쓰는 완전히 다른 경로다.
`Object.keys(lanes)`로 core 그룹을 만들면 runway/higgsfield가 두 번 나오고, core 쪽
복제본 클릭은 non-Provider id를 core store 경로로 보낸다.

수정: core 그룹 = 카탈로그 lane 중 `isCoreProviderId`인 것만. accept criterion 1을
"12개 lane이 **두 그룹에 걸쳐** 렌더된다"로 정정한다.

## B3 [High] 미지 lane id가 리터럴 유니온으로 무검사 캐스팅된다

재확인 체인:

- `ui/src/generated/providers.ts`는 생성 파일이고 `CORE_PROVIDER_IDS`는 10개 고정.
- `:195`가 `as Provider`로 무검사 캐스팅한다.
- `setProviderImpl`에 분기가 없으면 `:405`/`:409`로 떨어져 GPT 이미지 모델이 미지
  lane에 붙는다.
- `imageModels.ts:116`이 매칭 실패 시 `OPENAI_IMAGE_MODEL_OPTIONS`로 폴백한다 —
  comfy 주석이 막으려던 바로 그 누수.
- `storePersistence.ts:323` `isProvider = isCoreProviderId`라 새로고침하면 되돌아간다.

수정: 라벨 맵에 없는 lane은 **표시하되 선택 불가**(`disabled: true` + 상태 배지)로
둔다. "새 lane이 UI에서 사라지지 않는다"는 목표는 그대로 달성되고, 유니온 확장·store
수술·persistence 변경이 전부 불필요해진다. 선택 가능하게 만드는 것은 registry 재생성을
포함하는 별도 work-phase다 — 이번 범위가 아니다.

## B4 [Medium] 소스 문자열을 고정하는 테스트 4개 — ACCEPT

- `tests/nai-ui-registration-contract.test.ts:68` — `/value: "nai", label: "NovelAI"/`
- `tests/comfy-ui-contract.test.ts:43` — `/value: "comfy", label: "ComfyUI"/`
- `tests/comfy-ui-contract.test.ts:50` — comfy video 분기 전체
- `tests/mcp-provider-ui-contract.test.js:199` — selector 소스의 함수 존재

라벨 맵으로 바꾸면 앞의 둘이 깨진다. 020 §5에 네 파일을 모두 넣는다.

## B5 [Medium] 존재하지 않는 로케일 — ACCEPT

실제 사전은 `en / ko / zh-Hans / zh-Hant` 4종이고 `ja`는 없다. 020 §4를 정정한다.
재사용 가능한 기존 키: `comfy.statusOffline`, `mcp.locked`.

## B6 [Medium] provider sub 배지가 닫힌 trigger로 샌다 — ACCEPT

재확인: `Select.tsx:350-352`가 `triggerSub ?? selected?.sub`를 trigger에 렌더하고,
provider Select는 `triggerSub`를 넘기지 않는다. 013이 잘림을 증명한 좁은 표면이다.

결정: **`triggerSub`로 억제한다.** 닫힌 컨트롤은 "무엇을 골랐는가"를 말하는 자리이지
"왜 안 되는가"를 말하는 자리가 아니다. 상태는 목록에서 고르기 **전에** 필요한 정보다.

## B7 [Medium] capability 요약이 기존 sub 점유자와 충돌 — ACCEPT

comfy 이미지 행은 이미 `sub: entry.reason`, video 행은 `sub: videoCatalogShort`를 쓴다.
sub 슬롯은 하나인데 주장자가 둘이다. D5 밀도에서 모든 모델 행에 요약을 다는 것은
021이 lane에 대해 반대한 바로 그 소음이기도 하다.

결정: **capability 요약을 이번 범위에서 뺀다.** 상태/사유가 sub를 갖는다. capability는
`title`로만 노출한다 — 035가 확립한 패턴이고, 스캔을 방해하지 않는다. 이건 범위 축소가
아니라 dial 설정(VARIANCE 2, D5)과의 일관성 복원이다.

## B8 [Low] 활성화 불가능한 조건 2건 — ACCEPT

`locked` 배지: 현재 어떤 lane도 locked를 보고하지 않는다. 미지 lane 폴백: 서버 lane
집합이 닫힌 유니온이라 라벨 없는 id를 낼 수 없다.

수정: 두 조건은 **fetch 가로채기로 카탈로그를 주입**해 브라우저에서 관측하거나,
그게 과하면 활성화 표에서 내리고 관측 불가임을 명시한다. 관측하지 못한 것을 관측했다고
적지 않는다.

## 비차단 메모 (수용)

- `LaneDto`는 `{ ok, lanes }` 봉투를 벗겨야 한다 (api-comfy.ts:134와 동일).
- `ready`인데 `reason`이 있는 lane이 존재한다 (grok 미프로브, agy). 배지는 안 달되
  `title`에는 남긴다.
- `ProviderStatusSelect.tsx:21-30`이 core 9개를 하드코딩하고 comfy가 없다. 기존 부채이며
  이번에 악화되지는 않지만, wp2 이후 두 드롭다운이 lane 목록에 대해 서로 다른 말을 한다.
  SoT 동기화에 후속 항목으로 남긴다.

## 판정

8건 전부 구체적 수정으로 접혔다. 방향(카탈로그를 lane 존재·상태·video 지원의 원천으로)은
유지되고, 리뷰어도 그 점은 옳다고 확인했다. main 판정: **pass**.
