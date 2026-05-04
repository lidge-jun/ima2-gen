import type { Express, Request, Response } from "express";
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
import { searchGitHubDiscovery } from "../lib/promptImport/githubDiscovery.js";
import {
  listDiscoveryCandidates,
  reviewDiscoveryCandidate,
} from "../lib/promptImport/discoveryRegistry.js";
import { requireRuntimeContext, type RouteRuntimeContext, type RuntimeContext } from "../lib/runtimeContext.js";
import type { GitHubFileSource } from "../lib/promptImport/types.js";

interface LocalSource {
  kind: "local";
  filename: string;
  extension: string;
  text: string;
  tags: string[];
}

type ParsedSource = LocalSource | (GitHubFileSource & { kind?: string; filename?: string });

type ImportLimits = ReturnType<typeof promptImportLimits>;

interface CandidateLike {
  text?: string;
  name?: string;
  tags?: unknown;
  mode?: string;
}

function promptImportLimits(ctx: RuntimeContext) {
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
    discoverySearchLimit: ctx.config.limits.promptImportDiscoverySearchLimit,
    discoveryMaxQueries: ctx.config.limits.promptImportDiscoveryMaxQueries,
  };
}

function sendPromptImportError(res: Response, error: unknown) {
  const errAsAny = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const status = isPromptImportError(error) && typeof errAsAny.status === "number" ? errAsAny.status : 500;
  const code = isPromptImportError(error) && typeof errAsAny.code === "string" ? errAsAny.code : "PROMPT_IMPORT_FAILED";
  const message = typeof errAsAny.message === "string" ? errAsAny.message : "Prompt import failed";
  res.status(status).json({ error: { code, message } });
}

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sourceFilename(source: ParsedSource): string {
  if (source.kind === "local" && "filename" in source && typeof source.filename === "string") return source.filename;
  const gh = source as GitHubFileSource & { filename?: string };
  if (typeof gh.filename === "string" && gh.filename) return gh.filename;
  if (typeof gh.path === "string" && gh.path) return gh.path.split("/").pop() ?? "";
  return "";
}

function normalizeLocalSource(source: { filename?: unknown; text?: unknown }): LocalSource {
  const filename = typeof source?.filename === "string" ? source.filename.trim() : "";
  const text = typeof source?.text === "string" ? source.text : "";
  if (!filename || !isSupportedPromptFileName(filename)) {
    throw promptImportError("UNSUPPORTED_EXTENSION", "Only .md, .markdown, and .txt files are supported");
  }
  if (!text.trim()) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "Prompt source is empty", 422);
  }
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return {
    kind: "local",
    filename,
    extension: ext,
    text,
    tags: [`file:${filename}`, `ext:${ext}`],
  };
}

async function buildPreview(req: Request, ctx: RuntimeContext) {
  const body = (req.body ?? {}) as { source?: { kind?: string; input?: unknown } & Record<string, unknown> } & Record<string, unknown>;
  const rawSource = (body.source ?? body) as { kind?: string; input?: unknown; filename?: unknown; text?: unknown };
  const kind = rawSource.kind === "github" ? "github" : "local";
  const limits = promptImportLimits(ctx);
  let source: ParsedSource;
  let text: string;

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
      kind: source.kind ?? "github",
      owner: (source as GitHubFileSource).owner,
      repo: (source as GitHubFileSource).repo,
      ref: (source as GitHubFileSource).ref,
      path: (source as GitHubFileSource).path,
      htmlUrl: (source as GitHubFileSource).htmlUrl,
      filename: (source as ParsedSource).filename,
    },
    tags: source.tags,
    limits,
  });

  if (candidates.length === 0) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "No prompt candidates were found", 422);
  }
  return { source, candidates, warnings: [] };
}

function normalizeFolderInput(body: { source?: { input?: unknown }; input?: unknown }) {
  const input = typeof body?.source?.input === "string" ? body.source.input : body?.input;
  return normalizeGitHubFolderSource(input);
}

async function buildFolderFiles(req: Request, ctx: RuntimeContext) {
  const limits = promptImportLimits(ctx);
  const source = normalizeFolderInput((req.body ?? {}) as { source?: { input?: unknown }; input?: unknown });
  return fetchGitHubFolderFiles(source, limits);
}

async function buildFolderPreview(req: Request, ctx: RuntimeContext) {
  const limits = promptImportLimits(ctx);
  const body = (req.body ?? {}) as { source?: { input?: unknown }; input?: unknown; paths?: unknown };
  const source = normalizeFolderInput(body);
  const paths = Array.isArray(body.paths) ? (body.paths as string[]) : [];
  const selected = await fetchSelectedGitHubFolderFiles(source, paths, limits);
  const candidates: ReturnType<typeof parsePromptCandidates> = [];
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
      tags: [...(source.tags ?? []), `file:${file.name}`, `ext:${file.extension}`],
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
    files: selected.files.map(({ text: _t, contentHash: _h, ...file }) => file),
    candidates: candidates.slice(0, limits.maxPromptCandidatesPerImport),
    warnings,
  };
}

function assertCommitCandidateText(text: string, limits: ImportLimits) {
  if (text.length < limits.minCandidateChars) {
    throw promptImportError("PROMPT_IMPORT_EMPTY", "Prompt candidate is too short", 422);
  }
  if (text.length > limits.maxCandidateChars) {
    throw promptImportError("PROMPT_IMPORT_TOO_MANY_CANDIDATES", "Prompt candidate is too large", 413);
  }
}

function commitCandidates(candidates: CandidateLike[], folderId: unknown, limits: ImportLimits) {
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

export function registerPromptImportRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.get("/api/prompts/import/curated-sources", async (_req: Request, res: Response) => {
    try {
      res.json(await getPromptImportSources(ctx));
    } catch (error) {
      logError("promptImport", "curated_sources_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.get("/api/prompts/import/discovery", async (req: Request, res: Response) => {
    try {
      const status = req.query?.status;
      const candidates = await listDiscoveryCandidates(ctx, {
        status: typeof status === "string" ? status : undefined,
      });
      res.json({ candidates, warnings: [] });
    } catch (error) {
      logError("promptImport", "discovery_list_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/discovery-search", async (req: Request, res: Response) => {
    try {
      const limits = promptImportLimits(ctx);
      const body = (req.body ?? {}) as { seeds?: unknown; q?: unknown; limit?: unknown };
      const seeds = Array.isArray(body.seeds) ? (body.seeds as string[]) : [];
      if (seeds.length > limits.discoveryMaxQueries) {
        throw promptImportError("GITHUB_DISCOVERY_TOO_MANY_QUERIES", "Too many discovery queries", 413);
      }
      const result = await searchGitHubDiscovery(ctx, {
        q: typeof body.q === "string" ? body.q : undefined,
        seeds,
        limit: typeof body.limit === "number" ? body.limit : undefined,
        maxQueries: limits.discoveryMaxQueries,
      });
      res.json(result);
    } catch (error) {
      logError("promptImport", "discovery_search_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/discovery-review", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await reviewDiscoveryCandidate(ctx, body as Parameters<typeof reviewDiscoveryCandidate>[1]);
      res.json(result);
    } catch (error) {
      logError("promptImport", "discovery_review_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/curated-search", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await searchCuratedPrompts(ctx, body as Parameters<typeof searchCuratedPrompts>[1]);
      res.json(result);
    } catch (error) {
      logError("promptImport", "curated_search_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/curated-refresh", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { sourceId?: unknown };
      const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
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

  app.post("/api/prompts/import/folder-files", async (req: Request, res: Response) => {
    try {
      const result = await buildFolderFiles(req, ctx);
      res.json(result);
    } catch (error) {
      logError("promptImport", "folder_files_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/folder-preview", async (req: Request, res: Response) => {
    try {
      const result = await buildFolderPreview(req, ctx);
      res.json(result);
    } catch (error) {
      logError("promptImport", "folder_preview_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/preview", async (req: Request, res: Response) => {
    try {
      const preview = await buildPreview(req, ctx);
      res.json(preview);
    } catch (error) {
      logError("promptImport", "preview_error", error);
      sendPromptImportError(res, error);
    }
  });

  app.post("/api/prompts/import/commit", async (req: Request, res: Response) => {
    try {
      const limits = promptImportLimits(ctx);
      const body = (req.body ?? {}) as { candidates?: unknown; folderId?: unknown };
      const candidates = Array.isArray(body.candidates) ? (body.candidates as CandidateLike[]) : [];
      if (candidates.length === 0) {
        throw promptImportError("PROMPT_IMPORT_EMPTY", "Select at least one prompt to import", 422);
      }
      if (candidates.length > limits.maxPromptCandidatesPerImport) {
        throw promptImportError("PROMPT_IMPORT_TOO_MANY_CANDIDATES", "Too many prompt candidates", 413);
      }
      const result = commitCandidates(candidates, body.folderId, limits);
      logEvent("promptImport", "committed", result);
      res.json(result);
    } catch (error) {
      logError("promptImport", "commit_error", error);
      sendPromptImportError(res, error);
    }
  });
}
