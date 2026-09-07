import type { RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type NodeRequest = Extract<LegacyExecutionRequest, { surface: "node" }>;

export async function prepareLegacyNode(
  _ctx: RuntimeContext, request: NodeRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"node">> {
  return { execute: async () => {
    throw new Error(`Unsupported node execution provider: ${request.provider}`);
  } };
}
