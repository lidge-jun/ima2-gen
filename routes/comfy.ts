import { exportImageToComfy, isComfyBridgeError } from "../lib/comfyBridge.js";

const ALLOWED_BODY_KEYS = new Set(["filename"]);

function hasExactBodyShape(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 1 && ALLOWED_BODY_KEYS.has(keys[0]) && typeof body.filename === "string";
}

function errorPayload(code, message) {
  return {
    ok: false,
    error: { code, message },
  };
}

export function registerComfyRoutes(app, ctx) {
  app.post("/api/comfy/export-image", async (req, res) => {
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
