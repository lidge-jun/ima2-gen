import { getDb } from "../lib/db.js";

const MAX_ANNOTATION_PAYLOAD_CHARS = 256 * 1024;

function getBrowserId(req) {
  const browserId = req.headers["x-ima2-browser-id"];
  return typeof browserId === "string" && browserId.trim() ? browserId.trim() : null;
}

function isSafeFilename(filename) {
  return (
    typeof filename === "string" &&
    filename.length > 0 &&
    filename.length <= 240 &&
    !filename.includes("..") &&
    !filename.startsWith("/") &&
    !filename.includes("\\")
  );
}

function normalizePayload(value) {
  const payload = value?.annotations ?? value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "annotations payload is required" };
  }
  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
  const memos = Array.isArray(payload.memos) ? payload.memos : [];
  const normalized = { paths, boxes, memos };
  const text = JSON.stringify(normalized);
  if (text.length > MAX_ANNOTATION_PAYLOAD_CHARS) {
    return { error: "annotations payload is too large" };
  }
  return { payload: normalized, text };
}

export function registerAnnotationRoutes(app) {
  app.get("/api/annotations/:filename", (req, res) => {
    try {
      const browserId = getBrowserId(req);
      const filename = decodeURIComponent(req.params.filename);
      if (!browserId) return res.status(400).json({ error: "X-Ima2-Browser-Id header is required" });
      if (!isSafeFilename(filename)) return res.status(400).json({ error: "invalid filename" });

      const row = getDb()
        .prepare("SELECT payload FROM image_annotations WHERE browser_id = ? AND filename = ?")
        .get(browserId, filename);
      const annotations = row ? JSON.parse(row.payload) : null;
      res.json({ annotations });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/annotations/:filename", (req, res) => {
    try {
      const browserId = getBrowserId(req);
      const filename = decodeURIComponent(req.params.filename);
      if (!browserId) return res.status(400).json({ error: "X-Ima2-Browser-Id header is required" });
      if (!isSafeFilename(filename)) return res.status(400).json({ error: "invalid filename" });

      const normalized = normalizePayload(req.body);
      if (normalized.error) return res.status(400).json({ error: normalized.error });

      const id = `${browserId}:${filename}`;
      getDb().prepare(`
        INSERT INTO image_annotations (id, browser_id, filename, payload, schema_version, updated_at)
        VALUES (?, ?, ?, ?, 1, unixepoch())
        ON CONFLICT(browser_id, filename) DO UPDATE SET
          payload = excluded.payload,
          schema_version = excluded.schema_version,
          updated_at = unixepoch()
      `).run(id, browserId, filename, normalized.text);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/annotations/:filename", (req, res) => {
    try {
      const browserId = getBrowserId(req);
      const filename = decodeURIComponent(req.params.filename);
      if (!browserId) return res.status(400).json({ error: "X-Ima2-Browser-Id header is required" });
      if (!isSafeFilename(filename)) return res.status(400).json({ error: "invalid filename" });

      getDb()
        .prepare("DELETE FROM image_annotations WHERE browser_id = ? AND filename = ?")
        .run(browserId, filename);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
