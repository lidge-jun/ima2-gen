import type { Express } from "express";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { getGrokProxyBaseUrl, getGrokProxyUrl } from "../lib/grokRuntime.js";

export function registerGrokRoutes(app: Express, ctx: RouteRuntimeContext) {
  app.get("/api/grok/status", async (_req, res) => {
    const grokCfg = (ctx.config as any).grokProvider || {};
    const timeoutMs = grokCfg.statusTimeoutMs || 3000;
    // Captured BEFORE the await: a response that outlives its child must not be
    // able to promote a dead proxy back to ready.
    const token = ctx.grokProxy?.probeToken();
    try {
      const r = await fetch(getGrokProxyUrl(ctx, "/v1/models"), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.ok) {
        const data: any = await r.json();
        const models: string[] = data?.data?.map((m: any) => m.id).filter(Boolean) || [];
        const hasImageModel = models.some((m: string) => m.startsWith("grok-imagine"));
        // A live 200 is stronger evidence than stdout parsing, which only
        // recognizes 127.0.0.1/localhost and so can strand a custom host.
        if (token) ctx.grokProxy?.markProbedReady(token, getGrokProxyBaseUrl(ctx));
        return res.json({ status: hasImageModel ? "ready" : "no_image_model", models });
      }
      return res.json({ status: "error", reason: `HTTP ${r.status}`, state: ctx.grokProxy?.state });
    } catch {
      // Deliberately does NOT call ensure(): the UI polls every 10s while not
      // ready, so self-healing here would spawn a child per poll forever.
      // Recovery is driven by the login event only.
      return res.json({ status: "offline", state: ctx.grokProxy?.state });
    }
  });
}
