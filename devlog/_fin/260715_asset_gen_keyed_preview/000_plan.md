---
title: Asset Gen 키잉 전후 비교 UX
date: 2026-07-15
tags: [ima2-gen, asset-gen, keying, preview, ux]
status: complete
---

# 000 — 키잉 전후 비교 UX

## Loop spec

- **Class / archetype**: C2 ordinary product slice / spec-satisfaction.
- **Trigger**: 생성 결과 카드에는 크로마 원본만 보이고, 배경 제거 화면은 버튼을 눌러 들어간 패널 안의 단일 캔버스로만 보인다.
- **Goal**: 키잉 패널에서 원본과 제거 결과를 동시에 비교하고, 저장을 마치면 파생 이미지·비디오가 에셋 생성 결과 목록 맨 앞에 즉시 나타난다.
- **Non-goals**: 키잉 알고리즘·서버 API·DB 스키마·자동 저장 정책·assets 탭 관계 그룹 UI 변경 없음. 기존 미커밋 병렬 변경과 `skills/` 파일은 건드리지 않는다.
- **Verifier**: 신규 frontend contract test, root/UI typecheck와 UI production build, 실제 `#asset-gen` 키잉 대화상자 데스크톱·모바일 스크린샷, 저장 뒤 checkerboard 파생 카드 확인.
- **Stop condition**: 원본/제거 라벨과 두 프리뷰가 한 화면에서 구분되고, 이미지와 비디오의 저장 완료 이벤트가 파생 결과 카드를 추가하며, 정적·렌더 게이트가 모두 0으로 끝난다.
- **Memory artifact**: 이 유닛의 `010_keyed_preview.md`, PABCD ledger, QA 스크린샷 경로.
- **Terminal outcomes**: `DONE`=위 기준 통과, `NOOP`=런타임에서 이미 동일 UX가 확인됨, `BLOCKED`=로컬 서버/브라우저가 반복적으로 기동 불가, `UNSAFE`=기존 병렬 변경과 분리할 수 없는 충돌, `NEEDS_HUMAN`=비교 배치 선택이 사용자 의도와 충돌, `BUDGET_EXHAUSTED`=해당 없음(로컬 단일 사이클).
- **Escalation**: reviewer가 같은 계획 결함을 두 번 지적하면 메인이 계획을 회수해 수정한다. 추가 구현을 서브에이전트에 내리는 경우 P에서만 계획을 수정하며 `gpt-5.6-luna`, effort `low`만 사용한다.
- **HOTL bounds**: 로컬 repo 읽기/쓰기와 localhost 브라우저만 사용. 외부 API 생성·유료 호출·push 없음. 변경은 `010_keyed_preview.md`에 열거한 8개 수동 편집 파일, 생성 inventory, 이 devlog 유닛으로 제한. 한 PABCD 사이클 안에서 종료한다.

## Design Read

```yaml
name: ima2-asset-gen-keyed-preview
colors:
  primary: "existing var(--text)"
  accent: "existing var(--accent)"
  background: "existing checkerboard using var(--surface-2) / var(--bg)"
typography:
  heading: { fontFamily: "existing app stack", fontSize: "15px" }
  body: { fontFamily: "existing app stack", fontSize: "12px" }
iconography:
  system: "existing inline SVG layer"
  weight: "regular"
  domain: "no new icon"
```

반복 작업용 AI 도구의 결과 검수 대화상자다. 장식보다 원본과 제거 결과의 픽셀 차이가 먼저 읽혀야 하므로, 같은 크기의 2-up 비교판과 짧은 상태 라벨을 쓴다. 저장 뒤 파생 결과는 별도 카드로 남겨 작업 완료를 눈으로 확인하게 한다.

- **Do**: 원본과 결과를 같은 크기·같은 좌표계로 배치, 투명 결과 아래 checkerboard 유지, 저장 결과를 목록 맨 앞에 삽입, 모바일에서도 두 결과를 동시에 비교 가능하게 유지.
- **Don't**: 새 모달 단계·비교 토글·추가 설정·애니메이션·새 색상 토큰·중복 저장 버튼을 만들지 않는다.
- **DESIGN_VARIANCE**: 2
- **MOTION_INTENSITY**: 1
- **Product density**: D5
- **Reasoning**: 기존 고밀도 도구 화면의 형태를 유지하면서 검수 정보만 한 단계 더 선명하게 만든다.

## Existing-state evidence

- `ui/src/components/assetgen/KeyingPanel.tsx`: 키잉 결과 canvas 하나만 렌더하고 저장 성공 시 패널을 닫는다.
- `ui/src/components/assetgen/AssetGenWorkspace.tsx`: `assetGenItems`만 카드로 렌더하며 파생 여부 표현이 없다.
- `ui/src/store/storeAssetGenImpl.ts`: 생성 원본은 `assetGenItems` 앞에 추가하지만 파생 결과를 추가하는 액션은 없다.
- `ui/src/lib/api-assets.ts`: 이미지 저장 응답은 `{ filePath, asset }`, 비디오 `keying-done` 이벤트도 `filePath`를 제공하므로 API 변경 없이 재사용할 수 있다.
- `ui/src/styles/assetgen-workspace.css`: 키잉 canvas와 assets 투명 썸네일에 쓰는 checkerboard 표현이 이미 있다.

## Necessity gate

- **Do nothing**: 단일 keyed canvas는 제거 결과만 보여 주므로 원본과의 경계·피사체 손실 비교가 어렵다.
- **Delete**: 제거할 단계가 없다. 기존 버튼→조정→저장 흐름은 유지한다.
- **Configure**: CSS 설정만으로 저장 결과를 전역 목록에 추가할 수 없다.
- **Reuse**: 기존 `keyingTarget`, keyed canvas, `/api/assets/derived`, `keying-done`, `assetGenItems`를 재사용한다. 새 API나 새 전역 데이터 모델은 만들지 않는다.
