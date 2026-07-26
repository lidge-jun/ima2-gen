import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCanvasSvg } from "../ui/src/lib/canvas/svgExport";
import type { AnnotationSnapshot } from "../ui/src/types/canvas";

// Issue #27 acceptance, per devlog/_plan/_future/260430_issue27-canvas-svg-export.

const IMAGE = "data:image/png;base64,iVBORw0KGgo=";
const SIZE = { width: 1024, height: 768 };

function snapshot(overrides: Partial<AnnotationSnapshot> = {}): AnnotationSnapshot {
  return {
    paths: [
      { id: "p1", tool: "pen", color: "#64c8ff", strokeWidth: 3,
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 }] },
      { id: "p2", tool: "arrow", color: "#ff6262", strokeWidth: 2,
        points: [{ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.3 }] },
    ],
    boxes: [{ id: "b1", x: 0.25, y: 0.25, width: 0.3, height: 0.2, color: "#ffd166", strokeWidth: 2 }],
    memos: [{ id: "m1", x: 0.5, y: 0.1, text: "check the lighting", color: "#fff6b3" }],
    ...overrides,
  };
}

test("viewport matches the source image natural size", () => {
  const svg = buildCanvasSvg({ imageDataUrl: IMAGE, imageSize: SIZE, annotations: snapshot() });
  assert.match(svg, /viewBox="0 0 1024 768"/);
  assert.match(svg, /width="1024"/);
  assert.match(svg, /height="768"/);
});

test("the source raster is embedded, never referenced by local path", () => {
  const svg = buildCanvasSvg({ imageDataUrl: IMAGE, imageSize: SIZE, annotations: snapshot() });
  assert.match(svg, /<image href="data:image\/png;base64,/);
  assert.doesNotMatch(svg, /\/Users\/|file:\/\/|\.\.\//, "no local filesystem path may leak");
});

test("each annotation kind becomes a vector element", () => {
  const svg = buildCanvasSvg({ imageDataUrl: IMAGE, imageSize: SIZE, annotations: snapshot() });
  assert.match(svg, /<path d="M102\.4 76\.8 L409\.6 384"/, "pen path uses image pixel units");
  assert.match(svg, /<polygon points="/, "arrow gets a head");
  assert.match(svg, /<rect x="256" y="192" width="307\.2" height="153\.6"/);
  assert.match(svg, /<text /);
  assert.match(svg, /<tspan /);
});

test("memo text is xml-escaped exactly once", () => {
  const svg = buildCanvasSvg({
    imageDataUrl: IMAGE,
    imageSize: SIZE,
    annotations: snapshot({ memos: [{ id: "m", x: 0.1, y: 0.1, text: 'a & b < c "d"', color: "#fff" }] }),
  });
  assert.match(svg, /a &amp; b &lt; c/);
  assert.doesNotMatch(svg, /&amp;amp;/, "escaping the ampersand twice would render literally");
});

test("export never mutates the annotation snapshot", () => {
  const input = snapshot();
  const before = structuredClone(input);
  buildCanvasSvg({ imageDataUrl: IMAGE, imageSize: SIZE, annotations: input });
  assert.deepEqual(input, before);
});

test("arrow heads reuse the canvas geometry rather than a second implementation", () => {
  const renderer = readFileSync("ui/src/lib/canvas/annotationRenderer.ts", "utf8");
  const svgExport = readFileSync("ui/src/lib/canvas/svgExport.ts", "utf8");
  assert.match(renderer, /export function arrowHeadPoints/);
  assert.match(renderer, /const \[tip, left, right\] = arrowHeadPoints\(/, "canvas must use it too");
  assert.match(svgExport, /arrowHeadPoints\(/);
  assert.doesNotMatch(svgExport, /Math\.atan2/, "duplicated trigonometry would drift from PNG");
});

test("svg output layers annotations over a clean raster, not the flattened one", () => {
  // Reusing the merged PNG here would draw every stroke twice.
  const dispatcher = readFileSync("ui/src/lib/canvas/exportRenderer.ts", "utf8");
  assert.match(dispatcher, /paths: \[\], boxes: \[\], memos: \[\]/);
});
