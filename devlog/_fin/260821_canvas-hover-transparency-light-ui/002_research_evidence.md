# 002 — WP0 연구 증거 스냅샷 (2026-08-21, HEAD 6752091+dirty)

## 하드코딩 hex 인벤토리 (030 경계: ui/src/index.css + ui/src/styles/*.css)

```
ui/src/index.css:22
ui/src/styles/canvas-annotations.css:16
ui/src/styles/sidebar.css:14
ui/src/styles/sprite-curator.css:13
ui/src/styles/right-panel.css:13
ui/src/styles/progress-composer.css:11
ui/src/styles/assetgen-workspace.css:7
ui/src/styles/themes.css:6
ui/src/styles/canvas-background-cleanup.css:5
ui/src/styles/prompt-library-extras.css:4
ui/src/styles/gallery-modal.css:4
ui/src/styles/assets-workspace.css:4
ui/src/styles/provider-controls.css:3
ui/src/styles/node-workspace.css:3
ui/src/styles/home-workspace.css:3
24 files, 145 hex refs
```

## 핵심 코드 좌표 (감사 5라운드에서 검증됨)

- 호버: useCanvasModePointerHandlers.ts:160-166 (tool 분기 전 삽입점),
  CanvasAnnotationLayer.tsx:11-57 (단일 canvas 렌더), CanvasModeStage.tsx:77-87
- 투명화: routes/edit.ts:104 (POST /api/edit), :331-394 (검증 없는 저장 경로),
  lib/imageBackgroundParam.ts:123-151 (verifyBufferAlpha — 의미론적 알파 검증)
- 히스토리 변환: ui/src/store/storeHelpers.ts mapHistoryItem
- 테마: ui/src/index.css:61 :root 토큰, ui/src/styles/themes.css (라이트 제거 이력),
  ui/index.html (color-scheme "dark" — FOWT 스크립트 삽입점)

## 감사 이력

리뷰어 01a02403(Carson) 5라운드: FAIL(6) → FAIL(2) → FAIL(1) → FAIL(2, 1건 기각) → PASS.
상세: 001_audit_round1_synthesis.md
