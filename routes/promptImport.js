import { getDb } from "../lib/db.js";
import { logError, logEvent } from "../lib/logger.js";
import { isPromptImportError, promptImportError } from "../lib/promptImport/errors.js";
import {
  fetchGitHubSourceText,
  isSupportedPromptFileName,
  normalizeGitHubSource,
} from "../lib/promptImport/githubSource.js";
import {
  fetchGitHubFolderFiles,
  fetchSelectedGitHubFolderFiles,
  normalizeGitHubFolderSource,
} from "../lib/promptImport/githubFolder.js";
import { parsePromptCandidates } from "../lib/promptImport/parsePromptCandidates.js";
import {
  getPromptImportSources,
  refreshCuratedSource,
  searchCuratedPrompts,
} from "../lib/promptImport/promptIndex.js";

function promptImportLimits(ctx) {
  return {
    maxFileBytesForPreview: ctx.config.limits.promptImportMaxFileBytes,
    maxPromptCandidatesPerFile: ctx.config.limits.promptImportMaxCandidatesPerFile,
    maxPromptCandidatesPerImport: ctx.config.limits.promptImportMaxCandidatesPerImport,
    fetchTimeoutMs: ctx.config.limits.promptImportFetchTimeoutMs,
    maxCandidateChars: ctx.config.limits.promptImportMaxCandidateChars,
    minCandidateChars: ctx.config.limits.promptImportMinCandidateChars,
    maxSourceCharsScanned: ctx.config.limits.promptImportMaxSourceCharsScanned,
    maxRepoIndexFiles: ctx.config.limits.promptImportMaxRepoIndexFiles,
    curatedSearchLimit: ctx.config.limits.promptImportCuratedSearchLimit,
    indexCacheTtlMs: ctx.config.limits.promptImportIndexCacheTtlMs,
    maxFolderFiles: ctx.config.limits.promptImportMaxFolderFiles,
    maxFolderPreviewFiles: ctx.config.limits.promptImportMaxFolderPreviewFiles,
  };
}

function sendPromptImportError(res, error) {
  const status = isPromptImportError(error) ? error.status : 500;
  const code = isPromptImportError(error) ? error.code : "PROMPT_IMPORT_FAILED";
  const message = error?.message || "Prompt import failed";
  res.status(status).json({ error: { code, message } });
}

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sourceFilename(source) {
  if (source.kind === "local") return source.filename;
  return source.path.split("/").pop();
}

function normalizeLocalSource(source) {
  const filename = typeof source?.filename === "string" ? source.filename.trim() : "";
  const text = typeof source?.text === "string" ? source.text : "";
  if (!filename || !isSupportedPromptFileName(filename)) {
    throw promptImportError("UNSUPPORTED_EXTENSION", "Only .md, .markdown, and .txt files are supported");
  }
  if (!text.trim()) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "Prompt source is empty", 422);
  }
  return {
    kind: "local",
    filename,
    extension: filename.split(".").pop().toLowerCase(),
    text,
    tags: [`file:${filename}`, `ext:${filename.split(".").pop().toLowerCase()}`],
  };
}

async function buildPreview(req, ctx) {
  const body = req.body || {};
  const rawSource = body.source || body;
  const kind = rawSource.kind === "github" ? "github" : "local";
  const limits = promptImportLimits(ctx);
  let source;
  let text;

  if (kind === "github") {
    source = normalizeGitHubSource(rawSource.input);
    text = await fetchGitHubSourceText(source, limits);
  } else {
    source = normalizeLocalSource(rawSource);
    text = source.text;
  }

  if (text.length > limits.maxSourceCharsScanned) {
    text = text.slice(0, limits.maxSourceCharsScanned);
  }

  const candidates = parsePromptCandidates({
    text,
    filename: sourceFilename(source),
    source: {
      kind: source.kind,
      owner: source.owner,
      repo: source.repo,
      ref: source.ref,
      path: source.path,
      htmlUrl: source.htmlUrl,
      filename: source.filename,
    },
    tags: source.tags,
    limits,
  });

  if (candidates.length === 0) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "No prompt candidates were found", 422);
  }
  return { source, candidates, warnings: [] };
}

function normalizeFolderInput(body) {
  const input = typeof body?.source?.input === "string" ? body.source.input : body?.input;
  return normalizeGitHubFolderSource(input);
}

async function buildFolderFiles(req, ctx) {
  const limits = promptImportLimits(ctx);
  const source = normalizeFolderInput(req.body || {});
  return fetchGitHubFolderFiles(source, limits);
}

async function buildFolderPreview(req, ctx) {
  const limits = promptImportLimits(ctx);
  const source = normalizeFolderInput(req.body || {});
  const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
  const selected = await fetchSelectedGitHubFolderFiles(source, paths, limits);
  const candidates = [];
  const warnings = [...selected.warnings];

  for (const file of selected.files) {
    const text = file.text.length > limits.maxSourceCharsScanned
      ? file.text.slice(0, limits.maxSourceCharsScanned)
      : file.text;
    const parsed = parsePromptCandidates({
      text,
      filename: file.path,
      source: {
        kind: "github",
        owner: source.owner,
        repo: source.repo,
        ref: source.ref,
        path: file.path,
        htmlUrl: file.htmlUrl,
      },
      tags: [...source.tags, `file:${file.name}`, `ext:${file.extension}`],
      limits,
    });
    if (parsed.length === 0) warnings.push(`${file.path}: no prompt candidates`);
    candidates.push(...parsed);
  }

  if (candidates.length === 0) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "No prompt candidates were found", 422);
  }
  return {
    source,
    files: selected.files.map(({ text, contentHash, ...file }) => file),
    candidates: candidates.slice(0, limits.maxPromptCandidatesPerImport),
    warnings,
  };
}

function assertCommitCandidateText(text, limits) {
  if (text.length < limits.minCandidateChars) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "Prompt candidate is too short", 422);
  }
  if (text.length > limits.maxCandidateChars) {
    throw promptImportError("PROMPT_IMPORT_TOO_MANY_CANDIDATES", "Prompt candidate is too large", 413);
  }
}

function commitCandidates(candidates, folderId, limits) {
  const db = getDb();
  const result = { foldersCreated: 0, promptsImported: 0, duplicatesSkipped: 0 };
  const now = Math.floor(Date.now() / 1000);
  const targetFolder = typeof folderId === "string" && folderId ? folderId : "__root__";
  const folderExists = db.prepare("SELECT 1 FROM prompt_folders WHERE id = ? LIMIT 1").get(targetFolder);
  const resolvedFolderId = folderExists ? targetFolder : "__root__";

  for (const candidate of candidates) {
    if (!candidate?.text || typeof candidate.text !== "string") continue;
    const text = candidate.text.trim();
    if (!text) continue;
    assertCommitCandidateText(text, limits);
    const dup = db.prepare("SELECT 1 FROM prompts WHERE text = ? AND folder_id = ? LIMIT 1").get(text, resolvedFolderId);
    if (dup) {
      result.duplicatesSkipped++;
      continue;
    }
    const tagsJson = Array.isArray(candidate.tags) ? JSON.stringify([...new Set(candidate.tags)]) : null;
    db.prepare(
      `INSERT INTO prompts (id, folder_id, name, text, tags, mode, is_favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateId(),
      resolvedFolderId,
      typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : text.slice(0, 30),
      text,
      tagsJson,
      candidate.mode === "direct" || candidate.mode === "auto" ? candidate.mode : null,
      0,
      now,
      now,
    );
    result.promptsImported++;
  }
  return result;
}

export function registerPromptImportRoutes(app, ctx) {
  app.get("/api/prompts/import/curated-sources", async (req, res) => {
    try {
      res.json(getPromptImportSources());
    } catch (error) {
      logError("promptImport", "curated_sources_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/curated-search", async (req, res) => {
    try {
      const result = await searchCuratedPrompts(ctx, {
        q: req.body?.q,
        sourceIds: req.body?.sourceIds,
        limit: req.body?.limit,
      });
      res.json(result);
    } catch (error) {
      logError("promptImport", "curated_search_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/curated-refresh", async (req, res) => {
    try {
      const sourceId = typeof req.body?.sourceId === "string" ? req.body.sourceId : "";
      if (!sourceId) {
        throw promptImportError("INVALID_GITHUB_SOURCE", "Curated source is required", 400);
      }
      const result = await refreshCuratedSource(ctx, sourceId);
      res.json(result);
    } catch (error) {
      logError("promptImport", "curated_refresh_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/folder-files", async (req, res) => {
    try {
      const result = await buildFolderFiles(req, ctx);
      res.json(result);
    } catch (error) {
      logError("promptImport", "folder_files_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/folder-preview", async (req, res) => {
    try {
      const result = await buildFolderPreview(req, ctx);
      res.json(result);
    } catch (error) {
      logError("promptImport", "folder_preview_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/preview", async (req, res) => {
    try {
      const preview = await buildPreview(req, ctx);
      res.json(preview);
    } catch (error) {
      logError("promptImport", "preview_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/commit", async (req, res) => {
    try {
      const limits = promptImportLimits(ctx);
      const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
      if (candidates.length === 0) {
        throw promptImportError("PROMPT_IMPORT_EMPTY", "Select at least one prompt to import", 422);
      }
      if (candidates.length > limits.maxPromptCandidatesPerImport) {
        throw promptImportError("PROMPT_IMPORT_TOO_MANY_CANDIDATES", "Too many prompt candidates", 413);
      }
      const result = commitCandidates(candidates, req.body?.folderId, limits);
      logEvent("promptImport", "committed", result);
      res.json(result);
    } catch (error) {
      logError("promptImport", "commit_error", error);
      sendPromptImportError(res, error);
    }
  });
}
