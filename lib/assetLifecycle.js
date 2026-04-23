import { getDb } from "./db.js";
import { rename, unlink, mkdir, access } from "fs/promises";
import { join, resolve, sep } from "path";
import { config } from "../config.js";

const DIR = config.storage.generatedDirName;
const TRASH = config.storage.trashDirName;
const TRASH_TTL_MS = config.trash.ttlMs;

function resolveInGenerated(rootDir, relPath) {
  if (typeof relPath !== "string" || relPath.length === 0) {
    const err = new Error("filename required");
    err.status = 400;
    err.code = "INVALID_FILENAME";
    throw err;
  }
  if (relPath.includes("\0")) {
    const err = new Error("invalid filename");
    err.status = 400;
    err.code = "INVALID_FILENAME";
    throw err;
  }
  const baseDir = resolve(rootDir, DIR);
  const target = resolve(baseDir, relPath);
  if (target !== baseDir && !target.startsWith(baseDir + sep)) {
    const err = new Error("filename escapes generated/");
    err.status = 400;
    err.code = "INVALID_FILENAME";
    throw err;
  }
  return target;
}

function nodesReferencingFilename(filename) {
  // The client stores imageUrl as `/generated/<encoded filename>` in node data JSON.
  // We scan all sessions' nodes for substring match on the decoded and encoded forms.
  const db = getDb();
  const encoded = encodeURIComponent(filename);
  const rows = db
    .prepare("SELECT session_id AS sessionId, id, data FROM nodes WHERE data LIKE ? OR data LIKE ?")
    .all(`%${filename}%`, `%${encoded}%`);
  return rows;
}

function markNodesAssetMissing(filename) {
  const db = getDb();
  const rows = nodesReferencingFilename(filename);
  if (rows.length === 0) return { sessionsTouched: 0, nodesTouched: 0 };
  const touchedSessions = new Set();
  const update = db.prepare("UPDATE nodes SET data = ? WHERE session_id = ? AND id = ?");
  const bumpSession = db.prepare("UPDATE sessions SET graph_version = graph_version + 1, updated_at = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of rows) {
      let data;
      try { data = JSON.parse(r.data); } catch { data = {}; }
      const imgRef = data?.imageUrl || "";
      if (imgRef.includes(filename) || imgRef.includes(encodeURIComponent(filename))) {
        data.imageUrl = null;
        data.status = "asset-missing";
        update.run(JSON.stringify(data), r.sessionId, r.id);
        touchedSessions.add(r.sessionId);
      }
    }
    const t = Date.now();
    for (const sid of touchedSessions) bumpSession.run(t, sid);
  });
  tx();
  return { sessionsTouched: touchedSessions.size, nodesTouched: rows.length };
}

export async function trashAsset(rootDir, filename) {
  const src = resolveInGenerated(rootDir, filename);
  try {
    await access(src);
  } catch {
    const err = new Error("Asset not found");
    err.status = 404;
    err.code = "ASSET_NOT_FOUND";
    throw err;
  }
  const trashDir = resolve(rootDir, DIR, TRASH);
  await mkdir(trashDir, { recursive: true });
  // Flatten filename (subdir separators -> __) so trash is flat & easy to restore
  const flat = filename.replace(/[\\/]+/g, "__");
  const trashPath = join(trashDir, `${Date.now()}_${flat}`);
  await rename(src, trashPath);
  // Move sidecar too (best-effort)
  await rename(src + ".json", trashPath + ".json").catch(() => {});

  const summary = markNodesAssetMissing(filename);

  // Schedule hard delete after TTL
  const unlinkAt = Date.now() + TRASH_TTL_MS;
  setTimeout(async () => {
    await unlink(trashPath).catch(() => {});
    await unlink(trashPath + ".json").catch(() => {});
  }, TRASH_TTL_MS).unref?.();

  return {
    ok: true,
    trashId: trashPath.slice(trashDir.length + 1),
    filename,
    unlinkAt,
    sessionsTouched: summary.sessionsTouched,
    nodesTouched: summary.nodesTouched,
  };
}

export async function restoreAsset(rootDir, trashId, originalFilename) {
  const trashDir = resolve(rootDir, DIR, TRASH);
  const src = resolve(trashDir, trashId);
  if (!src.startsWith(trashDir + sep) && src !== trashDir) {
    const err = new Error("invalid trashId");
    err.status = 400;
    throw err;
  }
  const dst = resolveInGenerated(rootDir, originalFilename);
  await rename(src, dst);
  await rename(src + ".json", dst + ".json").catch(() => {});
  return { ok: true };
}
