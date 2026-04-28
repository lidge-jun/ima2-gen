import { mkdir, writeFile, access, readFile } from "fs/promises";
import { constants } from "fs";
import { basename, join, normalize, parse } from "path";
import { randomBytes } from "crypto";
import { embedImageMetadataBestEffort } from "./imageMetadataStore.js";
const PNG_SIGNATURE = "89504e470d0a1a0a";
function assertPngBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const err = new Error("PNG body is required");
        err.status = 400;
        err.code = "EMPTY_CANVAS_VERSION";
        throw err;
    }
    if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
        const err = new Error("Canvas version body must be a PNG image");
        err.status = 400;
        err.code = "CANVAS_VERSION_NOT_PNG";
        throw err;
    }
}
function assertSafeFilename(filename) {
    if (typeof filename !== "string" ||
        filename.length === 0 ||
        filename !== basename(filename) ||
        filename.includes("..") ||
        !/^canvas-[a-zA-Z0-9._-]+\.png$/.test(filename)) {
        const err = new Error("Invalid canvas version filename");
        err.status = 400;
        err.code = "INVALID_CANVAS_VERSION_FILENAME";
        throw err;
    }
}
function safeSourceBase(sourceFilename) {
    const parsed = parse(basename(String(sourceFilename || "image")));
    return parsed.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";
}
function ensureInsideGeneratedDir(generatedDir, filename) {
    const full = normalize(join(generatedDir, filename));
    const root = normalize(generatedDir);
    if (!full.startsWith(root)) {
        const err = new Error("Canvas version path escapes generated directory");
        err.status = 400;
        err.code = "CANVAS_VERSION_PATH_ESCAPE";
        throw err;
    }
    return full;
}
function makeCanvasFilename(sourceFilename) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const rand = randomBytes(3).toString("hex");
    return `canvas-${safeSourceBase(sourceFilename)}-${stamp}-${rand}.png`;
}
async function writeCanvasPng(ctx, filename, buffer, meta) {
    await mkdir(ctx.config.storage.generatedDir, { recursive: true });
    const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, filename);
    const embedded = await embedImageMetadataBestEffort(buffer, "png", meta, {
        version: ctx.packageVersion,
    });
    await writeFile(full, embedded.buffer);
    await writeFile(`${full}.json`, JSON.stringify(meta)).catch(() => { });
}
async function readGeneratedMetadata(ctx, filename) {
    if (!filename)
        return null;
    try {
        const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, basename(filename));
        return JSON.parse(await readFile(`${full}.json`, "utf8"));
    }
    catch {
        return null;
    }
}
function firstString(...values) {
    return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}
function toGenerateItem(filename, meta) {
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
export async function createCanvasVersion(ctx, input) {
    assertPngBuffer(input.buffer);
    const sourceFilename = basename(String(input.sourceFilename || ""));
    if (!sourceFilename) {
        const err = new Error("sourceFilename is required");
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
export async function updateCanvasVersion(ctx, filename, input) {
    assertSafeFilename(filename);
    assertPngBuffer(input.buffer);
    const full = ensureInsideGeneratedDir(ctx.config.storage.generatedDir, filename);
    await access(full, constants.F_OK).catch(() => {
        const err = new Error("Canvas version not found");
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
    const prompt = firstString(input.prompt, sourceMeta?.userPrompt, sourceMeta?.prompt, previousMeta?.userPrompt, previousMeta?.prompt);
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
