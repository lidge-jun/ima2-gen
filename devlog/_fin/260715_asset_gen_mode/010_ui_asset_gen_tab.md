---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, ui, wp2]
status: diff-level 확정 (WP2)
---

# 010 — WP2: asset-gen UIMode + NavRail 탭 + 생성 폼 골격

## Design Read (cxc-dev-uiux-design §2)

```yaml
---
name: ima2-asset-gen
colors: 기존 앱 토큰 그대로 (다크 도구 UI, 신규 팔레트 금지)
typography: 기존 앱 스택 그대로
iconography:
  system: "기존 NavRail inline SVG 관례 (18px stroke 1.8)"  # 신규 라이브러리 도입 금지 — 앱 자체 아이콘 시스템이 이미 존재
  weight: "stroke"
  domain: "해당 없음 (WP2)"
---
```

Reading: 반복 사용 도구 UI (생성 워크플로우), 기존 ima2 다크 테마의 연장.
DESIGN_VARIANCE 3 · MOTION_INTENSITY 2 · 밀도 D4-D5 (SaaS 도구).
Do: 기존 classic/assets 모드의 시각 언어·컴포넌트(OptionGroup, InFlightList) 재사용.
Don't: 히어로/마케팅 구성, 신규 컬러 팔레트, 이모지 아이콘 (FE-AI-TELL-01).

## 전제 (코드 확인 2026-07-15)

- `UIMode` union: `ui/src/types.ts:1`
- NavRail 해시 매핑: `ui/src/components/NavRail.tsx:10-24` (HASH_TO_MODE/MODE_TO_HASH), NAV_ITEMS `:108-112`
- App 모드 정규화 체인: `ui/src/App.tsx:68-75`, 워크스페이스 분기 `:142-158`
- Sidebar 정규화+분기: `ui/src/components/Sidebar.tsx:17-55` (assets 분기 패턴 따름)
- localStorage 복원: `ui/src/store/storePersistence.ts:115-125` `loadUIMode()`
- classic 전용 생성 가드: `ui/src/store/storeGenImpl.ts:46-49` (`if (s.uiMode !== "classic") return;`) — asset-gen은 별도 생성 액션 신설 (재사용 불가, ASSUMPTION 13)
- 모바일 가드 3종: `MobileAppBar.tsx:11-20`, `MobileComposeSheet.tsx:25-43`, `MobileSettingsToggle.tsx:34-38`

## 파일 변경 맵

### MODIFY

| 파일 | 변경 |
|---|---|
| `ui/src/types.ts:1` | `UIMode`에 `"asset-gen"` 추가: `... "assets" \| "asset-gen" \| "home"` |
| `ui/src/components/NavRail.tsx` | `HASH_TO_MODE`에 `"#asset-gen": "asset-gen"`, `MODE_TO_HASH`에 `"asset-gen": "#asset-gen"`, NAV_ITEMS의 assets 항목 뒤에 `{ id: "asset-gen", mode: "asset-gen", icon: IconAssetGen, labelKey: "nav.assetGen", enabled: true }`, `IconAssetGen` inline SVG 신규 (18px stroke 1.8 — 사각형+스파클 계열, 기존 IconCreate/IconAssets와 동일 문법) |
| `ui/src/App.tsx` | 정규화 체인에 `uiModeRaw === "asset-gen" ? "asset-gen" :` 추가 (`:73` assets 줄 뒤), `isAssetGenMode` 파생, `showHistoryStrip`에 `!isAssetGenMode` 추가, 워크스페이스 분기에 `uiMode === "asset-gen" ? <LazyAssetGenWorkspace />` (`:150` assets 분기 뒤), RightPanel 제외 체인에 asset-gen 추가 (`:158`) |
| `ui/src/components/Sidebar.tsx` | 정규화 체인에 asset-gen 추가, 분기에서 asset-gen은 assets와 동일하게 자체 워크스페이스가 폼을 소유하므로 `<SidebarChrome />`만 렌더 (assets 분기와 같은 형태) |
| `ui/src/store/storePersistence.ts` `loadUIMode()` | `if (raw === "asset-gen") return raw;` 추가 |
| `ui/src/components/MobileAppBar.tsx` / `MobileComposeSheet.tsx` / `MobileSettingsToggle.tsx` | 기존 assets 가드와 동일 위치에 asset-gen 분기 추가 (모바일 진입점 유지, compose sheet는 asset-gen에서 비활성) |
| `ui/src/store/storeTypes.ts` | `AssetGenState` 타입 추가 (아래), `AppState`에 슬라이스 병합 |
| `ui/src/store/useAppStore.ts` | assetGen 슬라이스 wiring (`storeAssetsImpl` 패턴) |
| `ui/src/i18n/*.ts` | `nav.assetGen` = "에셋 생성"/"Asset Gen", 폼 라벨 키 (`assetGen.prompt`, `assetGen.background.*`, `assetGen.generate` 등) |

### NEW

| 파일 | 내용 | 규모 |
|---|---|---|
| `ui/src/components/assetgen/AssetGenWorkspace.tsx` | lazy 워크스페이스: 좌측 폼(프롬프트 textarea + BackgroundPresetPicker + AssetGenModelPicker + 이미지/비디오 토글(비디오는 WP7까지 disabled+안내) + 생성 버튼) + 우측 결과 그리드(inflight/완료, 기존 SSE 채널 구독) | ~220줄 |
| `ui/src/components/assetgen/BackgroundPresetPicker.tsx` | 3버튼 세그먼트 (그린 기본/하양/블랙) — `OptionGroup.tsx` 패턴, 각 버튼에 색상 스와치 + 라벨, `aria-pressed` | ~60줄 |
| `ui/src/components/assetgen/AssetGenModelPicker.tsx` | provider 서브셋 셀렉트: `oauth`/`api`(GPT), `grok`/`grok-api`만 노출 — 전역 provider와 독립적인 assetGen 로컬 상태 (ASSUMPTION 1) | ~70줄 |
| `ui/src/store/storeAssetGenImpl.ts` | 슬라이스 구현: 상태 + `generateAssetImpl` (아래 계약) | ~130줄 |

## AssetGenState 계약 (storeTypes.ts)

```ts
export type AssetGenBackgroundPreset = "chroma-green" | "white" | "black";
export type AssetGenState = {
  assetGenPrompt: string;
  assetGenBackground: AssetGenBackgroundPreset; // 기본 "chroma-green"
  assetGenProvider: Provider;                   // oauth|api|grok|grok-api만 유효
  assetGenKind: "image" | "video";             // WP2에서 video는 disabled
  assetGenItems: GenerateItem[];               // 이 모드에서 생성된 결과 (세션 로컬)
  // actions
  setAssetGenPrompt(v: string): void;
  setAssetGenBackground(v: AssetGenBackgroundPreset): void;
  setAssetGenProvider(v: Provider): void;
  generateAssetGen(): Promise<void>;
};
```

## 생성 경로 (WP2 시점)

`generateAssetImpl`은 classic 가드를 우회하는 **독립 경로**: 기존 `/api/generate`
async 계약을 그대로 사용하되 body에 `backgroundPreset` 필드를 이미 포함해서 보낸다.
WP4 전 무해성의 정확한 근거(감사 교정): `routes/generate.ts:8-10`은 presetIds만
정규화해 위임하고, `lib/generatePipeline.ts:60-75`가 알려진 필드만 구조분해하므로
`backgroundPreset`은 **읽히지 않고 버려진다** — 관용이 아니라 미참조. WP2 C에서
"preset 포함 요청이 기존 요청과 동일 프롬프트를 생성"하는 회귀를 1건 캡처해
이 경계를 증거로 고정한다 (WP4가 켜지면 같은 body가 자동으로 유효해짐).
inflight 추적은 기존 `kind === "classic"` 경로 대신 신규 `kind: "asset-gen"` 잡
종류를 `storeHelpers.ts:75,77,148`의 kind 유니언에 추가해 SSE 채널로 갱신한다.

## 스코프 경계

IN: 위 파일 맵 전부. OUT: 프로젝트 드롭다운(011), 서버 프리셋 반영(020), 키잉(021+),
비디오 활성화(030). 폼의 비디오 토글은 렌더되지만 disabled + "WP7에서 활성화" 툴팁.

## Accept criteria (WP2 C 게이트)

1. `#asset-gen` 해시 직행 + NavRail 클릭 + 새로고침 복원(localStorage) 모두 asset-gen 모드 진입 (렌더 스크린샷).
2. 생성 폼에서 GPT provider로 실제 이미지 1건 생성 완주 — inflight → 완료가 SSE로 갱신 (활성화 증거: 네트워크에 `backgroundPreset` 포함 body 캡처).
3. 프리셋 기본값 chroma-green 선택 상태 렌더, 3버튼 키보드 조작 가능 (`aria-pressed`).
4. 모바일 뷰포트(390px)에서 진입점 존재 + 레이아웃 깨짐 없음 (스크린샷 736/390).
5. `npm run typecheck` + `cd ui && npm run build` + 기존 `npm test` 회귀 통과.
6. classic/assets 등 기존 모드 동작 무변화 (assets 탭 스모크).

## 구현 편차 기록 (WP2 B, 2026-07-15)

- inflight는 신규 kind 대신 기존 `PersistedInFlight` 목록을 그대로 사용 (storeHelpers
  kind 유니언 무변경 — 더 작은 diff로 동일 효과. InFlightList가 자동 표시).
- 모델 피커는 provider 값 `oauth`(GPT)/`grok`(Grok) 2택 (grok-api는 초기값이 grok-api면 유지).
- **known-issue (기존 앱 레벨)**: ≤800px에서 우측 ~52px 가로 오버플로우 — 기존 assets
  모드도 동일 재현 (스크린샷 /tmp/assets-mobile.png). asset-gen은 assets와 동일 패턴
  준수(패리티). 전역 `.app` 모바일 그리드 수정은 별도 후속 work-phase 후보.
- Card News 소스 계약 테스트(`tests/card-news-frontend-contract.test.js:38`)가 RightPanel
  제외 체인을 고정하고 있어 asset-gen 추가에 맞춰 계약 갱신.
