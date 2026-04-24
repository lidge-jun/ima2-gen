import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { editViaOAuth } from "../lib/oauthProxy.js";
import { classifyUpstreamError } from "../lib/errorClassify.js";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";
import { getStyleSheet } from "../lib/sessionStore.js";
import { renderStyleSheetPrefix } from "../lib/styleSheet.js";

function validateModeration(ctx, moderation) {
  if (typeof moderation !== "string" || !ctx.config.oauth.validModeration.has(moderation)) {
    return { error: "moderation must be one of: auto, low" };
  }
  return { moderation };
}

export function registerEditRoutes(app, ctx) {
  app.post("/api/edit", async (req, res) => {
    try {
      const {
        prompt,
        image: imageB64,
        quality: rawQuality = "medium",
        size = "1024x1024",
        moderation = "low",
        provider = "oauth",
        mode: promptMode = "auto",
      } = req.body;
      const { quality, warnings: qualityWarnings } = normalizeOAuthParams({ provider, quality: rawQuality });
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
      const normalizedPromptMode = promptMode === "direct" ? "direct" : "auto";

      if (!prompt || !imageB64) return res.status(400).json({ error: "Prompt and image are required" });
      const moderationCheck = validateModeration(ctx, moderation);
      if (moderationCheck.error) return res.status(400).json({ error: moderationCheck.error });
      if (provider === "api") {
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

      console.log(`[edit][${req.get("x-ima2-client") || "ui"}] provider=oauth quality=${quality} size=${size} moderation=${moderation}${styleSheetApplied ? " +styleSheet" : ""}`);
      const startTime = Date.now();
      const { b64: resultB64, usage, revisedPrompt } = await editViaOAuth(
        effectivePrompt,
        imageB64,
        quality,
        size,
        moderation,
        normalizedPromptMode,
        ctx,
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
        format: "png",
        provider: "oauth",
        kind: "edit",
        createdAt: Date.now(),
        usage: usage || null,
        webSearchCalls: 0,
      };
      await writeFile(join(ctx.config.storage.generatedDir, filename + ".json"), JSON.stringify(meta)).catch(() => {});

      res.json({
        image: `data:image/png;base64,${resultB64}`,
        elapsed,
        filename,
        usage,
        provider: "oauth",
        moderation,
        warnings: qualityWarnings,
        revisedPrompt: revisedPrompt || null,
        promptMode: normalizedPromptMode,
      });
    } catch (err) {
      console.error("Edit error:", err.message);
      const fallbackCode = err.code || classifyUpstreamError(err.message);
      res.status(err.status || 500).json({ error: err.message, code: fallbackCode });
    }
  });
}
