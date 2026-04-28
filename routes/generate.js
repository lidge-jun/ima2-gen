import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { validateAndNormalizeRefs } from "../lib/refs.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { normalizeImageModel, normalizeReasoningEffort } from "../lib/imageModels.js";
import { generateViaOAuth } from "../lib/oauthProxy.js";
import { isNonRetryableGenerationError, normalizeGenerationFailure } from "../lib/generationErrors.js";
import { startJob, finishJob } from "../lib/inflight.js";
import { logEvent, logError } from "../lib/logger.js";
import { embedImageMetadataBestEffort } from "../lib/imageMetadataStore.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

export function registerGenerateRoutes(app, ctx) {
  app.post("/api/generate", async (req, res) => {
    const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : req.id;
    let finishStatus = "completed";
    let finishHttpStatus;
    let finishErrorCode;
    let finishMeta = {};
    try {
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
      const clientNodeId = typeof req.body?.clientNodeId === "string" ? req.body.clientNodeId : null;
      const {
        prompt,
        quality: rawQuality = "medium",
        size = "1024x1024",
        format = "png",
        moderation = "low",
        provider = "auto",
        n = 1,
        references = [],
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
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";

      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) return res.status(400).json({ error: moderationCheck.error });
      const count = Math.min(Math.max(parseInt(n) || 1, 1), 8);

      startJob({
        requestId,
        kind: "classic",
        prompt,
        meta: {
          kind: "classic",
          sessionId,
          parentNodeId: null,
          clientNodeId,
          quality,
          model: imageModel,
          size,
          n: count,
        },
      });

      const refCheck = validateAndNormalizeRefs(references);
      if (refCheck.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = refCheck.code;
        return res.status(400).json({ error: refCheck.error, code: refCheck.code });
      }

      if (provider === "api") {
        finishStatus = "error";
        finishHttpStatus = 403;
        finishErrorCode = "APIKEY_DISABLED";
        return res.status(403).json({ error: "API key provider is disabled. Use OAuth (Codex login).", code: "APIKEY_DISABLED" });
      }
      const client = req.get("x-ima2-client") || "ui";
      const referenceDiagnostics = refCheck.referenceDiagnostics || [];
      const referenceMismatchCount = referenceDiagnostics.filter((ref) => ref.warnings?.includes("mime_mismatch")).length;
      logEvent("generate", "request", {
        requestId,
        client,
        provider: "oauth",
        quality,
        model: imageModel,
        size,
        moderation,
        n: count,
        refs: refCheck.refs.length,
        referenceMismatchCount,
        refDetectedMimes: [...new Set(referenceDiagnostics.map((ref) => ref.detectedMime).filter(Boolean))].join(","),
        refDeclaredMimes: [...new Set(referenceDiagnostics.map((ref) => ref.declaredMime).filter(Boolean))].join(","),
        sessionId,
        clientNodeId,
        promptChars: typeof prompt === "string" ? prompt.length : 0,
        promptMode: normalizedPromptMode,
        webSearchEnabled,
      });
      const startTime = Date.now();

      const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
      const mime = mimeMap[format] || "image/png";
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });

      const generateOne = async () => {
        const MAX_RETRIES = 1;
        let lastErr;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const r = await generateViaOAuth(
              prompt,
              quality,
              size,
              moderation,
              refCheck.refDetails || refCheck.refs,
              requestId,
              normalizedPromptMode,
              ctx,
              { model: imageModel, reasoningEffort, webSearchEnabled },
            );
            if (r.b64) return r;
            lastErr = new Error("Empty response (safety refusal)");
          } catch (e) {
            lastErr = e;
            if (isNonRetryableGenerationError(e)) break;
          }
          if (attempt < MAX_RETRIES) {
            logEvent("generate", "retry", { requestId, attempt: attempt + 1, errorCode: lastErr?.code });
          }
        }
        throw normalizeGenerationFailure(lastErr, {
          safetyMessage: "Content generation refused after retries",
        });
      };

      const results = await Promise.allSettled(Array.from({ length: count }, generateOne));
      const images = [];
      let totalUsage = null;
      let totalWebSearchCalls = 0;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.b64) {
          const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
          const filename = `${Date.now()}_${rand}_${images.length}.${format}`;
          const meta = {
            kind: "classic",
            requestId,
            sessionId,
            clientNodeId,
            prompt,
            userPrompt: prompt,
            revisedPrompt: r.value.revisedPrompt || null,
            promptMode: normalizedPromptMode,
            quality,
            size,
            format,
            moderation,
            model: imageModel,
            provider: "oauth",
            createdAt: Date.now(),
            usage: r.value.usage || null,
            webSearchCalls: r.value.webSearchCalls || 0,
            webSearchEnabled,
            refsCount: refCheck.refs.length,
          };
          const rawBuffer = Buffer.from(r.value.b64, "base64");
          const embedded = await embedImageMetadataBestEffort(rawBuffer, format, meta, {
            version: ctx.packageVersion,
          });
          if (!embedded.embedded) {
            logEvent("generate", "metadata_embed_skipped", {
              requestId,
              filename,
              code: embedded.code,
              warning: embedded.warning,
            });
          }
          await writeFile(join(ctx.config.storage.generatedDir, filename), embedded.buffer);
          await writeFile(join(ctx.config.storage.generatedDir, filename + ".json"), JSON.stringify(meta)).catch(() => {});
          images.push({
            image: `data:${mime};base64,${r.value.b64}`,
            filename,
            revisedPrompt: r.value.revisedPrompt || null,
          });
          if (r.value.usage) {
            if (!totalUsage) totalUsage = { ...r.value.usage };
            else Object.keys(r.value.usage).forEach((k) => {
              if (typeof r.value.usage[k] === "number") totalUsage[k] = (totalUsage[k] || 0) + r.value.usage[k];
            });
          }
          if (typeof r.value.webSearchCalls === "number") totalWebSearchCalls += r.value.webSearchCalls;
        } else if (r.status === "rejected") {
          logError("generate", "parallel_failed", r.reason, { requestId });
        }
      }

      if (images.length === 0) {
        const firstErr = results.find((r) => r.status === "rejected")?.reason;
        if (firstErr?.code) {
          const status = firstErr.status || 500;
          finishStatus = "error";
          finishHttpStatus = status;
          finishErrorCode = firstErr.code;
          return res.status(status).json({
            error: firstErr.message,
            code: firstErr.code,
            upstreamCode: firstErr.upstreamCode || null,
            upstreamType: firstErr.upstreamType || null,
            upstreamParam: firstErr.upstreamParam || null,
            diagnosticReason: firstErr.diagnosticReason || null,
            retryKind: firstErr.retryKind || null,
            referencesDroppedOnRetry: firstErr.referencesDroppedOnRetry ?? null,
            errorEventCount: firstErr.eventCount ?? null,
            requestId,
          });
        }
        finishStatus = "error";
        finishHttpStatus = 500;
        finishErrorCode = "GENERATE_ALL_FAILED";
        return res.status(500).json({ error: "All generation attempts failed" });
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const firstRevised = images[0]?.revisedPrompt || null;
      const extra = {
        usage: totalUsage,
        provider: "oauth",
        webSearchCalls: totalWebSearchCalls,
        quality,
        size,
        moderation,
        model: imageModel,
        warnings: qualityWarnings,
        revisedPrompt: firstRevised,
        promptMode: normalizedPromptMode,
        webSearchEnabled,
      };

      if (count === 1) {
        finishHttpStatus = 200;
        finishMeta = { filenames: [images[0].filename], imageCount: 1 };
        logEvent("generate", "saved", {
          requestId,
          imageCount: 1,
          elapsedMs: Date.now() - startTime,
          filename: images[0].filename,
        });
        res.json({ image: images[0].image, elapsed, filename: images[0].filename, requestId, ...extra });
      } else {
        finishHttpStatus = 200;
        finishMeta = { filenames: images.map((image) => image.filename), imageCount: images.length };
        logEvent("generate", "saved", {
          requestId,
          imageCount: images.length,
          elapsedMs: Date.now() - startTime,
        });
        res.json({ images, elapsed, count: images.length, requestId, ...extra });
      }
    } catch (err) {
      const fallbackCode = err.code || classifyUpstreamError(err.message);
      finishStatus = "error";
      finishHttpStatus = err.status || 500;
      finishErrorCode = fallbackCode || "GENERATE_FAILED";
      logError("generate", "error", err, { requestId, code: finishErrorCode });
      res.status(err.status || 500).json({
        error: err.message,
        code: fallbackCode,
        upstreamCode: err.upstreamCode || null,
        upstreamType: err.upstreamType || null,
        upstreamParam: err.upstreamParam || null,
        diagnosticReason: err.diagnosticReason || null,
        retryKind: err.retryKind || null,
        referencesDroppedOnRetry: err.referencesDroppedOnRetry ?? null,
        errorEventCount: err.eventCount ?? null,
        requestId,
      });
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
