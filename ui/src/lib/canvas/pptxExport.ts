import type { CanvasMemo } from "../../types/canvas";
import type { ImageSize } from "./annotationRenderer";

export type PptxExportInput = {
  /** Flattened composition (image + annotations) as a PNG data URL. */
  mergedDataUrl: string;
  imageSize: ImageSize;
  memos: CanvasMemo[];
};

// 16:9 at pptxgenjs' default LAYOUT_16x9 (inches).
const SLIDE_W = 10;
const SLIDE_H = 5.625;

export type SlidePlacement = { x: number; y: number; w: number; h: number };

/**
 * Letterbox the composition onto a 16:9 slide without cropping.
 *
 * A portrait image leaves bars on both sides; that is correct. Filling the slide would
 * silently cut off part of what the user annotated.
 */
export function fitToSlide(size: ImageSize): SlidePlacement {
  const ratio = size.width / size.height;
  const slideRatio = SLIDE_W / SLIDE_H;
  const w = ratio >= slideRatio ? SLIDE_W : SLIDE_H * ratio;
  const h = ratio >= slideRatio ? SLIDE_W / ratio : SLIDE_H;
  return { x: (SLIDE_W - w) / 2, y: (SLIDE_H - h) / 2, w, h };
}

/** Map a normalized memo coordinate onto slide inches inside the placed image. */
export function memoPlacement(memo: CanvasMemo, placement: SlidePlacement): SlidePlacement {
  const w = Math.min(2.6, placement.w * 0.24);
  return {
    x: placement.x + memo.x * placement.w,
    y: placement.y + memo.y * placement.h,
    w,
    h: 0.55,
  };
}

/**
 * Build a one-slide PPTX from the current canvas composition.
 *
 * MVP scope: the flattened PNG carries the drawing, and memos are re-added as editable
 * text boxes on top. Freehand paths are not converted to PowerPoint shapes — curve
 * approximation is visibly wrong, and the issue explicitly allows an overlay fallback.
 *
 * pptxgenjs is loaded on demand (~1MB) so users who never export PPTX do not pay for it
 * in the initial bundle.
 */
export async function buildCanvasPptx(input: PptxExportInput): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_16x9";

  const slide = deck.addSlide();
  const placement = fitToSlide(input.imageSize);
  slide.addImage({ data: input.mergedDataUrl, ...placement });

  for (const memo of input.memos) {
    const text = memo.text.trim();
    if (!text) continue;
    slide.addText(text, {
      ...memoPlacement(memo, placement),
      fontSize: 11,
      color: "2F2A13",
      fill: { color: "FFF6B3" },
      line: { color: "2C250C", width: 0.5 },
      align: "left",
      valign: "top",
      shrinkText: true,
    });
  }

  const blob = (await deck.write({ outputType: "blob" })) as Blob;
  return blob;
}
