// Reference-image validator. Returns either { refs } on success or
// { error, code } on failure. The same six REF_* codes are surfaced in the
// 400 response body so the UI can map each to a specific user-facing toast.

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

export const MAX_REF_COUNT = 5;
// Decoded payload cap is ~5.2 MB; the base64 length cap is the encoded form.
export const MAX_REF_B64_BYTES = 7 * 1024 * 1024;

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
  for (let i = 0; i < references.length; i++) {
    const r = references[i];
    if (typeof r !== "string") {
      return {
        error: `references[${i}] must be a string`,
        code: "REF_NOT_STRING",
      };
    }
    const b64 = r.replace(/^data:[^;]+;base64,/, "");
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
    out.push(b64);
  }
  return { refs: out };
}
