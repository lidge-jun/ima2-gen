import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { editViaOAuth } from "../lib/oauthProxy.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { normalizeImageModel } from "../lib/imageModels.js";
import { getStyleSheet } from "../lib/sessionStore.js";
import { renderStyleSheetPrefix } from "../lib/styleSheet.js";
import { startJob, finishJob } from "../lib/inflight.js";
import { logEvent, logError } from "../lib/logger.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

export function registerEditRoutes(app, ctx) {
  app.post("/api/edit", async (req, res) => {
    const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : null;
    let finishStatus = "completed";
    let finishHttpStatus;
    let finishErrorCode;
    let finishMeta = {};
    try {
      const {
        prompt,
        image: imageB64,
        quality: rawQuality = "medium",
        size = "1024x1024",
        moderation = "low",
        provider = "oauth",
        mode: promptMode = "auto",
        model: rawModel,
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
          styleSheetApplied: false,
        },
      });

      if (!prompt || !imageB64) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "INVALID_EDIT_INPUT";
        return res.status(400).json({ error: "Prompt and image are required" });
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

      let effectivePrompt = prompt;
      let styleSheetApplied = null;
      if (sessionId) {
        try {
          const data = getStyleSheet(sessionId);
          if (data && data.enabled && data.styleSheet) {
            const prefix = renderStyleSheetPrefix(data.styleSheet);
            if (prefix) {
              effectivePrompt = `${prefix} ${prompt}`.slice(0, 4000);
              styleSheetApplied = data.styleSheet;
            }
          }
        } catch {}
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
        styleSheetApplied: !!styleSheetApplied,
        inputImageChars: typeof imageB64 === "string" ? imageB64.length : 0,
      });
      const startTime = Date.now();
      const { b64: resultB64, usage, revisedPrompt } = await editViaOAuth(
        effectivePrompt,
        imageB64,
        quality,
        size,
        moderation,
        normalizedPromptMode,
        ctx,
        requestId,
        { model: imageModel },
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
        effectivePrompt: styleSheetApplied ? effectivePrompt : undefined,
        styleSheetApplied: styleSheetApplied || undefined,
        quality,
        size,
        moderation,
        model: imageModel,
        format: "png",
        provider: "oauth",
        kind: "edit",
        createdAt: Date.now(),
        usage: usage || null,
        webSearchCalls: 0,
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
