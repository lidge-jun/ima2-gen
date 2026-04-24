import { listJobs, finishJob } from "../lib/inflight.js";

export function registerHealthRoutes(app, ctx) {
  app.get("/api/providers", (_req, res) => {
    res.json({
      apiKey: false,
      oauth: true,
      oauthPort: ctx.oauthPort,
      apiKeyDisabled: true,
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
    });
  });

  app.get("/api/oauth/status", async (_req, res) => {
    try {
      const r = await fetch(`${ctx.oauthUrl}/v1/models`, {
        signal: AbortSignal.timeout(ctx.config.oauth.statusTimeoutMs),
      });
      if (r.ok) {
        const data = await r.json();
        res.json({ status: "ready", models: data.data?.map((m) => m.id) || [] });
      } else {
        res.json({ status: "auth_required" });
      }
    } catch {
      res.json({ status: "offline" });
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
    res.json({ jobs: listJobs({ kind, sessionId }) });
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

      const billing = { apiKeySource: ctx.apiKeySource ?? "env" };
      if (subRes.status === "fulfilled" && subRes.value.ok) billing.costs = await subRes.value.json();
      if (usageRes.status === "fulfilled" && usageRes.value.ok) billing.credits = await usageRes.value.json();
      billing.apiKeyValid = modelsRes.status === "fulfilled" && modelsRes.value.ok === true;
      res.json(billing);
    } catch (err) {
      res.status(500).json({ error: err.message, apiKeyValid: false });
    }
  });
}
