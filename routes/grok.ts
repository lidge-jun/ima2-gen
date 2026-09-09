import type { Express } from "express";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { fetchWithGrokAuth, getGrokEndpoint } from "../lib/grokRuntime.js";

/**
 * The status probe now asks api.x.ai directly with the stored OAuth session, so it
 * reports on the credential the generation lane actually uses. There is no local child
 * to promote or restart, which is why the old probe token and proxy state are gone; the
 * four status literals stay unchanged because the UI switches on them.
 */
function statusFromError(error: unknown): { status: string; reason?: string } {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "GROK_AUTH_REQUIRED") return { status: "offline", reason: "login_required" };
  if (code === "GROK_AUTH_REFRESH_FAILED") {
    const message = error instanceof Error ? error.message : "token refresh failed";
    return { status: "error", reason: message };
  }
  return { status: "offline" };
}

export function registerGrokRoutes(app: Express, ctx: RouteRuntimeContext) {
  app.get("/api/grok/status", async (_req, res) => {
    const timeoutMs = ctx.config?.grokProvider?.statusTimeoutMs ?? 3000;
    try {
      const r = await fetchWithGrokAuth(ctx, "grok", (credential) => {
        const { url, headers } = getGrokEndpoint("/v1/models", credential);
        return fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      });
      if (r.ok) {
        const data = await r.json() as { data?: { id?: unknown }[] };
        const models: string[] = (data?.data ?? []).map((m) => m?.id).filter((id): id is string => typeof id === "string" && id.length > 0);
        const hasImageModel = models.some((m) => m.startsWith("grok-imagine"));
        return res.json({ status: hasImageModel ? "ready" : "no_image_model", models });
      }
      return res.json({ status: "error", reason: `HTTP ${r.status}` });
    } catch (error) {
      return res.json(statusFromError(error));
    }
  });
}
