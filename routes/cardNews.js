import { listImageTemplates, readTemplatePreview } from "../lib/cardNewsTemplateStore.js";
import { listRoleTemplates } from "../lib/cardNewsRoleTemplateStore.js";
import { createCardNewsDraft } from "../lib/cardNewsPlanner.js";
import { generateCardNewsSet } from "../lib/cardNewsGenerator.js";
import {
  createCardNewsJob,
  finishCardNewsJob,
  getCardNewsJob,
  getCardNewsJobPlan,
  retryCardNewsJob,
  updateCardNewsJob,
  updateCardNewsJobCard,
} from "../lib/cardNewsJobStore.js";
import { listCardNewsSets, readCardNewsManifest, readCardNewsSetPlan } from "../lib/cardNewsManifestStore.js";

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || "CARD_NEWS_ERROR",
      message: err.message || "Card News request failed",
    },
  });
}

function runCardNewsJob(ctx, jobId, plan) {
  setImmediate(async () => {
    try {
      updateCardNewsJob(jobId, { status: "running" });
      await generateCardNewsSet(ctx, plan, {
        onCardStart: (card) => {
          updateCardNewsJobCard(jobId, card.cardId, { status: "generating", error: undefined });
        },
        onCardDone: (card) => {
          const url = card.imageFilename
            ? `/generated/cardnews/${encodeURIComponent(card.setId)}/${encodeURIComponent(card.imageFilename)}`
            : undefined;
          updateCardNewsJobCard(jobId, card.cardId, {
            status: card.status || "generated",
            error: card.error?.message || card.error || undefined,
            headline: card.headline,
            body: card.body,
            textFields: Array.isArray(card.textFields) ? card.textFields : [],
            imageFilename: card.imageFilename || undefined,
            generatedAt: card.generatedAt || undefined,
            url,
          });
        },
      });
      finishCardNewsJob(jobId);
    } catch (err) {
      updateCardNewsJob(jobId, {
        status: "error",
        error: err.message || "Card News job failed",
      });
    }
  });
}

export function registerCardNewsRoutes(app, ctx) {
  app.get("/api/cardnews/image-templates", async (_req, res) => {
    try {
      res.json({ templates: await listImageTemplates(ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/image-templates/:templateId/preview", async (req, res) => {
    try {
      const buf = await readTemplatePreview(ctx, req.params.templateId);
      res.type("image/png").send(buf);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/role-templates", (_req, res) => {
    res.json({ templates: listRoleTemplates() });
  });

  app.get("/api/cardnews/sets", async (_req, res) => {
    try {
      res.json({ sets: await listCardNewsSets(ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/sets/:setId", async (req, res) => {
    try {
      res.json({ plan: await readCardNewsSetPlan(ctx, req.params.setId) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/sets/:setId/manifest", async (req, res) => {
    try {
      const manifest = await readCardNewsManifest(ctx, req.params.setId);
      if (req.query.download === "1") {
        res.setHeader("Content-Disposition", `attachment; filename="${req.params.setId}-manifest.json"`);
      }
      res.type("application/json").send(JSON.stringify(manifest, null, 2));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/draft", async (req, res) => {
    try {
      res.json(await createCardNewsDraft(ctx, req.body || {}));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/generate", async (req, res) => {
    try {
      const result = await generateCardNewsSet(ctx, req.body || {});
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/jobs", (req, res) => {
    try {
      const summary = createCardNewsJob(req.body || {});
      runCardNewsJob(ctx, summary.jobId, req.body || {});
      res.status(202).json(summary);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/jobs/:jobId", (req, res) => {
    const job = getCardNewsJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: { code: "CARD_NEWS_JOB_NOT_FOUND", message: "Job not found" } });
      return;
    }
    res.json(job);
  });

  app.post("/api/cardnews/jobs/:jobId/retry", (req, res) => {
    const plan = getCardNewsJobPlan(req.params.jobId);
    const job = retryCardNewsJob(req.params.jobId, req.body?.cardIds || []);
    if (!job) {
      res.status(404).json({ error: { code: "CARD_NEWS_JOB_NOT_FOUND", message: "Job not found" } });
      return;
    }
    if (plan) {
      const wanted = new Set(req.body?.cardIds || []);
      runCardNewsJob(ctx, req.params.jobId, {
        ...plan,
        cards: (plan.cards || []).filter((card) => wanted.has(card.id)),
      });
    }
    res.status(202).json(job);
  });

  app.post("/api/cardnews/cards/:cardId/regenerate", async (req, res) => {
    try {
      const body = req.body || {};
      const cards = Array.isArray(body.cards)
        ? body.cards.filter((card) => card.id === req.params.cardId || card.cardId === req.params.cardId)
        : body.card ? [body.card] : [];
      const result = await generateCardNewsSet(ctx, { ...body, cards });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/export", (_req, res) => {
    res.status(202).json({
      ok: true,
      status: "planned",
      message: "Card News export is planned after the dev MVP generation slice.",
    });
  });
}
