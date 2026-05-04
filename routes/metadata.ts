import { Buffer } from "node:buffer";
import type { Express, Request, Response } from "express";
import { errInfo } from "../lib/errInfo.js";
import {
  isSupportedMetadataFormat,
  normalizeImageMetadataFormat,
  readEmbeddedImageMetadata,
} from "../lib/imageMetadataStore.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

const MIME_FORMATS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

function parseDataUrl(dataUrl: unknown): { mime: string; rawB64: string } | null {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), rawB64: match[2] };
}

export function registerMetadataRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.post("/api/metadata/read", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { dataUrl?: unknown };
      const parsed = parseDataUrl(body.dataUrl);
      if (!parsed) {
        return res.status(400).json({
          ok: false,
          code: "IMAGE_METADATA_INVALID",
          error: "A base64 image data URL is required.",
        });
      }
      if (parsed.rawB64.length > ctx.config.limits.maxMetadataReadB64Bytes) {
        return res.status(413).json({
          ok: false,
          code: "IMAGE_METADATA_TOO_LARGE",
          error: "Image is too large to inspect for metadata.",
        });
      }
      const format = normalizeImageMetadataFormat(MIME_FORMATS[parsed.mime]);
      if (!isSupportedMetadataFormat(format)) {
        return res.status(400).json({
          ok: false,
          code: "IMAGE_METADATA_UNSUPPORTED_FORMAT",
          error: "Only PNG, JPEG, and WebP metadata can be inspected.",
        });
      }
      const result = await readEmbeddedImageMetadata(Buffer.from(parsed.rawB64, "base64"));
      if (!result.metadata) {
        return res.json({
          ok: true,
          metadata: null,
          source: null,
          code: "IMAGE_METADATA_NOT_FOUND",
          warnings: result.warnings,
        });
      }
      return res.json({
        ok: true,
        metadata: result.metadata,
        source: result.source,
        warnings: result.warnings,
      });
    } catch (error) {
      const err = errInfo(error);
      return res.status(400).json({
        ok: false,
        code: err.code || "IMAGE_METADATA_INVALID",
        error: err.message || "Could not read image metadata.",
      });
    }
  });
}
