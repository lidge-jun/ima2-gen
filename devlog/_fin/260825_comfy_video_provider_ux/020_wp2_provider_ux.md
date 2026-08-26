---
created: 2026-08-25
tags: [ima2-gen, devlog, phase2, frontend, uiux, provider-selection, diff-level]
---

# 020 — wp2: 12-lane provider/model 선택 UX

## Design Read (ima2-uiux 2절)

Reading this as: 로컬 생성 스튜디오의 반복 작업용 도구 UI로, 이미 확립된 디자인
시스템 안에서 밀도와 판독성만 올리는 작업이다. 새 시각 언어를 도입하는 일이
아니다. 참조점은 무드보드가 아니라 LM Studio 모델 카탈로그 행과 ComfyUI-Manager의
상태 구분이다.

Do's: 기존 Select/SelectGroup 어휘 안에서 해결. 상태를 배지로 분리 표기.
Don'ts: 히어로/카드/그라디언트 도입, 드롭다운 전역 폭 변경(035에서 확인된 레이아웃
회귀 위험), 새 색상 팔레트.

### Dial Setting

    DESIGN_VARIANCE: 2
    MOTION_INTENSITY: 1
    Product density profile: D5 (dense repeated-work tool)
    Reasoning: 반복 생성 작업의 도구 표면이고 기존 디자인 시스템이 이미 지배적이다.
    시각적 변주가 아니라 상태 판독성이 병목이다.

UX-CONCEPT-GEN-01은 스킵한다. 사유: 기존 디자인 시스템이 표면을 지배하고(skip 조건
"an existing design system governs the surface"), 이 작업은 새 표현적 표면이 아니라
유틸리티 컨트롤 개선이다. 이 스킵 사유를 D에 기록한다.

## 문제 진단 (실측)

실행 중인 서버 /api/models lane 실측: 12개 — oauth, api, grok, grok-api, agy,
gemini-api, atlascloud, minimax, nai, comfy (core) + runway, higgsfield (MCP).

| 문제 | 위치 | 증상 |
|---|---|---|
| core lane 목록이 하드코딩 | GenProviderModelSelect.tsx:25-36 CORE_PROVIDER_OPTIONS | lane 추가 시 UI가 조용히 뒤처진다 |
| core lane 상태가 표시되지 않음 | 같은 파일 providerGroups 첫 그룹 | key-missing/disconnected lane이 ready와 동일하게 보인다 |
| video 지원 여부가 하드코딩 | :270 provider === grok 비교 | lane별 실제 video 카탈로그를 무시한다 |
| 상태 어휘가 뭉개짐 | 전반 | configured / reachable / model-available이 하나의 disabled로 붕괴 |

Tier-2 근거: OpenRouter(필터+정렬), LibreChat(collapsible provider 그룹), LM Studio
(행 단위 메타 배지), ComfyUI-Manager(로컬 카탈로그 vs 원격 도달성 분리). 공통 교훈은
설정됨 / 도달 가능 / 모델 사용 가능을 붕괴시키지 말 것이다.

## File change map

### 1. ui/src/lib/api-models.ts — NEW

/api/models 전체 응답(모든 lane + 상태 + 모델)을 읽는 클라이언트를 만든다. 현행
api-comfy.ts의 getComfyLaneModels는 comfy lane만 뽑아 쓰는데, 같은 엔드포인트를 lane
전체로 읽는 훅이 없어서 UI가 하드코딩으로 되돌아간다.

    export interface LaneDto {
      status: "ready" | "key-missing" | "disconnected" | "locked";
      reason?: string;
      models: { image: ModelEntry[]; video: ModelEntry[] };
    }
    export async function getModelCatalog(signal?: AbortSignal): Promise<Record<string, LaneDto>>;

### 2. ui/src/lib/useModelCatalog.ts — NEW

useMcpProviders와 같은 형태의 훅. 카탈로그를 한 번 읽고 lane 상태 변화 시 재조회한다.

### 3. ui/src/components/GenProviderModelSelect.tsx — MODIFY

- CORE_PROVIDER_OPTIONS는 표시 라벨 맵으로 격하한다 (lane id → 짧은 라벨). 존재
  여부의 원천은 카탈로그다. 라벨이 없는 새 lane은 displayProviderId로 대체한다 —
  새 lane이 UI에서 사라지는 일이 없어진다.
- provider 그룹 항목에 sub 배지를 붙인다: ready는 무표기, 그 외는 상태 어휘
  (key missing / offline / locked)를 짧게. 긴 사유는 title로 (035에서 확립한 패턴).
- providerSupportsVideo를 카탈로그 유도로 바꾼다: catalog[provider] video 길이 > 0.
  wp1이 comfy video를 실행 가능하게 만든 뒤 이 값이 자동으로 참이 된다.
- 모델 행에 capability 요약을 sub로 노출한다 (inputRoles에 image_references가 있으면
  refs, video면 duration/resolution 파라미터 요약). bin/commands/models.ts의 capText와
  같은 규칙을 쓰되 UI용으로 짧게 — wp3에서 이 규칙을 공유 모듈로 승격한다.

### 4. ui/src/i18n — MODIFY

새 상태 어휘 키를 ko/en/zh/ja에 추가한다: lane.keyMissing, lane.offline, lane.locked.
기존 comfy.statusOffline, mcp.locked와 중복되면 재사용한다.

### 5. tests/ — MODIFY

- tests/models-endpoint-contract.test.ts: lane 상태 어휘가 4종으로 유지되는지.
- UI는 렌더 관측이 1차 증거다 (아래 참조).

## Activation scenario (C-ACTIVATION-GROUNDING-01)

| 조건부 경로 | 트리거 | 증거 |
|---|---|---|
| key-missing 배지 | 키 없는 lane 선택 | 배지가 보이는 스크린샷 |
| offline 배지 | comfy origin 18188이 죽은 상태 | 배지가 보이는 스크린샷 |
| 카탈로그 유도 video 그룹 | comfy 선택 시 video 그룹 출현 | 그룹이 보이는 스크린샷 |
| 미지 lane 폴백 라벨 | 라벨 맵에 없는 lane id를 카탈로그가 반환 | 폴백 라벨 렌더 관측 |

## 렌더 그라운딩 (C-RENDER-GROUNDING-01, STRICT)

실제 브라우저로 http://localhost:3333 을 열고 데스크톱 1280x720과 모바일 뷰포트에서
provider/model 드롭다운을 연다. 스크린샷을 찍고 읽어들여 텍스트 잘림·겹침·배지
판독성을 확인한 뒤 evidence/에 보존한다. 035에서 드러난 300px 포털 폭 안에서의 라벨
잘림이 이 표면의 알려진 함정이다.

## Accept criteria

1. 12개 lane 전부가 상태 배지와 함께 렌더된다 (c-4).
2. lane 목록이 카탈로그 유도이고, 라벨 맵에 없는 lane도 렌더된다 (c-4).
3. video 그룹 노출이 카탈로그 유도다 (하드코딩 provider 비교 제거) (c-4).
4. 데스크톱/모바일 스크린샷에 텍스트 잘림·겹침이 없다.
5. cd ui && npm run build green.

## SoT sync target

structure/04-frontend-architecture.md의 selector 절.
