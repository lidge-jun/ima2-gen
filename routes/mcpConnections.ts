// MCP provider connection routes (030 WP3). Secret-free responses only.
// GET /api/mcp/oauth/callback is exempted from the LAN token guard in server.ts;
// its security boundary is the single-use OAuth state (manager pendingAuth).
import type { Express, Request, Response } from "express";
import { McpConnectionManager } from "../lib/mcp/connectionManager.js";
import { listProviders } from "../lib/mcp/providerRegistry.js";
import { resolveProviderEndpoint } from "../lib/mcp/providerRegistry.js";
import { getProviderModels } from "../lib/mcp/modelsCatalog.js";
import { ingestLiveTools } from "../lib/mcp/snapshotPipeline.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

function typedError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function errorCode(error: unknown): string {
  return String((error as Error)?.message ?? error).split(":")[0] ?? "UNKNOWN";
}

/** Connect/refresh success path (040): capture live tools -> snapshot ingest ->
 *  attach the diff summary to the connection status. Failures degrade to a
 *  detail-free status (ingest is best-effort; connection stays usable). */
async function ingestAfterConnect(
  manager: McpConnectionManager,
  ctx: ReturnType<typeof requireRuntimeContext>,
  provider: string,
): Promise<void> {
  try {
    const identity = manager.connectionIdentity(provider);
    const listing = await manager.listTools(provider);
    const { diff } = await ingestLiveTools({
      listing,
      endpoint: resolveProviderEndpoint(provider, ctx.config.mcp.enabledProviders),
      entitlementTag: "user-oauth-account",
      snapshotDir: ctx.config.mcp.snapshotDir,
      packageRoot: ctx.config.storage.packageRoot,
      isCurrent: () => {
        const current = manager.connectionIdentity(provider);
        return Boolean(identity && current && identity.generation === current.generation && identity.epoch === current.epoch);
      },
    });
    manager.attachSnapshotDiff(provider, identity, diff);
  } catch {
    /* snapshot ingest is best-effort; connection status remains authoritative */
  }
}

function httpForState(state: ReturnType<McpConnectionManager["status"]>["state"]): number {
  const codes = { connected: 200, auth_required: 202, connecting: 202, disconnected: 409, offline: 503, error: 502 } as const;
  return codes[state];
}

function sendConnectionStatus(res: Response, status: ReturnType<McpConnectionManager["status"]>) {
  return res.status(httpForState(status.state)).json({ ok: status.state === "connected", status });
}

export function registerMcpConnectionRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  const manager = (ctx.mcpConnectionManager ??= new McpConnectionManager({
    enabledProviders: ctx.config.mcp.enabledProviders,
    tokenDir: ctx.config.mcp.tokenDir,
    // Live origin, resolved lazily AFTER listen (audit round 1 blocker 1).
    getOrigin: () => `http://localhost:${ctx.serverActualPort ?? ctx.serverConfiguredPort}`,
  }));

  app.get("/api/mcp/providers", (_req: Request, res: Response) => {
    const providers = listProviders(ctx.config.mcp.enabledProviders)
      .map(({ id, endpoint, enabled, executable, lockReason }) => ({
        id,
        endpoint,
        enabled,
        executable,
        ...(lockReason ? { lockReason } : {}),
        status: manager.status(id),
      }));
    res.json({ ok: true, providers });
  });

  app.get("/api/mcp/providers/:id/status", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const descriptor = listProviders(ctx.config.mcp.enabledProviders).find((entry) => entry.id === id);
    if (!descriptor) return typedError(res, 404, "MCP_PROVIDER_UNKNOWN", "Unknown MCP provider");
    if (!descriptor.enabled) return typedError(res, 409, "MCP_PROVIDER_DISABLED", "MCP provider is disabled");
    res.json({ ok: true, status: manager.status(id) });
  });

  // 040 — provider model catalog. Read-only: the resolver can only ever call
  // models_explore (READONLY_CATALOG_TOOL); no request field reaches the tool
  // name. Request abort propagates upstream (audit R1-4).
  app.get("/api/mcp/providers/:id/models", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!ctx.config.mcp.enabledProviders.includes(id)) {
      typedError(res, 404, "MCP_PROVIDER_UNKNOWN", `unknown provider: ${id}`);
      return;
    }
    const abort = new AbortController();
    const onClose = () => abort.abort();
    req.on("close", onClose);
    try {
      const models = await getProviderModels(
        id,
        (provider, name, args, options) => manager.callTool(provider, name, args, options),
        { signal: abort.signal },
      );
      res.json({ ok: true, models });
    } catch (error) {
      const code = errorCode(error);
      if (code === "MCP_NOT_CONNECTED") {
        typedError(res, 409, code, "Provider is not connected");
      } else if (code === "MCP_PROVIDER_UNKNOWN") {
        typedError(res, 404, code, `unknown provider: ${id}`);
      } else {
        typedError(res, 502, "MCP_UPSTREAM_ERROR", "Model catalog fetch failed");
      }
    } finally {
      req.off("close", onClose);
    }
  });

  app.post("/api/mcp/providers/:id/connect", async (req: Request, res: Response) => {
    try {
      const status = await manager.connect(String(req.params.id));
      if (status.state === "connected") await ingestAfterConnect(manager, ctx, String(req.params.id));
      sendConnectionStatus(res, manager.status(String(req.params.id)));
    } catch (error) {
      typedError(res, 400, errorCode(error), "MCP connect failed");
    }
  });

  app.get("/api/mcp/oauth/callback", async (req: Request, res: Response) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!state || !code) return typedError(res, 400, "MCP_OAUTH_CALLBACK_INVALID", "state and code are required");
    try {
      const status = await manager.handleOAuthCallback(state, code);
      if (status.state === "connected") await ingestAfterConnect(manager, ctx, status.provider);
      const final = manager.status(status.provider);
      if (final.state !== "connected") return res.status(httpForState(final.state)).type("html").send(`<h2>ima2: 연결을 완료하지 못했습니다.</h2>`);
      res.type("html").send(`<h2>ima2: ${final.provider} 연결 완료. 이 창은 닫아도 됩니다.</h2>`);
    } catch (error) {
      typedError(res, 400, errorCode(error), "OAuth callback rejected");
    }
  });

  app.post("/api/mcp/providers/:id/refresh", async (req: Request, res: Response) => {
    try {
      const status = await manager.refresh(String(req.params.id));
      if (status.state === "connected") await ingestAfterConnect(manager, ctx, String(req.params.id));
      sendConnectionStatus(res, manager.status(String(req.params.id)));
    } catch (error) {
      typedError(res, 400, errorCode(error), "MCP refresh failed");
    }
  });

  app.delete("/api/mcp/providers/:id/connection", async (req: Request, res: Response) => {
    try {
      const status = await manager.disconnect(String(req.params.id));
      res.json({ ok: true, status, note: "local tokens cleared; provider-side grant is not revoked" });
    } catch (error) {
      typedError(res, 400, errorCode(error), "MCP disconnect failed");
    }
  });
}
