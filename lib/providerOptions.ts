import { normalizeImageModel, normalizeReasoningEffort } from "./imageModels.js";

export function resolveProviderOptions(ctx, {
  provider = "oauth",
  rawModel,
  rawReasoningEffort,
  rawSize = "1024x1024",
  rawWebSearchEnabled = true,
  searchMode = "on",
}: any = {}) {
  const activeProvider = provider === "api" ? "api" : "oauth";
  const apiConfig = ctx?.config?.apiProvider || {};
  const modelInput = activeProvider === "api"
    ? (rawModel || apiConfig.defaultImageModel || "gpt-5.4-mini")
    : rawModel;
  const modelCheck = normalizeImageModel(ctx, modelInput);
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
