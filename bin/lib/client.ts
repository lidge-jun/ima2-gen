import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const DEFAULT_PORT = 3333;

function readAdvertise() {
  const p = process.env.IMA2_ADVERTISE_FILE ||
    join(process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2"), "server.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

async function probe(base, timeoutMs = 600) {
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function resolveServer({ serverFlag }: any = {}) {
  if (serverFlag) {
    const base = serverFlag.replace(/\/$/, "");
    const health = await probe(base);
    if (health) return { base, health };
    const err: any = new Error(`server unreachable at ${base}`);
    err.code = "SERVER_UNREACHABLE";
    throw err;
  }
  const candidates = [];
  if (process.env.IMA2_SERVER) candidates.push(process.env.IMA2_SERVER.replace(/\/$/, ""));
  const adv = readAdvertise();
  if (adv?.backend?.url) candidates.push(String(adv.backend.url).replace(/\/$/, ""));
  if (adv?.url) candidates.push(String(adv.url).replace(/\/$/, ""));
  if (adv?.port) candidates.push(`http://localhost:${adv.port}`);
  candidates.push(`http://localhost:${DEFAULT_PORT}`);

  const seen = new Set();
  const uniq = candidates.filter((c) => !seen.has(c) && seen.add(c));

  for (const base of uniq) {
    const health = await probe(base);
    if (health) return { base, health };
  }
  const err: any = new Error("server unreachable — is 'ima2 serve' running?");
  err.code = "SERVER_UNREACHABLE";
  throw err;
}

export async function request(base, path, { method = "GET", body, timeoutMs = 180_000 }: any = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-ima2-client": `cli/${CLI_VERSION}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const err: any = new Error(json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json?.code || null;
    err.body = json || text;
    throw err;
  }
  return json;
}

export function normalizeGenerate(resp) {
  if (!resp) return { images: [], elapsed: null, requestId: null };
  if (Array.isArray(resp.images)) {
    return {
      images: resp.images.map((it) => ({ image: it.image, filename: it.filename })),
      elapsed: resp.elapsed ?? null,
      requestId: resp.requestId ?? null,
    };
  }
  if (resp.image) {
    return {
      images: [{ image: resp.image, filename: resp.filename || null }],
      elapsed: resp.elapsed ?? null,
      requestId: resp.requestId ?? null,
    };
  }
  return { images: [], elapsed: resp.elapsed ?? null, requestId: resp.requestId ?? null };
}

export let CLI_VERSION = "dev";
export function setCliVersion(v) { CLI_VERSION = v; }
