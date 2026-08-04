import { spawn } from "node:child_process";
import type { Express, Request, Response } from "express";
import { buildAgyPathEnv, resolveAgyBin } from "../lib/agyCli.js";
import {
  ATLASCLOUD_EDIT_MODEL,
  ATLASCLOUD_TEXT_TO_IMAGE_MODEL,
} from "../lib/atlasCloudImageAdapter.js";
import {
  MINIMAX_IMAGE_TO_IMAGE_MODEL,
  MINIMAX_TEXT_TO_IMAGE_MODEL,
} from "../lib/minimaxImageAdapter.js";
import {
  GROK_VIDEO_MODEL_15,
  GROK_VIDEO_MODEL_BASE,
  MAX_VIDEO_DURATION,
  MIN_VIDEO_DURATION,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_VIDEO_RESOLUTIONS,
} from "../lib/imageModels.js";
import {
  getProviderModels,
  type CatalogToolCaller,
  type McpModelCapabilities,
  type McpModelEntry,
  type McpProviderModels,
} from "../lib/mcp/modelsCatalog.js";
import {
  listProviders,
  type McpProviderDescriptor,
} from "../lib/mcp/providerRegistry.js";
import type { McpConnectionStatus } from "../lib/mcp/types.js";
import {
  requireRuntimeContext,
  type RouteRuntimeContext,
  type RuntimeContext,
} from "../lib/runtimeContext.js";

export type ModelLaneStatus = "ready" | "locked" | "disconnected" | "key-missing";
export type ModelLaneId =
  | "oauth" | "api" | "grok" | "grok-api" | "agy" | "gemini-api"
  | "atlascloud" | "minimax" | "runway" | "higgsfield";

export interface ModelLaneDto {
  status: ModelLaneStatus;
  reason?: string;
  defaults: { image?: string; video?: string };
  models: McpProviderModels;
}

interface ModelsRouteDeps {
  detectAgyInstalled?: () => Promise<boolean>;
}

type LaneState = { status: ModelLaneStatus; reason?: string };
type CatalogResult = { models: McpProviderModels; reason?: string; disconnected?: boolean };

const MCP_LANES = new Set<ModelLaneId>(["runway", "higgsfield"]);
const MCP_PROVIDER_FALLBACKS = listProviders([])
  .filter((provider) => MCP_LANES.has(provider.id as ModelLaneId));
let agyDetection: Promise<boolean> | null = null;

function emptyModels(): McpProviderModels {
  return { image: [], video: [] };
}

function capabilities(
  inputRoles: string[] = [],
  parameters: McpModelCapabilities["parameters"] = [],
  aspectRatios: string[] = [],
): McpModelCapabilities {
  return { source: "verified-contract", aspectRatios, parameters, inputRoles };
}

function entries(ids: Iterable<string>, caps?: McpModelCapabilities): McpModelEntry[] {
  return [...ids].map((id) => ({
    id,
    label: id,
    capabilities: caps
      ? { ...caps, aspectRatios: [...caps.aspectRatios], parameters: [...caps.parameters], inputRoles: [...caps.inputRoles] }
      : capabilities(["text", "image_references"]),
  }));
}

function videoCapabilities(): McpModelCapabilities {
  return capabilities(
    ["text", "start_image", "image_references"],
    [
      { name: "duration", type: "number", min: MIN_VIDEO_DURATION, max: MAX_VIDEO_DURATION },
      { name: "resolution", type: "string", options: [...VALID_VIDEO_RESOLUTIONS] },
    ],
    [...VALID_VIDEO_ASPECT_RATIOS],
  );
}

function lane(
  state: LaneState,
  defaults: ModelLaneDto["defaults"],
  models: McpProviderModels,
): ModelLaneDto {
  return {
    status: state.status,
    ...(state.reason ? { reason: state.reason } : {}),
    defaults,
    models,
  };
}

function oauthLane(ctx: RuntimeContext, image: McpModelEntry[]): ModelLaneDto {
  const ready = ctx.oauthReadyState === "ready";
  const reason = ready ? undefined : `oauth proxy ${ctx.oauthReadyState ?? "not ready"}`;
  return lane(
    { status: ready ? "ready" : "disconnected", ...(reason ? { reason } : {}) },
    { image: ctx.config.imageModels.default },
    { image, video: [] },
  );
}

function apiLane(ctx: RuntimeContext, image: McpModelEntry[]): ModelLaneDto {
  return lane(
    ctx.hasApiKey ? { status: "ready" } : { status: "key-missing", reason: "OpenAI API key missing" },
    { image: ctx.config.apiProvider.defaultImageModel },
    { image, video: [] },
  );
}

function grokLane(ctx: RuntimeContext): ModelLaneDto {
  const configured = Boolean(ctx.grokUrl);
  const state: LaneState = configured
    ? { status: "ready", reason: "configured proxy endpoint; live session not probed" }
    : { status: "disconnected", reason: "Grok proxy not configured" };
  return lane(state, {
    image: ctx.config.grokProvider.defaultImageModel,
    video: ctx.config.grokProvider.defaultVideoModel,
  }, {
    image: entries(["grok-imagine-image", "grok-imagine-image-quality"]),
    video: entries([GROK_VIDEO_MODEL_BASE, GROK_VIDEO_MODEL_15], videoCapabilities()),
  });
}

function grokApiLane(ctx: RuntimeContext): ModelLaneDto {
  const state: LaneState = ctx.xaiApiKey
    ? { status: "ready" }
    : { status: "key-missing", reason: "xAI API key missing" };
  const grok = grokLane(ctx);
  return lane(state, { ...grok.defaults }, grok.models);
}

function agyLane(installed: boolean): ModelLaneDto {
  const state: LaneState = installed
    ? { status: "ready", reason: "binary installed; login cannot be probed" }
    : { status: "disconnected", reason: "binary not installed" };
  return lane(state, { image: "nano-banana-2" }, {
    image: entries(["nano-banana-2", "nano-banana-pro"]), video: [],
  });
}

function geminiLane(ctx: RuntimeContext): ModelLaneDto {
  const configured = Boolean(ctx.geminiApiKey || ctx.vertexServiceAccountJson);
  const state: LaneState = configured
    ? { status: "ready" }
    : { status: "key-missing", reason: "Gemini API or Vertex credentials missing" };
  return lane(state, { image: "nano-banana-2" }, {
    image: entries(["nano-banana-2", "nano-banana-pro"]), video: [],
  });
}

function atlasCloudLane(ctx: RuntimeContext): ModelLaneDto {
  const state: LaneState = ctx.atlasCloudApiKey
    ? { status: "ready" }
    : { status: "key-missing", reason: "Atlas Cloud API key missing" };
  return lane(state, { image: ATLASCLOUD_TEXT_TO_IMAGE_MODEL }, {
    image: entries([ATLASCLOUD_TEXT_TO_IMAGE_MODEL, ATLASCLOUD_EDIT_MODEL]), video: [],
  });
}

function minimaxLane(ctx: RuntimeContext): ModelLaneDto {
  const state: LaneState = ctx.minimaxApiKey
    ? { status: "ready" }
    : { status: "key-missing", reason: "MiniMax API key missing" };
  return lane(state, { image: MINIMAX_TEXT_TO_IMAGE_MODEL }, {
    image: entries([MINIMAX_TEXT_TO_IMAGE_MODEL, MINIMAX_IMAGE_TO_IMAGE_MODEL]), video: [],
  });
}

function buildCoreLanes(ctx: RuntimeContext, agyInstalled: boolean) {
  const gptModels = entries(ctx.config.imageModels.valid);
  return {
    oauth: oauthLane(ctx, gptModels),
    api: apiLane(ctx, entries(ctx.config.imageModels.valid)),
    grok: grokLane(ctx),
    "grok-api": grokApiLane(ctx),
    agy: agyLane(agyInstalled),
    "gemini-api": geminiLane(ctx),
    atlascloud: atlasCloudLane(ctx),
    minimax: minimaxLane(ctx),
  };
}

function detectAgyInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    try {
      const child = spawn(resolveAgyBin(), ["--version"], {
        stdio: "ignore",
        env: { ...process.env, PATH: buildAgyPathEnv() },
      });
      child.on("error", () => done(false));
      child.on("exit", (code) => done(code === 0));
      timer = setTimeout(() => {
        try { if (!child.killed) child.kill(); } catch { /* best-effort timeout cleanup */ }
        done(false);
      }, 3000);
      timer.unref?.();
    } catch {
      done(false);
    }
  });
}

async function resolveAgyStatus(detector: () => Promise<boolean>): Promise<boolean> {
  try {
    return await detector();
  } catch {
    return false;
  }
}

function cachedAgyDetection(): Promise<boolean> {
  agyDetection ??= resolveAgyStatus(detectAgyInstalled);
  return agyDetection;
}

function mcpState(meta: McpProviderDescriptor, status: McpConnectionStatus): LaneState {
  if (!meta.executable) return { status: "locked", reason: meta.lockReason };
  if (!meta.enabled) return { status: "disconnected", reason: "provider disabled" };
  if (status.state === "connected") return { status: "ready" };
  return {
    status: "disconnected",
    reason: status.detail ?? `MCP connection ${status.state}`,
  };
}

function catalogCaller(ctx: RuntimeContext): CatalogToolCaller {
  const manager = ctx.mcpConnectionManager;
  if (!manager) {
    return () => Promise.reject(new Error("MCP_NOT_CONNECTED"));
  }
  return (provider, name, args, options) => manager.callTool(provider, name, args, options);
}

async function loadCatalog(
  meta: McpProviderDescriptor,
  ctx: RuntimeContext,
  connected: boolean,
): Promise<CatalogResult> {
  if (meta.catalogAccess === "connected" && (!meta.enabled || !connected)) {
    return { models: emptyModels() };
  }
  try {
    const models = await getProviderModels(meta.id, catalogCaller(ctx));
    return { models };
  } catch (error) {
    const code = String((error as Error)?.message ?? error).split(":")[0];
    return {
      models: emptyModels(),
      reason: code === "MCP_NOT_CONNECTED" ? "provider disconnected during catalog browse" : "model catalog unavailable",
      ...(code === "MCP_NOT_CONNECTED" ? { disconnected: true } : {}),
    };
  }
}

async function buildMcpLane(meta: McpProviderDescriptor, ctx: RuntimeContext): Promise<ModelLaneDto> {
  try {
    const connection = ctx.mcpConnectionManager?.status(meta.id)
      ?? { provider: meta.id, state: "disconnected" as const };
    const connected = connection.state === "connected";
    const catalog = await loadCatalog(meta, ctx, connected);
    const base = mcpState(meta, connection);
    const status = catalog.disconnected && base.status !== "locked" ? "disconnected" : base.status;
    const reason = meta.lockReason ?? catalog.reason ?? base.reason;
    return lane({ status, ...(reason ? { reason } : {}) }, { ...meta.defaults }, catalog.models);
  } catch {
    const state = meta.executable
      ? { status: "disconnected" as const, reason: "lane status unavailable" }
      : { status: "locked" as const, reason: meta.lockReason };
    return lane(state, { ...meta.defaults }, emptyModels());
  }
}

function fallbackMcpLanes(): Record<"runway" | "higgsfield", ModelLaneDto> {
  const entries = MCP_PROVIDER_FALLBACKS.map((meta) => {
    const state: LaneState = meta.executable
      ? { status: "disconnected", reason: "lane status unavailable" }
      : { status: "locked", reason: meta.lockReason };
    return [meta.id, lane(state, { ...meta.defaults }, emptyModels())] as const;
  });
  return Object.fromEntries(entries) as Record<"runway" | "higgsfield", ModelLaneDto>;
}

async function buildMcpLanes(ctx: RuntimeContext): Promise<Record<"runway" | "higgsfield", ModelLaneDto>> {
  try {
    const providers = listProviders(ctx.config.mcp.enabledProviders)
      .filter((provider) => MCP_LANES.has(provider.id as ModelLaneId));
    const built = await Promise.all(providers.map(async (provider) => {
      try {
        return [provider.id, await buildMcpLane(provider, ctx)] as const;
      } catch {
        const state: LaneState = provider.executable
          ? { status: "disconnected", reason: "lane status unavailable" }
          : { status: "locked", reason: provider.lockReason };
        return [provider.id, lane(state, { ...provider.defaults }, emptyModels())] as const;
      }
    }));
    return Object.fromEntries(built) as Record<"runway" | "higgsfield", ModelLaneDto>;
  } catch {
    return fallbackMcpLanes();
  }
}

export function registerModelsRoutes(
  app: Express,
  ctxRaw: RouteRuntimeContext,
  deps: ModelsRouteDeps = {},
) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.get("/api/models", async (_req: Request, res: Response) => {
    try {
      const [agyInstalled, mcp] = await Promise.all([
        resolveAgyStatus(deps.detectAgyInstalled ?? cachedAgyDetection),
        buildMcpLanes(ctx),
      ]);
      res.json({ ok: true, lanes: { ...buildCoreLanes(ctx, agyInstalled), ...mcp } });
    } catch {
      const mcp = await buildMcpLanes(ctx);
      res.json({ ok: true, lanes: { ...buildCoreLanes(ctx, false), ...mcp } });
    }
  });
}
