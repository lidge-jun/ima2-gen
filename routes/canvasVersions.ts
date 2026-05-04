import express, { type Express, type Request, type Response } from "express";
import { createCanvasVersion, updateCanvasVersion } from "../lib/canvasVersionStore.js";

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

function getRequestBuffer(req: Request): Buffer {
  return Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
}

function getPrompt(req: Request): string | null {
  return decodeHeader(req.headers["x-ima2-canvas-prompt"]);
}

export function registerCanvasVersionRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  const rawPng = express.raw({ type: "image/png", limit: ctx.config.server.bodyLimit });

  app.post("/api/canvas-versions", rawPng, async (req: Request, res: Response) => {
    try {
      const sourceFilename =
        typeof req.query.sourceFilename === "string"
          ? req.query.sourceFilename
          : decodeHeader(req.headers["x-ima2-canvas-source-filename"]);
      const item = await createCanvasVersion(ctx, {
        sourceFilename,
        prompt: getPrompt(req),
        buffer: getRequestBuffer(req),
      });
      res.status(201).json({ item });
    } catch (e) {
      const err = errInfo(e);
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "CANVAS_VERSION_SAVE_FAILED",
      });
    }
  });

  app.put("/api/canvas-versions/:filename", rawPng, async (req: Request<{ filename: string }>, res: Response) => {
    try {
      const filename = decodeURIComponent(req.params.filename);
      const sourceFilename =
        typeof req.query.sourceFilename === "string"
          ? req.query.sourceFilename
          : decodeHeader(req.headers["x-ima2-canvas-source-filename"]);
      const item = await updateCanvasVersion(ctx, filename, {
        sourceFilename,
        prompt: getPrompt(req),
        buffer: getRequestBuffer(req),
      });
      res.json({ item });
    } catch (e) {
      const err = errInfo(e);
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "CANVAS_VERSION_SAVE_FAILED",
      });
    }
  });
}
