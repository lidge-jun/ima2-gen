import { inspectGeneratedStorage } from "../lib/storageMigration.js";
import { openDirectory } from "../lib/openDirectory.js";

export function registerStorageRoutes(app, ctx) {
  app.get("/api/storage/status", async (_req, res) => {
    const status = await inspectGeneratedStorage(ctx);
    res.json({
      ok: true,
      data: toPublicStorageStatus(status),
    });
  });

  app.post("/api/storage/open-generated-dir", async (_req, res) => {
    const result: any = await openDirectory(ctx.config.storage.generatedDir);
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

function toPublicStorageStatus(status) {
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
