import { listJobs, listTerminalJobs, finishJob } from "../lib/inflight.js";

export function registerHealthRoutes(app, ctx) {
  const runtimePorts = () => ({
    backend: {
      configuredPort: Number(ctx.serverConfiguredPort || ctx.config.server.port),
      actualPort: Number(ctx.serverActualPort || ctx.config.server.port),
      url: ctx.serverUrl || `http://localhost:${ctx.serverActualPort || ctx.config.server.port}`,
    },
    oauth: {
      configuredPort: Number(ctx.oauthPort),
      actualPort: Number(ctx.oauthActualPort || ctx.oauthPort),
      url: ctx.oauthUrl,
      status: ctx.oauthReadyState,
    },
  });

  app.get("/api/providers", (_req, res) => {
    res.json({
      apiKey: false,
      oauth: true,
      oauthPort: ctx.oauthPort,
      oauthActualPort: ctx.oauthActualPort || ctx.oauthPort,
      oauthUrl: ctx.oauthUrl,
      apiKeyDisabled: true,
      runtime: runtimePorts(),
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      version: ctx.packageVersion,
      provider: "oauth",
      uptimeSec: Math.round(process.uptime()),
      activeJobs: listJobs().length,
      pid: process.pid,
      startedAt: ctx.startedAt,
      runtime: runtimePorts(),
    });
  });

  app.get("/api/oauth/status", async (_req, res) => {
    if (ctx.oauthReadyState === "starting") {
      return res.json({ status: "starting", runtime: runtimePorts() });
    }
    if (ctx.oauthReadyState === "failed") {
      return res.json({ status: "offline", runtime: runtimePorts() });
    }
    try {
      const r = await fetch(`${ctx.oauthUrl}/v1/models`, {
        signal: AbortSignal.timeout(ctx.config.oauth.statusTimeoutMs),
      });
      if (r.ok) {
        const data: any = await r.json();
        res.json({ status: "ready", models: data.data?.map((m) => m.id) || [], runtime: runtimePorts() });
      } else {
        res.json({ status: "auth_required", runtime: runtimePorts() });
      }
    } catch {
      res.json({ status: "offline", runtime: runtimePorts() });
    }
  });

  app.get("/api/inflight", (req, res) => {
    const kind =
      typeof req.query.kind === "string" && req.query.kind.length > 0
        ? req.query.kind
        : undefined;
    const sessionId =
      typeof req.query.sessionId === "string" && req.query.sessionId.length > 0
        ? req.query.sessionId
        : undefined;
    const includeTerminal =
      req.query.includeTerminal === "1" || req.query.includeTerminal === "true";
    const jobs = listJobs({ kind, sessionId });
    if (!includeTerminal) return res.json({ jobs });
    return res.json({
      jobs,
      terminalJobs: listTerminalJobs({ kind, sessionId }),
    });
  });

  app.delete("/api/inflight/:requestId", (req, res) => {
    finishJob(req.params.requestId, { canceled: true });
    res.status(204).end();
  });

  app.get("/api/billing", async (_req, res) => {
    if (!ctx.hasApiKey) {
      return res.json({ oauth: true, apiKeyValid: false, apiKeySource: "none" });
    }

    try {
      const headers = { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" };
      const start = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
      const end = Math.floor(Date.now() / 1000);
      const [subRes, usageRes, modelsRes] = await Promise.allSettled([
        fetch(`https://api.openai.com/v1/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d&limit=31`, { headers }),
        fetch("https://api.openai.com/dashboard/billing/credit_grants", { headers }),
        fetch("https://api.openai.com/v1/models", { headers }),
      ]);

      const billing: any = { apiKeySource: ctx.apiKeySource ?? "env" };
      if (subRes.status === "fulfilled" && subRes.value.ok) billing.costs = await subRes.value.json();
      if (usageRes.status === "fulfilled" && usageRes.value.ok) billing.credits = await usageRes.value.json();
      billing.apiKeyValid = modelsRes.status === "fulfilled" && modelsRes.value.ok === true;
      res.json(billing);
    } catch (err) {
      res.status(500).json({ error: err.message, apiKeyValid: false });
    }
  });
}
