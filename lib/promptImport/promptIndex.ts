import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getCuratedSource, getDefaultSearchSources, listCuratedSources } from "./curatedSources.js";
import { buildGitHubRawFileSource, fetchGitHubSource } from "./githubSource.js";
import { parsePromptCandidates } from "./parsePromptCandidates.js";
import { extractGptImageHints } from "./gptImageHints.js";
import { rankPromptCandidates } from "./rankPromptCandidates.js";
import { errInfo } from "../errInfo.js";
import { requireRuntimeContext } from "../runtimeContext.js";
import {
  getDefaultReviewedDiscoverySources,
  getReviewedDiscoverySource,
  listReviewedDiscoverySources,
} from "./discoveryRegistry.js";
import type {
  CuratedSourceLike,
  GitHubFileSource,
  PromptCandidate,
  PromptImportCtx,
  PromptImportLimits,
} from "./types.js";

const INDEX_VERSION = 1;
const EXTRACTOR_VERSION = 2;

interface IndexedFile {
  sourceFileId: string;
  owner: string | undefined;
  repo: string;
  ref: string;
  path: string;
  extension: string;
  contentHash: string;
  etag: string | null;
  sizeBytes: number;
  licenseSpdx: string;
  htmlUrl: string;
  indexedAt: string;
  lastFetchStatus: string;
  promptCandidateCount: number;
  extractorVersion: number;
}

interface IndexedCandidate extends PromptCandidate {
  candidateId: string;
}

interface CacheEntry {
  source: CuratedSourceLike;
  files: IndexedFile[];
  candidates: IndexedCandidate[];
  refreshedAt: number;
}

interface IndexCache {
  version: number;
  sources: Record<string, CacheEntry>;
}

interface IndexLimits extends PromptImportLimits {
  searchLimit: number;
  ttlMs: number;
}

function limitsFromCtx(ctx: PromptImportCtx): IndexLimits {
  const limits = (ctx.config?.limits ?? {}) as Record<string, number>;
  return {
    maxFileBytesForPreview: limits.promptImportMaxFileBytes,
    maxPromptCandidatesPerFile: limits.promptImportMaxCandidatesPerFile,
    maxPromptCandidatesPerImport: limits.promptImportMaxCandidatesPerImport,
    fetchTimeoutMs: limits.promptImportFetchTimeoutMs,
    maxCandidateChars: limits.promptImportMaxCandidateChars,
    minCandidateChars: limits.promptImportMinCandidateChars,
    maxSourceCharsScanned: limits.promptImportMaxSourceCharsScanned,
    maxRepoIndexFiles: limits.promptImportMaxRepoIndexFiles,
    maxFolderFiles: limits.promptImportMaxFolderFiles ?? 0,
    maxFolderPreviewFiles: limits.promptImportMaxFolderPreviewFiles ?? 0,
    searchLimit: limits.promptImportCuratedSearchLimit,
    ttlMs: limits.promptImportIndexCacheTtlMs,
  };
}

function cacheFile(ctx: PromptImportCtx): string {
  const storage = (ctx.config as { storage?: { promptImportIndexCacheFile?: string } } | undefined)?.storage;
  return storage?.promptImportIndexCacheFile ?? "";
}

function sourceFileId(source: CuratedSourceLike, path: string): string {
  return `github:${source.repo}@${source.defaultRef}:${path}`;
}

function hashId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

async function readCache(ctx: PromptImportCtx): Promise<IndexCache> {
  try {
    const parsed = JSON.parse(await readFile(cacheFile(ctx), "utf8")) as IndexCache;
    if (parsed.version !== INDEX_VERSION) return { version: INDEX_VERSION, sources: {} };
    return { version: INDEX_VERSION, sources: parsed.sources || {} };
  } catch {
    return { version: INDEX_VERSION, sources: {} };
  }
}

async function writeCache(ctx: PromptImportCtx, cache: IndexCache): Promise<void> {
  const file = cacheFile(ctx);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2));
  await rename(tmp, file);
}

function sourceTags(source: CuratedSourceLike, fileSource: GitHubFileSource): string[] {
  return [
    ...(fileSource.tags ?? []),
    `source:${source.id}`,
    `license:${source.licenseSpdx}`,
    `trust:${source.trustTier}`,
    source.requiresAttribution ? "attribution-required" : null,
  ].filter(Boolean) as string[];
}

interface IndexedCandidateInput {
  candidate: PromptCandidate;
  source: CuratedSourceLike;
  fileSource: GitHubFileSource;
  fileIndex: IndexedFile;
  index: number;
}

function indexedCandidate({ candidate, source, fileSource, fileIndex, index }: IndexedCandidateInput): IndexedCandidate {
  const scoreHints = extractGptImageHints(candidate.text);
  const headingPath = candidate.headingPath || candidate.name || "";
  const candidateId = hashId(fileIndex.sourceFileId, fileIndex.contentHash, headingPath, String(candidate.ordinal || index + 1));
  const tags = [...new Set([...(candidate.tags || []), ...sourceTags(source, fileSource)])];
  return {
    ...candidate,
    id: candidateId,
    candidateId,
    name: candidate.name,
    text: candidate.text,
    textPreview: candidate.textPreview || candidate.text.slice(0, 220),
    tags,
    warnings: [...new Set([...(candidate.warnings || []), ...(scoreHints.warnings ?? [])])],
    source: {
      kind: "github",
      owner: source.owner,
      repo: source.name,
      ref: source.defaultRef,
      path: fileSource.path,
      htmlUrl: fileSource.htmlUrl,
      sourceId: source.id,
    },
    sourceFileId: fileIndex.sourceFileId,
    headingPath,
    ordinal: candidate.ordinal || index + 1,
    promptHash: candidate.promptHash || hashId(candidate.text.trim().toLowerCase()),
    scoreHints,
  };
}

interface IndexSourceResult {
  source: CuratedSourceLike | null | undefined;
  indexedFiles: number;
  candidateCount: number;
  warnings: string[];
  entry?: CacheEntry;
}

async function indexSource(ctx: PromptImportCtx, sourceId: string): Promise<IndexSourceResult> {
  const source = (getCuratedSource(sourceId) as CuratedSourceLike | undefined) || await getReviewedDiscoverySource(ctx, sourceId);
  if (!source || source.trustTier === "manual-review") {
    return { source, indexedFiles: 0, candidateCount: 0, warnings: ["curated-source-unavailable"] };
  }
  if (String(source.defaultRef || "").includes("/")) {
    return { source, indexedFiles: 0, candidateCount: 0, warnings: ["discovery-default-branch-unsupported"] };
  }
  if (!Array.isArray(source.allowedPaths) || source.allowedPaths.length === 0) {
    return { source, indexedFiles: 0, candidateCount: 0, warnings: ["discovery-requires-paths"] };
  }

  const limits = limitsFromCtx(ctx);
  const warnings: string[] = [];
  const files: IndexedFile[] = [];
  const candidates: IndexedCandidate[] = [];
  const allowedPaths = source.allowedPaths.slice(0, limits.maxRepoIndexFiles);

  for (const path of allowedPaths) {
    try {
      const fileSource = buildGitHubRawFileSource({
        owner: source.owner ?? "",
        repo: source.name ?? source.repo,
        ref: source.defaultRef,
        path,
      });
      const fetched = await fetchGitHubSource(fileSource, limits);
      const fileIndex: IndexedFile = {
        sourceFileId: sourceFileId(source, path),
        owner: source.owner,
        repo: source.name ?? source.repo,
        ref: source.defaultRef,
        path,
        extension: fileSource.extension ?? "",
        contentHash: fetched.contentHash,
        etag: fetched.etag,
        sizeBytes: fetched.sizeBytes,
        licenseSpdx: source.licenseSpdx,
        htmlUrl: fileSource.htmlUrl ?? "",
        indexedAt: new Date().toISOString(),
        lastFetchStatus: "ok",
        promptCandidateCount: 0,
        extractorVersion: EXTRACTOR_VERSION,
      };
      const parsed = parsePromptCandidates({
        text: fetched.text,
        filename: path,
        source: { kind: "github", owner: source.owner, repo: source.name, ref: source.defaultRef, path, htmlUrl: fileSource.htmlUrl },
        tags: sourceTags(source, fileSource),
        limits,
      });
      const indexed = parsed.map((candidate, index) => indexedCandidate({ candidate, source, fileSource, fileIndex, index }));
      fileIndex.promptCandidateCount = indexed.length;
      files.push(fileIndex);
      candidates.push(...indexed);
    } catch (error) {
      const err = errInfo(error);
      warnings.push(`${path}: ${err.message || "index failed"}`);
    }
  }

  return {
    source,
    indexedFiles: files.length,
    candidateCount: candidates.length,
    warnings,
    entry: {
      source,
      files,
      candidates,
      refreshedAt: Date.now(),
    },
  };
}

function isFresh(entry: CacheEntry | undefined, ttlMs: number): boolean {
  return Boolean(entry?.refreshedAt && Date.now() - entry.refreshedAt < ttlMs);
}

async function ensureSearchCache(ctx: PromptImportCtx) {
  const cache = await readCache(ctx);
  const limits = limitsFromCtx(ctx);
  const sources = [
    ...getDefaultSearchSources() as CuratedSourceLike[],
    ...await getDefaultReviewedDiscoverySources(ctx),
  ];
  let changed = false;
  const warnings: string[] = [];

  for (const source of sources) {
    if (isFresh(cache.sources[source.id], limits.ttlMs)) continue;
    const result = await indexSource(ctx, source.id);
    if (result.entry) {
      cache.sources[source.id] = result.entry;
      changed = true;
    }
    warnings.push(...result.warnings);
  }
  if (changed) await writeCache(ctx, cache);
  return { cache, warnings };
}

export async function refreshCuratedSource(ctxIn: PromptImportCtx, sourceId: string) {
  const ctx = requireRuntimeContext(ctxIn);
  const cache = await readCache(ctx);
  const result = await indexSource(ctx, sourceId);
  if (result.entry) {
    cache.sources[sourceId] = result.entry;
    await writeCache(ctx, cache);
  }
  return {
    source: result.source,
    indexedFiles: result.indexedFiles,
    candidateCount: result.candidateCount,
    warnings: result.warnings,
  };
}

interface SearchCuratedPromptsOptions {
  q?: string;
  sourceIds?: string[];
  limit?: number;
}

export async function searchCuratedPrompts(ctxIn: PromptImportCtx, { q = "", sourceIds, limit }: SearchCuratedPromptsOptions = {}) {
  const ctx = requireRuntimeContext(ctxIn);
  const { cache, warnings } = await ensureSearchCache(ctx);
  const limits = limitsFromCtx(ctx);
  const defaultSources = [
    ...getDefaultSearchSources() as CuratedSourceLike[],
    ...await getDefaultReviewedDiscoverySources(ctx),
  ];
  const allowedIds = Array.isArray(sourceIds) && sourceIds.length
    ? new Set(sourceIds)
    : new Set(defaultSources.map((source) => source.id));
  const candidates = Object.values(cache.sources)
    .filter((entry) => allowedIds.has(entry.source.id))
    .flatMap((entry) => entry.candidates || []);
  const results = rankPromptCandidates({
    candidates,
    query: q,
    limit: Math.min(Number(limit) || limits.searchLimit, limits.searchLimit),
  });
  const sources = [
    ...listCuratedSources(),
    ...await listReviewedDiscoverySources(ctx),
  ];
  return { results, sources, warnings };
}

export async function getPromptImportSources(ctxIn: PromptImportCtx | null) {
  const ctx = ctxIn ? requireRuntimeContext(ctxIn) : null;
  const reviewed = ctx ? await listReviewedDiscoverySources(ctx) : [];
  return { sources: [...listCuratedSources(), ...reviewed] };
}
