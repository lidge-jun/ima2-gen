// Reference-image validator. Returns either { refs } on success or
// { error, code } on failure. The same six REF_* codes are surfaced in the
// 400 response body so the UI can map each to a specific user-facing toast.

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
const DATA_URL_RE = /^data:([^;,]+);base64,/i;

export const MAX_REF_COUNT = 5;
// Decoded payload cap is ~5.2 MB; the base64 length cap is the encoded form.
export const MAX_REF_B64_BYTES = 7 * 1024 * 1024;

// Magic-number sniffing. Returns "image/png" | "image/jpeg" | "image/webp" | null.
// Used to label OAuth Responses input_image data URLs with the actual format,
// which can differ from the client-declared MIME (PNG label hiding a JPEG body).
export function detectImageMimeFromB64(b64) {
  if (typeof b64 !== "string" || !b64) return null;
  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 3 &&
    buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateAndNormalizeRefs(references, {
  maxCount = MAX_REF_COUNT,
  maxB64Bytes = MAX_REF_B64_BYTES,
} = {}) {
  if (!Array.isArray(references)) {
    return { error: "references must be an array", code: "REF_NOT_ARRAY" };
  }
  if (references.length > maxCount) {
    return {
      error: `references may not exceed ${maxCount} items`,
      code: "REF_TOO_MANY",
    };
  }
  const out = [];
  const refDetails = [];
  for (let i = 0; i < references.length; i++) {
    const r = references[i];
    if (typeof r !== "string") {
      return {
        error: `references[${i}] must be a string`,
        code: "REF_NOT_STRING",
      };
    }
    const dataUrlMatch = r.match(DATA_URL_RE);
    const declaredMime = dataUrlMatch?.[1]?.toLowerCase() || null;
    const b64 = r.replace(DATA_URL_RE, "");
    if (!b64) {
      return { error: `references[${i}] is empty`, code: "REF_EMPTY" };
    }
    if (b64.length > maxB64Bytes) {
      return {
        error: `references[${i}] exceeds ${maxB64Bytes} bytes`,
        code: "REF_TOO_LARGE",
      };
    }
    if (!BASE64_RE.test(b64)) {
      return {
        error: `references[${i}] is not valid base64`,
        code: "REF_NOT_BASE64",
      };
    }
    const detectedMime = detectImageMimeFromB64(b64);
    const warnings = [];
    if (declaredMime && detectedMime && declaredMime !== detectedMime) {
      warnings.push("mime_mismatch");
    }
    out.push(b64);
    refDetails.push({
      index: i,
      b64,
      declaredMime,
      detectedMime,
      source: declaredMime ? "dataUrl" : "rawBase64",
      warnings,
    });
  }
  return { refs: out, refDetails };
}
