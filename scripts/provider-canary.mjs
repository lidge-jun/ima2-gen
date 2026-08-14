#!/usr/bin/env node
/**
 * No-cost provider canary (#152).
 *
 * The hermetic E2E suite proves our own contract against a stub; it cannot see
 * a provider changing its API. This probes each lane's cheapest authenticated
 * surface — a model list or a version string — and never calls a generation
 * endpoint, so a run costs nothing.
 *
 * It deliberately does NOT go through PUT /api/keys/:provider. That route
 * validates and then writes config and mutates the runtime context
 * (routes/keys.ts:273-306), so calling it would make the canary a mutation.
 * The endpoints below are duplicated from routes/keys.ts VALIDATE_URL_MAP on
 * purpose, and tests/provider-canary-parity.test.ts fails if the two drift.
 *
 * A lane with no credential is reported as "skip", never as success. When every
 * lane skips, the run says so loudly instead of printing a green checkmark over
 * zero coverage.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const TIMEOUT_MS = 15_000;

export const CANARY_ENDPOINTS = {
  api: "https://api.openai.com/v1/models",
  "grok-api": "https://api.x.ai/v1/models",
  "gemini-api": "https://generativelanguage.googleapis.com/v1beta/models",
  atlascloud: "https://api.atlascloud.ai/api/v1/models",
  minimax: "https://api.minimax.io/v1/models",
};

/** Never let a key, token, or credential-bearing URL reach the log. */
function redact(message) {
  return String(message ?? "")
    .replace(/(sk|xai|apikey)-[A-Za-z0-9_-]+/g, "$1-REDACTED")
    .replace(/AI[A-Za-z0-9_-]{20,}/g, "AI-REDACTED")
    .replace(/([?&](?:key|api_key|access_token)=)[^&\s]+/gi, "$1REDACTED")
    .slice(0, 300);
}

async function probeModelList(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new Error("response was not JSON");
  }
  const list = Array.isArray(body?.data) ? body.data
    : Array.isArray(body?.models) ? body.models
    : null;
  if (!list) throw new Error("model list shape changed: no data[] or models[]");
  return { httpStatus: res.status, modelCount: list.length };
}

const LANES = {
  oauth: async () => {
    const url = process.env.CANARY_OAUTH_MODELS_URL;
    if (!url) return { status: "skip", reason: "CANARY_OAUTH_MODELS_URL not set" };
    const headers = {};
    if (process.env.CANARY_OAUTH_TOKEN) headers.Authorization = `Bearer ${process.env.CANARY_OAUTH_TOKEN}`;
    return { status: "pass", ...(await probeModelList(url, headers)) };
  },
  api: async () => {
    const key = process.env.CANARY_OPENAI_API_KEY;
    if (!key) return { status: "skip", reason: "CANARY_OPENAI_API_KEY not set" };
    return { status: "pass", ...(await probeModelList(CANARY_ENDPOINTS.api, { Authorization: `Bearer ${key}` })) };
  },
  grok: async () => {
    const url = process.env.CANARY_GROK_MODELS_URL;
    if (!url) return { status: "skip", reason: "CANARY_GROK_MODELS_URL not set" };
    const headers = {};
    if (process.env.CANARY_GROK_TOKEN) headers.Authorization = `Bearer ${process.env.CANARY_GROK_TOKEN}`;
    return { status: "pass", ...(await probeModelList(url, headers)) };
  },
  "grok-api": async () => {
    const key = process.env.CANARY_XAI_API_KEY;
    if (!key) return { status: "skip", reason: "CANARY_XAI_API_KEY not set" };
    return { status: "pass", ...(await probeModelList(CANARY_ENDPOINTS["grok-api"], { Authorization: `Bearer ${key}` })) };
  },
  agy: async () => {
    const bin = process.env.IMA2_AGY_BIN || "agy";
    try {
      const out = execFileSync(bin, ["--version"], { encoding: "utf8", timeout: TIMEOUT_MS });
      return { status: "pass", version: out.trim().slice(0, 80) };
    } catch {
      return { status: "skip", reason: `${bin} not runnable on this host` };
    }
  },
  "gemini-api": async () => {
    const key = process.env.CANARY_GEMINI_API_KEY;
    if (!key) return { status: "skip", reason: "CANARY_GEMINI_API_KEY not set" };
    return { status: "pass", ...(await probeModelList(CANARY_ENDPOINTS["gemini-api"], { "x-goog-api-key": key })) };
  },
  atlascloud: async () => {
    const key = process.env.CANARY_ATLASCLOUD_API_KEY;
    if (!key) return { status: "skip", reason: "CANARY_ATLASCLOUD_API_KEY not set" };
    return { status: "pass", ...(await probeModelList(CANARY_ENDPOINTS.atlascloud, { Authorization: `Bearer ${key}` })) };
  },
  minimax: async () => {
    const key = process.env.CANARY_MINIMAX_API_KEY;
    if (!key) return { status: "skip", reason: "CANARY_MINIMAX_API_KEY not set" };
    const base = process.env.CANARY_MINIMAX_BASE_URL || CANARY_ENDPOINTS.minimax;
    const result = await probeModelList(base, { Authorization: `Bearer ${key}` });
    return { status: "pass", ...result };
  },
};

function summary(line) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function main() {
  const only = process.argv.includes("--lane") ? process.argv[process.argv.indexOf("--lane") + 1] : null;
  const names = only ? [only] : Object.keys(LANES);
  if (only && !LANES[only]) throw new Error(`unknown lane: ${only}`);

  const results = [];
  for (const name of names) {
    const startedAt = Date.now();
    try {
      const outcome = await LANES[name]();
      results.push({ lane: name, latencyMs: Date.now() - startedAt, ...outcome });
    } catch (error) {
      results.push({ lane: name, status: "fail", latencyMs: Date.now() - startedAt, reason: redact(error?.message) });
    }
  }

  summary("| lane | status | latency | detail |");
  summary("|---|---|---:|---|");
  for (const r of results) {
    console.log(JSON.stringify(r));
    const detail = r.reason ?? (r.modelCount !== undefined ? `${r.modelCount} models` : r.version ?? "");
    summary(`| ${r.lane} | ${r.status} | ${r.latencyMs}ms | ${detail} |`);
  }

  const failed = results.filter((r) => r.status === "fail");
  // A failed lane still had a credential, so it counts as covered. Only an
  // all-skip run means the canary proved nothing.
  const active = results.filter((r) => r.status === "pass" || r.status === "fail");
  if (active.length === 0) {
    // Zero credentials means zero coverage. Say it rather than exiting green.
    console.log("::warning::provider canary had no credentials: 0 lanes actually probed");
    summary("");
    summary("**0 lanes probed.** No canary credentials are configured, so this run proves nothing about provider drift.");
  }
  if (failed.length > 0) {
    for (const r of failed) console.error(`::error::provider canary failed: ${r.lane} (${r.reason})`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("provider-canary.mjs");
if (isMain) {
  main().catch((error) => {
    console.error(`[provider-canary] ${redact(error?.message)}`);
    process.exit(1);
  });
}
