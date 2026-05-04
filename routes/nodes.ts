import type { Express, Request, Response } from "express";
import { mkdir } from "fs/promises";
import {
  newNodeId,
  saveNode,
  loadNodeB64,
  loadNodeMeta,
  loadAssetB64,
} from "../lib/nodeStore.js";
import { startJob, finishJob } from "../lib/inflight.js";
import { summarizeReferencePayload, validateAndNormalizeRefs } from "../lib/refs.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { resolveProviderOptions } from "../lib/providerOptions.js";
import { generateViaResponses, editViaResponses } from "../lib/responsesImageAdapter.js";
import { isNonRetryableGenerationError, normalizeGenerationFailure, type UpstreamErr } from "../lib/generationErrors.js";
import { logEvent, logError } from "../lib/logger.js";

import { errInfo } from "../lib/errInfo.js";
import { requireRuntimeContext, type RouteRuntimeContext, type RuntimeContext } from "../lib/runtimeContext.js";

function asUpstream(e: unknown): UpstreamErr {
  return (e && typeof e === "object" ? e : {}) as UpstreamErr;
}

function validateModeration(ctx: RuntimeContext, moderation: unknown) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

function wantsSse(req: Request) {
  const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
  return accept.includes("text/event-stream");
}

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeNodeError(
  res: Response,
  status: number,
  code: string,
  message: string,
  parentNodeId: string | null,
  details: Record<string, unknown> = {},
) {
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
    status,
    ...details,
  });
}

function dataUrlFromB64(format: string, b64: string) {
  return `data:image/${format === "jpeg" ? "jpeg" : format};base64,${b64}`;
}

export function registerNodeRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.post("/api/node/generate", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      prompt?: string;
      parentNodeId?: string;
      requestId?: string;
      sessionId?: string;
      clientNodeId?: string;
      references?: unknown;
      quality?: string;
      size?: string;
      format?: string;
      moderation?: string;
      externalSrc?: string | null;
      mode?: string;
      contextMode?: string;
      searchMode?: string;
      model?: string;
      reasoningEffort?: string;
      provider?: string;
      webSearchEnabled?: boolean;
    };
    const streamResponse = wantsSse(req);
    const parentNodeId = (typeof body.parentNodeId === "string" ? body.parentNodeId : null);
    const requestId = typeof body.requestId === "string" ? body.requestId : (req.id ?? "");
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const clientNodeId = typeof body.clientNodeId === "string" ? body.clientNodeId : null;
    let finishMeta: Record<string, unknown> = {};
    let finishStatus = "completed";
    let finishHttpStatus: number | undefined;
    let finishErrorCode: string | undefined;
    const referencePayload = summarizeReferencePayload(body.references);
    startJob({
      requestId,
      kind: "node",
      prompt: body.prompt,
      meta: {
        kind: "node",
        sessionId,
        parentNodeId,
        clientNodeId,
        refsCount: referencePayload.refsCount,
        referenceBytes: referencePayload.referenceBytes,
        referenceB64Chars: referencePayload.referenceB64Chars,
      },
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
        searchMode: rawSearchMode = "on",
        model: rawModel,
        reasoningEffort: rawReasoningEffort,
      } = body;
      const { provider = "oauth" } = body;
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";
      const contextMode = ["parent-plus-refs", "parent-only", "ancestry"].includes(rawContextMode)
        ? rawContextMode
        : "parent-plus-refs";
      const searchMode = ["off", "auto", "on"].includes(rawSearchMode) ? rawSearchMode : "on";
      const providerOptions = resolveProviderOptions(ctx, {
        provider,
        rawModel,
        rawReasoningEffort,
        rawSize: size,
        rawWebSearchEnabled: body.webSearchEnabled,
        searchMode,
      });
      if (providerOptions.error) {
        finishStatus = "error";
        finishHttpStatus = providerOptions.status;
        finishErrorCode = providerOptions.code;
        return res.status(providerOptions.status).json({
          error: { code: providerOptions.code, message: providerOptions.error },
          parentNodeId,
        });
      }
      const imageModel = providerOptions.model;
      const reasoningEffort = providerOptions.reasoningEffort;
      const effectiveSize = providerOptions.size;
      const webSearchEnabled = providerOptions.webSearchEnabled;
      const activeProvider = providerOptions.provider;
      if (contextMode === "ancestry") {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = "CONTEXT_MODE_UNSUPPORTED";
        return res.status(400).json({
          error: { code: "CONTEXT_MODE_UNSUPPORTED", message: "Ancestry context is not supported yet." },
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
      const refCheckResult = validateAndNormalizeRefs(references);
      if (refCheckResult.error) {
        finishStatus = "error";
        finishHttpStatus = 400;
        finishErrorCode = refCheckResult.code;
        return res.status(400).json({
          error: { code: refCheckResult.code, message: refCheckResult.error },
          code: refCheckResult.code,
          parentNodeId,
        });
      }
      const refCheck = refCheckResult as Extract<typeof refCheckResult, { refs: string[] }>;
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

      const startTime = Date.now();
      let parentB64: string | null = null;
      if (parentNodeId) {
        parentB64 = await loadNodeB64(ctx.rootDir, `${parentNodeId}.png`, ctx.config.storage.generatedDir);
      } else if (typeof externalSrc === "string" && externalSrc.length > 0) {
        parentB64 = await loadAssetB64(ctx.rootDir, externalSrc, ctx.config.storage.generatedDir);
      }
      const operation = parentB64 ? "edit" : "generate";
      const referenceDiagnostics = refCheck.referenceDiagnostics || [];
      const generateReferenceDiagnostics = operation === "generate" ? referenceDiagnostics : [];
      const referenceMismatchCount = generateReferenceDiagnostics.filter((ref) => ref.warnings?.includes("mime_mismatch")).length;
      const refsForRequest = contextMode === "parent-only" ? [] : (refCheck.refDetails || refCheck.refs);
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
        size: effectiveSize,
        moderation,
        refs: refsForRequest.length,
        referenceBytes: referencePayload.referenceBytes,
        referenceMismatchCount,
        refDetectedMimes: [...new Set(generateReferenceDiagnostics.map((ref) => ref.detectedMime).filter(Boolean))].join(","),
        refDeclaredMimes: [...new Set(generateReferenceDiagnostics.map((ref) => ref.declaredMime).filter(Boolean))].join(","),
        inputImageCount,
        parentImagePresent,
        contextMode,
        searchMode,
        webSearchEnabled,
        promptChars: prompt.length,
        promptMode: normalizedPromptMode,
      });

      if (streamResponse) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        writeSse(res, "phase", { requestId, phase: "streaming" });
      }

      let b64: string | undefined, usage: unknown, webSearchCalls = 0, revisedPrompt: string | null = null;
      const MAX_RETRIES = 1;
      let lastErr: UpstreamErr | null = null;
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
            size: effectiveSize,
            refs: refsForRequest.length,
            inputImageCount,
            parentImagePresent,
            contextMode,
            searchMode,
            webSearchEnabled,
          });
          const r = parentB64
            ? await editViaResponses(activeProvider, prompt, parentB64, quality, effectiveSize, moderation, normalizedPromptMode, ctx, requestId, {
                model: imageModel,
                references: refsForRequest,
                searchMode,
                reasoningEffort,
                webSearchEnabled,
              })
            : await generateViaResponses(
                activeProvider,
                prompt,
                quality,
                effectiveSize,
                moderation,
                refsForRequest,
                requestId,
                normalizedPromptMode,
                ctx,
                {
                  model: imageModel,
                  reasoningEffort,
                  webSearchEnabled,
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
          lastErr = { message: "Empty response (safety refusal)" };
        } catch (e) {
          lastErr = asUpstream(e);
          if (isNonRetryableGenerationError(lastErr)) break;
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
          upstreamCode: lastErr?.upstreamCode || lastErr?.code,
          errorEventType: lastErr?.eventType,
          errorEventCount: lastErr?.eventCount,
          diagnosticReason: lastErr?.diagnosticReason,
          retryKind: lastErr?.retryKind,
          referencesDroppedOnRetry: lastErr?.referencesDroppedOnRetry,
          attempts: MAX_RETRIES + 1,
          outerHttpAlreadyCommitted: res.headersSent,
          sseErrorSent: streamResponse,
        });
        return writeNodeError(
          res,
          finishHttpStatus ?? 500,
          finishErrorCode ?? "NODE_GEN_FAILED",
          finalErr.message,
          parentNodeId,
          {
            upstreamCode: lastErr?.upstreamCode || lastErr?.code || null,
            upstreamType: lastErr?.upstreamType || null,
            upstreamParam: lastErr?.upstreamParam || null,
            errorEventType: lastErr?.eventType || null,
            errorEventCount: lastErr?.eventCount ?? null,
            diagnosticReason: finalErr.diagnosticReason || lastErr?.diagnosticReason || null,
            retryKind: finalErr.retryKind || lastErr?.retryKind || null,
            referencesDroppedOnRetry: finalErr.referencesDroppedOnRetry ?? lastErr?.referencesDroppedOnRetry ?? null,
            refsCount: finalErr.refsCount ?? lastErr?.refsCount ?? null,
            inputImageCount: finalErr.inputImageCount ?? lastErr?.inputImageCount ?? null,
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
        options: { quality, size: effectiveSize, format, moderation },
        model: imageModel,
        createdAt: Date.now(),
        createdAtIso: new Date().toISOString(),
        elapsed,
        usage: usage || null,
        webSearchCalls,
        webSearchEnabled,
        contextMode,
        searchMode,
        provider: activeProvider,
        kind: parentB64 ? "edit" : "generate",
        requestId,
        refsCount: refsForRequest.length,
        quality,
        size: effectiveSize,
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
        webSearchEnabled,
        provider: activeProvider,
        model: imageModel,
        size: effectiveSize,
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
    } catch (e) {
      const err = errInfo(e);
      const ext = (err.raw && typeof err.raw === "object" ? err.raw as Record<string, unknown> : {});
      const code = err.code || classifyUpstreamError(err.message) || "NODE_GEN_FAILED";
      finishStatus = "error";
      finishHttpStatus = err.status || 500;
      finishErrorCode = code;
      logError("node", "error", err.raw, { requestId, code, parentNodeId, sessionId, clientNodeId });
      writeNodeError(res, err.status || 500, code, err.message, parentNodeId, {
        upstreamCode: ext.upstreamCode || null,
        upstreamType: ext.upstreamType || null,
        upstreamParam: ext.upstreamParam || null,
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

  app.get("/api/node/:nodeId", async (req: Request<{ nodeId: string }>, res: Response) => {
    try {
      const { nodeId } = req.params;
      const meta = await loadNodeMeta(ctx.rootDir, nodeId, "png", ctx.config.storage.generatedDir);
      if (!meta) {
        return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "Node metadata missing" } });
      }
      const ext = meta?.options?.format || meta?.format || "png";
      res.json({ nodeId, meta, url: `/generated/${nodeId}.${ext}` });
    } catch (e) {
      const err = errInfo(e);
      res.status(err.status || 500).json({
        error: { code: err.code || "NODE_FETCH_FAILED", message: err.message },
      });
    }
  });
}
