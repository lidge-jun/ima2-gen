import { writeFile, readFile, access, mkdir } from "fs/promises";
import { join, resolve, sep } from "path";
import { randomBytes } from "crypto";
import { config } from "../config.js";
import { embedImageMetadataBestEffort } from "./imageMetadataStore.js";

export function newNodeId() {
  return "n_" + randomBytes(config.ids.nodeHexBytes).toString("hex");
}

interface SaveNodeOptions {
  nodeId: string;
  b64: string;
  meta: Record<string, unknown>;
  ext?: string;
  generatedDir?: string;
}

export async function saveNode(rootDir: string, { nodeId, b64, meta, ext = "png", generatedDir = config.storage.generatedDir }: SaveNodeOptions) {
  void rootDir;
  const filename = `${nodeId}.${ext}`;
  await mkdir(generatedDir, { recursive: true });
  const imageMeta = {
    ...meta,
    kind: meta?.kind || "node",
    nodeId: meta?.nodeId || nodeId,
    format: meta?.format || ext,
  };
  const rawBuffer = Buffer.from(b64, "base64");
  const embedded = await embedImageMetadataBestEffort(rawBuffer, ext, imageMeta) as { embedded: boolean; warning?: string; buffer: Buffer };
  if (!embedded.embedded) {
    console.warn("[nodeStore] metadata embed skipped:", embedded.warning);
  }
  await writeFile(join(generatedDir, filename), embedded.buffer);
  await writeFile(join(generatedDir, filename + ".json"), JSON.stringify(meta, null, 2));
  return { filename };
}

export async function loadNodeB64(rootDir: string, filename: string, generatedDir = config.storage.generatedDir) {
  const p = resolveGeneratedPath(rootDir, filename, generatedDir);
  try { await access(p); } catch {
    const err = new Error(`Node file not found: ${filename}`) as Error & { code?: string; status?: number };
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

export async function loadNodeMeta(rootDir: string, nodeId: string, ext = "png", generatedDir = config.storage.generatedDir) {
  void rootDir;
  try {
    return JSON.parse(await readFile(join(generatedDir, `${nodeId}.${ext}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export async function loadAssetB64(rootDir: string, externalSrc: string, generatedDir = config.storage.generatedDir) {
  const p = resolveGeneratedPath(rootDir, externalSrc, generatedDir);
  try { await access(p); } catch {
    const err = new Error(`Asset file not found: ${externalSrc}`) as Error & { code?: string; status?: number };
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

function resolveGeneratedPath(rootDir: string, relPath: string, generatedDir = config.storage.generatedDir) {
  void rootDir;
  if (typeof relPath !== "string" || relPath.length === 0) {
    const err = new Error("Asset path is required") as Error & { code?: string; status?: number };
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  const baseDir = resolve(generatedDir);
  const target = resolve(baseDir, relPath);
  if (target !== baseDir && !target.startsWith(baseDir + sep)) {
    const err = new Error(`Asset path escapes generated/: ${relPath}`) as Error & { code?: string; status?: number };
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  return target;
}
