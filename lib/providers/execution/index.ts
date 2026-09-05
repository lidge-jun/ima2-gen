import type { RuntimeContext } from "../../runtimeContext.js";
import { assertDirectGrokKey } from "./admission.js";
import { prepareLegacyImageExecution } from "./legacy.js";
import type { ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution } from "./types.js";

export type * from "./types.js";

export function prepareImageExecution<R extends ImageExecutionRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
export async function prepareImageExecution(
  ctx: RuntimeContext, request: ImageExecutionRequest, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<ExecutionSurface>> {
  try {
    assertDirectGrokKey(ctx, request.provider);
    const prepared = await prepareLegacyImageExecution(ctx, request, progress);
    return { execute: async () => {
      try {
        assertDirectGrokKey(ctx, request.provider);
        return await prepared.execute();
      } catch (error) { throw error; } // Preserve transport identity; callers own normalization.
    } };
  } catch (error) { throw error; }
}
