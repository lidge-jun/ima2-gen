/**
 * sharp-backed raw decoder for alpha verification.
 *
 * Kept in its own module so lib/imageBackgroundParam.ts stays pure and
 * synchronously testable: the verifier takes the decoder as a parameter, and
 * tests can drive decode failures without stubbing sharp itself.
 */
import sharp from "sharp";

export async function decodeRawForAlpha(buffer: Buffer): Promise<{ data: Buffer; channels: number; hasAlpha: boolean }> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  if (!meta.hasAlpha) {
    // No alpha channel at all: skip the raw decode, the answer is already known.
    return { data: Buffer.alloc(0), channels: 0, hasAlpha: false };
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels, hasAlpha: true };
}
