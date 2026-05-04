import { mkdir, writeFile, access, readFile } from "fs/promises";
import { constants } from "fs";
import { basename, join, normalize, parse } from "path";
import { randomBytes } from "crypto";
import { embedImageMetadataBestEffort } from "./imageMetadataStore.js";
import type { RuntimeContext } from "./runtimeContext.js";

interface CanvasMeta {
  kind: string;
  provider: string;
  format: string;
  prompt: string | null | undefined;
  userPrompt: string | null | undefined;
  promptMode: string;
  createdAt: number;
  canvasMergedAt: number;
  canvasVersion: boolean;
  canvasSourceFilename: string | null;
  canvasEditableFilename: string;
  size?: string | null;
  quality?: string | null;
  model?: string | null;
  moderation?: string | null;
  revisedPrompt?: string | null;
}

interface StoredGeneratedMeta {
  prompt?: string | null;
  userPrompt?: string | null;
  promptMode?: string | null;
  provider?: string | null;
  quality?: string | null;
  size?: string | null;
  model?: string | null;
  moderation?: string | null;
  createdAt?: number;
  canvasMergedAt?: number;
  canvasSourceFilename?: string | null;
}

interface CanvasInput {
  buffer: unknown;
  sourceFilename?: string | null;
  prompt?: string | null;
}

const PNG_SIGNATURE = "89504e470d0a1a0a";

function assertPngBuffer(buffer: unknown): asserts buffer is Buffer {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err: any = new Error("PNG body is required");
    err.status = 400;
    err.code = "EMPTY_CANVAS_VERSION";
    throw err;
  }
  if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
    const err: any = new Error("Canvas version body must be a PNG image");
    err.status = 400;
    err.code = "CANVAS_VERSION_NOT_PNG";
    throw err;
  }
}

function assertSafeFilename(filename: string) {
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    filename !== basename(filename) ||
    filename.includes("..") ||
    !/^canvas-[a-zA-Z0-9._-]+\.png$/.test(filename)
  ) {
    const err: any = new Error("Invalid canvas version filename");
    err.status = 400;
    err.code = "INVALID_CANVAS_VERSION_FILENAME";
    throw err;
  }
}

function safeSourceBase(sourceFilename: string | null | undefined) {
  const parsed = parse(basename(String(sourceFilename || "image")));
  return parsed.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";
}

function ensureInsideGeneratedDir(generatedDir: string, filename: string) {
  const full = normalize(join(generatedDir, filename));
  const root = normalize(generatedDir);
  if (!full.startsWith(root)) {
    const err: any = new Error("Canvas version path escapes generated directory");
    err.status = 400;
    err.code = "CANVAS_VERSION_PATH_ESCAPE";
    throw err;
  }
  return full;
}

function makeCanvasFilename(sourceFilename: string | null | undefined) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const rand = randomBytes(3).toString("hex");
  return `canvas-${safeSourceBase(sourceFilename)}-${stamp}-${rand}.png`;
}

async function writeCanvasPng(ctx: RuntimeContext, filename: string, buffer: Buffer, meta: CanvasMeta) {
  await mkdir(ctx.config.storage.generatedDir, { recursive: true });
  const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, filename);
  const embedded = await embedImageMetadataBestEffort(buffer, "png", meta, {
    version: ctx.packageVersion,
  });
  await writeFile(full, embedded.buffer);
  await writeFile(`${full}.json`, JSON.stringify(meta)).catch(() => {});
}

async function readGeneratedMetadata(ctx: RuntimeContext, filename: string | null | undefined): Promise<StoredGeneratedMeta | null> {
  if (!filename) return null;
  try {
    const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, basename(filename));
    return JSON.parse(await readFile(`${full}.json`, "utf8")) as StoredGeneratedMeta;
  } catch {
    return null;
  }
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function toGenerateItem(filename: string, meta: CanvasMeta) {
  const url = `/generated/${encodeURIComponent(filename)}`;
  return {
    image: url,
    url,
    thumb: url,
    filename,
    prompt: meta.prompt || undefined,
    userPrompt: meta.userPrompt || meta.prompt || null,
    revisedPrompt: null,
    promptMode: meta.promptMode || "direct",
    provider: meta.provider || "canvas",
    quality: meta.quality || null,
    size: meta.size || null,
    format: "png",
    moderation: meta.moderation || null,
    model: meta.model || null,
    usage: null,
    createdAt: meta.createdAt,
    kind: "edit",
    canvasMergedAt: meta.canvasMergedAt,
    canvasVersion: true,
    canvasSourceFilename: meta.canvasSourceFilename || null,
    canvasEditableFilename: filename,
  };
}

export async function createCanvasVersion(ctx: RuntimeContext, input: CanvasInput) {
  assertPngBuffer(input.buffer);
  const sourceFilename = basename(String(input.sourceFilename || ""));
  if (!sourceFilename) {
    const err: any = new Error("sourceFilename is required");
    err.status = 400;
    err.code = "CANVAS_SOURCE_REQUIRED";
    throw err;
  }
  const filename = makeCanvasFilename(sourceFilename);
  const now = Date.now();
  const sourceMeta = await readGeneratedMetadata(ctx, sourceFilename);
  const prompt = firstString(input.prompt, sourceMeta?.userPrompt, sourceMeta?.prompt);
  const meta = {
    kind: "edit",
    provider: "canvas",
    format: "png",
    prompt,
    userPrompt: prompt,
    promptMode: sourceMeta?.promptMode || "direct",
    createdAt: now,
    canvasMergedAt: now,
    canvasVersion: true,
    canvasSourceFilename: sourceFilename,
    canvasEditableFilename: filename,
  };
  await writeCanvasPng(ctx, filename, input.buffer, meta);
  return toGenerateItem(filename, meta);
}

export async function updateCanvasVersion(ctx: RuntimeContext, filename: string, input: CanvasInput) {
  assertSafeFilename(filename);
  assertPngBuffer(input.buffer);
  const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, filename);
  await access(full, constants.F_OK).catch(() => {
    const err: any = new Error("Canvas version not found");
    err.status = 404;
    err.code = "CANVAS_VERSION_NOT_FOUND";
    throw err;
  });
  const now = Date.now();
  const sourceFilename = typeof input.sourceFilename === "string"
    ? basename(input.sourceFilename)
    : null;
  const sourceMeta = await readGeneratedMetadata(ctx, sourceFilename);
  const previousMeta = await readGeneratedMetadata(ctx, filename);
  const prompt = firstString(
    input.prompt,
    sourceMeta?.userPrompt,
    sourceMeta?.prompt,
    previousMeta?.userPrompt,
    previousMeta?.prompt,
  );
  const meta = {
    kind: "edit",
    provider: "canvas",
    format: "png",
    prompt,
    userPrompt: prompt,
    promptMode: sourceMeta?.promptMode || previousMeta?.promptMode || "direct",
    createdAt: now,
    canvasMergedAt: now,
    canvasVersion: true,
    canvasSourceFilename: sourceFilename,
    canvasEditableFilename: filename,
  };
  await writeCanvasPng(ctx, filename, input.buffer, meta);
  return toGenerateItem(filename, meta);
}
