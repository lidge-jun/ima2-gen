import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { editViaOAuth } from "../lib/oauthProxy.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { normalizeImageModel, normalizeReasoningEffort } from "../lib/imageModels.js";
import { startJob, finishJob } from "../lib/inflight.js";
import { logEvent, logError } from "../lib/logger.js";
import { hasPngAlphaChannel, parsePngInfo } from "../lib/pngInfo.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

const MAX_EDIT_MASK_BYTES = 16 * 1024 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function stripPngDataUrl(value) {
  if (typeof value !== "string") return "";
  return value.replace(/^data:image\/png;base64,/, "");
}

function decodePngDataUrl(value, invalidCode, pngCode) {
  const b64 = stripPngDataUrl(value).replace(/\s+/g, "");
  if (!b64 || b64.length % 4 !== 0 || !BASE64_RE.test(b64)) {
    return { error: "image must be valid base64", code: invalidCode };
  }
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0 || buffer.toString("base64").replace(/=+$/, "") !== b64.replace(/=+$/, "")) {
    return { error: "image must be valid base64", code: invalidCode };
  }
  const info = parsePngInfo(buffer);
  if (info.error) return { error: "image must be a PNG image", code: pngCode };
  return { b64, buffer, info };
}

function validateEditMask(imageB64, mask) {
  if (mask == null) return { mask: null, maskBytes: 0 };
  if (typeof mask !== "string" || mask.length === 0) {
    return { error: "mask must be a PNG data URL or base64 string", code: "INVALID_EDIT_MASK" };
  }
  const maskCheck = decodePngDataUrl(mask, "INVALID_EDIT_MASK_BASE64", "INVALID_EDIT_MASK_PNG");
  if (maskCheck.error) return maskCheck;
  if (maskCheck.buffer.length > MAX_EDIT_MASK_BYTES) {
    return { error: "mask is too large", code: "EDIT_MASK_TOO_LARGE" };
  }
  if (!hasPngAlphaChannel(maskCheck.info)) {
    return { error: "mask PNG must include an alpha channel", code: "EDIT_MASK_NO_ALPHA" };
  }
  const imageCheck = decodePngDataUrl(imageB64, "INVALID_EDIT_IMAGE_BASE64", "INVALID_EDIT_IMAGE_PNG");
  if (imageCheck.error) return imageCheck;
  if (imageCheck.info.width !== maskCheck.info.width || imageCheck.info.height !== maskCheck.info.height) {
    return { error: "mask dimensions must match image dimensions", code: "EDIT_MASK_DIMENSION_MISMATCH" };
  }
  return { mask: maskCheck.b64, maskBytes: maskCheck.buffer.length };
}

export function registerEditRoutes(app, ctx) {
  app.post("/api/edit", async (req, res) => {
    const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : req.id;
    let finishStatus = "completed";
    let finishHttpStatus;
    let finishErrorCode;
    let finishMeta = {};
    try {
      const {
        prompt,
        image: imageB64,
        mask: rawMask,
        quality: rawQuality = "medium",
        size = "1024x1024",
        moderation = "low",
        provider = "oauth",
        mode: promptMode = "auto",
        model: rawModel,
        reasoningEffort: rawReasoningEffort,
        webSearchEnabled: rawWebSearchEnabled = true,
      } = req.body;
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const modelCheck = normalizeImageModel(ctx, rawModel);
      if (modelCheck.error) {
        finishStatus = "error";
        finishHttpStatus = modelCheck.status;
        finishErrorCode = modelCheck.code;
        return res.status(modelCheck.status).json({ error: modelCheck.error, code: modelCheck.code });
      }
      const imageModel = modelCheck.model;
      const reasoningCheck = normalizeReasoningEffort(ctx, rawReasoningEffort);
      if (reasoningCheck.error) {
        finishStatus = "error";
        finishHttpStatus = reasoningCheck.status;
        finishErrorCode = reasoningCheck.code;
        return res.status(reasoningCheck.status).json({ error: reasoningCheck.error, code: reasoningCheck.code });
      }
      const reasoningEffort = reasoningCheck.effort;
      const webSearchEnabled = rawWebSearchEnabled !== false;
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";

      startJob({
        requestId,
        kind: "classic",
        prompt,
        meta: {
          kind: "edit",
          sessionId,
          quality,
          model: imageModel,
          size,
        },
      });

      if (!prompt || !imageB64) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "INVALID_EDIT_INPUT";
        return res.status(400).json({ error: "Prompt and image are required" });
      }
      const maskCheck: any = validateEditMask(imageB64, rawMask);
      if (maskCheck.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = maskCheck.code;
        return res.status(400).json({ error: maskCheck.error, code: maskCheck.code });
      }
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "INVALID_MODERATION";
        return res.status(400).json({ error: moderationCheck.error });
      }
      if (provider === "api") {
        finishStatus = "error";
        finishHttpStatus = 403;
        finishErrorCode = "APIKEY_DISABLED";
        return res.status(403).json({ error: "API key provider is disabled. Use OAuth (Codex login).", code: "APIKEY_DISABLED" });
      }

      logEvent("edit", "request", {
        requestId,
        client: req.get("x-ima2-client") || "ui",
        provider: "oauth",
        quality,
        model: imageModel,
        size,
        moderation,
        sessionId,
        promptChars: typeof prompt === "string" ? prompt.length : 0,
        promptMode: normalizedPromptMode,
        webSearchEnabled,
        inputImageChars: typeof imageB64 === "string" ? imageB64.length : 0,
        maskPresent: Boolean(maskCheck.mask),
        maskBytes: maskCheck.maskBytes ?? 0,
      });
      const startTime = Date.now();
      const { b64: resultB64, usage, revisedPrompt, webSearchCalls = 0 } = await editViaOAuth(
        prompt,
        imageB64,
        quality,
        size,
        moderation,
        normalizedPromptMode,
        ctx,
        requestId,
        { model: imageModel, reasoningEffort, webSearchEnabled, mask: maskCheck.mask },
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });
      const filename = `${Date.now()}_${randomBytes(ctx.config.ids.generatedHexBytes).toString("hex")}.png`;
      await writeFile(join(ctx.config.storage.generatedDir, filename), Buffer.from(resultB64, "base64"));
      const meta = {
        prompt,
        userPrompt: prompt,
        revisedPrompt: revisedPrompt || null,
        promptMode: normalizedPromptMode,
        quality,
        size,
        moderation,
        model: imageModel,
        format: "png",
        provider: "oauth",
        kind: "edit",
        createdAt: Date.now(),
        usage: usage || null,
        webSearchCalls,
        webSearchEnabled,
      };
      await writeFile(join(ctx.config.storage.generatedDir, filename + ".json"), JSON.stringify(meta)).catch(() => {});
      finishHttpStatus = 200;
      finishMeta = { filename, imageChars: resultB64.length };
      logEvent("edit", "saved", {
        requestId,
        filename,
        imageChars: resultB64.length,
        elapsedMs: Date.now() - startTime,
      });

      res.json({
        image: `data:image/png;base64,${resultB64}`,
        elapsed,
        filename,
        usage,
        provider: "oauth",
        model: imageModel,
        moderation,
        warnings: qualityWarnings,
        revisedPrompt: revisedPrompt || null,
        promptMode: normalizedPromptMode,
        webSearchCalls,
        webSearchEnabled,
      });
    } catch (err) {
      const fallbackCode = err.code || classifyUpstreamError(err.message);
      finishStatus = "error";
      finishHttpStatus = err.status || 500;
      finishErrorCode = fallbackCode || "EDIT_FAILED";
      logError("edit", "error", err, { requestId, code: finishErrorCode });
      res.status(err.status || 500).json({ error: err.message, code: fallbackCode });
    } finally {
      finishJob(requestId, {
        status: finishStatus,
        httpStatus: finishHttpStatus,
        errorCode: finishErrorCode,
        meta: finishMeta,
      });
    }
  });
}
