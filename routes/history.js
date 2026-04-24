import { listHistoryRows } from "../lib/historyList.js";
import { trashAsset, restoreAsset } from "../lib/assetLifecycle.js";

export function registerHistoryRoutes(app, ctx) {
  app.get("/api/history", async (req, res) => {
    try {
      const limitRaw = parseInt(req.query.limit);
      const limit = Math.min(
        Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : ctx.config.history.defaultPageSize,
        ctx.config.history.maxPageCap,
      );
      const beforeTs = parseInt(req.query.before);
      const beforeFn = typeof req.query.beforeFilename === "string" ? req.query.beforeFilename : null;
      const sinceTs = parseInt(req.query.since);
      const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
      const groupBy = req.query.groupBy === "session" ? "session" : null;

      const rows = await listHistoryRows(ctx.config.storage.generatedDir);

      let filtered = rows;
      if (Number.isFinite(sinceTs)) {
        filtered = filtered.filter((r) => r.createdAt > sinceTs);
      }
      if (Number.isFinite(beforeTs)) {
        filtered = filtered.filter((r) => {
          if (r.createdAt < beforeTs) return true;
          if (r.createdAt === beforeTs && beforeFn) return r.filename < beforeFn;
          return false;
        });
      }
      if (sessionId) {
        filtered = filtered.filter((r) => r.sessionId === sessionId);
      }

      const page = filtered.slice(0, limit);
      const nextCursor = page.length === limit && filtered.length > limit
        ? { before: page[page.length - 1].createdAt, beforeFilename: page[page.length - 1].filename }
        : null;

      if (groupBy === "session") {
        const groups = new Map();
        const loose = [];
        for (const row of page) {
          if (row.sessionId) {
            let group = groups.get(row.sessionId);
            if (!group) {
              group = { sessionId: row.sessionId, items: [], lastUsedAt: row.createdAt };
              groups.set(row.sessionId, group);
            }
            group.items.push(row);
            if (row.createdAt > group.lastUsedAt) group.lastUsedAt = row.createdAt;
          } else {
            loose.push(row);
          }
        }
        const sessions = Array.from(groups.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
        return res.json({ sessions, loose, total: rows.length, nextCursor });
      }

      res.json({ items: page, total: rows.length, nextCursor });
    } catch (err) {
      console.error("[history] error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/history/:filename", async (req, res) => {
    try {
      const filename = decodeURIComponent(req.params.filename);
      const result = await trashAsset(ctx.rootDir, filename);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message, code: err.code });
    }
  });

  app.post("/api/history/:filename/restore", async (req, res) => {
    try {
      const filename = decodeURIComponent(req.params.filename);
      const trashId = typeof req.body?.trashId === "string" ? req.body.trashId : null;
      if (!trashId) return res.status(400).json({ error: "trashId required" });
      const result = await restoreAsset(ctx.rootDir, trashId, filename);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

