import "dotenv/config";
import express from "express";
import { writeFile, mkdir, readFile, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { spawnBin, onShutdown } from "./bin/lib/platform.js";
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync as fsReadFileSync } from "fs";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { newNodeId, saveNode, loadNodeB64, loadNodeMeta, loadAssetB64 } from "./lib/nodeStore.js";
import { startJob, finishJob, listJobs, setJobPhase, setJobAttempt, getJob, purgeStaleJobs } from "./lib/inflight.js";
import {
  createSession,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  saveGraph,
  ensureDefaultSession,
} from "./lib/sessionStore.js";
import { trashAsset, restoreAsset, markNodesAssetMissing } from "./lib/assetLifecycle.js";
import { setFavoriteFlag } from "./lib/favorite.js";
import { runResponses } from "./lib/oauthStream.js";
import { buildEnhancePayload, extractEnhancedText, sanitizeEnhancedText } from "./lib/enhance.js";
import { buildAttemptSequence, hasCompliantRetry } from "./lib/safetyRetry.js";
import { getStorageStats, pruneStorage } from "./lib/prune.js";
import { withDefaultPrompt } from "./lib/defaultPrompt.js";
import {
  validatePrompt,
  validateQuality,
  validateFormat,
  validateModeration,
  validateCount,
  validateSize,
} from "./lib/validate.js";
import { createRequestLogger } from "./lib/requestLogger.js";
import { validateAndNormalizeRefs } from "./lib/refs.js";
import { logEvent, logError } from "./lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Load API key from env or ${IMA2_CONFIG_DIR || ~/.ima2}/config.json
// (with legacy fallback to <packageRoot>/.ima2/config.json for existing installs)
let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  const configDir = process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2");
  const candidates = [
    join(configDir, "config.json"),
    join(__dirname, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8"));
      if (cfg.apiKey) { apiKey = cfg.apiKey; break; }
    } catch {}
  }
}

// OAuth proxy binding. Mutated at runtime if the child proxy falls back to a
// different port (e.g. 10531 busy → 10539). All callsites read the live values
// — do NOT destructure these into locals.
let OAUTH_PORT = parseInt(process.env.OAUTH_PORT || "10531");
const OAUTH_PORT_REQUESTED = OAUTH_PORT;
let OAUTH_URL = `http://127.0.0.1:${OAUTH_PORT}`;
let OAUTH_READY = false;
let OAUTH_LAST_ERROR = null;
const HAS_API_KEY = !!apiKey;

let openai = null;
if (HAS_API_KEY) {
  const OpenAI = (await import("openai")).default;
  openai = new OpenAI({ apiKey });
}

app.use(express.json({ limit: "50mb" }));

// Per-account ACL. nginx forwards Basic Auth username via X-Auth-User.
// When the header is absent (npm package single-user mode / dev), ACL is bypassed.
const LEGACY_OWNER = process.env.IMA2_LEGACY_OWNER || "ree9622";
app.use((req, _res, next) => {
  const raw = req.get("X-Auth-User") || "";
  req.authUser = raw.trim() || null;
  next();
});
function ownerOf(meta) {
  return (meta && typeof meta.owner === "string" && meta.owner) || LEGACY_OWNER;
}
function canAccess(meta, authUser) {
  if (!authUser) return true;
  return ownerOf(meta) === authUser;
}

// Structured /api/* request logging (echoes/issues X-Request-Id, redacts body
// and query). Mounted after the auth-user middleware so authUser is captured.
app.use(createRequestLogger());

// UI bundle cache policy: index.html must never be cached (so a redeploy is
// picked up immediately), but the hashed /assets/* files are content-addressed
// and safe to mark immutable for a year.
function setUiStaticHeaders(res, filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.endsWith("/index.html")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return;
  }
  if (normalized.includes("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}
app.use(express.static(join(__dirname, "ui", "dist"), {
  setHeaders: setUiStaticHeaders,
}));
// If a hashed asset path falls through (old browser tab requesting a bundle
// that no longer exists post-deploy), return 404 instead of letting the SPA
// fallback ship index.html as text/javascript.
app.use("/assets", (_req, res) => {
  res.status(404).type("text/plain").send("Asset not found");
});

// /generated is owner-gated when X-Auth-User is set. Sidecar JSON drives ACL.
const GENERATED_DIR = join(__dirname, "generated");
const generatedStatic = express.static(GENERATED_DIR, { maxAge: "1y", immutable: true });
app.use("/generated", async (req, res, next) => {
  if (!req.authUser) return generatedStatic(req, res, next);
  // Block sidecar/trash/.failed exposure regardless
  const decoded = (() => { try { return decodeURIComponent(req.path); } catch { return req.path; } })();
  if (decoded.endsWith(".json") || decoded.includes("/.trash/") || decoded.includes("/.failed/")) {
    return res.status(404).end();
  }
  // Resolve sidecar path safely under GENERATED_DIR
  const rel = decoded.replace(/^\/+/, "");
  const target = join(GENERATED_DIR, rel);
  if (target !== GENERATED_DIR && !target.startsWith(GENERATED_DIR + "/")) {
    return res.status(403).end();
  }
  let meta = null;
  try {
    meta = JSON.parse(await readFile(target + ".json", "utf-8"));
  } catch {
    // node assets use <nodeId>.<ext>.json — already covered by target+".json".
    // For a few legacy paths sidecar may be missing; treat as legacy owner.
  }
  if (!canAccess(meta, req.authUser)) return res.status(404).end();
  return generatedStatic(req, res, next);
});

// Emits a 400 with both string + {code,message} shapes so old clients that
// read err.error.toString() and new clients that introspect err.error.code
// both see useful data. Accepts the validator shapes
// { code, message } (validate.js) and { code, error } (refs.js).
function send400(res, result) {
  return res
    .status(400)
    .json({ error: { code: result.code, message: result.message ?? result.error } });
}

// -- OAuth proxy: generate via Responses API (stream mode) --
// Research mode is ALWAYS ON for OAuth; web_search is included in tools, GPT
// decides per-prompt whether to actually invoke it. Simple prompts skip web_search
// automatically; complex/factual prompts use it.
const RESEARCH_SUFFIX =
  "\n\nIf needed, first use web search to check accurate references for the subject (face, product, place, or current details), then generate from that reference. For simple subjects, generate directly.";

const GENERATE_DEVELOPER_PROMPT = withDefaultPrompt(
  "You are an image generator. Always use the image_generation tool; never respond with text only. If the user's input is abstract, vague, or non-visual, interpret it creatively and still produce an image. Enhance prompts with quality boosters (masterpiece, ultra detailed, 8k UHD, sharp focus, professional lighting, vivid colors, high dynamic range) and avoid defects (blurry, deformed, bad anatomy, watermark, signature, jpeg artifacts, cropped, duplicate). Default to photorealistic unless another style is implied (anime, oil painting, line art, etc.). Render any requested text/typography with correct spelling and sharp edges. Produce exactly what the user describes.",
);

const EDIT_DEVELOPER_PROMPT = withDefaultPrompt(
  "You are an image editor. Always use the image_generation tool; never respond with text only. Preserve the original image's style and composition while applying the requested edit. Enhance with quality boosters (masterpiece, ultra detailed, 8k UHD, sharp focus, professional lighting, vivid colors) and avoid defects (blurry, deformed, bad anatomy, watermark, jpeg artifacts). Render any text/typography with correct spelling and sharp edges. Produce exactly what the user describes.",
);

const REFERENCE_DEVELOPER_PROMPT = withDefaultPrompt(
  "You are an image generator operating in reference mode. The user has attached one or more reference images. Treat the FIRST attached image as the authoritative visual source for identity, face, outfit, and background. Preserve those elements faithfully across the variation you produce. Only vary what the user explicitly asks to vary (pose, angle, expression, framing, etc.). Always use the image_generation tool; never respond with text only. Enhance with quality boosters (masterpiece, ultra detailed, 8k UHD, sharp focus, professional lighting) and avoid defects (blurry, deformed, bad anatomy, watermark, signature, jpeg artifacts). Render any requested text/typography with correct spelling. Do not perform a web search; the reference image(s) are already the source of truth.",
);

async function generateViaOAuth(prompt, quality, size, moderation = "auto", references = [], requestId = null) {
  const hasRefs = references.length > 0;
  const tag = requestId ? `[oauth][${requestId}]` : `[oauth]`;
  console.log(
    `${tag} call: quality=${quality} size=${size} moderation=${moderation} ` +
    `refs=${references.length} promptLen=${prompt.length}`,
  );

  const tools = hasRefs
    ? [{ type: "image_generation", quality, size, moderation }]
    : [
        { type: "web_search" },
        { type: "image_generation", quality, size, moderation },
      ];

  const textPrompt = hasRefs
    ? `Use the attached reference image(s) as the primary visual source. Preserve the subject's identity, outfit, and background from the reference. Produce the user's request as a variation that keeps those elements intact:\n\n${prompt}`
    : `Generate an image: ${prompt}${RESEARCH_SUFFIX}`;

  const userContent = hasRefs
    ? [
        ...references.map((b64) => ({
          type: "input_image",
          image_url: `data:image/png;base64,${b64}`,
        })),
        { type: "input_text", text: textPrompt },
      ]
    : textPrompt;

  const onPhase = requestId ? (phase) => setJobPhase(requestId, phase) : undefined;
  const developerPrompt = hasRefs ? REFERENCE_DEVELOPER_PROMPT : GENERATE_DEVELOPER_PROMPT;

  const stream = await runResponses({
    url: OAUTH_URL,
    body: {
      model: "gpt-5.5",
      reasoning: { effort: "medium" },
      input: [
        { role: "developer", content: developerPrompt },
        { role: "user", content: userContent },
      ],
      tools,
      tool_choice: hasRefs ? "required" : "auto",
      stream: true,
    },
    onPhase,
  });

  if (stream.b64) {
    console.log(
      `${tag} stream SUCCESS: b64Len=${stream.b64.length} events=${stream.eventCount} ` +
      `webSearchCalls=${stream.webSearchCalls ?? 0}`,
    );
    return { b64: stream.b64, usage: stream.usage, webSearchCalls: stream.webSearchCalls };
  }

  // Ref-mode already uses minimal tools + tool_choice:required; a fallback
  // retry would only strip the reference image, which defeats the purpose.
  // Fail loudly so the caller knows the reference call itself fell through.
  if (hasRefs) {
    console.warn(
      `${tag} stream EMPTY in ref-mode: events=${stream.eventCount} — throwing`,
    );
    throw new Error(
      `No image data received from OAuth proxy in reference mode (parsed ${stream.eventCount} events)`,
    );
  }

  // Stream ended without an image; proxy sometimes splits the response.
  // Retry once with stream:false + no web_search to isolate whether the
  // image was generated at all.
  console.log(
    `${tag} stream EMPTY: events=${stream.eventCount} — retrying non-stream without web_search`,
  );
  const retry = await runResponses({
    url: OAUTH_URL,
    body: {
      model: "gpt-5.5",
      reasoning: { effort: "medium" },
      input: [
        { role: "developer", content: GENERATE_DEVELOPER_PROMPT },
        { role: "user", content: prompt },
      ],
      tools: [{ type: "image_generation", quality, size, moderation }],
      stream: false,
    },
  });
  if (retry.b64) {
    console.log(
      `${tag} non-stream retry SUCCESS: b64Len=${retry.b64.length}`,
    );
    return { b64: retry.b64, usage: retry.usage, webSearchCalls: stream.webSearchCalls };
  }

  console.warn(
    `${tag} non-stream retry EMPTY: events=${stream.eventCount} — throwing`,
  );
  throw new Error(
    `No image data received from OAuth proxy (parsed ${stream.eventCount} events)`,
  );
}

// Errors we should NOT keep retrying: rate-limit / usage-cap responses from
// upstream OpenAI come back with the body "The usage limit has been reached"
// (or 429 / "too many requests" / "quota"). Retrying just burns more budget
// and adds latency. Detect by message OR explicit code so future code paths
// can set `err.code = "USAGE_LIMIT"` directly.
const USAGE_LIMIT_RE = /usage limit|quota|too many requests|rate.?limit/i;
function isUsageLimitError(e) {
  if (!e) return false;
  if (e.code === "USAGE_LIMIT" || e.status === 429) return true;
  const msg = e.message || "";
  return USAGE_LIMIT_RE.test(msg);
}

async function runPromptAttempts(prompt, invoke, label, maxAttempts = 2, onAttempt = null, ctx = {}) {
  const attempts = buildAttemptSequence(prompt, maxAttempts);
  const log = [];
  let lastErr;

  const tag = ctx.requestId ? `[${label}][${ctx.requestId}]` : `[${label}]`;
  console.log(
    `${tag} start: maxAttempts=${maxAttempts} plannedVariants=${attempts.length} ` +
    `hasCompliantVariant=${attempts.some((p) => p !== prompt)} ` +
    `promptLen=${prompt.length}`,
  );

  for (let i = 0; i < attempts.length; i++) {
    const attemptPrompt = attempts[i];
    const isCompliantRetry = attemptPrompt !== prompt;
    const startedAt = Date.now();
    console.log(
      `${tag} attempt ${i + 1}/${attempts.length} begin: ` +
      `compliantVariant=${isCompliantRetry} promptLen=${attemptPrompt.length}`,
    );
    if (typeof onAttempt === "function") {
      try { onAttempt(i + 1, attempts.length); } catch {}
    }
    try {
      const r = await invoke(attemptPrompt);
      const durationMs = Date.now() - startedAt;
      if (r.b64) {
        log.push({
          attempt: i + 1,
          promptUsed: attemptPrompt,
          compliantVariant: isCompliantRetry,
          ok: true,
          errorMessage: null,
          errorCode: null,
          durationMs,
          startedAt,
        });
        console.log(
          `${tag} attempt ${i + 1}/${attempts.length} SUCCESS in ${durationMs}ms ` +
          `b64Len=${r.b64.length}`,
        );
        return {
          ...r,
          promptUsed: attemptPrompt,
          promptRewrittenForSafety: isCompliantRetry,
          attempts: log,
        };
      }
      lastErr = new Error("Empty response (safety refusal)");
      lastErr.code = "SAFETY_REFUSAL";
      log.push({
        attempt: i + 1,
        promptUsed: attemptPrompt,
        compliantVariant: isCompliantRetry,
        ok: false,
        errorMessage: lastErr.message,
        errorCode: lastErr.code,
        durationMs,
        startedAt,
      });
      console.warn(
        `${tag} attempt ${i + 1}/${attempts.length} EMPTY (safety refusal) after ${durationMs}ms`,
      );
    } catch (e) {
      const durationMs = Date.now() - startedAt;
      lastErr = e;
      log.push({
        attempt: i + 1,
        promptUsed: attemptPrompt,
        compliantVariant: isCompliantRetry,
        ok: false,
        errorMessage: e?.message || String(e),
        errorCode: e?.code || null,
        durationMs,
        startedAt,
      });
      console.warn(
        `${tag} attempt ${i + 1}/${attempts.length} THREW after ${durationMs}ms: ` +
        `code=${e?.code || "?"} msg=${(e?.message || String(e)).slice(0, 200)}`,
      );
      // Non-retryable: usage limit / quota / 429. Stop the loop and throw
      // a typed error so the route handler can forward it to the client.
      if (isUsageLimitError(e)) {
        const stop = new Error(e?.message || "OpenAI usage limit reached");
        stop.code = "USAGE_LIMIT";
        stop.status = 429;
        stop.cause = e;
        stop.attempts = log;
        console.warn(
          `${tag} non-retryable USAGE_LIMIT — aborting after ${i + 1}/${attempts.length}`,
        );
        throw stop;
      }
    }

    if (i < attempts.length - 1) {
      const mode = isCompliantRetry ? "compliant retry failed" : "retrying";
      console.log(`${tag} ${mode} (${i + 1}/${attempts.length}) after: ${lastErr?.message}`);
    }
  }
  console.error(
    `${tag} ALL ${attempts.length} ATTEMPTS FAILED: lastCode=${lastErr?.code || "?"} ` +
    `lastMsg=${(lastErr?.message || String(lastErr || "")).slice(0, 200)}`,
  );

  const err = new Error("Content generation refused after retries");
  err.code = lastErr?.code === "SAFETY_REFUSAL" ? "SAFETY_REFUSAL" : (lastErr?.code || "ALL_ATTEMPTS_FAILED");
  err.status = err.code === "SAFETY_REFUSAL" ? 422 : 502;
  err.cause = lastErr;
  err.attempts = log;
  throw err;
}

function clampMaxAttempts(v, fallback = 2) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (n > 10) return 10;
  return n;
}

// Persist a failed generation attempt for the log UI + retry button.
// Refs are NOT saved (see retry flow): refs live in the browser and are
// re-attached when the user invokes retry from a history item that had them.
async function writeFailureSidecar({ endpoint, prompt, originalPrompt = null, quality, size, format, moderation, attempts, error, sessionId = null, parentNodeId = null, clientNodeId = null, referenceCount = 0, owner = null, requestId = null }) {
  try {
    const dir = join(__dirname, "generated", ".failed");
    await mkdir(dir, { recursive: true });
    const id = `${Date.now()}_${randomBytes(4).toString("hex")}`;
    const record = {
      id,
      status: "failed",
      endpoint,
      prompt,
      ...(originalPrompt ? { originalPrompt } : {}),
      quality,
      size,
      format: format || null,
      moderation: moderation || null,
      provider: "oauth",
      createdAt: Date.now(),
      sessionId,
      parentNodeId,
      clientNodeId,
      referenceCount,
      owner: owner || LEGACY_OWNER,
      requestId,
      attempts: attempts || [],
      errorCode: error?.code || "UNKNOWN",
      errorMessage: error?.message || String(error || ""),
    };
    await writeFile(join(dir, `${id}.json`), JSON.stringify(record));
    return id;
  } catch (e) {
    console.warn("[failed-sidecar] write failed:", e.message);
    return null;
  }
}

// -- Provider info --
app.get("/api/providers", (_req, res) => {
  res.json({
    apiKey: false,
    oauth: true,
    oauthPort: OAUTH_PORT,
    apiKeyDisabled: true,
  });
});

// -- Health (for ima2 CLI: ping, discovery verification) --
const __pkg = (() => {
  try {
    return JSON.parse(fsReadFileSync(join(__dirname, "package.json"), "utf-8"));
  } catch {
    return { version: "0.0.0" };
  }
})();
const __startedAt = Date.now();

app.get("/api/health", async (req, res) => {
  const deep = req.query.deep === "1" || req.query.deep === "true";
  const base = {
    ok: true,
    version: __pkg.version,
    provider: "oauth",
    uptimeSec: Math.round(process.uptime()),
    activeJobs: listJobs().length,
    pid: process.pid,
    startedAt: __startedAt,
    oauth: {
      ready: OAUTH_READY,
      port: OAUTH_PORT,
      portRequested: OAUTH_PORT_REQUESTED,
      portDrifted: OAUTH_PORT !== OAUTH_PORT_REQUESTED,
      lastError: OAUTH_LAST_ERROR,
    },
  };
  if (!deep) return res.json(base);
  // Deep check: actually hit the OAuth proxy /v1/models so we detect hung
  // child processes (OAUTH_READY=true but proxy wedged) that the stdout
  // banner can't surface.
  try {
    const t0 = Date.now();
    const r = await fetch(`${OAUTH_URL}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    const elapsedMs = Date.now() - t0;
    res.json({
      ...base,
      oauth: {
        ...base.oauth,
        probe: { ok: r.ok, status: r.status, elapsedMs, url: `${OAUTH_URL}/v1/models` },
      },
    });
  } catch (e) {
    res.status(503).json({
      ...base,
      ok: false,
      oauth: {
        ...base.oauth,
        probe: {
          ok: false,
          error: e?.message || String(e),
          url: `${OAUTH_URL}/v1/models`,
        },
      },
    });
  }
});

// -- History (disk-backed authoritative source for UI history list) --
// Recursively list image files up to 2 levels deep (for 0.04 session/node subdirs)
async function listImages(baseDir) {
  const out = [];
  async function walk(dir, depth) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name === ".trash") continue;
      const full = join(dir, e.name);
      if (e.isDirectory() && depth > 0) {
        await walk(full, depth - 1);
      } else if (e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name)) {
        out.push({ full, rel: full.slice(baseDir.length + 1), name: e.name });
      }
    }
  }
  await walk(baseDir, 2);
  return out;
}

app.get("/api/history", async (req, res) => {
  try {
    const dir = join(__dirname, "generated");
    await mkdir(dir, { recursive: true });
    const limitRaw = parseInt(req.query.limit);
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50, 500);
    const beforeTs = parseInt(req.query.before);
    const beforeFn = typeof req.query.beforeFilename === "string" ? req.query.beforeFilename : null;
    const sinceTs = parseInt(req.query.since);
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
    const groupBy = req.query.groupBy === "session" ? "session" : null;

    const imgs = await listImages(dir);
    const rowsAll = await Promise.all(imgs.map(async ({ full, rel, name }) => {
      const st = await stat(full).catch(() => null);
      let meta = null;
      try {
        const raw = await readFile(full + ".json", "utf-8");
        meta = JSON.parse(raw);
      } catch (e) {
        if (e.code !== "ENOENT") console.warn("[history] sidecar parse fail:", rel, e.message);
      }
      return {
        _meta: meta,
        filename: rel,
        url: `/generated/${rel.split("/").map(encodeURIComponent).join("/")}`,
        createdAt: meta?.createdAt || st?.mtimeMs || 0,
        prompt: meta?.prompt || null,
        originalPrompt: typeof meta?.originalPrompt === "string" ? meta.originalPrompt : null,
        quality: meta?.quality || null,
        size: meta?.size || null,
        format: meta?.format || name.split(".").pop(),
        moderation: meta?.moderation || null,
        provider: meta?.provider || "oauth",
        usage: meta?.usage || null,
        webSearchCalls: meta?.webSearchCalls || 0,
        sessionId: meta?.sessionId || null,
        nodeId: meta?.nodeId || null,
        parentNodeId: meta?.parentNodeId || null,
        clientNodeId: meta?.clientNodeId || null,
        kind: meta?.kind || null,
        favorite: meta?.favorite === true,
        maxAttempts: typeof meta?.maxAttempts === "number" ? meta.maxAttempts : null,
        attempts: Array.isArray(meta?.attempts) ? meta.attempts : [],
        referenceCount: typeof meta?.referenceCount === "number" ? meta.referenceCount : 0,
        requestId: typeof meta?.requestId === "string" ? meta.requestId : null,
      };
    }));

    const rows = rowsAll.filter((r) => canAccess(r._meta, req.authUser)).map(({ _meta, ...rest }) => rest);

    // composite sort: createdAt DESC, filename DESC (stable tiebreaker)
    rows.sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.filename < a.filename ? -1 : b.filename > a.filename ? 1 : 0;
    });

    let filtered = rows;
    if (Number.isFinite(sinceTs)) {
      filtered = filtered.filter((r) => r.createdAt > sinceTs);
    }
    if (Number.isFinite(beforeTs)) {
      filtered = filtered.filter((r) => {
        if (r.createdAt < beforeTs) return true;
        if (r.createdAt === beforeTs && beforeFn) return r.filename < beforeFn;
        return false;
      });
    }
    if (sessionId) {
      filtered = filtered.filter((r) => r.sessionId === sessionId);
    }

    const page = filtered.slice(0, limit);
    const nextCursor = page.length === limit && filtered.length > limit
      ? { before: page[page.length - 1].createdAt, beforeFilename: page[page.length - 1].filename }
      : null;

    if (groupBy === "session") {
      // Group by sessionId while preserving createdAt DESC order overall.
      const groups = new Map(); // sessionId|null -> { sessionId, items, lastUsedAt }
      const loose = [];
      for (const r of page) {
        if (r.sessionId) {
          let g = groups.get(r.sessionId);
          if (!g) {
            g = { sessionId: r.sessionId, items: [], lastUsedAt: r.createdAt };
            groups.set(r.sessionId, g);
          }
          g.items.push(r);
          if (r.createdAt > g.lastUsedAt) g.lastUsedAt = r.createdAt;
        } else {
          loose.push(r);
        }
      }
      const sessions = Array.from(groups.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      return res.json({ sessions, loose, total: rows.length, nextCursor });
    }

    res.json({ items: page, total: rows.length, nextCursor });
  } catch (err) {
    console.error("[history] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -- Asset lifecycle: soft-delete to .trash/, auto-purge after TTL --
async function readSidecarSafe(filename) {
  try {
    const target = join(GENERATED_DIR, filename);
    if (target !== GENERATED_DIR && !target.startsWith(GENERATED_DIR + "/")) return null;
    return JSON.parse(await readFile(target + ".json", "utf-8"));
  } catch {
    return null;
  }
}

async function assertHistoryAccess(req, res, filename) {
  if (!req.authUser) return true;
  const meta = await readSidecarSafe(filename);
  if (canAccess(meta, req.authUser)) return true;
  res.status(404).json({ error: "not found", code: "NOT_FOUND" });
  return false;
}

app.delete("/api/history/:filename", async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    if (!(await assertHistoryAccess(req, res, filename))) return;
    const result = await trashAsset(__dirname, filename);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

app.post("/api/history/:filename/restore", async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const trashId = typeof req.body?.trashId === "string" ? req.body.trashId : null;
    if (!trashId) return res.status(400).json({ error: "trashId required" });
    // Only owners can restore. The sidecar moved with the trashed asset, so check trash sidecar.
    if (req.authUser) {
      try {
        const trashSidecar = JSON.parse(await readFile(join(GENERATED_DIR, ".trash", trashId + ".json"), "utf-8"));
        if (!canAccess(trashSidecar, req.authUser)) {
          return res.status(404).json({ error: "not found" });
        }
      } catch {
        return res.status(404).json({ error: "not found" });
      }
    }
    const result = await restoreAsset(__dirname, trashId, filename);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/history/:filename/favorite", async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    if (!(await assertHistoryAccess(req, res, filename))) return;
    const value = Boolean(req.body?.value);
    const result = await setFavoriteFlag(GENERATED_DIR, filename, value);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// -- Generation log (success + failure attempts) --
async function listFailedSidecars(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(dir, e.name), "utf-8");
      const meta = JSON.parse(raw);
      out.push({ ...meta, _file: e.name });
    } catch (err) {
      console.warn("[log] bad failed sidecar:", e.name, err.message);
    }
  }
  return out;
}

app.get("/api/generation-log", async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit);
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100, 500);
    const statusFilter =
      req.query.status === "failed" || req.query.status === "success"
        ? req.query.status
        : null;

    const items = [];

    if (statusFilter !== "failed") {
      const genDir = join(__dirname, "generated");
      await mkdir(genDir, { recursive: true });
      const imgs = await listImages(genDir);
      for (const { full, rel, name } of imgs) {
        const st = await stat(full).catch(() => null);
        let meta = null;
        try {
          meta = JSON.parse(await readFile(full + ".json", "utf-8"));
        } catch (e) {
          if (e.code !== "ENOENT") continue;
        }
        if (!canAccess(meta, req.authUser)) continue;
        items.push({
          id: rel,
          status: "success",
          createdAt: meta?.createdAt || st?.mtimeMs || 0,
          endpoint: meta?.kind === "edit" ? "edit" : meta?.nodeId ? "node" : "generate",
          prompt: meta?.prompt || null,
          originalPrompt: typeof meta?.originalPrompt === "string" ? meta.originalPrompt : null,
          quality: meta?.quality || null,
          size: meta?.size || null,
          format: meta?.format || name.split(".").pop(),
          moderation: meta?.moderation || null,
          maxAttempts: typeof meta?.maxAttempts === "number" ? meta.maxAttempts : null,
          attempts: Array.isArray(meta?.attempts) ? meta.attempts : [],
          referenceCount: typeof meta?.referenceCount === "number" ? meta.referenceCount : 0,
          filename: rel,
          url: `/generated/${rel.split("/").map(encodeURIComponent).join("/")}`,
          sessionId: meta?.sessionId || null,
          requestId: typeof meta?.requestId === "string" ? meta.requestId : null,
          errorCode: null,
          errorMessage: null,
        });
      }
    }

    if (statusFilter !== "success") {
      const failedDir = join(__dirname, "generated", ".failed");
      await mkdir(failedDir, { recursive: true });
      const failed = await listFailedSidecars(failedDir);
      for (const m of failed) {
        if (!canAccess(m, req.authUser)) continue;
        items.push({
          id: `failed/${m.id || (m._file || "").replace(/\.json$/, "")}`,
          status: "failed",
          createdAt: m.createdAt || 0,
          endpoint: m.endpoint || "generate",
          prompt: m.prompt || null,
          quality: m.quality || null,
          size: m.size || null,
          format: m.format || null,
          moderation: m.moderation || null,
          maxAttempts: Array.isArray(m.attempts) ? m.attempts.length : null,
          attempts: Array.isArray(m.attempts) ? m.attempts : [],
          referenceCount: typeof m.referenceCount === "number" ? m.referenceCount : 0,
          filename: null,
          url: null,
          sessionId: m.sessionId || null,
          requestId: typeof m.requestId === "string" ? m.requestId : null,
          errorCode: m.errorCode || null,
          errorMessage: m.errorMessage || null,
        });
      }
    }

    items.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ items: items.slice(0, limit), total: items.length });
  } catch (err) {
    console.error("[generation-log] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/generation-log/failed/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").replace(/[^\w.-]/g, "");
    if (!id) return res.status(400).json({ error: "invalid id" });
    const path = join(__dirname, "generated", ".failed", `${id}.json`);
    if (!existsSync(path)) return res.status(404).json({ error: "not found" });
    if (req.authUser) {
      try {
        const meta = JSON.parse(await readFile(path, "utf-8"));
        if (!canAccess(meta, req.authUser)) return res.status(404).json({ error: "not found" });
      } catch {
        return res.status(404).json({ error: "not found" });
      }
    }
    unlinkSync(path);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Storage stats + prune --
// Local dev tool: caller is the machine owner. No auth layer, but input
// numeric fields are clamped defensively so a stray large number can't
// wedge the walker or delete something unexpected.
function clampPositiveNumber(v, fallback, { max = Number.MAX_SAFE_INTEGER, min = 0 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

app.get("/api/storage/stats", async (_req, res) => {
  try {
    const stats = await getStorageStats(__dirname);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/storage/prune", async (req, res) => {
  try {
    const body = req.body || {};
    const opts = {
      trashTtlDays:
        body.trashTtlDays == null ? 7 : clampPositiveNumber(body.trashTtlDays, 7, { max: 3650 }),
      failedTtlDays:
        body.failedTtlDays == null ? 14 : clampPositiveNumber(body.failedTtlDays, 14, { max: 3650 }),
      genTtlDays:
        body.genTtlDays == null ? null : clampPositiveNumber(body.genTtlDays, null, { max: 3650 }),
      genMaxMb:
        body.genMaxMb == null ? null : clampPositiveNumber(body.genMaxMb, null, { max: 10 * 1024 * 1024 }),
      keepFavorites: body.keepFavorites !== false,
      dryRun: body.dryRun === true,
    };

    const result = await pruneStorage(__dirname, opts);

    if (!opts.dryRun && result.generated.deletedFilenames.length > 0) {
      let sessionsTouched = 0;
      let nodesTouched = 0;
      for (const fn of result.generated.deletedFilenames) {
        try {
          const summary = markNodesAssetMissing(fn);
          sessionsTouched += summary.sessionsTouched;
          nodesTouched += summary.nodesTouched;
        } catch (e) {
          console.warn("[prune] markNodesAssetMissing failed:", fn, e.message);
        }
      }
      result.generated.sessionsTouched = sessionsTouched;
      result.generated.nodesTouched = nodesTouched;
    }

    res.json(result);
  } catch (err) {
    console.error("[prune] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -- OAuth status --
app.get("/api/oauth/status", async (_req, res) => {
  try {
    const r = await fetch(`${OAUTH_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      res.json({ status: "ready", models: data.data?.map((m) => m.id) || [] });
    } else {
      res.json({ status: "auth_required" });
    }
  } catch {
    res.json({ status: "offline" });
  }
});

// -- Inflight registry --
app.get("/api/inflight", (req, res) => {
  const kind =
    typeof req.query.kind === "string" && req.query.kind.length > 0
      ? req.query.kind
      : undefined;
  const sessionId =
    typeof req.query.sessionId === "string" && req.query.sessionId.length > 0
      ? req.query.sessionId
      : undefined;
  res.json({ jobs: listJobs({ kind, sessionId, owner: req.authUser }) });
});

app.delete("/api/inflight/:requestId", (req, res) => {
  if (req.authUser) {
    const job = getJob(req.params.requestId);
    if (job && job.owner !== req.authUser) return res.status(404).end();
  }
  finishJob(req.params.requestId, { canceled: true });
  res.status(204).end();
});

// -- Generate image (supports parallel via n) --
app.post("/api/generate", async (req, res) => {
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : null;
  try {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
    const clientNodeId =
      typeof req.body?.clientNodeId === "string" ? req.body.clientNodeId : null;
    const { prompt: rawPrompt, quality: rawQuality = "low", size: rawSize = "1024x1024", format: rawFormat = "png", moderation: rawModeration = "auto", provider = "auto", n = 1, references = [], maxAttempts: rawMaxAttempts, originalPrompt: rawOriginalPrompt } =
      req.body;
    const maxAttempts = clampMaxAttempts(rawMaxAttempts, 2);
    const originalPrompt =
      typeof rawOriginalPrompt === "string" && rawOriginalPrompt.trim().length > 0
        ? rawOriginalPrompt.trim().slice(0, 4000)
        : null;

    const pCheck = validatePrompt(rawPrompt);
    if (!pCheck.ok) return send400(res, pCheck);
    const qCheck = validateQuality(rawQuality);
    if (!qCheck.ok) return send400(res, qCheck);
    const sCheck = validateSize(rawSize);
    if (!sCheck.ok) return send400(res, sCheck);
    const fCheck = validateFormat(rawFormat);
    if (!fCheck.ok) return send400(res, fCheck);
    const mCheck = validateModeration(rawModeration);
    if (!mCheck.ok) return send400(res, mCheck);
    const nCheck = validateCount(n, { max: 8 });
    if (!nCheck.ok) return send400(res, nCheck);

    const prompt = pCheck.value;
    const quality = qCheck.value;
    const size = sCheck.value;
    const format = fCheck.value;
    const moderation = mCheck.value;
    const count = nCheck.value;
    startJob({
      requestId,
      kind: "classic",
      prompt,
      maxAttempts,
      owner: req.authUser || LEGACY_OWNER,
      meta: {
        kind: "classic",
        sessionId,
        parentNodeId: null,
        clientNodeId,
        quality,
        size,
        n: count,
      },
    });

    const refCheck = validateAndNormalizeRefs(references);
    if (refCheck.error) return res.status(400).json({ error: { code: refCheck.code, message: refCheck.error } });
    const refB64s = refCheck.refs;

    if (provider === "api") {
      return res.status(403).json({ error: { code: "APIKEY_DISABLED", message: "API key provider is disabled. Use OAuth (Codex login)." } });
    }
    const useOAuth = true;
    const __client = req.get("x-ima2-client") || "ui";
    console.log(`[generate][${__client}] provider=oauth quality=${quality} size=${size} moderation=${moderation} n=${count} refs=${refB64s.length}`);
    const startTime = Date.now();

    const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
    const mime = mimeMap[format] || "image/png";
    await mkdir(join(__dirname, "generated"), { recursive: true });

    const generateOne = () =>
      runPromptAttempts(
        prompt,
        (attemptPrompt) =>
          generateViaOAuth(attemptPrompt, quality, size, moderation, refB64s, requestId),
        "generate",
        maxAttempts,
        requestId ? (i, _n) => setJobAttempt(requestId, i) : null,
        { requestId },
      );

    const results = await Promise.allSettled(Array.from({ length: count }, generateOne));

    const images = [];
    let totalUsage = null;
    let totalWebSearchCalls = 0;
    let promptRewrittenForSafety = false;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.b64) {
        if (r.value.promptRewrittenForSafety === true) promptRewrittenForSafety = true;
        const rand = randomBytes(4).toString("hex");
        const filename = `${Date.now()}_${rand}_${images.length}.${format}`;
        await writeFile(join(__dirname, "generated", filename), Buffer.from(r.value.b64, "base64"));
        // Sidecar metadata for /api/history reconstruction
        const meta = {
          prompt,
          promptUsed: r.value.promptUsed || prompt,
          promptRewrittenForSafety: r.value.promptRewrittenForSafety === true,
          ...(originalPrompt ? { originalPrompt } : {}),
          quality,
          size,
          format,
          moderation,
          provider: "oauth",
          createdAt: Date.now(),
          usage: r.value.usage || null,
          webSearchCalls: r.value.webSearchCalls || 0,
          maxAttempts,
          attempts: Array.isArray(r.value.attempts) ? r.value.attempts : [],
          referenceCount: refB64s.length,
          sessionId,
          owner: req.authUser || LEGACY_OWNER,
          requestId,
        };
        await writeFile(join(__dirname, "generated", filename + ".json"), JSON.stringify(meta)).catch(() => {});
        images.push({
          image: `data:${mime};base64,${r.value.b64}`,
          filename,
        });
        if (r.value.usage) {
          if (!totalUsage) totalUsage = { ...r.value.usage };
          else Object.keys(r.value.usage).forEach(k => { if (typeof r.value.usage[k] === "number") totalUsage[k] = (totalUsage[k] || 0) + r.value.usage[k]; });
        }
        if (typeof r.value.webSearchCalls === "number") totalWebSearchCalls += r.value.webSearchCalls;
      } else if (r.status === "rejected") {
        console.error("[generate] one of parallel jobs failed:", r.reason?.message);
      }
    }

    if (images.length === 0) {
      const firstErr = results.find(r => r.status === "rejected")?.reason;
      await writeFailureSidecar({
        endpoint: "generate",
        prompt,
        originalPrompt,
        quality,
        size,
        format,
        moderation,
        attempts: firstErr?.attempts || [],
        error: firstErr,
        sessionId,
        clientNodeId,
        referenceCount: refB64s.length,
        owner: req.authUser,
        requestId,
      });
      if (firstErr?.code === "SAFETY_REFUSAL") {
        return res.status(422).json({ error: firstErr.message, code: "SAFETY_REFUSAL", attempts: firstErr.attempts || [] });
      }
      if (firstErr?.code === "USAGE_LIMIT" || firstErr?.status === 429) {
        return res.status(429).json({
          error: firstErr.message || "OpenAI usage limit reached",
          code: "USAGE_LIMIT",
          attempts: firstErr.attempts || [],
        });
      }
      return res.status(500).json({ error: "All generation attempts failed", code: firstErr?.code || "ALL_ATTEMPTS_FAILED", attempts: firstErr?.attempts || [] });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const extra = {
      usage: totalUsage,
      provider: "oauth",
      webSearchCalls: totalWebSearchCalls,
      quality,
      size,
      moderation,
      safetyRetryAvailable: hasCompliantRetry(prompt),
      promptRewrittenForSafety,
    };

    if (count === 1) {
      res.json({ image: images[0].image, elapsed, filename: images[0].filename, requestId, ...extra });
    } else {
      res.json({ images, elapsed, count: images.length, requestId, ...extra });
    }
  } catch (err) {
    console.error("Generate error:", err.message);
    res.status(err.status || 500).json({ error: err.message, code: err.code, requestId });
  } finally {
    finishJob(requestId);
  }
});

// -- OAuth edit: send image as input to Responses API --
async function editViaOAuth(prompt, imageB64, quality, size, moderation = "auto") {
  const { b64, usage } = await runResponses({
    url: OAUTH_URL,
    body: {
      model: "gpt-5.5",
      reasoning: { effort: "medium" },
      input: [
        { role: "developer", content: EDIT_DEVELOPER_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_image", image_url: `data:image/png;base64,${imageB64}` },
            { type: "input_text", text: `Edit this image: ${prompt}` },
          ],
        },
      ],
      tools: [{ type: "image_generation", quality, size, moderation }],
      tool_choice: "required",
      stream: true,
    },
  });
  if (b64) {
    console.log("[oauth-edit] got image, b64 length:", b64.length);
    return { b64, usage };
  }
  throw new Error("No image data received from OAuth edit");
}

// -- Edit image (inpainting) --
app.post("/api/edit", async (req, res) => {
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : null;
  try {
    const { prompt: rawPrompt, image: imageB64, mask: maskB64, quality: rawQuality = "low", size: rawSize = "1024x1024", moderation: rawModeration = "auto", provider = "oauth", maxAttempts: rawMaxAttempts, originalPrompt: rawOriginalPrompt } =
      req.body;
    const maxAttempts = clampMaxAttempts(rawMaxAttempts, 2);
    const originalPrompt =
      typeof rawOriginalPrompt === "string" && rawOriginalPrompt.trim().length > 0
        ? rawOriginalPrompt.trim().slice(0, 4000)
        : null;

    if (!imageB64)
      return send400(res, { code: "MISSING_IMAGE", message: "image is required" });
    const pCheck = validatePrompt(rawPrompt);
    if (!pCheck.ok) return send400(res, pCheck);
    const qCheck = validateQuality(rawQuality);
    if (!qCheck.ok) return send400(res, qCheck);
    const sCheck = validateSize(rawSize);
    if (!sCheck.ok) return send400(res, sCheck);
    const mCheck = validateModeration(rawModeration);
    if (!mCheck.ok) return send400(res, mCheck);

    const prompt = pCheck.value;
    const quality = qCheck.value;
    const size = sCheck.value;
    const moderation = mCheck.value;

    if (provider === "api") {
      return res.status(403).json({ error: { code: "APIKEY_DISABLED", message: "API key provider is disabled. Use OAuth (Codex login)." } });
    }
    console.log(`[edit][${req.get("x-ima2-client") || "ui"}] provider=oauth quality=${quality} size=${size} moderation=${moderation}`);
    const startTime = Date.now();

    let editResult;
    try {
      editResult = await runPromptAttempts(
        prompt,
        (attemptPrompt) => editViaOAuth(attemptPrompt, imageB64, quality, size, moderation),
        "edit",
        maxAttempts,
        null,
        { requestId },
      );
    } catch (e) {
      await writeFailureSidecar({
        endpoint: "edit",
        prompt,
        originalPrompt,
        quality,
        size,
        format: "png",
        moderation,
        attempts: e.attempts || [],
        error: e,
        referenceCount: 0,
        owner: req.authUser,
        requestId,
      });
      throw e;
    }
    const {
      b64: resultB64,
      usage,
      promptUsed,
      promptRewrittenForSafety,
      attempts: editAttempts,
    } = editResult;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    await mkdir(join(__dirname, "generated"), { recursive: true });
    const filename = `${Date.now()}_${randomBytes(4).toString("hex")}.png`;
    await writeFile(join(__dirname, "generated", filename), Buffer.from(resultB64, "base64"));
    const meta = {
      prompt,
      promptUsed: promptUsed || prompt,
      promptRewrittenForSafety: promptRewrittenForSafety === true,
      ...(originalPrompt ? { originalPrompt } : {}),
      quality,
      size,
      moderation,
      format: "png",
      provider: "oauth",
      kind: "edit",
      createdAt: Date.now(),
      usage: usage || null,
      webSearchCalls: 0,
      maxAttempts,
      attempts: Array.isArray(editAttempts) ? editAttempts : [],
      owner: req.authUser || LEGACY_OWNER,
      requestId,
    };
    await writeFile(join(__dirname, "generated", filename + ".json"), JSON.stringify(meta)).catch(() => {});

    res.json({
      image: `data:image/png;base64,${resultB64}`,
      elapsed,
      filename,
      requestId,
      usage,
      provider: "oauth",
      moderation,
      safetyRetryAvailable: hasCompliantRetry(prompt),
      promptRewrittenForSafety: promptRewrittenForSafety === true,
    });
  } catch (err) {
    console.error("Edit error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// -- Node mode (0.04) --
app.post("/api/node/generate", async (req, res) => {
  const body = req.body || {};
  const parentNodeId = body.parentNodeId ?? null;
  const requestId = typeof body.requestId === "string" ? body.requestId : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const clientNodeId =
    typeof body.clientNodeId === "string" ? body.clientNodeId : null;
  const __nodeMaxAttempts = clampMaxAttempts(body.maxAttempts, 2);
  startJob({
    requestId,
    kind: "node",
    prompt: body.prompt,
    maxAttempts: __nodeMaxAttempts,
    owner: req.authUser || LEGACY_OWNER,
    meta: {
      kind: "node",
      sessionId,
      parentNodeId,
      clientNodeId,
    },
  });
  try {
    const {
      prompt: rawPrompt,
      quality: rawQuality = "low",
      size: rawSize = "1024x1024",
      format: rawFormat = "png",
      moderation: rawModeration = "auto",
      references = [],
      externalSrc = null,
      maxAttempts: rawMaxAttempts,
      originalPrompt: rawOriginalPrompt,
    } = body;
    const maxAttempts = __nodeMaxAttempts;
    void rawMaxAttempts;
    const originalPrompt =
      typeof rawOriginalPrompt === "string" && rawOriginalPrompt.trim().length > 0
        ? rawOriginalPrompt.trim().slice(0, 4000)
        : null;
    const { provider = "oauth" } = body;

    if (provider === "api") {
      return res.status(403).json({
        error: { code: "APIKEY_DISABLED", message: "API key provider is disabled. Use OAuth." },
        parentNodeId,
      });
    }

    const nodeBadRequest = (check) =>
      res.status(400).json({
        error: { code: check.code, message: check.message },
        parentNodeId,
      });

    const pCheck = validatePrompt(rawPrompt);
    if (!pCheck.ok) return nodeBadRequest(pCheck);
    const qCheck = validateQuality(rawQuality);
    if (!qCheck.ok) return nodeBadRequest(qCheck);
    const sCheck = validateSize(rawSize);
    if (!sCheck.ok) return nodeBadRequest(sCheck);
    const fCheck = validateFormat(rawFormat);
    if (!fCheck.ok) return nodeBadRequest(fCheck);
    const mCheck = validateModeration(rawModeration);
    if (!mCheck.ok) return nodeBadRequest(mCheck);

    const prompt = pCheck.value;
    const quality = qCheck.value;
    const size = sCheck.value;
    const format = fCheck.value;
    const moderation = mCheck.value;

    const refCheck = validateAndNormalizeRefs(references);
    if (refCheck.error) {
      return res.status(400).json({
        error: { code: refCheck.code, message: refCheck.error },
        parentNodeId,
      });
    }
    const refB64s = refCheck.refs;

    const startTime = Date.now();
    let parentB64 = null;
    if (parentNodeId) {
      parentB64 = await loadNodeB64(__dirname, `${parentNodeId}.png`);
    } else if (typeof externalSrc === "string" && externalSrc.length > 0) {
      // TODO(0.09 D4): history promotion should materialize imported assets into a
      // node-owned file path. This stub allows controlled reads from generated/
      // so promotion can fail gracefully instead of assuming <nodeId>.png only.
      parentB64 = await loadAssetB64(__dirname, externalSrc);
    }

    let nodeResult;
    try {
      nodeResult = await runPromptAttempts(
        prompt,
        (attemptPrompt) =>
          parentB64
            ? editViaOAuth(attemptPrompt, parentB64, quality, size, moderation)
            : generateViaOAuth(
                attemptPrompt,
                quality,
                size,
                moderation,
                refB64s,
                requestId,
              ),
        "node",
        maxAttempts,
        requestId ? (i) => setJobAttempt(requestId, i) : null,
        { requestId },
      );
    } catch (err) {
      await writeFailureSidecar({
        endpoint: "node",
        prompt,
        originalPrompt,
        quality,
        size,
        format,
        moderation,
        attempts: err.attempts || [],
        error: err,
        sessionId,
        parentNodeId,
        clientNodeId,
        referenceCount: refB64s.length,
        owner: req.authUser,
        requestId,
      });
      return res.status(err.status || 422).json({
        error: { code: err.code || "SAFETY_REFUSAL", message: err.message },
        parentNodeId,
        attempts: err.attempts || [],
      });
    }

    const b64 = nodeResult.b64;
    const usage = nodeResult.usage;
    const webSearchCalls = nodeResult.webSearchCalls || 0;

    const nodeId = newNodeId();
    const elapsed = +((Date.now() - startTime) / 1000).toFixed(1);
    const meta = {
      nodeId,
      parentNodeId,
      sessionId,
      clientNodeId,
      prompt,
      promptUsed: nodeResult.promptUsed || prompt,
      promptRewrittenForSafety: nodeResult.promptRewrittenForSafety === true,
      ...(originalPrompt ? { originalPrompt } : {}),
      options: { quality, size, format, moderation },
      createdAt: Date.now(),
      createdAtIso: new Date().toISOString(),
      elapsed,
      usage: usage || null,
      webSearchCalls,
      provider: "oauth",
      kind: parentB64 ? "edit" : "generate",
      // Fields consumed by /api/history flat scan (so node images appear in history too)
      quality, size, format, moderation,
      maxAttempts,
      attempts: Array.isArray(nodeResult.attempts) ? nodeResult.attempts : [],
      referenceCount: refB64s.length,
      owner: req.authUser || LEGACY_OWNER,
      requestId,
    };
    await mkdir(join(__dirname, "generated"), { recursive: true });
    const { filename } = await saveNode(__dirname, { nodeId, b64, meta, ext: format });

    res.json({
      nodeId,
      parentNodeId,
      requestId,
      image: `data:image/${format === "jpeg" ? "jpeg" : format};base64,${b64}`,
      filename,
      url: `/generated/${filename}`,
      elapsed,
      usage,
      webSearchCalls,
      provider: "oauth",
      moderation,
      safetyRetryAvailable: hasCompliantRetry(prompt),
      promptRewrittenForSafety: nodeResult.promptRewrittenForSafety === true,
    });
  } catch (err) {
    console.error("[node/generate] error:", err.message);
    res.status(err.status || 500).json({
      error: { code: err.code || "NODE_GEN_FAILED", message: err.message },
      parentNodeId,
    });
  } finally {
    finishJob(requestId);
  }
});

app.get("/api/node/:nodeId", async (req, res) => {
  try {
    const { nodeId } = req.params;
    const meta = await loadNodeMeta(__dirname, nodeId);
    if (!meta) {
      return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "Node metadata missing" } });
    }
    if (!canAccess(meta, req.authUser)) {
      return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "Node metadata missing" } });
    }
    const ext = meta?.options?.format || meta?.format || "png";
    res.json({
      nodeId,
      meta,
      url: `/generated/${nodeId}.${ext}`,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || "NODE_FETCH_FAILED", message: err.message },
    });
  }
});

// -- Session DB (0.06) --
app.get("/api/sessions", (req, res) => {
  try {
    let sessions = listSessions(req.authUser);
    if (sessions.length === 0 && req.authUser) {
      ensureDefaultSession(req.authUser);
      sessions = listSessions(req.authUser);
    }
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

app.post("/api/sessions", (req, res) => {
  try {
    const title = (req.body?.title || "Untitled").slice(0, 200);
    const session = createSession({ title, owner: req.authUser || LEGACY_OWNER });
    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

app.get("/api/sessions/:id", (req, res) => {
  try {
    const session = getSession(req.params.id, req.authUser);
    if (!session) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
      });
    }
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

app.patch("/api/sessions/:id", (req, res) => {
  try {
    const title = req.body?.title;
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: { code: "INVALID_TITLE", message: "Title required" },
      });
    }
    const ok = renameSession(req.params.id, title.slice(0, 200), req.authUser);
    if (!ok) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

app.delete("/api/sessions/:id", (req, res) => {
  try {
    const ok = deleteSession(req.params.id, req.authUser);
    if (!ok) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: { code: "DB_ERROR", message: err.message } });
  }
});

app.put("/api/sessions/:id/graph", (req, res) => {
  // Save-tracking headers let multi-tab debugging tell apart which save
  // path / which tab triggered each conflict. They are best-effort; an
  // older client that omits them still works.
  const saveId = req.get("X-Ima2-Graph-Save-Id") || null;
  const saveReason = req.get("X-Ima2-Graph-Save-Reason") || null;
  const tabId = req.get("X-Ima2-Tab-Id") || null;
  const sessionId = req.params.id;
  try {
    const { nodes, edges } = req.body || {};
    const rawIfMatch = req.get("If-Match");
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        error: { code: "INVALID_GRAPH", message: "nodes and edges arrays required" },
      });
    }
    if (!rawIfMatch) {
      return res.status(428).json({
        error: {
          code: "GRAPH_VERSION_REQUIRED",
          message: "If-Match header required",
        },
      });
    }
    if (nodes.length > 500 || edges.length > 1000) {
      return res.status(413).json({
        error: {
          code: "GRAPH_TOO_LARGE",
          message: `Graph too large (max 500 nodes / 1000 edges), got ${nodes.length}/${edges.length}`,
        },
      });
    }
    const expectedVersion = Number(String(rawIfMatch).replace(/"/g, ""));
    if (!Number.isFinite(expectedVersion)) {
      return res.status(400).json({
        error: {
          code: "INVALID_GRAPH_VERSION",
          message: "If-Match must be a finite integer",
        },
      });
    }
    const result = saveGraph(sessionId, {
      nodes,
      edges,
      expectedVersion,
      owner: req.authUser,
    });
    logEvent("session", "graph_save", {
      sessionId,
      saveId,
      saveReason,
      tabId,
      nodes: nodes.length,
      edges: edges.length,
      graphVersion: result.graphVersion,
      authUser: req.authUser || null,
    });
    res.json({
      ok: true,
      nodes: nodes.length,
      edges: edges.length,
      graphVersion: result.graphVersion,
    });
  } catch (err) {
    const code = err.code || "DB_ERROR";
    const payload = { error: { code, message: err.message } };
    if (typeof err.currentVersion === "number") {
      payload.currentVersion = err.currentVersion;
    }
    if (code === "GRAPH_VERSION_CONFLICT") {
      // Conflicts are expected concurrency events, not bugs — emit a
      // structured warn-level event so they show up in observability
      // without being treated as server errors.
      logEvent("session", "graph_conflict", {
        sessionId,
        saveId,
        saveReason,
        tabId,
        expectedVersion: Number(String(req.get("If-Match") || "").replace(/"/g, "")),
        currentVersion: err.currentVersion ?? null,
        nodes: Array.isArray(req.body?.nodes) ? req.body.nodes.length : null,
        edges: Array.isArray(req.body?.edges) ? req.body.edges.length : null,
        authUser: req.authUser || null,
      });
    } else {
      logError("session", "graph_error", err, { sessionId, code, saveId, tabId });
    }
    res.status(err.status || 500).json(payload);
  }
});

// -- Billing info --
app.get("/api/billing", async (_req, res) => {
  if (!HAS_API_KEY) {
    return res.json({ oauth: true, apiKeyValid: false, apiKeySource: "none" });
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    const [subRes, usageRes, modelsRes] = await Promise.allSettled([
      fetch(
        "https://api.openai.com/v1/organization/costs?start_time=" +
          Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000) +
          "&end_time=" + Math.floor(Date.now() / 1000) + "&bucket_width=1d&limit=31",
        { headers },
      ),
      fetch("https://api.openai.com/dashboard/billing/credit_grants", { headers }),
      fetch("https://api.openai.com/v1/models", { headers }),
    ]);

    const billing = { apiKeySource: "env" };
    if (subRes.status === "fulfilled" && subRes.value.ok) billing.costs = await subRes.value.json();
    if (usageRes.status === "fulfilled" && usageRes.value.ok) billing.credits = await usageRes.value.json();
    billing.apiKeyValid =
      modelsRes.status === "fulfilled" && modelsRes.value.ok === true;
    res.json(billing);
  } catch (err) {
    res.status(500).json({ error: err.message, apiKeyValid: false });
  }
});

// -- Enhance prompt (non-streaming OAuth call) --
app.post("/api/enhance-prompt", async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const language = req.body?.language === "en" ? "en" : "ko";
    if (!prompt) {
      return res.status(400).json({ error: "prompt required", code: "EMPTY_PROMPT" });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: "prompt too long", code: "PROMPT_TOO_LONG" });
    }

    // Optional reference images. Same validator + cap as /api/generate.
    // Omitted (undefined) defaults to [] and passes; explicit non-array
    // inputs (e.g. a string) now surface as REF_NOT_ARRAY instead of being
    // silently coerced to empty.
    const rawRefs = req.body?.references ?? [];
    const refCheck = validateAndNormalizeRefs(rawRefs);
    if (refCheck.error) {
      return res.status(400).json({ error: refCheck.error, code: refCheck.code });
    }
    const refB64s = refCheck.refs;

    const body = buildEnhancePayload(prompt, language, refB64s);
    const result = await runResponses({ url: OAUTH_URL, body });
    const rawText = result.text || extractEnhancedText(result.raw);
    if (!rawText) {
      return res.status(502).json({ error: "enhancer returned no text", code: "ENHANCE_EMPTY" });
    }
    const cleaned = sanitizeEnhancedText(rawText).trim();
    if (!cleaned) {
      return res.status(502).json({ error: "enhancer returned only safety boilerplate", code: "ENHANCE_EMPTY" });
    }
    res.json({ prompt: cleaned, usage: result.usage ?? null });
  } catch (err) {
    console.error("[enhance] error:", err.message);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message, code: "ENHANCE_FAILED" });
  }
});

// -- Start OAuth proxy as child process --
// The proxy sometimes can't bind to the requested port (another ima2 instance,
// a stale process, etc.) and falls back to a random port, printing a line like:
//   "Port 10531 was unavailable. Using port 10539 instead."
//   "OpenAI-compatible endpoint ready at http://127.0.0.1:10539/v1"
// We parse those lines and rebind OAUTH_URL to the actual live port. Without
// this, every /api/generate hits ECONNREFUSED on the stale port.
function parseOAuthPortFromLine(line) {
  // Prefer the canonical "endpoint ready at" banner (authoritative).
  const ready = line.match(/endpoint ready at\s+https?:\/\/[^:\s]+:(\d+)/i);
  if (ready) return { port: Number(ready[1]), reason: "ready" };
  // Fallback: explicit fallback message.
  const using = line.match(/using port (\d+)\s+instead/i);
  if (using) return { port: Number(using[1]), reason: "fallback" };
  return null;
}

function startOAuthProxy() {
  OAUTH_READY = false;
  console.log(`Starting openai-oauth on port ${OAUTH_PORT_REQUESTED}...`);
  const child = spawnBin(
    "npx",
    ["openai-oauth", "--port", String(OAUTH_PORT_REQUESTED)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );

  const handleLine = (line) => {
    if (!line) return;
    console.log(`[oauth] ${line}`);
    const parsed = parseOAuthPortFromLine(line);
    if (parsed && Number.isFinite(parsed.port) && parsed.port > 0) {
      if (parsed.port !== OAUTH_PORT) {
        console.warn(
          `[ima2] OAuth proxy bound to port ${parsed.port} ` +
          `(requested ${OAUTH_PORT_REQUESTED}). Switching OAUTH_URL.`,
        );
        OAUTH_PORT = parsed.port;
        OAUTH_URL = `http://127.0.0.1:${OAUTH_PORT}`;
      }
      if (parsed.reason === "ready") {
        OAUTH_READY = true;
        OAUTH_LAST_ERROR = null;
      }
    }
  };

  let stdoutBuf = "";
  child.stdout.on("data", (d) => {
    stdoutBuf += d.toString();
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx).trim();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      handleLine(line);
    }
  });

  child.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg && !msg.includes("npm warn")) {
      console.error(`[oauth] ${msg}`);
      OAUTH_LAST_ERROR = msg.slice(0, 500);
    }
  });

  child.on("exit", (code) => {
    OAUTH_READY = false;
    console.log(`[oauth] exited with code ${code}, restarting in 5s...`);
    setTimeout(startOAuthProxy, 5000);
  });

  return child;
}

// -- Boot --
const PORT = process.env.PORT || 3333;
// Tests (and some CI contexts) can opt out of the OAuth proxy subprocess.
// The proxy is a user-facing login helper, not required for /api/health or
// offline unit tests, and starting it on Windows CI can add 7-10s latency.
const oauthChild = process.env.IMA2_NO_OAUTH_PROXY === "1"
  ? null
  : startOAuthProxy();

// CLI discovery: advertise running server under ~/.ima2/server.json
const __advertisePath = join(homedir(), ".ima2", "server.json");
function __advertise() {
  try {
    mkdirSync(dirname(__advertisePath), { recursive: true });
    writeFileSync(
      __advertisePath,
      JSON.stringify({
        port: Number(PORT),
        pid: process.pid,
        startedAt: __startedAt,
        version: __pkg.version,
      }),
    );
  } catch (e) {
    console.warn("[advertise] skipped:", e.message);
  }
}
function __unadvertise() {
  try {
    if (!existsSync(__advertisePath)) return;
    const cur = JSON.parse(fsReadFileSync(__advertisePath, "utf-8"));
    if (cur.pid === process.pid) unlinkSync(__advertisePath);
  } catch {}
}

onShutdown(() => {
  __unadvertise();
  try { oauthChild?.kill(); } catch {}
});
process.on("exit", __unadvertise);

app.listen(PORT, () => {
  console.log(`Image Gen running at http://localhost:${PORT}`);
  console.log(`Provider policy: OAuth only (API key hard-disabled). OAuth proxy port ${OAUTH_PORT}.`);
  __advertise();
  try {
    const s = ensureDefaultSession(LEGACY_OWNER);
    console.log(`[db] default session: ${s.id} (${s.title}) owner=${s.owner}`);
  } catch (err) {
    console.error("[db] bootstrap failed:", err.message);
  }
  // Inflight rows whose original fetch died with the previous process
  // are not recoverable — drop everything older than the configured TTL
  // before clients start polling /api/inflight.
  try {
    const purged = purgeStaleJobs();
    if (purged > 0) console.log(`[inflight] purged ${purged} stale job(s) at startup`);
  } catch (err) {
    console.error("[inflight] startup purge failed:", err.message);
  }
});
