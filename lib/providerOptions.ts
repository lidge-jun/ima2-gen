import type { RuntimeContext } from "./runtimeContext.js";
import { normalizeImageModel, normalizeReasoningEffort, normalizeGrokImageModel, normalizeGeminiApiModel } from "./imageModels.js";

function normalizeApiImageModel(rawModel: unknown, fallback: string) {
  if (typeof rawModel !== "string" || rawModel.trim().length === 0) {
    return { model: fallback };
  }

  const model = rawModel.trim();
  if (model.length > 128 || /[\u0000-\u001f\u007f]/.test(model)) {
    return {
      error: "Invalid API image model",
      code: "INVALID_API_IMAGE_MODEL",
      status: 400,
    };
  }

  return { model };
}

export function resolveProviderOptions(ctx: RuntimeContext | null | undefined, {
  provider = "oauth",
  rawModel,
  rawReasoningEffort,
  rawSize = "1024x1024",
  rawWebSearchEnabled = true,
  searchMode = "on",
}: any = {}) {
  if (provider === "agy") {
    return {
      provider: "agy" as const,
      model: "nano-banana-2",
      reasoningEffort: "none",
      size: "1024x1024",
      webSearchEnabled: false,
    };
  }

  if (provider === "gemini-api") {
    const geminiModelCheck = normalizeGeminiApiModel(rawModel || "nano-banana-2");
    if (geminiModelCheck.error) return { error: geminiModelCheck.error, code: geminiModelCheck.code, status: geminiModelCheck.status };
    return {
      provider: "gemini-api" as const,
      model: geminiModelCheck.model,
      reasoningEffort: "none",
      size: rawSize || "1024x1024",
      webSearchEnabled: false,
    };
  }

  if (provider === "grok") {
    const grokCfg: { defaultImageModel?: string } = (ctx?.config as any)?.grokProvider || {};
    const modelInput = rawModel || grokCfg.defaultImageModel;
    const grokModelCheck = normalizeGrokImageModel(modelInput);
    if (grokModelCheck.error) return { error: grokModelCheck.error, code: grokModelCheck.code, status: grokModelCheck.status };
    return {
      provider: "grok" as const,
      model: grokModelCheck.model,
      reasoningEffort: "none",
      size: rawSize,
      webSearchEnabled: true,
    };
  }

  if (provider === "grok-api") {
    const grokCfg: { defaultImageModel?: string } = (ctx?.config as any)?.grokProvider || {};
    const modelInput = rawModel || grokCfg.defaultImageModel;
    const grokModelCheck = normalizeGrokImageModel(modelInput);
    if (grokModelCheck.error) return { error: grokModelCheck.error, code: grokModelCheck.code, status: grokModelCheck.status };
    return {
      provider: "grok-api" as const,
      model: grokModelCheck.model,
      reasoningEffort: "none",
      size: rawSize,
      webSearchEnabled: true,
    };
  }

  const activeProvider = provider === "api" ? "api" : "oauth";
  const apiConfig: { defaultImageModel?: string; defaultReasoningEffort?: string; defaultSize?: string; allowWebSearch?: boolean } = (ctx?.config as { apiProvider?: any })?.apiProvider || {};
  const apiModelFallback = apiConfig.defaultImageModel || "gpt-image-2";
  const modelCheck = activeProvider === "api"
    ? normalizeApiImageModel(rawModel || apiModelFallback, apiModelFallback)
    : normalizeImageModel(ctx, rawModel);
  if (modelCheck.error) return { error: modelCheck.error, code: modelCheck.code, status: modelCheck.status };

  const reasoningInput = activeProvider === "api"
    ? (rawReasoningEffort || apiConfig.defaultReasoningEffort || "low")
    : rawReasoningEffort;
  const reasoningCheck = normalizeReasoningEffort(ctx, reasoningInput);
  if (reasoningCheck.error) {
    return { error: reasoningCheck.error, code: reasoningCheck.code, status: reasoningCheck.status };
  }

  const size = activeProvider === "api" && (typeof rawSize !== "string" || rawSize.length === 0)
    ? (apiConfig.defaultSize || "1024x1024")
    : rawSize;
  const webSearchEnabled = activeProvider === "api"
    ? apiConfig.allowWebSearch !== false && rawWebSearchEnabled !== false && searchMode !== "off"
    : rawWebSearchEnabled !== false && searchMode !== "off";

  return {
    provider: activeProvider,
    model: modelCheck.model,
    reasoningEffort: reasoningCheck.effort,
    size,
    webSearchEnabled,
  };
}
