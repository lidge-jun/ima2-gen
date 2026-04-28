import express from "express";
import { createCanvasVersion, updateCanvasVersion } from "../lib/canvasVersionStore.js";

function decodeHeader(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequestBuffer(req) {
  return Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
}

function getPrompt(req) {
  return decodeHeader(req.headers["x-ima2-canvas-prompt"]);
}

export function registerCanvasVersionRoutes(app, ctx) {
  const rawPng = express.raw({ type: "image/png", limit: ctx.config.server.bodyLimit });

  app.post("/api/canvas-versions", rawPng, async (req, res) => {
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
    } catch (err) {
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "CANVAS_VERSION_SAVE_FAILED",
      });
    }
  });

  app.put("/api/canvas-versions/:filename", rawPng, async (req, res) => {
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
    } catch (err) {
      res.status(err.status || 500).json({
        error: err.message,
        code: err.code || "CANVAS_VERSION_SAVE_FAILED",
      });
    }
  });
}
