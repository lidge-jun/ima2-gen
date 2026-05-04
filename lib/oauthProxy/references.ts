import { detectImageMimeFromB64 } from "../refs.js";

export interface OAuthReferenceInput {
  b64?: string;
  declaredMime?: string | null;
  detectedMime?: string | null;
  warnings?: string[];
  approxBytes?: number | null;
  source?: string | null;
}

export type OAuthReferenceRef = string | OAuthReferenceInput | null | undefined;

export function supportedImageMime(mime: string | null | undefined): boolean {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

export function normalizeReferenceForOAuth(ref: OAuthReferenceRef, index: number) {
  const refObj = (typeof ref === "object" && ref) ? ref : null;
  const b64 = typeof ref === "string" ? ref : refObj?.b64;
  const declaredMime = refObj ? refObj.declaredMime || null : null;
  const detectedMime = refObj
    ? refObj.detectedMime || detectImageMimeFromB64(b64)
    : detectImageMimeFromB64(b64);
  const warnings = Array.isArray(refObj?.warnings) ? [...(refObj?.warnings ?? [])] : [];
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
    approxBytes: Number.isFinite(refObj?.approxBytes) ? refObj?.approxBytes ?? null : null,
    source: refObj?.source || (declaredMime ? "dataUrl" : "rawBase64"),
    warnings,
  };
}
