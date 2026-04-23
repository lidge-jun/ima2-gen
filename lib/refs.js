// lib/refs.js — reference-image validator (0.09.7).
// Extracted from server.js so unit tests can import without booting the app.

import { config } from "../config.js";

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

export function validateAndNormalizeRefs(references, {
  maxCount = config.limits.maxRefCount,
  maxB64Bytes = config.limits.maxRefB64Bytes,
} = {}) {
  if (!Array.isArray(references)) {
    return { error: "references must be an array", code: "REF_NOT_ARRAY" };
  }
  if (references.length > maxCount) {
    return { error: `references may not exceed ${maxCount} items`, code: "REF_TOO_MANY" };
  }
  const out = [];
  for (let i = 0; i < references.length; i++) {
    const r = references[i];
    if (typeof r !== "string") {
      return { error: `references[${i}] must be a string`, code: "REF_NOT_STRING" };
    }
    const b64 = r.replace(/^data:[^;]+;base64,/, "");
    if (!b64) return { error: `references[${i}] is empty`, code: "REF_EMPTY" };
    if (b64.length > maxB64Bytes) {
      return { error: `references[${i}] exceeds ${maxB64Bytes} bytes`, code: "REF_TOO_LARGE" };
    }
    if (!BASE64_RE.test(b64)) {
      return { error: `references[${i}] is not valid base64`, code: "REF_NOT_BASE64" };
    }
    out.push(b64);
  }
  return { refs: out };
}
