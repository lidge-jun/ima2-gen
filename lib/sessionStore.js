import { ulid } from "ulid";
import { getDb } from "./db.js";

function now() {
  return Date.now();
}

export function createSession({ title = "Untitled" } = {}) {
  const db = getDb();
  const id = "s_" + ulid();
  const t = now();
  db.prepare(
    "INSERT INTO sessions (id, title, created_at, updated_at, graph_version) VALUES (?, ?, ?, ?, 0)",
  ).run(id, title, t, t);
  return { id, title, createdAt: t, updatedAt: t, graphVersion: 0 };
}

export function listSessions() {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, graph_version AS graphVersion FROM sessions ORDER BY updated_at DESC",
    )
    .all();
  return rows.map((r) => ({
    ...r,
    nodeCount: db
      .prepare("SELECT COUNT(*) AS c FROM nodes WHERE session_id = ?")
      .get(r.id).c,
  }));
}

export function getSession(id) {
  const db = getDb();
  const session = db
    .prepare(
      "SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, graph_version AS graphVersion FROM sessions WHERE id = ?",
    )
    .get(id);
  if (!session) return null;
  const nodes = db
    .prepare("SELECT id, x, y, data FROM nodes WHERE session_id = ?")
    .all(id)
    .map((n) => ({ id: n.id, x: n.x, y: n.y, data: safeParse(n.data) }));
  const edges = db
    .prepare("SELECT id, source, target, data FROM edges WHERE session_id = ?")
    .all(id)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: safeParse(e.data),
    }));
  return { ...session, nodes, edges };
}

export function renameSession(id, title) {
  const db = getDb();
  const res = db
    .prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
    .run(title, now(), id);
  return res.changes > 0;
}

export function deleteSession(id) {
  const db = getDb();
  const res = db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return res.changes > 0;
}

const MAX_STR = 10_000;

function cleanStr(v) {
  if (typeof v !== "string") return "";
  return v.length > MAX_STR ? v.slice(0, MAX_STR) : v;
}

function cleanData(v) {
  try {
    const json = JSON.stringify(v ?? {});
    return json.length > MAX_STR * 10 ? "{}" : json;
  } catch {
    return "{}";
  }
}

export function saveGraph(sessionId, { nodes = [], edges = [], expectedVersion = null }) {
  const db = getDb();
  const sessionExists = db
    .prepare("SELECT 1 FROM sessions WHERE id = ?")
    .get(sessionId);
  if (!sessionExists) {
    const err = new Error(`Session not found: ${sessionId}`);
    err.code = "SESSION_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  const versionRow = db
    .prepare("SELECT graph_version AS graphVersion FROM sessions WHERE id = ?")
    .get(sessionId);
  const currentVersion = versionRow?.graphVersion ?? 0;
  if (
    typeof expectedVersion === "number" &&
    Number.isFinite(expectedVersion) &&
    expectedVersion !== currentVersion
  ) {
    const err = new Error(
      `Graph version conflict for session ${sessionId}: expected ${expectedVersion}, got ${currentVersion}`,
    );
    err.code = "GRAPH_VERSION_CONFLICT";
    err.status = 409;
    err.currentVersion = currentVersion;
    throw err;
  }

  // Validate edges reference existing nodes (drop dangling).
  const nodeIds = new Set(nodes.map((n) => n?.id).filter(Boolean).map(String));
  const cleanEdges = edges.filter(
    (e) => e?.id && e?.source && e?.target && nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)),
  );

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM nodes WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM edges WHERE session_id = ?").run(sessionId);

    const insNode = db.prepare(
      "INSERT INTO nodes (session_id, id, x, y, data) VALUES (?, ?, ?, ?, ?)",
    );
    for (const n of nodes) {
      if (!n?.id) continue;
      const x = Number(n.x ?? n.position?.x ?? 0);
      const y = Number(n.y ?? n.position?.y ?? 0);
      insNode.run(
        sessionId,
        cleanStr(String(n.id)),
        Number.isFinite(x) ? x : 0,
        Number.isFinite(y) ? y : 0,
        cleanData(n.data),
      );
    }

    const insEdge = db.prepare(
      "INSERT INTO edges (session_id, id, source, target, data) VALUES (?, ?, ?, ?, ?)",
    );
    for (const e of cleanEdges) {
      insEdge.run(
        sessionId,
        cleanStr(String(e.id)),
        cleanStr(String(e.source)),
        cleanStr(String(e.target)),
        cleanData(e.data),
      );
    }

    db.prepare("UPDATE sessions SET updated_at = ?, graph_version = graph_version + 1 WHERE id = ?").run(
      now(),
      sessionId,
    );

    return db
      .prepare("SELECT graph_version AS graphVersion FROM sessions WHERE id = ?")
      .get(sessionId).graphVersion;
  });

  const nextVersion = tx();
  return { ok: true, graphVersion: nextVersion };
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function ensureDefaultSession() {
  const sessions = listSessions();
  if (sessions.length > 0) return sessions[0];
  return createSession({ title: "My first graph" });
}
