import { spawn } from "node:child_process";
import type { Express, Request, Response } from "express";
import { buildAgyPathEnv, resolveAgyBin } from "../lib/agyCli.js";
import { ATLASCLOUD_TEXT_TO_IMAGE_MODEL } from "../lib/atlasCloudImageAdapter.js";
import { MINIMAX_TEXT_TO_IMAGE_MODEL } from "../lib/minimaxImageAdapter.js";
import { getProviderAdapter } from "../lib/providers/adapters/index.js";
import {
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
import { deriveModels } from "../lib/providers/derive.js";
import { listWorkflows } from "../lib/comfyWorkflowStore.js";
import { probeComfyOrigins } from "../lib/comfyImageAdapter.js";
import type { CoreProviderId } from "../lib/providers/registry.js";
import {
  requireRuntimeContext,
  type RouteRuntimeContext,
  type RuntimeContext,
} from "../lib/runtimeContext.js";

export type ModelLaneStatus = "ready" | "locked" | "disconnected" | "key-missing";
export type ModelLaneId = CoreProviderId | "runway" | "higgsfield";

export interface ModelLaneDto {
  status: ModelLaneStatus;
  reason?: string;
  defaults: { image?: string; video?: string };
  models: McpProviderModels;
}

interface ModelsRouteDeps {
  detectAgyInstalled?: () => Promise<boolean>;
}

type LaneState = { status: ModelLaneStatus; reason?: string | undefined };
type CatalogResult = { models: McpProviderModels; reason?: string | undefined; disconnected?: boolean | undefined };

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

const UNPROBED_GROK_REASON = "configured proxy endpoint; live session not probed";

/**
 * Lane status follows the supervisor instead of the mere existence of a URL
 * string, so /api/models and /api/grok/status can no longer disagree.
 *
 * Transient states (starting/backoff/re-armed) keep the legacy optimistic
 * answer on purpose: flickering the lane during a few hundred ms of boot or a
 * bounded retry is noise, not honesty. Only settled-bad states go disconnected.
 */
function grokLaneState(ctx: RuntimeContext): LaneState {
  if (!ctx.grokUrl) return { status: "disconnected", reason: "Grok proxy not configured" };
  switch (ctx.grokProxy?.state) {
    case "ready":
      return { status: "ready" };
    case "starting":
      return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "backoff":
      return { status: "disconnected", reason: "Grok proxy restarting" };
    case "gave-up-retryable":
      return { status: "ready", reason: UNPROBED_GROK_REASON };
    case "waiting-for-login":
      return { status: "disconnected", reason: "Grok login required" };
    case "gave-up":
      return { status: "disconnected", reason: "Grok proxy failed to start" };
    case "stopped":
      return { status: "disconnected", reason: "Grok proxy stopped" };
    default:
      // No supervisor (autoStart off, or a test context): legacy contract.
      return { status: "ready", reason: UNPROBED_GROK_REASON };
  }
}

function grokLane(ctx: RuntimeContext): ModelLaneDto {
  const state = grokLaneState(ctx);
  return lane(state, {
    image: ctx.config.grokProvider.defaultImageModel,
    video: ctx.config.grokProvider.defaultVideoModel,
  }, {
    image: entries(deriveModels("grok", "image")),
    video: entries(
      [...deriveModels("grok", "video")].filter((model) => model !== "grok-imagine-video-1.5-preview"),
      videoCapabilities(),
    ),
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
    image: entries(deriveModels("agy", "image")), video: [],
  });
}

function geminiLane(ctx: RuntimeContext): ModelLaneDto {
  const configured = Boolean(ctx.geminiApiKey || ctx.vertexServiceAccountJson);
  const state: LaneState = configured
    ? { status: "ready" }
    : { status: "key-missing", reason: "Gemini API or Vertex credentials missing" };
  return lane(state, { image: "nano-banana-2" }, {
    image: entries(deriveModels("gemini-api", "image")), video: [],
  });
}

function atlasCloudLane(ctx: RuntimeContext): ModelLaneDto {
  // #150 phase 2: Atlas Cloud is the second lane behind ProviderAdapterV1.
  // The adapter owns auth state and the model list; the DTO projection stays
  // here, so /api/models keeps its exact shape.
  const adapter = getProviderAdapter(ctx, "atlascloud");
  if (!adapter) {
    const fallback: LaneState = ctx.atlasCloudApiKey
      ? { status: "ready" }
      : { status: "key-missing", reason: "Atlas Cloud API key missing" };
    return lane(fallback, { image: ATLASCLOUD_TEXT_TO_IMAGE_MODEL }, {
      image: entries(deriveModels("atlascloud", "image")), video: [],
    });
  }
  const auth = adapter.validateAuth();
  const state: LaneState = auth.ok
    ? { status: "ready" }
    : { status: "key-missing", reason: auth.reason ?? "Atlas Cloud API key missing" };
  return lane(state, { image: ATLASCLOUD_TEXT_TO_IMAGE_MODEL }, {
    image: entries(adapter.listModels().map((model) => model.id)), video: [],
  });
}

function minimaxLane(ctx: RuntimeContext): ModelLaneDto {
  // #150 phase 1: MiniMax is the reference lane behind ProviderAdapterV1. The
  // adapter owns auth state and the model list; the DTO projection stays here,
  // so /api/models keeps its exact shape.
  const adapter = getProviderAdapter(ctx, "minimax");
  if (!adapter) {
    const fallback: LaneState = ctx.minimaxApiKey
      ? { status: "ready" }
      : { status: "key-missing", reason: "MiniMax API key missing" };
    return lane(fallback, { image: MINIMAX_TEXT_TO_IMAGE_MODEL }, {
      image: entries(deriveModels("minimax", "image")), video: [],
    });
  }
  const auth = adapter.validateAuth();
  const state: LaneState = auth.ok
    ? { status: "ready" }
    : { status: "key-missing", reason: auth.reason ?? "MiniMax API key missing" };
  return lane(state, { image: MINIMAX_TEXT_TO_IMAGE_MODEL }, {
    image: entries(adapter.listModels().map((model) => model.id)), video: [],
  });
}

/**
 * The comfy lane, whose catalog and liveness both come from runtime state.
 *
 * The lane status folds the way grokLaneState does, but partial availability is
 * normal here in a way it is not for a hosted provider: 8188 can be up while
 * 8189 is down, and marking the whole lane disconnected would hide four usable
 * workflows because of one dead box. So the lane stays ready while each
 * workflow carries its own liveness in its description.
 */
async function comfyLane(ctx: RuntimeContext): Promise<ModelLaneDto> {
  const workflows = await listWorkflows();
  if (workflows.length === 0) {
    return lane(
      { status: "disconnected", reason: "No ComfyUI workflow registered" },
      {},
      { image: [], video: [] },
    );
  }
  const health = await probeComfyOrigins(
    workflows.map((workflow) => workflow.origin),
    ctx.config.comfy.healthTimeoutMs,
  );
  const liveness = [...health.values()];
  const anyLive = liveness.some((entry) => entry.ok);
  const allLive = liveness.every((entry) => entry.ok);
  const state: LaneState = anyLive
    ? { status: "ready", ...(allLive ? {} : { reason: "Some ComfyUI instances are offline" }) }
    : { status: "disconnected", reason: "No ComfyUI instance responded" };
  const first = workflows[0]!;
  return lane(state, { image: first.id }, {
    image: workflows.map((workflow) => ({
      id: workflow.id,
      label: workflow.label,
      description: health.get(workflow.origin)?.ok
        ? workflow.origin
        : `${workflow.origin} (offline)`,
      capabilities: {
        source: "verified-contract" as const,
        aspectRatios: [],
        parameters: [],
        inputRoles: workflow.bind.refImage ? ["text", "image_references"] : ["text"],
      },
    })),
    video: [],
  });
}

async function buildCoreLanes(ctx: RuntimeContext, agyInstalled: boolean) {
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
    comfy: await comfyLane(ctx),
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
      res.json({ ok: true, lanes: { ...(await buildCoreLanes(ctx, agyInstalled)), ...mcp } });
    } catch {
      const mcp = await buildMcpLanes(ctx);
      res.json({ ok: true, lanes: { ...(await buildCoreLanes(ctx, false)), ...mcp } });
    }
  });
}
