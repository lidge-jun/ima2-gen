// 0.09.12.2 — Keep supported image tool qualities intact for OAuth.
// The exposed app contract accepts low/medium/high; normalize only malformed input so
// the API response, UI metadata, and actual image_generation payload stay aligned.
export const DEFAULT_IMAGE_QUALITY = "medium";
export const VALID_IMAGE_QUALITIES = new Set(["low", "medium", "high"]);
/**
 * @param {{ provider?: string, quality?: string }} input
 * @returns {{ quality: string, warnings: Array<{code:string,field:string,normalizedTo:string,reason:string}> }}
 */
export function normalizeOAuthParams(input) {
    const requested = typeof input?.quality === "string" ? input.quality : DEFAULT_IMAGE_QUALITY;
    if (VALID_IMAGE_QUALITIES.has(requested)) {
        return { quality: requested, warnings: [] };
    }
    return {
        quality: DEFAULT_IMAGE_QUALITY,
        warnings: [
            {
                code: "QUALITY_DEFAULTED",
                field: "quality",
                normalizedTo: DEFAULT_IMAGE_QUALITY,
                reason: "invalid-quality",
            },
        ],
    };
}
