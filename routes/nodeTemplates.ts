import type { Express, Request, Response } from "express";
import { errInfo } from "../lib/errInfo.js";
import {
  nodeTemplateStore,
  type NodeTemplateGraph,
  type NodeTemplateRecord,
} from "../lib/nodeTemplateStore.js";

type IdParams = { id: string };

function terminalCount(template: NodeTemplateRecord): number {
  const manifestCount = template.graph.manifest?.expectedTerminalResults;
  if (typeof manifestCount === "number") return manifestCount;
  const sources = new Set(template.graph.edges.map((edge) => edge.source));
  return template.graph.nodes.filter((node) => !sources.has(node.id)).length;
}

function previewGraph(graph: NodeTemplateGraph) {
  if (graph.nodes.length === 0) return [];
  const points = graph.nodes.map((node) => node.position ?? { x: 0, y: 0 });
  const minX = Math.min(...points.map((point) => point.x ?? 0));
  const maxX = Math.max(...points.map((point) => point.x ?? 0));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const normalize = (value: number, min: number, max: number) =>
    max === min ? 50 : 10 + ((value - min) / (max - min)) * 80;
  return graph.nodes.slice(0, 16).map((node) => ({
    id: node.id,
    x: normalize(node.position?.x ?? 0, minX, maxX),
    y: normalize(node.position?.y ?? 0, minY, maxY),
    label: typeof node.data?.kind === "string" ? node.data.kind : undefined,
  }));
}

function toSummary(template: NodeTemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    source: template.source,
    tags: template.tags,
    nodeCount: template.graph.nodes.length,
    terminalCount: terminalCount(template),
    preview: previewGraph(template.graph),
  };
}

function sendError(res: Response, error: unknown): void {
  const info = errInfo(error);
  const status = info.status || 500;
  const code = status === 500 ? "NODE_TEMPLATE_FAILED" : info.code || "NODE_TEMPLATE_FAILED";
  res.status(status).json({ error: { code, message: info.message } });
}

export function registerNodeTemplateRoutes(app: Express): void {
  app.get("/api/node-templates", async (_req: Request, res: Response) => {
    try {
      const templates = await nodeTemplateStore.list();
      res.json({ templates: templates.map(toSummary) });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/node-templates", async (req: Request, res: Response) => {
    try {
      const template = await nodeTemplateStore.create(req.body ?? {});
      res.status(201).json({ template: toSummary(template) });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/node-templates/:id/instantiate", async (req: Request<IdParams>, res: Response) => {
    try {
      const graph = await nodeTemplateStore.instantiate(req.params.id);
      res.json({ graph });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.patch("/api/node-templates/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const template = await nodeTemplateStore.update(req.params.id, req.body ?? {});
      res.json({ template: toSummary(template) });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/node-templates/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      await nodeTemplateStore.remove(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}
