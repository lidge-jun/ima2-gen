import { logError, logEvent } from "../lib/logger.js";
import { getDb } from "../lib/db.js";

function getPromptsDb() {
  return getDb();
}

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerPromptRoutes(app, ctx) {
  // ── Prompts ───────────────────────────────────────────────────────────────

  app.get("/api/prompts", async (req, res) => {
    try {
      const db = getPromptsDb();
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const folderId = typeof req.query.folderId === "string" ? req.query.folderId : null;
      const favoritesOnly = req.query.favoritesOnly === "1" || req.query.favoritesOnly === "true";

      let where = "WHERE 1=1";
      const params = [];

      if (folderId) {
        where += " AND p.folder_id = ?";
        params.push(folderId);
      } else {
        where += " AND p.folder_id != '__trash__'";
      }

      if (favoritesOnly) {
        where += " AND p.is_favorite = 1";
      }

      if (search) {
        where += " AND (p.name LIKE ? OR p.text LIKE ? OR p.tags LIKE ?)";
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const prompts = db
        .prepare(
          `SELECT p.*, f.name as folder_name
           FROM prompts p
           LEFT JOIN prompt_folders f ON p.folder_id = f.id
           ${where}
           ORDER BY p.updated_at DESC`
        )
        .all(...params);

      const folders = db
        .prepare("SELECT * FROM prompt_folders WHERE id NOT IN ('__root__', '__trash__') ORDER BY name COLLATE NOCASE")
        .all();

      res.json({ prompts: prompts.map(normalizePrompt), folders: folders.map(normalizeFolder) });
    } catch (err) {
      logError("prompts", "list_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/prompts", async (req, res) => {
    try {
      const db = getPromptsDb();
      const { name, text, tags, folderId, mode } = req.body || {};

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      const promptName = typeof name === "string" && name.trim() ? name.trim() : text.slice(0, 30);
      const folder_id = typeof folderId === "string" && folderId ? folderId : "__root__";
      const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : null;
      const id = generateId();
      const now = Math.floor(Date.now() / 1000);

      db.prepare(
        `INSERT INTO prompts (id, folder_id, name, text, tags, mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, folder_id, promptName, text, tagsJson, mode || null, now, now);

      logEvent("prompts", "created", { id, folder_id });
      res.status(201).json({ prompt: normalizePrompt(db.prepare("SELECT * FROM prompts WHERE id = ?").get(id)) });
    } catch (err) {
      logError("prompts", "create_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prompts/:id", async (req, res) => {
    try {
      const db = getPromptsDb();
      const row = db.prepare("SELECT * FROM prompts WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json({ prompt: normalizePrompt(row) });
    } catch (err) {
      logError("prompts", "get_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/prompts/:id", async (req, res) => {
    try {
      const db = getPromptsDb();
      const { name, text, tags, folderId, mode } = req.body || {};
      const sets = [];
      const params = [];

      if (typeof name === "string") { sets.push("name = ?"); params.push(name); }
      if (typeof text === "string") { sets.push("text = ?"); params.push(text); }
      if (Array.isArray(tags)) { sets.push("tags = ?"); params.push(JSON.stringify(tags)); }
      if (typeof folderId === "string") { sets.push("folder_id = ?"); params.push(folderId); }
      if (typeof mode === "string") { sets.push("mode = ?"); params.push(mode); }

      if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

      sets.push("updated_at = ?");
      params.push(Math.floor(Date.now() / 1000));
      params.push(req.params.id);

      db.prepare(`UPDATE prompts SET ${sets.join(", ")} WHERE id = ?`).run(...params);

      const row = db.prepare("SELECT * FROM prompts WHERE id = ?").get(req.params.id);
      res.json({ prompt: normalizePrompt(row) });
    } catch (err) {
      logError("prompts", "patch_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    try {
      const db = getPromptsDb();
      db.prepare("UPDATE prompts SET folder_id = '__trash__', updated_at = ? WHERE id = ?").run(
        Math.floor(Date.now() / 1000),
        req.params.id,
      );
      logEvent("prompts", "soft_deleted", { id: req.params.id });
      res.json({ ok: true });
    } catch (err) {
      logError("prompts", "delete_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/prompts/:id/favorite", async (req, res) => {
    try {
      const db = getPromptsDb();
      const row = db.prepare("SELECT is_favorite FROM prompts WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });

      const newVal = row.is_favorite ? 0 : 1;
      const now = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE prompts SET is_favorite = ?, favorited_at = ? WHERE id = ?").run(
        newVal,
        newVal ? now : null,
        req.params.id,
      );

      res.json({ isFavorite: !!newVal, favoritedAt: newVal ? now : null });
    } catch (err) {
      logError("prompts", "favorite_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Import / Export ───────────────────────────────────────────────────────

  app.post("/api/prompts/import", async (req, res) => {
    try {
      const db = getPromptsDb();
      const { folders: importFolders = [], prompts: importPrompts = [] } = req.body || {};

      const result = { foldersCreated: 0, promptsImported: 0, duplicatesSkipped: 0 };
      const now = Math.floor(Date.now() / 1000);

      // Build name→id map for existing folders
      const existingFolders: any[] = db.prepare("SELECT * FROM prompt_folders").all() as any[];
      const folderMap = new Map(existingFolders.map((f: any) => [f.id, f]));
      const namePathMap = new Map();
      for (const f of existingFolders) {
        const parent: any = folderMap.get(f.parent_id);
        const path = parent && parent.id !== "__root__" ? `${parent.name}/${f.name}` : f.name;
        namePathMap.set(path.toLowerCase(), f.id);
      }

      // Import folders
      for (const f of importFolders) {
        if (!f.name) continue;
        const path = f.parentId && f.parentId !== "__root__"
          ? `${folderMap.get(f.parentId)?.name || ""}/${f.name}`
          : f.name;
        if (namePathMap.has(path.toLowerCase())) continue;

        const id = f.id || generateId();
        db.prepare(
          "INSERT INTO prompt_folders (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).run(id, f.parentId || "__root__", f.name, now, now);
        namePathMap.set(path.toLowerCase(), id);
        folderMap.set(id, { id, parent_id: f.parentId || "__root__", name: f.name });
        result.foldersCreated++;
      }

      // Import prompts
      for (const p of importPrompts) {
        if (!p.text) continue;
        const folderId = p.folderId && folderMap.has(p.folderId) ? p.folderId : "__root__";
        // Check duplicate by text + folder
        const dup = db.prepare("SELECT 1 FROM prompts WHERE text = ? AND folder_id = ? LIMIT 1").get(p.text, folderId);
        if (dup) {
          result.duplicatesSkipped++;
          continue;
        }
        const id = p.id || generateId();
        const tagsJson = Array.isArray(p.tags) ? JSON.stringify(p.tags) : null;
        db.prepare(
          `INSERT INTO prompts (id, folder_id, name, text, tags, mode, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, folderId, p.name || p.text.slice(0, 30), p.text, tagsJson, p.mode || null, p.isFavorite ? 1 : 0, now, now);
        result.promptsImported++;
      }

      logEvent("prompts", "imported", result);
      res.json(result);
    } catch (err) {
      logError("prompts", "import_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prompts/export", async (req, res) => {
    try {
      const db = getPromptsDb();
      const prompts = db.prepare("SELECT * FROM prompts WHERE folder_id != '__trash__'").all();
      const folders = db.prepare("SELECT * FROM prompt_folders WHERE id NOT IN ('__root__', '__trash__')").all();

      res.json({
        version: 1,
        exportedAt: new Date().toISOString(),
        folders: folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id })),
        prompts: prompts.map((p) => ({
          id: p.id,
          name: p.name,
          text: p.text,
          tags: p.tags ? JSON.parse(p.tags) : [],
          folderId: p.folder_id,
          mode: p.mode,
          isFavorite: !!p.is_favorite,
        })),
      });
    } catch (err) {
      logError("prompts", "export_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Folders ───────────────────────────────────────────────────────────────

  app.get("/api/prompts/folders", async (req, res) => {
    try {
      const db = getPromptsDb();
      const rows = db.prepare("SELECT * FROM prompt_folders WHERE id NOT IN ('__root__', '__trash__') ORDER BY name COLLATE NOCASE").all();
      res.json({ folders: rows.map(normalizeFolder) });
    } catch (err) {
      logError("prompts", "folders_list_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/prompts/folders", async (req, res) => {
    try {
      const db = getPromptsDb();
      const { name, parentId } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is required" });
      }

      const parent_id = typeof parentId === "string" && parentId ? parentId : "__root__";
      const now = Math.floor(Date.now() / 1000);
      const id = generateId();

      try {
        db.prepare(
          "INSERT INTO prompt_folders (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).run(id, parent_id, name.trim(), now, now);
      } catch (err) {
        if (err.message && err.message.includes("UNIQUE constraint failed")) {
          return res.status(409).json({ error: "Folder name already exists in this parent" });
        }
        throw err;
      }

      res.status(201).json({ folder: normalizeFolder(db.prepare("SELECT * FROM prompt_folders WHERE id = ?").get(id)) });
    } catch (err) {
      logError("prompts", "folder_create_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/prompts/folders/:id", async (req, res) => {
    try {
      const db = getPromptsDb();
      const { name, parentId } = req.body || {};
      const sets = [];
      const params = [];

      if (typeof name === "string" && name.trim()) { sets.push("name = ?"); params.push(name.trim()); }
      if (typeof parentId === "string") { sets.push("parent_id = ?"); params.push(parentId); }
      if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

      sets.push("updated_at = ?");
      params.push(Math.floor(Date.now() / 1000));
      params.push(req.params.id);

      try {
        db.prepare(`UPDATE prompt_folders SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      } catch (err) {
        if (err.message && err.message.includes("UNIQUE constraint failed")) {
          return res.status(409).json({ error: "Folder name already exists in this parent" });
        }
        throw err;
      }

      const row = db.prepare("SELECT * FROM prompt_folders WHERE id = ?").get(req.params.id);
      res.json({ folder: normalizeFolder(row) });
    } catch (err) {
      logError("prompts", "folder_patch_error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/prompts/folders/:id", async (req, res) => {
    try {
      const db = getPromptsDb();
      const strategy = req.query.strategy === "deleteItems" ? "deleteItems" : "moveToRoot";

      if (strategy === "moveToRoot") {
        db.prepare("UPDATE prompts SET folder_id = '__root__' WHERE folder_id = ?").run(req.params.id);
      } else {
        db.prepare("UPDATE prompts SET folder_id = '__trash__' WHERE folder_id = ?").run(req.params.id);
      }

      db.prepare("DELETE FROM prompt_folders WHERE id = ?").run(req.params.id);
      logEvent("prompts", "folder_deleted", { id: req.params.id, strategy });
      res.json({ ok: true });
    } catch (err) {
      logError("prompts", "folder_delete_error", err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizePrompt(row) {
  return {
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    text: row.text,
    tags: row.tags ? JSON.parse(row.tags) : [],
    mode: row.mode,
    isFavorite: !!row.is_favorite,
    favoritedAt: row.favorited_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeFolder(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
