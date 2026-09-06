import { validateAndNormalizeRefs } from "./refs.js";
import type { RuntimeContext } from "./runtimeContext.js";
import { validateModeration } from "./routeHelpers.js";
import { validateGenerationPrompt } from "./generationInputValidation.js";
import { isSupportedMetadataFormat } from "./imageMetadataStore.js";

type NodeInputValidation =
  | {
      error: { code: string; message: string };
      code?: string;
      prompt?: never;
      refCheck?: never;
    }
  | {
      error?: never;
      code?: never;
      prompt: string;
      refCheck: Extract<ReturnType<typeof validateAndNormalizeRefs>, { refs: string[] }>;
    };

export function validateNodeInputs(
  ctx: RuntimeContext,
  prompt: unknown,
  references: unknown,
  moderation: string,
  format: unknown = "png",
): NodeInputValidation {
  const promptError = validateGenerationPrompt(prompt);
  if (promptError) return promptError;
  if (typeof format !== "string" || !isSupportedMetadataFormat(format)) {
    return { error: { code: "INVALID_FORMAT", message: "Format must be png, jpeg, jpg, or webp." } };
  }
  const refCheckResult = validateAndNormalizeRefs(references);
  if (refCheckResult.error) {
    return {
      error: { code: refCheckResult.code, message: refCheckResult.error },
      code: refCheckResult.code,
    };
  }
  const moderationCheck = validateModeration(ctx, moderation);
  if (moderationCheck.error) {
    return { error: { code: "INVALID_MODERATION", message: moderationCheck.error } };
  }
  return {
    prompt: prompt as string,
    refCheck: refCheckResult as Extract<typeof refCheckResult, { refs: string[] }>,
  };
}
