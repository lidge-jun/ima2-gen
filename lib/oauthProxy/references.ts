import { detectImageMimeFromB64 } from "../refs.js";

export function supportedImageMime(mime) {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

export function normalizeReferenceForOAuth(ref, index) {
  const b64 = typeof ref === "string" ? ref : ref?.b64;
  const declaredMime = typeof ref === "object" && ref ? ref.declaredMime || null : null;
  const detectedMime = typeof ref === "object" && ref
    ? ref.detectedMime || detectImageMimeFromB64(b64)
    : detectImageMimeFromB64(b64);
  const warnings = Array.isArray(ref?.warnings) ? [...ref.warnings] : [];
  if (declaredMime && detectedMime && declaredMime !== detectedMime && !warnings.includes("mime_mismatch")) {
    warnings.push("mime_mismatch");
  }
  const requestMime = supportedImageMime(detectedMime)
    ? detectedMime
    : supportedImageMime(declaredMime)
      ? declaredMime
      : "image/png";
  return {
    index,
    b64,
    declaredMime,
    detectedMime,
    requestMime,
    b64Chars: typeof b64 === "string" ? b64.length : 0,
    approxBytes: Number.isFinite(ref?.approxBytes) ? ref.approxBytes : null,
    source: ref?.source || (declaredMime ? "dataUrl" : "rawBase64"),
    warnings,
  };
}
