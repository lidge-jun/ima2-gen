// lib/sizeNudge.ts — prompt-side reinforcement for a requested output size.
//
// The GPT OAuth lane treats `size` as a strong hint rather than a contract: a
// portrait request comes back rotated often enough to matter, and a
// non-standard size is resampled to something near the ratio but not the pixels
// (#173). ima2 cannot fix the lane. It can say the same thing twice, which
// measurably helps — the same reason `--bg transparent` restates itself in the
// prompt instead of trusting the parameter alone.

/** Greatest common divisor, for reducing 1024x1536 to 2:3. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export interface ParsedSize {
  width: number;
  height: number;
}

export function parseSizeSpec(size: unknown): ParsedSize | null {
  if (typeof size !== "string") return null;
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/** "2:3" for 1024x1536. Falls back to the raw pair when it will not reduce cleanly. */
export function aspectLabel({ width, height }: ParsedSize): string {
  const divisor = gcd(width, height) || 1;
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  // A ratio like 941:1672 helps nobody; describe it by orientation instead.
  if (w > 64 || h > 64) return `${width}:${height}`;
  return `${w}:${h}`;
}

export function orientationOf({ width, height }: ParsedSize): "portrait" | "landscape" | "square" {
  if (width === height) return "square";
  return height > width ? "portrait" : "landscape";
}

/**
 * The sentence appended to the prompt when a size was requested.
 *
 * Names the orientation first because that is what actually goes wrong — a
 * rotated result keeps the ratio and ruins the composition — then the exact
 * pixels, then what not to do.
 */
export function sizeNudgeSuffix(size: unknown): string | null {
  const parsed = parseSizeSpec(size);
  if (!parsed) return null;
  const orientation = orientationOf(parsed);
  if (orientation === "square") {
    return `IMPORTANT: the output image MUST be square, ${parsed.width}x${parsed.height} pixels. Do not produce a portrait or landscape image.`;
  }
  const shape = orientation === "portrait" ? "tall vertical portrait" : "wide horizontal landscape";
  const forbidden = orientation === "portrait" ? "square or landscape" : "square or portrait";
  return `IMPORTANT: the output image MUST be a ${shape} image with a ${aspectLabel(parsed)} aspect ratio (width ${parsed.width}, height ${parsed.height}). Do not produce a ${forbidden} image.`;
}

/** True when the delivered pixels differ from what was asked for. */
export function sizeDrifted(requested: unknown, actual: ParsedSize | null): boolean {
  const want = parseSizeSpec(requested);
  if (!want || !actual) return false;
  return want.width !== actual.width || want.height !== actual.height;
}
