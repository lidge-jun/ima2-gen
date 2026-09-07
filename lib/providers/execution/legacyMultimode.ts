import type { RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type MultimodeRequest = Extract<LegacyExecutionRequest, { surface: "multimode" }>;

export async function prepareLegacyMultimode(
  _ctx: RuntimeContext, request: MultimodeRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"multimode">> {
  return { execute: async () => {
    throw new Error(`Unsupported legacy multimode provider: ${request.provider}`);
  } };
}
