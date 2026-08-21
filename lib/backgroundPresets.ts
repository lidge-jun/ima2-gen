/**
 * Background presets for asset generation (asset-gen mode / --bg flag).
 *
 * The prompt suffix keeps generated backgrounds uniform enough for a
 * deterministic color key. Prompt assembly is server-owned so the UI, CLI,
 * and integrations share one contract (devlog/_plan/260715_asset_gen_mode/020).
 *
 * "transparent" is a different KIND of preset: the other three ask the model
 * for a uniform matte that a later color-key pass removes, while transparent
 * asks for a real alpha channel up front. GPT-Image-2 can do this now
 * (devlog/_plan/260821_gpt_image2_transparent_background), so the transparent
 * preset drives BOTH a prompt suffix and the image_generation `background`
 * parameter. It is deliberately NOT color-keyable: there is no matte to key.
 */

export const BACKGROUND_PRESETS = ["chroma-green", "white", "black", "transparent"] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];

/**
 * Presets that produce a solid matte for downstream color keying. Transparent
 * is excluded because it already carries alpha; keying it would be a no-op at
 * best and would eat anti-aliased edges at worst.
 */
export const COLOR_KEYABLE_PRESETS = ["chroma-green", "white", "black"] as const;

export function isColorKeyablePreset(preset: BackgroundPreset): boolean {
  return (COLOR_KEYABLE_PRESETS as readonly string[]).includes(preset);
}

/**
 * Alpha-bearing presets cannot be encoded as JPEG. Callers that pick an output
 * format must consult this before defaulting to a lossy opaque format.
 */
export function presetRequiresAlpha(preset: BackgroundPreset | null | undefined): boolean {
  return preset === "transparent";
}

export type BackgroundPresetParse =
  | { preset: BackgroundPreset | null }
  | { error: string; code: "INVALID_BACKGROUND_PRESET" };

export function parseBackgroundPreset(raw: unknown): BackgroundPresetParse {
  if (raw === undefined || raw === null || raw === "") return { preset: null };
  if (typeof raw === "string" && (BACKGROUND_PRESETS as readonly string[]).includes(raw)) {
    return { preset: raw as BackgroundPreset };
  }
  return {
    error: `backgroundPreset must be one of: ${BACKGROUND_PRESETS.join(", ")}`,
    code: "INVALID_BACKGROUND_PRESET",
  };
}

const SUFFIX_BY_PRESET: Record<BackgroundPreset, string> = {
  "chroma-green":
    "The entire background must be a completely uniform solid chroma key green, perfectly flat like a professional green screen, with even studio lighting and no shadows, gradients, or texture on the background. The subject must have absolutely no green color cast, no green rim lighting, no green reflections, and no green spill from the background.",
  white:
    "The entire background must be a pure seamless white studio background, perfectly uniform, with even lighting and no shadows, gradients, or texture on the background.",
  black:
    "The entire background must be a pure seamless black studio background, perfectly uniform, with even lighting and no gradients or texture on the background.",
  transparent:
    "The background must be fully transparent with a real alpha channel: an isolated cutout of the subject with no backdrop, no backdrop color, no ground plane, no drop shadow, and no checkerboard pattern drawn into the image. Keep edges cleanly anti-aliased against transparency, and preserve genuine partial transparency in glass, smoke, hair, and other translucent areas.",
};

export function backgroundPromptSuffix(preset: BackgroundPreset, kind: "image" | "video"): string {
  const base = SUFFIX_BY_PRESET[preset];
  return kind === "video"
    ? `${base} The background must remain static, uniform, and identical in every frame of the video.`
    : base;
}

export function backgroundPlannerConstraint(preset: BackgroundPreset): string {
  if (preset === "transparent") {
    return "Hard constraint: the final prompt MUST explicitly require a fully transparent background with a real alpha channel — an isolated cutout with no backdrop, no ground plane, and no drop shadow. Never drop, weaken, or reinterpret this requirement, and never substitute a solid color background for transparency.";
  }
  const color = preset === "chroma-green" ? "chroma key green" : preset;
  return `Hard constraint: the final prompt MUST explicitly require a completely uniform solid ${color} background with even lighting and no shadows, gradients, or texture on the background.${preset === "chroma-green" ? " The subject must have no green color cast, green rim lighting, green reflections, or green spill from the background." : ""} Never drop, weaken, or reinterpret this requirement.`;
}
