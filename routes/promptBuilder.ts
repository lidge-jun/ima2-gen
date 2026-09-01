import type { Express, Request, Response } from "express";
import { updateConfigFileAtomic } from "../lib/configFileStore.js";
import { errInfo } from "../lib/errInfo.js";
import { logError } from "../lib/logger.js";
import { requestPromptBuilderChat } from "../lib/promptBuilder/client.js";
import {
  PROMPT_BUILDER_AUTO_ORDER,
  PROMPT_BUILDER_BACKENDS,
  PROMPT_BUILDER_MODELS,
} from "../lib/promptBuilder/constants.js";
import { promptBuilderError } from "../lib/promptBuilder/errors.js";
import { normalizePromptBuilderConfig } from "../lib/promptBuilder/requestSchema.js";
import {
  requireRuntimeContext,
  type RouteRuntimeContext,
  type RuntimeContext,
} from "../lib/runtimeContext.js";
import { buildLaneSummary } from "./models.js";

function configLocks() {
  return {
    backend: process.env.IMA2_PROMPT_BUILDER_BACKEND !== undefined,
    model: process.env.IMA2_PROMPT_BUILDER_MODEL !== undefined,
  };
}

function configPayload(ctx: RuntimeContext) {
  return {
    ...ctx.config.promptBuilder,
    options: {
      backends: [...PROMPT_BUILDER_BACKENDS],
      models: PROMPT_BUILDER_MODELS,
      autoOrder: [...PROMPT_BUILDER_AUTO_ORDER],
    },
    locked: configLocks(),
  };
}

function sendPromptBuilderError(res: Response, error: unknown): void {
  const info = errInfo(error);
  const unreadable = info.code === "CONFIG_UNREADABLE";
  const code = unreadable
    ? "PROMPT_BUILDER_CONFIG_UNREADABLE"
    : info.code ?? "PROMPT_BUILDER_UNKNOWN";
  const status = unreadable
    ? 500
    : typeof info.status === "number" && info.status >= 400 ? info.status : 500;
  logError("prompt-builder", code, error, { status });
  res.status(status).json({ error: { code, message: info.message } });
}

async function savePromptBuilderConfig(
  ctx: RuntimeContext,
  raw: unknown,
): Promise<void> {
  const current = ctx.config.promptBuilder;
  const next = normalizePromptBuilderConfig(raw, current);
  const locked = configLocks();
  if ((locked.backend && next.backend !== current.backend)
    || (locked.model && next.model !== current.model)) {
    throw promptBuilderError(
      "Prompt Builder config is managed by environment variables",
      "PROMPT_BUILDER_CONFIG_ENV_LOCKED",
      409,
    );
  }
  await updateConfigFileAtomic(ctx.config.storage.configFile, (existing) => {
    const saved = existing.promptBuilder;
    const base = saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved as Record<string, unknown>
      : {};
    existing.promptBuilder = { ...base, ...next };
  });
  ctx.config.promptBuilder.backend = next.backend;
  ctx.config.promptBuilder.model = next.model;
}

export function registerPromptBuilderRoutes(
  app: Express,
  ctxRaw: RouteRuntimeContext,
) {
  const ctx = requireRuntimeContext(ctxRaw);

  app.get("/api/prompt-builder/config", (_req: Request, res: Response) => {
    res.json(configPayload(ctx));
  });

  app.put("/api/prompt-builder/config", async (req: Request, res: Response) => {
    try {
      await savePromptBuilderConfig(ctx, req.body);
      res.json(configPayload(ctx));
    } catch (error) {
      sendPromptBuilderError(res, error);
    }
  });

  app.post("/api/prompt-builder/chat", async (req: Request, res: Response) => {
    try {
      const lanes = await buildLaneSummary(ctx);
      const result = await requestPromptBuilderChat(ctx, req.body, lanes);
      res.json(result);
    } catch (error) {
      sendPromptBuilderError(res, error);
    }
  });
}
