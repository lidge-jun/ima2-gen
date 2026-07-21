import type { Express, Request, Response } from "express";
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { RuntimeContext } from "../lib/runtimeContext.js";
import { initVertexAuth, clearVertexAuth } from "../lib/vertexAuth.js";

// Atomic + 0600 config write: temp file then rename, so a crash or concurrent
// save can't corrupt config.json (which may hold API keys). Rename also forces
// 0600 perms even if a looser-perm config pre-existed.
async function writeConfigAtomic(cfgPath: string, data: unknown): Promise<void> {
  const tmp = `${cfgPath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, cfgPath);
}

let configMutationQueue: Promise<void> = Promise.resolve();

function serializeConfigMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = configMutationQueue.then(mutation, mutation);
  configMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function updateConfigFile(
  cfgPath: string,
  mutate: (config: Record<string, unknown>) => void,
): Promise<void> {
  await serializeConfigMutation(async () => {
    let existing: Record<string, unknown> = {};
    try { existing = JSON.parse(await readFile(cfgPath, "utf-8")); } catch { /* new file */ }
    mutate(existing);
    await writeConfigAtomic(cfgPath, existing);
  });
}

type KeyProvider = "openai" | "xai" | "gemini" | "atlascloud";

const KEY_PREFIX_MAP: Record<KeyProvider, string[]> = {
  openai: ["sk-"],
  xai: ["xai-"],
  gemini: ["AI"],
  atlascloud: ["apikey-"],
};

const VALIDATE_URL_MAP: Record<KeyProvider, string> = {
  openai: "https://api.openai.com/v1/models",
  xai: "https://api.x.ai/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  atlascloud: "https://api.atlascloud.ai/api/v1/models",
};

const CONFIG_KEY_MAP: Record<KeyProvider, string> = {
  openai: "apiKey",
  xai: "xaiApiKey",
  gemini: "geminiApiKey",
  atlascloud: "atlasCloudApiKey",
};

function isKeyProvider(v: string): v is KeyProvider {
  return v === "openai" || v === "xai" || v === "gemini" || v === "atlascloud";
}

function maskKey(key: string): string {
  if (key.length <= 10) return "***";
  return `${key.slice(0, 4)}..${key.slice(-2)}`;
}

function keySourceForProvider(ctx: RuntimeContext, provider: KeyProvider): { key: string | undefined; source: string } {
  if (provider === "openai") return { key: ctx.apiKey, source: ctx.apiKeySource || "none" };
  if (provider === "xai") return { key: ctx.xaiApiKey, source: ctx.xaiApiKeySource || "none" };
  if (provider === "gemini") return { key: ctx.geminiApiKey, source: ctx.geminiApiKeySource || "none" };
  if (provider === "atlascloud") return { key: ctx.atlasCloudApiKey, source: ctx.atlasCloudApiKeySource || "none" };
  return { key: undefined, source: "none" };
}

export function mountKeyRoutes(app: Express, ctx: RuntimeContext) {
  app.get("/api/keys/status", (_req: Request, res: Response) => {
    const status: Record<string, unknown> = {};
    for (const provider of ["openai", "xai", "gemini", "atlascloud"] as const) {
      const { key, source } = keySourceForProvider(ctx, provider);
      status[provider] = {
        configured: !!key,
        source,
        valid: !!key,
        maskedKey: key ? maskKey(key) : null,
      };
    }
    const vertexJson = ctx.vertexServiceAccountJson;
    const vertexSource = vertexJson
      ? (process.env.VERTEX_SERVICE_ACCOUNT_JSON ? "env" : "config")
      : "none";
    status.vertex = {
      configured: !!vertexJson,
      source: vertexSource,
      valid: !!vertexJson,
      maskedKey: ctx.vertexProjectId ? `project: ${ctx.vertexProjectId}` : null,
    };
    status.geminiAuthMode = (ctx as any).geminiAuthMode
      || (vertexJson && !ctx.geminiApiKey ? "vertex" : "apikey");
    res.json(status);
  });

  // Persist the Gemini auth mode chosen in the settings dropdown, so reopening
  // settings (or restarting the server) keeps the user's selection.
  app.put("/api/keys/gemini-auth-mode", async (req: Request, res: Response) => {
    const { mode } = req.body as { mode?: string };
    if (mode !== "apikey" && mode !== "vertex") {
      return res.status(400).json({ ok: false, error: "mode must be apikey|vertex", code: "INVALID_MODE" });
    }
    const cfgPath = ctx.config.storage.configFile;
    await updateConfigFile(cfgPath, (existing) => { existing.geminiAuthMode = mode; });
    (ctx as any).geminiAuthMode = mode;
    return res.json({ ok: true, geminiAuthMode: mode });
  });

  // Vertex JSON — dedicated route (before generic :provider)
  app.put("/api/keys/vertex", async (req: Request, res: Response) => {
    const { serviceAccountJson } = req.body as { serviceAccountJson?: string };
    if (!serviceAccountJson || typeof serviceAccountJson !== "string") {
      return res.status(400).json({ ok: false, error: "Missing serviceAccountJson", code: "MISSING_KEY" });
    }
    const trimmed = serviceAccountJson.trim();
    if (trimmed.length > 50 * 1024) {
      return res.status(400).json({ ok: false, error: "Service account JSON too large (max 50KB)", code: "KEY_TOO_LARGE" });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON", code: "INVALID_JSON" });
    }
    if (parsed.type !== "service_account" || !parsed.project_id) {
      return res.status(400).json({
        ok: false,
        error: "JSON must be a Google Cloud service account (type: service_account, project_id required)",
        code: "INVALID_SERVICE_ACCOUNT",
      });
    }

    // Validate by initializing auth (catches key format issues)
    try {
      initVertexAuth(trimmed);
    } catch {
      return res.status(400).json({ ok: false, error: "Service account validation failed", code: "KEY_VALIDATION_FAILED" });
    }

    // Save to config.json
    const cfgPath = ctx.config.storage.configFile;
    await updateConfigFile(cfgPath, (existing) => {
      existing.vertexServiceAccountJson = trimmed;
      existing.geminiAuthMode = "vertex";
    });

    // Hot-update runtime
    (ctx as any).vertexServiceAccountJson = trimmed;
    (ctx as any).vertexProjectId = parsed.project_id as string;
    (ctx as any).hasVertexKey = true;
    (ctx as any).geminiAuthMode = "vertex";

    return res.json({ ok: true, provider: "vertex", source: "config", valid: true, projectId: parsed.project_id });
  });

  app.delete("/api/keys/vertex", async (_req: Request, res: Response) => {
    const source = ctx.vertexServiceAccountJson
      ? (process.env.VERTEX_SERVICE_ACCOUNT_JSON ? "env" : "config")
      : "none";
    if (source === "env") {
      return res.status(400).json({ ok: false, error: "Cannot remove env-sourced key", code: "ENV_KEY_IMMUTABLE" });
    }

    const cfgPath = ctx.config.storage.configFile;
    await updateConfigFile(cfgPath, (existing) => { delete existing.vertexServiceAccountJson; });

    clearVertexAuth();
    (ctx as any).vertexServiceAccountJson = undefined;
    (ctx as any).vertexProjectId = undefined;
    (ctx as any).hasVertexKey = false;

    return res.json({ ok: true, provider: "vertex", removed: true });
  });

  app.put("/api/keys/:provider", async (req: Request<{ provider: string }>, res: Response) => {
    const { provider } = req.params;
    if (!isKeyProvider(provider)) {
      return res.status(400).json({ ok: false, error: "Invalid provider", code: "INVALID_PROVIDER" });
    }
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Missing apiKey", code: "MISSING_KEY" });
    }
    const trimmed = apiKey.trim();
    if (trimmed.length > 512) {
      return res.status(400).json({ ok: false, error: "API key too large", code: "KEY_TOO_LARGE" });
    }

    // Format check
    const validPrefix = KEY_PREFIX_MAP[provider].some((p) => trimmed.startsWith(p));
    if (!validPrefix) {
      return res.status(400).json({
        ok: false,
        error: `Invalid key format for ${provider}: expected prefix ${KEY_PREFIX_MAP[provider].join(" or ")}`,
        code: "INVALID_KEY_FORMAT",
      });
    }

    // Validate against provider API
    try {
      const url = VALIDATE_URL_MAP[provider];
      const opts: RequestInit = { signal: AbortSignal.timeout(10_000) };
      if (provider === "gemini") {
        opts.headers = { "x-goog-api-key": trimmed };
        const validateRes = await fetch(url, opts);
        if (!validateRes.ok) throw new Error(`HTTP ${validateRes.status}`);
      } else {
        opts.headers = { Authorization: `Bearer ${trimmed}` };
        const validateRes = await fetch(url, opts);
        if (!validateRes.ok) throw new Error(`HTTP ${validateRes.status}`);
      }
    } catch (e: any) {
      return res.status(400).json({
        ok: false,
        error: `API key validation failed: ${e.message || "unknown"}`,
        code: "KEY_VALIDATION_FAILED",
      });
    }

    // Save to config.json
    const cfgPath = ctx.config.storage.configFile;
    await updateConfigFile(cfgPath, (existing) => {
      existing[CONFIG_KEY_MAP[provider]] = trimmed;
      if (provider === "gemini") existing.geminiAuthMode = "apikey";
    });

    // Hot-update runtime context
    if (provider === "openai") {
      (ctx as any).apiKey = trimmed;
      (ctx as any).apiKeySource = "config";
      (ctx as any).hasApiKey = true;
      try {
        const OpenAI = (await import("openai")).default;
        (ctx as any).openai = new OpenAI({ apiKey: trimmed });
      } catch { /* ignore */ }
    } else if (provider === "xai") {
      (ctx as any).xaiApiKey = trimmed;
      (ctx as any).xaiApiKeySource = "config";
      (ctx as any).hasXaiApiKey = true;
    } else if (provider === "gemini") {
      (ctx as any).geminiApiKey = trimmed;
      (ctx as any).geminiApiKeySource = "config";
      (ctx as any).hasGeminiApiKey = true;
      (ctx as any).geminiAuthMode = "apikey";
    } else if (provider === "atlascloud") {
      (ctx as any).atlasCloudApiKey = trimmed;
      (ctx as any).atlasCloudApiKeySource = "config";
      (ctx as any).hasAtlasCloudApiKey = true;
    }

    return res.json({ ok: true, provider, source: "config", valid: true });
  });

  app.delete("/api/keys/:provider", async (req: Request<{ provider: string }>, res: Response) => {
    const { provider } = req.params;
    if (!isKeyProvider(provider)) {
      return res.status(400).json({ ok: false, error: "Invalid provider", code: "INVALID_PROVIDER" });
    }
    const { source } = keySourceForProvider(ctx, provider);
    if (source === "env") {
      return res.status(400).json({ ok: false, error: "Cannot remove env-sourced key", code: "ENV_KEY_IMMUTABLE" });
    }

    // Remove from config.json
    const cfgPath = ctx.config.storage.configFile;
    await updateConfigFile(cfgPath, (existing) => { delete existing[CONFIG_KEY_MAP[provider]]; });

    // Clear runtime
    if (provider === "openai") {
      (ctx as any).apiKey = undefined;
      (ctx as any).apiKeySource = "none";
      (ctx as any).hasApiKey = false;
      (ctx as any).openai = null;
    } else if (provider === "xai") {
      (ctx as any).xaiApiKey = undefined;
      (ctx as any).xaiApiKeySource = "none";
      (ctx as any).hasXaiApiKey = false;
    } else if (provider === "gemini") {
      (ctx as any).geminiApiKey = undefined;
      (ctx as any).geminiApiKeySource = "none";
      (ctx as any).hasGeminiApiKey = false;
    } else if (provider === "atlascloud") {
      (ctx as any).atlasCloudApiKey = undefined;
      (ctx as any).atlasCloudApiKeySource = "none";
      (ctx as any).hasAtlasCloudApiKey = false;
    }

    return res.json({ ok: true, provider, removed: true });
  });
}
