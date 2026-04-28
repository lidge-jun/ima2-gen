import sharp from "sharp";

const DEFAULT_MAX_B64_BYTES = 6 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 3840;
const DEFAULT_QUALITY_LADDER = [85, 75, 65, 55];
const FALLBACK_MAX_EDGE = 2048;
const FALLBACK_QUALITY_LADDER = [75, 65, 55];

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^;]+;base64,/, "");
}

function toBase64(buffer) {
  return buffer.toString("base64");
}

async function encodeJpegWithinBudget(input, {
  maxB64Bytes,
  maxEdge,
  qualityLadder,
}) {
  for (const quality of qualityLadder) {
    const out = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    const b64 = toBase64(out);
    if (b64.length <= maxB64Bytes) return { b64, compressed: true, quality, maxEdge };
  }
  return null;
}

export async function compressReferenceB64ForOAuth(imageB64, options: any = {}) {
  const rawB64 = stripDataUrlPrefix(imageB64);
  const maxB64Bytes = options.maxB64Bytes ?? DEFAULT_MAX_B64_BYTES;
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const qualityLadder = options.qualityLadder ?? DEFAULT_QUALITY_LADDER;
  if (!rawB64) return { b64: rawB64, compressed: false, inputBytes: 0, outputBytes: 0 };

  const input = Buffer.from(rawB64, "base64");
  const inputBytes = rawB64.length;
  if (!options.force && inputBytes <= maxB64Bytes) {
    return { b64: rawB64, compressed: false, inputBytes, outputBytes: inputBytes };
  }

  const primary = await encodeJpegWithinBudget(input, {
    maxB64Bytes,
    maxEdge,
    qualityLadder,
  });
  if (primary) {
    return { ...primary, inputBytes, outputBytes: primary.b64.length };
  }

  const fallback = await encodeJpegWithinBudget(input, {
    maxB64Bytes,
    maxEdge: options.fallbackMaxEdge ?? FALLBACK_MAX_EDGE,
    qualityLadder: options.fallbackQualityLadder ?? FALLBACK_QUALITY_LADDER,
  });
  if (fallback) {
    return { ...fallback, inputBytes, outputBytes: fallback.b64.length };
  }

  const err: any = new Error(`Reference image remains above ${maxB64Bytes} base64 bytes after compression`);
  err.code = "REF_TOO_LARGE";
  err.status = 400;
  throw err;
}
