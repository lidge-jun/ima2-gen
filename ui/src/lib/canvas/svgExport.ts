import type { AnnotationSnapshot, CanvasMemo, DrawingPath, BoundingBox } from "../../types/canvas";
import { arrowHeadPoints, toCanvasPoint, type ImageSize } from "./annotationRenderer";

export type SvgExportInput = {
  /** Source raster, embedded as a data URL so the file is self-contained. */
  imageDataUrl: string;
  imageSize: ImageSize;
  annotations: AnnotationSnapshot;
};

const MEMO_LINE_HEIGHT = 18;
const MEMO_PADDING = 12;
const MEMO_FONT = "14px sans-serif";

/**
 * Escape order matters: `&` first, otherwise the ampersands introduced by the later
 * replacements get escaped a second time.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pathElement(path: DrawingPath, size: ImageSize): string {
  if (path.points.length < 2) return "";
  const points = path.points.map((point) => toCanvasPoint(point, size));
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
  const stroke = `stroke="${xmlEscape(path.color)}" stroke-width="${path.strokeWidth}"`
    + ` stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const line = `<path d="${d}" ${stroke} />`;

  if (path.tool !== "arrow") return line;

  const head = arrowHeadPoints(points[points.length - 2], points[points.length - 1], path.strokeWidth)
    .map((p) => `${round(p.x)},${round(p.y)}`)
    .join(" ");
  return `${line}<polygon points="${head}" fill="${xmlEscape(path.color)}" />`;
}

function boxElement(box: BoundingBox, size: ImageSize): string {
  return (
    `<rect x="${round(box.x * size.width)}" y="${round(box.y * size.height)}"`
    + ` width="${round(box.width * size.width)}" height="${round(box.height * size.height)}"`
    + ` fill="none" stroke="${xmlEscape(box.color)}" stroke-width="${box.strokeWidth}" />`
  );
}

/**
 * SVG `<text>` has no automatic wrapping, so memo text is split into tspans.
 *
 * Korean has no word boundaries to break on, so wrapping falls back to a character
 * budget rather than splitting on whitespace only.
 */
function wrapMemo(text: string, maxChars: number): string[] {
  const source = text.trim();
  if (!source) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of source.split(/\s+/)) {
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) current = next;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function memoElement(memo: CanvasMemo, size: ImageSize): string {
  const x = round(memo.x * size.width);
  const y = round(memo.y * size.height);
  const width = round(Math.min(260, Math.max(150, size.width * 0.22)));
  const maxChars = Math.max(8, Math.floor((width - MEMO_PADDING * 2) / 7.5));
  const lines = wrapMemo(memo.text, maxChars);
  const height = round(Math.max(52, MEMO_PADDING * 2 + lines.length * MEMO_LINE_HEIGHT));

  const tspans = lines
    .map((line, index) =>
      `<tspan x="${round(x + MEMO_PADDING)}" dy="${index === 0 ? 0 : MEMO_LINE_HEIGHT}">`
      + `${xmlEscape(line)}</tspan>`)
    .join("");

  return (
    `<g>`
    + `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8"`
    + ` fill="rgba(255, 246, 179, 0.96)" stroke="rgba(44, 37, 12, 0.28)" stroke-width="1" />`
    + `<text x="${round(x + MEMO_PADDING)}" y="${round(y + MEMO_PADDING + 14)}"`
    + ` font="${MEMO_FONT}" font-family="sans-serif" font-size="14" fill="#2f2a13">${tspans}</text>`
    + `</g>`
  );
}

/**
 * Serialize the current canvas composition to SVG.
 *
 * Vectorizes the annotation layer only; the generated image itself is embedded as a
 * raster `<image>`. Pure function: it never mutates the snapshot, touches canvas state,
 * or writes a canvas version.
 */
export function buildCanvasSvg(input: SvgExportInput): string {
  const { imageSize: size, annotations } = input;
  const layers = [
    `<image href="${xmlEscape(input.imageDataUrl)}" x="0" y="0"`
    + ` width="${size.width}" height="${size.height}" preserveAspectRatio="none" />`,
    ...annotations.paths.map((path) => pathElement(path, size)),
    ...annotations.boxes.map((box) => boxElement(box, size)),
    ...annotations.memos.map((memo) => memoElement(memo, size)),
  ].filter(Boolean);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"`
    + ` viewBox="0 0 ${size.width} ${size.height}">`
    + layers.join("")
    + `</svg>`
  );
}
