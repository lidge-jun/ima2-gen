import { spawn } from "node:child_process";
import { readFile, readdir, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { extname, dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { buildAgyPathEnv, resolveAgyBin } from "./agyCli.js";
import { logEvent } from "./logger.js";
import { SAFETY_INTENT_POLICY } from "./promptSafetyPolicy.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { deriveReferenceLimit } from "./providers/derive.js";

export interface AgyGenerateResult {
  b64: string;
  revisedPrompt?: string;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime?: string;
}

const AGY_TIMEOUT_MS = 360_000;
const AGY_OUTPUT_RESOLUTION = "1024x1024";
const AGY_MAX_OUTPUT_BYTES = 1024 * 1024;

function agyError(message: string, status: number, code: string): Error {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function buildAgyPrompt(
  userPrompt: string,
  referencePaths: string[],
): string {
  const imagePathsJson = referencePaths.length > 0
    ? JSON.stringify(referencePaths)
    : "[]";

  return [
    "You are an image generation assistant inside a professional creative tool used by designers and artists. Users create content for legitimate creative, commercial, or educational purposes.",
    SAFETY_INTENT_POLICY,
    "",
    "Generate one image by calling the tool default_api:generate_image once.",
    "After the tool finishes, print one machine-readable result line so ima2-gen can copy the artifact.",
    "",
    "Tool parameters:",
    `  Prompt: ${JSON.stringify(userPrompt)}`,
    '  ImageName: "ima2_generated"',
    `  ImagePaths: ${imagePathsJson}`,
    '  toolSummary: "ima2 pipeline generation"',
    '  toolAction: "Generating ima2 image"',
    "",
    `Reference count: ${referencePaths.length}. The output resolution is fixed at ${AGY_OUTPUT_RESOLUTION}.`,
    "",
    "PROMPT HANDLING:",
    "- Preserve the user's prompt as-is for compliant requests. Do not translate, restyle, or soften benign adult clothing requests such as swimwear.",
    "- If the user wrote in Korean, Japanese, or any non-English language, keep visible text and dialogue in that language.",
    "- Do not sexualize, intensify exposure, or add sexualized/fetish framing to benign swimwear, sportswear, or catalog fashion prompts.",
    "- Do not copy safety labels, refusal reasons, or negative safety constraints into the final image prompt.",
    "- If the request includes minors, underage-looking subjects, explicit sexual activity, or fetish framing, do not rewrite it as a benign allowed prompt.",
    "- Content moderation is still handled downstream by the provider.",
    "",
    "OUTPUT:",
    "If generation succeeds, print: RESULT|<absolute_artifact_path>|<file_extension>",
    "If generation fails, print: ERROR|<concise error message>",
  ].join("\n");
}

function parseAgyOutput(stdout: string): { artifactPath: string; ext: string } {
  const lines = stdout.replace(/\r/g, "").trim().split("\n").filter((l) => l.trim().length > 0);
  const resultLine = lines.find((l) => l.startsWith("RESULT|"));
  if (resultLine) {
    const parts = resultLine.split("|");
    if (parts.length >= 3) {
      return { artifactPath: parts[1].trim(), ext: parts[2].trim() };
    }
    throw agyError(`Malformed RESULT line: ${resultLine}`, 502, "AGY_MALFORMED_RESULT");
  }

  const errorLine = lines.find((l) => l.startsWith("ERROR|"));
  if (errorLine) {
    const msg = errorLine.slice("ERROR|".length).trim() || "Unknown agy error";
    const lower = msg.toLowerCase();
    if (lower.includes("resource exhausted") || lower.includes("exhausted your capacity") || lower.includes("quota will reset")) {
      throw agyError(`Agy generation failed: ${msg}`, 429, "AGY_QUOTA_EXHAUSTED");
    }
    throw agyError(`Agy generation failed: ${msg}`, 502, "AGY_GENERATION_FAILED");
  }

  const fullLower = stdout.toLowerCase();
  if (fullLower.includes("resource exhausted") || fullLower.includes("exhausted your capacity")) {
    throw agyError(`Agy quota exhausted: ${stdout.trim().slice(0, 200)}`, 429, "AGY_QUOTA_EXHAUSTED");
  }

  const savedPathLine = lines.find((l) => l.startsWith("SAVED_PATH="));
  if (savedPathLine) {
    const p = savedPathLine.slice("SAVED_PATH=".length).trim();
    const ext = p.split(".").pop() || "png";
    return { artifactPath: p, ext };
  }

  const normalizedStdout = stdout.replace(/\r/g, "").replace(/\\/g, "/");
  const pathMatch = normalizedStdout.match(
    /(?:[A-Za-z]:)?\/[^\s"']+\/(brain|artifacts|\.gemini)\/[^\s"']+\.(png|jpg|jpeg|webp)/i,
  );
  if (pathMatch) {
    const matched = pathMatch[0];
    const artifactPath = process.platform === "win32" ? matched.replace(/\//g, "\\") : matched;
    const ext = extname(artifactPath).slice(1) || "png";
    return { artifactPath, ext };
  }

  throw agyError(
    `Could not parse artifact path from agy output (${stdout.length} chars): ${stdout.slice(0, 200)}`,
    502,
    "AGY_PARSE_FAILED",
  );
}

export async function findRecentAgyArtifact(sinceMs: number, rootOverrides?: string[]): Promise<string | null> {
  const roots = rootOverrides ?? [
    join(homedir(), ".gemini", "antigravity-cli", "brain"),
    join(homedir(), ".gemini"),
  ];

  const candidates: { path: string; mtimeMs: number }[] = [];
  const seen = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5 || seen.has(dir)) return;
    seen.add(dir);

    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const p = join(dir, entry.name);

      if (!entry.isSymbolicLink() && entry.isDirectory()) {
        await walk(p, depth + 1);
        continue;
      }

      if (!/^ima2_generated.*\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
        continue;
      }

      const s = await stat(p).catch(() => null);
      if (!s) continue;

      if (s.mtimeMs >= sinceMs - 5_000) {
        candidates.push({ path: p, mtimeMs: s.mtimeMs });
      }
    }
  }

  for (const root of roots) {
    await walk(root, 0);
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path ?? null;
}

function spawnAgy(prompt: string, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveAgyBin(), ["-p", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        PATH: buildAgyPathEnv(),
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        TMPDIR: process.env.TMPDIR,
        TEMP: process.env.TEMP,
        LANG: process.env.LANG,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        reject(agyError("Agy generation timed out", 504, "AGY_TIMEOUT"));
      }
    }, AGY_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < AGY_MAX_OUTPUT_BYTES) stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < AGY_MAX_OUTPUT_BYTES) stderr += chunk.toString(); });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const bin = resolveAgyBin();
      const hint = err.code === "ENOENT"
        ? `. "${bin}" was not found — install agy or set IMA2_AGY_BIN=/absolute/path/to/agy`
        : "";
      reject(agyError(`Agy process error: ${err.message}${hint}`, 502, "AGY_PROCESS_ERROR"));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(agyError(`Agy exited with code ${code}: ${stderr.slice(0, 200)}`, 502, "AGY_PROCESS_ERROR"));
        return;
      }
      resolve({ stdout, stderr });
    });

    if (signal) {
      const onAbort = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          child.kill("SIGTERM");
          reject(agyError("Generation canceled", 499, "GENERATION_CANCELED"));
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });
      child.on("close", () => signal.removeEventListener("abort", onAbort));
    }

    if (signal?.aborted) {
      settled = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      return reject(agyError("Generation canceled", 499, "GENERATION_CANCELED"));
    }
    child.stdin.on("error", () => {});
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

interface RefDetail {
  b64: string;
  declaredMime?: string | null;
  detectedMime?: string | null;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function writeRefsToTempFiles(refs: RefDetail[]): Promise<{ paths: string[]; cleanup: () => Promise<void> }> {
  if (refs.length === 0) return { paths: [], cleanup: async () => {} };
  const dir = join(tmpdir(), `ima2-agy-refs-${randomBytes(6).toString("hex")}`);
  await mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const mime = ref.detectedMime || ref.declaredMime || detectImageMimeFromB64(ref.b64) || "image/png";
    const ext = MIME_TO_EXT[mime] || "png";
    const p = join(dir, `ref_${i}.${ext}`);
    await writeFile(p, Buffer.from(ref.b64, "base64"));
    paths.push(p);
  }
  return {
    paths,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function cleanupAgyArtifact(artifactPath: string): Promise<void> {
  try {
    await rm(artifactPath, { force: true }).catch(() => {});
    const dir = dirname(artifactPath);
    const entries = await readdir(dir).catch(() => null);
    if (entries && entries.length === 0) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

export async function generateViaAgy(
  prompt: string,
  options: {
    references?: RefDetail[];
    signal?: AbortSignal;
    requestId?: string;
  } = {},
): Promise<AgyGenerateResult> {
  const refDetails = (options.references || []).slice(0, deriveReferenceLimit("agy", "edit"));
  const { paths: refPaths, cleanup } = await writeRefsToTempFiles(refDetails);
  const agyPrompt = buildAgyPrompt(prompt, refPaths);

  logEvent("agy", "generate:start", {
    requestId: options.requestId,
    promptChars: prompt.length,
    agyPromptChars: agyPrompt.length,
    refs: refPaths.length,
  });

  try {
    const generationStartedAtMs = Date.now();
    const { stdout, stderr } = await spawnAgy(agyPrompt, options.signal);

    if (stderr && stderr.trim().length > 0) {
      logEvent("agy", "generate:stderr", {
        requestId: options.requestId,
        stderrChars: stderr.length,
        stderrPreview: stderr.slice(0, 200),
      });
    }

    const agyCombinedOutput = [stdout, stderr].filter(Boolean).join("\n");

    let artifactPath: string;
    try {
      artifactPath = parseAgyOutput(agyCombinedOutput).artifactPath;
    } catch (err) {
      if ((err as any)?.code !== "AGY_PARSE_FAILED") {
        throw err;
      }

      const fallbackPath = await findRecentAgyArtifact(generationStartedAtMs);
      if (!fallbackPath) {
        throw err;
      }

      logEvent("agy", "generate:fallback_artifact_found", {
        requestId: options.requestId,
        artifactPath: fallbackPath,
        stdoutChars: stdout.length,
        stderrChars: stderr.length,
      });

      artifactPath = fallbackPath;
    }

    // Validate artifact path is within allowed directories
    const resolvedPath = resolve(artifactPath);
    const allowedPrefixes = [
      join(homedir(), ".gemini"),
      join(homedir(), ".cache"),
      tmpdir(),
    ];
    const normalizedResolved = resolvedPath.replace(/\\/g, "/");
    const isSafePath = allowedPrefixes.some((prefix) => {
      const normalizedPrefix = prefix.replace(/\\/g, "/");
      return normalizedResolved.startsWith(normalizedPrefix + "/") || normalizedResolved === normalizedPrefix;
    });
    if (!isSafePath) {
      throw agyError(
        `Agy artifact path outside allowed directories: ${resolvedPath}`,
        502,
        "AGY_PATH_REJECTED",
      );
    }

    try {
      await stat(resolvedPath);
    } catch {
      throw agyError(
        `Agy artifact not found at parsed path: ${resolvedPath}`,
        502,
        "AGY_ARTIFACT_NOT_FOUND",
      );
    }

    const buffer = await readFile(resolvedPath);
    const b64 = buffer.toString("base64");
    const mime = detectImageMimeFromB64(b64) || "image/png";

    logEvent("agy", "generate:done", {
      requestId: options.requestId,
      artifactPath,
      b64Len: b64.length,
      mime,
      fileBytes: buffer.length,
    });

    await cleanupAgyArtifact(resolvedPath);

    return {
      b64,
      revisedPrompt: prompt,
      usage: { agy_artifact_bytes: buffer.length },
      webSearchCalls: 0,
      mime,
    };
  } catch (err) {
    logEvent("agy", "generate:failed_cleanup", { requestId: options.requestId });
    throw err;
  } finally {
    await cleanup();
  }
}
