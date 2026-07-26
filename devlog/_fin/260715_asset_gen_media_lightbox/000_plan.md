---
title: Asset Gen 결과 미디어 라이트박스
date: 2026-07-15
tags: [ima2-gen, asset-gen, lightbox, uiux, accessibility]
status: complete
---

# 000 — 결과 미디어 라이트박스

## Loop spec

- **Class / archetype**: C2 ordinary product slice / spec-satisfaction repair.
- **Trigger**: AssetGenWorkspace 결과 카드는 이미지가 정적 썸네일이고 비디오는 작은 카드 안에서만 재생되어, 생성물의 경계·투명도·움직임을 크게 검수하기 어렵다.
- **Goal**: 카드의 미디어 영역을 누르면 이미지가 큰 fit-to-screen 뷰어에서 확대되고, 비디오는 큰 native-controls 플레이어에서 재생된다.
- **Non-goals**: 생성 provider/API, assets DB/schema, 전역 gallery, keying 알고리즘, 결과 저장·귀속·retry 계약, 새 의존성은 변경하지 않는다.
- **Verifier**: source-contract test, UI TypeScript/Vite build, localhost #assets 실제 클릭·Escape·focus·desktop/mobile screenshot, console 확인.
- **Stop condition**: 이미지/비디오 모달 경로, 닫기 3경로, focus trap/restore, scroll lock, zoom, responsive containment, i18n이 fresh proof로 통과한다.
- **Memory artifact**: 이 유닛의 001_parallel_uiux_feedback.md, 010_media_lightbox.md, 011_verification.md, goalplan ledger, QA screenshot.
- **Expected terminal outcomes**: DONE, NOOP, BLOCKED, UNSAFE, NEEDS_HUMAN, BUDGET_EXHAUSTED; 목표는 DONE.
- **Escalation**: 두 agent packet이 실패하면 메인이 해당 분석을 회수한다. 구현을 하위 agent에 넘기는 변경은 P amendment 없이는 하지 않는다.
- **HOTL bounds**: localhost와 현재 repo만 사용, 유료 API·새 dependency·remote write 없음, read-only luna-low agent 최대 3명, PABCD 1회, 약 45분.

## Design Read

    name: ima2-asset-gen-media-lightbox
    surface: repeated-use AI asset tool
    purpose: inspect generated image edges and video motion without leaving the result grid
    tone: quiet, dense, direct
    colors: existing app tokens only
    typography: existing CJK-safe app stack
    iconography: existing inline SVG vocabulary; no new icon package
    signature: media itself fills the stage; controls remain peripheral
    design_variance: 2
    motion_intensity: 1
    visual_density: 6
    product_density: D5

### Do

- 미디어 영역만 단일 명시적 trigger로 만든다.
- 이미지와 비디오에 같은 dialog shell을 사용하되, 이미지에는 fit/zoom, 비디오에는 native controls를 제공한다.
- keyboard, mobile tap, backdrop, close button을 동등한 경로로 취급한다.
- keyed 이미지 checkerboard와 기존 앱 token을 유지한다.

### Don't

- figure 전체를 클릭 영역으로 만들어 배경 제거·저장 다시 시도 버튼과 충돌시키지 않는다.
- GalleryModal의 검색·history·selection 책임을 끌어오지 않는다.
- 썸네일 위에 상시 여러 버튼을 쌓거나 cinematic motion을 추가하지 않는다.
- 카드 안의 video controls와 팝업 재생을 동시에 노출하지 않는다.

## Existing-state evidence

- ui/src/components/assetgen/AssetGenWorkspace.tsx:119-147 — 결과 grid가 image/video를 직접 렌더하며 별도 preview state나 popup이 없다.
- ui/src/components/assetgen/AssetGenWorkspace.tsx:131-144 — keying/retry는 같은 figure의 별도 버튼이므로 media-only trigger가 필요하다.
- ui/src/components/agent/useAgentDialogFocus.ts:1-44 — Escape, Tab focus trap, trigger focus restoration을 이미 제공한다.
- ui/src/components/agent/AgentImageSheet.tsx:18-37 — backdrop button과 semantic dialog를 분리하는 repo-local pattern이 있다.
- ui/src/components/GalleryModal.tsx:51-180 — gallery는 history/search/storage state를 소유해 단순 preview에 재사용하기에는 결합도가 높다.
- ui/src/styles/assetgen-workspace.css:23-31 — tile/keyed checkerboard/action style이 이미 있으므로 같은 CSS owner를 확장한다.
- ui/src/i18n/en.json:1464, ui/src/i18n/ko.json:1464 — asset-gen locale owner가 양쪽에 존재한다.

## Necessity gate

- **Do nothing rejected**: 카드 크기와 crop 때문에 결과 품질과 영상 움직임 검수가 제한된다.
- **Delete rejected**: 제거할 기존 preview route가 없다.
- **Configure rejected**: CSS만으로 modal lifecycle·focus·video playback을 제공할 수 없다.
- **Reuse accepted**: GenerateItem, useAgentDialogFocus, 앱 CSS token, 기존 locale namespace를 재사용한다.
- **New code justification**: global gallery와 책임이 다른 render-local preview이므로 작은 AssetMediaLightbox component만 신설한다.

## SoT sync

공개 API·일반 architecture는 바뀌지 않는다. 구현 단위의 SoT는 이 devlog이며 structure/와 docs/API.md는 수정하지 않는다. D에서 as-built와 증거를 기록하고 _fin/으로 이동한다.
