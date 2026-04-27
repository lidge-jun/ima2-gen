import { listHistoryRows } from "../lib/historyList.js";
import { trashAsset, restoreAsset } from "../lib/assetLifecycle.js";
import { getSessionTitleMap } from "../lib/sessionStore.js";
import { logError, logEvent } from "../lib/logger.js";
import { getDb } from "../lib/db.js";

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
      const browserId = req.headers["x-ima2-browser-id"] || null;

      const rows = await listHistoryRows(ctx.config.storage.generatedDir);

      // Enrich with favorite status
      let favoriteSet = new Set();
      if (browserId) {
        const db = getDb();
        const favRows = db.prepare("SELECT filename FROM gallery_favorites WHERE browser_id = ?").all(browserId);
        favoriteSet = new Set(favRows.map((r) => r.filename));
      }

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

      const page = filtered.slice(0, limit).map((r) => ({ ...r, isFavorite: favoriteSet.has(r.filename) }));
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
        const titleMap = getSessionTitleMap(Array.from(groups.keys()));
        const sessions = Array.from(groups.values())
          .map((group) => ({
            ...group,
            title: titleMap.get(group.sessionId) || null,
            label: titleMap.get(group.sessionId) || group.sessionId.slice(0, 8),
          }))
          .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
        logEvent("history", "grouped", {
          sessions: sessions.length,
          loose: loose.length,
          total: rows.length,
        });
        return res.json({ sessions, loose, total: rows.length, nextCursor });
      }

      res.json({ items: page, total: rows.length, nextCursor });
    } catch (err) {
      logError("history", "error", err);
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

  app.post("/api/history/favorite", async (req, res) => {
    try {
      const db = getDb();
      const { filename } = req.body || {};
      const browserId = req.headers["x-ima2-browser-id"];

      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ error: "filename is required" });
      }
      if (!browserId || typeof browserId !== "string") {
        return res.status(400).json({ error: "X-Ima2-Browser-Id header is required" });
      }

      const existing = db.prepare("SELECT id FROM gallery_favorites WHERE browser_id = ? AND filename = ?").get(browserId, filename);

      if (existing) {
        db.prepare("DELETE FROM gallery_favorites WHERE browser_id = ? AND filename = ?").run(browserId, filename);
        res.json({ isFavorite: false });
      } else {
        const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(
          "INSERT INTO gallery_favorites (id, browser_id, filename, favorited_at) VALUES (?, ?, ?, ?)"
        ).run(id, browserId, filename, Math.floor(Date.now() / 1000));
        res.json({ isFavorite: true });
      }
    } catch (err) {
      logError("history", "favorite_error", err);
      res.status(500).json({ error: err.message });
    }
  });
}
