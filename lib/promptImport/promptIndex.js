import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getCuratedSource, getDefaultSearchSources, listCuratedSources } from "./curatedSources.js";
import { buildGitHubRawFileSource, fetchGitHubSource } from "./githubSource.js";
import { parsePromptCandidates } from "./parsePromptCandidates.js";
import { extractGptImageHints } from "./gptImageHints.js";
import { rankPromptCandidates } from "./rankPromptCandidates.js";
import {
  getDefaultReviewedDiscoverySources,
  getReviewedDiscoverySource,
  listReviewedDiscoverySources,
} from "./discoveryRegistry.js";

const INDEX_VERSION = 1;
const EXTRACTOR_VERSION = 2;

function limitsFromCtx(ctx) {
  return {
    maxFileBytesForPreview: ctx.config.limits.promptImportMaxFileBytes,
    maxPromptCandidatesPerFile: ctx.config.limits.promptImportMaxCandidatesPerFile,
    maxPromptCandidatesPerImport: ctx.config.limits.promptImportMaxCandidatesPerImport,
    fetchTimeoutMs: ctx.config.limits.promptImportFetchTimeoutMs,
    maxCandidateChars: ctx.config.limits.promptImportMaxCandidateChars,
    minCandidateChars: ctx.config.limits.promptImportMinCandidateChars,
    maxSourceCharsScanned: ctx.config.limits.promptImportMaxSourceCharsScanned,
    maxRepoIndexFiles: ctx.config.limits.promptImportMaxRepoIndexFiles,
    searchLimit: ctx.config.limits.promptImportCuratedSearchLimit,
    ttlMs: ctx.config.limits.promptImportIndexCacheTtlMs,
  };
}

function cacheFile(ctx) {
  return ctx.config.storage.promptImportIndexCacheFile;
}

function sourceFileId(source, path) {
  return `github:${source.repo}@${source.defaultRef}:${path}`;
}

function hashId(...parts) {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

async function readCache(ctx) {
  try {
    const parsed = JSON.parse(await readFile(cacheFile(ctx), "utf8"));
    if (parsed.version !== INDEX_VERSION) return { version: INDEX_VERSION, sources: {} };
    return { version: INDEX_VERSION, sources: parsed.sources || {} };
  } catch {
    return { version: INDEX_VERSION, sources: {} };
  }
}

async function writeCache(ctx, cache) {
  const file = cacheFile(ctx);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2));
  await rename(tmp, file);
}

function sourceTags(source, fileSource) {
  return [
    ...fileSource.tags,
    `source:${source.id}`,
    `license:${source.licenseSpdx}`,
    `trust:${source.trustTier}`,
    source.requiresAttribution ? "attribution-required" : null,
  ].filter(Boolean);
}

function indexedCandidate({ candidate, source, fileSource, fileIndex, index }) {
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
    warnings: [...new Set([...(candidate.warnings || []), ...scoreHints.warnings])],
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

async function indexSource(ctx, sourceId) {
  const source = getCuratedSource(sourceId) || await getReviewedDiscoverySource(ctx, sourceId);
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
  const warnings = [];
  const files = [];
  const candidates = [];
  const allowedPaths = source.allowedPaths.slice(0, limits.maxRepoIndexFiles);

  for (const path of allowedPaths) {
    try {
      const fileSource = buildGitHubRawFileSource({
        owner: source.owner,
        repo: source.name,
        ref: source.defaultRef,
        path,
      });
      const fetched = await fetchGitHubSource(fileSource, limits);
      const fileIndex = {
        sourceFileId: sourceFileId(source, path),
        owner: source.owner,
        repo: source.name,
        ref: source.defaultRef,
        path,
        extension: fileSource.extension,
        contentHash: fetched.contentHash,
        etag: fetched.etag,
        sizeBytes: fetched.sizeBytes,
        licenseSpdx: source.licenseSpdx,
        htmlUrl: fileSource.htmlUrl,
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
      warnings.push(`${path}: ${error?.message || "index failed"}`);
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

function isFresh(entry, ttlMs) {
  return entry?.refreshedAt && Date.now() - entry.refreshedAt < ttlMs;
}

async function ensureSearchCache(ctx) {
  const cache = await readCache(ctx);
  const limits = limitsFromCtx(ctx);
  const sources = [
    ...getDefaultSearchSources(),
    ...await getDefaultReviewedDiscoverySources(ctx),
  ];
  let changed = false;
  const warnings = [];

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

export async function refreshCuratedSource(ctx, sourceId) {
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

export async function searchCuratedPrompts(ctx, { q = "", sourceIds, limit } = {}) {
  const { cache, warnings } = await ensureSearchCache(ctx);
  const limits = limitsFromCtx(ctx);
  const defaultSources = [
    ...getDefaultSearchSources(),
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

export async function getPromptImportSources(ctx) {
  const reviewed = ctx ? await listReviewedDiscoverySources(ctx) : [];
  return { sources: [...listCuratedSources(), ...reviewed] };
}
