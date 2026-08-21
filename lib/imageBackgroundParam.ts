/**
 * Maps ima2's background preset onto the Responses `image_generation` tool
 * parameters (`background` + `output_format`).
 *
 * Why this is not a straight pass-through of `background: "transparent"`:
 *
 * The ChatGPT OAuth (Codex) session pins the image tool to the
 * `gpt-image-2-codex` variant, which REJECTS a forced transparent background
 * with HTTP 400 "Transparent background is not supported for this model." on
 * every OAuth model (gpt-5.6-luna/sol/terra, gpt-5.5, gpt-5.4, gpt-5.4-mini).
 * A bogus-parameter control returns a different error ("Unknown parameter"),
 * so that 400 is a genuine upstream semantic rejection, not a schema strip.
 *
 * `background: "auto"` IS accepted, and with an explicit cutout intent in the
 * prompt the model returns a real RGBA PNG. Measured on the live OAuth path:
 * 5/5 generations came back with 4 channels, all four corners at alpha 0, and
 * 42-56% fully transparent pixels — including genuine PARTIAL alpha for glass
 * and leaf veins. A scene-style prompt on the same settings returns 3 channels
 * with no alpha, so the prompt is the lever and `auto` is the switch that lets
 * the model pull it.
 *
 * Evidence: devlog/_plan/260821_gpt_image2_transparent_background/{000,001}.
 *
 * Direct API surfaces (Atlas Cloud gpt-image-2) accept the forced value per
 * OpenAI's 2026-08-21 preview announcement, so `supportsForcedTransparent`
 * lets those callers opt into the strict parameter.
 */
import type { BackgroundPreset } from "./backgroundPresets.js";

export const VALID_BACKGROUND_VALUES = ["auto", "opaque", "transparent"] as const;
export type BackgroundValue = (typeof VALID_BACKGROUND_VALUES)[number];

/** Formats that can carry an alpha channel. JPEG cannot. */
export const ALPHA_CAPABLE_FORMATS = ["png", "webp"] as const;
export type AlphaCapableFormat = (typeof ALPHA_CAPABLE_FORMATS)[number];

export interface ImageBackgroundParams {
  background: BackgroundValue;
  outputFormat: AlphaCapableFormat | undefined;
}

export interface ResolveBackgroundInput {
  preset: BackgroundPreset | null | undefined;
  /**
   * True only for surfaces proven to accept a forced transparent background.
   * The OAuth proxy is NOT one of them; see the module docblock.
   */
  supportsForcedTransparent?: boolean | undefined;
  /** Caller-requested output format, if any. */
  requestedFormat?: string | null | undefined;
}

export function isAlphaCapableFormat(value: unknown): value is AlphaCapableFormat {
  return typeof value === "string" && (ALPHA_CAPABLE_FORMATS as readonly string[]).includes(value);
}

/**
 * Image lanes that can actually return an alpha channel.
 *
 * Only the GPT image tool (OAuth/API) and the gpt-image-2 API surface expose a
 * background parameter. Grok, Gemini, Agy, and MiniMax have no equivalent and
 * their pipeline branches force JPEG, so a transparent request there would bill
 * the user for an opaque image labeled as a cutout.
 */
export const ALPHA_CAPABLE_PROVIDERS = ["oauth", "api", "atlascloud"] as const;

export function providerSupportsTransparent(provider: string | undefined | null): boolean {
  return typeof provider === "string" && (ALPHA_CAPABLE_PROVIDERS as readonly string[]).includes(provider);
}

export interface ProviderConflict {
  error: string;
  code: "TRANSPARENT_PROVIDER_UNSUPPORTED";
}

/** Refuse a transparent request on a lane that cannot deliver alpha. */
export function validateTransparentProvider(
  preset: string | null | undefined,
  provider: string | undefined | null,
): ProviderConflict | null {
  if (preset !== "transparent") return null;
  if (providerSupportsTransparent(provider)) return null;
  return {
    error: `transparent backgrounds are not supported on the "${String(provider)}" lane (no alpha channel); use ${ALPHA_CAPABLE_PROVIDERS.join(", ")}, or pick a solid background and key it`,
    code: "TRANSPARENT_PROVIDER_UNSUPPORTED",
  };
}

/**
 * Verify a result that was supposed to carry alpha actually does.
 *
 * Requesting transparency does not guarantee it: a provider can honor the
 * request semantically and still return opaque bytes, and JPEG cannot hold an
 * alpha channel at all. Persisting such a result would re-encode it through
 * sharp.toFormat() and record it with a "transparent" preset, so the file,
 * the metadata, and the UI would all disagree with reality.
 *
 * Byte-level check only — no decode — so this stays cheap enough for the hot
 * path: PNG declares its color type in the IHDR chunk, and only types 4
 * (grayscale+alpha) and 6 (truecolor+alpha) carry transparency. A tRNS chunk
 * also encodes transparency for palette/indexed images.
 */
export type AlphaVerdict =
  | { hasAlpha: true }
  | { hasAlpha: false; reason: "jpeg" | "no-alpha-channel" | "undetectable" };

export function bufferCarriesAlpha(buffer: Buffer): AlphaVerdict {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { hasAlpha: false, reason: "jpeg" };
  }
  const isPng = buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isPng) {
    // IHDR is always the first chunk: 8-byte signature, 4-byte length,
    // 4-byte type, then width(4) height(4) bitDepth(1) colorType(1).
    if (buffer.length < 26) return { hasAlpha: false, reason: "undetectable" };
    const colorType = buffer[25];
    if (colorType === 4 || colorType === 6) return { hasAlpha: true };
    if (buffer.includes(Buffer.from("tRNS", "ascii"))) return { hasAlpha: true };
    return { hasAlpha: false, reason: "no-alpha-channel" };
  }
  const isWebp = buffer.length >= 16
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (isWebp) {
    const chunk = buffer.subarray(12, 16).toString("ascii");
    // VP8L and VP8X can carry alpha; plain lossy VP8 cannot.
    if (chunk === "VP8L" || chunk === "VP8X") return { hasAlpha: true };
    return { hasAlpha: false, reason: "no-alpha-channel" };
  }
  return { hasAlpha: false, reason: "undetectable" };
}

export interface TransparentResultError extends Error {
  status: number;
  code: "TRANSPARENT_RESULT_OPAQUE";
  isOperational: true;
}

/** Operational error for a transparency request that came back opaque. */
export function makeTransparentResultError(
  provider: string | undefined | null,
  reason: "jpeg" | "no-alpha-channel" | "undetectable",
): TransparentResultError {
  const detail = reason === "jpeg"
    ? "the provider returned JPEG, which cannot carry an alpha channel"
    : reason === "no-alpha-channel"
      ? "the returned image has no alpha channel"
      : "the returned image format could not be verified to carry alpha";
  const err = new Error(
    `transparent background requested but ${detail} (lane: ${String(provider)}). Nothing was saved; retry, or use a solid background and key it.`,
  ) as TransparentResultError;
  err.status = 502;
  err.code = "TRANSPARENT_RESULT_OPAQUE";
  err.isOperational = true;
  return err;
}

/**
 * Resolve the tool parameters for a preset. Returns `null` when the preset
 * implies no explicit background handling, so existing callers keep their
 * current payload byte-for-byte.
 */
export function resolveImageBackgroundParams(
  input: ResolveBackgroundInput,
): ImageBackgroundParams | null {
  if (input.preset !== "transparent") return null;

  const requested = input.requestedFormat;
  // JPEG cannot hold alpha: silently honoring it would ship an opaque image
  // while the UI claims transparency. Fall back to PNG instead.
  const outputFormat: AlphaCapableFormat = isAlphaCapableFormat(requested) ? requested : "png";

  return {
    background: input.supportsForcedTransparent ? "transparent" : "auto",
    outputFormat,
  };
}

export interface FormatConflict {
  error: string;
  code: "TRANSPARENT_FORMAT_CONFLICT";
}

/**
 * Reject an explicit alpha-incapable format paired with a transparent
 * background instead of quietly producing an opaque image.
 */
export function validateTransparentFormat(
  preset: BackgroundPreset | null | undefined,
  requestedFormat: unknown,
): FormatConflict | null {
  if (preset !== "transparent") return null;
  if (requestedFormat === undefined || requestedFormat === null || requestedFormat === "") return null;
  if (isAlphaCapableFormat(requestedFormat)) return null;
  return {
    error: `a transparent background requires an alpha-capable output format (${ALPHA_CAPABLE_FORMATS.join(", ")}); received "${String(requestedFormat)}"`,
    code: "TRANSPARENT_FORMAT_CONFLICT",
  };
}
