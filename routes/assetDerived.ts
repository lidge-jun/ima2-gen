import express, { type Express, type Request, type Response } from "express";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import { config } from "../config.js";
import { errInfo } from "../lib/errInfo.js";
import { logEvent } from "../lib/logger.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";
import { assertRegularGeneratedPath, resolveInGenerated } from "../lib/assetLifecycle.js";
import { isRasterPath, isVectorPreset, vectorizeImageBuffer, type VectorPreset } from "../lib/vectorizeImage.js";
import { createAsset } from "../lib/assetsStore.js";
import { safeWriteSidecar } from "../lib/atomicWrite.js";
import { invalidateHistoryIndex } from "../lib/historyIndex.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DERIVED_KINDS = ["keyed-png", "vector-svg"] as const;
const MAX_META_BYTES = 2048;

function httpError(status: number, code: string, message: string): Error {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw) return {};
  if (raw.length > MAX_META_BYTES) throw httpError(400, "DERIVED_META_TOO_LARGE", "meta query too large");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw httpError(400, "DERIVED_META_INVALID", "meta query must be a JSON object");
  }
}

function numericQuery(raw: unknown): number | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Trace an existing generated raster into SVG.
 *
 * The client sends NO body: the source is already validated inside generated
 * storage, so the server reads it directly. That avoids re-uploading megabytes the
 * server already has, and keeps arbitrary XML off the request surface.
 */
async function handleVectorSvg(
  req: Request,
  res: Response,
  source: { sourceRel: string; sourceAbs: string },
): Promise<void> {
  const { sourceRel, sourceAbs } = source;
  if (!isRasterPath(sourceRel)) {
    // Guards against tracing an existing .svg (no recursion) and against video
    // files, which already live in the same directory.
    throw httpError(400, "DERIVED_SOURCE_NOT_RASTER", "source must be a png, jpeg, or webp image");
  }
  const presetRaw = typeof req.query.preset === "string" ? req.query.preset : "auto";
  if (!isVectorPreset(presetRaw)) {
    throw httpError(400, "DERIVED_PRESET_INVALID", "preset must be one of: auto, flat, detailed, mono");
  }
  const preset: VectorPreset = presetRaw;

  const traced = await vectorizeImageBuffer(await readFile(sourceAbs), {
    preset,
    colorPrecision: numericQuery(req.query.colorPrecision),
    filterSpeckle: numericQuery(req.query.filterSpeckle),
    cornerThreshold: numericQuery(req.query.cornerThreshold),
  });

  const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : undefined;
  const meta = parseMeta(req.query.meta);
  const stem = basename(sourceRel).replace(/\.[a-z0-9]+$/i, "");
  const outName = `${stem}-vector-${Date.now()}.svg`;
  const outAbs = resolveInGenerated(config.storage.generatedDir, outName);
  await writeFile(outAbs, traced.svg, "utf8");
  await safeWriteSidecar(`${outAbs}.json`, {
    kind: "vector-svg",
    derivedFrom: sourceRel,
    createdAt: Date.now(),
    preset: traced.preset,
    pathCount: traced.pathCount,
    ...meta,
  });

  const asset = createAsset({
    kind: "image",
    name: typeof req.query.name === "string" && req.query.name ? req.query.name.slice(0, 80) : outName,
    filePath: outName,
    folderId: projectId,
    notes: undefined,
    metadata: {
      derivedFrom: sourceRel,
      derivedKind: "vector-svg",
      vector: true,
      preset: traced.preset,
      pathCount: traced.pathCount,
      ...meta,
    },
    tags: [],
  });
  invalidateHistoryIndex();
  logEvent("assets", "derived-create", { assetId: asset.id, kind: "vector-svg", source: sourceRel });
  res.status(201).json({
    filePath: outName,
    asset,
    pathCount: traced.pathCount,
    bytes: traced.bytes,
    elapsedMs: traced.elapsedMs,
    preset: traced.preset,
  });
}

export function registerAssetDerivedRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  requireRuntimeContext(ctxRaw);
  const rawPng = express.raw({ type: "image/png", limit: "30mb" });

  app.post("/api/assets/derived", rawPng, async (req: Request, res: Response) => {
    try {
      const kind = typeof req.query.kind === "string" ? req.query.kind : "keyed-png";
      if (!(DERIVED_KINDS as readonly string[]).includes(kind)) {
        throw httpError(400, "DERIVED_KIND_INVALID", `kind must be one of: ${DERIVED_KINDS.join(", ")}`);
      }
      const sourceRel = typeof req.query.source === "string" ? req.query.source.trim() : "";
      if (!sourceRel) throw httpError(400, "DERIVED_SOURCE_REQUIRED", "source query is required");
      const sourceAbs = resolveInGenerated(config.storage.generatedDir, sourceRel);
      if (!existsSync(sourceAbs)) throw httpError(400, "DERIVED_SOURCE_MISSING", "source does not exist in generated storage");
      await assertRegularGeneratedPath(sourceAbs);

      if (kind === "vector-svg") {
        await handleVectorSvg(req, res, { sourceRel, sourceAbs });
        return;
      }

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length < PNG_SIGNATURE.length || !body.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw httpError(400, "DERIVED_BODY_NOT_PNG", "body must be a PNG (image/png raw body)");
      }

      const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : undefined;
      const meta = parseMeta(req.query.meta);
      const stem = basename(sourceRel).replace(/\.[a-z0-9]+$/i, "");
      const outName = `${stem}-keyed-${Date.now()}.png`;
      const outAbs = resolveInGenerated(config.storage.generatedDir, outName);
      await writeFile(outAbs, body);
      await safeWriteSidecar(`${outAbs}.json`, {
        kind,
        derivedFrom: sourceRel,
        createdAt: Date.now(),
        ...meta,
      });

      const asset = createAsset({
        kind: "image",
        name: typeof req.query.name === "string" && req.query.name ? req.query.name.slice(0, 80) : outName,
        filePath: outName,
        folderId: projectId,
        notes: undefined,
        metadata: { derivedFrom: sourceRel, derivedKind: kind, ...meta },
        tags: [],
      });
      invalidateHistoryIndex();
      logEvent("assets", "derived-create", { assetId: asset.id, kind, source: sourceRel });
      res.status(201).json({ filePath: outName, asset });
    } catch (e) {
      const err = errInfo(e);
      res.status(err.status || 500).json({ error: err.message, code: err.code || "DERIVED_SAVE_FAILED" });
    }
  });
}
