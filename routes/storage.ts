import type { Express, Request, Response } from "express";
import { inspectGeneratedStorage } from "../lib/storageMigration.js";
import { openDirectory } from "../lib/openDirectory.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

type StorageStatus = Awaited<ReturnType<typeof inspectGeneratedStorage>>;

export function registerStorageRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.get("/api/storage/status", async (_req: Request, res: Response) => {
    const status = await inspectGeneratedStorage(ctx);
    res.json({
      ok: true,
      data: toPublicStorageStatus(status),
    });
  });

  app.post("/api/storage/open-generated-dir", async (_req: Request, res: Response) => {
    const result = (await openDirectory(ctx.config.storage.generatedDir)) as {
      ok: boolean;
      error?: string;
    };
    if (result.ok) return res.json({ ok: true });
    return res.status(500).json({
      ok: false,
      error: {
        code: "OPEN_GENERATED_DIR_FAILED",
        message: result.error || "Could not open generated image folder.",
      },
    });
  });
}

function toPublicStorageStatus(status: StorageStatus) {
  return {
    generatedDirLabel: status.generatedDirLabel,
    generatedCount: status.targetFileCount,
    legacyCandidatesScanned: status.legacyCandidatesScanned,
    legacySourcesFound: status.legacySourcesFound,
    legacyFilesFound: status.legacyFilesFound,
    state: status.state,
    messageKind: status.messageKind,
    recoveryDocsPath: status.recoveryDocsPath,
    doctorCommand: status.doctorCommand,
    overrides: status.overrides,
  };
}
