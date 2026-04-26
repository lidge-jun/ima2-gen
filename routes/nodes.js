import { mkdir } from "fs/promises";
import {
  newNodeId,
  saveNode,
  loadNodeB64,
  loadNodeMeta,
  loadAssetB64,
} from "../lib/nodeStore.js";
import { startJob, finishJob } from "../lib/inflight.js";
import { validateAndNormalizeRefs } from "../lib/refs.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { normalizeImageModel } from "../lib/imageModels.js";
import { generateViaOAuth, editViaOAuth } from "../lib/oauthProxy.js";
import { normalizeGenerationFailure } from "../lib/generationErrors.js";
import { getStyleSheet } from "../lib/sessionStore.js";
import { renderStyleSheetPrefix } from "../lib/styleSheet.js";
import { logEvent, logError } from "../lib/logger.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

function wantsSse(req) {
  const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
  return accept.includes("text/event-stream");
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeNodeError(res, status, code, message, parentNodeId, details = {}) {
  if (res.headersSent) {
    writeSse(res, "error", {
      error: { code, message },
      parentNodeId,
      status,
      ...details,
    });
    res.end();
    return;
  }
  res.status(status).json({
    error: { code, message },
    parentNodeId,
    ...details,
  });
}

function dataUrlFromB64(format, b64) {
  return `data:image/${format === "jpeg" ? "jpeg" : format};base64,${b64}`;
}

export function registerNodeRoutes(app, ctx) {
  app.post("/api/node/generate", async (req, res) => {
    const body = req.body || {};
    const streamResponse = wantsSse(req);
    const parentNodeId = body.parentNodeId ?? null;
    const requestId = typeof body.requestId === "string" ? body.requestId : req.id;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const clientNodeId = typeof body.clientNodeId === "string" ? body.clientNodeId : null;
    let finishMeta = {};
    let finishStatus = "completed";
    let finishHttpStatus;
    let finishErrorCode;
    startJob({
      requestId,
      kind: "node",
      prompt: body.prompt,
      meta: { kind: "node", sessionId, parentNodeId, clientNodeId },
    });

    try {
      const {
        prompt,
        quality: rawQuality = "medium",
        size = "1024x1024",
        format = "png",
        moderation = "low",
        references = [],
        externalSrc = null,
        mode: promptMode = "auto",
        contextMode: rawContextMode = "parent-plus-refs",
        searchMode: rawSearchMode = "off",
        model: rawModel,
      } = body;
      const { provider = "oauth" } = body;
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const modelCheck = normalizeImageModel(ctx, rawModel);
      if (modelCheck.error) {
        finishStatus = "error";
        finishHttpStatus = modelCheck.status;
        finishErrorCode = modelCheck.code;
        return res.status(modelCheck.status).json({
          error: { code: modelCheck.code, message: modelCheck.error },
          parentNodeId,
        });
      }
      const imageModel = modelCheck.model;
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";
      const contextMode = ["parent-plus-refs", "parent-only", "ancestry"].includes(rawContextMode)
        ? rawContextMode
        : "parent-plus-refs";
      const searchMode = ["off", "auto", "on"].includes(rawSearchMode) ? rawSearchMode : "off";
      if (contextMode === "ancestry") {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "CONTEXT_MODE_UNSUPPORTED";
        return res.status(400).json({
          error: { code: "CONTEXT_MODE_UNSUPPORTED", message: "Ancestry context is not supported yet." },
          parentNodeId,
        });
      }

      if (provider === "api") {
        finishStatus = "error";
        finishHttpStatus = 403;
        finishErrorCode = "APIKEY_DISABLED";
        return res.status(403).json({
          error: { code: "APIKEY_DISABLED", message: "API key provider is disabled. Use OAuth." },
          parentNodeId,
        });
      }
      if (!prompt || typeof prompt !== "string") {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "INVALID_PROMPT";
        return res.status(400).json({
          error: { code: "INVALID_PROMPT", message: "Prompt is required" },
          parentNodeId,
        });
      }
      const refCheck = validateAndNormalizeRefs(references);
      if (refCheck.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = refCheck.code;
        return res.status(400).json({
          error: { code: refCheck.code, message: refCheck.error },
          code: refCheck.code,
          parentNodeId,
        });
      }
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "INVALID_MODERATION";
        return res.status(400).json({
          error: { code: "INVALID_MODERATION", message: moderationCheck.error },
          parentNodeId,
        });
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

      const startTime = Date.now();
      let parentB64 = null;
      if (parentNodeId) {
        parentB64 = await loadNodeB64(ctx.rootDir, `${parentNodeId}.png`, ctx.config.storage.generatedDir);
      } else if (typeof externalSrc === "string" && externalSrc.length > 0) {
        parentB64 = await loadAssetB64(ctx.rootDir, externalSrc, ctx.config.storage.generatedDir);
      }
      const operation = parentB64 ? "edit" : "generate";
      const refsForRequest = contextMode === "parent-only" ? [] : refCheck.refs;
      const webSearchEnabled = !parentB64 || searchMode === "on";
      const parentImagePresent = !!parentB64;
      const inputImageCount = (parentImagePresent ? 1 : 0) + refsForRequest.length;
      logEvent("node", "request", {
        requestId,
        operation,
        sessionId,
        parentNodeId,
        clientNodeId,
        quality,
        model: imageModel,
        size,
        moderation,
        refs: refsForRequest.length,
        inputImageCount,
        parentImagePresent,
        contextMode,
        searchMode,
        webSearchEnabled,
        promptChars: prompt.length,
        promptMode: normalizedPromptMode,
        styleSheetApplied: !!styleSheetApplied,
      });

      if (streamResponse) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        writeSse(res, "phase", { requestId, phase: "streaming" });
      }

      let b64, usage, webSearchCalls = 0, revisedPrompt = null;
      const MAX_RETRIES = 1;
      let lastErr;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          logEvent("node", "attempt", {
            requestId,
            attempt,
            operation,
            sessionId,
            parentNodeId,
            clientNodeId,
            model: imageModel,
            moderation,
            quality,
            size,
            refs: refsForRequest.length,
            inputImageCount,
            parentImagePresent,
            contextMode,
            searchMode,
            webSearchEnabled,
          });
          const r = parentB64
            ? await editViaOAuth(effectivePrompt, parentB64, quality, size, moderation, normalizedPromptMode, ctx, requestId, { model: imageModel, references: refsForRequest, searchMode: searchMode === "on" ? "on" : "off" })
            : await generateViaOAuth(
                effectivePrompt,
                quality,
                size,
                moderation,
                refsForRequest,
                requestId,
                normalizedPromptMode,
                ctx,
                {
                  model: imageModel,
                  partialImages: streamResponse ? 2 : 0,
                  onPartialImage: streamResponse
                    ? (partial) =>
                        writeSse(res, "partial", {
                          requestId,
                          image: dataUrlFromB64(format, partial.b64),
                          index: partial.index,
                        })
                    : null,
                },
              );
          if (r.b64) {
            b64 = r.b64;
            usage = r.usage;
            webSearchCalls = r.webSearchCalls || 0;
            revisedPrompt = r.revisedPrompt || null;
            break;
          }
          lastErr = new Error("Empty response (safety refusal)");
        } catch (e) {
          lastErr = e;
        }
        if (attempt < MAX_RETRIES) {
          logEvent("node", "retry", {
            requestId,
            attempt: attempt + 1,
            operation,
            parentNodeId,
            clientNodeId,
            errorCode: lastErr?.code,
            errorEventType: lastErr?.eventType,
            errorEventCount: lastErr?.eventCount,
          });
        }
      }

      if (!b64) {
        const finalErr = normalizeGenerationFailure(lastErr, {
          safetyMessage: lastErr?.message || "Empty response after retry",
        });
        finishStatus = "error";
        finishHttpStatus = finalErr.status || 500;
        finishErrorCode = finalErr.code || "NODE_GEN_FAILED";
        logEvent("node", "final_error", {
          requestId,
          operation,
          finalCode: finishErrorCode,
          upstreamCode: lastErr?.code,
          errorEventType: lastErr?.eventType,
          errorEventCount: lastErr?.eventCount,
          attempts: MAX_RETRIES + 1,
          outerHttpAlreadyCommitted: res.headersSent,
          sseErrorSent: streamResponse,
        });
        return writeNodeError(
          res,
          finishHttpStatus,
          finishErrorCode,
          finalErr.message,
          parentNodeId,
          {
            upstreamCode: lastErr?.code || null,
            errorEventType: lastErr?.eventType || null,
            errorEventCount: lastErr?.eventCount ?? null,
          },
        );
      }

      const nodeId = newNodeId();
      const elapsed = +((Date.now() - startTime) / 1000).toFixed(1);
      const meta = {
        nodeId,
        parentNodeId,
        sessionId,
        clientNodeId,
        prompt,
        userPrompt: prompt,
        revisedPrompt,
        promptMode: normalizedPromptMode,
        effectivePrompt: styleSheetApplied ? effectivePrompt : undefined,
        styleSheetApplied: styleSheetApplied || undefined,
        options: { quality, size, format, moderation },
        model: imageModel,
        createdAt: Date.now(),
        createdAtIso: new Date().toISOString(),
        elapsed,
        usage: usage || null,
        webSearchCalls,
        contextMode,
        searchMode,
        provider: "oauth",
        kind: parentB64 ? "edit" : "generate",
        requestId,
        refsCount: refsForRequest.length,
        quality,
        size,
        format,
        moderation,
      };
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });
      const { filename } = await saveNode(ctx.rootDir, {
        nodeId,
        b64,
        meta,
        ext: format,
        generatedDir: ctx.config.storage.generatedDir,
      });
      finishMeta = { nodeId, filename, imageChars: b64.length };
      finishHttpStatus = 200;
      logEvent("node", "saved", {
        requestId,
        nodeId,
        filename,
        imageChars: b64.length,
        elapsedMs: Date.now() - startTime,
      });

      const payload = {
        nodeId,
        parentNodeId,
        requestId,
        image: dataUrlFromB64(format, b64),
        filename,
        url: `/generated/${filename}`,
        elapsed,
        usage,
        webSearchCalls,
        provider: "oauth",
        model: imageModel,
        size,
        moderation,
        refsCount: refsForRequest.length,
        contextMode,
        searchMode,
        warnings: qualityWarnings,
        revisedPrompt,
        promptMode: normalizedPromptMode,
      };

      if (streamResponse) {
        writeSse(res, "done", payload);
        res.end();
      } else {
        res.json(payload);
      }
    } catch (err) {
      const code = err.code || classifyUpstreamError(err.message) || "NODE_GEN_FAILED";
      finishStatus = "error";
      finishHttpStatus = err.status || 500;
      finishErrorCode = code;
      logError("node", "error", err, { requestId, code, parentNodeId, sessionId, clientNodeId });
      writeNodeError(res, err.status || 500, code, err.message, parentNodeId);
    } finally {
      finishJob(requestId, {
        status: finishStatus,
        httpStatus: finishHttpStatus,
        errorCode: finishErrorCode,
        meta: finishMeta,
      });
    }
  });

  app.get("/api/node/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      const meta = await loadNodeMeta(ctx.rootDir, nodeId, "png", ctx.config.storage.generatedDir);
      if (!meta) {
        return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "Node metadata missing" } });
      }
      const ext = meta?.options?.format || meta?.format || "png";
      res.json({ nodeId, meta, url: `/generated/${nodeId}.${ext}` });
    } catch (err) {
      res.status(err.status || 500).json({
        error: { code: err.code || "NODE_FETCH_FAILED", message: err.message },
      });
    }
  });
}
