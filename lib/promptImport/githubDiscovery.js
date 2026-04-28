import { createHash } from "node:crypto";
import { promptImportError } from "./errors.js";
import { upsertDiscoveryCandidates } from "./discoveryRegistry.js";

const GITHUB_API_HOST = "api.github.com";
const DEFAULT_DISCOVERY_SEEDS = [
  "gpt-image-2 prompt",
  "image generation prompts",
  "nano banana prompts",
  "product photography prompt",
  "typography image prompt",
  "reference image prompt",
];

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣-]+/i)
    .filter(Boolean);
}

function discoveryLimits(ctx) {
  return {
    limit: ctx.config.limits.promptImportDiscoverySearchLimit,
    maxQueries: ctx.config.limits.promptImportDiscoveryMaxQueries,
    fetchTimeoutMs: ctx.config.limits.promptImportFetchTimeoutMs,
  };
}

function validateGitHubApiUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw promptImportError("GITHUB_DISCOVERY_FAILED", "GitHub discovery returned an invalid URL");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.hostname !== GITHUB_API_HOST) {
    throw promptImportError("GITHUB_DISCOVERY_FAILED", "GitHub discovery redirected to an unsupported host");
  }
}

function rateLimitFromHeaders(headers) {
  const remaining = Number(headers.get("x-ratelimit-remaining") || Number.NaN);
  const reset = Number(headers.get("x-ratelimit-reset") || Number.NaN);
  const limit = Number(headers.get("x-ratelimit-limit") || Number.NaN);
  return {
    limit: Number.isFinite(limit) ? limit : null,
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt: Number.isFinite(reset) ? new Date(reset * 1000).toISOString() : null,
  };
}

function searchHeaders(ctx) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ima2-prompt-import-discovery",
  };
  const token = ctx.config.github?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function buildDiscoveryQueries({ q = "", seeds = [], limit = 5 } = {}) {
  const raw = [q, ...seeds, ...DEFAULT_DISCOVERY_SEEDS]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const unique = [...new Set(raw)];
  if (unique.length === 0) {
    throw promptImportError("GITHUB_DISCOVERY_QUERY_EMPTY", "Discovery query is required", 422);
  }
  return unique.slice(0, Math.max(1, Number(limit) || 1));
}

export function scoreDiscoveryRepository(repo, context = {}) {
  const terms = tokenize([context.query, ...(context.seeds || [])].join(" "));
  const nameText = `${repo.full_name || ""} ${repo.description || ""} ${(repo.topics || []).join(" ")}`.toLowerCase();
  const pushedAt = repo.pushed_at ? Date.parse(repo.pushed_at) : 0;
  const daysSincePush = pushedAt ? (Date.now() - pushedAt) / 86_400_000 : Number.POSITIVE_INFINITY;
  const scoreReasons = [];
  const warnings = [];
  let score = 0;

  const stars = Number(repo.stargazers_count || 0);
  if (stars > 1000) {
    score += 20;
    scoreReasons.push("popular-repo");
  } else if (stars > 100) {
    score += 12;
    scoreReasons.push("known-repo");
  } else if (stars > 10) {
    score += 5;
    scoreReasons.push("some-stars");
  }

  if (daysSincePush <= 365) {
    score += 10;
    scoreReasons.push("recently-updated");
  } else {
    score -= 6;
    warnings.push("stale-repo");
  }

  if (repo.license?.spdx_id) {
    score += 8;
    scoreReasons.push("license-present");
  } else {
    score -= 8;
    warnings.push("no-license");
  }

  if (repo.archived || repo.disabled) {
    score -= 20;
    warnings.push("archived-or-disabled");
  }
  if (repo.fork) {
    score -= 4;
    warnings.push("fork-source");
  }
  if (!repo.default_branch) {
    score -= 10;
    warnings.push("missing-default-branch");
  } else if (String(repo.default_branch).includes("/")) {
    warnings.push("discovery-default-branch-unsupported");
  }

  const promptTerms = ["prompt", "image", "generation", "gpt-image", "nano", "typography", "reference"];
  if (promptTerms.some((term) => nameText.includes(term))) {
    score += 14;
    scoreReasons.push("prompt-like");
  }
  for (const term of terms) {
    if (term && nameText.includes(term)) score += 3;
  }
  if (!repo.html_url || !String(repo.html_url).startsWith("https://github.com/")) {
    score -= 20;
    warnings.push("non-github-url");
  }

  return { score, scoreReasons: [...new Set(scoreReasons)], warnings: [...new Set(warnings)] };
}

export function normalizeDiscoveryCandidate(repo, context = {}) {
  const fullName = String(repo.full_name || "").trim();
  const [owner, name] = fullName.split("/");
  const scored = scoreDiscoveryRepository(repo, context);
  return {
    id: `github:${fullName}`,
    repo: fullName,
    owner,
    name,
    fullName,
    htmlUrl: repo.html_url,
    description: repo.description || "",
    defaultBranch: repo.default_branch || "main",
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    openIssues: Number(repo.open_issues_count || 0),
    updatedAt: repo.updated_at || null,
    pushedAt: repo.pushed_at || null,
    licenseSpdx: repo.license?.spdx_id || "NOASSERTION",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    language: repo.language || null,
    score: scored.score,
    scoreReasons: scored.scoreReasons,
    warnings: scored.warnings,
    status: "candidate",
    query: context.query || "",
    discoveredAt: new Date().toISOString(),
  };
}

export function discoveryCacheKey(input) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function searchOneQuery(ctx, query, perPage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), discoveryLimits(ctx).fetchTimeoutMs);
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${query} in:name,description`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));
  try {
    const response = await fetch(url, {
      headers: searchHeaders(ctx),
      signal: controller.signal,
    });
    validateGitHubApiUrl(response.url);
    const rateLimit = rateLimitFromHeaders(response.headers);
    if (response.status === 403 || response.status === 429) {
      throw promptImportError("GITHUB_RATE_LIMITED", "GitHub discovery rate limit reached", 429);
    }
    if (!response.ok) {
      throw promptImportError("GITHUB_DISCOVERY_FAILED", `GitHub discovery failed with ${response.status}`, 422);
    }
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return { items, rateLimit };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub discovery timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGitHubDiscovery(ctx, options = {}) {
  const limits = discoveryLimits(ctx);
  const queryLimit = Math.min(Number(options.maxQueries) || limits.maxQueries, limits.maxQueries);
  const queries = buildDiscoveryQueries({
    q: options.q,
    seeds: options.seeds,
    limit: queryLimit,
  });
  const requestedLimit = Math.min(Number(options.limit) || limits.limit, limits.limit);
  const perQuery = Math.max(1, Math.ceil(requestedLimit / queries.length));
  const warnings = [];
  let rateLimit = null;
  const byRepo = new Map();

  for (const query of queries) {
    const result = await searchOneQuery(ctx, query, perQuery);
    rateLimit = result.rateLimit;
    for (const repo of result.items) {
      const candidate = normalizeDiscoveryCandidate(repo, {
        query,
        seeds: options.seeds,
      });
      const existing = byRepo.get(candidate.fullName);
      if (!existing || candidate.score > existing.score) {
        byRepo.set(candidate.fullName, candidate);
      }
    }
  }

  const candidates = [...byRepo.values()]
    .filter((candidate) => candidate.fullName && candidate.htmlUrl?.startsWith("https://github.com/"))
    .sort((a, b) => b.score - a.score || b.stars - a.stars)
    .slice(0, requestedLimit);

  await upsertDiscoveryCandidates(ctx, candidates);
  if (rateLimit?.remaining === 0) warnings.push("github-rate-limit-exhausted");
  return { candidates, warnings, rateLimit, cacheKey: discoveryCacheKey({ queries, requestedLimit }) };
}
