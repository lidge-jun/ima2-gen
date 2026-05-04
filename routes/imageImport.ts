import express, { type Express, type Request, type Response } from "express";
import { createLocalImport } from "../lib/localImportStore.js";

import { errInfo } from "../lib/errInfo.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";
function decodeHeader(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function registerImageImportRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  const rawImage = express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: ctx.config.server.bodyLimit,
  });

  app.post("/api/history/import-local", rawImage, async (req: Request, res: Response) => {
    try {
      const item = await createLocalImport(ctx, {
        buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        originalFilename: decodeHeader(req.headers["x-ima2-original-filename"]),
      });
      res.status(201).json({ item });
    } catch (e) {
      const err = errInfo(e);
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "IMPORT_FAILED",
      });
    }
  });
}
