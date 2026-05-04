import type { Express, Request, Response } from "express";
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

import { errInfo } from "../lib/errInfo.js";
import { requireRuntimeContext, type RouteRuntimeContext, type RuntimeContext } from "../lib/runtimeContext.js";

interface CardLike {
  id?: string;
  cardId?: string;
  status?: string;
  error?: { message?: string } | string | null;
  headline?: string;
  body?: string;
  textFields?: unknown;
  imageFilename?: string | null;
  generatedAt?: string | number | null;
  setId?: string;
}

function sendError(res: Response, err: unknown) {
  const info = errInfo(err);
  const status = info.status || 500;
  res.status(status).json({
    error: {
      code: info.code || "CARD_NEWS_ERROR",
      message: info.message || "Card News request failed",
    },
  });
}

function runCardNewsJob(ctx: RuntimeContext, jobId: string, plan: unknown) {
  setImmediate(async () => {
    try {
      updateCardNewsJob(jobId, { status: "running" });
      await generateCardNewsSet(ctx, plan as Parameters<typeof generateCardNewsSet>[1], {
        onCardStart: (card: CardLike) => {
          updateCardNewsJobCard(jobId, card.cardId ?? "", { status: "generating", error: undefined });
        },
        onCardDone: (card: CardLike) => {
          const url = card.imageFilename && card.setId
            ? `/generated/cardnews/${encodeURIComponent(card.setId)}/${encodeURIComponent(card.imageFilename)}`
            : undefined;
          const errStr = card.error
            ? (typeof card.error === "object" && card.error && "message" in card.error
              ? card.error.message
              : (typeof card.error === "string" ? card.error : undefined))
            : undefined;
          updateCardNewsJobCard(jobId, card.cardId ?? "", {
            status: card.status || "generated",
            error: errStr,
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
    } catch (e) {
      const err = errInfo(e);
      updateCardNewsJob(jobId, {
        status: "error",
        error: err.message || "Card News job failed",
      });
    }
  });
}

export function registerCardNewsRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.get("/api/cardnews/image-templates", async (_req: Request, res: Response) => {
    try {
      res.json({ templates: await listImageTemplates(ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/image-templates/:templateId/preview", async (req: Request<{ templateId: string }>, res: Response) => {
    try {
      const buf = await readTemplatePreview(ctx, req.params.templateId);
      res.type("image/png").send(buf);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/role-templates", (_req: Request, res: Response) => {
    res.json({ templates: listRoleTemplates() });
  });

  app.get("/api/cardnews/sets", async (_req: Request, res: Response) => {
    try {
      res.json({ sets: await listCardNewsSets(ctx) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/sets/:setId", async (req: Request<{ setId: string }>, res: Response) => {
    try {
      res.json({ plan: await readCardNewsSetPlan(ctx, req.params.setId) });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/sets/:setId/manifest", async (req: Request<{ setId: string }>, res: Response) => {
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

  app.post("/api/cardnews/draft", async (req: Request, res: Response) => {
    try {
      res.json(await createCardNewsDraft(ctx, (req.body ?? {}) as Parameters<typeof createCardNewsDraft>[1]));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/generate", async (req: Request, res: Response) => {
    try {
      const result = await generateCardNewsSet(ctx, (req.body ?? {}) as Parameters<typeof generateCardNewsSet>[1]);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/jobs", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Parameters<typeof createCardNewsJob>[0];
      const summary = createCardNewsJob(body);
      runCardNewsJob(ctx, summary.jobId, body);
      res.status(202).json(summary);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/cardnews/jobs/:jobId", (req: Request<{ jobId: string }>, res: Response) => {
    const job = getCardNewsJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: { code: "CARD_NEWS_JOB_NOT_FOUND", message: "Job not found" } });
      return;
    }
    res.json(job);
  });

  app.post("/api/cardnews/jobs/:jobId/retry", (req: Request<{ jobId: string }>, res: Response) => {
    const plan = getCardNewsJobPlan(req.params.jobId);
    const body = (req.body ?? {}) as { cardIds?: string[] };
    const job = retryCardNewsJob(req.params.jobId, body.cardIds || []);
    if (!job) {
      res.status(404).json({ error: { code: "CARD_NEWS_JOB_NOT_FOUND", message: "Job not found" } });
      return;
    }
    if (plan) {
      const wanted = new Set(body.cardIds || []);
      const planObj = plan as { cards?: Array<{ id: string }> } & Record<string, unknown>;
      runCardNewsJob(ctx, req.params.jobId, {
        ...planObj,
        cards: (planObj.cards || []).filter((card: { id: string }) => wanted.has(card.id)),
      });
    }
    res.status(202).json(job);
  });

  app.post("/api/cardnews/cards/:cardId/regenerate", async (req: Request<{ cardId: string }>, res: Response) => {
    try {
      const body = (req.body ?? {}) as { cards?: CardLike[]; card?: CardLike } & Record<string, unknown>;
      const cards = Array.isArray(body.cards)
        ? body.cards.filter((card: CardLike) => card.id === req.params.cardId || card.cardId === req.params.cardId)
        : body.card ? [body.card] : [];
      const result = await generateCardNewsSet(ctx, { ...body, cards } as Parameters<typeof generateCardNewsSet>[1]);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/cardnews/export", (_req: Request, res: Response) => {
    res.status(202).json({
      ok: true,
      status: "planned",
      message: "Card News export is planned after the dev MVP generation slice.",
    });
  });
}
