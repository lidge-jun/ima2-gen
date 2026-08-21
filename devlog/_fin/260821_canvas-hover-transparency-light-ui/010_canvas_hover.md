# 010 — 캔버스 모드 마우스 호버 피드백 (wp1)

## 목표

캔버스 모드에서 도구와 무관하게 마우스 위치 피드백을 제공한다:
1. cleanup 브러시 커서 프리뷰를 **모든 cleanup 도구 상태**(seed picking 포함)로 확장
2. 주석(annotation) 위 호버 시 하이라이트(테두리 강조 + cursor 변화)
3. 도구별 CSS cursor 계약: select=default, brush=none(SVG 프리뷰), seed=crosshair, pan(space)=grab

## 아키텍처 제약 (감사 반영)

`CanvasAnnotationLayer`는 단일 `<canvas>` 요소에 2D 컨텍스트로 전부 그린다
(annotationRenderer.ts). 주석별 DOM 노드가 없으므로 **CSS 클래스 방식은 불가** —
호버 하이라이트는 캔버스 렌더러 안에서 그린다. 또한 `handleAnnotationPointerMove`는
select(드래그 중 아님)/memo/eraser에서 early-return하므로, hover hit-test는
**tool 분기 이전**(viewport pan 처리 직후, point 계산 직후)에 수행해야 한다.

## 파일 계획 (수정판)

- MODIFY `ui/src/components/canvas-mode/useCanvasModePointerHandlers.ts`
  - `handleAnnotationPointerMove`: `point` 계산 직후 tool 분기 전에
    `const hovered = hitTestAnnotation(annotations, point)` 후
    `setHoveredAnnotationId(hovered?.id ?? null)` 호출 (드래그/팬 중에는 skip)
  - 신규 인자 `setHoveredAnnotationId`; pointer leave/up에서 null 리셋
- MODIFY `ui/src/components/canvas-mode/CanvasAnnotationLayer.tsx`
  - prop `hoveredId?: CanvasObjectKey | null` 추가; useEffect deps에 포함,
    렌더 루프에서 `hoveredId`의 bounds를 `renderSelectionOutline` 계열의
    호버 변형(옅은 스트로크)으로 그림 — NEW 헬퍼 `renderHoverOutline`을
    `ui/src/lib/canvas/annotationRenderer.ts`에 추가
- MODIFY `ui/src/components/canvas-mode/CanvasModeStage.tsx` — hoveredId prop 통과
- MODIFY `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx`
  - `useState<CanvasObjectKey | null>` 배선; annotation frame에 도구별
    `canvas-annotation-frame--tool-<tool>` 클래스
- MODIFY `ui/src/styles/canvas-mode.css` — 도구별 cursor 계약: select 기본,
  hover 시 move는 프레임 클래스+state로, brush 활성 `cursor: none`, seed=crosshair,
  space pan=grab

## 검증

- chrome으로 캔버스 열고 호버 → 스크린샷 2장(주석 하이라이트, 브러시 프리뷰)
- typecheck + ui build
