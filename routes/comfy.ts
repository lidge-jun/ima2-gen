import type { Express, Request, Response } from "express";
import { exportImageToComfy, isComfyBridgeError } from "../lib/comfyBridge.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

const ALLOWED_BODY_KEYS = new Set(["filename"]);

function hasExactBodyShape(body: unknown): body is { filename: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj);
  return keys.length === 1 && ALLOWED_BODY_KEYS.has(keys[0]) && typeof obj.filename === "string";
}

function errorPayload(code: string, message: string) {
  return {
    ok: false,
    error: { code, message },
  };
}

export function registerComfyRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.post("/api/comfy/export-image", async (req: Request, res: Response) => {
    try {
      if (!hasExactBodyShape(req.body)) {
        return res.status(400).json(errorPayload(
          "COMFY_IMAGE_INVALID",
          "Request body must contain exactly one filename.",
        ));
      }
      const result = await exportImageToComfy(ctx, { filename: req.body.filename });
      return res.json(result);
    } catch (error) {
      if (isComfyBridgeError(error)) {
        return res.status((error as any).status).json(errorPayload((error as any).code, error.message));
      }
      return res.status(502).json(errorPayload(
        "COMFY_UPLOAD_FAILED",
        "Could not upload image to ComfyUI.",
      ));
    }
  });
}
