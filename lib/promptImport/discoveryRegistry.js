import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promptImportError } from "./errors.js";
const REGISTRY_VERSION = 1;
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;
const SUPPORTED_EXTENSIONS = new Set(["md", "markdown", "txt"]);
function registryFile(ctx) {
    return ctx.config.storage.promptImportDiscoveryRegistryFile;
}
function emptyRegistry() {
    return { version: REGISTRY_VERSION, updatedAt: null, candidates: {} };
}
function normalizeRepoFullName(repo) {
    const value = String(repo || "").trim();
    const parts = value.split("/");
    if (parts.length !== 2 || !OWNER_REPO_RE.test(parts[0]) || !OWNER_REPO_RE.test(parts[1])) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Review repo must be owner/repo");
    }
    return `${parts[0]}/${parts[1]}`;
}
function extensionForPath(path) {
    const match = /\.([A-Za-z0-9]+)$/.exec(path);
    return match?.[1]?.toLowerCase() ?? "";
}
function assertAllowedPath(path) {
    const value = String(path || "").trim();
    if (!value) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed path is required");
    }
    if (/^https?:\/\//i.test(value)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed path must be repo-relative");
    }
    if (value.includes("\0") || /%00/i.test(value)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed path contains a null byte");
    }
    if (/%2f|%5c/i.test(value)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed path contains an encoded slash");
    }
    if (value.includes("\\") || value.split("/").includes("..")) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed path traversal is not allowed");
    }
    const clean = value.replace(/^\/+/, "");
    const extension = extensionForPath(clean);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Allowed paths must be .md, .markdown, or .txt");
    }
    return clean;
}
function normalizeAllowedPaths(paths, limits) {
    if (paths === undefined)
        return [];
    if (!Array.isArray(paths)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "allowedPaths must be an array");
    }
    if (paths.length > limits.maxRepoIndexFiles) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Too many allowed paths", 413);
    }
    return [...new Set(paths.map(assertAllowedPath))];
}
function publicCandidate(candidate) {
    return {
        id: candidate.id,
        repo: candidate.repo,
        owner: candidate.owner,
        name: candidate.name,
        fullName: candidate.fullName,
        htmlUrl: candidate.htmlUrl,
        description: candidate.description,
        defaultBranch: candidate.defaultBranch,
        stars: candidate.stars,
        forks: candidate.forks,
        openIssues: candidate.openIssues,
        updatedAt: candidate.updatedAt,
        pushedAt: candidate.pushedAt,
        licenseSpdx: candidate.licenseSpdx,
        topics: Array.isArray(candidate.topics) ? [...candidate.topics] : [],
        language: candidate.language,
        score: candidate.score,
        scoreReasons: Array.isArray(candidate.scoreReasons) ? [...candidate.scoreReasons] : [],
        warnings: Array.isArray(candidate.warnings) ? [...candidate.warnings] : [],
        status: candidate.status || "candidate",
        query: candidate.query,
        discoveredAt: candidate.discoveredAt,
        reviewedAt: candidate.reviewedAt || null,
        reviewNotes: candidate.reviewNotes || "",
        approvedSource: candidate.approvedSource || null,
    };
}
function reviewedSourceId(candidate) {
    return `discovered-${candidate.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
export async function readDiscoveryRegistry(ctx) {
    try {
        const parsed = JSON.parse(await readFile(registryFile(ctx), "utf8"));
        if (parsed.version !== REGISTRY_VERSION)
            return emptyRegistry();
        return {
            version: REGISTRY_VERSION,
            updatedAt: parsed.updatedAt || null,
            candidates: parsed.candidates || {},
        };
    }
    catch {
        return emptyRegistry();
    }
}
export async function writeDiscoveryRegistry(ctx, registry) {
    const file = registryFile(ctx);
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(registry, null, 2));
    await rename(tmp, file);
}
export async function listDiscoveryCandidates(ctx, filters = {}) {
    const registry = await readDiscoveryRegistry(ctx);
    const status = typeof filters.status === "string" ? filters.status : null;
    return Object.values(registry.candidates)
        .filter((candidate) => !status || candidate.status === status)
        .map(publicCandidate)
        .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName));
}
export async function upsertDiscoveryCandidates(ctx, candidates) {
    const registry = await readDiscoveryRegistry(ctx);
    const now = new Date().toISOString();
    for (const candidate of candidates) {
        const fullName = normalizeRepoFullName(candidate.fullName || candidate.repo);
        const existing = registry.candidates[fullName];
        registry.candidates[fullName] = {
            ...existing,
            ...candidate,
            fullName,
            repo: fullName,
            status: existing?.status || candidate.status || "candidate",
            discoveredAt: existing?.discoveredAt || candidate.discoveredAt || now,
        };
    }
    registry.updatedAt = now;
    await writeDiscoveryRegistry(ctx, registry);
    return Object.values(registry.candidates).map(publicCandidate);
}
export function reviewedSourceFromCandidate(candidate) {
    const [owner, name] = String(candidate.fullName || candidate.repo).split("/");
    const allowedPaths = Array.isArray(candidate.allowedPaths) ? candidate.allowedPaths : [];
    return {
        id: reviewedSourceId(candidate),
        repo: `${owner}/${name}`,
        owner,
        name,
        displayName: candidate.name || name,
        defaultRef: candidate.defaultBranch || "main",
        allowedPaths,
        extensions: ["md", "markdown", "txt"],
        sourceType: "discovered",
        licenseSpdx: candidate.licenseSpdx || "NOASSERTION",
        requiresAttribution: true,
        trustTier: "reviewed",
        lastVerifiedAt: candidate.reviewedAt || null,
        notes: candidate.reviewNotes || candidate.description || "Reviewed GitHub discovery source.",
        searchSeeds: [candidate.name, candidate.description, ...(candidate.topics || [])].filter(Boolean).slice(0, 8),
        defaultSearch: Boolean(candidate.defaultSearch && allowedPaths.length > 0 && !String(candidate.defaultBranch || "").includes("/")),
    };
}
export async function reviewDiscoveryCandidate(ctx, payload) {
    const limits = {
        maxRepoIndexFiles: ctx.config.limits.promptImportMaxRepoIndexFiles,
    };
    const repo = normalizeRepoFullName(payload?.repo);
    const status = String(payload?.status || "");
    if (!["approved", "rejected"].includes(status)) {
        throw promptImportError("GITHUB_DISCOVERY_REVIEW_INVALID", "Review status must be approved or rejected");
    }
    const registry = await readDiscoveryRegistry(ctx);
    const candidate = registry.candidates[repo];
    if (!candidate) {
        throw promptImportError("GITHUB_DISCOVERY_SOURCE_NOT_FOUND", "Discovery candidate was not found", 404);
    }
    const allowedPaths = normalizeAllowedPaths(payload?.allowedPaths, limits);
    const warnings = [...(candidate.warnings || [])];
    const defaultBranch = String(candidate.defaultBranch || "");
    let defaultSearch = Boolean(payload?.defaultSearch);
    if (status !== "approved" || allowedPaths.length === 0)
        defaultSearch = false;
    if (defaultBranch.includes("/")) {
        defaultSearch = false;
        warnings.push("discovery-default-branch-unsupported");
    }
    if (status === "approved" && allowedPaths.length === 0) {
        warnings.push("discovery-requires-paths");
    }
    const reviewed = {
        ...candidate,
        allowedPaths,
        status,
        warnings: [...new Set(warnings)],
        defaultSearch,
        reviewedAt: new Date().toISOString(),
        reviewNotes: typeof payload?.reviewNotes === "string" ? payload.reviewNotes.slice(0, 500) : "",
    };
    reviewed.approvedSource = status === "approved" ? reviewedSourceFromCandidate(reviewed) : null;
    registry.candidates[repo] = reviewed;
    registry.updatedAt = reviewed.reviewedAt;
    await writeDiscoveryRegistry(ctx, registry);
    return { candidate: publicCandidate(reviewed), source: reviewed.approvedSource, warnings: reviewed.warnings };
}
export async function listReviewedDiscoverySources(ctx, { defaultSearchOnly = false } = {}) {
    const registry = await readDiscoveryRegistry(ctx);
    return Object.values(registry.candidates)
        .filter((candidate) => candidate.status === "approved" && candidate.approvedSource)
        .map((candidate) => candidate.approvedSource)
        .filter((source) => !defaultSearchOnly || source.defaultSearch);
}
export async function getReviewedDiscoverySource(ctx, sourceId) {
    const sources = await listReviewedDiscoverySources(ctx);
    return sources.find((source) => source.id === sourceId) || null;
}
export async function getDefaultReviewedDiscoverySources(ctx) {
    return listReviewedDiscoverySources(ctx, { defaultSearchOnly: true });
}
