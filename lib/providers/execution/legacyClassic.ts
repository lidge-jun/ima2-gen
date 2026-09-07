import type { RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type ClassicRequest = Extract<LegacyExecutionRequest, { surface: "classic" }>;

export async function prepareLegacyClassic(
  _ctx: RuntimeContext, request: ClassicRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"classic">> {
  const { provider } = request;
  return { execute: async () => {
    throw new Error(`Unsupported classic execution provider: ${provider}`);
  } };
}
