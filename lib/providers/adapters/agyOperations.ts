import { rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnAgy, agyError } from "../../agyProcess.js";
import { parseAgyOutput, findRecentAgyArtifact } from "../../agyArtifact.js";
import { readAgyArtifact, cleanupAgyArtifact } from "../../agyArtifactRead.js";
import { logEvent } from "../../logger.js";
import { SAFETY_INTENT_POLICY } from "../../promptSafetyPolicy.js";
import { detectImageMimeFromB64 } from "../../refs.js";
import { deriveReferenceLimit } from "../derive.js";

export interface AgyGenerateResult {
  b64: string;
  revisedPrompt?: string;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime?: string;
}

const AGY_OUTPUT_RESOLUTION = "1024x1024";

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
  const cleanup = async () => {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch { /* best-effort: preserve the primary staging/operation error */ }
  };
  try {
    await mkdir(dir, { recursive: true });
    const paths: string[] = [];
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!ref) continue;
      const mime = ref.detectedMime || ref.declaredMime || detectImageMimeFromB64(ref.b64) || "image/png";
      const ext = MIME_TO_EXT[mime] || "png";
      const p = join(dir, `ref_${i}.${ext}`);
      await writeFile(p, Buffer.from(ref.b64, "base64"));
      paths.push(p);
    }
    return { paths, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

function throwIfAgyAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw agyError("Generation canceled", 499, "GENERATION_CANCELED");
  }
}

async function resolveAgyArtifactPath(
  stdout: string, stderr: string, generationStartedAtMs: number, requestId?: string,
): Promise<string> {
  if (stderr && stderr.trim().length > 0) {
    logEvent("agy", "generate:stderr", {
      requestId,
      stderrChars: stderr.length,
      stderrPreview: stderr.slice(0, 200),
    });
  }
  const agyCombinedOutput = [stdout, stderr].filter(Boolean).join("\n");
  try {
    return parseAgyOutput(agyCombinedOutput).artifactPath;
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== "AGY_PARSE_FAILED") {
      throw err;
    }
    const fallbackPath = await findRecentAgyArtifact(generationStartedAtMs);
    if (!fallbackPath) {
      throw err;
    }
    logEvent("agy", "generate:fallback_artifact_found", {
      requestId,
      artifactPath: fallbackPath,
      stdoutChars: stdout.length,
      stderrChars: stderr.length,
    });
    return fallbackPath;
  }
}

async function readAgyArtifactResult(
  artifactPath: string, prompt: string, signal?: AbortSignal, requestId?: string,
): Promise<AgyGenerateResult> {
  const receipt = await readAgyArtifact(artifactPath, signal);
  const { buffer } = receipt;
  let result: AgyGenerateResult;
  try {
    throwIfAgyAborted(signal);
    const b64 = buffer.toString("base64");
    const mime = detectImageMimeFromB64(b64) || "image/png";
    logEvent("agy", "generate:done", {
      requestId,
      artifactPath,
      b64Len: b64.length,
      mime,
      fileBytes: buffer.length,
    });
    result = {
      b64,
      revisedPrompt: prompt,
      usage: { agy_artifact_bytes: buffer.length },
      webSearchCalls: 0,
      mime,
    };
  } finally {
    // Only the trusted reader's issued receipt authorizes artifact cleanup.
    await cleanupAgyArtifact(receipt);
  }
  throwIfAgyAborted(signal);
  return result;
}

export async function generateViaAgy(
  prompt: string,
  options: {
    references?: RefDetail[] | undefined;
    signal?: AbortSignal | undefined;
    requestId?: string | undefined;
  } = {},
): Promise<AgyGenerateResult> {
  throwIfAgyAborted(options.signal);
  const refDetails = (options.references || []).slice(0, deriveReferenceLimit("agy", "edit"));
  const { paths: refPaths, cleanup } = await writeRefsToTempFiles(refDetails);
  let result: AgyGenerateResult;
  try {
    throwIfAgyAborted(options.signal);
    const agyPrompt = buildAgyPrompt(prompt, refPaths);
    logEvent("agy", "generate:start", {
      requestId: options.requestId,
      promptChars: prompt.length,
      agyPromptChars: agyPrompt.length,
      refs: refPaths.length,
    });
    const generationStartedAtMs = Date.now();
    const { stdout, stderr } = await spawnAgy(agyPrompt, options.signal);
    throwIfAgyAborted(options.signal);
    const artifactPath = await resolveAgyArtifactPath(stdout, stderr, generationStartedAtMs, options.requestId);
    throwIfAgyAborted(options.signal);
    result = await readAgyArtifactResult(artifactPath, prompt, options.signal, options.requestId);
  } catch (err) {
    try {
      logEvent("agy", "generate:failed_cleanup", { requestId: options.requestId });
    } catch { /* Logging must not replace the primary operation error. */ }
    throw err;
  } finally {
    await cleanup();
  }
  // No await after this barrier: cancellation during reference cleanup must win.
  throwIfAgyAborted(options.signal);
  return result;
}
