import {
  createSession,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  saveGraph,
  getStyleSheet,
  setStyleSheet,
  setStyleSheetEnabled,
} from "../lib/sessionStore.js";
import { extractStyleSheet } from "../lib/styleSheet.js";
import { logError, logEvent } from "../lib/logger.js";

function safeJsonChars(value) {
  try {
    return JSON.stringify(value ?? null).length;
  } catch {
    return 0;
  }
}

export function registerSessionRoutes(app, ctx) {
  app.get("/api/sessions", (_req, res) => {
    try {
      res.json({ sessions: listSessions() });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.post("/api/sessions", (req, res) => {
    try {
      const title = (req.body?.title || "Untitled").slice(0, 200);
      const session = createSession({ title });
      logEvent("session", "create", {
        sessionId: session.id,
        titleChars: session.title.length,
      });
      res.status(201).json({ session });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.get("/api/sessions/:id", (req, res) => {
    try {
      const session = getSession(req.params.id);
      if (!session) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      res.json({ session });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.patch("/api/sessions/:id", (req, res) => {
    try {
      const title = req.body?.title;
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          error: { code: "INVALID_TITLE", message: "Title required" },
        });
      }
      const ok = renameSession(req.params.id, title.slice(0, 200));
      if (!ok) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "rename", {
        sessionId: req.params.id,
        titleChars: title.slice(0, 200).length,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.delete("/api/sessions/:id", (req, res) => {
    try {
      const ok = deleteSession(req.params.id);
      if (!ok) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "delete", { sessionId: req.params.id });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.get("/api/sessions/:id/style-sheet", (req, res) => {
    try {
      const data = getStyleSheet(req.params.id);
      if (!data) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "stylesheet_get", {
        sessionId: req.params.id,
        enabled: data.enabled,
        hasSheet: !!data.styleSheet,
        sheetChars: safeJsonChars(data.styleSheet),
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.put("/api/sessions/:id/style-sheet", (req, res) => {
    try {
      const { styleSheet, enabled } = req.body || {};
      if (styleSheet !== null && (typeof styleSheet !== "object" || Array.isArray(styleSheet))) {
        return res.status(400).json({
          error: { code: "INVALID_SHEET", message: "styleSheet must be an object or null" },
        });
      }
      if (enabled !== undefined && typeof enabled !== "boolean") {
        return res.status(400).json({
          error: { code: "INVALID_ENABLED", message: "enabled must be boolean when provided" },
        });
      }
      const ok = setStyleSheet(req.params.id, styleSheet);
      if (!ok) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      if (typeof enabled === "boolean") setStyleSheetEnabled(req.params.id, enabled);
      logEvent("session", "stylesheet_save", {
        sessionId: req.params.id,
        enabled: typeof enabled === "boolean" ? enabled : undefined,
        hasSheet: !!styleSheet,
        sheetChars: safeJsonChars(styleSheet),
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.patch("/api/sessions/:id/style-sheet/enabled", (req, res) => {
    try {
      const { enabled } = req.body || {};
      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          error: { code: "INVALID_ENABLED", message: "enabled must be boolean" },
        });
      }
      const ok = setStyleSheetEnabled(req.params.id, enabled);
      if (!ok) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "stylesheet_toggle", {
        sessionId: req.params.id,
        enabled,
      });
      res.json({ ok: true, enabled });
    } catch (err) {
      res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
    }
  });

  app.post("/api/sessions/:id/style-sheet/extract", async (req, res) => {
    try {
      if (!ctx.openai) {
        return res.status(400).json({
          error: {
            code: "STYLE_SHEET_NO_KEY",
            message: "Style-sheet extraction requires an OpenAI API key. Connect one via setup.",
          },
        });
      }
      const { prompt, referenceDataUrl } = req.body || {};
      if (typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({
          error: { code: "STYLE_SHEET_BAD_INPUT", message: "prompt required" },
        });
      }
      if (!getSession(req.params.id)) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "stylesheet_extract_start", {
        sessionId: req.params.id,
        promptChars: prompt.length,
        hasReference: typeof referenceDataUrl === "string" && referenceDataUrl.length > 0,
      });
      const sheet = await extractStyleSheet(ctx.openai, {
        prompt: prompt.slice(0, 4000),
        referenceDataUrl: typeof referenceDataUrl === "string" ? referenceDataUrl : undefined,
      });
      const persisted = setStyleSheet(req.params.id, sheet);
      if (!persisted) {
        return res.status(404).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
        });
      }
      logEvent("session", "stylesheet_extract_done", {
        sessionId: req.params.id,
        sheetChars: safeJsonChars(sheet),
      });
      res.json({ styleSheet: sheet });
    } catch (err) {
      const code = err.code || "STYLE_SHEET_ERROR";
      const status =
        code === "STYLE_SHEET_NO_KEY" || code === "STYLE_SHEET_BAD_INPUT"
          ? 400
          : code === "STYLE_SHEET_EMPTY" || code === "STYLE_SHEET_PARSE" || code === "STYLE_SHEET_SHAPE"
            ? 422
            : 500;
      logError("session", "stylesheet_extract_error", err, { sessionId: req.params.id, code });
      res.status(status).json({ error: { code, message: err.message } });
    }
  });

  app.put("/api/sessions/:id/graph", (req, res) => {
    try {
      const { nodes, edges } = req.body || {};
      const rawIfMatch = req.get("If-Match");
      if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        return res.status(400).json({
          error: { code: "INVALID_GRAPH", message: "nodes and edges arrays required" },
        });
      }
      if (!rawIfMatch) {
        return res.status(428).json({
          error: { code: "GRAPH_VERSION_REQUIRED", message: "If-Match header required" },
        });
      }
      if (nodes.length > 500 || edges.length > 1000) {
        return res.status(413).json({
          error: {
            code: "GRAPH_TOO_LARGE",
            message: `Graph too large (max 500 nodes / 1000 edges), got ${nodes.length}/${edges.length}`,
          },
        });
      }
      const expectedVersion = Number(String(rawIfMatch).replace(/"/g, ""));
      if (!Number.isFinite(expectedVersion)) {
        return res.status(400).json({
          error: { code: "INVALID_GRAPH_VERSION", message: "If-Match must be a finite integer" },
        });
      }
      const saveId = req.get("X-Ima2-Graph-Save-Id") || null;
      const saveReason = req.get("X-Ima2-Graph-Save-Reason") || null;
      const tabId = req.get("X-Ima2-Tab-Id") || null;
      const result = saveGraph(req.params.id, { nodes, edges, expectedVersion });
      logEvent("session", "graph_save", {
        sessionId: req.params.id,
        saveId,
        saveReason,
        tabId,
        nodes: nodes.length,
        edges: edges.length,
        graphVersion: result.graphVersion,
      });
      res.json({ ok: true, nodes: nodes.length, edges: edges.length, graphVersion: result.graphVersion });
    } catch (err) {
      const code = err.code || "DB_ERROR";
      const payload: any = { error: { code, message: err.message } };
      if (typeof err.currentVersion === "number") payload.currentVersion = err.currentVersion;
      if (code === "GRAPH_VERSION_CONFLICT") {
        logEvent("session", "graph_conflict", {
          sessionId: req.params.id,
          saveId: req.get("X-Ima2-Graph-Save-Id") || null,
          saveReason: req.get("X-Ima2-Graph-Save-Reason") || null,
          tabId: req.get("X-Ima2-Tab-Id") || null,
          expectedVersion: Number(String(req.get("If-Match") || "").replace(/"/g, "")),
          currentVersion: err.currentVersion ?? null,
          nodes: Array.isArray(req.body?.nodes) ? req.body.nodes.length : null,
          edges: Array.isArray(req.body?.edges) ? req.body.edges.length : null,
        });
      } else {
        logError("session", "graph_error", err, { sessionId: req.params.id, code });
      }
      res.status(err.status || 500).json(payload);
    }
  });
}
