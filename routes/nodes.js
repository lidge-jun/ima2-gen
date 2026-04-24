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
import { generateViaOAuth, editViaOAuth } from "../lib/oauthProxy.js";
import { getStyleSheet } from "../lib/sessionStore.js";
import { renderStyleSheetPrefix } from "../lib/styleSheet.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

export function registerNodeRoutes(app, ctx) {
  app.post("/api/node/generate", async (req, res) => {
    const body = req.body || {};
    const parentNodeId = body.parentNodeId ?? null;
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const clientNodeId = typeof body.clientNodeId === "string" ? body.clientNodeId : null;
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
      } = body;
      const { provider = "oauth" } = body;
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";

      if (provider === "api") {
        return res.status(403).json({
          error: { code: "APIKEY_DISABLED", message: "API key provider is disabled. Use OAuth." },
          parentNodeId,
        });
      }
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
          error: { code: "INVALID_PROMPT", message: "Prompt is required" },
          parentNodeId,
        });
      }
      const refCheck = validateAndNormalizeRefs(references);
      if (refCheck.error) {
        return res.status(400).json({
          error: { code: refCheck.code, message: refCheck.error },
          code: refCheck.code,
          parentNodeId,
        });
      }
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) {
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
        parentB64 = await loadNodeB64(ctx.rootDir, `${parentNodeId}.png`);
      } else if (typeof externalSrc === "string" && externalSrc.length > 0) {
        parentB64 = await loadAssetB64(ctx.rootDir, externalSrc);
      }

      let b64, usage, webSearchCalls = 0, revisedPrompt = null;
      const MAX_RETRIES = 1;
      let lastErr;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const r = parentB64
            ? await editViaOAuth(effectivePrompt, parentB64, quality, size, moderation, normalizedPromptMode, ctx)
            : await generateViaOAuth(effectivePrompt, quality, size, moderation, refCheck.refs, requestId, normalizedPromptMode, ctx);
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
        if (attempt < MAX_RETRIES) console.log(`[node] retry ${attempt + 1}: ${lastErr?.message}`);
      }

      if (!b64) {
        return res.status(422).json({
          error: { code: "SAFETY_REFUSAL", message: lastErr?.message || "Empty response after retry" },
          parentNodeId,
        });
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
        createdAt: Date.now(),
        createdAtIso: new Date().toISOString(),
        elapsed,
        usage: usage || null,
        webSearchCalls,
        provider: "oauth",
        kind: parentB64 ? "edit" : "generate",
        quality,
        size,
        format,
        moderation,
      };
      await mkdir(ctx.config.storage.generatedDir, { recursive: true });
      const { filename } = await saveNode(ctx.rootDir, { nodeId, b64, meta, ext: format });

      res.json({
        nodeId,
        parentNodeId,
        requestId,
        image: `data:image/${format === "jpeg" ? "jpeg" : format};base64,${b64}`,
        filename,
        url: `/generated/${filename}`,
        elapsed,
        usage,
        webSearchCalls,
        provider: "oauth",
        moderation,
        warnings: qualityWarnings,
        revisedPrompt,
        promptMode: normalizedPromptMode,
      });
    } catch (err) {
      console.error("[node/generate] error:", err.message);
      const code = err.code || classifyUpstreamError(err.message) || "NODE_GEN_FAILED";
      res.status(err.status || 500).json({
        error: { code, message: err.message },
        parentNodeId,
      });
    } finally {
      finishJob(requestId);
    }
  });

  app.get("/api/node/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      const meta = await loadNodeMeta(ctx.rootDir, nodeId);
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
