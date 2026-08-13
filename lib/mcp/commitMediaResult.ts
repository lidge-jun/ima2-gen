// Single atomic persistence path for MCP results (moved out of
// routes/mcpMedia.ts, 260718 — shared with routes/mcpRecover.ts): media ->
// STRICT sidecar (rollback on failure) -> thumbnail -> history -> done.
import { randomBytes } from "node:crypto";
import { copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteJson } from "../atomicWrite.js";
import { generateImageThumbnail } from "../imageThumb.js";
import { generateVideoThumbnail } from "../videoThumb.js";
import { invalidateHistoryIndex } from "../historyIndex.js";
import { finishJob } from "../inflight.js";
import { TERMINAL_SUCCESS } from "../jobStatus.js";
import { publishJobEvent } from "../ssePublish.js";
import type { requireRuntimeContext } from "../runtimeContext.js";

export interface CommitMediaResultInput {
  ctx: ReturnType<typeof requireRuntimeContext>;
  deps: { writeSidecar: typeof atomicWriteJson };
  requestId: string;
  kind: "image" | "video";
  tempPath: string;
  cleanup: () => Promise<void>;
  ext: string;
  meta: Record<string, unknown>;
  doneExtra: Record<string, unknown>;
}

export async function commitMediaResult(input: CommitMediaResultInput): Promise<string> {
  const { ctx, requestId, kind } = input;
  const filename = `${Date.now()}_${randomBytes(ctx.config.ids.generatedHexBytes).toString("hex")}_mcp.${input.ext}`;
  const filePath = join(ctx.config.storage.generatedDir, filename);
  const createdAt = Date.now();
  try {
    await copyFile(input.tempPath, filePath);
    await input.deps.writeSidecar(filePath + ".json", { ...input.meta, createdAt });
  } catch (commitError) {
    await rm(filePath, { force: true });
    throw commitError;
  } finally {
    await input.cleanup();
  }
  if (kind === "video") await generateVideoThumbnail(filePath).catch(() => undefined);
  else await generateImageThumbnail(filePath).catch(() => undefined);
  invalidateHistoryIndex();
  finishJob(requestId, { status: TERMINAL_SUCCESS, meta: { filename } });
  publishJobEvent(requestId, "done", {
    requestId, filename,
    url: `/generated/${encodeURIComponent(filename)}`,
    mediaType: kind, createdAt, ...input.doneExtra,
  });
  return filename;
}
