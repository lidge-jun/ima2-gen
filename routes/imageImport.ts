import express from "express";
import { createLocalImport } from "../lib/localImportStore.js";

function decodeHeader(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function registerImageImportRoutes(app, ctx) {
  const rawImage = express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: ctx.config.server.bodyLimit,
  });

  app.post("/api/history/import-local", rawImage, async (req, res) => {
    try {
      const item = await createLocalImport(ctx, {
        buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        originalFilename: decodeHeader(req.headers["x-ima2-original-filename"]),
      });
      res.status(201).json({ item });
    } catch (err) {
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "IMPORT_FAILED",
      });
    }
  });
}
