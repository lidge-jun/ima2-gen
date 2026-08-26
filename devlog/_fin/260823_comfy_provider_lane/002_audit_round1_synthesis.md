---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, audit]
---

# 002 — A-phase 감사 라운드 1: 종합과 처분

독립 리뷰어(xai/grok-4.6, 읽기 전용)가 8개 문서를 코드에 대고 감사했다.
**VERDICT: FAIL**, High 7건 + Medium 4건 + Low 2건.

리뷰어가 먼저 현재 트리에서 게이트를 전부 돌렸다: typecheck 0,
typecheck:tests 0, npm test 0 (2432 pass / 2 skip), test:inventory 0,
generate-provider-types --check 0, refresh-structure-line-counts --check 0,
ui build 0. 즉 baseline이 깨끗하다.

## 처분 요약

| # | 심각도 | 지적 | 처분 |
|---|---|---|---|
| 1 | High | 010 AC2가 서버 typecheck로 UI never를 증명한다고 주장 | **수용** |
| 2 | High | 000의 "8-레인 하드코딩 4곳"이 불완전 | **수용** |
| 3 | High | doctor-providers가 local-http를 파일 경로로 오인 | **수용** |
| 4 | High | adapter-v1 계약의 validateAuth 2-상태가 comfy에서 깨짐 | **수용** |
| 5 | High | 030의 `allLive` 미정의 | **수용** |
| 6 | High | comfy가 GPT 모델 목록으로 흘러감 | **수용** |
| 7 | High | 050이 정규화 전 origin을 프로브 | **수용** |
| 8 | Med | 000 예시의 graph가 문자열, 010은 객체 | **수용** |
| 9 | Med | 020 에러표에 BIND_INVALID 없음 | **수용** |
| 10 | Med | multimode/node/agent 파이프라인 미포함 | **수용, 범위 명시로** |
| 11 | Med | /view subfolder·filename 미검증 | **수용** |
| 12 | Low | 000 verifier 표에 line-count 게이트 누락 | **수용** |
| 13 | Low | N-instance 2차 근거 라벨이 001에만 있음 | **수용** |

**반박 0건.** 13건 전부 코드로 재확인했고 전부 타당했다.

## 근본 원인 분석 (REVIEW-SYNTHESIS-01)

13건이 흩어진 실수가 아니라 **세 갈래**에서 나왔다.

### RC-1: "레지스트리에 넣으면 파생된다"는 과잉 신뢰 (#2,#3,#4,#6)

레지스트리가 id·모델·한도를 파생시키는 건 맞지만, **행동**은 파생되지
않는다. 파생 계층을 통과한 뒤 각자 if-체인으로 provider를 다시 분기하는
지점이 여럿이다:

- `bin/lib/doctor-providers.ts:87` — switch의 **default**가
  `inspectLocalCli`다. 새 credential kind는 조용히 "파일이 없다"가 된다.
- `ui/src/lib/imageModels.ts:95` — **default**가 `OPENAI_IMAGE_MODEL_OPTIONS`.
  comfy를 고르면 GPT 모델이 뜬다.
- `ui/src/store/storeSettingsImpl.ts:383` — 긴 부정 조건이라 comfy가
  else로 떨어져 `gpt-5.6-luna`를 유지한다.
- `tests/provider-adapter-v1-contract.test.ts:85` — `listProviderAdapters`를
  **순회**하며 키 있음/없음 2상태를 요구한다. 어댑터를 등록하는 순간 걸린다.

공통점: **default 분기와 전수 순회**. 000이 "4곳"만 센 건 `=== "minimax"`
같은 명시 비교만 grep했기 때문이다. PLAN-FIELD-CHAIN-01이 "비교가 아닌
소비(destructuring, default 분기, 제네릭 술어)도 보라"고 한 그대로다.

### RC-2: 게이트가 무엇을 보는지에 대한 착각 (#1,#12)

`npm run typecheck`의 tsconfig include는 server/config/lib/routes/bin/types다.
**`ui`가 없다.** UI 타입 오류를 잡는 건 `cd ui && npm run build`뿐이다.
010 AC2는 관찰하지 않는 명령으로 증명을 주장했다 — PLAN-VERIFIER-REAL-01
위반이다.

### RC-3: 문서 간 어휘 드리프트 (#5,#8,#9,#13)

000을 먼저 쓰고 010~060을 이어 쓰면서 스키마와 에러 어휘가 갈렸다.
`allLive`는 아예 정의 없이 쓰였다 — 복붙 가능한 PRD여야 한다는
DIFFLEVEL-ROADMAP-01 기준에서 실패다.

## 개별 처분

### #1 — 010 AC2 정정

AC2를 `cd ui && npx tsc -p tsconfig.app.json --noEmit`으로 바꾸고,
서버 typecheck가 UI를 보지 않는다는 사실을 명시한다.

### #2 — 8-레인 소비자 목록 확장

000에 실측 목록을 다시 싣는다. 테스트 6곳 + 프로덕션 4곳.

### #3 — doctor에 local-http 분기

`inspectLocalHttp` 신설. **URL에 `existsSync`를 부르지 않는다.**
워크플로 등록 수와 origin 설정 여부를 보고한다.

### #4 — adapter 계약의 정직한 2-상태

comfy의 "인증"은 **워크플로 등록 여부**다. 테스트가 요구하는 2상태를
키가 아니라 스토어 상태로 만족시킨다. `EXPECTED_AUTH_REASON`에 comfy를
추가하고, `listModels` 어서션만 runtime 레인에서 면제한다.

면제는 **명시적 가드**로 쓴다 — 빈 배열끼리 우연히 같아 통과하면 테스트가
아무것도 지키지 않는다.

### #5 — allLive 정의

`const allLive = [...health.values()].every((h) => h.ok);`

### #6 — UI 모델 목록 분기

`getImageModelOptionsForProvider`와 `setProviderImpl` 둘 다 comfy 분기를
갖는다. 050에 필수 편집으로 명시한다.

### #7 — 프로브 전 정규화

`normalizeComfyOrigin`을 거치지 않은 문자열로 fetch하지 않는다.

### #8 — graph 스키마 통일

000 예시를 010의 인라인 객체로 맞춘다. 그래프를 별도 파일로 두면 레코드
원자성이 깨지고 손상 복구가 어려워진다.

### #9 — BIND_INVALID를 어댑터 어휘에 추가

### #10 — multimode/node/agent 범위 명시

**이번 유닛에서 지원하지 않는다.** 대신 조용히 실패하지 않게 한다:
해당 표면에서 comfy가 선택되면 명확한 미지원 에러를 낸다. 070으로
work-phase를 추가한다.

### #11 — /view 파라미터 경계

`type`을 output/input/temp 화이트리스트로 제한, `subfolder`에서 `..`와
절대경로 거부, `filename`은 basename 강제, prompt_id는
`encodeURIComponent`.

### #12/#13 — 표 정합과 근거 등급 라벨

## 리뷰어와 갈린 판단 하나

리뷰어는 #10을 "OUT-of-scope 명시 또는 분기 복사" 둘 중 하나로 봤다.
**전자를 택하되 한 가지를 더한다**: 미지원을 문서로만 적으면 사용자는
런타임에 GPT로 조용히 대체되는 걸 본다(RC-1의 default 분기 때문). 따라서
**명시적 거부 에러**까지가 이번 범위다. 이건 리뷰어 제안보다 넓다.

## 다음

010/020/030/050/000을 수정하고 070을 추가한 뒤 **같은 리뷰어에게** 재감사를
맡긴다(AUDIT-LOOP-01: FAIL은 A를 벗어나지 못한다).
