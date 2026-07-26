---
title: "050 — WP5: Canvas SVG/PPTX export (#27 #28)"
lane: "260726_zero-backlog-frontend-qa"
wp: 5
created: 2026-07-26
depends_on: [WP2]
issues: [27, 28]
supersedes: ["_future/260430_issue27-canvas-svg-export", "_future/260430_issue28-canvas-pptx-export"]
criteria: [C5]
---

# WP5 — Canvas SVG/PPTX export (#27 #28)

두 이슈를 한 사이클로 묶는다. 같은 툴바 표면, 같은 좌표 변환, 같은 export
디스패처를 공유하기 때문이다. 따로 하면 export 버튼을 두 번 재설계하게 된다.

`_future/260430_issue27-*`와 `_future/260430_issue28-*`의 implementation lock을
승계한다. 그 문서들의 build policy와 out-of-scope lock은 여기서 유효하다.

## 현재 export 구조

`ui/src/lib/canvas/exportRenderer.ts` 전체가 PNG 전용이다.

```ts
export async function exportCanvasImage(input: MergeCanvasInput): Promise<Blob> {
  const merged = await renderMergedCanvasImage(input);
  return merged.blob;
}
export function makeCanvasExportFilename(options: { matte?: boolean } = {}, date = new Date()): string {
  // ... `canvas-export-${stamp}${suffix}.png`
}
export function downloadCanvasBlob(blob: Blob, filename: string): void { /* generic */ }
```

`downloadCanvasBlob`은 이미 포맷 중립이다. 확장자만 파라미터화하면 재사용된다.

주석 데이터 모델은 `ui/src/lib/canvas/annotationRenderer.ts`에 있고, 좌표 변환
`toCanvasPoint(point, size)`는 **module-private**이다(`ui/src/lib/canvas/annotationRenderer.ts:21-23`). SVG 생성기가 같은
변환을 써야 하므로 export한다. 복제하면 두 포맷이 서서히 어긋난다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/lib/canvas/annotationRenderer.ts` | MODIFY | `toCanvasPoint` export |
| `ui/src/lib/canvas/svgExport.ts` | NEW | SVG 직렬화 (~200줄) |
| `ui/src/lib/canvas/pptxExport.ts` | NEW | PPTX 생성 (~150줄) |
| `ui/src/lib/canvas/exportRenderer.ts` | MODIFY | 포맷 디스패처 + 확장자 |
| `ui/src/components/canvas-mode/CanvasToolbar.tsx` | MODIFY | 포맷 메뉴 |
| `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx` | MODIFY | 핸들러 배선 |
| `ui/package.json` + lock | MODIFY | `pptxgenjs` |
| `ui/src/i18n/{ko,en}.json` | MODIFY | 포맷 라벨 |
| `tests/canvas-svg-export-contract.test.ts` | NEW | #27 수용 테스트 |
| `tests/canvas-pptx-export-contract.test.ts` | NEW | #28 수용 테스트 |

## 050-1. 좌표 변환 공유

```ts
-function toCanvasPoint(point: NormalizedPoint, size: ImageSize): { x: number; y: number } {
+export function toCanvasPoint(point: NormalizedPoint, size: ImageSize): { x: number; y: number } {
   return { x: point.x * size.width, y: point.y * size.height };
 }
```

화살촉 계산(`drawArrowHead`, `ui/src/lib/canvas/annotationRenderer.ts:48-52`)도 SVG가 필요로 한다. 캔버스 컨텍스트에
직접 그리는 함수이므로 **기하 계산만 분리**한다:

```ts
export function arrowHeadPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeWidth: number,
): [{ x: number; y: number }, { x: number; y: number }] { /* 각도 계산만 */ }
```

`drawArrowHead`가 이 함수를 쓰도록 리팩터한다. PNG와 SVG의 화살촉이 픽셀 단위로
일치해야 하고, 그건 계산이 하나일 때만 보장된다.

## 050-2. `svgExport.ts` (NEW)

```ts
export type SvgExportInput = {
  imageDataUrl: string;
  imageSize: ImageSize;
  annotations: AnnotationSnapshot;
};

export function buildCanvasSvg(input: SvgExportInput): string;
```

직렬화 규칙:

| 주석 | SVG |
|---|---|
| pen/freehand | `<path d="M .. L ..">` + `stroke`, `stroke-width`, `stroke-linecap="round"` |
| arrow | 위와 동일 + 화살촉 `<polygon>` |
| box | `<rect x y width height fill="none">` |
| memo | `<g>` 안에 `<rect>` 배경 + `<text>` |

viewBox는 소스 이미지 natural 크기 그대로. 소스 raster는 `<image href="data:...">`로
임베드한다. **로컬 파일 경로를 절대 넣지 않는다** — `_future` 문서의 lock이자
정보 유출 문제다.

메모 텍스트는 XML 이스케이프가 필수다(`&`, `<`, `>`, `"`). 한국어 메모는 대부분
안전하지만 프롬프트에서 복사한 텍스트에 `<`가 들어갈 수 있다. `&` 먼저 치환하지
않으면 이중 이스케이프가 생기므로 순서를 고정한다.

텍스트 줄바꿈: SVG `<text>`는 자동 줄바꿈이 없다. 메모는 `<tspan dy>`로 수동 분할한다.
한국어는 단어 경계가 없으므로 문자 수 기준으로 자른다.

상태 불변: 이 함수는 순수 함수다. 캔버스 상태를 읽기만 하고 서버 파일도 쓰지 않으며
canvas version도 만들지 않는다.

## 050-3. `pptxExport.ts` (NEW)

```ts
export async function buildCanvasPptx(input: {
  mergedPng: Blob;
  imageSize: ImageSize;
  memos: CanvasMemo[];
}): Promise<Blob>;
```

MVP 결정 — **주석을 PPTX 네이티브 도형으로 변환하지 않는다.** 합성 PNG 한 장을
슬라이드에 얹고, 메모만 편집 가능한 텍스트 박스로 올린다. 이유:

- freehand path를 PowerPoint 도형으로 변환하면 곡선 근사 오차가 눈에 띈다.
- 이슈 본문도 "복잡한 freehand는 투명 오버레이 이미지 폴백 허용"이라 명시한다.
- 메모 텍스트만 편집 가능해도 실사용 가치의 대부분이 나온다.

16:9 슬라이드에 이미지를 aspect-ratio 보존해 letterbox 배치한다. 세로 이미지에서
양옆이 비는 것은 정상이며, 잘라내지 않는다.

`pptxgenjs`는 번들 크기가 작지 않다(~1MB). **동적 import로 지연 로딩**한다:

```ts
const { default: PptxGenJS } = await import("pptxgenjs");
```

PPTX를 한 번도 안 쓰는 사용자가 초기 로드에서 비용을 내면 안 된다. WP2의 성능
가드레일과 같은 원칙이다.

## 050-4. 툴바 포맷 메뉴

현재 `ui/src/components/canvas-mode/CanvasToolbar.tsx:334-347`은 단일 export 버튼이다. 세 포맷이 되면 메뉴가 필요하다.

접근성 요구(WP1 계약 승계):

- 메뉴는 `role="menu"` + `role="menuitem"`, 화살표/Escape 키 경로 완비.
- 트리거는 `aria-haspopup="menu"` + `aria-expanded`.
- 열릴 때 첫 항목으로 포커스, 닫힐 때 트리거로 복원.
- 툴바가 이미 조밀하므로 히트 박스는 WP2의 44px 규칙을 따른다.

진행/에러 상태: PPTX 생성은 동적 import + 렌더로 수백 ms가 걸린다. 버튼에
`aria-busy`와 시각 스피너를 둔다(WP2의 `data-motion-essential` 대상). 실패 시
토스트로 알린다 — 조용히 실패하면 사용자는 파일을 계속 기다린다.

## 계약 테스트

`tests/canvas-svg-export-contract.test.ts` (#27 수용 기준):

```ts
test("svg export embeds source image and vectorizes annotations", () => {
  const svg = buildCanvasSvg(fixture);
  assert.match(svg, /viewBox="0 0 1024 768"/);
  assert.match(svg, /<image[^>]+href="data:image\/png;base64,/);
  assert.match(svg, /<path [^>]*stroke=/);
  assert.match(svg, /<rect /);
  assert.doesNotMatch(svg, /\/Users\/|file:\/\//, "no local paths may leak");
});

test("memo text is xml-escaped", () => {
  const svg = buildCanvasSvg({ ...fixture, memos: [{ text: 'a & b < c "d"' }] });
  assert.match(svg, /a &amp; b &lt; c/);
  assert.doesNotMatch(svg, /&amp;amp;/, "no double escaping");
});

test("export does not mutate input state", () => {
  const input = structuredClone(fixture);
  buildCanvasSvg(input);
  assert.deepEqual(input, fixture);
});
```

`tests/canvas-pptx-export-contract.test.ts` (#28 수용 기준): 의존성 선언, 툴바 액션
존재, 유틸 import, save-first 요구 부재, 메모 payload 경로를 검증한다.

## Accept criteria (C5)

1. 툴바에서 PNG / SVG / PPTX를 선택할 수 있다.
2. SVG가 소스 이미지 + 벡터 주석을 담고, viewBox가 natural 크기다.
3. SVG 주석 위치가 PNG export와 시각적으로 일치한다 — **두 파일을 나란히 렌더해 비교**.
4. PPTX가 실제 뷰어에서 열린다 — LibreOffice로 변환 확인.
5. 로컬 경로가 산출물에 새지 않는다.
6. 메뉴가 키보드만으로 조작된다.
7. **렌더 근거(STRICT)**: 생성된 SVG를 브라우저로 렌더해 스크린샷을 관찰하고 devlog에 저장한다.
   파일이 well-formed인 것과 올바르게 보이는 것은 다른 문제다.

## 범위 경계

IN: SVG/PPTX 생성기, 포맷 디스패처, 툴바 메뉴, 좌표 유틸 export, 두 계약 테스트.
OUT: 래스터 트레이싱(Potrace), SVG/PPTX 역import, 다중 이미지 덱, 서버 export 라우트,
Fabric 등 캔버스 프레임워크 마이그레이션.
