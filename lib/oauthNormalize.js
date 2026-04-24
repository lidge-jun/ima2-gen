// 0.09.9 — Normalize tool-spec parameters for the OAuth (ChatGPT/Codex) backend.
// Community observation: only quality="auto" is honored by the OAuth proxy; other
// values are silently coerced. We normalize eagerly and surface a warning so UI/meta
// reflect reality. If the backend later honors non-auto values, delete this helper.

/**
 * @param {{ provider?: string, quality?: string }} input
 * @returns {{ quality: string, warnings: Array<{code:string,field:string,normalizedTo:string,reason:string}> }}
 */
export function normalizeOAuthParams(input) {
  const provider = input?.provider || "auto";
  const requested = input?.quality || "auto";
  const warnings = [];
  let quality = requested;

  const isOAuth = provider === "oauth" || provider === "auto";
  if (isOAuth && requested !== "auto") {
    quality = "auto";
    warnings.push({
      code: "QUALITY_NORMALIZED",
      field: "quality",
      normalizedTo: "auto",
      reason: "openai-oauth-backend-observation",
    });
  }

  return { quality, warnings };
}
