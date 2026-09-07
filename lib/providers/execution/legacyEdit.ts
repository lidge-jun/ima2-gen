import type { RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type EditRequest = Extract<LegacyExecutionRequest, { surface: "edit" }>;

export async function prepareLegacyEdit(
  _ctx: RuntimeContext, request: EditRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"edit">> {
  return { execute: async () => {
    throw new Error(`Unsupported legacy edit provider: ${request.provider}`);
  } };
}
