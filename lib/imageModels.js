const FALLBACK_IMAGE_MODEL = "gpt-5.4-mini";
const VALID_IMAGE_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]);
const UNSUPPORTED_IMAGE_MODELS = new Set(["gpt-5.3-codex-spark"]);

export function normalizeImageModel(ctx, rawModel) {
  const configured = ctx?.config?.imageModels;
  const fallback = configured?.default ?? FALLBACK_IMAGE_MODEL;
  const valid = configured?.valid ?? VALID_IMAGE_MODELS;
  const unsupported = configured?.unsupported ?? UNSUPPORTED_IMAGE_MODELS;

  if (typeof rawModel !== "string" || rawModel.length === 0) {
    return { model: valid.has(fallback) ? fallback : FALLBACK_IMAGE_MODEL };
  }

  if (unsupported.has(rawModel)) {
    return {
      error: "model is listed by OAuth but does not support image_generation: gpt-5.3-codex-spark",
      code: "IMAGE_MODEL_UNSUPPORTED",
      status: 400,
    };
  }

  if (!valid.has(rawModel)) {
    return {
      error: "model must be one of: gpt-5.5, gpt-5.4, gpt-5.4-mini",
      code: "INVALID_IMAGE_MODEL",
      status: 400,
    };
  }

  return { model: rawModel };
}
