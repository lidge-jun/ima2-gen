import type { RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution } from "./types.js";
import { prepareLegacyClassic } from "./legacyClassic.js";
import { prepareLegacyNode } from "./legacyNode.js";
import { prepareLegacyEdit } from "./legacyEdit.js";
import { prepareLegacyMultimode } from "./legacyMultimode.js";

export type LegacyExecutionRequest = ImageExecutionRequest & {
  provider: Exclude<ImageExecutionRequest["provider"], "oauth" | "api">;
};

export function isLegacyExecutionRequest(request: ImageExecutionRequest): request is LegacyExecutionRequest {
  return request.provider !== "oauth" && request.provider !== "api";
}

export function prepareLegacyImageExecution<R extends LegacyExecutionRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
export function prepareLegacyImageExecution(
  ctx: RuntimeContext, request: LegacyExecutionRequest, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<ExecutionSurface>> {
  switch (request.surface) {
    case "classic": return prepareLegacyClassic(ctx, request, progress);
    case "node": return prepareLegacyNode(ctx, request, progress);
    case "edit": return prepareLegacyEdit(ctx, request, progress);
    case "multimode": return prepareLegacyMultimode(ctx, request, progress);
  }
}
