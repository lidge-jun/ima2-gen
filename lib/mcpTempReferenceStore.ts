import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { detectImageMimeFromB64, validateAndNormalizeRefs } from "./refs.js";

export const MCP_TEMP_REFERENCE_MAX_IMAGES = 3;
export const MCP_TEMP_REFERENCE_MAX_BYTES = 50 * 1024 * 1024;
export const MCP_TEMP_REFERENCE_TTL_MS = 60 * 60 * 1000;
export const MCP_TEMP_REFERENCE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const MAX_BASE64_CHARS = 4 * Math.ceil(MCP_TEMP_REFERENCE_MAX_BYTES / 3);
export const MCP_TEMP_REFERENCE_JSON_BODY_LIMIT_BYTES =
  MCP_TEMP_REFERENCE_MAX_IMAGES * (MAX_BASE64_CHARS + 256) + 1024 * 1024;

const DATA_URL_PREFIX = /^data:(image\/(?:png|jpeg|webp));base64,/i;
const BATCH_ID_PATTERN = /^[0-9a-f]{16}$/;
const TEMP_FILENAME_PATTERN = /^tmpref_([0-9a-f]{16})_([1-3])\.(png|jpeg|webp)$/;
const MIME_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
} as const;

type SupportedMime = keyof typeof MIME_EXTENSION;
type ValidatedImage = { dataUrl: string; tag?: string };
export type McpTempReferenceFile = { filename: string; tag?: string };

function storeError(code: string, message: string): Error & { status: number; code: string } {
  return Object.assign(new Error(message), { status: 400, code });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBatchPayload(body: unknown): ValidatedImage[] {
  if (!isRecord(body) || Object.keys(body).some((key) => key !== "images")) {
    throw storeError("INVALID_MCP_TEMP_REFERENCES", "body must contain only an images array");
  }
  if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > MCP_TEMP_REFERENCE_MAX_IMAGES) {
    throw storeError("INVALID_MCP_TEMP_REFERENCES", "images must contain 1 to 3 entries");
  }
  return body.images.map((entry, index): ValidatedImage => {
    if (!isRecord(entry) || Object.keys(entry).some((key) => key !== "dataUrl" && key !== "tag")) {
      throw storeError("INVALID_MCP_TEMP_REFERENCE", `images[${index}] must contain dataUrl and optional tag`);
    }
    if (typeof entry.dataUrl !== "string") {
      throw storeError("INVALID_MCP_TEMP_REFERENCE", `images[${index}].dataUrl must be a string`);
    }
    const tag = entry.tag;
    if (typeof tag === "string") return { dataUrl: entry.dataUrl, tag };
    if (tag === undefined) return { dataUrl: entry.dataUrl };
    throw storeError("INVALID_MCP_TEMP_REFERENCE", `images[${index}].tag must be a string`);
  });
}

function decodeImage(dataUrl: string, index: number): { buffer: Buffer; extension: string } {
  const prefix = DATA_URL_PREFIX.exec(dataUrl);
  if (!prefix) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_MIME", `images[${index}] must be a PNG, JPEG, or WebP data URL`);
  }
  const parsed = validateAndNormalizeRefs([dataUrl], { maxCount: 1, maxB64Bytes: MAX_BASE64_CHARS });
  if (parsed.error || !parsed.refs) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_DATA", `images[${index}] is not valid base64 image data`);
  }
  const normalizedB64 = parsed.refs[0];
  const declaredMimeRaw = prefix[1];
  if (!normalizedB64 || !declaredMimeRaw) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_DATA", `images[${index}] is not valid base64 image data`);
  }
  const declaredMime = declaredMimeRaw.toLowerCase() as SupportedMime;
  const buffer = Buffer.from(normalizedB64, "base64");
  if (buffer.length === 0 || buffer.length > MCP_TEMP_REFERENCE_MAX_BYTES) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_SIZE", `images[${index}] must be at most 50MB`);
  }
  const detectedMime = buffer.length >= 12 ? detectImageMimeFromB64(normalizedB64) : null;
  if (detectedMime !== declaredMime) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_FORMAT", `images[${index}] MIME does not match its image bytes`);
  }
  return { buffer, extension: MIME_EXTENSION[declaredMime] };
}

function containedTarget(generatedDir: string, filename: string): string {
  const root = resolve(generatedDir);
  const target = resolve(root, filename);
  if (!target.startsWith(`${root}${sep}`)) {
    throw storeError("INVALID_MCP_TEMP_REFERENCE_PATH", "temporary reference path escapes generated storage");
  }
  return target;
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function isExistingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "EEXIST";
}

async function rollbackFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await unlink(path);
    } catch (error) {
      if (!isMissingFile(error)) continue;
    }
  }
}

export async function createMcpTempReferenceBatch(
  generatedDir: string,
  body: unknown,
): Promise<{ batchId: string; files: McpTempReferenceFile[] }> {
  const images = validateBatchPayload(body);
  const batchId = randomBytes(8).toString("hex");
  const writtenPaths: string[] = [];
  const files: McpTempReferenceFile[] = [];
  try {
    await mkdir(generatedDir, { recursive: true });
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (!image) continue;
      const decoded = decodeImage(image.dataUrl, index);
      const filename = `tmpref_${batchId}_${index + 1}.${decoded.extension}`;
      const target = containedTarget(generatedDir, filename);
      try {
        await writeFile(target, decoded.buffer, { flag: "wx" });
        writtenPaths.push(target);
      } catch (error) {
        if (!isExistingFile(error)) writtenPaths.push(target);
        throw error;
      }
      files.push({ filename, ...(image.tag !== undefined ? { tag: image.tag } : {}) });
    }
    return { batchId, files };
  } catch (error) {
    await rollbackFiles(writtenPaths);
    if ((error as { status?: unknown })?.status === 400) throw error;
    throw storeError("MCP_TEMP_REFERENCE_BATCH_FAILED", "temporary reference batch could not be saved");
  }
}

export async function deleteMcpTempReferenceBatch(generatedDir: string, batchId: string): Promise<number> {
  if (!BATCH_ID_PATTERN.test(batchId)) return 0;
  try {
    const entries = await readdir(generatedDir, { withFileTypes: true });
    const matching = entries.filter((entry) => {
      const match = TEMP_FILENAME_PATTERN.exec(entry.name);
      return match?.[1] === batchId && (entry.isFile() || entry.isSymbolicLink());
    });
    let deleted = 0;
    for (const entry of matching) {
      try {
        await unlink(containedTarget(generatedDir, entry.name));
        deleted += 1;
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
    return deleted;
  } catch (error) {
    if (isMissingFile(error)) return 0;
    throw error;
  }
}

export async function cleanupExpiredMcpTempReferences(
  generatedDir: string,
  now = Date.now(),
): Promise<number> {
  try {
    const entries = await readdir(generatedDir, { withFileTypes: true });
    let deleted = 0;
    for (const entry of entries) {
      if (!entry.name.startsWith("tmpref_") || (!entry.isFile() && !entry.isSymbolicLink())) continue;
      const target = containedTarget(generatedDir, entry.name);
      try {
        const info = await lstat(target);
        if (info.mtimeMs >= now - MCP_TEMP_REFERENCE_TTL_MS) continue;
        await unlink(target);
        deleted += 1;
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
    return deleted;
  } catch (error) {
    if (isMissingFile(error)) return 0;
    throw error;
  }
}
