// ui/src/lib/compress.ts — 0.09.7 reference-image pre-upload compression.
//
// Responsibility: accept a raw File from drag/paste/picker and return a
// base64 data URL whose length is under `maxB64Bytes` (default 6 MB, giving
// ~0.7 MB margin below the server's 7 MB base64 cap at lib/refs.js /
// config.limits.maxRefB64Bytes).
//
// Strategy (Option A — compress-everything):
//   1. Decode via createImageBitmap (fast, low-memory path).
//   2. Clamp longest side to 4096 (model doesn't need >4k and iOS Safari
//      has a 16,777,216 px² canvas cap). Also clamp total pixel area.
//   3. Draw onto an offscreen canvas.
//   4. JPEG encode starting at quality 0.85, step down to 0.7 then 0.55
//      if the output exceeds the budget. Return the first pass that fits.
//   5. preserveTransparency === true (PNG source with alpha): skip encoding
//      loop and output a PNG resize. PNGs can still exceed the budget; if
//      so, caller should surface the REF_TOO_LARGE toast.
//
// NOTE: existing ui/src/lib/image.ts:compressImage is a thumbnail helper
// (256 px / q=0.6) and intentionally separate.

export interface CompressOptions {
  /** Hard cap on output base64 length. Default 6_000_000 (server caps at 7 MB). */
  maxB64Bytes?: number;
  /** If true, keep PNG encoding (useful for transparent references). */
  preserveTransparency?: boolean;
  /** Longest edge in pixels. Default 4096. */
  maxEdge?: number;
  /** Quality ladder tried in order. Default [0.85, 0.7, 0.55]. */
  qualityLadder?: number[];
}

const DEFAULTS: Required<CompressOptions> = {
  maxB64Bytes: 6_000_000,
  preserveTransparency: false,
  maxEdge: 4096,
  qualityLadder: [0.85, 0.7, 0.55],
};

const MAX_CANVAS_PX = 16_777_216; // iOS Safari cap (4096×4096).

function clampDimensions(w: number, h: number, maxEdge: number): { w: number; h: number } {
  let width = w;
  let height = h;
  if (width <= 0 || height <= 0) return { w: 1, h: 1 };
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  if (width * height > MAX_CANVAS_PX) {
    const scale = Math.sqrt(MAX_CANVAS_PX / (width * height));
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }
  return { w: width, h: height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      if (typeof fr.result === "string") resolve(fr.result);
      else reject(new Error("FileReader returned non-string"));
    };
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      type,
      quality,
    );
  });
}

function b64LengthOfDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  return i < 0 ? dataUrl.length : dataUrl.length - i - 1;
}

export async function compressToBase64(file: File, opts: CompressOptions = {}): Promise<string> {
  const cfg = { ...DEFAULTS, ...opts };

  // Fast path: if already small enough and we're not forced to re-encode,
  // reuse the original bytes.
  const rawDataUrl = await blobToDataUrl(file);
  if (b64LengthOfDataUrl(rawDataUrl) <= cfg.maxB64Bytes) {
    return rawDataUrl;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error("이미지 디코드 실패. JPEG/PNG로 변환 후 다시 시도해 주세요.", { cause: err });
  }

  try {
    const { w, h } = clampDimensions(bitmap.width, bitmap.height, cfg.maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (cfg.preserveTransparency) {
      const blob = await canvasToBlob(canvas, "image/png");
      const dataUrl = await blobToDataUrl(blob);
      if (b64LengthOfDataUrl(dataUrl) > cfg.maxB64Bytes) {
        throw new Error("이미지 압축 실패. JPEG/PNG로 미리 변환 후 다시 시도해 주세요.");
      }
      return dataUrl;
    }

    for (const q of cfg.qualityLadder) {
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      const dataUrl = await blobToDataUrl(blob);
      if (b64LengthOfDataUrl(dataUrl) <= cfg.maxB64Bytes) {
        return dataUrl;
      }
    }
    throw new Error("이미지 압축 실패. JPEG/PNG로 미리 변환 후 다시 시도해 주세요.");
  } finally {
    bitmap.close?.();
  }
}

export function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

export function hasAlphaChannel(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  return t === "image/png";
}
