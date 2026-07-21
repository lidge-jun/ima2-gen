import { mkdir, readFile, writeFile } from "fs/promises";
import { safeWriteSidecar, atomicWriteJson } from "./atomicWrite.js";
import { join } from "path";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import { detectImageMimeFromB64, summarizeReferencePayload, validateAndNormalizeRefs } from "./refs.js";
import { generateImageThumbnailFromBuffer } from "./imageThumb.js";
import { classifyUpstreamError } from "./errorClassify.js";
import { appendGenerationRequestLog } from "./generationRequestLog.js";
import { normalizeOAuthParams } from "./oauthNormalize.js";
import { resolveProviderOptions } from "./providerOptions.js";
import { generateViaResponses } from "./responsesImageAdapter.js";
import { generateViaGrok, planGrokImage } from "./grokImageAdapter.js";
import { generateViaAgy } from "./agyImageAdapter.js";
import { generateViaGeminiApi } from "./geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "./atlasCloudImageAdapter.js";
import { isNonRetryableGenerationError, normalizeGenerationFailure, type UpstreamErr } from "./generationErrors.js";
import { startJob, finishJob, registerJobAbortController, isJobCanceled, isStartJobFailure, setJobPhase, INFLIGHT_RETRY_AFTER_SECONDS, } from "./inflight.js";
import { isGenerationCanceledError, makeGenerationCanceledError, throwIfJobCanceled, } from "./generationCancel.js";
import { logEvent, logError } from "./logger.js";
import { embedImageMetadataBestEffort } from "./imageMetadataStore.js";
import { invalidateHistoryIndex } from "./historyIndex.js";
import { normalizeComposerInsertedPrompts, normalizeComposerPrompt, } from "./composerSnapshot.js";
import { errInfo } from "./errInfo.js";
import { requireRuntimeContext, type RuntimeContext } from "./runtimeContext.js";
import { STORYBOARD_PREFIX } from "./storyboardPrefix.js";
import { validateModeration, imageFormatFromMime, upstreamErrorFields } from "./routeHelpers.js";
import { publish } from "./eventBus.js";
import { publishJobEvent } from "./ssePublish.js";
import { normalizeBodyRequestId, validateBoundedCount, validateGenerationPrompt } from "./generationInputValidation.js";
export async function runGeneratePipeline(req: Request, res: Response, ctx: RuntimeContext) {
    const requestId = normalizeBodyRequestId(req.body?.requestId, req.id);
    const asyncMode = req.body?.async === true;
    let finishStatus = "completed";
    let finishHttpStatus: number | undefined;
    let finishErrorCode: string | undefined;
    let finishMeta: Record<string, unknown> = {};
    let finishCanceled = false;
    let jobOwned = false;
    const cancelController = new AbortController();
    const fail = (status: number, payload: Record<string, unknown>) => {
      finishStatus = "error";
      finishHttpStatus = status;
      finishErrorCode = typeof payload.code === "string" ? payload.code : finishErrorCode;
      if (asyncMode && res.headersSent) {
        publish(requestId, "error", { ...payload, status, requestId });
        return;
      }
      return res.status(status).json(payload);
    };
    const succeed = (payload: Record<string, unknown>) => {
      if (asyncMode) {
        publishJobEvent(requestId, "done", payload);
        return;
      }
      res.json(payload);
    };
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
      const promptError = validateGenerationPrompt(prompt);
      if (promptError) return fail(400, promptError);
      const maxGeneratedImages = Math.max(
        1,
        Math.trunc(Number(ctx.config.limits.maxGeneratedImages) || 1),
      );
      const countResult = validateBoundedCount(n, 1, maxGeneratedImages, "n");
      if ("error" in countResult) return fail(400, countResult);
      const count = countResult.value;
      const storyboardActive = req.body?.storyboard === true;
      const storyboardPrefix = storyboardActive ? STORYBOARD_PREFIX : "";
      const composerPrompt = normalizeComposerPrompt(req.body?.composerPrompt);
      const composerInsertedPrompts = normalizeComposerInsertedPrompts(
        req.body?.composerInsertedPrompts,
      );
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const providerOptions = resolveProviderOptions(ctx, {
        provider,
        rawModel,
        rawReasoningEffort,
        rawSize: size,
        rawWebSearchEnabled,
      });
      if (providerOptions.error) {
        return fail(providerOptions.status, { error: providerOptions.error, code: providerOptions.code });
      }
      const imageModel = providerOptions.model;
      const reasoningEffort = providerOptions.reasoningEffort;
      const effectiveSize = providerOptions.size;
      const webSearchEnabled = providerOptions.webSearchEnabled;
      const activeProvider = providerOptions.provider;
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";
      const generationPrompt = storyboardPrefix + prompt;
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) return fail(400, { error: moderationCheck.error });
      const referencePayload = summarizeReferencePayload(references);
      const refCheckResult = validateAndNormalizeRefs(references);
      if (refCheckResult.error) {
        return fail(400, { error: refCheckResult.error, code: refCheckResult.code });
      }
      const refCheck = refCheckResult as Extract<typeof refCheckResult, { refs: string[] }>;
      const incomingProviderUrl = typeof req.body?.providerUrl === "string" && req.body.providerUrl.startsWith("http")
        ? req.body.providerUrl
        : null;
      const grokRefs = incomingProviderUrl
        ? [{ b64: "", url: incomingProviderUrl, declaredMime: "image/png", detectedMime: "image/png" }, ...refCheck.refDetails]
        : refCheck.refDetails;
      const providerRefCount = activeProvider === "grok" || activeProvider === "grok-api"
        ? grokRefs.length
        : refCheck.refs.length;
      if ((activeProvider === "grok" || activeProvider === "agy" || activeProvider === "grok-api" || activeProvider === "gemini-api") && providerRefCount > 3) {
        return fail(400, {
          error: `${activeProvider === "agy" ? "Agy" : "Grok"} image editing supports up to 3 reference images`,
          code: activeProvider === "agy" ? "AGY_REF_TOO_MANY" : "GROK_REF_TOO_MANY",
          requestId,
        });
      }
      if (activeProvider === "atlascloud" && providerRefCount > 10) {
        return fail(400, {
          error: "Atlas Cloud image editing supports up to 10 reference images",
          code: "ATLASCLOUD_REF_TOO_MANY",
          requestId,
        });
      }
      const started = startJob({
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
          size: effectiveSize,
          n: count,
          refsCount: providerRefCount,
          referenceBytes: referencePayload.referenceBytes,
          referenceB64Chars: referencePayload.referenceB64Chars,
          composerPrompt,
          composerInsertedPrompts,
        },
      });
      if (started && isStartJobFailure(started)) {
        const status = started.code === "TOO_MANY_JOBS" ? 429 : 409;
        if (started.code === "TOO_MANY_JOBS") {
          res.setHeader("Retry-After", String(INFLIGHT_RETRY_AFTER_SECONDS));
        }
        return fail(status, {
          error: started.code === "TOO_MANY_JOBS"
            ? "Too many concurrent generation jobs"
            : "Request ID already in use",
          code: started.code,
          requestId,
        });
      }
      jobOwned = true;
      registerJobAbortController(requestId, cancelController);
      if (asyncMode) {
        res.status(202).json({ requestId, async: true });
      }
      setJobPhase(requestId, "streaming");
      if (asyncMode) publish(requestId, "phase", { requestId, phase: "streaming" });
      const client = req.get("x-ima2-client") || "ui";
      const referenceDiagnostics = refCheck.referenceDiagnostics || [];
      const referenceMismatchCount = referenceDiagnostics.filter((ref) => ref.warnings?.includes("mime_mismatch")).length;
      logEvent("generate", "request", {
        requestId,
        client,
        provider: activeProvider,
        quality,
        model: imageModel,
        size: effectiveSize,
        moderation,
        n: count,
        refs: providerRefCount,
        referenceBytes: referencePayload.referenceBytes,
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
      const mimeMap: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
      const effectiveFormat = activeProvider === "grok" || activeProvider === "agy" || activeProvider === "grok-api" || activeProvider === "gemini-api" || activeProvider === "atlascloud" ? "jpeg" : String(format);
      const mime = mimeMap[effectiveFormat] || "image/png";
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });
      const grokDirectApiKey = activeProvider === "grok-api" ? ctx.xaiApiKey : undefined;
      const sharedGrokPlan = activeProvider === "grok" || activeProvider === "grok-api"
        ? await planGrokImage(generationPrompt, ctx, {
          model: quality === "high" ? "grok-imagine-image-quality" : imageModel,
          size: effectiveSize,
          signal: cancelController.signal,
          requestId,
          referenceCount: grokRefs.length,
          references: grokRefs,
          directApiKey: grokDirectApiKey,
        })
        : null;
      const generateOne = async () => {
        if (activeProvider === "gemini-api") {
          const r = await generateViaGeminiApi(generationPrompt, requireRuntimeContext(ctx), {
            model: imageModel,
            size: effectiveSize,
            signal: cancelController.signal,
            requestId,
            references: refCheck.refDetails,
          });
          throwIfJobCanceled(requestId);
          return r;
        }
        if (activeProvider === "agy") {
          const r = await generateViaAgy(generationPrompt, {
            references: refCheck.refDetails,
            signal: cancelController.signal,
            requestId,
          });
          throwIfJobCanceled(requestId);
          return r;
        }
        if (activeProvider === "atlascloud") {
          const r = await generateViaAtlasCloud(generationPrompt, requireRuntimeContext(ctx), {
            model: imageModel,
            size: effectiveSize,
            quality,
            signal: cancelController.signal,
            requestId,
            references: refCheck.refDetails,
          });
          throwIfJobCanceled(requestId);
          return r;
        }
        if (activeProvider === "grok" || activeProvider === "grok-api") {
          const grokModel = quality === "high" ? "grok-imagine-image-quality" : imageModel;
          const r = await generateViaGrok(generationPrompt, ctx, {
            model: grokModel,
            size: effectiveSize,
            signal: cancelController.signal,
            requestId,
            plannedPrompt: sharedGrokPlan?.prompt,
            webSearchCalls: sharedGrokPlan?.webSearchCalls,
            references: grokRefs,
            directApiKey: grokDirectApiKey,
          });
          throwIfJobCanceled(requestId);
          return r;
        }
        const MAX_RETRIES = 1;
        let lastErr: unknown;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const r = await generateViaResponses(
              activeProvider,
              generationPrompt,
              quality,
              effectiveSize,
              moderation,
              refCheck.refDetails || refCheck.refs,
              requestId,
              normalizedPromptMode,
              ctx,
              {
                model: imageModel,
                reasoningEffort,
                webSearchEnabled,
                signal: cancelController.signal,
                allowPromptOnlyOAuthFallback: activeProvider !== "api",
              },
            );
            throwIfJobCanceled(requestId);
            if (r.b64) return r;
            lastErr = new Error("Empty response (safety refusal)");
          } catch (e) {
            lastErr = e;
            if (isNonRetryableGenerationError(e as UpstreamErr | null | undefined)) break;
          }
          if (attempt < MAX_RETRIES) {
            const errCode = (lastErr && typeof lastErr === "object" && "code" in lastErr)
              ? (lastErr as { code?: unknown }).code
              : undefined;
            logEvent("generate", "retry", { requestId, attempt: attempt + 1, errorCode: errCode });
          }
        }
        throw normalizeGenerationFailure(lastErr as UpstreamErr | null | undefined, {
          safetyMessage: "Content generation refused after retries",
        });
      };
      const results = await Promise.allSettled(Array.from({ length: count }, generateOne));
      throwIfJobCanceled(requestId);
      const images: Array<{
        image: string;
        filename: string;
        revisedPrompt: any;
        providerUrl?: string;
        createdAt: number;
      }> = [];
      let totalUsage: Record<string, number> | null = null;
      let totalWebSearchCalls = 0;
      let firstRetryMeta: Record<string, unknown> | null = null;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.b64) {
          throwIfJobCanceled(requestId);
          const valueWithMime = r.value as typeof r.value & { mime?: string };
          const resultMime = activeProvider === "grok" || activeProvider === "agy" || activeProvider === "grok-api" || activeProvider === "gemini-api" || activeProvider === "atlascloud"
            ? (valueWithMime.mime || detectImageMimeFromB64(r.value.b64) || mime)
            : mime;
          const resultFormat = activeProvider === "grok" || activeProvider === "agy" || activeProvider === "grok-api" || activeProvider === "gemini-api" || activeProvider === "atlascloud" ? imageFormatFromMime(resultMime) : effectiveFormat;
          const retryValue = r.value as typeof r.value & {
            retryKind?: string;
            initialEventCount?: number;
            initialEventTypes?: unknown;
            hadReferences?: boolean;
            referencesDroppedOnRetry?: boolean;
            developerPromptDroppedOnRetry?: boolean;
            webSearchDroppedOnRetry?: boolean;
          };
          if (!firstRetryMeta && retryValue.retryKind) {
            firstRetryMeta = {
              retryKind: retryValue.retryKind,
              initialEventCount: retryValue.initialEventCount ?? null,
              initialEventTypes: retryValue.initialEventTypes || null,
              hadReferences: retryValue.hadReferences ?? null,
              referencesDroppedOnRetry: retryValue.referencesDroppedOnRetry ?? null,
              developerPromptDroppedOnRetry: retryValue.developerPromptDroppedOnRetry ?? null,
              webSearchDroppedOnRetry: retryValue.webSearchDroppedOnRetry ?? null,
            };
          }
          const rand = randomBytes(ctx.config.ids.generatedHexBytes).toString("hex");
          const filename = `${Date.now()}_${rand}_${images.length}.${resultFormat}`;
          const createdAt = Date.now();
          const valueWithProviderUrl = r.value as typeof r.value & { providerUrl?: unknown };
          const providerUrl = typeof valueWithProviderUrl.providerUrl === "string"
            ? valueWithProviderUrl.providerUrl
            : undefined;
          const meta = {
            kind: "classic",
            requestId,
            sessionId,
            clientNodeId,
            prompt,
            userPrompt: prompt,
            revisedPrompt: r.value.revisedPrompt || null,
            promptMode: normalizedPromptMode,
            composerPrompt,
            composerInsertedPrompts,
            quality,
            size: effectiveSize,
            format: resultFormat,
            moderation,
            model: activeProvider === "grok" ? (quality === "high" ? "grok-imagine-image-quality" : imageModel) : imageModel,
            reasoningEffort,
            provider: activeProvider,
            createdAt,
            ...(providerUrl ? { providerUrl } : {}),
            usage: r.value.usage || null,
            webSearchCalls: r.value.webSearchCalls || 0,
            webSearchEnabled,
            refsCount: providerRefCount,
          };
          const rawBuffer = Buffer.from(r.value.b64, "base64");
          const embedded: any = await embedImageMetadataBestEffort(rawBuffer, resultFormat, meta, {
            version: ctx.packageVersion,
          });
          if (!embedded.embedded) {
            logEvent("generate", "metadata_embed_skipped", { requestId, filename, code: embedded.code, warning: embedded.warning, });
          }
          const filePath = join(ctx.config.storage.generatedDir, filename);
          await writeFile(filePath, embedded.buffer);
          await safeWriteSidecar(filePath + ".json", meta);
          generateImageThumbnailFromBuffer(embedded.buffer, filePath).catch(() => {});
          invalidateHistoryIndex();
          images.push({
            image: `data:${resultMime};base64,${r.value.b64}`,
            filename,
            revisedPrompt: r.value.revisedPrompt || null,
            ...(providerUrl ? { providerUrl } : {}),
            createdAt,
          });
          if (r.value.usage) {
            const usageValue = r.value.usage;
            if (!totalUsage) totalUsage = { ...usageValue };
            else {
              const tu = totalUsage;
              Object.keys(usageValue).forEach((k) => {
                if (typeof usageValue[k] === "number") tu[k] = (tu[k] || 0) + usageValue[k];
              });
            }
          }
          if (typeof r.value.webSearchCalls === "number") {
            totalWebSearchCalls = activeProvider === "grok" || activeProvider === "grok-api"
              ? Math.max(totalWebSearchCalls, r.value.webSearchCalls)
              : totalWebSearchCalls + r.value.webSearchCalls;
          }
        } else if (r.status === "rejected") {
          logError("generate", "parallel_failed", r.reason, { requestId });
        }
      }
      if (images.length === 0) {
        const firstErr = results.find((r) => r.status === "rejected")?.reason;
        if (firstErr?.code) {
          const status = firstErr.status || 500;
          if (isGenerationCanceledError(firstErr)) {
            finishCanceled = true;
            return fail(firstErr.status, {
              error: firstErr.message,
              code: firstErr.code,
              requestId,
            });
          }
          return fail(status, {
            error: firstErr.message,
            code: firstErr.code,
            ...upstreamErrorFields(firstErr),
            requestId,
          });
        }
        return fail(500, { error: "All generation attempts failed", code: "GENERATE_ALL_FAILED", requestId });
      }
      const elapsed = +((Date.now() - startTime) / 1000).toFixed(1);
      // Patch elapsed into sidecars after the generation loop (best effort).
      await Promise.all(
        images.map(async ({ filename }) => {
          try {
            const sidecarPath = join(ctx.config.storage.generatedDir, filename + ".json");
            const sidecarMeta = JSON.parse(await readFile(sidecarPath, "utf-8"));
            sidecarMeta.elapsed = elapsed;
            await atomicWriteJson(sidecarPath, sidecarMeta);
          } catch {
            /* best-effort elapsed patch */
          }
        }),
      );
      const firstRevised = images[0]?.revisedPrompt || null;
      const extra = {
        usage: totalUsage,
        provider: activeProvider,
        reasoningEffort,
        webSearchCalls: totalWebSearchCalls,
        quality,
        size: effectiveSize,
        moderation,
        model: imageModel,
        warnings: qualityWarnings,
        revisedPrompt: firstRevised,
        promptMode: normalizedPromptMode,
        webSearchEnabled,
        ...(firstRetryMeta || {}),
      };
      if (count === 1) {
        finishHttpStatus = 200;
        finishMeta = { filenames: [images[0].filename], imageCount: 1 };
        logEvent("generate", "saved", { requestId, imageCount: 1, elapsedMs: Date.now() - startTime, filename: images[0].filename, });
        succeed({
          image: images[0].image,
          elapsed,
          filename: images[0].filename,
          requestId,
          providerUrl: images[0].providerUrl ?? null,
          createdAt: images[0].createdAt,
          ...extra,
        });
      } else {
        finishHttpStatus = 200;
        finishMeta = { filenames: images.map((image) => image.filename), imageCount: images.length };
        logEvent("generate", "saved", { requestId, imageCount: images.length, elapsedMs: Date.now() - startTime, });
        succeed({ images, elapsed, count: images.length, requestId, ...extra });
      }
    } catch (e) {
      const err = errInfo(e);
      const ext = (err.raw && typeof err.raw === "object" ? err.raw as Record<string, unknown> : {});
      const fallbackCode = err.code || classifyUpstreamError(err.message);
      if (isGenerationCanceledError(err.raw) || isJobCanceled(requestId)) {
        const canceled = makeGenerationCanceledError();
        finishCanceled = true;
        return fail(canceled.status, {
          error: canceled.message,
          code: canceled.code,
          requestId,
        });
      }
      finishErrorCode = fallbackCode || "GENERATE_FAILED";
      logError("generate", "error", err.raw, { requestId, code: finishErrorCode });
      fail(err.status || 500, {
        error: err.message,
        code: finishErrorCode,
        ...upstreamErrorFields(ext),
        requestId,
      });
    } finally {
      if (jobOwned) finishJob(requestId, {
        canceled: finishCanceled,
        status: finishStatus,
        httpStatus: finishHttpStatus,
        errorCode: finishErrorCode,
        meta: finishMeta,
      });
      appendGenerationRequestLog(ctx.config.storage.generationRequestLogFile, {
        id: randomBytes(8).toString("hex"),
        requestId,
        createdAt: Date.now(),
        prompt: typeof req.body?.prompt === "string" ? req.body.prompt : "",
        requested: parseInt(req.body?.n) || 1,
        succeeded: finishStatus === "completed" ? ((finishMeta.imageCount as number) ?? 1) : 0,
        error: finishStatus === "error" ? (finishErrorCode ?? "unknown") : null,
      }).catch(() => {});
    }
}
