import type { RuntimeContext } from "../../runtimeContext.js";
import { assertDirectGrokKey } from "./admission.js";
import { isLegacyExecutionRequest, prepareLegacyImageExecution } from "./legacy.js";
import { isOpenaiRequest, prepareOpenaiExecution } from "../adapters/openaiExecution.js";
import { isGrokRequest, prepareGrokExecution } from "../adapters/grokExecution.js";
import type { ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution } from "./types.js";

export type * from "./types.js";

function prepareSelected(ctx: RuntimeContext, request: ImageExecutionRequest,
  progress?: ExecutionProgress): Promise<PreparedImageExecution<ExecutionSurface>> {
  if (isOpenaiRequest(request)) return prepareOpenaiExecution(ctx, request, progress);
  if (isGrokRequest(request)) return prepareGrokExecution(ctx, request, progress);
  if (isLegacyExecutionRequest(request)) return prepareLegacyImageExecution(ctx, request, progress);
  throw new Error("Unreachable image execution provider");
}

export function prepareImageExecution<R extends ImageExecutionRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
export async function prepareImageExecution(
  ctx: RuntimeContext, request: ImageExecutionRequest, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<ExecutionSurface>> {
  try {
    assertDirectGrokKey(ctx, request.provider);
    const prepared = await prepareSelected(ctx, request, progress);
    return { execute: async () => {
      try {
        assertDirectGrokKey(ctx, request.provider);
        return await prepared.execute();
      } catch (error) { throw error; } // Preserve transport identity; callers own normalization.
    } };
  } catch (error) { throw error; }
}
